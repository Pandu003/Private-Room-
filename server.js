const express = require('express'), http = require('http');
const { WebSocketServer } = require('ws');
const app = express();
app.use(express.static('public'));
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const rooms = new Map(); // roomId -> Set of sockets (max 2 = private)

wss.on('connection', ws => {
  ws.on('message', data => {
    let m; try { m = JSON.parse(data); } catch { return; }
    if (m.type === 'join') {
      const id = String(m.room || '').slice(0, 64);
      const set = rooms.get(id) || new Set();
      if (set.size >= 2) return ws.send(JSON.stringify({ type: 'full' }));
      set.add(ws); rooms.set(id, set); ws.room = id;
      set.forEach(p => p !== ws && p.send(JSON.stringify({ type: 'peer-joined' })));
      return ws.send(JSON.stringify({ type: 'joined', peers: set.size }));
    }
    const set = rooms.get(ws.room);
    if (set) set.forEach(p => p !== ws && p.readyState === 1 && p.send(data.toString()));
  });
  ws.on('close', () => {
    const set = rooms.get(ws.room); if (!set) return;
    set.delete(ws);
    set.forEach(p => p.send(JSON.stringify({ type: 'peer-left' })));
    if (!set.size) rooms.delete(ws.room);
  });
});
server.listen(process.env.PORT || 3000, () => console.log('Running on http://localhost:3000'));
