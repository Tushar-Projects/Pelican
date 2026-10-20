# Pelican Network & Transfer Protocol Specification

Pelican relies on two communication channels:
1. **WebSocket Signaling Protocol (`/ws`)**: Relays session discovery and WebRTC session negotiation messages through the central server.
2. **WebRTC Data Channel Protocol (`file`)**: Transmits raw binary file chunks and transfer control messages directly peer-to-peer between browsers.

---

## 1. WebSocket Signaling Protocol

The signaling server attaches to the Express HTTP/HTTPS server at path `/ws`. All signaling messages are encoded as JSON strings with a top-level `type` field.

### 1.1 Origin Verification
Before accepting a WebSocket connection, the server checks the `Origin` header in `verifyClient`:
- Allowed: `CLIENT_ORIGIN` (default `http://localhost:5173`), `localhost`, loopback `127.0.0.1`, private LAN ranges (`192.168.x.x`, `10.x.x.x`, `172.16-31.x.x`), and standard ngrok tunnels (`*.ngrok-free.app`, `*.ngrok-free.dev`, `*.ngrok.app`, `*.ngrok.io`).
- Rejected: Unrecognized public cross-origins receive HTTP 403 Forbidden.

### 1.2 Client-to-Server Messages

#### `join`
Sent by a peer upon opening the WebSocket connection to enter a room.
```json
{
  "type": "join",
  "code": "ABC234",
  "deviceName": "MacBook Pro"
}
```

#### `offer`
Transmits a WebRTC Session Description Protocol (SDP) offer created by the initiator.
```json
{
  "type": "offer",
  "sdp": {
    "type": "offer",
    "sdp": "v=0\r\no=- 461173... IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n..."
  }
}
```

#### `answer`
Transmits an SDP answer created by the responder.
```json
{
  "type": "answer",
  "sdp": {
    "type": "answer",
    "sdp": "v=0\r\no=- 892341... IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n..."
  }
}
```

#### `ice`
Relays an ICE candidate discovered during ICE gathering.
```json
{
  "type": "ice",
  "candidate": {
    "candidate": "candidate:842163049 1 udp 1677729535 192.168.1.50 54123 typ srflx raddr 192.168.1.50 rport 54123...",
    "sdpMid": "0",
    "sdpMLineIndex": 0
  }
}
```

#### `leave`
Explicitly informs the server that the peer is departing the room.
```json
{
  "type": "leave"
}
```

### 1.3 Server-to-Client Messages

#### `joined`
Sent immediately to a joining peer upon successful room admission.
```json
{
  "type": "joined",
  "peerId": "p_8x9a2b",
  "role": "responder",
  "peers": [
    { "peerId": "p_8x9a2b", "deviceName": "MacBook Pro" }
  ]
}
```
- `role`: The first peer receives `'responder'`. The second peer receives `'initiator'`.
- `peers`: Array of all active peers currently in the room.

#### `peer-joined`
Sent to the first peer (`responder`) when the second peer (`initiator`) enters the room.
```json
{
  "type": "peer-joined",
  "peerId": "p_3c4d5e",
  "deviceName": "Pixel 8"
}
```

#### `offer` / `answer` / `ice`
Relayed verbatim to the opposite peer in the room.
```json
{
  "type": "offer",
  "sdp": { ... }
}
```

#### `peer-left`
Sent to the remaining peer when the remote peer disconnects or leaves.
```json
{
  "type": "peer-left",
  "peerId": "p_3c4d5e"
}
```

#### `error`
Sent when a request fails or cannot be serviced.
```json
{
  "type": "error",
  "code": "ROOM_FULL",
  "message": "Room is already full (max 2 peers)"
}
```

Supported error codes:
- `INVALID_CODE`: Session code was not found or has expired.
- `SESSION_EXPIRED`: Session reached its TTL expiration time or was closed.
- `ROOM_FULL`: Two peers are already connected in the room.
- `BAD_MESSAGE`: Malformed JSON or missing required fields.

### 1.4 Heartbeat & Room Cleanup
- The signaling server runs an interval every 25 seconds (25,000 ms).
- It checks active rooms against `expiresAt`. If expired, it emits `{ type: 'error', code: 'SESSION_EXPIRED', message: 'Session has expired' }`, closes all sockets, and updates MongoDB status to `'expired'`.
- It sends a WebSocket `ping` frame to every connected client; clients that failed to reply with `pong` since the previous cycle are terminated.

---

## 2. WebRTC Data Channel Protocol

Once the WebRTC peer connection is established, all file transfer coordination and binary data streaming take place directly over an `RTCDataChannel`.

### 2.1 Channel Configuration
- **Label**: `'file'`
- **Binary Type**: `'arraybuffer'`
- **Ordered**: `true` (TCP-like in-order delivery via SCTP)
- **Reliable**: `true` (standard WebRTC reliable data channel mode)

### 2.2 Protocol Constants
```javascript
export const CHUNK_SIZE = 65536;                       // 64 KB chunk size
export const BUFFERED_AMOUNT_LOW_THRESHOLD = 1048576;  // 1 MB low watermark
export const BUFFERED_AMOUNT_HIGH_THRESHOLD = 8388608; // 8 MB high watermark (pause)
export const DEFAULT_ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
];
```

### 2.3 Binary Frame Format
Chunks are transmitted as binary ArrayBuffers. Every binary chunk is prefixed by a 4-byte big-endian unsigned 32-bit integer header representing the chunk index:

```
 0                   1                   2                   3
 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                 Chunk Index (32-bit unsigned uint, BE)        |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                                                               |
|                 Chunk Payload (up to 65,536 bytes)             |
|                                                               |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
```

- Byte 0-3: `uint32` chunk index (0 to $2^{32}-1$).
- Byte 4+: Raw slice bytes of the file.

### 2.4 Control Messages (JSON strings over DataChannel)

Control messages are differentiated from binary frames by string type. All control messages contain a `t` property indicating message type:

#### `meta` (Sender -> Receiver)
Announces an upcoming file and provides its size, mime type, and chunking parameters.
```json
{
  "t": "meta",
  "id": "f_1729450000_0_abcde",
  "name": "archive.tar.gz",
  "size": 104857600,
  "mime": "application/gzip",
  "totalChunks": 1600,
  "chunkSize": 65536
}
```

#### `ready` (Receiver -> Sender)
Acknowledges the `meta` message and signals readiness to accept binary chunks.
```json
{
  "t": "ready",
  "id": "f_1729450000_0_abcde",
  "have": []
}
```
- `have`: Array of chunk indices already held by the receiver (supports chunk-skipping for in-memory session resume).

#### `end` (Sender -> Receiver)
Signals that the sender has finished transmitting all chunks for the file.
```json
{
  "t": "end",
  "id": "f_1729450000_0_abcde"
}
```

#### `done` (Receiver -> Sender)
Sent by the receiver after reassembling the file and validating its SHA-256 integrity hash.
```json
{
  "t": "done",
  "id": "f_1729450000_0_abcde",
  "sha256": "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
}
```

#### `cancel` (Bidirectional)
Signals that either the sender or receiver cancelled the transfer.
```json
{
  "t": "cancel",
  "id": "f_1729450000_0_abcde"
}
```

---

## 3. Backpressure & Flow Control

To prevent memory bloat and browser crashes during high-speed local Wi-Fi transfers:
1. **Block Reads**: The sender reads the file from disk in 4 MB blocks (`BLOCK_SIZE = 4 * 1024 * 1024`), slicing 64 KB chunks directly from the block's `ArrayBuffer` without calling `file.slice()` per chunk.
2. **Buffer Monitoring**: Before sending each chunk, the sender checks `dataChannel.bufferedAmount`.
3. **Transmission Pause**: If `bufferedAmount > 8,388,608` bytes (8 MB), sending pauses.
4. **Resumption**: The sender waits asynchronously for the data channel's `bufferedamountlow` event (`bufferedAmountLowThreshold = 1,048,576` bytes, 1 MB) before resuming transmission.
5. **Progress Throttling**: Progress events are throttled per file to at most once every 100 ms to avoid saturating the UI render thread, with guaranteed emission of the final 100% state.

---

## 4. Differences from CONTRACTS.md

| Specification | `CONTRACTS.md` Section 5 | Implemented Code |
|---|---|---|
| **Chunk Size** | 16,384 bytes (16 KB) | `65,536` bytes (64 KB) |
| **Low Watermark** | 262,144 bytes (256 KB) | `1,048,576` bytes (1 MB) |
| **High Watermark** | 1,048,576 bytes (1 MB) | `8,388,608` bytes (8 MB) |
| **Meta Payload** | `{ t:'meta', id, name, size, mime, totalChunks }` | Added `chunkSize: 65536` to support dynamic chunk offsets |
| **File Slicing** | Implicit per chunk | 4 MB block reading (`BLOCK_SIZE = 4194304`) to reduce DOM I/O overhead |
