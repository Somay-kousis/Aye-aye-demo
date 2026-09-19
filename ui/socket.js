// One connection to the daemon. Reconnects on its own, hands every event to whoever
// registered for its type, and forwards keypresses so the daemon is the only sequencer.

const RETRY_MIN = 250;
const RETRY_MAX = 4000;

export function createSocket(url) {
  const handlers = new Map();
  let ws = null;
  let retry = RETRY_MIN;

  function on(type, fn) {
    if (!handlers.has(type)) handlers.set(type, new Set());
    handlers.get(type).add(fn);
    return () => handlers.get(type).delete(fn);
  }

  function dispatch(event) {
    for (const fn of handlers.get(event.type) ?? []) fn(event);
    for (const fn of handlers.get('*') ?? []) fn(event);
  }

  function send(msg) {
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }

  function open() {
    ws = new WebSocket(url);
    ws.addEventListener('open', () => {
      retry = RETRY_MIN;
    });
    ws.addEventListener('message', ({ data }) => {
      let event;
      try {
        event = JSON.parse(data);
      } catch {
        return;
      }
      if (event && typeof event.type === 'string') dispatch(event);
    });
    ws.addEventListener('close', () => {
      ws = null;
      setTimeout(open, retry);
      retry = Math.min(retry * 2, RETRY_MAX);
    });
    ws.addEventListener('error', () => ws?.close());
  }

  // Keypresses go to the daemon as-is and to local handlers under 'key'. Modifier chords
  // are left alone so devtools shortcuts keep working during a take.
  window.addEventListener('keydown', (e) => {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    const event = { type: 'key', key: e.key, code: e.code };
    send(event);
    dispatch(event);
  });

  open();
  return { on, send };
}
