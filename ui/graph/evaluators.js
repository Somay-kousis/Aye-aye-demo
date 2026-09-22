import { colX, GRID, portSquare } from './layout.js';

// Judge fan-out. On `answer` one small card per concept appears in the empty cell above
// judge, numbered to match the concept rows on the right, each fed by a stub that draws up
// from judge. Running is the card lit --active and nothing else. On each `concept` event the
// matching card resolves and a return line draws back down to judge: three returns arriving
// one at a time is the picture of concurrent work finishing. Cleared on the retry.
const SVG = 'http://www.w3.org/2000/svg';
const CELL_COL = 4;
const CELL_ROW = 0;
const ARC_CLEARANCE = 24;   // the retry arc's vertical runs at judge's top port; stay right of it

export function createEvaluators(container, svg, nodes, cardH, t) {
  const judge = nodes.get('judge');
  let cards = [];
  let clearing = 0;

  function el(tag, attrs) {
    const node = document.createElementNS(SVG, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    return node;
  }

  function spawn(concepts) {
    remove();
    const x0 = colX(CELL_COL, t) + ARC_CLEARANCE;
    concepts.forEach(({ index }, i) => {
      const card = document.createElement('div');
      card.className = 'evaluator';
      card.dataset.index = String(index);
      card.textContent = String(index).padStart(2, '0');
      container.appendChild(card);
      const x = x0 + i * (t.evaluatorW + t.gap);
      const h = card.offsetHeight;
      const y = GRID.rowTop + CELL_ROW * GRID.rowPitch + cardH - h;   // bottom-aligned with row 0
      card.style.left = `${x}px`;
      card.style.top = `${y}px`;
      const cx = x + t.evaluatorW / 2;
      const a = { x: cx, y: judge.rect.y, side: 'top' };
      const b = { x: cx, y: y + h, side: 'bottom' };
      const d = `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
      const back = `M ${b.x + t.nudge} ${b.y} L ${a.x + t.nudge} ${a.y}`;
      const g = el('g', { class: 'edge eval-edge', 'data-edge': `judge>evaluator-${index}` });
      g.appendChild(el('path', { class: 'base', d }));
      const fire = el('path', { class: 'fire', d, pathLength: '1' });
      fire.style.transitionDelay = `${i * t.dFast}ms`;
      g.appendChild(fire);
      g.appendChild(el('path', { class: 'return', d: back, pathLength: '1' }));
      g.appendChild(rect(portSquare(a, t), 'port from'));
      g.appendChild(rect(portSquare(b, t), 'port to'));
      svg.appendChild(g);
      card.style.setProperty('--after-edge', `${t.dEdge + i * t.dFast}ms`);
      void container.offsetWidth;
      g.classList.add('fired');
      card.dataset.state = 'active';
      cards.push({ index, card, g });
    });
  }

  function rect(r, cls) {
    return el('rect', { class: cls, x: r.x, y: r.y, width: r.w, height: r.h });
  }

  function resolve(index, result) {
    const c = cards.find((x) => x.index === index);
    if (!c) return;
    c.card.style.setProperty('--after-edge', '0ms');
    c.card.dataset.resolved = result;
    c.g.dataset.settle = result;
    c.g.classList.add('returned');
  }

  // the retry: fade out over --d-base, then remove
  function clear() {
    if (!cards.length) return;
    const id = ++clearing;
    container.classList.add('evaluators-clearing');
    for (const c of cards) { c.card.classList.add('clearing'); c.g.classList.add('clearing'); }
    setTimeout(() => { if (id === clearing) { remove(); container.classList.remove('evaluators-clearing'); } }, t.dBase);
  }

  function remove() {
    for (const c of cards) { c.card.remove(); c.g.remove(); }
    cards = [];
  }

  function snapshot() {
    return cards.map((c) => ({ index: c.index, state: c.card.dataset.state, resolved: c.card.dataset.resolved ?? null, returned: c.g.classList.contains('returned') }));
  }

  return { spawn, resolve, clear, remove, snapshot, active: () => cards.length > 0 };
}
