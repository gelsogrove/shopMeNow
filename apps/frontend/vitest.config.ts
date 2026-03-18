import react from '@vitejs/plugin-react'
import path from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./__tests__/setup.ts'],
    fakeTimers: {
      // React 18 scheduler uses MessageChannel for async state commits.
      // Faking MessageChannel lets vi.runAllTimersAsync() flush React renders
      // when tests use vi.useFakeTimers().
      shouldAdvanceTime: true,
      advanceTimeDelta: 15,
      toFake: [
        'setTimeout', 'clearTimeout',
        'setInterval', 'clearInterval',
        'setImmediate', 'clearImmediate',
        'Date', 'MessageChannel',
      ],
    },
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
