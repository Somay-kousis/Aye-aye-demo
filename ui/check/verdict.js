import { reveal } from './tokens.js';

// The verdict: headline at --t-read with the score in the state colour, the sub line, and
// beneath them the footer. The footer is created once and never touched again; it is a
// property of the system, not a message.
export function createVerdict(region) {
  const headline = document.createElement('div');
  headline.className = 'verdict-headline';
  const words = document.createElement('span');
  const score = document.createElement('span');
  score.className = 'score';
  headline.append(words, score);
  const sub = document.createElement('div');
  sub.className = 'verdict-sub';
  const footer = document.createElement('div');
  footer.className = 'verdict-footer';
  region.append(headline, sub, footer);

  function render({ headline: text, sub: subText, passed, footer: footerText }) {
    const m = text.match(/^(.*?)(\d+ of \d+)$/);
    words.textContent = m ? m[1] : text;
    score.textContent = m ? m[2] : '';
    score.dataset.state = passed ? 'pass' : 'fail';
    sub.textContent = subText ?? '';
    sub.hidden = !subText;
    if (!footer.textContent) footer.textContent = footerText;
    headline.classList.remove('shown');
    sub.classList.remove('shown');
    reveal(headline);
    reveal(sub);
  }

  function clear() {
    words.textContent = '';
    score.textContent = '';
    delete score.dataset.state;
    sub.textContent = '';
    footer.textContent = '';
    headline.classList.remove('shown');
    sub.classList.remove('shown');
  }

  function snapshot() {
    if (!headline.classList.contains('shown')) return null;
    return { headline: headline.textContent, score: score.dataset.state, sub: sub.hidden ? null : sub.textContent, footer: footer.textContent };
  }

  return { render, clear, snapshot };
}
