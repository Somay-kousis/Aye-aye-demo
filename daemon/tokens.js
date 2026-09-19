import { readFileSync } from 'node:fs';

// ui/tokens.css is the single source of truth for durations. The daemon paces its
// event sequence with these so the UI never needs a timer of its own.
export function readDurations(path) {
  const css = readFileSync(path, 'utf8');
  const durations = {};
  for (const [, name, value, unit] of css.matchAll(/--(d-[a-z]+):\s*([\d.]+)(ms|s)\b/g)) {
    durations[name] = unit === 's' ? Number(value) * 1000 : Number(value);
  }
  for (const required of ['d-base', 'd-edge', 'd-hold', 'd-decide', 'd-concept']) {
    if (!(required in durations)) throw new Error(`ui/tokens.css is missing --${required}`);
  }
  return durations;
}
