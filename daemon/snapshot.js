import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const IGNORED_DIRS = new Set(['__pycache__', 'node_modules', '.git']);

// In-memory copy of every watched file, so a change can be diffed against what the
// file said before the agent touched it, not against git.
export class Snapshot {
  constructor(root) {
    this.root = root;
    this.files = new Map();
    this.reload();
  }

  reload() {
    this.files.clear();
    for (const path of walk(this.root)) {
      this.files.set(path, readFileSync(join(this.root, path), 'utf8'));
    }
  }

  // Returns a diff when the file's content changed, null otherwise. Updates the copy.
  update(path, content) {
    const before = this.files.get(path);
    if (before === content) return null;
    this.files.set(path, content);
    return lineDiff(before ?? '', content);
  }
}

function* walk(root, dir = root) {
  for (const name of readdirSync(dir)) {
    if (name.startsWith('.') || IGNORED_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) yield* walk(root, full);
    else yield relative(root, full).split(sep).join('/');
  }
}

// Strip the common prefix and suffix, then LCS the middle so an edit to two lines four
// apart reports two lines, not six. The demo's edits are small; exactness matters more
// than speed here because the diff is on camera.
export function lineDiff(before, after) {
  const a = before.split('\n');
  const b = after.split('\n');
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }
  const { removed, added } = lcsDiff(a.slice(start, endA), b.slice(start, endB));
  return { removed, added, line: start + 1 };
}

function lcsDiff(a, b) {
  const n = a.length;
  const m = b.length;
  const table = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  const removed = [];
  const added = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      i++;
      j++;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      removed.push(a[i++]);
    } else {
      added.push(b[j++]);
    }
  }
  removed.push(...a.slice(i));
  added.push(...b.slice(j));
  return { removed, added };
}
