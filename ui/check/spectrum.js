// The listener: concentric arcs on a square canvas, driven by the mic's frequency data.
// Forty-eight log-spaced bins so speech is not swamped by its lowest octave; each bin is a
// 1px ring whose radius and opacity follow its eased magnitude. A fixed ring at the centre
// never moves, so the motion reads as measurement. Three states: armed and silent (one thin
// circle, drawn once), listening (rAF while the mic stream is attached), and lock (the rings
// contract, drift up and fade into the locked transcript over --d-lock). One colour.
const BINS = 48;
const F_LO = 80;
const F_HI = 8000;
const ATTACK = 0.35;
const RELEASE = 0.12;
const FLOOR = 0.15;      // byte magnitude / 255 below which a bin is silent
const CEIL = 0.75;       // ... and above which it is full
const LIFT = 40;         // px the drawing rises during lock; a drawing, not a layout move

export function createSpectrum(t, colour) {
  const size = t.spectrum;
  const dpr = window.devicePixelRatio || 1;
  const canvas = document.createElement('canvas');
  canvas.className = 'spectrum';
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  const cx = size / 2;
  const cy = size / 2;
  const r0 = Math.round(size * 0.07);
  const R = size / 2 - t.gap;

  let ctxAudio = null;
  let analyser = null;
  let source = null;
  let raf = 0;
  let rms = 0;
  let onTick = null;
  let locking = null;    // { start, resolve }
  let maxFrameMs = 0;
  let sumFrameMs = 0;
  let frames = 0;
  const levels = new Float32Array(BINS);
  const targets = new Float32Array(BINS);
  let time = null;
  let freq = null;
  let edges = null;      // bin index ranges per ring

  function binEdges(sampleRate, fftSize) {
    const hz = sampleRate / fftSize;
    const out = [];
    for (let k = 0; k <= BINS; k++) out.push(Math.max(1, Math.round((F_LO * Math.pow(F_HI / F_LO, k / BINS)) / hz)));
    return out;
  }

  function attach(stream, tick) {
    detach();
    onTick = tick;
    ctxAudio = ctxAudio ?? new AudioContext();
    if (ctxAudio.state === 'suspended') ctxAudio.resume();
    analyser = ctxAudio.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.8;
    time = new Uint8Array(analyser.fftSize);
    freq = new Uint8Array(analyser.frequencyBinCount);
    edges = binEdges(ctxAudio.sampleRate, analyser.fftSize);
    source = ctxAudio.createMediaStreamSource(stream);
    source.connect(analyser);
    canvas.classList.add('live');
    raf = requestAnimationFrame(frame);
  }

  function measure() {
    analyser.getByteTimeDomainData(time);
    let sum = 0;
    for (const v of time) { const d = (v - 128) / 128; sum += d * d; }
    rms = Math.sqrt(sum / time.length);
    analyser.getByteFrequencyData(freq);
    for (let i = 0; i < BINS; i++) {
      const lo = edges[i];
      const hi = Math.max(lo + 1, edges[i + 1]);
      let acc = 0;
      for (let j = lo; j < hi && j < freq.length; j++) acc += freq[j];
      const mag = acc / (hi - lo) / 255;
      targets[i] = Math.min(1, Math.max(0, (mag - FLOOR) / (CEIL - FLOOR)));
    }
  }

  function frame(now) {
    const t0 = performance.now();
    let k = 0;
    if (locking) {
      k = Math.min(1, (now - locking.start) / t.dLock);
    } else {
      measure();
      for (let i = 0; i < BINS; i++) {
        const d = targets[i] - levels[i];
        levels[i] += d * (d > 0 ? ATTACK : RELEASE);
      }
    }
    draw(k);
    const cost = performance.now() - t0;
    maxFrameMs = Math.max(maxFrameMs, cost);
    sumFrameMs += cost;
    frames++;
    if (locking && k >= 1) {
      const { resolve } = locking;
      locking = null;
      detach();
      resolve();
      return;
    }
    onTick?.(rms);
    raf = requestAnimationFrame(frame);
  }

  // smoothstep: half the contraction at half the time, so the mid-frame still reads as rings
  function ease(k) { return k * k * (3 - 2 * k); }

  // lockK is 0 while listening. During the lock the radii contract and the drawing rises on
  // a smoothstep while the opacity falls linearly.
  function draw(lockK = 0) {
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.translate(0, -LIFT * ease(lockK));
    const fade = 1 - lockK;
    const contract = 1 - ease(lockK);
    ctx.strokeStyle = colour;
    ctx.lineWidth = t.hairline;
    // the anchor
    ctx.globalAlpha = fade;
    ctx.beginPath(); ctx.arc(cx, cy, r0 * (0.4 + 0.6 * contract), 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < BINS; i++) {
      const level = levels[i];
      if (level < 0.01) continue;
      const r = r0 + ((i + 1) / BINS) * (R - r0) * level * contract;
      ctx.globalAlpha = fade * (0.05 + 0.65 * level);
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }

  // resolves when the contraction has finished; the caller removes the canvas
  function lock() {
    if (!raf) { detach(); return Promise.resolve(); }
    return new Promise((resolve) => { locking = { start: performance.now(), resolve }; });
  }

  function detach() {
    cancelAnimationFrame(raf);
    raf = 0;
    onTick = null;
    source?.disconnect();
    source = null;
    analyser = null;
    rms = 0;
    levels.fill(0);
    canvas.classList.remove('live');
  }

  draw(0);
  return { el: canvas, attach, detach, lock, rms: () => rms, live: () => Boolean(raf), perf: () => ({ max: +maxFrameMs.toFixed(2), avg: frames ? +(sumFrameMs / frames).toFixed(2) : 0, frames }) };
}
