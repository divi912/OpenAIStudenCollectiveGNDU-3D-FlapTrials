import { defineConfig, loadEnv } from 'vite';

// Public deployment metadata is embedded in every build. It is used only on the
// configured public origin; LAN/preview builds continue using their own server.
const hosted = loadEnv('cloudflare', process.cwd(), 'VITE_');
export default defineConfig({
  define: {
    __FLAP_HOSTED_BACKEND__: JSON.stringify({ origin: hosted.VITE_CLIENT_ORIGIN, server: hosted.VITE_SERVER_URL }),
  },
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
