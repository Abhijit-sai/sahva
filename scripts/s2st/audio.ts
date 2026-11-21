import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { stat } from "node:fs/promises";

const decode = promisify(execFile);
export const now = () => performance.timeOrigin + performance.now();

export async function loadRecording(
  path: string,
  format: "wav" | "mov" = "wav",
) {
  if ((await stat(path)).size > 4_000_000)
    throw Error("Recording exceeds 4 MB");
  const { stdout } = await decode(
    "ffmpeg",
    [
      "-nostdin",
      "-v",
      "error",
      "-protocol_whitelist",
      "file",
      "-f",
      format,
      "-i",
      path,
      "-map",
      "0:a:0",
      "-ac",
      "1",
      "-ar",
      "16000",
      "-t",
      "26.1",
      "-f",
      "s16le",
      "pipe:1",
    ],
    {
      encoding: "buffer",
      maxBuffer: 840000,
      timeout: 10000,
      windowsHide: true,
    },
  );
  // The loopback recorder stops on a timer and its server accepts up to 26 s.
  if (stdout.length < 6400 || stdout.length > 832000)
    throw Error("Use a 0.2–26 second lab recording");
  return stdout;
}

export function wav(pcm: Buffer, rate: number) {
  const h = Buffer.alloc(44);
  h.write("RIFF");
  h.writeUInt32LE(pcm.length + 36, 4);
  h.write("WAVEfmt ", 8);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36);
  h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

// 10 ms RMS windows; energetic speech is a timing proxy that needs a listener check.
export function voicedBounds(pcm: Buffer, rate: number) {
  let first: number | null = null,
    last: number | null = null;
  for (let i = 0; i < pcm.length; i += rate / 50) {
    const end = Math.min(i + rate / 50, pcm.length);
    let energy = 0;
    for (let k = i; k < end; k += 2) energy += pcm.readInt16LE(k) ** 2;
    if (energy / ((end - i) / 2) > 180 ** 2) {
      first ??= (i * 500) / rate;
      last = (end * 500) / rate;
    }
  }
  return { first, last };
}
