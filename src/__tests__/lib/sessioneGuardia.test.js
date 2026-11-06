import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// LOGIN-SESSIONE (T26) — nel codice dell'app niente che butti via la sessione per sbaglio.
const radice = path.resolve(__dirname, '../..');
const file = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(d, e.name);
    if (e.isDirectory()) return e.name === '__tests__' || e.name === 'test' ? [] : file(p);
    return /\.(jsx?|mjs)$/.test(e.name) ? [p] : [];
});
const sorgenti = file(radice).map((p) => ({ p: path.relative(radice, p), t: fs.readFileSync(p, 'utf8') }));

describe('guardia della sessione', () => {
    it('nessun signOut senza scope: «Esci» è sempre locale', () => {
        const male = sorgenti.filter(({ t }) => /auth\.signOut\(\s*\)/.test(t)).map((x) => x.p);
        expect(male).toEqual([]);
    });
    it('nessun localStorage.clear() e nessuna cancellazione delle chiavi sb-', () => {
        const male = sorgenti.filter(({ t }) => /localStorage\.clear\(\)|removeItem\(\s*['"`]sb-/.test(t.replace(/\/\/.*$/gm, ''))).map((x) => x.p);
        expect(male).toEqual([]);
    });
    it('il client di Supabase non spegne la persistenza (persistSession/autoRefreshToken restano di difetto)', () => {
        const male = sorgenti.filter(({ t }) => /persistSession\s*:\s*false|autoRefreshToken\s*:\s*false|sessionStorage[^\n]*supabase|storage\s*:\s*sessionStorage/.test(t)).map((x) => x.p);
        expect(male).toEqual([]);
    });
});
