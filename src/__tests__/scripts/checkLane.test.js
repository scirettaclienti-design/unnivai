// PAR-0 — la guardia della corsia estetica (scripts/check-lane.mjs).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { checkLane, isAllowedPath, ALLOWED_PATHS } from '../../../scripts/check-lane.mjs';

describe('PAR-0 — check-lane', () => {
    it('fuori dai branch estetica/* non controlla niente', () => {
        expect(checkLane({ branch: 'main', files: ['src/services/dataService.js'] })).toEqual({ checked: false, outside: [] });
        expect(checkLane({ branch: 'diag/composizione', files: ['package.json'] }).checked).toBe(false);
        expect(checkLane({ branch: 'estetica', files: ['package.json'] }).checked).toBe(false);
    });

    it('sui branch estetica/* passano stile, icone e componenti grafici', () => {
        const ok = [
            'src/index.css', 'src/components/Navigation.css', 'src/pages/Home.css', 'src/pages/QuickPath.css',
            'src/styles/themeTokens.js', 'src/assets/react.svg', 'src/assets/icone/stella.png', 'public/vite.svg',
            'src/components/PromotionalBanner.jsx', 'src/components/Map/AIAskButton.jsx',
        ];
        expect(checkLane({ branch: 'estetica/check-olio', files: ok })).toEqual({ checked: true, outside: [] });
    });

    it('sui branch estetica/* tutto il resto viene bloccato', () => {
        const no = [
            'src/services/aiRecommendationService.js', 'src/lib/narrationLight.js', 'src/hooks/useUserContext.js',
            'src/context/AuthContext.jsx', 'src/store/useStore.js', 'supabase/migrations/x.sql', 'scripts/check-lane.mjs',
            'src/__tests__/x.test.js', 'e2e/smoke.spec.ts', 'package.json', 'package-lock.json', 'tailwind.config.js',
            'vite.config.js', '.github/workflows/ci.yml', 'vercel.json', 'docs/PARALLELO.md', 'CLAUDE.md',
            'src/pages/Home.jsx', 'src/components/TopBar.jsx', 'src/pages/sub/Home.css', 'public/manifest.json',
            'src/styles/altro.js', 'src/index.cssx',
        ];
        expect(checkLane({ branch: 'estetica/x', files: no }).outside).toEqual(no);
        expect(no.some(isAllowedPath)).toBe(false);
    });

    it('l\'elenco di docs/PARALLELO.md e quello dello script coincidono', () => {
        const doc = readFileSync(path.resolve(__dirname, '../../../docs/PARALLELO.md'), 'utf8');
        const blocco = doc.split('<!-- ELENCO-AMMESSI:INIZIO -->')[1].split('<!-- ELENCO-AMMESSI:FINE -->')[0];
        const righe = blocco.split('\n').map(s => s.trim()).filter(s => s && !s.startsWith('```'));
        expect(righe).toEqual(ALLOWED_PATHS);
    });
});
