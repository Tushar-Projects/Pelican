/**
 * DropRelay Transfer Engine Public API
 * per CONTRACTS.md Section 6
 */

import { Peer } from './peer.js';

/**
 * Creates and initializes a WebRTC Peer for signaling and data channel transfer.
 * @param {Object} options
 * @param {string} options.code - 6-character session pairing code
 * @param {string} options.deviceName - Display name of current device
 * @param {string} [options.wsUrl] - WebSocket signaling URL (e.g. ws://localhost:5000/ws)
 * @param {RTCIceServer[]} [options.iceServers] - STUN/TURN ICE server configuration
 * @returns {Peer}
 */
export function createPeer({ code, deviceName, wsUrl, iceServers }) {
  return new Peer({ code, deviceName, wsUrl, iceServers });
}

export { Peer } from './peer.js';
export {
  CHUNK_SIZE,
  BUFFERED_AMOUNT_LOW_THRESHOLD,
  BUFFERED_AMOUNT_HIGH_THRESHOLD,
  DATA_CHANNEL_LABEL,
  PEER_STATUS,
} from './constants.js';
export default createPeer;
