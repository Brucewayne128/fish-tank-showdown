// Tiny synthesized sound effects, no audio files needed.
let ctx = null;
function tone(freq, dur, type = 'sine', vol = 0.15, slide = 0) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + dur);
}
function noise(dur, vol = 0.12, hp = 800) {
  if (!ctx) return;
  const b = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const s = ctx.createBufferSource(), g = ctx.createGain(), f = ctx.createBiquadFilter();
  f.type = 'highpass'; f.frequency.value = hp; s.buffer = b; g.gain.value = vol;
  s.connect(f).connect(g).connect(ctx.destination); s.start();
}
export const sfx = {
  unlock() { try { ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); ctx.resume(); } catch {} },
  click: () => tone(660, 0.06, 'triangle', 0.08),
  shoot: () => { noise(0.12, 0.1, 1500); tone(300, 0.12, 'square', 0.04, -200); },
  swoosh: () => noise(0.18, 0.12, 400),
  hit: () => tone(220, 0.15, 'sawtooth', 0.08, -120),
  clink: () => tone(1400, 0.08, 'triangle', 0.07),
  chomp: () => { tone(140, 0.08, 'square', 0.1, -60); noise(0.06, 0.08, 300); },
  kill: () => { tone(500, 0.1, 'triangle', 0.1, 400); setTimeout(() => tone(900, 0.15, 'triangle', 0.08), 90); },
  power: () => tone(400, 0.25, 'sine', 0.1, 600),
  ink: () => noise(0.4, 0.1, 200),
  heal: () => tone(880, 0.12, 'sine', 0.05, 200),
  reveal: () => [523, 659, 784].forEach((f, i) => setTimeout(() => tone(f, 0.18, 'triangle', 0.08), i * 110)),
  win: () => [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.2, 'triangle', 0.09), i * 120)),
  lose: () => [392, 330, 262].forEach((f, i) => setTimeout(() => tone(f, 0.25, 'sine', 0.08), i * 160)),
};
