import { readFile } from "node:fs/promises";
export async function installSyntheticMicrophone(page, wavePath) {
  await page.addInitScript(
    (base64) => {
      const tracks = [];
      let audio, clip, output;
      navigator.mediaDevices.getUserMedia = async () => {
        audio ??= new AudioContext();
        await audio.resume();
        clip ??= await audio.decodeAudioData(
          Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)).buffer,
        );
        output = audio.createMediaStreamDestination();
        tracks.push(...output.stream.getAudioTracks());
        return output.stream;
      };
      window.qaTracks = () =>
        tracks.filter((t) => t.readyState === "live").length;
      window.qaSpeak = async (seconds) => {
        await audio.resume();
        const source = audio.createBufferSource();
        source.buffer = clip;
        source.connect(output);
        source.start(0, 0, seconds ?? clip.duration);
      };
    },
    (await readFile(wavePath)).toString("base64"),
  );
}
