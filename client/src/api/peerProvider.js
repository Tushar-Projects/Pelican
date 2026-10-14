/**
 * Peer Provider
 * 
 * Exports createPeer used by UI components.
 * Stage 3 re-exports createMockPeer.
 * In Stage 4, this single file switches to export createPeer from '../lib/transfer/index.js'.
 */

import { createMockPeer } from './mockPeer.js';

export function createPeer(options) {
  return createMockPeer(options);
}

export default createPeer;
