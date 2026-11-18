import { defineConfig } from 'vite';

export default defineConfig({
  root: 'client',
  build: { outDir: '../dist', emptyOutDir: true },
  server: {
    proxy: {
      '/api': 'http://localhost:2567',
      '/ws': { target: 'ws://localhost:2567', ws: true },
    },
  },
});
