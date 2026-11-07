// T29 — l'audit del DNA: storia finta e giro rigiocato dal tracciato, 0 $. Non entra nella suite.
import { defineConfig } from 'vitest/config';
import path from 'node:path';
export default defineConfig({
    resolve: { alias: { '@': path.resolve(process.cwd(), 'src') } },
    test: { environment: 'jsdom', globals: true, include: ['scripts/impostazioni/dna-audit.giro.js'], setupFiles: ['./scripts/banco/replay/ambiente.js'], testTimeout: 300000 },
});
