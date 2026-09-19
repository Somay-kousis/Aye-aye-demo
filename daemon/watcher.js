import { watch, readFileSync, existsSync } from 'node:fs';
import { join, sep } from 'node:path';

const DEBOUNCE_MS = 300;

// Watches sample-repo/ and hands (path, content) to `onFile` once a burst of writes
// settles. Editors and agents often write a file twice; the snapshot drops no-op updates.
export function startWatcher(root, onFile) {
  const timers = new Map();

  const watcher = watch(root, { recursive: true }, (_event, filename) => {
    if (!filename) return;
    const path = String(filename).split(sep).join('/');
    if (path.split('/').some((part) => part.startsWith('.') || part === '__pycache__')) return;

    clearTimeout(timers.get(path));
    timers.set(
      path,
      setTimeout(() => {
        timers.delete(path);
        const full = join(root, path);
        if (!existsSync(full)) return;
        onFile(path, readFileSync(full, 'utf8'));
      }, DEBOUNCE_MS),
    );
  });

  return () => watcher.close();
}
