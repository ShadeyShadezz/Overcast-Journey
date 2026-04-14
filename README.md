# OvercastJourney — Private P2P File Sharing

**Tagline: Your files, directly to anyone. No servers, no limits. End-to-end encrypted.**

## Overview & Problem Statement

People often rely on cloud storage services and messaging apps to share files, which require uploads, storage limits, and third-party servers. This makes file sharing slower, less private, and sometimes restricted by file size limits. 

**OvercastJourney (OCJ)** solves this with direct peer-to-peer (P2P) file transfers using WebRTC. Files never touch servers—just pure P2P. Unlimited size, full privacy, faster speeds. Fully anonymous—no accounts required.

![Home Menu](X X - DOC MDS/Home Menu.png)

## Who Will Use This App?

**Main Users:**
- **Anonymous Sender**: Any user sharing files (drag/drop, generate link/QR).
- **Anonymous Receiver**: Any user receiving files (enter code/scan QR).
- **Mobile User**: QR-based transfers.

**Key Questions Answered:**
- **Who logs in?** Most don't (anonymous primary). 
- **Who adds files?** Sender uploads/selects.
- **Who checks progress?** Both sender/receiver in real-time.
- **AI features?** Not applicable—focus on secure P2P transfer.

## Features

### Must-Have (Core for MVP)
These enable basic P2P transfers.

| Feature | Description | Purpose | Goal Added |
|---------|-------------|---------|------------|
| File Upload / Drag & Drop | Intuitive zone for files/folders | Easy file selection | Frictionless onboarding, supports large/unlimited files |
| P2P Connection (WebRTC) | Direct device-to-device data channels | Bypass servers | Privacy (no storage), speed, no limits |
| Room Code Generation | 6-8 digit shareable code | Sender creates unique room | Simple copy-paste sharing |
| QR Code Generator | Scannable QR for codes | Mobile/web bridging | Instant mobile-desktop transfers |
| Transfer Progress Indicators | Real-time bars, speed, ETA | Monitor each file | Transparency, user control (pause/cancel) |
| Encryption Indicator | Green lock/status | Visual E2E encryption confirmation | Builds trust/security assurance |
| Receiver File Preview & Download | List incoming files, choose save location | Preview before accept | Controlled receiving, prevents surprises |

![Room Share](X X - DOC MDS/Room Share.png) ![Incoming File](X X - DOC MDS/Incoming File.png)

### Nice-to-Have (Enhancements)
Polish for production.

| Feature | Description | Purpose | Goal Added |
|---------|-------------|---------|------------|
| Speed Graph Visualization | Real-time transfer speed chart | Visual analytics | Engaging UX, performance insights |
| Connection Strength Indicator | WiFi bars/signal | NAT/peer health | Proactive troubleshooting |
| Resume Interrupted Transfers | Pick up from pause/disconnect | Reliability | Robustness for real-world networks |
| Mobile Gesture Controls | Swipe to remove, touch-optimized | Mobile UX | Seamless cross-device |
| Transfer History | Past rooms/files | Repeat usage | Convenience, no re-setup |
| Transfer Analytics | Basic speed/progress summary | Post-transfer review | Data for improvements |

![File Progression](X X - DOC MDS/File Progression.png) ![Transfer Complete](X X - DOC MDS/Transfer Complete.png)

## Ultimate Goal (Design Vision)

Standalone privacy-focused P2P tool with premium polish. Vibe: Clean, minimal, trustworthy (navy/orange, dark mode). 

**Key Pages/Flows (from designs):**
- **Landing**: Hero drop zone, trust badges, 3-step graphic.
- **Sender**: File list, generate code/QR, progress (pulse/waiting).
- **Receiver**: Code/QR input, preview, download.
- **Progress**: Per-file bars, speed/strength, encryption lock.
- **Complete**: Summary, new transfer CTA.

Mobile-responsive, smooth animations, frosted modals. Build transfer core first (90% focus),

**Component Priorities**: Drop zones, progress bars, QR, modals, toasts.

## Docker Setup (Starter Draft)
Multi-stage Dockerfile for prod client+server. docker-compose with profiles.

```bash
# Local dev
npm install && npm start

# Docker full stack (app + TURN + Postgres)
docker compose up -d app postgres --build
docker compose --profile coturn up -d  # NAT traversal

# Prisma (after deps): npx prisma db push / migrate
# DATABASE_URL=postgresql://overcast:journey123@localhost:5432/overcastjourney
```

See docker-compose.yml, Dockerfile.

## Database Plan (Prisma)
[prisma/schema.prisma](prisma/schema.prisma): Anon room uniqueness (codes, metadata hashes). No accounts. Enables signaling DB, future blockchain provenance (track file origins via hash chains).

## Quick Start (Prototype)

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start signaling server:**
   ```bash
   npm start
   ```

3. **Open in browser(s):** http://localhost:3000

   - Tab 1: Select files → \"Generate Transfer\" → Share room code/QR.
   - Tab 2: Enter code or scan QR → Preview/download.

## Prototype Notes
- Server only for signaling (SDP/ICE)—no file storage.
- Production: Add TURN (e.g., coturn) for NAT, chunk checksums, pause/resume, UI polish.

## Roadmap
1. Must-Have features + responsive UI.
2. Prisma integration (room signaling DB), Nice-to-Haves.
3. Mobile gestures, public deploy.
4. Blockchain (data provenance—track to original creator via transfers).
5. Prod: Vercel/Docker, TURN, robustness.

Refer to [IMPLEMENTATION.md](IMPLEMENTATION.md) for tech details.

---

⭐ Star on GitHub | 🐛 [Issues](https://github.com/user/repo/issues)

