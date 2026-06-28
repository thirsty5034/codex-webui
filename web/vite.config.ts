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
    rolldownOptions: {
      output: {
        codeSplitting: true,
        manualChunks(id: string) {
          // Keep React core together
          if (id.includes('/node_modules/react/') || id.includes('/node_modules/react-dom/') || id.includes('/scheduler/')) {
            return 'vendor-react';
          }
          // TanStack ecosystem
          if (id.includes('/node_modules/@tanstack/react-query/') || id.includes('/node_modules/@tanstack/react-router/') || id.includes('/node_modules/@tanstack/react-virtual/')) {
            return 'vendor-tanstack';
          }
          // UI framework libs
          if (id.includes('/node_modules/radix-ui/') || id.includes('/node_modules/framer-motion/') || id.includes('/node_modules/lucide-react/')) {
            return 'vendor-ui';
          }
          // Terminal emulator (rarely changed)
          if (id.includes('/node_modules/@xterm/')) {
            return 'vendor-xterm';
          }
          // Shiki highlighting suite
          if (id.includes('/node_modules/shiki/') || id.includes('/node_modules/@shikiji/') || id.includes('/node_modules/@shikijs/')) {
            return 'vendor-shiki';
          }
          // Markdown rendering
          if (id.includes('/node_modules/react-markdown/') || id.includes('/node_modules/remark-')) {
            return 'vendor-markdown';
          }
        },
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
