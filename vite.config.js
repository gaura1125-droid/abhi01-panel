import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        login: path.resolve(__dirname, 'login/index.html'),
      },
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': 'http://localhost:3000',
      '/login': 'http://localhost:3000',
    },
  },
});