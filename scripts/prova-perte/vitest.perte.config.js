// PER-TE-TRE (T27) — diagnosi e prova di Per Te dai tracciati (0 $). Non entra nella suite.
import { defineConfig } from 'vitest/config';
import path from 'node:path';
export default defineConfig({
    resolve: { alias: { '@': path.resolve(process.cwd(), 'src') } },
    test: {
        environment: 'jsdom', globals: true,
        include: ['scripts/prova-perte/*.giro.js'],
        setupFiles: ['./scripts/banco/replay/ambiente.js'],
        testTimeout: 180000,
        sequence: { concurrent: false },
    },
});
