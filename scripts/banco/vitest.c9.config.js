// C9-DIAGNOSI — configurazione dello script di diagnosi (registrazione dal vivo e replay a 0 $).
// Non entra nella suite: il file e' .live.js, non .test.js.
import { defineConfig } from 'vitest/config';
import path from 'node:path';
export default defineConfig({
    resolve: { alias: { '@': path.resolve(process.cwd(), 'src') } },
    test: {
        environment: 'jsdom', globals: true,
        include: ['scripts/banco/diagnosi-c9.live.js', 'scripts/banco/diagnosi-c9-pool.live.js'],
        setupFiles: ['./scripts/prova-reale/env.js'],
        testTimeout: 300000,
        hookTimeout: 60000,
        sequence: { concurrent: false },
    },
});
