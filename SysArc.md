OvercastJourney signaling server

Usage:

1. Install dependencies: `npm install`
2. Start server: `npm start`

The server provides a minimal WebSocket-based signaling layer. Clients exchange JSON messages:
- `{type: 'create', room}` sender creates a room
- `{type: 'join', room}` receiver joins
- `{type: 'signal', room, payload}` forwards SDP/ICE messages between peers

HTTP API
- `POST /rooms` -> creates and reserves a new room code. Returns `{ room: '123456' }`.
- `GET /rooms/:room` -> returns room status `{ exists, hasSender, hasReceiver, createdAt }` or 404 if not found.
- `DELETE /rooms/:room` -> deletes the room (returns `{ deleted: true }` on success).

This allows room creation to be performed server-side (e.g., for pre-generation, admin control, or integration with short-link services) rather than relying only on client WebSocket `create` messages.
