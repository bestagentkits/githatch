// ============================================================================
// Cloudflare Worker & WASM Type Declarations (src/server/types/cloudflare.d.ts)
// ============================================================================

interface D1Database {
  prepare: (query: string) => D1PreparedStatement;
  batch: <T = unknown>(statements: D1PreparedStatement[]) => Promise<D1Result<T>[]>;
  exec: (query: string) => Promise<D1ExecResult>;
}

interface D1PreparedStatement {
  bind: (...values: unknown[]) => D1PreparedStatement;
  first: <T = unknown>(colName?: string) => Promise<T | null>;
  all: <T = unknown>() => Promise<D1Result<T>>;
  run: <T = unknown>() => Promise<D1Result<T>>;
}

interface D1Result<T = unknown> {
  results?: T[];
  success: boolean;
  error?: string;
  meta?: Record<string, unknown>;
}

interface D1ExecResult {
  count: number;
  duration: number;
}

interface R2Bucket {
  head: (key: string) => Promise<R2Object | null>;
  get: (key: string) => Promise<R2ObjectBody | null>;
  put: (key: string, value: ReadableStream | ArrayBuffer | ArrayBufferView | string | null | Blob, options?: R2PutOptions) => Promise<R2Object | null>;
  delete: (keys: string | string[]) => Promise<void>;
  list: (options?: R2ListOptions) => Promise<R2Objects>;
}

interface R2Object {
  key: string;
  version: string;
  size: number;
  etag: string;
  httpEtag: string;
  uploaded: Date;
  httpMetadata?: Record<string, string>;
  customMetadata?: Record<string, string>;
}

interface R2ObjectBody extends R2Object {
  body: ReadableStream;
  bodyUsed: boolean;
  arrayBuffer: () => Promise<ArrayBuffer>;
  text: () => Promise<string>;
  json: <T>() => Promise<T>;
  blob: () => Promise<Blob>;
}

interface R2PutOptions {
  httpMetadata?: Record<string, string>;
  customMetadata?: Record<string, string>;
}

interface R2ListOptions {
  limit?: number;
  prefix?: string;
  cursor?: string;
  delimiter?: string;
}

interface R2Objects {
  objects: R2Object[];
  truncated: boolean;
  cursor?: string;
}

interface KVNamespace {
  get: {
    (key: string, type?: 'text'): Promise<string | null>;
    <T>(key: string, type: 'json'): Promise<T | null>;
    (key: string, type: 'arrayBuffer'): Promise<ArrayBuffer | null>;
    (key: string, type: 'stream'): Promise<ReadableStream | null>;
  };
  put: (key: string, value: string | ArrayBuffer | ArrayBufferView | ReadableStream, options?: { expiration?: number; expirationTtl?: number; metadata?: unknown }) => Promise<void>;
  delete: (key: string) => Promise<void>;
  list: (options?: { prefix?: string; limit?: number; cursor?: string }) => Promise<{ keys: { name: string; expiration?: number; metadata?: unknown }[]; list_complete: boolean; cursor?: string }>;
}

interface Queue<Body = unknown> {
  send: (body: Body, options?: { delaySeconds?: number }) => Promise<void>;
  sendBatch: (messages: Iterable<{ body: Body; delaySeconds?: number }>) => Promise<void>;
}

interface MessageBatch<Body = unknown> {
  readonly queue: string;
  readonly messages: readonly Message<Body>[];
  ackAll(): void;
  retryAll(): void;
}

interface Message<Body = unknown> {
  readonly id: string;
  readonly timestamp: Date;
  readonly body: Body;
  ack(): void;
  retry(): void;
}

declare module '*.wasm' {
  const content: Uint8Array;
  export default content;
}

declare module '@jsquash/webp/encode.js' {
  export function init(module?: WebAssembly.Module): Promise<any>;
  export default function encode(
    data: { data: Uint8ClampedArray; width: number; height: number },
    options?: { lossless?: number; exact?: number; quality?: number }
  ): Promise<ArrayBuffer>;
}

declare module '@jsquash/webp/decode.js' {
  export function init(module?: WebAssembly.Module): Promise<any>;
  export default function decode(
    buffer: ArrayBuffer
  ): Promise<{ data: Uint8ClampedArray; width: number; height: number }>;
}

declare module '@jsquash/webp/codec/enc/webp_enc_simd.wasm' {
  const content: Uint8Array;
  export default content;
}

declare module '@jsquash/webp/codec/dec/webp_dec.wasm' {
  const content: Uint8Array;
  export default content;
}
