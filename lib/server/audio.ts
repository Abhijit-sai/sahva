import { execFile } from "node:child_process";
import { mkdtemp, writeFile, unlink, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

export const extensions: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "mp4",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
};
const decode = promisify(execFile);
// A seekable input handles phone-generated MP4 files with the index at the end.
// Count decoded samples to enforce duration even when the container omits it.
export async function audioDuration(bytes: Buffer, mime: string) {
  const formats: Record<string, string> = {
    "audio/webm": "matroska,webm",
    "audio/ogg": "ogg",
    "audio/mp4": "mov,mp4,m4a,3gp,3g2,mj2",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
  };
  if (!Object.hasOwn(formats, mime))
    throw new Error("Unsupported audio format");
  const dir = await mkdtemp(join(tmpdir(), "sahva-audio-"));
  const file = join(dir, "input." + extensions[mime]);
  try {
    await writeFile(file, bytes, { flag: "wx", mode: 0o600 });
    const { stdout } = await decode(
      "ffmpeg",
      [
        "-nostdin",
        "-v",
        "error",
        "-xerror",
        "-protocol_whitelist",
        "file",
        "-format_whitelist",
        formats[mime],
        "-i",
        file,
        "-map",
        "0:a:0",
        "-t",
        "30.1",
        "-ac",
        "1",
        "-ar",
        "16000",
        "-f",
        "s16le",
        "pipe:1",
      ],
      {
        encoding: "buffer",
        timeout: 10000,
        maxBuffer: 1_100_000,
        windowsHide: true,
      },
    );
    if (!stdout.length) throw new Error("Empty recording");
    return Math.round(stdout.length / 32);
  } finally {
    await unlink(file).catch(() => {});
    await rmdir(dir).catch(() => {});
  }
}
