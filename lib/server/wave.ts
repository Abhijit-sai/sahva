export function wave(samples: Buffer, rate = 16000) {
  const h = Buffer.alloc(44);
  h.write("RIFF");
  h.writeUInt32LE(samples.length + 36, 4);
  h.write("WAVEfmt ", 8);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36);
  h.writeUInt32LE(samples.length, 40);
  return Buffer.concat([h, samples]);
}
