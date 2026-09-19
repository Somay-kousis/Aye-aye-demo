// The one piece of real product logic in the demo. Deterministic: no model decides
// whether you get interrupted. Rule table mirrors docs/architecture.md; first match wins.

export const RULES = [
  ['services/auth/**', 'risk-bearing'],
  ['services/payments/**', 'risk-bearing'],
  ['services/admin/**', 'risk-bearing'],
  ['services/notifications/**', 'low-stakes'],
  ['infra/**', 'low-stakes'],
  ['**', 'low-stakes'], // catch-all: an unmapped file still resolves at risk and is skipped, never ignored
];

// Enough glob for the rule table: `**` spans directories, `*` stays within one segment.
export function globToRegExp(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') {
      re += '.*';
      i++;
      if (glob[i + 1] === '/') i++;
    } else if (c === '*') {
      re += '[^/]*';
    } else if ('.+?^${}()|[]\\'.includes(c)) {
      re += '\\' + c;
    } else {
      re += c;
    }
  }
  return new RegExp('^' + re + '$');
}

const compiled = RULES.map(([glob, stakes]) => ({ glob, stakes, re: globToRegExp(glob) }));

export function classify(path) {
  for (const rule of compiled) {
    if (rule.re.test(path)) return { rule: rule.glob, stakes: rule.stakes };
  }
  return null;
}

// `services/auth/session.py` -> `auth`; `infra/cache/x.py` -> `cache`.
export function domainOf(path) {
  const parts = path.split('/');
  return parts.length > 1 ? parts[1] : parts[0];
}
