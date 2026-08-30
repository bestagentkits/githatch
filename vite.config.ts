import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
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
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    rollupOptions: {
      input: 'index.html'
    }
  },
  test: {
    include: ['tests/**/*.test.ts']
  }
});
