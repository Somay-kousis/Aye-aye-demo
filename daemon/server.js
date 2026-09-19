import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { WebSocketServer } from 'ws';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
};

// Static files for the UI. No caching so a token edit shows on the next reload.
export function startStatic(root, port) {
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const rel = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
    let file = join(root, rel === '/' || rel === '\\' ? 'index.html' : rel);
    if (!file.startsWith(root) || !existsSync(file) || statSync(file).isDirectory()) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end(rel === '/' ? 'Aye-aye demo daemon is up. The UI arrives in phase 2.\n' : 'not found\n');
      return;
    }
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    createReadStream(file).pipe(res);
  });
  server.listen(port);
  return server;
}

// One WebSocket per open UI (or tail). Every event goes to every client; the daemon is
// the single sequencer, so the UI only ever reacts.
export function startSocket(port, { mode, onMessage }) {
  const wss = new WebSocketServer({ port });
  wss.on('connection', (socket) => {
    socket.send(JSON.stringify({ type: 'hello', t: 0, mode }));
    socket.on('message', (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw);
      } catch {
        return;
      }
      onMessage(msg);
    });
  });
  return {
    broadcast(event) {
      const data = JSON.stringify(event);
      for (const client of wss.clients) if (client.readyState === 1) client.send(data);
    },
    close: () => wss.close(),
  };
}
