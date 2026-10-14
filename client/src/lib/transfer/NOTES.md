# Transfer Engine Module Notes (Stage 2 – feat/transfer)

## What Works

### 1. Data Channel Protocol (`client/src/lib/transfer/protocol.js`, `peer.js`)
- **Channel Configuration**:
  - Label: `file`
  - `binaryType = 'arraybuffer'`
  - Ordered, reliable transmission
- **Chunking & Framing**:
  - Chunk size: `16384` bytes (16 KB)
  - Binary frame format: 4-byte big-endian `uint32` chunk index header followed by chunk data payload
  - Frame decoder and encoder (`encodeBinaryFrame`, `decodeBinaryFrame`)
- **Backpressure Management**:
  - `bufferedAmountLowThreshold`: `262144` bytes (256 KB)
  - Transmission pause when `bufferedAmount > 1048576` bytes (1 MB), resumed via `bufferedamountlow` event
- **Control Messages**:
  - `{ t:'meta', id, name, size, mime, totalChunks }`: Informs receiver of upcoming file
  - `{ t:'ready', id, have:[...] }`: Receiver signals readiness, supports chunk skipping for resume
  - `{ t:'end', id }`: Signals end of chunk transmission
  - `{ t:'done', id, sha256 }`: Receiver reports SHA-256 verification hash
  - `{ t:'cancel', id }`: Signals file transfer cancellation

### 2. Integrity Verification (`client/src/lib/transfer/crypto.js`)
- Computes SHA-256 checksums in the browser using the Web Crypto API (`crypto.subtle.digest('SHA-256', ...)`).
- Hex-encoded checksum returned in `file-complete` event.

### 3. Public API & Event System (`client/src/lib/transfer/index.js`, `peer.js`)
- Exported entry point:
  ```js
  import { createPeer } from './index.js';
  const peer = createPeer({ code, deviceName, wsUrl, iceServers });
  ```
- **Events**:
  - `status`: `'connecting'` | `'waiting-peer'` | `'connected'` | `'disconnected'` | `'failed'`
  - `peer`: `{ deviceName }` (triggered when paired peer joins or is discovered)
  - `incoming`: `{ id, name, size }` (triggered when peer starts sending a file)
  - `progress`: `{ id, name, direction, bytes, total, percent, speedBps, etaSec }` (emitted during send and receive)
  - `file-complete`: `{ id, name, size, direction, durationMs, avgSpeedBps, sha256, blob? }` (`blob` provided only for received files)
  - `error`: `{ code, message }`
- **Methods**:
  - `peer.sendFiles(fileList)`: Sequential asynchronous queue sending files one by one.
  - `peer.cancel(id)`: Cancels active file transfer and notifies remote peer.
  - `peer.close()`: Leaves room, closes data channel, closes RTCPeerConnection, closes WebSocket.

### 4. Signaling & Role Coordination
- Strictly implements **Signaling Rule 1**:
  - First peer to join gets role `responder` and enters `'waiting-peer'`.
  - Second peer gets role `initiator`, enters `'connecting'`, creates `RTCPeerConnection` with data channel `'file'`, creates offer, and sends to signaling server.
  - First peer receives `peer-joined`, then receives `offer`, creates answer, and sets up data channel on `ondatachannel`.

## What's Missing / Deferred to Stage 3 & 4

- **No Scaffolding**: As instructed, no `package.json` or Vite scaffold was created in `client/` during this stage. Stage 3 (Frontend agent) creates `client/package.json` and scaffolds the UI.
- **UI Integration**: Stage 3 creates the React UI components and pages consuming `createPeer`. Stage 4 links the real transfer engine into the final bundle.

## How to Test / Integrate

In Stage 3/4, import into React components:
```javascript
import { createPeer } from './lib/transfer/index.js';

const peer = createPeer({
  code: 'ABC234',
  deviceName: 'Chrome Desktop',
  wsUrl: 'ws://localhost:5000/ws',
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
});

peer.on('status', (status) => console.log('Peer status:', status));
peer.on('peer', ({ deviceName }) => console.log('Remote peer:', deviceName));
peer.on('progress', (p) => console.log(`Progress (${p.direction}): ${p.percent}% at ${p.speedBps} bps`));
peer.on('file-complete', (r) => {
  console.log('Complete:', r);
  if (r.blob) {
    const downloadUrl = URL.createObjectURL(r.blob);
    // Trigger download
  }
});
```
