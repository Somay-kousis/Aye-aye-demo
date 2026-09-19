# Aye-aye demo

## What this repo is

A **recordable demonstration** of Aye-aye, built for a pitch video and live investor calls.
Aye-aye is a comprehension check for AI-written code: it sits at the agent session, decides
which changes carry real risk, and makes the named human responsible demonstrate they
understand what shipped.

This repo is **not the product**. It is a demo that must look real on camera and must
behave identically on every take.

## What is real vs staged

- **Real:** the file watching, the diff, the changed-symbol detection, the risk
  classification by path, the blast-radius lookup, the escalation depth, the WebSocket
  events, the speech capture, the graph traversal. These genuinely respond to whatever a
  Claude Code session writes.
- **Staged:** the questions, the grading concepts and the verdict text. They are hardcoded
  per scenario in `docs/demo-script.md`. Where a staged string mentions a value the agent
  chose (the new session length, the date it expires), that value is **interpolated from the
  real diff**, so the sentence stays true whatever the agent picked.

Never blur this line in the code or in comments. `daemon/sequencer.js` is the only file that
touches both sides. Deterministic is a feature here.

## Read these before building

Do not invent content that these files specify.

- `docs/architecture.md` — the node graph, the edges, and the file-to-node mapping
- `docs/demo-script.md` — the beat sheet and every literal string that appears on screen
- `docs/design.md` — colour tokens, fonts, component specs, animation timings

## Commands

```
npm install
npm run dev               # starts the daemon on :4317 and serves the UI on :4316
npm run dev -- --replay   # replays a recorded event sequence instead of watching files
npm run tail              # prints every daemon event with a timestamp (second terminal)
npm run reset-sample      # restores sample-repo/ to its committed state between takes
```

`/verify` (a project skill in `.claude/skills/verify/`) boots the daemon, applies the two
scripted edits, prints the event tail and resets the sample repo. Run it after every change.

The watched repo is `sample-repo/` inside this project.

## Hard constraints

- **Vanilla JS, no framework.** No React, no build step beyond a static server.
- **No backend beyond the local daemon.** No database, no auth, no API calls to anything.
  One carve-out: the browser's own speech APIs. `webkitSpeechRecognition` sends audio to
  Google and needs a connection during a take; `speechSynthesis` is local. Both are Chrome
  only. This is accepted; nothing else may leave the machine.
- **Fixed 1920x1080 viewport.** Nothing may scroll. If content does not fit, the content is
  wrong, not the viewport.
- **No ambient animation.** No idle loops, no breathing, no UI-side autoplay. Every visual
  change is triggered by an event arriving from the daemon or by a keypress. The daemon paces
  a sequence using the `--d-*` durations it reads from `ui/tokens.css` at startup; that is
  sequencing, not a timer. The UI only ever transitions on arrival.
- **No zoom, no camera movement, no parallax.** Zoom is added afterwards by the screen
  recorder. Building it here makes the final video unwatchable.
- Every colour, size and duration comes from a token in `ui/tokens.css`, mirrored in
  `docs/design.md`. No literals.
- **No network during a take** beyond the speech carve-out. Fonts are self-hosted in
  `ui/fonts/`.

## Never add

These get added by pattern-matching and all of them damage the demo:

- Login, signup, settings, onboarding, or any account UI
- Fake company logos, "trusted by" rows, testimonials, avatars of invented people
- Invented metrics, counts, percentages or dollar figures anywhere on screen
- Toasts, modals, tooltips, confetti, sound effects
- Purple gradients, glassmorphism, glow, blur effects
- A chat interface. Aye-aye is not a chatbot.
- Any dependency not already in package.json without asking first. Currently: `ws`.

## Style

Comment sparingly and only where the reason is non-obvious. Prefer small files with one
job. Name things after the domain: `riskResolution`, `ledger`, `traversal`, not `handler2`.
