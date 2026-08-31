import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
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

export default defineConfig({
  plugins: [wasmPlugin, react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8788',
      '/badge': 'http://localhost:8788',
      '/og': 'http://localhost:8788',
      '/auth': 'http://localhost:8788'
    }
  },
  // @ts-ignore
  test: {
    server: {
      deps: {
        inline: [/@jsquash\/webp/, /\.wasm$/]
      }
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    rollupOptions: {
      input: 'index.html'
    }
  }
});
