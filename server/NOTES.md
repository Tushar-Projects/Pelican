# Server Module Notes (Stage 1 – feat/backend)

## What Works

### 1. Database Models (`server/src/models/`)
- **`User.js`**: Stores user credentials with bcrypt hash. Includes `name`, `email` (unique, lowercase), `passwordHash`, and `createdAt`.
- **`Device.js`**: Tracks registered devices per user with `userId`, `name`, `deviceKey`, `trusted` flag, and `lastSeenAt`.
- **`Session.js`**: 
  - Generates 6-character uppercase codes excluding ambiguous characters `0, O, 1, I` (`23456789ABCDEFGHJKLMNPQRSTUVWXYZ`).
  - Supports optional `hostUserId` (allowing guest session creation).
  - Enforces status enum: `['waiting', 'paired', 'closed', 'expired']`.
  - MongoDB TTL index on `expiresAt` (`expireAfterSeconds: 0`) for automatic expiration cleanup.
  - Implements static helper `Session.findActiveByCode(code)` returning active session if status is `waiting` or `paired` and `expiresAt > now`, else `null`.
- **`Transfer.js`**: Stores transfer history records with `userId`, `sessionCode`, `deviceName`, `fileName`, `fileSize`, `direction` (`sent`|`received`), `status` (`completed`|`failed`|`cancelled`), `avgSpeedBps`, `durationMs`, `sha256`, and `createdAt`.

### 2. Middleware (`server/src/middleware/auth.js`)
- **`requireAuth`**: Extracts Bearer token from `Authorization` header, verifies with `JWT_SECRET`, queries database for user, and sets `req.user`. Standard error response: `{ "error": "message" }` with 401 status.
- **`optionalAuth`**: Gracefully extracts user if valid token exists; leaves `req.user = null` for guest requests without error.

### 3. REST API Routes (`server/src/routes/`)
- All JSON responses and error responses adhere strictly to `{ "error": "message" }`.
- **Auth Routes (`/api/auth`)**:
  - `POST /register`: Registers new user, hashes password, returns `{ token, user }`.
  - `POST /login`: Validates credentials, returns `{ token, user }`.
  - `GET /me`: Authenticated endpoint returning `{ user }`.
- **Session Routes (`/api/sessions`)**:
  - `POST /`: Optional auth; creates session with 6-char code, calculates TTL expiration, returns 201 `{ code, expiresAt, status }`.
  - `GET /`: Authenticated; lists user's sessions with optional `?status=` filter.
  - `GET /:code`: Public; returns `{ code, status, expiresAt }` or 404.
  - `PATCH /:code`: Authenticated; extends expiration (`extendMinutes`) or sets status to `closed`.
  - `DELETE /:code`: Authenticated; removes session (204).
- **Transfer Routes (`/api/transfers`)**:
  - `POST /`: Authenticated; records transfer log, returns 201 `{ transfer }`.
  - `GET /`: Authenticated; paginated query with `?status=&q=&from=&to=&page=&limit=`. Searches across `fileName`, `sessionCode`, and `deviceName`.
  - `DELETE /:id`: Authenticated; deletes single transfer record (204).
  - `DELETE /`: Authenticated; clears all transfers for current user (204).
- **Device Routes (`/api/devices`)**:
  - `POST /`: Authenticated; registers device `{ name, deviceKey }`, returns 201 `{ device }`.
  - `GET /`: Authenticated; returns `[device]`.
  - `PATCH /:id`: Authenticated; updates `name` and/or `trusted` status.
  - `DELETE /:id`: Authenticated; deletes device (204).

### 4. WebSocket Signaling (`server/src/signaling/index.js`)
- Mounted on path `/ws`.
- Enforces max 2 peers per room.
- Relays WebRTC signaling payloads (`offer`, `answer`, `ice`) between peers.
- **Signaling Rule 1**:
  - First peer to join gets role `responder` and receives `{ type: 'joined', peerId, role: 'responder', peers }`.
  - Second peer gets role `initiator` and receives `{ type: 'joined', peerId, role: 'initiator', peers }`.
  - First peer receives `{ type: 'peer-joined', peerId, deviceName }`.
- **Signaling Rule 2**: Validates sessions via `Session.findActiveByCode`. Once two peers join, updates DB session status to `paired`.
- **Signaling Rule 3**: Disconnections notify the remaining peer with `{ type: 'peer-left', peerId }`. Keeps room alive until `expiresAt` so peer can rejoin.
- **Signaling Rule 4**: Heartbeat timer every 25 seconds pings sockets and terminates unresponsive clients.
- **Signaling Rule 5**: Closes rooms and notifies clients with `{ type: 'error', code: 'SESSION_EXPIRED', message }` upon session expiration.

## What's Missing / Deferred to Stage 4 (Integration)

- `server/src/index.js`: Excluded intentionally per CONTRACTS.md Section 0 (`server/src/index.js -> INTEGRATION step only`). This file will load environment variables, connect to MongoDB, mount `apiRouter` at `/api`, attach CORS for `CLIENT_ORIGIN`, and attach the WebSocket signaling server in Stage 4.

## How to Run

1. Navigate to the `server/` directory:
   ```bash
   cd server
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your MongoDB URI and secrets if needed
   ```
4. Start the server (after Stage 4 provides `src/index.js`):
   ```bash
   npm run dev
   ```
