// Depth is the number of concepts the answer must cover. A lookup, not a judgement.
// Mirrors docs/architecture.md. The path rule decides whether the gate is reached at
// all; this only decides depth, so zero dependents at the gate is depth 1, not a skip.

const LADDER = [
  { max: 0, depth: 1 },
  { max: 2, depth: 2 },
  { max: 5, depth: 3 },
  { max: 10, depth: 5 },
  { max: Infinity, depth: 'second reviewer' },
];

export function depthFor(dependents) {
  return LADDER.find((row) => dependents <= row.max).depth;
}

export function gateReadout(dependents) {
  return `blast radius ${dependents} → depth ${depthFor(dependents)}`;
}
