import { readFileSync } from 'node:fs';
import { lineDiff } from './snapshot.js';

// Plays fixtures/run.json through the same sequencer the watcher feeds, without touching
// files. Steps: `change` (before/after text of one file), `answer`, `advance`. Without
// --auto, answers and advances are left to the presenter, so the take still has a real
// voice in it; with --auto the fixture supplies them and the run is hands-off. Nothing is
// emitted until `started` resolves (Space in the UI), so the first beat is on screen.
export async function replay(fixturePath, sequencer, { auto, log, started }) {
  const steps = JSON.parse(readFileSync(fixturePath, 'utf8'));
  await started;
  log({ type: 'replay', step: 'start' });
  for (const step of steps) {
    if (step.type === 'change') {
      log({ type: 'replay', step: `change ${step.path}` });
      await sequencer.onChange(step.path, lineDiff(step.before.join('\n'), step.after.join('\n')));
      if (step.holdAfter) await sequencer.sleep(step.holdAfter);
    } else if (!auto) {
      await waitFor(sequencer, step.type === 'answer' ? 'answer' : 'advance');
      await waitFor(sequencer, null);
    } else if (step.type === 'answer') {
      await waitFor(sequencer, 'answer');
      log({ type: 'replay', step: `answer ${step.attempt}` });
      await sequencer.onAnswer(step.transcript);
    } else if (step.type === 'advance') {
      await waitFor(sequencer, 'advance');
      if (step.holdBefore) await sequencer.sleep(step.holdBefore);
      log({ type: 'replay', step: 'advance' });
      sequencer.onAdvance();
    }
  }
  log({ type: 'replay', step: 'done' });
}

function waitFor(sequencer, state) {
  return new Promise((resolve) => {
    const tick = () => (sequencer.awaiting === state ? resolve() : setTimeout(tick, 50));
    tick();
  });
}
