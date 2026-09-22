import { reveal } from './tokens.js';

// The real diff: removed lines then added lines, --mono --t-small, tinted. No line numbers,
// no path (the header carries it), nothing the daemon did not send.
export function createDiff(region) {
  function render({ removed, added }, delay = 0) {
    region.textContent = '';
    for (const [kind, lines] of [['removed', removed], ['added', added]]) {
      for (const line of lines) {
        const el = document.createElement('div');
        el.className = `diff-row ${kind}`;
        el.textContent = `${kind === 'removed' ? '-' : '+'} ${line}`;
        el.style.transitionDelay = `${delay}ms`;
        region.appendChild(el);
      }
    }
    for (const el of region.children) reveal(el);
  }

  function clear() {
    region.textContent = '';
  }

  function snapshot() {
    return [...region.children].map((el) => el.textContent);
  }

  return { render, clear, snapshot };
}
