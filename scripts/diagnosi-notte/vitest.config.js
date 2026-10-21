// DIAGNOSI-NOTTE — i test che riproducono i due difetti. Fuori dalla suite (nome `*.diagnosi.js`, non `*.test.js`): su main
// FALLISCONO apposta, quindi la CI non li lancia. Si lanciano a mano:
//   npx vitest run -c scripts/diagnosi-notte/vitest.config.js
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';
export default defineConfig({
    plugins: [react()],
    resolve: { alias: { '@': path.resolve(process.cwd(), 'src') } },
    test: {
        environment: 'jsdom', globals: true,
        include: ['scripts/diagnosi-notte/*.diagnosi.js'],
        setupFiles: ['./src/test/setup.js'],
        testTimeout: 60000,
    },
});
