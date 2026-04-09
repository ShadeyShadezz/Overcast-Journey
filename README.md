# OvercastJourney — P2P file transfer prototype

Run the minimal signaling server and open the client in your browser.

Install dependencies:

```bash
npm install
```

Start server:

```bash
npm start
```

Open http://localhost:3000 in two devices or browser tabs. On one tab, select files and click "Generate Transfer". The other tab can open the link with ?room=XXXXXX or scan the QR code.

Notes:
- This prototype uses WebRTC data channels for P2P transfer. The server only handles signaling (SDP/ICE). No files are stored on the server.
- For production, add TURN (coturn) for NAT traversal and improve chunk checksums, progress UI, pause/resume, and robustness.
# Overcast-Journey
