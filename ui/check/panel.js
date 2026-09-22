import { readCheckTokens } from './tokens.js';
import { createHeader } from './header.js';
import { createDiff } from './diff.js';
import { createQuestion } from './question.js';
import { createTranscript } from './transcript.js';
import { createConcepts } from './concepts.js';
import { createVerdict } from './verdict.js';

// The right pane. Six stacked regions that each show only when they have content, separated
// by hairline rules. Everything here is a reaction to a daemon event or to Space. A new
// `change` fades the whole pane out over --d-base and clears it; the diff arrives with the
// header, not with the change, so the pane stays empty while the graph traverses.
export function createCheck(container, { speech, send }) {
  const t = readCheckTokens();
  const regions = {};
  for (const name of ['header', 'diff', 'question', 'transcript', 'concepts', 'verdict']) {
    const el = document.createElement('div');
    el.className = 'region';
    el.dataset.region = name;
    container.appendChild(el);
    regions[name] = el;
  }
  const header = createHeader(regions.header, t);
  const diff = createDiff(regions.diff);
  const question = createQuestion(regions.question);
  const transcript = createTranscript(regions.transcript, { t, pane: container.closest('.pane'), speech, send });
  const concepts = createConcepts(regions.concepts);
  const verdict = createVerdict(regions.verdict);

  let pendingDiff = null;
  let clearing = 0;

  function show(name) {
    regions[name].classList.add('shown');
  }

  function clearNow() {
    for (const el of Object.values(regions)) el.classList.remove('shown');
    header.clear();
    diff.clear();
    question.clear();
    transcript.clear();
    concepts.clear();
    verdict.clear();
    container.classList.remove('clearing');
  }

  // Fade over --d-base, then clear. The daemon holds --d-base after `change` before the
  // first node, so nothing new can land while the fade is running.
  function reset() {
    if (!container.querySelector('.region.shown')) { clearNow(); return; }
    container.classList.add('clearing');
    const id = ++clearing;
    setTimeout(() => { if (id === clearing) clearNow(); }, t.dBase);
  }

  function onChange(e) {
    reset();
    pendingDiff = e.stakes === 'risk-bearing' ? e.diff : null;
  }

  function onLines(lines) {
    show('header');
    const after = header.render(lines);
    if (pendingDiff) {
      show('diff');
      diff.render(pendingDiff, after);
    }
  }

  function onQuestion(e) {
    show('question');
    question.render(e.text);
    show('transcript');
    transcript.begin(e.attempt, speech.speak(e.text, e.spoken));
  }

  function onConcept(e) {
    show('concepts');
    concepts.apply(e);
  }

  function onVerdict(e) {
    show('verdict');
    verdict.render(e);
  }

  function applyEvent(event) {
    switch (event.type) {
      case 'change': onChange(event); break;
      case 'reset': reset(); break;
      case 'skip':
      case 'check': onLines(event.lines); break;
      case 'question': onQuestion(event); break;
      case 'answer': transcript.onAnswer(event); break;
      case 'concept': onConcept(event); break;
      case 'verdict': onVerdict(event); break;
      default: break;
    }
  }

  function onKey(key) {
    if (key === ' ') transcript.lock('space');
  }

  // Harness only (scripts/stills.js): stands in for the recogniser when there is no voice.
  function feed(text) {
    transcript.feed(text);
  }

  // Read by scripts/stills.js: what is on the pane, and where its content ends.
  function snapshot() {
    const shown = [...container.querySelectorAll('.region.shown')];
    const last = shown.at(-1);
    const stage = document.getElementById('stage').getBoundingClientRect();
    const scale = stage.width / parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--stage-w'));
    return {
      regions: shown.map((el) => el.dataset.region),
      header: header.snapshot(),
      diff: diff.snapshot(),
      question: question.snapshot(),
      transcript: transcript.snapshot(),
      concepts: concepts.snapshot(),
      verdict: verdict.snapshot(),
      contentBottom: last ? Math.round((last.getBoundingClientRect().bottom - stage.top) / scale) : 0,
    };
  }

  return { applyEvent, onKey, feed, reset, snapshot, perf: () => transcript.perf() };
}
