// Minimal WebRTC helper: create peer connection and handle signaling via WebSocket
// Read TURN/STUN configuration from build-time env variable `VITE_ICE_SERVERS`
// Example: VITE_ICE_SERVERS='[{"urls":"stun:stun.l.google.com:19302"},{"urls":"turn:turn.example.com","username":"user","credential":"pass"}]'
let iceServers = [{ urls: 'stun:stun.l.google.com:19302' }];
try {
  const raw = import.meta.env.VITE_ICE_SERVERS;
  if (raw) {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length) iceServers = parsed;
  }
} catch (e) {
  // ignore parse errors and fall back to default STUN
}

export const STUN_CONFIG = { iceServers };

export function createSender(pcOptions = {}) {
  const pc = new RTCPeerConnection(STUN_CONFIG);
  const dc = pc.createDataChannel('file');
  dc.binaryType = 'arraybuffer';
  return { pc, dc };
}

export function createReceiver() {
  const pc = new RTCPeerConnection(STUN_CONFIG);
  let dc = null;
  pc.ondatachannel = (e) => { dc = e.channel; dc.binaryType = 'arraybuffer'; };
  return { pc, getChannel: () => dc };
}
