// Static blast-radius map. Mirrors docs/architecture.md. Each dependent in sample-repo/
// genuinely imports the symbol, so the claim holds if anyone opens the files.

export const BLAST_RADIUS = {
  'services/auth/session.py::SESSION_TTL': {
    surface: 'session lifetime',
    dependents: [
      { path: 'services/auth/refresh.py', label: 'refresh rotation' },
      { path: 'services/admin/console.py', label: 'admin console' },
      { path: 'infra/cache/session_cache.py', label: 'session cache' },
    ],
  },
};

// Which mapped symbol did this change touch? A key matches when its path is the changed
// file and its symbol name appears in a removed or added line.
export function detectSymbol(path, diff) {
  const changed = [...diff.removed, ...diff.added];
  for (const key of Object.keys(BLAST_RADIUS)) {
    const [keyPath, symbol] = key.split('::');
    if (keyPath !== path) continue;
    if (changed.some((line) => line.includes(symbol))) {
      return { symbol, ...BLAST_RADIUS[key] };
    }
  }
  return null;
}
