// Fills the {old}, {new}, {old_spoken}, {new_spoken} and {expires} placeholders in
// docs/demo-script.md from the real diff, so a staged sentence stays true whatever
// value the agent chose.

const UNIT_SECONDS = { weeks: 604800, days: 86400, hours: 3600, minutes: 60, seconds: 1 };
const UNIT_ORDER = ['weeks', 'days', 'hours', 'minutes', 'seconds'];

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen',
  'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

function numberWords(n) {
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : '');
  if (n < 1000) return ONES[Math.floor(n / 100)] + ' hundred' + (n % 100 ? ' ' + numberWords(n % 100) : '');
  return String(n);
}

// `timedelta(days=7)` -> { days: 7 }; `timedelta(hours=1, minutes=30)` -> { hours: 1, minutes: 30 }
export function parseTimedelta(line) {
  const m = line.match(/timedelta\(([^)]*)\)/);
  if (!m) return null;
  const parts = {};
  for (const [, unit, value] of m[1].matchAll(/(weeks|days|hours|minutes|seconds)\s*=\s*([\d.]+)/g)) {
    parts[unit] = Number(value);
  }
  return Object.keys(parts).length ? parts : null;
}

function describe(parts, spoken) {
  return UNIT_ORDER.filter((u) => parts[u])
    .map((u) => {
      const n = parts[u];
      const unit = n === 1 ? u.slice(0, -1) : u;
      return `${spoken ? numberWords(n) : n} ${unit}`;
    })
    .join(' ');
}

function totalSeconds(parts) {
  return UNIT_ORDER.reduce((sum, u) => sum + (parts[u] || 0) * UNIT_SECONDS[u], 0);
}

// "26 September", en-GB day-month, no year: the sentence is about this week, not history.
export function formatDay(date) {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
}

export function durationValues(diff, now = new Date()) {
  const oldLine = diff.removed.find((l) => l.includes('timedelta('));
  const newLine = diff.added.find((l) => l.includes('timedelta('));
  const oldParts = oldLine && parseTimedelta(oldLine);
  const newParts = newLine && parseTimedelta(newLine);
  if (!oldParts || !newParts) return null;
  const expires = new Date(now.getTime() + totalSeconds(newParts) * 1000);
  return {
    old: describe(oldParts, false),
    new: describe(newParts, false),
    old_spoken: describe(oldParts, true),
    new_spoken: describe(newParts, true),
    expires: formatDay(expires),
  };
}

export function fill(text, values) {
  return text.replace(/\{(\w+)\}/g, (whole, key) => (key in values ? values[key] : whole));
}
