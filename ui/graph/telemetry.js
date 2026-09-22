// STAGED. Telemetry captions under four nodes: what each stage reports having spent.
// Values arrive on `telemetry` events from the daemon's table; the UI only formats them.
// One line of time and tokens; the model-backed nodes get the model on a second line so the
// caption never runs into the next column.
export function createTelemetry(container, nodes, t) {
  const captions = new Map();

  function format(ms, tokens) {
    const s = ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
    const k = tokens >= 1000 ? `${(tokens / 1000).toFixed(1)}k` : String(tokens);
    return `${s} · ${k} tok`;
  }

  function show({ id, ms, tokens, model }) {
    const node = nodes.get(id);
    if (!node) return;
    let el = captions.get(id);
    if (!el) {
      el = document.createElement('div');
      el.className = 'telemetry';
      el.dataset.for = id;
      el.style.left = `${node.rect.x + t.pad}px`;
      el.style.top = `${node.rect.y + node.rect.h}px`;
      container.appendChild(el);
      captions.set(id, el);
    }
    el.textContent = '';
    const line = document.createElement('span');
    line.textContent = format(ms, tokens);
    el.appendChild(line);
    if (model) {
      const m = document.createElement('span');
      m.textContent = model;
      el.appendChild(m);
    }
    void container.offsetWidth;
    el.classList.add('shown');
  }

  function clear() {
    for (const el of captions.values()) el.classList.remove('shown');
  }

  function snapshot() {
    return Object.fromEntries([...captions].filter(([, el]) => el.classList.contains('shown')).map(([id, el]) => [id, el.textContent]));
  }

  return { show, clear, snapshot };
}
