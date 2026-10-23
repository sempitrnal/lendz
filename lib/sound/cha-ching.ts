/**
 * A cash-register "cha-ching", made with the Web Audio API so there is no
 * sound file to ship: a short filtered-noise "cha" followed by a bright
 * bell "ching".
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

/** Unlocks audio from inside a tap. Safe to call again. */
export function primeAudio(): void {
  const ctx = getContext();
  if (ctx && ctx.state === "suspended") void ctx.resume().catch(() => {});
}

export function playChaChing(): void {
  const ctx = getContext();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume().catch(() => {});
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
