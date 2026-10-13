# Client Frontend Notes (Stage 3 – feat/frontend)

## What Works

### 1. Scaffold & Environment
- **`package.json`**: React 18, Vite, React Router DOM v6, Axios, and `qrcode.react`.
- **Scripts**: `"dev": "vite --host"`, `"build": "vite build"`, `"preview": "vite preview"`.
- **`client/.env.example`**: Configured per CONTRACTS.md Section 1 (`VITE_API_URL`, `VITE_WS_URL`, `VITE_STUN_URL`, `VITE_TURN_URL`, etc.).

### 2. Centralized Peer Provider (`client/src/api/peerProvider.js`)
- Exports `createPeer({ code, deviceName, wsUrl, iceServers })`.
- Stage 3 uses `mockPeer.js` implementing the exact Section 6 interface (`status`, `peer`, `incoming`, `progress`, `file-complete`, `error`, `sendFiles`, `cancel`, `close`).
- **Single-line swap in Stage 4**: In Stage 4, `peerProvider.js` simply changes its import to re-export `createPeer` from `../lib/transfer/index.js`.

### 3. API Client Layer (`client/src/api/`)
- **`client.js`**: Axios client with `Authorization: Bearer <jwt>` interceptor and error formatting (`{ error: "message" }`).
- **`auth.js`**: `register`, `login`, `getMe`.
- **`sessions.js`**: `createSession`, `getSessions`, `getSession`, `updateSession`, `deleteSession`.
- **`transfers.js`**: `recordTransfer`, `getTransfers` (with query filtering, search, pagination), `deleteTransfer`, `clearAllTransfers`.
- **`devices.js`**: `registerDevice`, `getDevices`, `updateDevice` (rename, trust), `deleteDevice`.

### 4. UI Pages & Routes (`client/src/pages/`, per CONTRACTS.md Section 7)
- **`/` (LandingPage)**:
  - Create session button (requests 6-character code from backend, redirects to `/session/:code`).
  - Join session form (inputs 6-character code, normalizes uppercase, redirects to `/session/:code`).
  - Device name configurator saved to `localStorage`.
- **`/session/:code` (SessionPage)**:
  - Header displaying 6-char session code and QR Code modal trigger.
  - Connection status badge (`connecting`, `waiting-peer`, `connected`, `disconnected`, `failed`).
  - Paired peer device name indicator.
  - DropZone supporting drag-and-drop and manual file selection.
  - Real-time TransferQueue displaying transfer progress, percentage, speed in Bps, ETA in seconds, SHA-256 hash, and download button for received files.
  - Automatic history logging: calls `POST /api/transfers` on every `file-complete` or error if authenticated.
  - Session extension (+15 mins) and close session controls.
- **`/history` (HistoryPage)**:
  - Lists transfers with search (`q`), status filter (`completed`, `failed`, `cancelled`), date range (`from`/`to`).
  - Single transfer deletion and bulk "Clear All History" button.
- **`/devices` (DevicesPage)**:
  - Lists registered devices, allows adding new device, renaming inline, toggling trusted status, and deleting.
- **`/login` & `/register`**:
  - Full JWT authentication flows with error display and redirection.

### 5. Components (`client/src/components/`)
- `Navbar.jsx`: Brand, navigation links, and dynamic user profile / authentication controls.
- `StatusBadge.jsx`: Color-coded connection status badge.
- `DropZone.jsx`: Animated file dropzone with input picker.
- `TransferQueue.jsx`: Active and completed transfer tracker with progress bars and download button.
- `QrCodeModal.jsx`: Modal rendering QR code encoding `${window.location.origin}/session/${code}` with one-click copy.

## What's Missing / Next Steps (Stage 4 Integration)

- `client/src/lib/transfer/`: Left untouched on this branch. In Stage 4, `feat/transfer` merges with `feat/frontend`, and `peerProvider.js` connects directly to the real transfer engine.

## How to Run

1. Navigate to the client directory:
   ```bash
   cd client
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy environment configuration:
   ```bash
   cp .env.example .env
   ```
4. Start development server:
   ```bash
   npm run dev
   ```
