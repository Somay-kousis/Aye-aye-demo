import { inlineCode, reveal } from './tokens.js';

// Concept rows keyed by index. A row arrives on its own daemon event; a second event for the
// same index updates that row in place (the mark flips, the detail line is replaced, the
// emphasis line goes if the new event has none). Nothing stacks. The emphasis sentence is
// rendered in --text on its own line with no mark, colour or label: it does the work alone.
export function createConcepts(region) {
  const rows = new Map();

  function apply({ index, name, result, line, emphasis }) {
    let row = rows.get(index);
    if (!row) {
      row = build(index);
      rows.set(index, row);
      const after = [...rows.keys()].filter((k) => k < index).length;
      region.insertBefore(row.el, region.children[after] ?? null);
    }
    row.el.dataset.result = result;
    row.mark.textContent = result === 'pass' ? '✓' : '✕';
    row.name.textContent = name;
    row.detail.classList.remove('shown');
    inlineCode(row.detail, line);
    if (emphasis) {
      row.emphasis.textContent = emphasis;
      row.emphasis.hidden = false;
    } else {
      row.emphasis.textContent = '';
      row.emphasis.hidden = true;
    }
    reveal(row.el);
    reveal(row.detail);
    reveal(row.emphasis);
  }

  function build(index) {
    const el = document.createElement('div');
    el.className = 'concept';
    el.dataset.index = String(index);
    const mark = document.createElement('span');
    mark.className = 'mark';
    const body = document.createElement('div');
    body.className = 'concept-body';
    const name = document.createElement('div');
    name.className = 'concept-name';
    const detail = document.createElement('div');
    detail.className = 'detail';
    const emphasis = document.createElement('div');
    emphasis.className = 'emphasis';
    emphasis.hidden = true;
    body.append(name, detail, emphasis);
    el.append(mark, body);
    return { el, mark, name, detail, emphasis };
  }

  function clear() {
    rows.clear();
    region.textContent = '';
  }

  function snapshot() {
    return [...rows.entries()].sort(([a], [b]) => a - b).map(([index, r]) => ({
      index,
      result: r.el.dataset.result,
      name: r.name.textContent,
      line: r.detail.textContent,
      emphasis: r.emphasis.hidden ? null : r.emphasis.textContent,
    }));
  }

  return { apply, clear, snapshot };
}
