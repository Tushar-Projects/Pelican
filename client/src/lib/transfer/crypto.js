/**
 * Cryptographic helpers for SHA-256 integrity verification.
 * per CONTRACTS.md Section 5
 */

/**
 * Calculates hex-encoded SHA-256 hash of an ArrayBuffer or Blob.
 * @param {ArrayBuffer|Blob} data
 * @returns {Promise<string>}
 */
export async function calculateSha256(data) {
  let buffer;
  if (typeof Blob !== 'undefined' && data instanceof Blob) {
    buffer = await data.arrayBuffer();
  } else if (data instanceof ArrayBuffer) {
    buffer = data;
  } else if (ArrayBuffer.isView(data)) {
    buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  } else {
    throw new Error('Unsupported data type for SHA-256 calculation');
  }

  // Use Web Crypto API
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  throw new Error('Web Crypto API (crypto.subtle) is not available');
}
