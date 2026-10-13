/**
 * DropRelay Data Channel Transfer Constants
 * per CONTRACTS.md Section 5
 */

export const CHUNK_SIZE = 16384; // 16 KB chunk size
export const BUFFERED_AMOUNT_LOW_THRESHOLD = 262144; // 256 KB
export const BUFFERED_AMOUNT_HIGH_THRESHOLD = 1048576; // 1 MB (pause sending)
export const DATA_CHANNEL_LABEL = 'file';

export const DEFAULT_ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
];

export const PEER_STATUS = {
  CONNECTING: 'connecting',
  WAITING_PEER: 'waiting-peer',
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  FAILED: 'failed',
};
