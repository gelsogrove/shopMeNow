import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // 🌐 Standalone SPA - serve from root path (/)
  base: '/',
  server: {
    port: 3002,
    strictPort: true,  // 🔐 MUST use port 3002, fail if busy
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
})
