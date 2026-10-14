import { CHUNK_SIZE } from './constants.js';

/**
 * Encodes a chunk into a binary frame:
 * First 4 bytes = chunk index (uint32 big-endian), followed by chunk bytes.
 * @param {number} chunkIndex
 * @param {ArrayBuffer|ArrayBufferView} chunkBuffer
 * @returns {ArrayBuffer}
 */
export function encodeBinaryFrame(chunkIndex, chunkBuffer) {
  const byteLength = chunkBuffer.byteLength;
  const frame = new Uint8Array(4 + byteLength);
  const view = new DataView(frame.buffer);
  view.setUint32(0, chunkIndex, false); // false = big-endian
  if (chunkBuffer instanceof ArrayBuffer) {
    frame.set(new Uint8Array(chunkBuffer), 4);
  } else if (ArrayBuffer.isView(chunkBuffer)) {
    frame.set(new Uint8Array(chunkBuffer.buffer, chunkBuffer.byteOffset, chunkBuffer.byteLength), 4);
  }
  return frame.buffer;
}

/**
 * Decodes a binary frame into chunk index and payload.
 * @param {ArrayBuffer} frameBuffer
 * @returns {{ chunkIndex: number, chunkData: ArrayBuffer }}
 */
export function decodeBinaryFrame(frameBuffer) {
  const view = new DataView(frameBuffer);
  const chunkIndex = view.getUint32(0, false);
  const chunkData = frameBuffer.slice(4);
  return { chunkIndex, chunkData };
}

/**
 * Creates control message strings.
 */
export const ControlMessages = {
  meta: (id, name, size, mime, totalChunks, chunkSize = CHUNK_SIZE) =>
    JSON.stringify({ t: 'meta', id, name, size, mime, totalChunks, chunkSize }),

  ready: (id, have = []) =>
    JSON.stringify({ t: 'ready', id, have }),

  end: (id) =>
    JSON.stringify({ t: 'end', id }),

  done: (id, sha256) =>
    JSON.stringify({ t: 'done', id, sha256 }),

  cancel: (id) =>
    JSON.stringify({ t: 'cancel', id }),
};
