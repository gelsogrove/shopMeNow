import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
// In production the backoffice is served by echatbot-app under /backoffice
// (path-based, same origin as the API). In dev it stays at the root of :3002.
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  base: mode === 'production' ? '/backoffice/' : '/',
  server: {
    port: 3002,
    strictPort: true,
  },
  build: {
    rollupOptions: {
      input: new URL('./index.html', import.meta.url).pathname,
    },
    minify: true,
    sourcemap: true,
    emptyOutDir: true,
  },
}))
