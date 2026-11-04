// DNA-5 — la prova dei tre utenti finti, rigiocata dai tracciati del banco (0 $, nessuna rete). Non entra nella suite.
import { defineConfig } from 'vitest/config';
import path from 'node:path';
export default defineConfig({
    resolve: { alias: { '@': path.resolve(process.cwd(), 'src') } },
    test: {
        environment: 'jsdom', globals: true,
        include: ['scripts/prova-dna5/dna5.replay.js'],
        setupFiles: ['./scripts/banco/replay/ambiente.js'],
        testTimeout: 120000,
        sequence: { concurrent: false },
    },
});
