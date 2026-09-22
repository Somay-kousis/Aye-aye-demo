import { createSocket } from './socket.js';
import { createGraph } from './graph/graph.js';
import { createCheck } from './check/panel.js';
import { createSpeech } from './check/speech.js';

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
let check = null;
const speech = createSpeech();
Promise.all([
  document.fonts.load('400 14px "Instrument Sans"'),
  document.fonts.load('500 10px "Instrument Sans"'),
  document.fonts.load('400 12px "IBM Plex Mono"'),
  document.fonts.load('500 12px "IBM Plex Mono"'),
]).then(() => {
  graph = createGraph(document.getElementById('graph'));
  check = createCheck(document.getElementById('check-body'), { speech, send: socket.send });
  window.__graph = graph; // read by scripts/stills.js
  window.__check = check;
});

socket.on('*', (event) => {
  graph?.applyEvent(event);
  check?.applyEvent(event);
});

// Chrome gates TTS and the microphone behind a gesture. The first keydown arms both, and
// only once both have answered does CHECK read CHECK · ARMED. In replay mode Space also
// starts the run, so press any other key first and look for the suffix before Space.
let arming = false;
socket.on('key', ({ key }) => {
  check?.onKey(key);
  if (arming) return;
  arming = true;
  speech.arm().then(({ tts, mic }) => {
    if (tts && mic) document.getElementById('armed').textContent = ' · armed';
    else console.log(`[speech] not armed: tts=${tts} mic=${mic}`);
  });
});
