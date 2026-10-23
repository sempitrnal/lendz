/**
 * The "cha-ching": a recorded voice clip (`/sounds/cha-ching.mp3`), decoded
 * once and played through the Web Audio API for instant playback. Until it
 * has loaded (or if it can't), a synthesized cash-register sound stands in:
 * a short filtered-noise "cha" followed by a bright bell "ching".
 *
 * Browsers only let audio start from a tap, and the payment finishes after the
 * tap, so `primeAudio` runs on the first touch of the page to unlock it.
 */

let context: AudioContext | null = null;

type AudioWindow = typeof window & { webkitAudioContext?: typeof AudioContext };

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (context) return context;
  const Ctor =
    window.AudioContext ?? (window as AudioWindow).webkitAudioContext;
  if (!Ctor) return null;
  try {
    context = new Ctor();
  } catch {
    context = null;
  }
  return context;
}

/** "full" is a schedule paid in full; "partial" only part of one. */
export type ChaChingKind = "full" | "partial";

const CLIP_URLS: Record<ChaChingKind, string> = {
  full: "/sounds/cha-ching.mp3",
  partial: "/sounds/partial.mp3",
};
const clips: Partial<Record<ChaChingKind, AudioBuffer>> = {};
const clipsLoading = new Set<ChaChingKind>();

/** Fetches and decodes a recording once; failures leave the synth in use. */
function loadClip(ctx: AudioContext, kind: ChaChingKind): void {
  if (clips[kind] || clipsLoading.has(kind)) return;
  clipsLoading.add(kind);
  fetch(CLIP_URLS[kind])
    .then((res) => (res.ok ? res.arrayBuffer() : Promise.reject()))
    .then((bytes) => ctx.decodeAudioData(bytes))
    .then((buffer) => {
      clips[kind] = buffer;
    })
    .catch(() => {})
    .finally(() => {
      clipsLoading.delete(kind);
    });
}

/** Unlocks audio from inside a tap. Safe to call again. */
export function primeAudio(): void {
  const ctx = getContext();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume().catch(() => {});
  loadClip(ctx, "full");
  loadClip(ctx, "partial");
}

export function playChaChing(kind: ChaChingKind = "full"): void {
  const ctx = getContext();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume().catch(() => {});
  loadClip(ctx, kind);
  const clip = clips[kind];
  if (clip) {
    try {
      const source = ctx.createBufferSource();
      source.buffer = clip;
      source.connect(ctx.destination);
      source.start();
      return;
    } catch {
      // Fall through to the synthesized sound.
    }
  }
  try {
    const t = ctx.currentTime;

    // "cha": 70ms of noise through a high-pass, dying away fast.
    const length = Math.floor(ctx.sampleRate * 0.07);
    const noise = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    }
    const source = ctx.createBufferSource();
    source.buffer = noise;
    const highpass = ctx.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.value = 2200;
    const chaGain = ctx.createGain();
    chaGain.gain.setValueAtTime(0.28, t);
    chaGain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    source.connect(highpass).connect(chaGain).connect(ctx.destination);
    source.start(t);

    // "ching": bell partials, struck a beat after the "cha".
    const strike = t + 0.08;
    for (const [frequency, level] of [
      [1760, 0.34],
      [2637, 0.22],
      [3520, 0.12],
      [5274, 0.06],
    ] as const) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = frequency;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, strike);
      gain.gain.exponentialRampToValueAtTime(level, strike + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, strike + 0.85);
      osc.connect(gain).connect(ctx.destination);
      osc.start(strike);
      osc.stop(strike + 0.9);
    }
  } catch {
    // No sound is better than an error in the middle of a payment.
  }
}
