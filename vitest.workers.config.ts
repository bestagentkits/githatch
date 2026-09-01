import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import { defineConfig, type Plugin } from 'vitest/config';
import path from 'path';
import fs from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const wasmPlugin: Plugin = {
  name: 'vite-plugin-wasm-binary',
  enforce: 'pre',
  resolveId(id: string, importer?: string) {
    if (id.endsWith('.wasm')) {
      if (id.startsWith('.')) {
        return path.resolve(path.dirname(importer || ''), id);
      }
      return require.resolve(id);
    }
    return null;
  },
  load(id: string) {
    if (id.endsWith('.wasm')) {
      const cleanPath = id.replace(/\?.*$/, '');
      if (fs.existsSync(cleanPath)) {
        const buffer = fs.readFileSync(cleanPath);
        const base64 = buffer.toString('base64');
        return `
const bin = atob("${base64}");
const bytes = new Uint8Array(bin.length);
for (let i = 0; i < bin.length; i++) {
  bytes[i] = bin.charCodeAt(i);
}
export default bytes;
`;
      }
    }
    return null;
  }
};

const migrations = await readD1Migrations(path.resolve(__dirname, 'src/server/db/migrations'));

export default defineConfig({
  plugins: [
    wasmPlugin,
    cloudflareTest({
      wrangler: {
        configPath: path.resolve(__dirname, 'wrangler.worker.toml')
      }
    })
  ],
  define: {
    __D1_MIGRATIONS__: JSON.stringify(migrations)
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  test: {
    include: ['tests/integration/**/*.test.ts'],
    fileParallelism: false,
    maxConcurrency: 1,
    teardownTimeout: 2000,
    server: {
      deps: {
        inline: [/@jsquash\/webp/, /\.wasm$/]
      }
    }
  }
});
