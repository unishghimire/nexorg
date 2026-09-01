import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3002,
    proxy: {
      '/api': {
        target: 'http://localhost:3005',
        changeOrigin: true,
      },
    },
  },
  build: {
    target: 'esnext',
    sourcemap: false,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (id.includes('react-router-dom') || id.includes('react-router')) return 'router-vendor';
            if (id.includes('lucide-react')) return 'icons-vendor';
            if (id.includes('firebase/firestore') || id.includes('@firebase/firestore')) return 'firebase-firestore';
            if (id.includes('firebase/auth') || id.includes('@firebase/auth')) return 'firebase-auth';
            if (id.includes('firebase')) return 'firebase-vendor';
            return 'vendor';
          }
        },
      },
    },
  },
});
