// MERGE-3 — la riga «Versione <commit corto> · <data del build>» in fondo al Profilo.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { testoVersione, VERSIONE_APP } from '@/lib/versione';

describe('MERGE-3 — la versione nel Profilo', () => {
    it('commit corto e data del build (ora di Roma); senza commit «sviluppo»', () => {
        expect(testoVersione('55db6ca1234567890abcdef', '2026-10-16T01:32:00.000Z')).toBe('Versione 55db6ca · 16/10/2026');
        expect(testoVersione('55db6ca', '2026-10-15T23:30:00.000Z')).toBe('Versione 55db6ca · 16/10/2026');
        expect(testoVersione('', '2026-10-16T01:32:00.000Z')).toBe('Versione sviluppo');
        expect(testoVersione(undefined, undefined)).toBe('Versione sviluppo');
        expect(testoVersione('55db6ca', 'non-una-data')).toBe('Versione 55db6ca');
    });
    it('nei test (nessun build di Vercel) la costante dice «sviluppo»', () => {
        expect(VERSIONE_APP).toBe('Versione sviluppo');
    });
    it('il build mette commit e data (define in vite.config.js) e il Profilo mostra la riga', () => {
        const root = process.cwd();
        const vite = readFileSync(path.join(root, 'vite.config.js'), 'utf8');
        expect(vite).toContain('VERCEL_GIT_COMMIT_SHA');
        expect(vite).toContain('__DV_COMMIT__');
        expect(vite).toContain('__DV_BUILD__');
        const profilo = readFileSync(path.join(root, 'src/pages/Profile.jsx'), 'utf8');
        expect(profilo).toContain("import { VERSIONE_APP } from '@/lib/versione'");
        expect(profilo).toContain('data-versione');
        expect(profilo).toContain('{VERSIONE_APP}');
        // niente piu' di quello: un solo punto d'uso nel Profilo
        expect(profilo.match(/VERSIONE_APP/g).length).toBe(2);
    });
});
