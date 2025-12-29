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
  // 🌐 Production: serve from /backoffice path
  base: process.env.NODE_ENV === 'production' ? '/backoffice/' : '/',
  server: {
    port: 3002,
    strictPort: true,  // 🔐 MUST use port 3002, fail if busy
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      // ✅ EXPLICIT input specification for Heroku
      // MUST use import.meta.url because __dirname points to monorepo root in Heroku build
      input: new URL('./index.html', import.meta.url).pathname,
    },
  },
})
