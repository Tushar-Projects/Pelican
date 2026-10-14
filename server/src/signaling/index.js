import { WebSocketServer, WebSocket } from 'ws';
import Session from '../models/Session.js';

/**
 * In-memory map of active signaling rooms.
 * Map<string, { code: string, expiresAt: Date, peers: Map<string, { peerId: string, deviceName: string, role: string, ws: WebSocket }> }>
 */
const rooms = new Map();

function safeSend(ws, data) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

function generatePeerId() {
  return 'p_' + Math.random().toString(36).substring(2, 9);
}

const ngrokSuffixes = ['.ngrok-free.app', '.ngrok-free.dev', '.ngrok.app', '.ngrok.io'];

function isAllowedSignalingOrigin(origin) {
  if (!origin) return true;
  const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
  if (origin === clientOrigin) return true;

  // Localhost and LAN IPs
  if (/^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/.test(origin)) {
    return true;
  }

  // ngrok origins (.ngrok-free.app, .ngrok-free.dev, .ngrok.app, .ngrok.io)
  try {
    const { hostname } = new URL(origin);
    if (ngrokSuffixes.some((suffix) => hostname.endsWith(suffix) || hostname === suffix.slice(1))) {
      return true;
    }
  } catch (e) {
    // Malformed origin
  }

  return false;
}

/**
 * Attaches the WebSocket signaling server to an HTTP/HTTPS server at path /ws.
 * @param {import('http').Server} server
 * @returns {WebSocketServer}
 */
export function attachSignaling(server) {
  const wss = new WebSocketServer({
    server,
    path: '/ws',
    verifyClient: (info, callback) => {
      const origin = info.origin || info.req?.headers?.origin;
      if (!origin || isAllowedSignalingOrigin(origin)) {
        return callback(true);
      }
      return callback(false, 403, 'Forbidden origin');
    },
  });

  // Heartbeat & expiration interval (25 seconds per Rule 4)
  const heartbeatInterval = setInterval(async () => {
    const now = new Date();

    // Check room expiration per Rule 5
    for (const [code, room] of rooms.entries()) {
      if (room.expiresAt <= now) {
        for (const peer of room.peers.values()) {
          safeSend(peer.ws, {
            type: 'error',
            code: 'SESSION_EXPIRED',
            message: 'Session has expired',
          });
          peer.ws.close();
        }
        rooms.delete(code);
        try {
          await Session.updateOne({ code }, { status: 'expired' });
        } catch (err) {
          // Ignore DB error during background sweep
        }
      }
    }

    // Ping all connected clients
    for (const client of wss.clients) {
      if (client.isAlive === false) {
        client.terminate();
        continue;
      }
      client.isAlive = false;
      client.ping();
    }
  }, 25000);

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });

  wss.on('connection', (ws) => {
    ws.isAlive = true;
    ws.peerId = null;
    ws.roomCode = null;
    ws.role = null;

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', async (data) => {
      let message;
      try {
        message = JSON.parse(data.toString());
      } catch (err) {
        safeSend(ws, {
          type: 'error',
          code: 'BAD_MESSAGE',
          message: 'Invalid JSON message',
        });
        return;
      }

      if (!message || typeof message.type !== 'string') {
        safeSend(ws, {
          type: 'error',
          code: 'BAD_MESSAGE',
          message: 'Message type is required',
        });
        return;
      }

      switch (message.type) {
        case 'join': {
          const { code, deviceName } = message;
          if (!code || typeof code !== 'string' || !deviceName || typeof deviceName !== 'string') {
            safeSend(ws, {
              type: 'error',
              code: 'BAD_MESSAGE',
              message: 'Code and deviceName are required to join',
            });
            return;
          }

          const normalizedCode = code.trim().toUpperCase();

          // Rule 2: Validate with Session.findActiveByCode
          let session;
          try {
            session = await Session.findActiveByCode(normalizedCode);
          } catch (err) {
            safeSend(ws, {
              type: 'error',
              code: 'INVALID_CODE',
              message: 'Failed to validate session code',
            });
            return;
          }

          if (!session) {
            // Check if code exists but is expired/closed
            try {
              const existingSession = await Session.findOne({ code: normalizedCode });
              if (existingSession) {
                safeSend(ws, {
                  type: 'error',
                  code: 'SESSION_EXPIRED',
                  message: 'Session is closed or expired',
                });
                return;
              }
            } catch (err) {
              // fallback
            }

            safeSend(ws, {
              type: 'error',
              code: 'INVALID_CODE',
              message: 'Session code not found or expired',
            });
            return;
          }

          // Get or create room
          let room = rooms.get(normalizedCode);
          if (!room) {
            room = {
              code: normalizedCode,
              expiresAt: session.expiresAt,
              peers: new Map(),
            };
            rooms.set(normalizedCode, room);
          }

          // Check room capacity (Max 2 peers per room)
          if (room.peers.size >= 2) {
            safeSend(ws, {
              type: 'error',
              code: 'ROOM_FULL',
              message: 'Room is already full (max 2 peers)',
            });
            return;
          }

          const peerId = generatePeerId();

          // Rule 1: The first peer to join waits and gets role 'responder'.
          // The second peer to join gets role 'initiator'.
          const role = room.peers.size === 0 ? 'responder' : 'initiator';

          ws.peerId = peerId;
          ws.roomCode = normalizedCode;
          ws.deviceName = deviceName.trim();
          ws.role = role;

          const newPeer = {
            peerId,
            deviceName: deviceName.trim(),
            role,
            ws,
          };

          room.peers.set(peerId, newPeer);

          // Rule 2: When two peers are in, set session status to 'paired'.
          if (room.peers.size === 2) {
            try {
              session.status = 'paired';
              await session.save();
            } catch (err) {
              // Non-blocking error
            }
          }

          // Send joined message to the joining peer
          const peersList = Array.from(room.peers.values()).map((p) => ({
            peerId: p.peerId,
            deviceName: p.deviceName,
          }));

          safeSend(ws, {
            type: 'joined',
            peerId,
            role,
            peers: peersList,
          });

          // Rule 1: If this is the second peer (role === initiator), notify first peer with peer-joined
          if (role === 'initiator') {
            for (const otherPeer of room.peers.values()) {
              if (otherPeer.peerId !== peerId) {
                safeSend(otherPeer.ws, {
                  type: 'peer-joined',
                  peerId,
                  deviceName: deviceName.trim(),
                });
              }
            }
          }
          break;
        }

        case 'offer': {
          if (!ws.roomCode || !ws.peerId) {
            safeSend(ws, { type: 'error', code: 'BAD_MESSAGE', message: 'Not in a room' });
            return;
          }
          const room = rooms.get(ws.roomCode);
          if (!room) return;

          // Relay offer to other peer
          for (const otherPeer of room.peers.values()) {
            if (otherPeer.peerId !== ws.peerId) {
              safeSend(otherPeer.ws, {
                type: 'offer',
                sdp: message.sdp,
              });
            }
          }
          break;
        }

        case 'answer': {
          if (!ws.roomCode || !ws.peerId) {
            safeSend(ws, { type: 'error', code: 'BAD_MESSAGE', message: 'Not in a room' });
            return;
          }
          const room = rooms.get(ws.roomCode);
          if (!room) return;

          // Relay answer to other peer
          for (const otherPeer of room.peers.values()) {
            if (otherPeer.peerId !== ws.peerId) {
              safeSend(otherPeer.ws, {
                type: 'answer',
                sdp: message.sdp,
              });
            }
          }
          break;
        }

        case 'ice': {
          if (!ws.roomCode || !ws.peerId) {
            safeSend(ws, { type: 'error', code: 'BAD_MESSAGE', message: 'Not in a room' });
            return;
          }
          const room = rooms.get(ws.roomCode);
          if (!room) return;

          // Relay ICE candidate to other peer
          for (const otherPeer of room.peers.values()) {
            if (otherPeer.peerId !== ws.peerId) {
              safeSend(otherPeer.ws, {
                type: 'ice',
                candidate: message.candidate,
              });
            }
          }
          break;
        }

        case 'leave': {
          if (ws.roomCode && ws.peerId) {
            handlePeerDeparture(ws);
          }
          break;
        }

        default: {
          safeSend(ws, {
            type: 'error',
            code: 'BAD_MESSAGE',
            message: `Unknown message type: ${message.type}`,
          });
          break;
        }
      }
    });

    ws.on('close', () => {
      handlePeerDeparture(ws);
    });

    ws.on('error', () => {
      handlePeerDeparture(ws);
    });
  });

  function handlePeerDeparture(ws) {
    if (!ws.roomCode || !ws.peerId) return;

    const roomCode = ws.roomCode;
    const peerId = ws.peerId;
    ws.roomCode = null;
    ws.peerId = null;

    const room = rooms.get(roomCode);
    if (!room) return;

    room.peers.delete(peerId);

    // Rule 3: When a peer disconnects, notify the other with peer-left.
    // Keep the room alive until expiresAt, so a peer can rejoin.
    for (const otherPeer of room.peers.values()) {
      safeSend(otherPeer.ws, {
        type: 'peer-left',
        peerId,
      });
    }

    // If room is empty, we keep it alive in the map until expiresAt per Rule 3
  }

  return wss;
}

export default attachSignaling;
