---
name: verify
description: Boot the daemon, apply the two scripted edits to sample-repo, print the event tail, reset the sample repo. Run after every change to the daemon or the docs.
user-invocable: true
---

# Verify the daemon end to end

Run from the project root. Total time under a minute. Do not skip the reset.

```sh
sh scripts/verify.sh
```

`scripts/verify.sh` does, in order:

1. `npm run reset-sample` so the run starts from the committed tree
2. starts `npm run dev` in the background and waits for `:4317`
3. starts `npm run tail` in the background, writing to `/tmp/aye-aye-tail.log`
4. `sed` beat 1: `click here` → `tap here` in `services/notifications/templates.py`, waits 8 s
5. `sed` beat 2: `timedelta(minutes=30)` → `timedelta(days=7)` in `services/auth/session.py`, waits 15 s
6. kills both processes, `npm run reset-sample`, prints the tail

## What a passing run prints

Beat 1, in this order: `change … low-stakes symbol=null`, `node` ×4 (session, intake, parse,
graph), `node risk`, `resolve risk pass "notifications · 0 dependents"`, `node ledger`,
`resolve ledger pass`, `skip NO CHECK REQUIRED | services/notifications/templates.py | …`.

Beat 2: `change … risk-bearing symbol=SESSION_TTL -1 +1`, `node` ×4, `dependent` ×3
(refresh rotation, admin console, session cache), `node risk`,
`resolve risk pending "auth · session lifetime · 3 dependents"`, `node gate`,
`resolve gate pending "blast radius 3 → depth 3"`, `check COMPREHENSION CHECK | … |
Touches: refresh rotation, admin console, session cache | Assigned to: Somay Kousis`,
`node question`, `question #1 … from thirty minutes to seven days …`, `node human`.

Gaps between `node` lines should be about `--d-hold` (900 ms) and the gap after `node risk`
about `--d-decide` (1600 ms). If they are not, the daemon is not reading `ui/tokens.css`.

## If it fails

- No events at all after the `sed`: the watcher did not fire. Check the daemon printed
  `watching sample-repo/ (N files)` and that the edit actually changed the file.
- `symbol=null` on beat 2: the changed line no longer contains `SESSION_TTL`, or the
  blast-radius key path does not match.
- `ignored … no rule matches this path`: the path is not in the rule table. Add a row or
  don't touch that file.
- Missing `question`: no scenario for `path::symbol` in `daemon/scenarios/index.js`.

Report the tail verbatim, then say which of the expected lines were present and which
were missing.
