import WebSocket from 'ws';

// Prints every daemon event with the daemon's own clock. Run in a second terminal.
const socket = new WebSocket('ws://localhost:4317');
socket.on('open', () => console.log('tail connected'));
socket.on('close', () => {
  console.log('daemon went away');
  process.exit(0);
});
socket.on('error', (err) => {
  console.error(`cannot reach the daemon on :4317 (${err.code ?? err.message}). Is npm run dev running?`);
  process.exit(1);
});
socket.on('message', (raw) => {
  const e = JSON.parse(raw);
  const { type, t, ...rest } = e;
  console.log(`${String(t).padStart(6)}  ${type.padEnd(10)} ${JSON.stringify(rest)}`);
});
