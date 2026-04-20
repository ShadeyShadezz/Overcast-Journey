# OvercastJourney User Journeys

## Anonymous Sender Journey
1. Land on homepage → See hero drop zone + trust badges.
2. Drag/drop files → See file list, total size.
3. Click "Generate Transfer" → Get room code (copy), QR code.
4. Share code/QR with receiver.
5. Receiver joins → Connection status pulses → "Connected" green.
6. Transfer progress: per-file bars, speed, ETA.
7. Encryption lock green → Complete → "New transfer" CTA.

**Flow Diagram (text)**:
```
Homepage → Drop Files → Generate Room/QR → Share → Receiver Joins → Progress → Complete
```
(Room Share screen: File list, code/QR, waiting status)

## Anonymous Receiver Journey
1. Homepage → "Enter room code" or "Scan QR".
2. Input code/scan → See incoming files preview (names/sizes).
3. "Download" → Progress bars.
4. Complete → Files saved, summary.

**Flow Diagram**:
```
Homepage → Enter Code/Scan QR → Preview Files → Download → Progress → Complete
```
(Incoming preview, complete screens)

## Mobile User Journey
1. Sender generates QR → Mobile scans → Receiver flow.
2. Touch-optimized: swipe remove files, fullscreen camera.

## Error Journeys
- Invalid code → "Expired/invalid—generate new".
- Connection lost → "Reconnecting..." + retry.

See USER_STORIES.md, WIREFRAMES.md, Instructions.md for details.
