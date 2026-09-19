# Architecture, and how the left pane renders it

The left pane shows Aye-aye's own architecture as a node graph, and lights up the path a
real change actually takes through it. This is the centrepiece of the demo: the viewer sees
the change move through the system rather than being told about it.

> Replace the node list below with the real master architecture when it is exported from
> Excalidraw. The shape of the data must stay the same.

## Node list

Each node is a stage. `id` is referenced by the traversal and by the file mapping.

| id | label | sublabel | column |
|----|-------|----------|--------|
| `session` | Session capture | instruction + reasoning | 0 |
| `intake` | Change intake | pre-diff, pre-commit | 0 |
| `parse` | Structural parse | tree-sitter | 1 |
| `graph` | File relationship graph | temporal edges | 1 |
| `risk` | Risk resolution | deterministic, no model | 2 |
| `gate` | Escalation gate | depth by blast radius | 2 |
| `question` | Question synthesis | scoped to the change | 3 |
| `human` | Human answer | voice, transcribed | 3 |
| `judge` | Judgement | graded against the change | 4 |
| `ledger` | Record | who understood what, when | 5 |

## Edges

```
session -> intake
intake  -> parse
parse   -> graph
graph   -> risk
risk    -> gate          (risk-bearing)
risk    -> ledger        (low stakes: skipped, logged, no question)
gate    -> question
question-> human
human   -> judge
judge   -> question      (failed: re-ask, narrower)
judge   -> ledger        (passed)
```

Two things to note, because they are the argument the demo is making:

- `risk -> ledger` is the **skip path**. A low-stakes change is recorded and nobody is
  interrupted. Showing this path fire is what kills the "so it nags you constantly"
  objection before anyone voices it.
- `judge -> question` is the **retry loop**. A failed answer does not block the engineer, it
  narrows the question. Aye-aye is not a gate that punishes, it is a check that teaches.

## File to node mapping

**Every change takes the same path to `risk`:** `session -> intake -> parse -> graph -> risk`.
The only thing that differs between a skipped change and a checked one is the decision the
`risk` node makes. Same shape, different verdict; that is a better comparison than two
different shapes.

Which paths are risk-bearing is decided by this rule table. First match wins.

```json
{
  "services/auth/**":          "risk-bearing",
  "services/payments/**":      "risk-bearing",
  "services/admin/**":         "risk-bearing",
  "services/notifications/**": "low-stakes",
  "infra/**":                  "low-stakes"
}
```

Risk-bearing paths continue past `risk` to `gate`. Low-stakes paths take the skip path to
`ledger`. There is no catch-all row: every file in `sample-repo/` that the demo can touch is
covered, and unused rules rot.

This classification is genuinely computed from the changed path at runtime. It is the one
piece of real product logic in the demo, and it is deliberately deterministic: no model
decides whether you get interrupted.

## Blast radius

When a risk-bearing change lands, the graph also shows which other parts of the system
depend on the changed symbol. For the demo this is read from a static map. Each entry names
the surface the symbol controls (rendered by the `risk` node) and a short label per
dependent (rendered in the right-pane header's `Touches:` line).

```json
{
  "services/auth/session.py::SESSION_TTL": {
    "surface": "session lifetime",
    "dependents": [
      { "path": "services/auth/refresh.py",        "label": "refresh rotation" },
      { "path": "services/admin/console.py",       "label": "admin console" },
      { "path": "infra/cache/session_cache.py",    "label": "session cache" }
    ]
  }
}
```

The changed symbol is detected from the diff: the daemon looks for a map key whose path
matches the changed file and whose symbol name appears in a changed line.

These render as three thin secondary edges fanning out from the `graph` node, appearing one
at a time. The third one, the cache, is the one the engineer misses. Give it the same visual
weight as the others so the miss is not telegraphed.

## Traversal animation

The daemon emits one `node` event per stage, in order, paced by the `--d-*` tokens it reads
from `ui/tokens.css`, and the UI animates each arrival. The path must feel like it is being
computed, not replayed: each node holds briefly before the next edge draws.

The `risk` node is the only one that visibly *decides*. It should hold noticeably longer than
the others and resolve into one of two colours before the next edge draws.

**Between beats.** When a new `change` arrives, every node and edge fades back to idle over
`--d-base`, and only then does the new traversal begin from `session`.

## Nodes that show their working

Two nodes render a **readout** once resolved, carrying what they computed. The readout is a
caption directly beneath the card, outside it, `--t-small` `--mono` in the node's resolved
colour, offset by `--readout-gap`. It may be wider than the card. Cards themselves stay label
and sublabel only, at a uniform `--node-w`.

**`risk`** renders `<domain> · <surface> · <n> dependents`, derived from the matched path
rule and the blast-radius map. Example: `auth · session lifetime · 3 dependents`. On the skip
path there is no surface: `notifications · 0 dependents`.

**`gate`** renders `blast radius <n> → depth <d>`, where depth comes from the escalation
ladder below. Example: `blast radius 3 → depth 3`.

## Escalation ladder

Depth is the number of concepts the answer must cover, and it scales with reach. This is a
lookup, not a judgement, and that is the point: nothing decides how hard you get questioned
except how far the change travels.

| dependents | depth |
|-----------|-------|
| 0 | 1 — intent only |
| 1–2 | 2 |
| 3–5 | 3 |
| 6–10 | 5 |
| 11+ | escalate to a second reviewer |

Precedence: the path rule decides whether the gate is reached at all; the ladder only decides
depth. A risk-bearing file with no known dependents is still asked about, at depth 1.

For the demo, only the `3–5 → 3` row is exercised. Implement the whole table anyway; it is
six lines and it means the node is reading a real rule rather than printing a constant.
