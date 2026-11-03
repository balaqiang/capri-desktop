// Her ears, in the audio thread: the microphone's samples brought down to 16 kHz mono (averaging what
// falls between two output samples, a plain low-pass), handed on in 20 ms frames with how loud each was.

const OUT_RATE = 16000;

class CapriEars extends AudioWorkletProcessor {
  constructor() {
    super();
    this.step = sampleRate / OUT_RATE; // input samples per output sample (sampleRate: the context's)
    this.acc = 0;
    this.accN = 0;
    this.pos = 0;
    this.frame = new Float32Array(320);
    this.fill = 0;
  }

  push(v) {
    this.frame[this.fill++] = v;
    if (this.fill < this.frame.length) return;
    let sum = 0;
    for (let j = 0; j < this.frame.length; j++) sum += this.frame[j] * this.frame[j];
    const samples = this.frame.slice();
    this.port.postMessage({ rms: Math.sqrt(sum / this.frame.length), samples }, [samples.buffer]);
    this.fill = 0;
  }

  process(inputs) {
    const input = inputs[0]?.[0];
    if (!input) return true;
    for (let i = 0; i < input.length; i++) {
      this.acc += input[i];
      this.accN++;
      this.pos += 1;
      if (this.pos >= this.step) {
        this.pos -= this.step;
        this.push(this.acc / this.accN);
        this.acc = 0;
        this.accN = 0;
      }
    }
    return true;
  }
}

registerProcessor('capri-ears', CapriEars);
