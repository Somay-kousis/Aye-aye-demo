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
  --surface:       #14181C;
  --surface-raised:#1B2126;
  --border:        #242B31;
  --border-strong: #38424A;

  /* text */
  --text:          #E6EAED;
  --text-dim:      #98A3AC;
  --text-faint:    #5E6970;

  /* state */
  --idle:          #4A555D;
  --active:        #6BA8FF;   /* currently executing */
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
  --meter-w:     24px;
  --meter-bar:   2px;
  --hairline:    1px;
  --nudge:       4px;    /* the most anything may translate */
  --dash:        2 3;    /* blast-radius edge dash pattern */
  --tint:        15%;    /* diff row background */

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

The CHECK section label carries an **ARMED** suffix once the page has had its first keypress
and TTS and the microphone are live. Chrome blocks both until a user gesture; the suffix
makes it visible before a take starts that the gesture happened. `CHECK · ARMED`, same
`--t-micro`, `--text-faint`.

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
- active: border `--active`, a 1px inner ring, label goes `--text`
- resolved pass: border `--pass`. pending: `--pending`. fail: `--fail`
- **no shadow, no glow, no scale transform.** State is carried by border and text colour
  only. A node that pulses is a node that looks like a toy.

Ports are `--port` squares on the card edge in `--border-strong`, filled with the edge colour
once that edge has fired.

**Readout.** `risk` and `gate` show their computed line as a caption directly beneath the
card, outside it, `--readout-gap` below the border, `--t-small` `--mono`, in the node's
resolved colour. It may be wider than the card. Nothing renders inside a card beyond label
and sublabel.

## Edges

Bezier, `--hairline`, `--idle` when dormant. When an edge fires it draws from source to target over
`--d-edge` using `stroke-dashoffset`, in `--active`, then settles to the resolved colour of
its target node.

Blast-radius edges are the same but dashed `--dash` and `--text-faint`, and they do not
settle to a state colour. They are context, not flow.

## Right pane

Four stacked regions, each appearing only when it has content, each separated by a
`--hairline` `--border` rule. On the second attempt the question and answer regions replace
their content in place; concept rows persist and update:

1. **Header.** Section label in `--t-micro` uppercase, then the file path in `--mono`.
2. **Diff.** `--mono`, `--t-small`. Removed line `--fail` at `--tint` background, added line
   `--pass` at `--tint`. No line numbers, no syntax highlighting beyond that.
3. **Question.** `--t-read`, `--ui`, `--text`. Generous leading, `--leading-read`. This is the
   only place in the UI that gets room to breathe.
4. **Answer.** Live transcript in `--t-read` `--text-dim` while speaking, locking to
   `--text` after `--d-silence` of silence, or on Space. Then the concept rows.

## Concept row

```
  ✓  Intent of the change
     Session lifetime extended from 30 minutes to 7 days.

  ✕  Revocation path
     The cached session in session_cache.py derives its own TTL...
```

Mark is a `--glyph` glyph in `--pass` or `--fail`. Rows reveal one at a time, `--d-concept`
apart, each on its own daemon event. The detail line fades in `--d-detail` after its mark. Do not reveal all three at once; the
sequence is what makes it feel like judgement rather than a lookup.

## Voice indicator

A 5-bar amplitude meter, `--meter-bar` bars, `--active`, driven by real microphone input.
`--meter-w` wide, sits inline before the transcript. When not listening it is five flat
`--hairline` lines in `--idle`.

No microphone icon. No circle. No waveform sweep.

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
