import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { Room } from './game.js';
import { TICK } from '../shared/constants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 2567;

const app = express();


app.get('/healthz', (_req, res) => res.send('ok'));
const dist = path.join(__dirname, '..', 'dist');
app.use(express.static(dist));
app.use((_req, res) => res.sendFile(path.join(dist, 'index.html')));

// ---- rooms over WebSockets ----
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
const rooms = new Map();

function newCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c;
  do { c = Array.from({ length: 5 }, () => A[Math.floor(Math.random() * A.length)]).join(''); } while (rooms.has(c));
  return c;
}

wss.on('connection', ws => {
  let room = null, player = null;
  ws.isAlive = true;
  ws.on('pong', () => (ws.isAlive = true));

  ws.on('message', raw => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    if (!player) {
      if (msg.t !== 'join') return;
      let code = String(msg.room || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      room = code && rooms.get(code);
      if (!room) {
        if (code && msg.mustExist) { ws.send(JSON.stringify({ t: 'error', error: `Room ${code} not found.` })); return; }
        code = code || newCode();
        room = new Room(code, c => rooms.delete(c));
        rooms.set(code, room);
      }
      if (room.full) { ws.send(JSON.stringify({ t: 'error', error: 'That tank is full.' })); room = null; return; }
      player = room.addPlayer(ws, msg.name, msg.kind);
      return;
    }
    room.handle(player, msg);
  });

  ws.on('close', () => { if (room && player) room.removePlayer(player.id); });
});

setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false; ws.ping();
  }
}, 15000);

let last = performance.now();
setInterval(() => {
  const now = performance.now();
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  for (const r of rooms.values()) r.update(dt);
}, 1000 / TICK);

server.listen(PORT, () => console.log(`Fish tank server on http://localhost:${PORT}`));
