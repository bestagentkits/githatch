// ============================================================================
// GitHoot Pure Web Crypto & Deterministic SHA-256 Hashing
// (src/server/services/crypto/web-crypto.ts)
// Single-Source Implementation powered strictly by crypto.subtle.digest
// ============================================================================

export type HashableBinary = string | ArrayBuffer | Uint8Array;

/**
 * Computes raw SHA-256 ArrayBuffer digest using Web Crypto API.
 * Fails closed if Web Crypto API is not present.
 */
export async function sha256Digest(input: HashableBinary): Promise<ArrayBuffer> {
  if (typeof crypto === 'undefined' || !crypto.subtle || typeof crypto.subtle.digest !== 'function') {
    throw new Error('Web Crypto API (crypto.subtle.digest) is not available in current runtime environment.');
  }

  let buffer: BufferSource;
  if (typeof input === 'string') {
    buffer = new TextEncoder().encode(input);
  } else if (input instanceof Uint8Array) {
    buffer = input as Uint8Array<ArrayBuffer>;
  } else if (input instanceof ArrayBuffer) {
    buffer = input;
  } else {
    throw new TypeError('Invalid input type for sha256Digest: expected string, ArrayBuffer, or Uint8Array');
  }

  return await crypto.subtle.digest('SHA-256', buffer);
}

/**
 * Returns lowercase hex-encoded 64-character SHA-256 digest.
 * Single implementation used across Node.js and workerd (Cloudflare Workers).
 */
export async function sha256Hex(input: HashableBinary): Promise<string> {
  const digestBuffer = await sha256Digest(input);
  const bytes = new Uint8Array(digestBuffer);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i]!.toString(16).padStart(2, '0');
  }
  return hex;
}
