# Pelican Architecture

Pelican is a peer-to-peer file transfer web application that streams files directly between web browsers using WebRTC data channels. The backend server coordinates room signaling and metadata persistence but never receives, inspects, or stores any portion of the transferred file payloads.

---

## 1. System Components

The application is structured into four primary tiers:

```
+-------------------------------------------------------------------------+
|                               Pelican UI                                |
|   React 18 + Vite SPA, CSS Design System, Web Crypto API, React Router  |
+-------------------------------------------------------------------------+
               |                                            ^
               | REST API (HTTP)                            | WebRTC Data Channel
               v                                            v (Direct P2P, 64 KB)
+-------------------------------+             +---------------------------+
|      Pelican API Server       |             |     Peer Browser (B)      |
| Express, JWT Auth, Mongoose   |             | WebRTC, ArrayBuffer, Blob |
+-------------------------------+             +---------------------------+
       |                 |                                  ^
       | Models          | WebSocket Signaling (/ws)        | STUN Candidates
       v                 v                                  v
+-------------+   +-----------------------------------------------+
|   MongoDB   |   |        Signaling & Discovery Engine           |
| Persistence |   | Room Dispatcher, Heartbeat, STUN (Google)     |
+-------------+   +-----------------------------------------------+
```

### Frontend (`client/`)
- **Single Page Application**: Built with React 18, React Router 6, and Vite.
- **Transfer Engine (`src/lib/transfer/`)**: Standalone, framework-agnostic client engine managing WebRTC peer connections, WebSocket signaling dispatch, backpressure coordination, binary frame encoding, and SHA-256 integrity verification.
- **Presentation Layer**: Custom responsive CSS design system supporting light and dark themes, strict WCAG 2.1 AA contrast compliance, accessible modal dialogs, and touch-target optimization for mobile devices.

### Backend (`server/`)
- **Express REST API**: Handles user authentication (bcrypt + JWT), session generation, device registry, and transfer history auditing.
- **Signaling Server (`src/signaling/`)**: Attached to the HTTP server at `/ws` using the `ws` library. Manages ephemeral room lifecycles, enforces a maximum of two peers per room, validates origins, and relays SDP offers, answers, and ICE candidates between browser peers.

### Database (`MongoDB`)
- Stores persistent accounts, registered trusted devices, session records with automated time-to-live (TTL) expiration, and transfer audit logs.

### Network & NAT Traversal
- **STUN Server**: Default configuration uses Google's public STUN server (`stun:stun.l.google.com:19302`) to discover reflexive public IP addresses and ports across consumer NATs.
- **Zero File Storage Guarantee**: File contents are sliced into memory buffers and transmitted directly between browser data channels; neither the signaling server nor the database ever touch file bytes.

---

## 2. Data Model

The server defines four Mongoose schemas in `server/src/models/`:

### 2.1 User (`User.js`)
Represents an authenticated user account.
```javascript
{
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
}
```

### 2.2 Device (`Device.js`)
Represents a browser or device registered to a user account.
```javascript
{
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, trim: true },
  deviceKey: { type: String, required: true },
  trusted: { type: Boolean, default: false },
  lastSeenAt: { type: Date, default: Date.now }
}
```

### 2.3 Session (`Session.js`)
Represents a temporary pairing session identified by a 6-character code.
```javascript
{
  code: { type: String, unique: true, required: true, uppercase: true, trim: true },
  hostUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  status: {
    type: String,
    enum: ['waiting', 'paired', 'closed', 'expired'],
    default: 'waiting'
  },
  expiresAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now }
}
```
- **Indexes**: Includes a MongoDB TTL index `{ expiresAt: 1 }` with `{ expireAfterSeconds: 0 }` for automatic document deletion upon expiration.
- **Static Method `findActiveByCode(code)`**: Queries active sessions where `status` is in `['waiting', 'paired']` and `expiresAt > now`.
- **Session Code Generation**: 6-character random string from the 32-character alphabet `23456789ABCDEFGHJKLMNPQRSTUVWXYZ`, explicitly excluding ambiguous characters (`0`, `O`, `1`, `I`).

### 2.4 Transfer (`Transfer.js`)
Represents an audit log entry for a completed, failed, or cancelled transfer.
```javascript
{
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sessionCode: { type: String, required: true, trim: true, uppercase: true },
  deviceName: { type: String, default: '', trim: true },
  fileName: { type: String, required: true, trim: true },
  fileSize: { type: Number, required: true },
  direction: { type: String, enum: ['sent', 'received'], required: true },
  status: { type: String, enum: ['completed', 'failed', 'cancelled'], required: true },
  avgSpeedBps: { type: Number, default: 0 },
  durationMs: { type: Number, default: 0 },
  sha256: { type: String, default: '', trim: true },
  createdAt: { type: Date, default: Date.now }
}
```

---

## 3. Session Lifecycle & Transfer Sequence

The following sequence diagram outlines the entire lifecycle from session initialization to peer-to-peer file transfer and completion:

```mermaid
sequenceDiagram
  autonumber
  actor Host as Browser A (Host)
  actor Peer as Browser B (Joiner)
  participant API as Express REST API
  participant WS as Signaling Server (/ws)
  participant DB as MongoDB

  Note over Host,DB: 1. Session Creation
  Host->>API: POST /api/sessions
  API->>DB: Session.create({ code: "ABC234", expiresAt: +15m, status: "waiting" })
  DB-->>API: Saved session document
  API-->>Host: 201 Created { code: "ABC234", expiresAt }

  Note over Host,WS: 2. Host Joins Signaling
  Host->>WS: WebSocket Connect & send { type: "join", code: "ABC234", deviceName: "MacBook" }
  WS->>DB: Session.findActiveByCode("ABC234")
  DB-->>WS: Active session
  WS-->>Host: { type: "joined", peerId: "p1", role: "responder", peers: [...] }

  Note over Peer,WS: 3. Joiner Connects with Code
  Peer->>WS: WebSocket Connect & send { type: "join", code: "ABC234", deviceName: "Phone" }
  WS->>DB: Session.findActiveByCode("ABC234")
  WS->>DB: Update Session status = "paired"
  WS-->>Peer: { type: "joined", peerId: "p2", role: "initiator", peers: [...] }
  WS-->>Host: { type: "peer-joined", peerId: "p2", deviceName: "Phone" }

  Note over Host,Peer: 4. WebRTC SDP & ICE Exchange via Signaling
  Peer->>Peer: Create RTCPeerConnection & DataChannel("file")
  Peer->>WS: { type: "offer", sdp }
  WS->>Host: Relayed { type: "offer", sdp }
  Host->>Host: Set remote description & Create answer
  Host->>WS: { type: "answer", sdp }
  WS->>Peer: Relayed { type: "answer", sdp }
  Peer->>WS: { type: "ice", candidate }
  WS->>Host: Relayed { type: "ice", candidate }
  Host->>WS: { type: "ice", candidate }
  WS->>Peer: Relayed { type: "ice", candidate }

  Note over Host,Peer: 5. Direct Peer-to-Peer Data Channel Opens
  Peer-->>Host: WebRTC DataChannel Open (No server involvement)
  Host->>Peer: Control: { t: "meta", id: "f1", name: "doc.pdf", size, totalChunks, chunkSize: 65536 }
  Peer->>Host: Control: { t: "ready", id: "f1", have: [] }

  Note over Host,Peer: 6. Block Reads, Binary Framing & Backpressure
  loop For each 4 MB block and 64 KB chunk
    Host->>Peer: Binary Frame: [uint32 chunkIndex (4B)][payload (64KB)]
    Note over Host: Pause if bufferedAmount > 8 MB; resume on bufferedamountlow (1 MB)
  end

  Host->>Peer: Control: { t: "end", id: "f1" }
  Peer->>Peer: Reassemble chunks & verify SHA-256
  Peer->>Host: Control: { t: "done", id: "f1", sha256: "ba7816..." }

  Note over Host,DB: 7. Audit Logging (Optional)
  Host->>API: POST /api/transfers (Record completion)
  Peer->>API: POST /api/transfers (Record completion)
```

---

## 4. Differences Between Code and CONTRACTS.md

The implementation follows the core contracts specified in `CONTRACTS.md` with several intentional performance and architectural optimizations:

| Area | `CONTRACTS.md` Specification | Actual Implementation in Code | Rationale |
|---|---|---|---|
| **Chunk Size** | 16,384 bytes (16 KB) | `65,536` bytes (64 KB) | Maximizes data channel throughput on modern browsers and high-speed Wi-Fi networks |
| **Low Threshold** | 262,144 bytes (256 KB) | `1,048,576` bytes (1 MB) | Calibrated for 64 KB chunking to reduce thread wakeups during high-speed transfers |
| **High Threshold** | 1,048,576 bytes (1 MB) | `8,388,608` bytes (8 MB) | Prevents data channel buffer overflow during multi-gigabit local Wi-Fi transfers |
| **File Slicing** | Per-chunk `slice().arrayBuffer()` | 4 MB block reads (`BLOCK_SIZE = 4 * 1024 * 1024`) | Cuts chunks directly from an ArrayBuffer block without redundant DOM File slice calls |
| **Meta Message** | `{ t:'meta', id, name, size, mime, totalChunks }` | Includes `chunkSize`: `{ t:'meta', ..., chunkSize }` | Enables the receiver to dynamically calculate chunk boundaries for resumption |
| **Progress Batching** | Unspecified | Throttled to $\le 1$ event per 100 ms per file with RAF / background `setTimeout` | Prevents React queue re-render starvation on mobile browsers |
| **Receiver Assembly** | Concatenation / blob parts | Preallocated array by index (`new Array(totalChunks)`) | Eliminates repeated buffer copying and garbage collector churn during reception |
