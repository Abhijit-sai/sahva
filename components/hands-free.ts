import { listenPcm, type FrameConsumer } from "./pcm-input";
import type { PhraseInput } from "./live-microphone";

// Test short windows rather than averaging an entire 200 ms frame:
// a syllable can occupy only part of a frame.
export function speechEnergy(frame: ArrayBuffer) {
  const pcm = new Int16Array(frame);
  const windows: number[] = [];
  for (let i = 0; i < pcm.length; i += 320) {
    let power = 0;
    const end = Math.min(i + 320, pcm.length);
    for (let j = i; j < end; j++) power += pcm[j] * pcm[j];
    windows.push(Math.sqrt(power / (end - i)) / 32768);
  }
  return windows.sort((a, b) => b - a)[2] ?? 0;
}

export async function armHandsFree(
  signal: AbortSignal,
  blocked: () => boolean,
  begin: (
    input: PhraseInput,
    activity: { onset: number; lastVoiced: number },
  ) => Promise<void>,
  onLost: () => void,
) {
  let history: ArrayBuffer[] = [];
  let opening: ArrayBuffer[] | null = null;
  let deliver: FrameConsumer | null = null;
  let occupied = false;
  let activity: { onset: number; lastVoiced: number } | undefined;
  let quietAfterTurn = 0,
    floor = 0.002;
  await listenPcm(
    signal,
    (frame) => {
      if (signal.aborted) return;
      const energy = speechEnergy(frame);
      const voiced = energy > Math.max(0.009, floor * 3.5);
      if (activity && voiced) activity.lastVoiced = performance.now();
      if (deliver) {
        deliver(frame);
        return;
      }
      if (opening) {
        // Preserve the onset through a cross-region room lease and provider handshake.
        // Thirty 200 ms frames use at most 192 kB and never leave the device before authorization.
        if (opening.length < 30) opening.push(frame);
        else opening = null;
        return;
      }
      if (occupied || blocked()) {
        history = [];
        quietAfterTurn = 1;
        return;
      }
      if (!voiced) floor = 0.95 * floor + 0.05 * Math.min(energy, 0.02);
      if (quietAfterTurn > 0) {
        history = [];
        if (!voiced) quietAfterTurn--;
        return;
      }
      history.push(frame);
      if (history.length > 3) history.shift();
      if (!voiced) return;
      opening = history;
      history = [];
      occupied = true;
      const input: PhraseInput = (receive) => {
        if (!opening)
          throw Error(
            "Speech connection took too long. Please repeat the phrase.",
          );
        deliver = receive;
        const buffered = opening;
        opening = null;
        for (const f of buffered) receive(f);
        return () => {
          deliver = null;
        };
      };
      const onset = performance.now();
      activity = { onset, lastVoiced: onset };
      void begin(input, activity).finally(() => {
        activity = undefined;
        deliver = null;
        opening = null;
        occupied = false;
        quietAfterTurn = 1;
      });
    },
    onLost,
  );
}
