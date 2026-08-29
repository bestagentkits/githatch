// ============================================================================
// GitHoot Pure TypeScript PNG Codec (Encoder & Decoder) for Cloudflare Workers
// (src/server/services/image/png-codec.ts)
// ============================================================================

export interface DecodedImage {
  width: number;
  height: number;
  data: Uint8Array; // 32-bit RGBA pixels
}

// CRC-32 Table for PNG checksum calculation
const CRC_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c;
  }
  return table;
})();

function crc32(buf: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function adler32(buf: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (let i = 0; i < buf.length; i++) {
    a = (a + buf[i]) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

function paethPredictor(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

/**
 * Decodes a PNG binary buffer into raw 32-bit RGBA pixels.
 * Uses Web Streams DecompressionStream for deflation and applies PNG scanline unfiltering.
 */
export async function decodePngToRgba(pngBytes: Uint8Array): Promise<DecodedImage> {
  const view = new DataView(pngBytes.buffer, pngBytes.byteOffset, pngBytes.byteLength);
  let offset = 8; // skip PNG signature
  let width = 0;
  let height = 0;
  let colorType = 6;
  const idatChunks: Uint8Array[] = [];

  while (offset < pngBytes.length) {
    const length = view.getUint32(offset);
    const type = String.fromCharCode(
      pngBytes[offset + 4] ?? 0,
      pngBytes[offset + 5] ?? 0,
      pngBytes[offset + 6] ?? 0,
      pngBytes[offset + 7] ?? 0
    );
    const chunkData = pngBytes.subarray(offset + 8, offset + 8 + length);

    if (type === 'IHDR') {
      width = view.getUint32(offset + 8);
      height = view.getUint32(offset + 12);
      colorType = pngBytes[offset + 17] ?? 6;
    } else if (type === 'IDAT') {
      idatChunks.push(chunkData);
    } else if (type === 'IEND') {
      break;
    }
    offset += 12 + length;
  }

  if (width === 0 || height === 0) {
    throw new Error('Invalid PNG header: missing IHDR');
  }

  // Concatenate IDAT data
  const totalIdatLen = idatChunks.reduce((acc, c) => acc + c.length, 0);
  const combinedIdat = new Uint8Array(totalIdatLen);
  let idatOffset = 0;
  for (const c of idatChunks) {
    combinedIdat.set(c, idatOffset);
    idatOffset += c.length;
  }

  // Decompress zlib stream using DecompressionStream('deflate')
  const ds = new DecompressionStream('deflate');
  const writer = ds.writable.getWriter();
  writer.write(combinedIdat).catch(() => {});
  writer.close().catch(() => {});

  const response = new Response(ds.readable);
  const decompressedBuf = await response.arrayBuffer();
  const raw = new Uint8Array(decompressedBuf);

  const bpp = colorType === 6 ? 4 : colorType === 2 ? 3 : 4;
  const stride = 1 + width * bpp;
  const rgba = new Uint8Array(width * height * 4);

  const prevRow = new Uint8Array(width * bpp);
  const currRow = new Uint8Array(width * bpp);

  for (let y = 0; y < height; y++) {
    const filterType = raw[y * stride] ?? 0;
    const rowStart = y * stride + 1;

    for (let i = 0; i < width * bpp; i++) {
      const x = raw[rowStart + i] ?? 0;
      const a = i >= bpp ? (currRow[i - bpp] ?? 0) : 0;
      const b = prevRow[i] ?? 0;
      const c = i >= bpp ? (prevRow[i - bpp] ?? 0) : 0;

      let val = x;
      if (filterType === 1) val = (x + a) & 0xff; // Sub
      else if (filterType === 2) val = (x + b) & 0xff; // Up
      else if (filterType === 3) val = (x + Math.floor((a + b) / 2)) & 0xff; // Average
      else if (filterType === 4) val = (x + paethPredictor(a, b, c)) & 0xff; // Paeth

      currRow[i] = val;
    }

    // Copy uncompressed scanline to RGBA output
    for (let x = 0; x < width; x++) {
      const outIdx = (y * width + x) * 4;
      const inIdx = x * bpp;
      if (bpp === 4) {
        rgba[outIdx] = currRow[inIdx] ?? 0;
        rgba[outIdx + 1] = currRow[inIdx + 1] ?? 0;
        rgba[outIdx + 2] = currRow[inIdx + 2] ?? 0;
        rgba[outIdx + 3] = currRow[inIdx + 3] ?? 255;
      } else if (bpp === 3) {
        rgba[outIdx] = currRow[inIdx] ?? 0;
        rgba[outIdx + 1] = currRow[inIdx + 1] ?? 0;
        rgba[outIdx + 2] = currRow[inIdx + 2] ?? 0;
        rgba[outIdx + 3] = 255;
      }
    }

    prevRow.set(currRow);
  }

  return { width, height, data: rgba };
}

/**
 * Encodes raw 32-bit RGBA pixel buffer into standard PNG binary format.
 */
export function encodeRgbaToPng(
  rgbaData: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number
): Uint8Array {
  const lineSize = 1 + width * 4;
  const rawData = new Uint8Array(lineSize * height);

  for (let y = 0; y < height; y++) {
    const rawOffset = y * lineSize;
    rawData[rawOffset] = 0; // Filter type 0 (None)

    const rgbaOffset = y * width * 4;
    for (let x = 0; x < width * 4; x++) {
      rawData[rawOffset + 1 + x] = rgbaData[rgbaOffset + x] ?? 0;
    }
  }

  const maxBlockSize = 65535;
  const numBlocks = Math.ceil(rawData.length / maxBlockSize);
  const zlibData: number[] = [0x78, 0x01]; // Zlib header

  for (let b = 0; b < numBlocks; b++) {
    const start = b * maxBlockSize;
    const end = Math.min(start + maxBlockSize, rawData.length);
    const blockLen = end - start;
    const isFinal = b === numBlocks - 1 ? 1 : 0;

    zlibData.push(isFinal);
    zlibData.push(blockLen & 0xff, (blockLen >> 8) & 0xff);
    zlibData.push((~blockLen) & 0xff, ((~blockLen) >> 8) & 0xff);

    for (let i = start; i < end; i++) {
      zlibData.push(rawData[i] ?? 0);
    }
  }

  const adler = adler32(rawData);
  zlibData.push((adler >> 24) & 0xff, (adler >> 16) & 0xff, (adler >> 8) & 0xff, adler & 0xff);

  const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

  const ihdrData = new Uint8Array(13);
  const view = new DataView(ihdrData.buffer);
  view.setUint32(0, width, false);
  view.setUint32(4, height, false);
  ihdrData[8] = 8;
  ihdrData[9] = 6;
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;

  const ihdrChunk = createPngChunk('IHDR', ihdrData);
  const idatChunk = createPngChunk('IDAT', new Uint8Array(zlibData));
  const iendChunk = createPngChunk('IEND', new Uint8Array(0));

  const totalLength = pngSignature.length + ihdrChunk.length + idatChunk.length + iendChunk.length;
  const result = new Uint8Array(totalLength);

  let offset = 0;
  result.set(pngSignature, offset);
  offset += pngSignature.length;

  result.set(ihdrChunk, offset);
  offset += ihdrChunk.length;

  result.set(idatChunk, offset);
  offset += idatChunk.length;

  result.set(iendChunk, offset);
  return result;
}

function createPngChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new TextEncoder().encode(type);
  const chunk = new Uint8Array(4 + 4 + data.length + 4);
  const view = new DataView(chunk.buffer);

  view.setUint32(0, data.length, false);
  chunk.set(typeBytes, 4);
  chunk.set(data, 8);

  const crcTarget = new Uint8Array(typeBytes.length + data.length);
  crcTarget.set(typeBytes, 0);
  crcTarget.set(data, typeBytes.length);

  const chunkCrc = crc32(crcTarget);
  view.setUint32(8 + data.length, chunkCrc, false);

  return chunk;
}
