import react from '@vitejs/plugin-react'
import path from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./__tests__/setup.ts'],
    include: ['__tests__/**/*.{test,spec}.{ts,tsx}'],
    deps: {
      inline: [
        '@radix-ui/react-presence',
        '@radix-ui/react-focus-scope',
        '@radix-ui/react-dismissable-layer',
        '@radix-ui/react-portal',
        '@radix-ui/react-slot',
        '@radix-ui/react-primitive',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
