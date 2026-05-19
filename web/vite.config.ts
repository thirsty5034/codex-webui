import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: '../public',
    emptyOutDir: true,
    // Target modern browsers so the CSS minifier keeps unprefixed
    // backdrop-filter (the -webkit- only output breaks glass effects).
    cssTarget: ['chrome100', 'safari16', 'firefox100'],
    rolldownOptions: {
      output: {
        codeSplitting: true,
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8172',
      '/socket.io': {
        target: 'http://localhost:8172',
        ws: true,
      },
    },
  },
});
