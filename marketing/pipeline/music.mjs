/**
 * Generates the music bed as a WAV: a warm pad on a four-chord loop with one
 * soft bell per bar. Placeholder for a licensed track, but a real one — it sets
 * the pacing the edit is cut to.
 */
import { writeFileSync } from "node:fs";

const RATE = 44100;

const CHORDS = [
  [130.81, 196.0, 261.63],   // C
  [123.47, 185.0, 246.94],   // B-ish
  [110.0, 164.81, 220.0],    // A minor
  [146.83, 220.0, 293.66],   // D
];
const BELLS = [523.25, 659.25, 783.99, 987.77];
const BAR = 7.2;

function env(t, dur, attack, release) {
  if (t < attack) return t / attack;
  if (t > dur - release) return Math.max(0, (dur - t) / release);
  return 1;
}

export function renderMusic(seconds, outPath, peak = 0.26) {
  const n = Math.ceil(seconds * RATE);
  const L = new Float64Array(n);
  const R = new Float64Array(n);

  const bars = Math.ceil(seconds / BAR);
  for (let b = 0; b < bars; b += 1) {
    const t0 = b * BAR;
    const notes = CHORDS[b % CHORDS.length];

    notes.forEach((f, vi) => {
      const amp = 0.3 / (vi + 1.3);
      const detune = (vi - 1) * 0.4;
      for (let i = 0; i < BAR * RATE; i += 1) {
        const idx = Math.floor(t0 * RATE) + i;
        if (idx >= n) break;
        const t = i / RATE;
        const e = env(t, BAR, 2.2, 3.0) * amp;
        // Two slightly detuned partials give the pad some width.
        const a = Math.sin(2 * Math.PI * (f + detune) * t);
        const c = Math.sin(2 * Math.PI * (f - detune) * t + 0.6) * 0.7;
        const v = (a + c) * e;
        L[idx] += v * (vi === 2 ? 0.85 : 1);
        R[idx] += v * (vi === 0 ? 0.85 : 1);
      }
    });

    // One bell, a beat after the chord lands.
    const bf = BELLS[(b * 3) % BELLS.length];
    const bStart = Math.floor((t0 + 1.2) * RATE);
    const bLen = Math.floor(3.4 * RATE);
    for (let i = 0; i < bLen; i += 1) {
      const idx = bStart + i;
      if (idx >= n) break;
      const t = i / RATE;
      const e = Math.exp(-t * 1.5) * 0.09;
      const v = Math.sin(2 * Math.PI * bf * t) * e
              + Math.sin(2 * Math.PI * bf * 2 * t) * e * 0.18;
      L[idx] += v; R[idx] += v * 0.92;
    }
  }

  // Gentle low-pass so the pad sits under a voice rather than beside it.
  let lpL = 0, lpR = 0;
  const k = 0.16;
  for (let i = 0; i < n; i += 1) {
    lpL += (L[i] - lpL) * k; L[i] = lpL;
    lpR += (R[i] - lpR) * k; R[i] = lpR;
  }

  let max = 0;
  for (let i = 0; i < n; i += 1) max = Math.max(max, Math.abs(L[i]), Math.abs(R[i]));
  const g = max > 0 ? peak / max : 1;

  // Fade the whole bed in and out.
  const fade = 3 * RATE;
  const buf = Buffer.alloc(44 + n * 4);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write("WAVE", 8);
  buf.write("fmt ", 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(2, 22); buf.writeUInt32LE(RATE, 24);
  buf.writeUInt32LE(RATE * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
  buf.write("data", 36); buf.writeUInt32LE(n * 4, 40);

  for (let i = 0; i < n; i += 1) {
    let f = 1;
    if (i < fade) f = i / fade;
    if (i > n - fade) f = Math.max(0, (n - i) / fade);
    const l = Math.max(-1, Math.min(1, L[i] * g * f));
    const r = Math.max(-1, Math.min(1, R[i] * g * f));
    buf.writeInt16LE(Math.round(l * 32767), 44 + i * 4);
    buf.writeInt16LE(Math.round(r * 32767), 44 + i * 4 + 2);
  }

  writeFileSync(outPath, buf);
  return outPath;
}
