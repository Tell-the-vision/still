/**
 * STILL Ambience — Pink Noise engine (Web Audio API).
 *
 * - No audio file: the noise is synthesised once into a ~12 s stereo buffer
 *   (Paul Kellet's filter) with a cross-faded loop seam, then looped forever.
 * - Starts only from a user gesture (browser autoplay policy, CORE-07).
 * - Short gain ramps avoid clicks on start/stop.
 */

const LOOP_SECONDS = 12;
const CROSSFADE_SECONDS = 0.5;
const VOLUME = 0.22;

export type PinkNoiseState = "off" | "on" | "error";

type Ctor = typeof AudioContext;

function getAudioContextCtor(): Ctor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { AudioContext?: Ctor; webkitAudioContext?: Ctor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

export function isPinkNoiseSupported() {
  return getAudioContextCtor() !== null;
}

function fillPink(out: Float32Array, length: number) {
  let b0 = 0,
    b1 = 0,
    b2 = 0,
    b3 = 0,
    b4 = 0,
    b5 = 0,
    b6 = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.969 * b2 + white * 0.153852;
    b3 = 0.8665 * b3 + white * 0.3104856;
    b4 = 0.55 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.016898;
    out[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
    b6 = white * 0.115926;
  }
}

function buildBuffer(ctx: AudioContext): AudioBuffer {
  const sr = ctx.sampleRate;
  const n = Math.floor(sr * LOOP_SECONDS);
  const f = Math.floor(sr * CROSSFADE_SECONDS);
  const buffer = ctx.createBuffer(2, n, sr);
  for (let ch = 0; ch < 2; ch++) {
    const tmp = new Float32Array(n + f);
    fillPink(tmp, n + f);
    // Cross-fade the tail into the head so the loop seam is inaudible.
    for (let i = 0; i < f; i++) {
      const t = i / f;
      tmp[i] = tmp[i] * t + tmp[n + i] * (1 - t);
    }
    buffer.copyToChannel(tmp.subarray(0, n), ch);
  }
  return buffer;
}

export class PinkNoiseEngine {
  private ctx: AudioContext | null = null;
  private gain: GainNode | null = null;
  private source: AudioBufferSourceNode | null = null;
  private buffer: AudioBuffer | null = null;

  get playing() {
    return this.source !== null;
  }

  /** Must be called from a user gesture. */
  async start(): Promise<void> {
    const Ctor = getAudioContextCtor();
    if (!Ctor) throw new Error("이 브라우저는 오디오 재생을 지원하지 않습니다.");
    if (!this.ctx) {
      this.ctx = new Ctor();
      this.gain = this.ctx.createGain();
      this.gain.gain.value = 0;
      this.gain.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") await this.ctx.resume();
    if (this.source) return; // already playing

    this.buffer ??= buildBuffer(this.ctx);
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffer;
    src.loop = true;
    src.connect(this.gain!);
    src.start();
    this.source = src;

    const now = this.ctx.currentTime;
    this.gain!.gain.cancelScheduledValues(now);
    this.gain!.gain.setValueAtTime(0, now);
    this.gain!.gain.linearRampToValueAtTime(VOLUME, now + 0.4);
  }

  stop(): void {
    if (!this.ctx || !this.gain || !this.source) return;
    const src = this.source;
    this.source = null;
    const now = this.ctx.currentTime;
    this.gain.gain.cancelScheduledValues(now);
    this.gain.gain.setValueAtTime(this.gain.gain.value, now);
    this.gain.gain.linearRampToValueAtTime(0, now + 0.25);
    try {
      src.stop(now + 0.3);
    } catch {
      /* already stopped */
    }
    src.onended = () => src.disconnect();
  }

  dispose(): void {
    this.stop();
    void this.ctx?.close();
    this.ctx = null;
    this.gain = null;
    this.buffer = null;
  }
}
