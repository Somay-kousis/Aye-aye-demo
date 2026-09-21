import { createSocket } from './socket.js';
import { createGraph } from './graph/graph.js';

const WS_URL = `ws://${location.hostname}:4317`;

const root = document.documentElement;
const stage = document.getElementById('stage');

// Scale the authored stage to the viewport. At 1920×1080 the factor is exactly 1.
function fitStage() {
  const style = getComputedStyle(root);
  const w = parseFloat(style.getPropertyValue('--stage-w'));
  const h = parseFloat(style.getPropertyValue('--stage-h'));
  const scale = Math.min(window.innerWidth / w, window.innerHeight / h);
  root.style.setProperty('--stage-scale', String(scale));
}

fitStage();
window.addEventListener('resize', fitStage);

// The entrance plays once per run. A reconnect brings a second hello; only reset clears
// the flag so the next hello plays it again.
let entered = false;

const socket = createSocket(WS_URL);

socket.on('hello', () => {
  if (entered) return;
  entered = true;
  stage.classList.add('entered');
});

socket.on('reset', () => {
  entered = false;
  stage.classList.remove('entered');
});

// Both faces are resolved before the daemon can show anything, so a take never paints a
// fallback font. Local files only. The graph measures its cards, so it is built only once
// the faces are in.
let graph = null;
Promise.all([
  document.fonts.load('400 14px "Instrument Sans"'),
  document.fonts.load('500 10px "Instrument Sans"'),
  document.fonts.load('400 12px "IBM Plex Mono"'),
  document.fonts.load('500 12px "IBM Plex Mono"'),
]).then(() => {
  graph = createGraph(document.getElementById('graph'));
  window.__graph = graph; // read by scripts/stills.js
});

socket.on('*', (event) => graph?.applyEvent(event));
