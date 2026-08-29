// Ambient types for Cloudflare Edge bindings
declare global {
  interface D1Result<T = unknown> {
    results?: T[];
    success: boolean;
    error?: string;
    meta?: Record<string, unknown>;
  }

  interface D1PreparedStatement {
    bind(...values: unknown[]): D1PreparedStatement;
    first<T = unknown>(colName?: string): Promise<T | null>;
    run<T = unknown>(): Promise<D1Result<T>>;
    all<T = unknown>(): Promise<D1Result<T>>;
  }

  interface D1Database {
    prepare(query: string): D1PreparedStatement;
    batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
    exec(query: string): Promise<D1Result>;
  }

  interface R2PutOptions {
    httpMetadata?: {
      contentType?: string;
      cacheControl?: string;
    };
  }

  interface R2Object {
    key: string;
    version: string;
    size: number;
    etag: string;
  }

  interface R2Bucket {
    get(key: string): Promise<R2Object | null>;
    put(key: string, value: ArrayBuffer | ArrayBufferView | ReadableStream | string | Blob, options?: R2PutOptions): Promise<R2Object | null>;
    delete(keys: string | string[]): Promise<void>;
  }

  interface KVNamespace {
    get(key: string, options?: 'text'): Promise<string | null>;
    get<T = unknown>(key: string, options: 'json'): Promise<T | null>;
    put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
    delete(key: string): Promise<void>;
  }

  interface Message<T = unknown> {
    id: string;
    timestamp: Date;
    body: T;
    ack(): void;
    retry(): void;
  }

  interface MessageBatch<T = unknown> {
    queue: string;
    messages: readonly Message<T>[];
    ackAll(): void;
    retryAll(): void;
  }

  interface Queue<T = unknown> {
    send(message: T): Promise<void>;
  }
}

export {};
