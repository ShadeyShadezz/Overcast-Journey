// Signaling server with static file serving for deployment
const express = require('express');
const http = require('http');
const path = require('path');
const WebSocket = require('ws');

const PORT = process.env.PORT || 8080;
const app = express();
app.use(express.json());

// Serve client build if available
const clientDist = path.join(__dirname, '..', 'client', 'dist');
try {
  app.use(express.static(clientDist));
  app.get('*', (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
} catch (e) {
  // ignore: client may not be built yet
}

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// rooms: roomCode -> {sender: ws, receiver: ws, createdAt: number}
const rooms = new Map();

function genRoomCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// HTTP endpoint to create a room server-side (ensures room exists before client connects)
app.post('/rooms', (req, res) => {
  const room = genRoomCode();
  rooms.set(room, { sender: null, receiver: null, createdAt: Date.now() });
  res.json({ room });
});

// Check room status
app.get('/rooms/:room', (req, res) => {
  const room = req.params.room;
  const entry = rooms.get(room);
  if (!entry) return res.status(404).json({ exists: false });
  res.json({ exists: true, hasSender: !!entry.sender, hasReceiver: !!entry.receiver, createdAt: entry.createdAt });
});

// Delete room (admin / cleanup)
app.delete('/rooms/:room', (req, res) => {
  const room = req.params.room;
  const ok = rooms.delete(room);
  res.json({ deleted: ok });
});

function send(ws, obj) {
  try { ws.send(JSON.stringify(obj)); } catch (e) { /* ignore */ }
}

wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    let msg;
    try { msg = JSON.parse(message); } catch (e) { return; }
    const { type, room, payload } = msg;
    if (type === 'create') {
      const entry = rooms.get(room);
      if (entry && entry.sender) {
        send(ws, { type: 'error', reason: 'Room already has a sender' });
        return;
      }
      if (entry) {
        entry.sender = ws;
      } else {
        rooms.set(room, { sender: ws, receiver: null, createdAt: Date.now() });
      }
      ws._role = 'sender';
      ws._room = room;
      send(ws, { type: 'created', room });
    } else if (type === 'join') {
      const entry = rooms.get(room);
      if (!entry) { send(ws, { type: 'error', reason: 'Room not found' }); return; }
      entry.receiver = ws;
      ws._role = 'receiver';
      ws._room = room;
      send(entry.sender, { type: 'peer-joined', room });
      send(ws, { type: 'joined', room });
    } else if (type === 'signal') {
      const entry = rooms.get(room);
      if (!entry) return;
      if (ws._role === 'sender' && entry.receiver) send(entry.receiver, { type: 'signal', payload });
      else if (ws._role === 'receiver' && entry.sender) send(entry.sender, { type: 'signal', payload });
    } else if (type === 'close') {
      const entry = rooms.get(room);
      if (entry) rooms.delete(room);
    }
  });

  ws.on('close', () => {
    const room = ws._room;
    if (!room) return;
    const entry = rooms.get(room);
    if (!entry) return;
    if (ws._role === 'sender' && entry.receiver) send(entry.receiver, { type: 'peer-left' });
    if (ws._role === 'receiver' && entry.sender) send(entry.sender, { type: 'peer-left' });
    rooms.delete(room);
  });
});

server.listen(PORT, () => console.log(`Server running on http://0.0.0.0:${PORT}`));
