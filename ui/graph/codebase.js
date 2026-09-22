import { colX, GRID } from './layout.js';

// STAGED. The codebase layer: ~180 file nodes and their import edges as a substrate beneath
// the control plane, drawn on one canvas. Every dot but four is invented and unlabelled;
// the four real ones (the changed file and its three dependents) are pinned by path so the
// dependents visibly rise out of the same neighbourhood every take. Layout is seeded, so it
// is identical on every run. Nothing here computes anything; nothing moves unless an event
// arrives, and the canvas is static between events.

const SEED = 20260920;
const SUBSTRATE = 150;   // nodes below the control plane
const SKY = 30;          // a thin scatter above it, so the parse ripple crosses the pane
const FOCUS_CAP = 15;    // neighbourhood size around the changed file
const RIPPLE_BAND = 160; // px width of the activation front; it trails twice as far as it leads
const TRAVEL_LIFT = 12;  // px the travelled dot sits above its slot port

// Real files, pinned inside the auth cluster beneath the band. Slots 1–3 sit at columns
// 0–2 of the band, so the dependents rise a short way, left to right.
const PINNED = {
  'services/auth/session.py':        { x: 270, y: 960 },
  'services/auth/refresh.py':        { x: 90,  y: 885 },
  'services/admin/console.py':       { x: 262, y: 905 },
  'infra/cache/session_cache.py':    { x: 432, y: 872 },
};
const CHANGED = 'services/auth/session.py';

// Cluster centres: six in the substrate, two in the sky. Authored, not computed.
const CLUSTERS = [
  { x: 270,  y: 930,  r: 150, sky: false },   // auth (the pinned four live here)
  { x: 560,  y: 980,  r: 120, sky: false },
  { x: 790,  y: 920,  r: 130, sky: false },
  { x: 1010, y: 990,  r: 110, sky: false },
  { x: 130,  y: 1030, r: 90,  sky: false },
  { x: 880,  y: 1040, r: 90,  sky: false },
  { x: 300,  y: 150,  r: 170, sky: true },
  { x: 1000, y: 140,  r: 160, sky: true },
];

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildLayout() {
  const rnd = mulberry32(SEED);
  const nodes = [];
  const byPath = new Map();
  for (const [path, p] of Object.entries(PINNED)) {
    byPath.set(path, nodes.length);
    nodes.push({ x: p.x, y: p.y, cluster: 0, path });
  }
  const sub = CLUSTERS.filter((c) => !c.sky);
  const sky = CLUSTERS.filter((c) => c.sky);
  const place = (c) => {
    const a = rnd() * Math.PI * 2;
    const d = Math.sqrt(rnd()) * c.r;
    return { x: Math.round(c.x + Math.cos(a) * d), y: Math.round(c.y + Math.sin(a) * d * 0.55), cluster: CLUSTERS.indexOf(c) };
  };
  while (nodes.length < SUBSTRATE) {
    const p = place(sub[Math.floor(rnd() * sub.length)]);
    if (p.y < 812 || p.y > 1070 || p.x < 20 || p.x > 1160) continue;
    nodes.push(p);
  }
  while (nodes.length < SUBSTRATE + SKY) {
    const p = place(sky[Math.floor(rnd() * sky.length)]);
    if (p.y < 28 || p.y > 300 || p.x < 20 || p.x > 1160) continue;
    nodes.push(p);
  }
  const edges = [];
  const seen = new Set();
  const link = (a, b, w) => {
    const key = a < b ? `${a}:${b}` : `${b}:${a}`;
    if (a === b || seen.has(key)) return;
    seen.add(key);
    edges.push({ a, b, w });
  };
  // the three real import edges carry their real weights (daemon/blastRadius.js)
  link(byPath.get(CHANGED), byPath.get('services/auth/refresh.py'), 3);
  link(byPath.get(CHANGED), byPath.get('services/admin/console.py'), 2);
  link(byPath.get(CHANGED), byPath.get('infra/cache/session_cache.py'), 1);
  for (let i = 0; i < nodes.length; i++) {
    const k = 2 + (rnd() < 0.5 ? 1 : 0);
    for (let j = 0; j < k; j++) {
      const sky = CLUSTERS[nodes[i].cluster].sky;
      const same = sky || rnd() < 0.85;   // the sky's two clusters never link: no long lines across the top
      let t = -1;
      for (let tries = 0; tries < 40 && t < 0; tries++) {
        const c = Math.floor(rnd() * nodes.length);
        if (c === i) continue;
        if (CLUSTERS[nodes[c].cluster].sky !== sky) continue;   // never across the card belt
        if (same && nodes[c].cluster !== nodes[i].cluster) continue;
        t = c;
      }
      if (t < 0) continue;
      const r = rnd();
      link(i, t, r < 0.7 ? 1 : r < 0.92 ? 2 : 3);
    }
  }
  return { nodes, edges, byPath };
}

export function createCodebase(container, t) {
  const { nodes, edges, byPath } = buildLayout();
  const style = getComputedStyle(document.documentElement);
  const colour = { dim: style.getPropertyValue('--text-dim').trim(), active: style.getPropertyValue('--active').trim() };
  const alpha = {
    dot: parseFloat(style.getPropertyValue('--codebase-dot')),
    edge: parseFloat(style.getPropertyValue('--codebase-edge')),
    focus: parseFloat(style.getPropertyValue('--codebase-focus')),
  };
  const font = `${style.getPropertyValue('--t-micro').trim()} ${style.getPropertyValue('--mono').trim()}`;
  const W = t.paneLeft;
  const H = t.stageH;
  const dpr = window.devicePixelRatio || 1;

  const canvas = document.createElement('canvas');
  canvas.className = 'codebase';
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = `${W}px`;
  canvas.style.height = `${H}px`;
  container.prepend(canvas);
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  // neighbourhood of the changed file: BFS to depth 2, capped
  const adj = nodes.map(() => []);
  for (const [i, e] of edges.entries()) { adj[e.a].push([e.b, i]); adj[e.b].push([e.a, i]); }
  const focusNodes = new Set([byPath.get(CHANGED)]);
  let frontier = [byPath.get(CHANGED)];
  for (let depth = 0; depth < 2 && focusNodes.size < FOCUS_CAP; depth++) {
    const next = [];
    for (const n of frontier) for (const [m] of adj[n]) {
      if (focusNodes.size >= FOCUS_CAP) break;
      if (!focusNodes.has(m)) { focusNodes.add(m); next.push(m); }
    }
    frontier = next;
  }
  const focusEdges = new Set(edges.map((e, i) => (focusNodes.has(e.a) && focusNodes.has(e.b) ? i : -1)).filter((i) => i >= 0));

  // animation state; all of it is zero at rest
  const state = {
    ripple: null,            // { origin, start } while the front is crossing
    focus: 0,                // 0..1, eased in on `node graph`
    travel: new Map(),       // node index -> { from, to, start, done, weight, label }
    fade: null,              // { start } while a reset fades everything back
    lit: 1,                  // multiplier applied to focus/travel while fading out
  };
  let raf = 0;
  let maxFrameMs = 0;
  let sumFrameMs = 0;
  let frames = 0;
  let rippled = false;
  const rippleMs = t.dHold + t.dEdge;   // the front crosses the pane while parse holds
  const maxDist = Math.hypot(W, H);

  // where a travelling copy is right now; the original dot never moves
  function travelPos(tr, now) {
    const k = tr.done ? 1 : ease(Math.min(1, (now - tr.start) / t.dEdge));
    return { x: tr.from.x + (tr.to.x - tr.from.x) * k, y: tr.from.y + (tr.to.y - tr.from.y) * k, k };
  }

  function draw(now) {
    const t0 = performance.now();
    ctx.clearRect(0, 0, W, H);
    const front = state.ripple ? ((now - state.ripple.start) / rippleMs) * (maxDist + RIPPLE_BAND * 2) : -1;
    const boostAt = (x, y) => {
      if (!state.ripple) return 0;
      const d = Math.hypot(x - state.ripple.origin.x, y - state.ripple.origin.y) - front;
      const band = d > 0 ? RIPPLE_BAND : RIPPLE_BAND * 2;
      return Math.exp(-(d * d) / (band * band));
    };
    const lit = state.lit;

    ctx.lineCap = 'round';
    for (const [i, e] of edges.entries()) {
      const a = nodes[e.a];
      const b = nodes[e.b];
      const focus = (focusEdges.has(i) ? state.focus : 0) * lit;
      const boost = Math.max(boostAt(a.x, a.y), boostAt(b.x, b.y));
      ctx.lineWidth = focus > 0 ? width(e.w) : t.hairline;
      ctx.strokeStyle = colour.dim;
      ctx.globalAlpha = alpha.edge + (alpha.focus - alpha.edge) * focus;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      if (boost > 0.02) {
        ctx.strokeStyle = colour.active;
        ctx.globalAlpha = boost * alpha.edge * 4;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
    }
    for (let i = 0; i < nodes.length; i++) {
      const p = nodes[i];
      const focus = (focusNodes.has(i) ? state.focus : 0) * lit;
      const boost = boostAt(p.x, p.y);
      ctx.fillStyle = colour.dim;
      ctx.globalAlpha = alpha.dot + (1 - alpha.dot) * focus;
      ctx.beginPath(); ctx.arc(p.x, p.y, t.port / 2 + (focus > 0 ? 0.5 : 0), 0, Math.PI * 2); ctx.fill();
      if (boost > 0.02) {
        ctx.fillStyle = colour.active;
        ctx.globalAlpha = boost * 0.8;
        ctx.beginPath(); ctx.arc(p.x, p.y, t.port / 2 + 0.5, 0, Math.PI * 2); ctx.fill();
      }
    }
    // the travelling copies: a dot rising to its slot, its real import edge to the changed
    // file stretching with it at the edge's weight, and the weight label once it lands
    const changed = nodes[byPath.get(CHANGED)];
    ctx.font = font;
    ctx.textBaseline = 'middle';
    for (const tr of state.travel.values()) {
      const p = travelPos(tr, now);
      ctx.strokeStyle = colour.active;
      ctx.lineWidth = width(tr.weight);
      ctx.globalAlpha = lit * alpha.focus;
      ctx.beginPath(); ctx.moveTo(changed.x, changed.y); ctx.lineTo(p.x, p.y); ctx.stroke();
      ctx.fillStyle = colour.active;
      ctx.globalAlpha = lit;
      ctx.beginPath(); ctx.arc(p.x, p.y, t.port / 2 + 0.5, 0, Math.PI * 2); ctx.fill();
      if (tr.done) {
        ctx.globalAlpha = lit;
        ctx.fillText(`w ${tr.weight}`, (p.x + changed.x) / 2 + t.gap, (p.y + changed.y) / 2);
      }
    }
    ctx.globalAlpha = 1;
    const cost = performance.now() - t0;
    maxFrameMs = Math.max(maxFrameMs, cost);
    sumFrameMs += cost;
    frames++;
  }

  function ease(k) { return 1 - Math.pow(1 - k, 3); }

  // weight 1, 2, 3 -> 1, 1.5, 2 hairlines: legible as a difference, never heavier than flow
  function width(w) { return t.hairline * (1 + (Math.min(w, 3) - 1) * 0.5); }

  // one rAF loop, alive only while something is in flight
  function tick(now) {
    let busy = false;
    if (state.ripple) {
      if (now - state.ripple.start > rippleMs * 1.15) state.ripple = null; else busy = true;
    }
    if (state.focusStart) {
      state.focus = ease(Math.min(1, (now - state.focusStart) / t.dBase));
      if (state.focus < 1) busy = true; else state.focusStart = 0;
    }
    for (const tr of state.travel.values()) {
      if (!tr.done) { if (now - tr.start >= t.dEdge) tr.done = true; else busy = true; }
    }
    if (state.fade) {
      const k = Math.min(1, (now - state.fade.start) / t.dBase);
      state.lit = 1 - k;
      if (k < 1) busy = true; else { state.fade = null; clearState(); }
    }
    draw(now);
    raf = busy ? requestAnimationFrame(tick) : 0;
  }

  function run() {
    if (!raf) raf = requestAnimationFrame(tick);
  }

  function clearState() {
    state.focus = 0;
    state.focusStart = 0;
    state.travel.clear();
    state.lit = 1;
    rippled = false;
  }

  function ripple(origin) {
    state.ripple = { origin, start: performance.now() };
    rippled = true;
    run();
  }

  function focus() {
    state.focusStart = performance.now();
    run();
  }

  function travel(index, path, weight) {
    const i = byPath.get(path);
    if (i === undefined) return;
    const to = { x: colX(index - 1, t) + t.gap, y: GRID.bandTop - TRAVEL_LIFT };
    state.travel.set(i, { from: nodes[i], to, start: performance.now(), done: false, weight });
    run();
  }

  function reset() {
    if (!state.focus && !state.travel.size && !state.ripple) return;
    state.ripple = null;
    state.fade = { start: performance.now() };
    run();
  }

  // deterministic: nothing here depends on frame timing
  function snapshot() {
    return {
      rippled,
      focused: state.focus > 0 ? focusNodes.size : 0,
      travelled: [...state.travel.values()].filter((tr) => tr.done).length,
    };
  }

  draw(performance.now());
  return { ripple, focus, travel, reset, snapshot, perf: () => ({ max: +maxFrameMs.toFixed(2), avg: frames ? +(sumFrameMs / frames).toFixed(2) : 0, frames }), nodeCount: nodes.length, edgeCount: edges.length };
}
