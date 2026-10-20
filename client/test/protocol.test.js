import { describe, it, expect } from 'vitest';
import {
  encodeBinaryFrame,
  decodeBinaryFrame,
  ControlMessages,
} from '../src/lib/transfer/protocol.js';
import { CHUNK_SIZE } from '../src/lib/transfer/constants.js';

describe('protocol.js binary frame encoding and decoding', () => {
  it('performs binary frame encode and decode round trip with matching payload', () => {
    const originalText = 'Hello Pelican Data Channel';
    const payload = new TextEncoder().encode(originalText);
    const chunkIndex = 42;

    const encoded = encodeBinaryFrame(chunkIndex, payload);
    expect(encoded).toBeInstanceOf(ArrayBuffer);
    expect(encoded.byteLength).toBe(4 + payload.byteLength);

    const { chunkIndex: decodedIndex, chunkData } = decodeBinaryFrame(encoded);
    expect(decodedIndex).toBe(chunkIndex);
    const decodedText = new TextDecoder().decode(chunkData);
    expect(decodedText).toBe(originalText);
  });

  it('supports encoding from ArrayBuffer as well as ArrayBufferView', () => {
    const buffer = new ArrayBuffer(8);
    const view = new Uint8Array(buffer);
    view.set([1, 2, 3, 4, 5, 6, 7, 8]);

    // From ArrayBuffer
    const encodedFromBuffer = encodeBinaryFrame(10, buffer);
    const decodedFromBuffer = decodeBinaryFrame(encodedFromBuffer);
    expect(decodedFromBuffer.chunkIndex).toBe(10);
    expect(new Uint8Array(decodedFromBuffer.chunkData)).toEqual(view);

    // From ArrayBufferView
    const encodedFromView = encodeBinaryFrame(20, view);
    const decodedFromView = decodeBinaryFrame(encodedFromView);
    expect(decodedFromView.chunkIndex).toBe(20);
    expect(new Uint8Array(decodedFromView.chunkData)).toEqual(view);
  });

  it('handles chunk index boundaries correctly (0, 1, 65535, 2^31-1, 2^32-1)', () => {
    const boundaryIndices = [
      0, // Minimum uint32
      1,
      65535, // 0xFFFF
      2147483647, // 0x7FFFFFFF (max signed 32-bit int)
      4294967295, // 0xFFFFFFFF (max unsigned 32-bit int)
    ];

    const samplePayload = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);

    for (const idx of boundaryIndices) {
      const encoded = encodeBinaryFrame(idx, samplePayload);
      const { chunkIndex, chunkData } = decodeBinaryFrame(encoded);
      expect(chunkIndex).toBe(idx);
      expect(new Uint8Array(chunkData)).toEqual(samplePayload);
    }
  });

  it('handles empty chunk payload (zero-byte payload)', () => {
    const emptyPayload = new Uint8Array(0);
    const encoded = encodeBinaryFrame(999, emptyPayload);
    expect(encoded.byteLength).toBe(4);

    const { chunkIndex, chunkData } = decodeBinaryFrame(encoded);
    expect(chunkIndex).toBe(999);
    expect(chunkData.byteLength).toBe(0);
  });

  it('handles large chunk payloads (64 KB chunk size)', () => {
    const largeChunk = new Uint8Array(CHUNK_SIZE);
    largeChunk.fill(0xaa);

    const encoded = encodeBinaryFrame(1234, largeChunk);
    expect(encoded.byteLength).toBe(4 + CHUNK_SIZE);

    const { chunkIndex, chunkData } = decodeBinaryFrame(encoded);
    expect(chunkIndex).toBe(1234);
    expect(new Uint8Array(chunkData)).toEqual(largeChunk);
  });
});

describe('protocol.js ControlMessages shapes', () => {
  it('creates correct meta message shape', () => {
    const msgString = ControlMessages.meta('f1', 'test.pdf', 1048576, 'application/pdf', 16, 65536);
    const parsed = JSON.parse(msgString);
    expect(parsed).toEqual({
      t: 'meta',
      id: 'f1',
      name: 'test.pdf',
      size: 1048576,
      mime: 'application/pdf',
      totalChunks: 16,
      chunkSize: 65536,
    });
  });

  it('uses default CHUNK_SIZE for meta message when omitted', () => {
    const msgString = ControlMessages.meta('f2', 'photo.jpg', 65536, 'image/jpeg', 1);
    const parsed = JSON.parse(msgString);
    expect(parsed.chunkSize).toBe(CHUNK_SIZE);
  });

  it('creates correct ready message shape', () => {
    const msgString = ControlMessages.ready('f1', [0, 1, 2]);
    const parsed = JSON.parse(msgString);
    expect(parsed).toEqual({
      t: 'ready',
      id: 'f1',
      have: [0, 1, 2],
    });
  });

  it('defaults have to empty array in ready message', () => {
    const msgString = ControlMessages.ready('f1');
    const parsed = JSON.parse(msgString);
    expect(parsed).toEqual({
      t: 'ready',
      id: 'f1',
      have: [],
    });
  });

  it('creates correct end message shape', () => {
    const msgString = ControlMessages.end('f1');
    const parsed = JSON.parse(msgString);
    expect(parsed).toEqual({
      t: 'end',
      id: 'f1',
    });
  });

  it('creates correct done message shape', () => {
    const hash = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
    const msgString = ControlMessages.done('f1', hash);
    const parsed = JSON.parse(msgString);
    expect(parsed).toEqual({
      t: 'done',
      id: 'f1',
      sha256: hash,
    });
  });

  it('creates correct cancel message shape', () => {
    const msgString = ControlMessages.cancel('f1');
    const parsed = JSON.parse(msgString);
    expect(parsed).toEqual({
      t: 'cancel',
      id: 'f1',
    });
  });
});
