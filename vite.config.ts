import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      '/matchmake': 'http://127.0.0.1:2567',
      '/api': 'http://127.0.0.1:2567',
      '/health': 'http://127.0.0.1:2567',
      '/ws': { target: 'ws://127.0.0.1:2567', ws: true },
    },
  },
  build: { target: 'es2022', outDir: 'dist/client', chunkSizeWarningLimit: 650 },
});
