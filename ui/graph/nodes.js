// The node table. Labels and sublabels are verbatim from docs/architecture.md; columns are
// fixed there too. Rows are the snake that keeps every traversal step either a horizontal
// stub or a vertical drop (gutters are only --gap wide, so nothing can curve between
// columns). Move a node by editing its col/row; nudge it by a few pixels with dx/dy.

export const NODES = [
  { id: 'session',  label: 'Session capture',         sublabel: 'instruction + reasoning',     col: 0, row: 1 },
  { id: 'intake',   label: 'Change intake',           sublabel: 'pre-diff, pre-commit',        col: 0, row: 0 },
  { id: 'parse',    label: 'Structural parse',        sublabel: 'tree-sitter',                 col: 1, row: 0 },
  { id: 'graph',    label: 'File relationship graph', sublabel: 'temporal edges',              col: 1, row: 1 },
  { id: 'risk',     label: 'Risk resolution',         sublabel: 'deterministic, no model',     col: 2, row: 1 },
  { id: 'gate',     label: 'Escalation gate',         sublabel: 'depth by blast radius',       col: 2, row: 0 },
  { id: 'question', label: 'Question synthesis',      sublabel: 'scoped to the change',        col: 3, row: 0 },
  { id: 'human',    label: 'Human answer',            sublabel: 'voice, transcribed',          col: 3, row: 1 },
  { id: 'judge',    label: 'Judgement',               sublabel: 'graded against the change',   col: 4, row: 1 },
  { id: 'ledger',   label: 'Record',                  sublabel: 'who understood what, when',   col: 5, row: 1 },
];
