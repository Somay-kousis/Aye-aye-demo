import { inlineCode, reveal } from './tokens.js';

// The question slot. --t-read, --leading-read, the only text with room to breathe. A second
// attempt replaces the text in place; nothing stacks.
export function createQuestion(region) {
  const el = document.createElement('div');
  el.className = 'question';
  region.appendChild(el);

  function render(text) {
    el.classList.remove('shown');
    inlineCode(el, text);
    reveal(el);
  }

  function clear() {
    el.classList.remove('shown');
    el.textContent = '';
  }

  function snapshot() {
    return el.classList.contains('shown') ? el.textContent : null;
  }

  return { render, clear, snapshot };
}
