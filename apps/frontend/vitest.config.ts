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
      // React 18 scheduler uses setTimeout internally.
      // shouldAdvanceTime=true ensures fake timers advance with real time
      // so React can commit state updates even when vi.useFakeTimers() is active.
      shouldAdvanceTime: true,
      advanceTimeDelta: 15,
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
