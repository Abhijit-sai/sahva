/* global AudioWorkletProcessor, registerProcessor */
// The AudioContext resamples the microphone to 16 kHz. Emit 200 ms per frame.
class SahvaPCM extends AudioWorkletProcessor {
  constructor() {
    super();
    this.frame = new Int16Array(3200);
    this.offset = 0;
  }
  process(inputs) {
    const channel = inputs[0]?.[0];
    if (!channel) return true;
    for (const sample of channel) {
      this.frame[this.offset++] = Math.round(
        Math.max(-1, Math.min(1, sample)) * 32767,
      );
      if (this.offset === this.frame.length) {
        this.port.postMessage(this.frame.buffer, [this.frame.buffer]);
        this.frame = new Int16Array(3200);
        this.offset = 0;
      }
    }
    return true;
  }
}
registerProcessor("sahva-pcm", SahvaPCM);
