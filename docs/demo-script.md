# Demo script

Every string that appears on screen. **Do not paraphrase these and do not invent
replacements.** If something does not fit the layout, change the layout.

> Somay: this is a first draft written to be plausible. Correct anything that rings false to
> an engineer, especially the diff and the wrong answer. Those two carry the whole demo.

**Interpolation.** The diff is never scripted; the daemon shows whatever the agent actually
wrote. Strings below that mention the agent's choice use placeholders, filled from the real
diff so the sentence stays true whatever value the agent picked:

| placeholder | source | example |
|---|---|---|
| `{old}` | the removed `timedelta(...)` | `30 minutes` |
| `{new}` | the added `timedelta(...)` | `7 days` |
| `{old_spoken}` / `{new_spoken}` | same, as words for the spoken question | `thirty minutes` / `seven days` |
| `{expires}` | today + `{new}`, formatted `26 September` | `26 September` |

Spoken answers avoid identifiers: say "the refresh module", not `refresh.py`. Chrome's
transcription cannot spell code, and the transcript is on camera.

---

## The setup

`sample-repo/` is a small Python service. It has more files than the demo touches, so the
change lands somewhere that looks like a system rather than a toy.

```
sample-repo/
  services/
    auth/
      session.py          <- the change that fires
      refresh.py
      tokens.py
    payments/
      charges.py
      webhooks.py
    admin/
      console.py
    notifications/
      templates.py        <- the change that is skipped
      dispatch.py
  infra/
    cache/
      session_cache.py
  README.md
```

---

## Beat 1 — the skipped change

**What you type into Claude Code:**

> The password reset email says "click here" twice. Fix the copy.

It edits `services/notifications/templates.py`.

**What the UI does.** Panes are already open and idle. The traversal runs
`session -> intake -> parse -> graph -> risk`, the same path every change takes. Nothing fans
out from `graph`. The `risk` node holds, resolves **green**, and its readout reads
`notifications · 0 dependents`. The skip edge draws to `ledger`.

**Right pane shows, and nothing else:**

```
NO CHECK REQUIRED
services/notifications/templates.py
Copy change. No auth, payments or data path touched.
Recorded. Nobody interrupted.
```

Hold four seconds. This beat exists to prove the product has judgement. Do not skip it and
do not make it look like an error state.

---

## Beat 2 — the change that fires

**What you type into Claude Code:**

> Users are complaining they get signed out too often. Make sessions last longer.

It edits `services/auth/session.py`.

**The diff shown in the right pane** is computed from the file. When the agent picks seven
days it looks like this; any other value renders the same way and the strings below follow it:

```diff
  # services/auth/session.py

- SESSION_TTL = timedelta(minutes=30)
+ SESSION_TTL = timedelta(days=7)
```

**The traversal.** The graph fades to idle over `--d-base`, then
`session -> intake -> parse -> graph -> risk -> gate`. At `graph`, the three blast-radius
edges fan out one at a time to `refresh.py`, `console.py`, `session_cache.py`. At `risk` the
node holds and resolves **amber**.

Two nodes show their working as they resolve. This is the difference between a system and a
hardcoded prompt, and it costs one line of text each.

`risk` readout, once resolved:

```
auth · session lifetime · 3 dependents
```

`gate` readout, once resolved:

```
blast radius 3 → depth 3
```

Both appear as a caption directly beneath the node card, `--t-small`, `--mono`, in the node's
resolved colour. Neither is explained on screen. An engineer watching understands
immediately that the depth of the check scales with how far the change reaches, and that
nothing chose it but the graph.

**Right pane header, appearing line by line:**

```
COMPREHENSION CHECK
services/auth/session.py · SESSION_TTL
Touches: refresh rotation, admin console, session cache
Assigned to: Somay Kousis
```

---

## Beat 3 — the question

Appears in the question slot. Aye-aye speaks it aloud at the same time.

> You changed how long a session stays valid, from {old_spoken} to {new_spoken}.
> Walk me through what that does to a token that was already stolen, and when a
> session you revoke actually stops working.

The question is deliberately not "what does this code do." It asks about consequence,
because that is the thing an engineer who did not write the code cannot fake.

---

## Beat 4 — the answer that fails

**What you say out loud.** Say it casually and with confidence. That is the point.

> Yeah, it just keeps people signed in for a week instead of half an hour, so they
> stop getting kicked out. Revocation is fine, we delete the session row on logout
> so it takes effect straight away.

The transcript appears live as you speak, then locks after 1500ms of silence. Space locks it
immediately if you need to. Locking submits the answer; nothing else does.

**The concepts, revealed one at a time with a beat between each:**

| # | Concept | Result | Line shown |
|---|---------|--------|-----------|
| 1 | Intent of the change | **pass** | Session lifetime extended from {old} to {new}. |
| 2 | Revocation path | **fail** | The cached session in `session_cache.py` derives its own TTL from this constant. Deleting the row does not evict the cache. **A token stolen today keeps working until {expires}. Locking the account does not stop it.** |
| 3 | Blast radius | **fail** | `admin/console.py` imports the same constant. Admin sessions were extended too, and nobody asked for that. |

The bolded sentence in concept 2 is the most important string in the demo. It is the only
place the consequence is stated in operational terms rather than technical ones, and it is
what makes a viewer sit up. Render it in `--text`, not `--text-dim`, and let it sit on its
own line. Do not add an icon, a colour, or the word "critical" to it. The sentence is doing
the work; decoration would make it read as a scanner.

**Verdict line:**

```
NOT UNDERSTOOD — 1 of 3
Nothing is blocked. The question narrows.
```

Directly beneath the verdict, permanently, in `--t-micro` uppercase `--text-faint`:

```
GRADED AGAINST THE DIFF · JUDGE HAS NO ACCESS TO THE AGENT'S SUMMARY
```

This line never changes and is never animated. It is the entire competitive argument against
PR-review bots, stated once, quietly, as a property of the system rather than a claim.

That second line matters. Say it on camera too if you narrate. Aye-aye does not stop the
merge; it refuses to record that someone understood something they did not.

---

## Beat 5 — the narrower question

The question and the transcript **replace in place**. The three concept rows stay where they
are; rows 2 and 3 flip from fail to pass. Nothing stacks and nothing scrolls.

> Where else does `SESSION_TTL` get read, and what evicts the cached copy?

Spoken form (TTS reads the identifier badly; the display text is unchanged):

> Where else does the session TTL get read, and what evicts the cached copy?

**What you say:**

> Right — `refresh.py` and the admin console both import it, and the cache sets
> its own expiry from the same value, so revocation lags by the full window.
> Admin sessions getting a week was not intended.

**Concepts:**

| # | Concept | Result | Line shown |
|---|---------|--------|-----------|
| 2 | Revocation path | **pass** | Cache expiry derived from the same constant. Revocation lags. |
| 3 | Blast radius | **pass** | Both `refresh.py` and `admin/console.py` affected. |

**Verdict:**

```
UNDERSTOOD — 3 of 3
```

---

## Beat 6 — the record

Left pane graph dims. Right pane becomes the ledger. Three prior entries are already there
and the new one writes in at the top.

```
LEDGER

22:41   Somay Kousis    services/auth/session.py · SESSION_TTL         understood  3/3
22:41   —               services/notifications/templates.py            skipped
Mar 14  Somay Kousis    services/payments/webhooks.py · retry          understood  2/2
Mar 11  Somay Kousis    services/auth/tokens.py · rotate               understood  4/4
```

Five columns: time, person, target, verdict, score. The score cell is empty on the skip row.
The two new rows take the wall clock at the moment they were recorded; the two March rows are
literal fixtures.

Hold. This is the closing frame and the moat argument: the thing that accumulates is not
code, it is a record of who understood what.

**Do not add** a count, a streak, a score, a percentage, or a chart to this screen. The
record is the point. Gamifying it makes it a dashboard, and dashboards are the competitor.

---

## Timing

Whole run is about 75 seconds. Beat 1 is 12s, beat 2 is 15s, beats 3 and 4 are 25s, beat 5
is 15s, beat 6 holds 8s. Do not pad. Dead air reads as the product being slow.

## Replay mode

`npm run dev -- --replay` emits this exact sequence from a fixture without watching files
(open the UI, press Space to start), so a clean take is always available if something breaks before a call. Replay is the
fallback for calls, not the way the hero take gets recorded: the point of the demo is the
agent choosing something consequential without being told to, so the recorded take uses the
real watcher and the vague instruction.
