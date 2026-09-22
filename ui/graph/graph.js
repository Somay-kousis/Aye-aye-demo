import { NODES } from './nodes.js';
import { EDGES, DEPENDENT_SLOTS } from './edges.js';
import {
  readTokens, cardRect, slotRect, portAt, sidesFor, edgePath, dependentPath,
  portSquare, arrowPoints,
} from './layout.js';
import { createCodebase } from './codebase.js';
import { createEvaluators } from './evaluators.js';
import { createTelemetry } from './telemetry.js';

const SVG = 'http://www.w3.org/2000/svg';
const READOUT_NODES = ['risk', 'gate'];

// Builds the graph once from the tables and applies daemon events to it. Holds the one
// piece of traversal state the UI needs: which node is executing, so an arriving `node`
// event knows which edge just fired.
export function createGraph(container) {
  const t = readTokens();
  const nodes = new Map();
  const edges = new Map();
  const readouts = new Map();
  const slots = [];
  const depEdges = [];
  let current = null;

  // the codebase substrate goes in first so everything else draws over it
  const codebase = createCodebase(container, t);

  // cards first, so their rendered height can place the ports
  for (const node of NODES) {
    const el = document.createElement('div');
    el.className = 'node';
    el.dataset.id = node.id;
    el.dataset.state = 'idle';
    el.innerHTML = `<span class="label"></span><span class="sublabel"></span>`;
    el.querySelector('.label').textContent = node.label;
    el.querySelector('.sublabel').textContent = node.sublabel;
    container.appendChild(el);
    nodes.set(node.id, { ...node, el, rect: null, activatedAt: 0 });
  }
  // Uniform height: a wrapped sublabel must not make one card taller than its neighbours
  // or the mid-height ports drift off the short cards.
  const cardH = Math.max(...[...nodes.values()].map((n) => n.el.offsetHeight));

  for (const n of nodes.values()) {
    n.rect = cardRect(n, cardH, t);
    n.el.style.left = `${n.rect.x}px`;
    n.el.style.top = `${n.rect.y}px`;
    n.el.style.height = `${cardH}px`;
  }

  for (const id of READOUT_NODES) {
    const n = nodes.get(id);
    const el = document.createElement('div');
    el.className = 'readout';
    el.dataset.for = id;
    el.style.left = `${n.rect.x + t.pad}px`;
    el.style.top = `${n.rect.y + n.rect.h}px`;
    container.appendChild(el);
    readouts.set(id, el);
  }

  for (const [i, slot] of DEPENDENT_SLOTS.entries()) {
    const rect = slotRect(slot, t);
    const el = document.createElement('div');
    el.className = 'dependent';
    el.dataset.slot = String(i + 1);
    el.style.left = `${rect.x}px`;
    el.style.top = `${rect.y}px`;
    el.innerHTML = `<span class="dep-label"></span><span class="dep-path"></span>`;
    container.appendChild(el);
    slots.push({ el, rect });
  }

  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('class', 'edges');
  svg.setAttribute('viewBox', `0 0 ${t.paneLeft} ${t.stageH}`);

  for (const edge of EDGES) {
    const from = nodes.get(edge.from);
    const to = nodes.get(edge.to);
    const [sideA, sideB] = sidesFor(edge, from, to);
    const a = portAt(from.rect, sideA, t);
    const b = portAt(to.rect, sideB, t);
    const d = edgePath(edge, a, b);
    const g = el('g', { class: 'edge', 'data-edge': `${edge.from}>${edge.to}` });
    if (edge.route) g.dataset.route = edge.route;
    g.appendChild(el('path', { class: 'base', d }));
    g.appendChild(el('path', { class: 'fire', d, pathLength: '1' }));
    g.appendChild(rect(portSquare(a, t), 'port from'));
    g.appendChild(rect(portSquare(b, t), 'port to'));
    g.appendChild(el('polygon', { class: 'arrow to', points: arrowPoints(b, t) }));
    svg.appendChild(g);
    edges.set(`${edge.from}>${edge.to}`, { ...edge, el: g, fired: false });
  }

  const graphPort = portAt(nodes.get('graph').rect, 'bottom', t);
  for (const [i, slot] of slots.entries()) {
    const b = portAt(slot.rect, 'top', t);
    const d = dependentPath(graphPort, b);
    const maskId = `reveal-${i + 1}`;
    const g = el('g', { class: 'edge dep-edge', 'data-edge': `graph>dependent-${i + 1}` });
    // the mask lives inside the group so `.dep-edge.fired .reveal` can select its path
    const mask = el('mask', { id: maskId, style: 'mask-type: alpha' });
    mask.appendChild(el('path', { class: 'reveal', d, pathLength: '1' }));
    g.appendChild(mask);
    g.appendChild(el('path', { class: 'fire', d, mask: `url(#${maskId})` }));
    g.appendChild(rect(portSquare(graphPort, t), 'port from'));
    g.appendChild(rect(portSquare(b, t), 'port to'));
    svg.appendChild(g);
    depEdges.push({ el: g });
  }
  container.appendChild(svg);

  const evaluators = createEvaluators(container, svg, nodes, cardH, t);
  const telemetry = createTelemetry(container, nodes, t);

  function el(tag, attrs) {
    const node = document.createElementNS(SVG, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    return node;
  }

  function rect(r, cls) {
    return el('rect', { class: cls, x: r.x, y: r.y, width: r.w, height: r.h });
  }

  function afterEdge(node, delayed) {
    node.style.setProperty('--after-edge', delayed ? 'var(--d-edge)' : '0ms');
  }

  function fire(g) {
    // A re-fire (judge → question on the retry) removes and re-adds the drawing state.
    // Both land in the same frame and the browser coalesces them, so no transition would
    // run. Reading offsetWidth between them forces a style flush. Do not "clean up" this.
    g.classList.remove('fired');
    g.classList.add('rearm');
    g.removeAttribute('data-settle');
    void container.offsetWidth;
    g.classList.remove('rearm');
    g.classList.add('fired');
  }

  function settleInto(id, state) {
    for (const e of edges.values()) {
      if (e.to === id && e.el.classList.contains('fired')) e.el.dataset.settle = state;
    }
  }

  function reset() {
    container.classList.add('resetting');
    for (const n of nodes.values()) {
      afterEdge(n.el, false);
      n.el.dataset.state = 'idle';
      delete n.el.dataset.resolved;
    }
    for (const e of edges.values()) {
      e.el.classList.remove('fired');
      e.el.removeAttribute('data-settle');
    }
    for (const g of depEdges) g.el.classList.remove('fired');
    for (const r of readouts.values()) {
      afterEdge(r, false);
      r.classList.remove('shown');
    }
    for (const s of slots) {
      afterEdge(s.el, false);
      s.el.classList.remove('shown');
    }
    codebase.reset();
    evaluators.remove();
    telemetry.clear();
    current = null;
  }

  function onNode(id) {
    const node = nodes.get(id);
    if (!node) return;
    container.classList.remove('resetting');
    const edge = current ? edges.get(`${current}>${id}`) : null;
    if (current) {
      const prev = nodes.get(current);
      afterEdge(prev.el, Boolean(edge));
      prev.el.dataset.state = 'visited';
      if (!prev.el.dataset.resolved) settleInto(current, 'visited');
    }
    afterEdge(node.el, Boolean(edge));
    delete node.el.dataset.resolved; // judge is re-entered on the retry and resolves again
    node.el.dataset.state = 'active';
    node.activatedAt = performance.now() + (edge ? t.dEdge : 0);
    if (edge) fire(edge.el);
    current = id;
    if (id === 'parse') codebase.ripple({ x: node.rect.x + node.rect.w / 2, y: node.rect.y + node.rect.h / 2 });
    if (id === 'graph') codebase.focus();
    if (id === 'question') evaluators.clear();
  }

  function onResolve({ id, state, readout }) {
    const node = nodes.get(id);
    if (!node) return;
    // if the edge into this node is still drawing, resolve when it lands
    const remaining = Math.max(0, node.activatedAt - performance.now());
    node.el.style.setProperty('--after-edge', `${remaining}ms`);
    node.el.dataset.resolved = state;
    settleInto(id, state);
    const caption = readouts.get(id);
    if (caption && readout) {
      caption.style.setProperty('--after-edge', `${remaining}ms`);
      caption.textContent = readout;
      caption.dataset.state = state;
      caption.classList.add('shown');
    }
  }

  function onDependent({ index, path, label, weight }) {
    const slot = slots[index - 1];
    const edge = depEdges[index - 1];
    if (!slot || !edge) return;
    codebase.travel(index, path, weight);
    slot.el.querySelector('.dep-label').textContent = label;
    slot.el.querySelector('.dep-path').textContent = path;
    afterEdge(slot.el, true);
    slot.el.classList.add('shown');
    fire(edge.el);
  }

  function applyEvent(event) {
    switch (event.type) {
      case 'change': reset(); break;
      case 'node': onNode(event.id); break;
      case 'dependent': onDependent(event); break;
      case 'resolve': onResolve(event); break;
      case 'verdict': onResolve({ id: 'judge', state: event.passed ? 'pass' : 'fail' }); break;
      case 'answer': evaluators.spawn(event.concepts ?? []); break;
      case 'concept': evaluators.resolve(event.index, event.result); break;
      case 'telemetry': telemetry.show(event); break;
      case 'reset': reset(); break;
      default: break;
    }
  }

  // Everything the stills harness needs to compare a replay run with a live one.
  function snapshot() {
    return {
      current,
      nodes: Object.fromEntries([...nodes.values()].map((n) => [n.id, { state: n.el.dataset.state, resolved: n.el.dataset.resolved ?? null }])),
      edges: Object.fromEntries([...edges.values()].map((e) => [`${e.from}>${e.to}`, { fired: e.el.classList.contains('fired'), settle: e.el.dataset.settle ?? null }])),
      dependents: depEdges.map((g) => g.el.classList.contains('fired')),
      readouts: Object.fromEntries([...readouts].map(([id, r]) => [id, r.classList.contains('shown') ? { text: r.textContent, state: r.dataset.state } : null])),
      slots: slots.map((s) => (s.el.classList.contains('shown') ? s.el.querySelector('.dep-label').textContent + ' ' + s.el.querySelector('.dep-path').textContent : null)),
      codebase: codebase.snapshot(),
      evaluators: evaluators.snapshot(),
      telemetry: telemetry.snapshot(),
    };
  }

  return { applyEvent, reset, snapshot, perf: () => ({ codebase: codebase.perf() }) };
}
