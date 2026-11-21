import { readFile } from "node:fs/promises";

export async function recordingSheet() {
  const sheet = await readFile("qa/RECORDING_SHEET.md", "utf8");
  const prompts = new Map<string, { te: string; en: string; critical: string }>();
  for (const line of sheet.split(/\r?\n/)) {
    if (!/^\| \d\d \|/.test(line)) continue;
    const [, id, te, en, critical] = line.split("|").map((s) => s.trim());
    if (!te || !en || !critical || prompts.has(id))
      throw Error("Invalid or duplicate recording sheet row " + id);
    prompts.set(id, { te, en, critical });
  }
  return prompts;
}
