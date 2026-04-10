import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    // jsdom simulates browser APIs (localStorage, navigator.geolocation, fetch)
    environment: 'jsdom',

    // Inject describe/it/expect/vi globally (same DX as Jest)
    globals: true,

    // Runs before every test file
    setupFiles: ['./src/test/setup.js'],

    // Isolate module state between test files (prevents singleton contamination)
    isolate: true,

    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      // Focus coverage on business logic, not UI components
      include: [
        'src/services/**',
        'src/hooks/**',
        'src/utils/**',
      ],
      exclude: [
        'src/test/**',
        'node_modules/**',
      ],
    },
  },
  resolve: {
    alias: {
      // Mirrors vite.config.js so imports like '@/services/...' work in tests
      '@': path.resolve(__dirname, './src'),
    },
  },
})
