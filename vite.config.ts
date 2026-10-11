import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import quoteHandler from './api/quote.js';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'quote-api-middleware',
      configureServer(server) {
        server.middlewares.use('/api/quote', async (req, res) => {
          await quoteHandler(req, res);
        });
      }
    }
  ],
  server: {
    port: 3000,
    open: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
