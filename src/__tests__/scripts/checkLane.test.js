// PAR-0 — la guardia della corsia estetica (scripts/check-lane.mjs).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { checkLane, isAllowedPath, ALLOWED_PATHS, jsxViolations, grantedFiles } from '../../../scripts/check-lane.mjs';

describe('PAR-0 — check-lane', () => {
    it('fuori dai branch estetica/* non controlla niente', () => {
        expect(checkLane({ branch: 'main', files: ['src/services/dataService.js'] })).toMatchObject({ checked: false, outside: [] });
        expect(checkLane({ branch: 'diag/composizione', files: ['package.json'] }).checked).toBe(false);
        expect(checkLane({ branch: 'estetica', files: ['package.json'] }).checked).toBe(false);
    });

    it('sui branch estetica/* passano stile, icone e componenti grafici', () => {
        const ok = [
            'src/index.css', 'src/components/Navigation.css', 'src/pages/Home.css', 'src/pages/QuickPath.css',
            'src/styles/themeTokens.js', 'src/assets/react.svg', 'src/assets/icone/stella.png', 'public/vite.svg',
            'src/components/PromotionalBanner.jsx', 'src/components/Map/AIAskButton.jsx',
        ];
        expect(checkLane({ branch: 'estetica/check-olio', files: ok })).toMatchObject({ checked: true, outside: [] });
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

// PAR-1 — permessi per branch e "solo aspetto" nei .jsx concessi.
describe('PAR-1 — permessi per branch', () => {
    const permessi = { 'estetica/test-permessi': { files: ['src/pages/Trending.jsx'], dal: '2026-10-10', motivo: 'prova' } };
    const run = (branch, f, added, removed = []) => checkLane({ branch, files: [f], permessi, diffs: { [f]: { added, removed } } });

    it('jsx concesso con sole classi → verde', () => {
        const r = run('estetica/test-permessi', 'src/pages/Trending.jsx', ['    <div className="px-4 py-2 rounded-2xl bg-stone-900">']);
        expect(r).toMatchObject({ outside: [], logic: [], granted: ['src/pages/Trending.jsx'] });
    });

    it('stesso file con import da services → rosso', () => {
        const r = run('estetica/test-permessi', 'src/pages/Trending.jsx', ["import { dataService } from '../services/dataService';"]);
        expect(r.outside).toEqual([]);
        expect(r.logic).toEqual([{ file: 'src/pages/Trending.jsx', regole: ['import da services'] }]);
    });

    it('jsx non concesso → rosso (anche lo stesso file su un altro branch)', () => {
        expect(run('estetica/test-permessi', 'src/pages/Home.jsx', ['<div className="p-4" />']).outside).toEqual(['src/pages/Home.jsx']);
        expect(run('estetica/altro', 'src/pages/Trending.jsx', ['<div className="p-4" />']).outside).toEqual(['src/pages/Trending.jsx']);
    });

    it('le altre righe vietate, e quelle ammesse', () => {
        const v = (added, removed) => jsxViolations({ added, removed });
        expect(v(["import { cn } from '@/lib/utils';"])).toEqual(['import da lib']);
        expect(v(["import { useUserContext } from '../hooks/useUserContext';"])).toEqual(['import da hooks']);
        expect(v(["import useStore from '../store/useStore';"])).toEqual(['import da store']);
        expect(v(["import { useAuth } from '../context/AuthContext';"])).toEqual(['import da context', ]);
        expect(v(["const r = await fetch('/api');"])).toEqual(['fetch']);
        expect(v(["supabase.from('tours')"])).toEqual(['supabase']);
        expect(v(["import React, { useState, useEffect } from 'react';"])).toEqual(['useState', 'useEffect']);
        expect(v(['const x = useReducer(f, 0); const c = useContext(C);'])).toEqual(['useReducer', 'useContext']);
        // ammessi: icone a linea, framer-motion, classi; hook gia' presenti ritoccati
        expect(v(["import { MapPin, Utensils } from 'lucide-react';", "import { motion } from 'framer-motion';", '<MapPin className="w-4 h-4" strokeWidth={1.5} />'])).toEqual([]);
        expect(v(['  const [open, setOpen] = useState(false); // ritocco'], ['  const [open, setOpen] = useState(false);'])).toEqual([]);
    });

    it('il file dei permessi su main e\' un oggetto con il formato giusto', () => {
        const p = JSON.parse(readFileSync(path.resolve(__dirname, '../../../docs/corsia-e-permessi.json'), 'utf8'));
        expect(p && typeof p === 'object' && !Array.isArray(p)).toBe(true);
        for (const [branch, v] of Object.entries(p)) {
            expect(branch.startsWith('estetica/')).toBe(true);
            expect(Array.isArray(v.files) && v.files.length > 0).toBe(true);
            expect(v.dal).toMatch(/^\d{4}-\d{2}-\d{2}$/);
            expect(typeof v.motivo).toBe('string');
        }
        expect(grantedFiles(p, 'estetica/non-elencato')).toEqual([]);
    });
});
