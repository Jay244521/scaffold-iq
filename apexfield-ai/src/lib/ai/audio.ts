/**
 * Browser audio helpers for the Gemini Live session.
 * Mic input: any device rate → 16 kHz mono 16-bit PCM, 100 ms chunks.
 * Model output: 24 kHz mono 16-bit PCM.
 */

export const INPUT_SAMPLE_RATE = 16_000;
export const OUTPUT_SAMPLE_RATE = 24_000;
/** 100 ms of 16 kHz audio per chunk sent to Gemini. */
export const CHUNK_SAMPLES = 1_600;

/**
 * AudioWorklet that box-filter decimates the device rate down to 16 kHz
 * (works for 48k, 44.1k and 16k contexts alike, so Firefox's "mic rate must
 * match context rate" restriction never bites), converts to Int16 and posts
 * 100 ms chunks plus an RMS level for the visualizer.
 */
export const PCM_CAPTURE_WORKLET = /* js */ `
class PcmCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ratio = sampleRate / ${INPUT_SAMPLE_RATE};
    this.phase = 0; this.acc = 0; this.count = 0;
    this.buf = new Int16Array(${CHUNK_SAMPLES}); this.len = 0; this.sumSq = 0;
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    for (let i = 0; i < ch.length; i++) {
      this.acc += ch[i]; this.count++; this.phase += 1;
      if (this.phase >= this.ratio) {
        this.phase -= this.ratio;
        let s = this.acc / this.count; this.acc = 0; this.count = 0;
        s = s < -1 ? -1 : s > 1 ? 1 : s;
        this.sumSq += s * s;
        this.buf[this.len++] = s < 0 ? s * 0x8000 : s * 0x7fff;
        if (this.len === this.buf.length) {
          const out = this.buf.slice(0);
          this.port.postMessage({ pcm: out.buffer, rms: Math.sqrt(this.sumSq / this.len) }, [out.buffer]);
          this.len = 0; this.sumSq = 0;
        }
      }
    }
    return true;
  }
}
registerProcessor("pcm-capture", PcmCaptureProcessor);
`;

/** Same algorithm as the worklet, for the ScriptProcessorNode fallback (older Safari / no worklet). */
export class PcmDownsampler {
  private ratio: number;
  private phase = 0;
  private acc = 0;
  private count = 0;
  private buf = new Int16Array(CHUNK_SAMPLES);
  private len = 0;
  private sumSq = 0;

  constructor(
    deviceRate: number,
    private onChunk: (pcm: ArrayBuffer, rms: number) => void,
  ) {
    this.ratio = deviceRate / INPUT_SAMPLE_RATE;
  }

  push(ch: Float32Array) {
    for (let i = 0; i < ch.length; i++) {
      this.acc += ch[i];
      this.count++;
      this.phase += 1;
      if (this.phase < this.ratio) continue;
      this.phase -= this.ratio;
      let s = this.acc / this.count;
      this.acc = 0;
      this.count = 0;
      s = Math.max(-1, Math.min(1, s));
      this.sumSq += s * s;
      this.buf[this.len++] = s < 0 ? s * 0x8000 : s * 0x7fff;
      if (this.len === this.buf.length) {
        const out = this.buf.slice(0);
        this.onChunk(out.buffer, Math.sqrt(this.sumSq / this.len));
        this.len = 0;
        this.sumSq = 0;
      }
    }
  }
}

export function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  const STEP = 0x8000;
  for (let i = 0; i < bytes.length; i += STEP) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + STEP) as unknown as number[]);
  }
  return btoa(bin);
}

/** Decode base64 little-endian Int16 PCM into Float32 samples in [-1, 1]. */
export function base64PcmToFloat32(b64: string): Float32Array {
  const bin = atob(b64);
  const n = bin.length >> 1;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const lo = bin.charCodeAt(i * 2);
    const hi = bin.charCodeAt(i * 2 + 1);
    let v = (hi << 8) | lo;
    if (v >= 0x8000) v -= 0x10000;
    out[i] = v / 0x8000;
  }
  return out;
}

/** "audio/pcm;rate=24000" → 24000 */
export function pcmRateFromMime(mime: string | undefined, fallback = OUTPUT_SAMPLE_RATE): number {
  const m = mime?.match(/rate=(\d+)/);
  return m ? Number(m[1]) : fallback;
}
