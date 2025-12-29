import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  base: '/',
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
})
