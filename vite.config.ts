import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Multi-page: cinematic landing (index.html) + the simulator (simulator.html).
export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    target: 'es2020',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        simulator: resolve(__dirname, 'simulator.html'),
      },
    },
  },
  server: {
    port: 3000,
    open: true,
  },
});
