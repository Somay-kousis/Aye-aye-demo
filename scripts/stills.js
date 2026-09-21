import { spawn, execSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { createConnection } from 'node:net';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';
import { readDurations } from '../daemon/tokens.js';

// Captures the six phase-3 stills from a replay run into docs/stills/, driving headless
// Chrome over the DevTools protocol (no extra dependency: `ws` plus the Chrome binary).
// Timing comes from the WebSocket frames the page itself receives, so a still is taken a
// fixed settle after the event that should have produced it. At every still the page is
// asked to check its own geometry: nothing outside the pane, no edge through a card or a
// visible caption.
//
//   node scripts/stills.js          replay run → docs/stills/*.png + state.json
//   node scripts/stills.js --live   watch run with the two sed edits → tmp dir, then a diff
//                                   of events and per-still state against docs/stills/state.json

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const live = process.argv.includes('--live');
const OUT = live ? join(process.env.CLAUDE_JOB_DIR ? join(process.env.CLAUDE_JOB_DIR, 'tmp') : tmpdir(), 'stills-live') : join(ROOT, 'docs', 'stills');
const PROFILE = join(process.env.CLAUDE_JOB_DIR ? join(process.env.CLAUDE_JOB_DIR, 'tmp') : tmpdir(), 'stills-chrome-profile');
const CDP_PORT = 9333;
const d = readDurations(join(ROOT, 'ui', 'tokens.css'));
const SETTLE_NODE = d['d-edge'] + d['d-fast'] + 60;   // edge drawn, card lit
const SETTLE_RESOLVE = d['d-fast'] + 260;             // caption faded in

// [file, event that produces the state, settle ms]
const STILLS = [
  ['02-mid-traversal', (e) => e.type === 'node' && e.id === 'parse', SETTLE_NODE],
  ['03-risk-green',    (e) => e.type === 'resolve' && e.id === 'risk' && e.state === 'pass', SETTLE_RESOLVE],
  ['04-dependents',    (e) => e.type === 'dependent' && e.index === 3, SETTLE_NODE],
  ['05-risk-amber',    (e) => e.type === 'resolve' && e.id === 'risk' && e.state === 'pending', SETTLE_RESOLVE],
  ['06-gate-caption',  (e) => e.type === 'resolve' && e.id === 'gate', SETTLE_RESOLVE],
];

mkdirSync(OUT, { recursive: true });
rmSync(PROFILE, { recursive: true, force: true });

if (live) execSync('npm run -s reset-sample', { cwd: ROOT, stdio: 'inherit' });
const daemon = spawn('node', ['daemon/index.js', ...(live ? [] : ['--replay'])], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
daemon.stdout.on('data', (b) => process.stdout.write(`  daemon │ ${b}`));
daemon.stderr.on('data', (b) => process.stderr.write(`  daemon │ ${b}`));
const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${PROFILE}`,
  '--window-size=1920,1080', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
  '--disable-gpu', 'about:blank',
], { stdio: 'ignore' });

const cleanup = () => {
  daemon.kill();
  chrome.kill();
  if (live) execSync('npm run -s reset-sample', { cwd: ROOT, stdio: 'inherit' });
};
process.on('exit', cleanup);
process.on('SIGINT', () => process.exit(130));

try {
  await waitForPort(4317);
  const cdp = await connectChrome();
  const events = [];
  const waiters = [];
  cdp.on('Network.webSocketFrameReceived', ({ response }) => {
    let e;
    try { e = JSON.parse(response.payloadData); } catch { return; }
    events.push(e);
    for (const w of [...waiters]) if (w.pred(e)) { waiters.splice(waiters.indexOf(w), 1); w.resolve(e); }
  });
  const waitFor = (pred) => new Promise((resolve) => waiters.push({ pred, resolve }));

  await cdp.send('Page.navigate', { url: 'http://localhost:4316/' });
  await waitFor((e) => e.type === 'hello');
  await cdp.send('Runtime.evaluate', { expression: 'document.fonts.ready.then(() => new Promise(r => requestAnimationFrame(r)))', awaitPromise: true });
  await sleep(d['d-base'] + d['d-fast']);

  const states = {};
  const problems = [];
  states['01-rest'] = await still(cdp, '01-rest', problems);

  if (live) {
    sed('s/click here/tap here/', 'sample-repo/services/notifications/templates.py');
    waitFor((e) => e.type === 'skip').then(() => sleep(4000)).then(() =>
      sed('s/timedelta(minutes=30)/timedelta(days=7)/', 'sample-repo/services/auth/session.py'));
  } else {
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: ' ', code: 'Space', text: ' ' });
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: ' ', code: 'Space' });
  }

  for (const [name, pred, settle] of STILLS) {
    await waitFor(pred);
    await sleep(settle);
    states[name] = await still(cdp, name, problems);
  }
  await waitFor((e) => e.type === 'node' && e.id === 'human');

  const strip = ({ t, ...rest }) => rest;
  const record = { events: events.filter((e) => e.type !== 'hello').map(strip), states };
  writeFileSync(join(OUT, 'state.json'), JSON.stringify(record, null, 2) + '\n');
  console.log(`\n${Object.keys(states).length} stills → ${OUT}`);

  if (problems.length) {
    console.error(`\ngeometry problems (${problems.length}):\n  ${problems.join('\n  ')}`);
    process.exitCode = 1;
  } else {
    console.log('geometry ok · nothing outside the pane, no edge through a card or caption');
  }

  if (live) {
    const ref = join(ROOT, 'docs', 'stills', 'state.json');
    if (!existsSync(ref)) { console.error('no replay state.json to compare against; run without --live first'); process.exitCode = 1; }
    else compare(JSON.parse(readFileSync(ref, 'utf8')), record);
  }
} catch (err) {
  console.error(err);
  process.exitCode = 1;
}
process.exit();

async function still(cdp, name, problems) {
  const { result } = await cdp.send('Runtime.evaluate', { expression: `(${geometryCheck})()`, returnByValue: true });
  for (const p of result.value.problems) problems.push(`${name}: ${p}`);
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(OUT, `${name}.png`), Buffer.from(data, 'base64'));
  console.log(`  still ${name}${result.value.problems.length ? `  ✗ ${result.value.problems.length} problems` : ''}`);
  return result.value.snapshot;
}

// Runs inside the page. Coordinates are authored stage px (the stage transform is undone).
function geometryCheck() {
  const stage = document.getElementById('stage').getBoundingClientRect();
  const style = getComputedStyle(document.documentElement);
  const scale = stage.width / parseFloat(style.getPropertyValue('--stage-w'));
  const paneW = parseFloat(style.getPropertyValue('--pane-left'));
  const paneH = parseFloat(style.getPropertyValue('--stage-h'));
  const box = (el) => {
    const r = el.getBoundingClientRect();
    return { x: (r.left - stage.left) / scale, y: (r.top - stage.top) / scale, r: (r.right - stage.left) / scale, b: (r.bottom - stage.top) / scale };
  };
  const problems = [];
  const cards = [...document.querySelectorAll('.node')].map((el) => ({ id: el.dataset.id, ...box(el) }));
  const captions = [...document.querySelectorAll('.readout.shown')].map((el) => ({ id: `caption:${el.dataset.for}`, ...box(el) }));
  const slots = [...document.querySelectorAll('.dependent.shown')].map((el) => ({ id: `slot:${el.dataset.slot}`, ...box(el) }));
  for (const o of [...cards, ...captions, ...slots]) {
    if (o.x < 0 || o.y < 0 || o.r > paneW || o.b > paneH) problems.push(`${o.id} outside the pane (${Math.round(o.x)},${Math.round(o.y)})–(${Math.round(o.r)},${Math.round(o.b)})`);
  }
  const eps = 0.5;
  const obstacles = [...cards, ...captions, ...slots];
  const paths = [
    ...[...document.querySelectorAll('.edge:not(.dep-edge) .base')].map((p) => [p.closest('.edge').dataset.edge, p]),
    ...[...document.querySelectorAll('.dep-edge .fire')].map((p) => [p.closest('.edge').dataset.edge, p]),
  ];
  for (const [name, path] of paths) {
    const len = path.getTotalLength();
    const hit = new Set();
    for (let s = 0; s <= len; s += 1) {
      const p = path.getPointAtLength(s);
      for (const o of obstacles) {
        if (p.x > o.x + eps && p.x < o.r - eps && p.y > o.y + eps && p.y < o.b - eps) hit.add(o.id);
      }
    }
    for (const id of hit) problems.push(`edge ${name} crosses ${id}`);
  }
  return { problems, snapshot: window.__graph.snapshot() };
}

function compare(ref, run) {
  let diffs = 0;
  const a = ref.events, b = run.events;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const x = JSON.stringify(a[i]), y = JSON.stringify(b[i]);
    if (x !== y) { diffs++; if (diffs <= 5) console.log(`  event ${i} differs\n    replay ${x}\n    live   ${y}`); }
  }
  for (const name of Object.keys(ref.states)) {
    const x = JSON.stringify(ref.states[name]), y = JSON.stringify(run.states[name]);
    if (x !== y) { diffs++; console.log(`  state at ${name} differs\n    replay ${x}\n    live   ${y}`); }
  }
  if (diffs) { console.log(`\nlive vs replay: ${diffs} differences`); process.exitCode = 1; }
  else console.log(`\nlive vs replay: identical (${b.length} events, ${Object.keys(run.states).length} stills)`);
}

function sed(expr, file) {
  console.log(`  sed ${file}`);
  execSync(`sed -i '' '${expr}' ${file}`, { cwd: ROOT });
}

async function connectChrome() {
  let info;
  for (let i = 0; i < 100 && !info; i++) {
    try { info = await (await fetch(`http://localhost:${CDP_PORT}/json/version`)).json(); } catch { await sleep(100); }
  }
  if (!info) throw new Error('chrome did not open its debugging port');
  const ws = new WebSocket(info.webSocketDebuggerUrl);
  await new Promise((r) => ws.on('open', r));
  let id = 0;
  const pending = new Map();
  const listeners = new Map();
  ws.on('message', (raw) => {
    const msg = JSON.parse(raw);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    } else if (msg.method) {
      for (const fn of listeners.get(msg.method) ?? []) fn(msg.params);
    }
  });
  const raw = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    ws.send(JSON.stringify({ id: ++id, method, params, sessionId }));
    pending.set(id, { resolve, reject });
  });
  const { targetId } = await raw('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await raw('Target.attachToTarget', { targetId, flatten: true });
  const cdp = {
    send: (method, params) => raw(method, params, sessionId),
    on: (method, fn) => listeners.set(method, [...(listeners.get(method) ?? []), fn]),
  };
  await cdp.send('Page.enable');
  await cdp.send('Network.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  return cdp;
}

function waitForPort(port) {
  return new Promise((resolve, reject) => {
    let tries = 0;
    const tick = () => {
      const s = createConnection(port, 'localhost');
      s.once('connect', () => { s.destroy(); resolve(); });
      s.once('error', () => { s.destroy(); if (++tries > 100) reject(new Error(`:${port} never opened`)); else setTimeout(tick, 100); });
    };
    tick();
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
