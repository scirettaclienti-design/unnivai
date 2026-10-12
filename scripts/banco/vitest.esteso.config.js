// BANCO-ESTESO — configurazione del banco esteso (rete vera, quota AI vera).
// Non entra nella suite: il file dei casi e' .live.js, non .test.js.
// Si lancia con `npm run banco:esteso` (scripts/banco/esteso.mjs).
import { defineConfig } from 'vitest/config';
import path from 'node:path';
export default defineConfig({
    resolve: { alias: { '@': path.resolve(process.cwd(), 'src') } },
    test: {
        environment: 'jsdom', globals: true,
        include: ['scripts/banco/esteso.live.js'],
        // Lo stesso ambiente della prova reale: .env + .env.local, Supabase vero.
        setupFiles: ['./scripts/prova-reale/env.js'],
        testTimeout: 300000,
        hookTimeout: 60000,
        sequence: { concurrent: false },
    },
});
