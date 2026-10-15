// BORGO-DIAGNOSI — il replay con l'imbuto (scripts/banco/diagnosi-borgo.giro.js): 0 $, nessuna rete. Non entra nella suite.
import { defineConfig } from 'vitest/config';
import path from 'node:path';
export default defineConfig({
    resolve: { alias: { '@': path.resolve(process.cwd(), 'src') } },
    test: {
        environment: 'jsdom', globals: true,
        include: ['scripts/banco/diagnosi-borgo.giro.js'],
        setupFiles: ['./scripts/banco/replay/ambiente.js'],
        testTimeout: 120000,
        sequence: { concurrent: false },
    },
});
