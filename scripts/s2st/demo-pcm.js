/* global AudioWorkletProcessor, registerProcessor */
class DemoPCM extends AudioWorkletProcessor {
  constructor() {
    super();
    this.frame = new Int16Array(1600);
    this.used = 0;
    this.finished = false;
    this.port.onmessage = ({ data }) => {
      if (data !== "finish" || this.finished) return;
      this.finished = true;
      if (this.used) this.send(this.frame.slice(0, this.used));
      this.port.postMessage("finished");
    };
  }

  send(samples) {
    this.port.postMessage(samples.buffer, [samples.buffer]);
  }

  process(inputs) {
    if (this.finished) return false;
    const channel = inputs[0]?.[0];
    if (!channel) return true;
    for (const sample of channel) {
      this.frame[this.used++] = Math.round(
        Math.max(-1, Math.min(1, sample)) * 32767,
      );
      if (this.used === this.frame.length) {
        this.send(this.frame);
        this.frame = new Int16Array(1600);
        this.used = 0;
      }
    }
    return true;
  }
}
registerProcessor("demo-pcm", DemoPCM);
