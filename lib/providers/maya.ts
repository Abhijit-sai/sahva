import { SpeechError } from "./sarvam.ts";

// The private Maya 2 Native server sits behind a bearer-authenticated HTTPS proxy.
export async function synthesizeSreekar(text: string) {
  const endpoint = process.env.MAYA_NATIVE_SPEECH_URL;
  const token = process.env.MAYA_NATIVE_TOKEN;
  if (!endpoint || !token) throw new SpeechError("tts", "SREEKAR_UNAVAILABLE");
  const url = new URL(endpoint);
  if (url.protocol !== "https:" || url.username || url.password)
    throw new SpeechError("tts", "SREEKAR_CONFIG");
  if (!text.trim() || Array.from(text).length > 2500)
    throw new SpeechError("tts", "TEXT_LENGTH");
  const start = performance.now();
  const response = await fetch(url, {
    method: "POST",
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
    headers: {
      authorization: "Bearer " + token,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      input: text,
      language: "te",
      voice: "Sreekar",
      response_format: "wav",
    }),
  });
  if (!response.ok || !response.body)
    throw new SpeechError("tts", "SREEKAR_UNAVAILABLE");
  const reader = response.body.getReader(),
    chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 4_000_000) throw new SpeechError("tts", "SIZE");
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  const audio = Buffer.concat(chunks);
  if (
    audio.length <= 44 ||
    audio.toString("ascii", 0, 4) !== "RIFF" ||
    audio.toString("ascii", 8, 12) !== "WAVE"
  )
    throw new SpeechError("tts", "INVALID_WAV");
  return {
    audio,
    speaker: "Sreekar",
    elapsedMs: Math.round(performance.now() - start),
    requestId: undefined,
  };
}
