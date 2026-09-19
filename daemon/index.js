import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readDurations } from './tokens.js';
import { Snapshot } from './snapshot.js';
import { startWatcher } from './watcher.js';
import { Sequencer } from './sequencer.js';
import { startStatic, startSocket } from './server.js';
import { replay } from './replay.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SAMPLE = join(ROOT, 'sample-repo');
const UI_PORT = 4316;
const WS_PORT = 4317;

const args = new Set(process.argv.slice(2));
const mode = args.has('--replay') ? 'replay' : 'watch';
const auto = args.has('--auto');

const durations = readDurations(join(ROOT, 'ui', 'tokens.css'));
const log = (event) => console.log(`${String(event.t ?? '').padStart(6)}  ${event.type.padEnd(10)} ${summary(event)}`);

const socket = startSocket(WS_PORT, {
  mode,
  onMessage(msg) {
    if (msg.type === 'answer') sequencer.onAnswer(msg.transcript ?? '');
    else if (msg.type === 'advance') sequencer.onAdvance();
    else if (msg.type === 'reset') {
      sequencer.reset();
      if (mode === 'watch') snapshot.reload();
    }
  },
});
startStatic(join(ROOT, 'ui'), UI_PORT);

const sequencer = new Sequencer({ durations, broadcast: socket.broadcast, log });
const snapshot = mode === 'watch' ? new Snapshot(SAMPLE) : null;

if (mode === 'watch') {
  startWatcher(SAMPLE, (path, content) => {
    const diff = snapshot.update(path, content);
    if (diff) sequencer.onChange(path, diff);
  });
  console.log(`watching sample-repo/ (${snapshot.files.size} files) · ws :${WS_PORT} · ui :${UI_PORT}`);
} else {
  console.log(`replay${auto ? ' --auto' : ''} · ws :${WS_PORT} · ui :${UI_PORT}`);
  replay(join(ROOT, 'fixtures', 'run.json'), sequencer, { auto, log });
}

function summary(e) {
  switch (e.type) {
    case 'change': return `${e.path} ${e.stakes} symbol=${e.symbol} -${e.diff.removed.length} +${e.diff.added.length}`;
    case 'node': return e.id;
    case 'dependent': return `${e.index} ${e.path} (${e.label})`;
    case 'resolve': return `${e.id} ${e.state}${e.readout ? `  "${e.readout}"` : ''}`;
    case 'skip':
    case 'check': return e.lines.join(' | ');
    case 'question': return `#${e.attempt} ${e.text}`;
    case 'answer': return `#${e.attempt} ${e.transcript}`;
    case 'concept': return `${e.index} ${e.result.padEnd(4)} ${e.name}: ${e.line}${e.emphasis ? ` ** ${e.emphasis}` : ''}`;
    case 'verdict': return `${e.headline}${e.sub ? ` / ${e.sub}` : ''}`;
    case 'ledger': return e.rows.map((r) => `[${r.time} ${r.person} ${r.target} ${r.verdict} ${r.score}]`).join(' ');
    default: return Object.entries(e).filter(([k]) => !['type', 't'].includes(k)).map(([k, v]) => `${k}=${v}`).join(' ');
  }
}
