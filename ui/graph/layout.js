// Turns the node table into pixels. Positions are data: the grid numbers below and the
// col/row on each node. Nothing here is computed from the graph's shape.

// Authored px inside the architecture pane. Tune these to move whole rows or the band.
export const GRID = {
  rowTop: 340,    // top edge of row 0 cards
  rowPitch: 186,  // row 0 top to row 1 top; leaves room for a readout beneath row 0
  bandTop: 740,   // top edge of the dependents band
};

// Dashed dependent edges bow this far from their endpoints.
export const DEPENDENT_CP = 60;

export function readTokens() {
  const style = getComputedStyle(document.documentElement);
  const px = (name) => parseFloat(style.getPropertyValue(name));
  const ms = (name) => parseFloat(style.getPropertyValue(name));
  return {
    nodeW: px('--node-w'),
    gap: px('--gap'),
    pad: px('--pad'),
    port: px('--port'),
    paneLeft: px('--pane-left'),
    stageH: px('--stage-h'),
    hairline: px('--hairline'),
    nudge: px('--nudge'),
    evaluatorW: px('--evaluator-w'),
    dEdge: ms('--d-edge'),
    dHold: ms('--d-hold'),
    dBase: ms('--d-base'),
    dFast: ms('--d-fast'),
  };
}

export function colX(col, t) {
  return t.pad + col * (t.nodeW + t.gap);
}

export function cardRect(node, cardH, t) {
  return {
    x: colX(node.col, t) + (node.dx ?? 0),
    y: GRID.rowTop + node.row * GRID.rowPitch + (node.dy ?? 0),
    w: t.nodeW,
    h: cardH,
  };
}

export function slotRect(slot, t) {
  return { x: colX(slot.col, t), y: GRID.bandTop, w: t.nodeW };
}

// Left and right ports sit at mid-height. Top and bottom ports sit --gap in from the left
// edge so a vertical edge runs clear of the readout beneath the card above it (readouts
// are inset --pad and may be wider than the card).
export function portAt(rect, side, t) {
  switch (side) {
    case 'left':   return { x: rect.x, y: rect.y + rect.h / 2, side };
    case 'right':  return { x: rect.x + rect.w, y: rect.y + rect.h / 2, side };
    case 'top':    return { x: rect.x + t.gap, y: rect.y, side };
    case 'bottom': return { x: rect.x + t.gap, y: rect.y + (rect.h ?? 0), side };
    default: throw new Error(`unknown port side ${side}`);
  }
}

// Which ports an edge uses, from the relative position of its endpoints.
export function sidesFor(edge, from, to) {
  if (edge.route === 'below') return ['bottom', 'bottom'];
  if (edge.route === 'above') return ['top', 'top'];
  if (from.col === to.col) return from.row < to.row ? ['bottom', 'top'] : ['top', 'bottom'];
  return from.col < to.col ? ['right', 'left'] : ['left', 'right'];
}

export function edgePath(edge, a, b) {
  if (edge.route === 'below') {
    const y0 = a.y + edge.lead;
    return `M ${a.x} ${a.y} L ${a.x} ${y0} C ${a.x} ${y0 + edge.cp}, ${b.x} ${b.y + edge.cp}, ${b.x} ${b.y}`;
  }
  if (edge.route === 'above') {
    const y0 = a.y - edge.lead;
    return `M ${a.x} ${a.y} L ${a.x} ${y0} C ${a.x} ${y0 - edge.cp}, ${b.x} ${b.y - edge.cp}, ${b.x} ${b.y}`;
  }
  return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
}

export function dependentPath(a, b) {
  return `M ${a.x} ${a.y} C ${a.x} ${a.y + DEPENDENT_CP}, ${b.x} ${b.y - DEPENDENT_CP}, ${b.x} ${b.y}`;
}

// A --port square centred on the card border.
export function portSquare(p, t) {
  return { x: p.x - t.port / 2, y: p.y - t.port / 2, w: t.port, h: t.port };
}

// Arrowhead pointing into the target card, tip against the outer face of its port square.
// Length three ports, half-width one and a half.
export function arrowPoints(p, t) {
  const len = t.port * 3;
  const half = t.port * 1.5;
  const tip = t.port / 2;
  switch (p.side) {
    case 'left':   return `${p.x - tip},${p.y} ${p.x - tip - len},${p.y - half} ${p.x - tip - len},${p.y + half}`;
    case 'right':  return `${p.x + tip},${p.y} ${p.x + tip + len},${p.y - half} ${p.x + tip + len},${p.y + half}`;
    case 'top':    return `${p.x},${p.y - tip} ${p.x - half},${p.y - tip - len} ${p.x + half},${p.y - tip - len}`;
    case 'bottom': return `${p.x},${p.y + tip} ${p.x - half},${p.y + tip + len} ${p.x + half},${p.y + tip + len}`;
    default: throw new Error(`unknown port side ${p.side}`);
  }
}
