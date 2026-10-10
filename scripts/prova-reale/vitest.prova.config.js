// TEST-ACC — configurazione delle prove reali (rete vera, quota AI vera).
// Non entra nella suite: i file qui dentro finiscono in .live.js, non in .test.js.
// Uso:  PROVA_RICHIESTE=roma,catania,perte npx vitest run -c scripts/prova-reale/vitest.prova.config.js
import { defineConfig } from 'vitest/config';
import path from 'node:path';
export default defineConfig({
    resolve: { alias: { '@': path.resolve(process.cwd(), 'src') } },
    test: {
        environment: 'jsdom', globals: true,
        include: ['scripts/prova-reale/*.live.js'],
        // NON src/test/setup.js: quello sostituisce Supabase con un finto.
        setupFiles: ['./scripts/prova-reale/env.js'],
        testTimeout: 300000,
        sequence: { concurrent: false },
    },
});
