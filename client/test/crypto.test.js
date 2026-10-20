import { describe, it, expect } from 'vitest';
import { calculateSha256, pureSha256 } from '../src/lib/transfer/crypto.js';

describe('crypto.js SHA-256 implementation', () => {
  const EXPECTED_ABC_SHA256 = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
  const EXPECTED_EMPTY_SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

  it('computes correct SHA-256 for "abc" using pureSha256 fallback', () => {
    const input = new TextEncoder().encode('abc');
    const hash = pureSha256(input);
    expect(hash).toBe(EXPECTED_ABC_SHA256);
  });

  it('computes correct SHA-256 for empty string using pureSha256 fallback', () => {
    const input = new TextEncoder().encode('');
    const hash = pureSha256(input);
    expect(hash).toBe(EXPECTED_EMPTY_SHA256);
  });

  it('computes correct SHA-256 for "abc" via calculateSha256 (Web Crypto path)', async () => {
    // In Node 20+, globalThis.crypto.subtle is available and used by calculateSha256
    const input = new TextEncoder().encode('abc');
    const hash = await calculateSha256(input);
    expect(hash).toBe(EXPECTED_ABC_SHA256);
  });

  it('computes correct SHA-256 via calculateSha256 when Web Crypto fallback is forced', async () => {
    const originalSubtle = globalThis.crypto?.subtle;
    try {
      // Temporarily delete or stub subtle to simulate non-secure context (e.g. http://<LAN-IP>)
      if (globalThis.crypto) {
        Object.defineProperty(globalThis.crypto, 'subtle', {
          value: undefined,
          configurable: true,
        });
      }

      const input = new TextEncoder().encode('abc');
      const hash = await calculateSha256(input);
      expect(hash).toBe(EXPECTED_ABC_SHA256);
    } finally {
      if (globalThis.crypto && originalSubtle) {
        Object.defineProperty(globalThis.crypto, 'subtle', {
          value: originalSubtle,
          configurable: true,
        });
      }
    }
  });

  it('supports ArrayBuffer and Uint8Array input types in calculateSha256', async () => {
    const uint8 = new TextEncoder().encode('abc');
    const arrayBuffer = uint8.buffer;

    const hashFromArrayBuffer = await calculateSha256(arrayBuffer);
    expect(hashFromArrayBuffer).toBe(EXPECTED_ABC_SHA256);

    const hashFromUint8 = await calculateSha256(uint8);
    expect(hashFromUint8).toBe(EXPECTED_ABC_SHA256);
  });

  it('supports Blob input type in calculateSha256', async () => {
    const blob = new Blob(['abc'], { type: 'text/plain' });
    const hash = await calculateSha256(blob);
    expect(hash).toBe(EXPECTED_ABC_SHA256);
  });

  it('rejects unsupported data types with an informative error', async () => {
    await expect(calculateSha256('unsupported string directly')).rejects.toThrow(
      'Unsupported data type for SHA-256 calculation'
    );
  });
});
