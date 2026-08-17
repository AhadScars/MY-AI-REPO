import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron/simple';

export default defineConfig({
  // Required for Electron: relative asset URLs work after install (file://)
  base: './',
  plugins: [
    react(),
    electron({
      main: {
        entry: 'electron/main/main.ts',
        vite: {
          build: {
            outDir: 'dist-electron/main',
            rollupOptions: {
              // Native modules must not be bundled
              external: ['electron', 'node-pty', 'sql.js', 'mysql2', 'mysql2/promise'],
            },
          },
        },
      },
      preload: {
        input: 'electron/preload/preload.ts',
        vite: {
          build: {
            outDir: 'dist-electron/preload',
            rollupOptions: {
              external: ['electron'],
            },
          },
        },
      },
      renderer: {},
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@protocol': path.resolve(__dirname, 'packages/protocol/src'),
      '@shared': path.resolve(__dirname, 'packages/shared/src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
