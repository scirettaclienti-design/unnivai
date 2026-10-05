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

    // Gate F: escludi la suite Playwright (e2e/*.spec.ts) — Vitest la
    // considererebbe un test file per il glob default e la caricherebbe con
    // errore (import da @playwright/test non risolve nell'ambiente jsdom).
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'e2e/**',
    ],

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
      // Gate QUOTA-SERVER — le Edge Function (Deno) importano da URL. Sotto
      // Vitest li reindirizziamo a sostituti locali, cosi' il test esegue il
      // file index.ts vero, senza modificarlo.
      'https://deno.land/std@0.177.0/http/server.ts': path.resolve(__dirname, './src/test/mocks/edge/denoServe.js'),
      'https://esm.sh/@supabase/supabase-js@2.39.0': path.resolve(__dirname, './src/test/mocks/edge/supabaseEdge.js'),
    },
  },
})
