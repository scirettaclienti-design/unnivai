// P3d-h — configurazione per gli script di misura dei fatti (rete vera, nessuna quota AI).
// Non entra nella suite: i file qui dentro finiscono in .live.js, non in .test.js.
import { defineConfig } from 'vitest/config';
import path from 'node:path';
export default defineConfig({
    resolve: { alias: { '@': path.resolve(process.cwd(), 'src') } },
    test: {
        environment: 'jsdom', globals: true,
        include: ['scripts/fatti/*.live.js'],
        // NON src/test/setup.js: quello sostituisce Supabase con un finto, e la
        // cache place_facts non si leggerebbe ne' scriverebbe mai.
        setupFiles: ['./scripts/fatti/env.js'],
        testTimeout: 600000,
    },
});
