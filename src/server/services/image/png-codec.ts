// ============================================================================
// GitHoot Pure TypeScript PNG Codec (Encoder & Decoder) for Cloudflare Workers
// (src/server/services/image/png-codec.ts)
// Strict Fail-Closed PNG Specification Compliance (Non-interlaced 8-bit RGBA/RGB only)
// ============================================================================

export interface DecodedImage {
  width: number;
  height: number;
  data: Uint8Array;
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

export function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]!) & 0xff]! ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function adler32(buf: Uint8Array): number {
  let s1 = 1;
  let s2 = 0;
  for (let i = 0; i < buf.length; i++) {
    s1 = (s1 + buf[i]!) % 65521;
    s2 = (s2 + s1) % 65521;
  }
  return ((s2 << 16) | s1) >>> 0;
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

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/**
 * Decodes a PNG binary buffer into raw 32-bit RGBA pixels.
 * Strictly validates signature, IHDR (8-bit, non-interlaced, RGBA/RGB only),
 * chunk CRCs, decompressed scanline bounds, and filter types (0-4).
 */
export async function decodePngToRgba(pngBytes: Uint8Array): Promise<DecodedImage> {
  if (!pngBytes || pngBytes.length < 33) {
    throw new Error('Invalid PNG: file is too small or truncated (<33 bytes)');
  }

  // 1. Verify 8-byte PNG signature
  for (let i = 0; i < 8; i++) {
    if (pngBytes[i] !== PNG_SIGNATURE[i]) {
      throw new Error('Invalid PNG signature: buffer does not match PNG magic bytes');
    }
  }

  const view = new DataView(pngBytes.buffer, pngBytes.byteOffset, pngBytes.byteLength);
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 8;
  let colorType = 6;
  let compressionMethod = 0;
  let filterMethod = 0;
  let interlaceMethod = 0;
  let ihdrFound = false;
  const idatChunks: Uint8Array[] = [];

  // 2. Parse chunks with strict bounds & CRC-32 validation
  while (offset < pngBytes.length) {
    if (offset + 8 > pngBytes.length) {
      throw new Error(`Truncated PNG: incomplete chunk header at offset ${offset}`);
    }

    const length = view.getUint32(offset);
    const type = String.fromCharCode(
      pngBytes[offset + 4]!,
      pngBytes[offset + 5]!,
      pngBytes[offset + 6]!,
      pngBytes[offset + 7]!
    );

    if (offset + 12 + length > pngBytes.length) {
      throw new Error(`Truncated PNG: chunk ${type} length ${length} extends past end of file`);
    }

    // Verify chunk CRC-32 (covers chunk type + chunk data)
    const chunkTypeAndData = pngBytes.subarray(offset + 4, offset + 8 + length);
    const expectedCrc = view.getUint32(offset + 8 + length);
    const calculatedCrc = crc32(chunkTypeAndData);
    if (calculatedCrc !== expectedCrc) {
      throw new Error(`Corrupted PNG: CRC-32 mismatch in chunk ${type} (expected 0x${expectedCrc.toString(16)}, got 0x${calculatedCrc.toString(16)})`);
    }

    const chunkData = pngBytes.subarray(offset + 8, offset + 8 + length);

    if (type === 'IHDR') {
      if (length !== 13) {
        throw new Error(`Invalid IHDR chunk length: expected 13 bytes, got ${length}`);
      }
      width = view.getUint32(offset + 8);
      height = view.getUint32(offset + 12);
      bitDepth = pngBytes[offset + 16]!;
      colorType = pngBytes[offset + 17]!;
      compressionMethod = pngBytes[offset + 18]!;
      filterMethod = pngBytes[offset + 19]!;
      interlaceMethod = pngBytes[offset + 20]!;
      ihdrFound = true;
    } else if (type === 'IDAT') {
      if (!ihdrFound) {
        throw new Error('Invalid PNG: IDAT chunk encountered before IHDR');
      }
      idatChunks.push(chunkData);
    } else if (type === 'IEND') {
      break;
    }

    offset += 12 + length;
  }

  if (!ihdrFound || width === 0 || height === 0) {
    throw new Error('Invalid PNG: missing or invalid IHDR header chunk');
  }

  // 3. Strict IHDR specification constraints
  if (bitDepth !== 8) {
    throw new Error(`Unsupported PNG bit depth: ${bitDepth} (only 8-bit depth supported)`);
  }

  if (colorType !== 6 && colorType !== 2) {
    throw new Error(`Unsupported PNG color type: ${colorType} (only RGBA=6 and RGB=2 supported)`);
  }

  if (compressionMethod !== 0) {
    throw new Error(`Unsupported PNG compression method: ${compressionMethod} (expected 0 deflate)`);
  }

  if (filterMethod !== 0) {
    throw new Error(`Unsupported PNG filter method: ${filterMethod} (expected 0 adaptive)`);
  }

  if (interlaceMethod !== 0) {
    throw new Error(`Unsupported interlaced PNG: interlaceMethod ${interlaceMethod} (only non-interlaced 0 supported)`);
  }

  if (idatChunks.length === 0) {
    throw new Error('Invalid PNG: no IDAT image data chunks found');
  }

  // 4. Concatenate IDAT data
  const totalIdatLen = idatChunks.reduce((acc, c) => acc + c.length, 0);
  const combinedIdat = new Uint8Array(totalIdatLen);
  let idatOffset = 0;
  for (const c of idatChunks) {
    combinedIdat.set(c, idatOffset);
    idatOffset += c.length;
  }

  // 5. Decompress zlib stream using DecompressionStream('deflate')
  let raw: Uint8Array;
  try {
    const ds = new DecompressionStream('deflate');
    const writer = ds.writable.getWriter();
    writer.write(combinedIdat).catch(() => {});
    writer.close().catch(() => {});

    const response = new Response(ds.readable);
    const decompressedBuf = await response.arrayBuffer();
    raw = new Uint8Array(decompressedBuf);
  } catch (err) {
    throw new Error(`PNG IDAT decompression failed: ${(err as Error).message}`);
  }

  const bpp = colorType === 6 ? 4 : 3;
  const stride = 1 + width * bpp;
  const expectedTotalBytes = height * stride;

  if (raw.length !== expectedTotalBytes) {
    throw new Error(`Corrupted PNG scanline stream: expected ${expectedTotalBytes} decompressed bytes, got ${raw.length}`);
  }

  // 6. Scanline unfiltering & RGBA mapping
  const rgba = new Uint8Array(width * height * 4);
  const prevRow = new Uint8Array(width * bpp);
  const currRow = new Uint8Array(width * bpp);

  for (let y = 0; y < height; y++) {
    const filterType = raw[y * stride]!;
    if (filterType > 4) {
      throw new Error(`Invalid PNG filter type ${filterType} on scanline ${y} (must be 0..4)`);
    }

    const rowStart = y * stride + 1;

    for (let i = 0; i < width * bpp; i++) {
      const x = raw[rowStart + i]!;
      const a = i >= bpp ? currRow[i - bpp]! : 0;
      const b = prevRow[i]!;
      const c = i >= bpp ? prevRow[i - bpp]! : 0;

      let val = x;
      if (filterType === 1) val = (x + a) & 0xff; // Sub
      else if (filterType === 2) val = (x + b) & 0xff; // Up
      else if (filterType === 3) val = (x + Math.floor((a + b) / 2)) & 0xff; // Average
      else if (filterType === 4) val = (x + paethPredictor(a, b, c)) & 0xff; // Paeth

      currRow[i] = val;
    }

    // Copy uncompressed scanline to 32-bit RGBA output
    for (let x = 0; x < width; x++) {
      const outIdx = (y * width + x) * 4;
      const inIdx = x * bpp;
      if (bpp === 4) {
        rgba[outIdx] = currRow[inIdx]!;
        rgba[outIdx + 1] = currRow[inIdx + 1]!;
        rgba[outIdx + 2] = currRow[inIdx + 2]!;
        rgba[outIdx + 3] = currRow[inIdx + 3]!;
      } else {
        rgba[outIdx] = currRow[inIdx]!;
        rgba[outIdx + 1] = currRow[inIdx + 1]!;
        rgba[outIdx + 2] = currRow[inIdx + 2]!;
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
  // 1. Signature
  const signature = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // 2. IHDR Chunk: 13 bytes
  const ihdrData = new Uint8Array(13);
  const ihdrView = new DataView(ihdrData.buffer);
  ihdrView.setUint32(0, width);
  ihdrView.setUint32(4, height);
  ihdrData[8] = 8;  // bit depth: 8
  ihdrData[9] = 6;  // color type: 6 (RGBA)
  ihdrData[10] = 0; // compression: deflate
  ihdrData[11] = 0; // filter: standard
  ihdrData[12] = 0; // interlace: none
  const ihdrChunk = createPngChunk('IHDR', ihdrData);

  // 3. IDAT Chunk
  const stride = 1 + width * 4;
  const rawData = new Uint8Array(height * stride);

  for (let y = 0; y < height; y++) {
    rawData[y * stride] = 0; // filter type: None
    const srcOffset = y * width * 4;
    const dstOffset = y * stride + 1;
    rawData.set(rgbaData.subarray(srcOffset, srcOffset + width * 4), dstOffset);
  }

  const uncompressedLen = rawData.length;
  const maxDeflateLen = 2 + 5 * Math.ceil(uncompressedLen / 65535) + uncompressedLen + 4;
  const deflateBuf = new Uint8Array(maxDeflateLen);
  let defPos = 0;

  // Zlib header (CMF=0x78, FLG=0x01)
  deflateBuf[defPos++] = 0x78;
  deflateBuf[defPos++] = 0x01;

  let bytesLeft = uncompressedLen;
  let rawPos = 0;

  while (bytesLeft > 0) {
    const blockSize = Math.min(bytesLeft, 65535);
    bytesLeft -= blockSize;
    const isFinal = bytesLeft === 0 ? 1 : 0;

    deflateBuf[defPos++] = isFinal; // BFINAL=1/0, BTYPE=00 (uncompressed)
    deflateBuf[defPos++] = blockSize & 0xff;
    deflateBuf[defPos++] = (blockSize >> 8) & 0xff;
    const nlen = (~blockSize) & 0xffff;
    deflateBuf[defPos++] = nlen & 0xff;
    deflateBuf[defPos++] = (nlen >> 8) & 0xff;

    deflateBuf.set(rawData.subarray(rawPos, rawPos + blockSize), defPos);
    defPos += blockSize;
    rawPos += blockSize;
  }

  // Adler-32 checksum (Big-Endian)
  const checksum = adler32(rawData);
  deflateBuf[defPos++] = (checksum >> 24) & 0xff;
  deflateBuf[defPos++] = (checksum >> 16) & 0xff;
  deflateBuf[defPos++] = (checksum >> 8) & 0xff;
  deflateBuf[defPos++] = checksum & 0xff;

  const idatChunk = createPngChunk('IDAT', deflateBuf.subarray(0, defPos));

  // 4. IEND Chunk
  const iendChunk = createPngChunk('IEND', new Uint8Array(0));

  // Combine into single buffer
  const totalLength = signature.length + ihdrChunk.length + idatChunk.length + iendChunk.length;
  const result = new Uint8Array(totalLength);
  let pos = 0;

  result.set(signature, pos); pos += signature.length;
  result.set(ihdrChunk, pos); pos += ihdrChunk.length;
  result.set(idatChunk, pos); pos += idatChunk.length;
  result.set(iendChunk, pos);

  return result;
}

/**
 * Encodes raw 32-bit RGBA pixel buffer into standard compressed PNG binary format using CompressionStream.
 */
export async function encodeRgbaToPngAsync(
  rgbaData: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number
): Promise<Uint8Array> {
  const signature = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdrData = new Uint8Array(13);
  const ihdrView = new DataView(ihdrData.buffer);
  ihdrView.setUint32(0, width);
  ihdrView.setUint32(4, height);
  ihdrData[8] = 8;  // bit depth: 8
  ihdrData[9] = 6;  // color type: 6 (RGBA)
  ihdrData[10] = 0; // compression: deflate
  ihdrData[11] = 0; // filter: standard
  ihdrData[12] = 0; // interlace: none
  const ihdrChunk = createPngChunk('IHDR', ihdrData);

  const stride = 1 + width * 4;
  const rawData = new Uint8Array(height * stride);

  for (let y = 0; y < height; y++) {
    rawData[y * stride] = 0;
    const srcOffset = y * width * 4;
    const dstOffset = y * stride + 1;
    rawData.set(rgbaData.subarray(srcOffset, srcOffset + width * 4), dstOffset);
  }

  // Compress using CompressionStream('deflate')
  const cs = new CompressionStream('deflate');
  const writer = cs.writable.getWriter();
  writer.write(rawData).catch(() => {});
  writer.close().catch(() => {});

  const response = new Response(cs.readable);
  const compressed = new Uint8Array(await response.arrayBuffer());

  const idatChunk = createPngChunk('IDAT', compressed);
  const iendChunk = createPngChunk('IEND', new Uint8Array(0));

  const totalLength = signature.length + ihdrChunk.length + idatChunk.length + iendChunk.length;
  const result = new Uint8Array(totalLength);
  let pos = 0;

  result.set(signature, pos); pos += signature.length;
  result.set(ihdrChunk, pos); pos += ihdrChunk.length;
  result.set(idatChunk, pos); pos += idatChunk.length;
  result.set(iendChunk, pos);

  return result;
}

export function createPngChunk(type: string, data: Uint8Array): Uint8Array {
  const length = data.length;
  const chunk = new Uint8Array(12 + length);
  const view = new DataView(chunk.buffer, chunk.byteOffset, chunk.byteLength);

  view.setUint32(0, length);
  chunk[4] = type.charCodeAt(0);
  chunk[5] = type.charCodeAt(1);
  chunk[6] = type.charCodeAt(2);
  chunk[7] = type.charCodeAt(3);

  chunk.set(data, 8);

  const typeAndData = chunk.subarray(4, 8 + length);
  const checksum = crc32(typeAndData);
  view.setUint32(8 + length, checksum);

  return chunk;
}
