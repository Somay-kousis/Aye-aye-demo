# Design

The reference is a node-graph editor, not a SaaS dashboard. Dense, precise, instrument-like.
The node metaphor is earned here: an agent run genuinely is a graph, so this is the data
model rendered honestly rather than a style choice.

**What makes it not look generic** is typography and density, not the nodes. Small type, a
tight grid, hairline borders, no glow, no blur, no gradient. If it starts looking soft,
it is wrong.

## Tokens

Use these names in CSS custom properties. No colour, size or duration literal anywhere else.
`ui/tokens.css` is the canonical copy; this block mirrors it. The daemon reads the `--d-*`
values from `ui/tokens.css` at startup to pace its event sequence.

```css
:root {
  /* surfaces */
  --canvas:        #0A0C0E;
  --surface:       #181D22;
  --surface-raised:#1B2126;
  --border:        #2F383F;
  --border-strong: #38424A;

  /* text */
  --text:          #E6EAED;
  --text-dim:      #98A3AC;
  --text-faint:    #5E6970;

  /* state */
  --idle:          #4A555D;
  --idle-routed:   #343D45;   /* the skip and retry paths at rest, quieter than flow */
  --active:        #6BA8FF;   /* currently executing */
  --visited:       #38424A;   /* traversed and moved on from; resolved colours override it */
  --pass:          #45D48A;
  --pending:       #F5A524;
  --fail:          #F4593C;

  /* type */
  --ui:   "Instrument Sans", system-ui, sans-serif;
  --mono: "IBM Plex Mono", ui-monospace, monospace;

  /* scale */
  --t-micro: 10px;   /* section labels, uppercase, --tracking */
  --t-small: 12px;   /* node sublabels, metadata, readouts */
  --t-body:  14px;   /* node labels, ledger rows */
  --t-read:  17px;   /* the question, the transcript */
  --tracking: 0.14em;
  --leading-read: 1.5;

  /* rhythm */
  --gap:   8px;
  --pad:   16px;
  --radius: 4px;     /* everything. no pills, no 16px cards */

  /* layout */
  --pane-left:   1180px;
  --pane-right:  740px;
  --node-w:      184px;  /* uniform card width; six columns fit --pane-left with --gap gutters */
  --readout-gap: 6px;    /* card bottom to readout caption */
  --port:        3px;
  --glyph:       12px;   /* concept row mark */
  --spectrum:    260px;  /* the listener canvas, square */
  --evaluator-w: 48px;   /* judge fan-out cards; three with --gap fit one --node-w cell */
  --hairline:    1px;
  --nudge:       4px;    /* the most anything may translate */
  --dash:        2 3;    /* blast-radius edge dash pattern */
  --tint:        15%;    /* diff row background */

  /* codebase layer: the substrate beneath the control plane, opacities at rest and lit */
  --codebase-dot:   0.25;
  --codebase-edge:  0.08;
  --codebase-focus: 0.6;

  /* motion */
  --d-fast:    140ms;
  --d-base:    260ms;
  --d-edge:    420ms;   /* an edge drawing */
  --d-hold:    900ms;   /* a node holding before the next edge */
  --d-decide:  1600ms;  /* the risk node deciding */
  --d-concept: 700ms;   /* between concept rows */
  --d-detail:  200ms;   /* mark to detail line */
  --d-ledger:  1200ms;  /* new ledger row border settling */
  --d-silence: 1500ms;  /* silence before the transcript locks */
  --d-lock:    390ms;   /* the listener contracting into the locked transcript */
  --ease:      cubic-bezier(0.22, 0.61, 0.36, 1);
}
```

Fonts are self-hosted in `ui/fonts/` (both OFL) so a take never depends on the network.
Deliberately not Inter, not Geist, not JetBrains Mono.

## Layout

Fixed 1920×1080. Never scrolls.

```
┌──────────────────────────────────────────┬───────────────────────────┐
│                                          │                           │
│  ARCHITECTURE                            │  CHECK                    │
│  node graph, 6 columns                   │  diff, question,          │
│  1180px                                  │  transcript, concepts     │
│                                          │  740px                    │
└──────────────────────────────────────────┴───────────────────────────┘
```

One window, two panes. Both animate in from the centre line on first event, over
`--d-base`. They do not pop; they resolve.

The CHECK section label carries an **ARMED** suffix once TTS and the microphone have both
answered. Chrome blocks both until a user gesture, so the first keydown of any key arms them;
the suffix appears only when both succeeded, so it is visible before a take starts that the
take will have audio. In replay mode Space also starts the run, so press any other key
first, look for `CHECK · ARMED`, then Space. Same `--t-micro`, `--text-faint`. The chosen
TTS voice is picked from a named preference list and logged to the console at arm time.

## Node card

```
┌─────────────────────────────┐
│ ▸ RISK RESOLUTION           │   label,  --t-body,  --ui,  --text
│   deterministic, no model   │   sub,    --t-small, --mono, --text-faint
└─────────────────────────────┘
```

- background `--surface`, border 1px `--border`, radius `--radius`
- `--node-w` wide, uniform, height by content, `--pad` inside
- idle: border `--border`, text `--text-dim`
- active: border `--active`, a 1px inner ring, label goes `--text`. Only the node currently
  executing is `--active`.
- visited (traversed and moved on from): border `--visited`, label `--text`, sublabel
  `--text-faint`
- resolved pass: border `--pass`. pending: `--pending`. fail: `--fail`. A resolved node keeps
  its resolved colour; it overrides visited.
- **no shadow, no glow, no scale transform.** State is carried by border and text colour
  only. A node that pulses is a node that looks like a toy.

Ports are `--port` squares on the card edge in `--border-strong`, filled with the edge colour
once that edge has fired. Left and right ports sit at mid-height. Top and bottom ports sit
`--gap` in from the card's left edge, so a vertical edge runs clear of the readout beneath the
card above it.

Node positions are data: `ui/graph/nodes.js` gives each node a column and a row,
`ui/graph/layout.js` turns those into pixels. Six columns at `--node-w` with `--gap` gutters
fill `--pane-left`, so edges between adjacent columns are short stubs and edges within a
column are vertical drops; the two long edges (`risk → ledger`, `judge → question`) are routed
below and above the rows with a lead and a control-point offset held in `ui/graph/edges.js`.

**Readout.** `risk` and `gate` show their computed line as a caption directly beneath the
card, outside it, `--readout-gap` below the border, `--t-small` `--mono`, in the node's
resolved colour. It may be wider than the card. Nothing renders inside a card beyond label
and sublabel.

## Edges

Bezier, `--hairline`, `--idle` when dormant. When an edge fires it draws from source to target over
`--d-edge` using `stroke-dashoffset`, in `--active`, then settles to the resolved colour of
its target node.

Each flow edge carries a small arrowhead at its target port, `--border-strong` when dormant
and following the edge colour once fired, so direction reads in a still as well as in
motion.

Blast-radius edges are the same but dashed `--dash` and `--text-faint`, and they do not
settle to a state colour, and they carry no arrowhead. They are context, not flow. They run
from the `graph` node to a reserved band along the bottom of the architecture pane with
three slots; a slot renders nothing until its dependent arrives, then shows the dependent's
label in `--t-small` `--ui` `--text-dim` over its path in `--t-small` `--mono` `--text-faint`.

## Right pane

Four stacked regions, each appearing only when it has content, each separated by a
`--hairline` `--border` rule. On the second attempt the question and answer regions replace
their content in place; concept rows persist and update:

1. **Header.** Four lines, as the script gives them: the section label in `--t-micro`
   uppercase `--text-dim`; the path in `--mono` `--t-body` `--text`; `Touches:` and
   `Assigned to:` in `--t-small` `--text-dim`. On the last line the name renders `--text`:
   it is the one thing in the header carrying full weight, a named human on the hook. Lines
   land `--d-fast` apart. The same component renders beat 1's `NO CHECK REQUIRED` lines.
2. **Diff.** `--mono`, `--t-small`. Removed line `--fail` at `--tint` background, added line
   `--pass` at `--tint`. Only the changed lines: no line numbers, no path comment, no blank
   line, no syntax highlighting beyond that. It arrives with the header, not with the change.
3. **Question.** `--t-read`, `--ui`, `--text`. Generous leading, `--leading-read`. This is the
   only place in the UI that gets room to breathe. Backticked identifiers render `--mono`.
   Aye-aye speaks the question's `spoken` form when the scenario gives one, else the text
   with the backticks stripped.
4. **Answer.** The mic stream and the listener go live with the question, so the rings move
   while Aye-aye speaks; recognition starts only when the utterance ends (or after a
   length-derived timeout if TTS never answers), so the take never transcribes its own voice.
   Live transcript in `--t-read` `--text-dim`, locking to `--text` after `--d-silence` of
   silence, or on Space. Silence is measured two ways at once: the clock restarts on every
   recognition result and only counts down while the mic's RMS is under threshold. If
   Chrome ends recognition with `no-speech` before a result, it is restarted. The text is
   capped at eight lines and clips from the top. Then the concept rows, each landing
   `--d-fast` after its evaluator on the left resolves.
5. **Verdict.** Headline `--t-read` 500 `--text`, with the score (`1 of 3`, `3 of 3`) in the
   state colour, `--fail` or `--pass`. Sub line `--t-small` `--text-dim`. Beneath, the footer
   in `--t-micro` uppercase `--text-faint`, created once and never animated or re-rendered.

## Concept row

```
  ✓  Intent of the change
     Session lifetime extended from 30 minutes to 7 days.

  ✕  Revocation path
     The cached session in session_cache.py derives its own TTL...
```

Mark is a `--glyph` glyph in `--pass` or `--fail`. Name `--t-body` 500 `--text`, detail line
`--t-body` `--text-dim`. Rows reveal one at a time, `--d-concept` apart, each on its own
daemon event. The detail line fades in `--d-detail` after its mark. Do not reveal all three
at once; the sequence is what makes it feel like judgement rather than a lookup. A second
event for an index updates that row in place: the mark flips, the detail line is replaced,
and an emphasis line the new event lacks goes. The emphasis line itself is `--t-body`
`--text` on its own line, with no mark, colour or label.

## Listener

One listening indicator, and it is large: a `--spectrum` square canvas centred in the check
pane's lower third, which is empty at every frame. It exists only while a question is live.

Concentric arcs driven by the mic's frequency data: 48 log-spaced bins from 80 Hz to 8 kHz,
each a `--hairline` ring in `--active` whose radius and opacity follow its eased magnitude.
A fixed ring at the centre never moves. Smoothing is the analyser's constant plus per-bin
attack and release, so it reads as an instrument, not a nerve.

Three states. Armed but silent: every ring collapsed onto the centre, one thin circle, drawn
once. Listening: rings breathing outward with the voice; the canvas redraws only while the
mic stream is attached. Lock: over `--d-lock` the rings contract, the drawing rises a short
way and fades, in step with the transcript going from `--text-dim` to `--text`. The voice
becomes the record. Then the canvas is gone.

Single colour, `--active`. No gradient, no glow, no bloom.

## Evaluator card

```
  ┌────┐ ┌────┐ ┌────┐
  │ 01 │ │ 02 │ │ 03 │      --evaluator-w wide, --gap apart, --t-micro --mono
  └────┘ └────┘ └────┘
```

Above `judge`, in the empty cell. `--surface`, `--border`, `--radius`. Running: border
`--active`, label `--text`. Resolved: border `--pass` or `--fail`, and a return line in the
same colour draws back to judge beside the stub. Fades out over `--d-base` on the retry.

## Telemetry caption

Beneath `parse`, `graph`, `question` and `judge` once visited: `--t-micro` `--mono`
`--text-faint`, one line of `0.6s · 4.2k tok`, the model on a second line where there is one.
Quieter than a readout on purpose: the two readouts carry meaning, this is texture.

## Ledger

A table in `--mono` `--t-body`. Five columns: time, person, target, verdict, score. The score
cell is empty on a skipped row. Hairline rules between rows. New row writes in top with a
`--hairline` `--pass` left border that fades to `--border` over `--d-ledger`.

## Motion rules

- Nothing moves that is not reacting to an event.
- Nothing loops. No idle animation, no breathing, no shimmer.
- No easing bouncier than `--ease`. Nothing overshoots.
- Opacity and colour transitions preferred over transform. If something must move, it
  translates by `--nudge` or less.
- The app never zooms or pans. The screen recorder adds that afterwards.
