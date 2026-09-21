import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// Every var(--x) in ui/ must be defined in ui/tokens.css. An undefined custom property
// silently drops the whole declaration, which looks fine in a still and wrong on camera.
// --after-edge is the one runtime variable, set inline by the graph, and is allowed a
// fallback. Exit 1 on any other miss.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const UI = join(ROOT, 'ui');
const RUNTIME = new Set(['--after-edge']);

const tokens = new Set();
for (const [, name] of readFileSync(join(UI, 'tokens.css'), 'utf8').matchAll(/^\s*(--[\w-]+)\s*:/gm)) tokens.add(name);

const misses = [];
let refs = 0;
for (const file of walk(UI)) {
  if (!/\.(css|js|html)$/.test(file)) continue;
  const text = readFileSync(file, 'utf8');
  for (const [, name] of text.matchAll(/var\(\s*(--[\w-]+)/g)) {
    refs++;
    if (!tokens.has(name) && !RUNTIME.has(name)) misses.push(`${relative(ROOT, file)}: ${name}`);
  }
}

if (misses.length) {
  console.error(`undefined tokens (${misses.length}):\n  ${[...new Set(misses)].join('\n  ')}`);
  process.exit(1);
}
console.log(`tokens ok · ${refs} references, ${tokens.size} tokens defined`);

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) yield* walk(full);
    else yield full;
  }
}
