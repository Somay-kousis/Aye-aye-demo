import { classify, domainOf } from './riskResolution.js';
import { detectSymbol } from './blastRadius.js';
import { depthFor, gateReadout } from './escalationLadder.js';
import { durationValues, fill } from './interpolation.js';
import { SCENARIOS, SKIPS, LEDGER_FIXTURE, PERSON, VERDICT_FOOTER } from './scenarios/index.js';

const TRAVERSAL = ['session', 'intake', 'parse', 'graph'];

// The only file that touches both the real side (classification, blast radius, depth,
// the diff) and the staged side (scenario strings). It turns a change into the paced
// event sequence the UI renders, and holds the small amount of state between beats.
export class Sequencer {
  constructor({ durations, broadcast, log = () => {} }) {
    this.d = durations;
    this.broadcast = broadcast;
    this.log = log;
    this.started = Date.now();
    this.chain = Promise.resolve();
    this.reset(false);
  }

  reset(announce = true) {
    this.run = (this.run || 0) + 1;
    this.ledger = [...LEDGER_FIXTURE];
    this.scenario = null;
    this.values = null;
    this.attempt = 0;
    this.awaiting = null;
    if (announce) this.emit('reset', {});
  }

  emit(type, payload) {
    const event = { type, t: Date.now() - this.started, ...payload };
    this.broadcast(event);
    this.log(event);
  }

  sleep(ms) {
    const run = this.run;
    return new Promise((resolve) => setTimeout(() => resolve(run === this.run), ms));
  }

  onChange(path, diff) {
    const classification = classify(path);
    if (!classification) {
      this.log({ type: 'ignored', path, reason: 'no rule matches this path' });
      return;
    }
    this.awaiting = null;
    this.chain = this.chain.then(() => this.traverse(path, diff, classification)).catch((err) => this.log({ type: 'error', message: err.message }));
    return this.chain;
  }

  async traverse(path, diff, { rule, stakes }) {
    const run = this.run;
    const detected = detectSymbol(path, diff);
    const dependents = detected?.dependents ?? [];
    const domain = domainOf(path);

    this.emit('change', { path, stakes, symbol: detected?.symbol ?? null, diff });
    if (!(await this.sleep(this.d['d-base']))) return;

    for (const id of TRAVERSAL) {
      this.emit('node', { id });
      if (!(await this.sleep(this.d['d-hold']))) return;
    }

    if (stakes === 'risk-bearing') {
      for (const [i, dep] of dependents.entries()) {
        this.emit('dependent', { index: i + 1, path: dep.path, label: dep.label });
        if (!(await this.sleep(this.d['d-hold']))) return;
      }
    }

    this.emit('node', { id: 'risk' });
    if (!(await this.sleep(this.d['d-decide']))) return;

    if (stakes === 'low-stakes') {
      this.emit('resolve', { id: 'risk', state: 'pass', readout: `${domain} · ${dependents.length} dependents` });
      if (!(await this.sleep(this.d['d-hold']))) return;
      this.emit('node', { id: 'ledger' });
      this.emit('resolve', { id: 'ledger', state: 'pass' });
      this.emit('skip', { lines: (SKIPS[rule] ?? SKIPS['services/notifications/**']).map((l) => fill(l, { path })) });
      this.ledger.unshift({ time: clock(), person: '—', target: path, verdict: 'skipped', score: '' });
      return;
    }

    const surface = detected?.surface;
    const readout = [domain, surface, `${dependents.length} dependents`].filter(Boolean).join(' · ');
    this.emit('resolve', { id: 'risk', state: 'pending', readout });
    if (!(await this.sleep(this.d['d-hold']))) return;

    this.emit('node', { id: 'gate' });
    if (!(await this.sleep(this.d['d-hold']))) return;
    this.emit('resolve', { id: 'gate', state: 'pending', readout: gateReadout(dependents.length), depth: depthFor(dependents.length) });
    if (!(await this.sleep(this.d['d-hold']))) return;

    const key = `${path}::${detected?.symbol}`;
    this.scenario = SCENARIOS[key];
    this.values = {
      ...(durationValues(diff) ?? {}),
      path,
      touches: dependents.map((d) => d.label).join(', '),
    };
    if (!this.scenario) {
      this.log({ type: 'warning', message: `no scenario for ${key}; the check cannot proceed past the gate` });
      this.emit('check', { lines: ['COMPREHENSION CHECK', path, `Assigned to: ${PERSON}`] });
      return;
    }

    this.emit('check', { lines: this.scenario.header.map((l) => fill(l, this.values)) });
    if (!(await this.sleep(this.d['d-hold']))) return;

    this.attempt = 0;
    if (run === this.run) await this.ask();
  }

  async ask() {
    const attempt = this.scenario.attempts[this.attempt];
    this.emit('node', { id: 'question' });
    if (!(await this.sleep(this.d['d-hold']))) return;
    this.emit('question', { attempt: this.attempt + 1, text: fill(attempt.question, this.values) });
    this.emit('node', { id: 'human' });
    this.awaiting = 'answer';
  }

  async onAnswer(transcript) {
    if (this.awaiting !== 'answer') return;
    this.awaiting = null;
    const attempt = this.scenario.attempts[this.attempt];

    this.emit('answer', { attempt: this.attempt + 1, transcript });
    this.emit('node', { id: 'judge' });
    if (!(await this.sleep(this.d['d-hold']))) return;

    for (const c of attempt.concepts) {
      this.emit('concept', {
        index: c.index,
        name: c.name,
        result: c.result,
        line: fill(c.line, this.values),
        emphasis: c.emphasis ? fill(c.emphasis, this.values) : null,
      });
      if (!(await this.sleep(this.d['d-concept']))) return;
    }

    this.emit('verdict', { attempt: this.attempt + 1, ...attempt.verdict, footer: VERDICT_FOOTER });

    if (attempt.verdict.passed) {
      this.awaiting = 'advance';
      return;
    }
    if (!(await this.sleep(this.d['d-hold']))) return;
    this.attempt++;
    await this.ask();
  }

  onAdvance() {
    if (this.awaiting !== 'advance') return;
    this.awaiting = null;
    const depth = this.scenario.attempts[0].concepts.length;
    this.ledger.unshift({
      time: clock(),
      person: PERSON,
      target: this.scenario.ledgerTarget,
      verdict: 'understood',
      score: `${depth}/${depth}`,
    });
    this.emit('node', { id: 'ledger' });
    this.emit('resolve', { id: 'ledger', state: 'pass' });
    this.emit('ledger', { rows: this.ledger });
  }
}

function clock() {
  return new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}
