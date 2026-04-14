**OvercastJourney — Implementation Summary**

Overview
- Project scaffolded with a minimal Node signaling server (`server/`) and a React client (`client/`).
- Focus: WebRTC connectivity (signaling + datachannel file transfer). UI follows the designs in `DOC MDS/Instructions.md` (dark theme, orange accent). Design fidelity prioritized later; connectivity is primary.

What I added
- `server/`:
  - `index.js`: WebSocket-based signaling server using `ws`. Manages simple rooms identified by 6-digit codes and forwards signaling payloads (SDP/ICE) between peers.
  - `package.json` and `README.md` for starting the server.
- `client/` (Vite + React):
  - `src/App.jsx`: Main UI with drag & drop, file list, "Generate Transfer" (sender) and "Enter room code" (receiver) flows. Implements signaling handshake (offer/answer) via WebSocket and sends files over a WebRTC data channel in chunked streams.
  - `src/webrtc.js`: small helpers for creating sender/receiver RTCPeerConnection + datachannel setup.
  - `src/styles.css`: dark-mode styling using project color tokens.
  - `package.json`, `index.html`, and `README.md`.
  - `IMPLEMENTATION.md`: this documentation file explaining structure and how the code works.

Recent additions
- Server now serves built client (`client/dist`) if present and runs WebSocket signaling on the same port. This simplifies deploying a single-process app behind a reverse proxy.
- Client now generates a shareable link and QR code for mobile pairing. QR generation uses the `qrcode` library.
- ICE servers (STUN/TURN) can be configured via the `VITE_ICE_SERVERS` environment variable passed at build time for production reliability.

Deployment notes
- Build the client and copy `client/dist` to the server host, or build on the host.
  - Client build:
    ```bash
    cd client
    npm install
    npm run build
    ```
  - Server:
    ```bash
    cd server
    npm install
    npm start
    ```
- Optionally set `VITE_ICE_SERVERS` when building the client to include TURN servers, for example:
  ```bash
  VITE_ICE_SERVERS='[{"urls":"stun:stun.l.google.com:19302"},{"urls":"turn:turn.example.com","username":"user","credential":"pass"}]' npm run build
  ```

### Running with Docker (detached)

For a local, detached containerized run (server + client served by the server image):

```bash
docker-compose build --pull --no-cache
docker-compose up -d
```

Check logs with:

```bash
docker-compose logs -f app
```

To stop and remove containers:

```bash
docker-compose down
```

### Deploying the client to Vercel (static)

This repository includes a `vercel.json` that instructs Vercel to build the `client` package and serve `client/dist` as a static site. To deploy the client only:

1. Install the Vercel CLI: `npm i -g vercel`.
2. From the repo root run: `vercel --prod` and follow prompts (set the root project to `client` when asked).

Note: Vercel will host the static client. The signaling server must be hosted separately (Docker, Render, DigitalOcean, etc.) and its URL set in `VITE_SIGNALING_URL`.

### coturn / TURN service (optional)

The included `docker-compose.yml` contains an example `coturn` service but it is placed in its own compose profile so it does not start by default. This keeps `docker compose up` lightweight — the TURN relay can be started only when you need it.

- Start only the app (fast):

```bash
docker compose up -d
```

- Start the app plus coturn (when you've configured TURN users/credentials):

```bash
docker compose --profile coturn up -d
```

Notes:
- The coturn service can be heavy because of the large UDP port range (`49152-65535`) commonly used for relayed traffic. In `docker-compose.yml` that UDP range is commented out by default — enable it only if you plan to use coturn as a full relay.
- Making coturn optional prevents the `overcastjourney-coturn-1` container from being created/started unless explicitly requested, improving default startup time and resource usage.
These changes prioritize making the app public and reachable by another user while improving NAT traversal configurability and mobile pairing UX.

TURN example and explanation
 - Why TURN: STUN only discovers public reflexive addresses and works when direct peer-to-peer connectivity is possible. When both peers are behind symmetric NATs or restrictive firewalls, a TURN server relays media/data and ensures connectivity. TURN introduces bandwidth and operational cost, so use only when necessary.
 - Example (coturn):
  1. Install coturn on a server with a public IP and open ports `3478` (UDP/TCP) and `49152:65535` (UDP) for relayed traffic.
  2. Configure `/etc/turnserver.conf` with a listening port, realm, and users (or use long-term credentials):
    ```text
    listening-port=3478
    fingerprint
    lt-cred-mech
    realm=overcastjourney
    user=username:password
    total-quota=100
    bps-capacity=0
    stale-nonce
    no-stdout-log
    ```
  3. Restart coturn and verify it's reachable. In production, secure it and restrict access.
  4. Use the TURN credentials when building the client:
    ```bash
    VITE_ICE_SERVERS='[{"urls":"stun:stun.l.google.com:19302"},{"urls":"turn:YOUR_TURN_HOST:3478","username":"username","credential":"password"}]' npm run build
    ```
  5. The built client will include the TURN server in `RTCPeerConnection` config and attempt relay when direct connectivity fails.

Quick testing notes
 - Run the server and open two browsers (or one desktop + one mobile). Use the generated link/QR to connect the receiver.
 - Watch the sender `sendProgress` and receiver `recvProgress` panels for per-file percent and speed. These are calculated from bytes sent/received over short intervals; speeds are approximate.


How it works (brief)
- Signaling server (`server/index.js`):
  - Sender sends `{type:'create', room}` to create a room.
  - Receiver sends `{type:'join', room}` to join.
  - Either peer sends `{type:'signal', room, payload}` to forward SDP/ICE messages; server forwards to the other peer in the room.
  - Server notifies peers with `peer-joined`, `created`, `joined`, and `peer-left` messages.

- Client (`client/src/App.jsx`):
  - Sender flow: generate a 6-digit room code, connect to signaling server, wait for `peer-joined`, create RTCPeerConnection and a data channel, create and send offer. When data channel opens, stream file data in chunks (stream API -> datachannel). Metadata messages (`{type:'meta', name, size}`) and `{type:'done'}` delimit files.
  - Receiver flow: join room, receive offer (via `signal`), set remote desc, create answer, and when the remote datachannel opens reconstruct received ArrayBuffer chunks into a Blob and trigger download.

Files and key locations
  - Server exposes HTTP endpoints to create and query rooms (`POST /rooms`, `GET /rooms/:room`, `DELETE /rooms/:room`). This makes room creation a server-side action if you prefer to pre-generate or control rooms centrally.
  - Client now supports server-side room creation from the UI via `POST /rooms` and a Lobby view. The sender can create a room on the server, land in a Lobby (host area + file list), then start the transfer from the Lobby. See `client/src/App.jsx` for `createRoomServer()` and lobby rendering.

How to run locally
1. Server
   - cd server
   - npm install
   - npm start
   - Server listens by default on `ws://localhost:8080`.
2. Client
   - cd client
   - npm install
   - Set environment if signaling server is remote: `VITE_SIGNALING_URL=ws://yourserver:8080` (optional)
   - npm run dev

Manual test flow
- Open one browser (desktop) -> add files and click "Generate Transfer" -> note the room code printed in UI.
- Open a second browser (or device) -> enter the room code and click Join -> transfer will start when the peers connect.

Notes & next steps
- This initial implementation focuses on connectivity and a minimal UI. Improvements to add next:
  - Progress bars and transfer speed indicators
  - Pause/resume and cancel
  - QR code generation and short URL creation
  - TURN server support for NAT traversal (essential for real-world transfers)
  - More robust error handling and reconnection logic
  - CloudVault integration hooks (auth + pickers)

Current version notes & QR behavior
----------------------------------
- Version: current workspace state (local build on April 9, 2026). This README documents the code and behavior produced by the scaffolding and patches applied so far (signaling server, client UI, QR/share, lobby, progress UI, TURN guidance).
- QR generation: the client uses the `qrcode` npm package to render a PNG data-URL for a shareable URL that includes the room code as a query parameter (for example `https://yourhost/?room=123456`). Implementation points:
  - When a sender creates or requests a room (either locally or via `POST /rooms`), the client assembles a share link using `window.location.origin` and the room code: `` `${window.location.origin}?room=${room}` ``.
  - The client calls `QRCode.toDataURL(link)` to produce a base64 PNG data-URL and stores it in state (`qrDataUrl`). That data URL is rendered as an `<img>` in the Lobby and Sender UI so a mobile device can scan it.
  - When a receiver opens the shared link (or scans the QR) the app reads the `?room=` query param and auto-attempts to join that room (`startReceiver(room)`), improving mobile-to-desktop flow.
  - Note: the QR encodes the full URL. If the server is running locally (`localhost:8080`) the QR will point to `http://localhost:8080/?room=...` which is only reachable from the same machine unless you expose the service publicly.

Localhost limitation and making rooms public
------------------------------------------
- Current build: the signaling server and static site are configured to run on `localhost`/`0.0.0.0:8080` by default. That means generated room links and QR codes point to `localhost` which is not accessible from other devices across the internet.
- To make rooms publicly joinable you must host the server on a publicly reachable address (a VM, VPS, or cloud host) and ensure:
  1. The server is reachable over the network with a public hostname or IP and `http(s)` and `ws(s)` ports allowed through firewalls and NAT.
 2. Use a reverse proxy (e.g., Nginx) or configure TLS directly so you serve the site over HTTPS and WSS (secure WebSocket). Browsers often block getUserMedia/secure APIs on non-HTTPS origins and may restrict WebRTC behavior on insecure origins.
 3. (Optional but recommended) Configure a TURN server (coturn or managed provider) and pass its ICE credentials to the client via `VITE_ICE_SERVERS` at build time. This increases chance of successful connection across NATs and for remote peers.

- Quick public-deploy checklist:
  - Provision a host with a public IP (DigitalOcean, AWS, GCP, etc.).
  - Build the client on the host (or upload `client/dist`) and start the Node server (`server/index.js`) so it serves the static files and signaling endpoint.
  - Configure TLS (Let's Encrypt) and run behind Nginx to proxy HTTP->HTTPS and WebSocket upgrade traffic to the Node process.
  - Optionally run a TURN server (coturn) and provide its credentials to the client build via `VITE_ICE_SERVERS`.

Once hosted publicly the generated QR and share links will point to the public domain, allowing other users to scan/join and perform transfers.

Docker & CI/CD
---------------
This repo includes a Dockerfile and a `docker-compose.yml` to run OvercastJourney in a containerized environment, plus a GitHub Actions workflow that builds the client, builds a Docker image, and pushes it to GitHub Container Registry (`ghcr.io`).

Files added
- `Dockerfile` — multi-stage build: builds the Vite client and produces a runtime image that contains `server/` and the built `client/dist` assets.
- `docker-compose.yml` — quick local deployment of the app and an optional `coturn` service for TURN relay.
- `.dockerignore` — excludes local artifacts from Docker context.
- `.github/workflows/ci.yml` — CI which builds the client and pushes a Docker image to `ghcr.io/${{ github.repository }}:latest` on pushes to `main`.

Quick Docker usage
1. Build locally:
  ```bash
  docker build -t overcastjourney:local .
  ```
2. Run with docker:
  ```bash
  docker run -p 8080:8080 overcastjourney:local
  ```
3. Or use docker-compose (also starts optional coturn):
  ```bash
  docker-compose up --build
  ```

CI notes
- The workflow uses the `GITHUB_TOKEN` to push to GitHub Container Registry. You can change the workflow to push to Docker Hub or another registry by updating the login and `tags` values and providing appropriate secrets.

Exposing to the public
- To make rooms accessible by other users, run the Docker container on a host with a public IP or behind a reverse proxy (Nginx) with TLS (Let's Encrypt). Update DNS to point to the host and ensure ports `80/443` (HTTP/HTTPS) and `3478`/`49152-65535` (for TURN UDP) are open if using coturn.


Git ignore and `node_modules` cleanup
------------------------------------
- The repository `.gitignore` now explicitly ignores Node.js dependency folders at the repository root and in subfolders. Patterns added include:
  - `node_modules/`
  - `**/node_modules/`
  - `client/node_modules/`
  - `server/node_modules/`

- Why: both `client/` and `server/` contain their own `node_modules` when you run `npm install` locally. Committing these folders bloats the repo and causes merge noise; they should be installed per-machine using `npm install`.

- If `node_modules` has already been committed to the repository, remove them from Git tracking with these commands (run from the repo root):
  ```bash
  # remove any tracked node_modules from the index
  git rm -r --cached node_modules
  git rm -r --cached client/node_modules
  git rm -r --cached server/node_modules
  # commit the removal
  git commit -m "chore: remove node_modules from repository"
  ```

- After cleaning the repository, each developer or CI should install packages locally in the two projects:
  ```bash
  # Using npm workspaces (recommended)
  npm install

  # Or install per-package
  cd server && npm install
  cd ../client && npm install
  ```

- If you use CI/CD, ensure the pipeline runs `npm ci` or `npm install` in both `server/` and `client/` before building.

Workspaces
----------
- This repository now includes a root `package.json` configured with npm workspaces. Workspaces let you install dependencies once at the repo root and run package scripts from the root. Example commands:

  - Install all dependencies (hoisted to root where possible):
    ```bash
    npm install
    ```

  - Start client dev server from the root:
    ```bash
    npm run dev:client
    ```

  - Start server from the root:
    ```bash
    npm run dev:server
    ```

  - Build the client from the root:
    ```bash
    npm run build:client
    ```

Using workspaces reduces duplicated installs and centralizes dependency management. If you prefer not to use workspaces, you can still `cd` into each folder and run `npm install` there.

Lockfile guidance
-----------------
- When using npm workspaces, prefer a single root `package-lock.json` to describe the exact dependency tree for the entire monorepo. Multiple lockfiles (one per package) can cause conflicting dependency resolutions and make reproducible installs harder.
- In this workspace we've removed `client/package-lock.json` and `server/package-lock.json` and keep the root `package-lock.json` generated at the repo root after running `npm install` once. If your CI or developers previously generated per-package lockfiles, delete them and regenerate the root lockfile by running `npm install` at the repo root.

If you want me to, I can also commit the updated `.gitignore` and remove any tracked lockfiles from git history, or recreate a fresh root `package-lock.json` by running a clean install. Which would you like? 




