// The edge table from docs/architecture.md. Most edges are drawn straight between the
// nearest ports; the two long ones carry an explicit route:
//   lead  px of straight run out of the source port before the curve starts
//   cp    px the cubic's control points sit beyond the lead / above the target, i.e. how
//         far the arc bows away from the rows
// `below` leaves the source's bottom port and enters the target's bottom port; `above`
// leaves the top port and enters the top port.

export const EDGES = [
  { from: 'session',  to: 'intake' },
  { from: 'intake',   to: 'parse' },
  { from: 'parse',    to: 'graph' },
  { from: 'graph',    to: 'risk' },
  { from: 'risk',     to: 'gate' },
  { from: 'risk',     to: 'ledger',   route: 'below', lead: 40, cp: 72 },   // the skip path
  { from: 'gate',     to: 'question' },
  { from: 'question', to: 'human' },
  { from: 'human',    to: 'judge' },
  { from: 'judge',    to: 'question', route: 'above', lead: 256, cp: 56 },   // the retry loop
  { from: 'judge',    to: 'ledger' },
];

// Blast-radius slots along the bottom band, by column. Dashed edges leave `graph` (column
// 1) so three slots at 0, 1, 2 fan out symmetrically.
export const DEPENDENT_SLOTS = [{ col: 0 }, { col: 1 }, { col: 2 }];
