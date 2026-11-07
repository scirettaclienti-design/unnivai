// T29 IMPOSTAZIONI-VERIFICA — il confronto delle impostazioni rigiocato dai tracciati: motore vero, nessuna rete, 0 $.
// Non entra nella suite (il file dei casi e' .giro.js). Si lancia con `node scripts/impostazioni/verifica.mjs`.
import { defineConfig } from 'vitest/config';
import path from 'node:path';
export default defineConfig({
    resolve: { alias: { '@': path.resolve(process.cwd(), 'src') } },
    test: {
        environment: 'jsdom', globals: true,
        include: ['scripts/impostazioni/varianti.giro.js'],
        setupFiles: ['./scripts/banco/replay/ambiente.js'],
        testTimeout: 120000,
        sequence: { concurrent: false },
    },
});
