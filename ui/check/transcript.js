import { createSpectrum } from './spectrum.js';
import { reveal } from './tokens.js';

// The answer region: the live transcript in --text-dim, locking to --text, with the listener
// (a radial spectrum in the pane's lower third) alive from the question to the lock.
// Locking submits the answer and nothing else does. Silence is measured two ways at once:
// the clock restarts on every recognition result, and it only counts down while the mic's
// RMS is under the threshold, so a recogniser pause mid-sentence does not lock the take.
// Space locks immediately. On lock the spectrum contracts into the transcript as the text
// goes from dim to full, over --d-lock. The text region is capped and clips from the top.
const SILENCE_RMS = 0.015;

export function createTranscript(region, { t, pane, speech, send, log = (...a) => console.log('[transcript]', ...a) }) {
  const clip = document.createElement('div');
  clip.className = 'transcript-clip';
  const text = document.createElement('div');
  text.className = 'transcript';
  clip.appendChild(text);
  region.append(clip);
  let spectrum = null;
  let perfSeen = { max: 0, avg: 0, frames: 0 };

  let attempt = 0;
  let listening = false;
  let locked = false;
  let current = '';
  let quietSince = 0;
  let recognition = null;

  // Called on `question`: the mic and listener go live while Aye-aye speaks; recognition waits
  // for the utterance to end so the take never transcribes its own voice.
  function begin(n, speaking) {
    attempt = n;
    locked = false;
    listening = false;
    current = '';
    text.textContent = '';
    text.classList.remove('locked', 'shown');
    mount();
    if (speech.stream) spectrum.attach(speech.stream, tick);
    speaking.then(() => {
      if (attempt !== n || locked) return;
      listening = true;
      quietSince = 0;
      recognition = speech.listen({ onResult: (s) => onResult(n, s) });
    });
  }

  function onResult(n, s) {
    if (attempt !== n || locked) return;
    current = s;
    text.textContent = s;
    if (!text.classList.contains('shown')) reveal(text);
    quietSince = performance.now();
  }

  function tick(rms) {
    if (!listening || locked || !current) return;
    const now = performance.now();
    if (rms >= SILENCE_RMS) quietSince = now;
    if (now - quietSince >= t.dSilence) lock('silence');
  }

  function lock(how) {
    if (locked) return;
    if (!listening && how === 'space') return; // nothing to submit yet
    locked = true;
    listening = false;
    recognition?.stop();
    recognition = null;
    text.classList.add('locked');
    unmount();
    log(`locked (${how}): ${current}`);
    send({ type: 'answer', transcript: current });
  }

  // The listener lives in the pane's lower third only while a question is live.
  function mount() {
    if (spectrum) return;
    spectrum = createSpectrum(t, t.active);
    pane.appendChild(spectrum.el);
  }

  // Contract into the text over --d-lock, then go.
  function unmount() {
    const s = spectrum;
    if (!s) return;
    spectrum = null;
    s.lock().then(() => { const p = s.perf(); if (p.frames > perfSeen.frames) perfSeen = p; s.el.remove(); });
  }

  // The daemon's `answer` echo. With --auto (or a harness) it is the only transcript there
  // is, so it renders locked; otherwise it confirms what was already sent.
  function onAnswer({ transcript }) {
    if (locked && current) return;
    locked = true;
    listening = false;
    recognition?.stop();
    recognition = null;
    current = transcript;
    text.textContent = transcript;
    text.classList.add('locked');
    reveal(text);
    unmount();
  }

  // Harness only: a result that did not come from the recogniser.
  function feed(s) {
    if (listening) onResult(attempt, s);
  }

  function clear() {
    locked = false;
    listening = false;
    current = '';
    recognition?.stop();
    recognition = null;
    if (spectrum) { spectrum.detach(); spectrum.el.remove(); spectrum = null; }
    text.textContent = '';
    text.classList.remove('locked', 'shown');
  }

  function snapshot() {
    return { text: current || null, locked, listening, listener: spectrum ? (spectrum.live() ? 'listening' : 'silent') : null };
  }

  function perf() {
    return perfSeen;
  }

  return { begin, lock, onAnswer, feed, clear, snapshot, perf };
}
