import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3001,
    open: true,
    proxy: {
      '/api': 'http://localhost:5000',
      '/ws': {
        target: 'ws://localhost:5000',
        ws: true
      }
    }
  },
  root: 'client',
  publicDir: 'public'
});