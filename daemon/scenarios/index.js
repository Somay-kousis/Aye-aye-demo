// STAGED. Every string here is copied from docs/demo-script.md and must not be
// paraphrased. Placeholders in braces are filled from the real diff by
// daemon/interpolation.js. Backticks mark inline code for the UI to render in --mono.

export const PERSON = 'Somay Kousis';

export const VERDICT_FOOTER = "GRADED AGAINST THE DIFF · JUDGE HAS NO ACCESS TO THE AGENT'S SUMMARY";

export const SCENARIOS = {
  'services/auth/session.py::SESSION_TTL': {
    header: [
      'COMPREHENSION CHECK',
      'services/auth/session.py · SESSION_TTL',
      'Touches: {touches}',
      `Assigned to: ${PERSON}`,
    ],
    attempts: [
      {
        question:
          'You changed how long a session stays valid, from {old_spoken} to {new_spoken}. ' +
          'Walk me through what that does to a token that was already stolen, and when a ' +
          'session you revoke actually stops working.',
        concepts: [
          {
            index: 1,
            name: 'Intent of the change',
            result: 'pass',
            line: 'Session lifetime extended from {old} to {new}.',
          },
          {
            index: 2,
            name: 'Revocation path',
            result: 'fail',
            line:
              'The cached session in `session_cache.py` derives its own TTL from this constant. ' +
              'Deleting the row does not evict the cache.',
            emphasis:
              'A token stolen today keeps working until {expires}. Locking the account does not stop it.',
          },
          {
            index: 3,
            name: 'Blast radius',
            result: 'fail',
            line:
              '`admin/console.py` imports the same constant. Admin sessions were extended too, ' +
              'and nobody asked for that.',
          },
        ],
        verdict: { headline: 'NOT UNDERSTOOD — 1 of 3', sub: 'Nothing is blocked. The question narrows.', passed: false },
      },
      {
        question: 'Where else does `SESSION_TTL` get read, and what evicts the cached copy?',
        // TTS reads the identifier badly; `spoken` is what Aye-aye says, `question` what it shows.
        spoken: 'Where else does the session TTL get read, and what evicts the cached copy?',
        concepts: [
          {
            index: 2,
            name: 'Revocation path',
            result: 'pass',
            line: 'Cache expiry derived from the same constant. Revocation lags.',
          },
          {
            index: 3,
            name: 'Blast radius',
            result: 'pass',
            line: 'Both `refresh.py` and `admin/console.py` affected.',
          },
        ],
        verdict: { headline: 'UNDERSTOOD — 3 of 3', sub: '', passed: true },
      },
    ],
    ledgerTarget: 'services/auth/session.py · SESSION_TTL',
  },
};

// Beat 1. Keyed by path rule because there is no symbol on the skip path.
export const SKIPS = {
  'services/notifications/**': [
    'NO CHECK REQUIRED',
    '{path}',
    'Copy change. No auth, payments or data path touched.',
    'Recorded. Nobody interrupted.',
  ],
};

// Node telemetry, STAGED: what each stage reports having spent, shown as a caption under
// four nodes. Internally consistent, not measured: parse tokenises the file, graph walks a
// smaller structure, the two model-backed stages carry the model. The model name is a
// placeholder for the demo; the real architecture is bring-your-own-model.
export const MODEL = 'claude-sonnet-5';

export const TELEMETRY = {
  parse:    { ms: 640,  tokens: 4200 },
  graph:    { ms: 910,  tokens: 1100 },
  question: { ms: 2800, tokens: 3800, model: MODEL },
  judge:    { ms: 3100, tokens: 5600, model: MODEL },
};

// Prior ledger entries. Literal fixtures; the two new rows take the wall clock.
export const LEDGER_FIXTURE = [
  { time: 'Mar 14', person: PERSON, target: 'services/payments/webhooks.py · retry', verdict: 'understood', score: '2/2' },
  { time: 'Mar 11', person: PERSON, target: 'services/auth/tokens.py · rotate', verdict: 'understood', score: '4/4' },
];
