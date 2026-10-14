import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

// VERITÀ-PRE-GIRO 2 — nessun nome ricavato dalla mail, in nessun punto dell'app (saluto, richieste alla guida, contesto utente).
const radice = path.resolve(__dirname, '../..');
const sorgenti = (dir = radice) => readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    if (statSync(p).isDirectory()) return f === '__tests__' || f === 'test' ? [] : sorgenti(p);
    return /\.(jsx?|tsx?)$/.test(f) ? [p] : [];
});

describe('VERITÀ 2 — il sorgente non ricava nomi dalla mail', () => {
    it('nessun `email.split(\'@\')` in src (la parte prima della chiocciola non e\' un nome)', () => {
        const colpe = sorgenti().filter(p => /email\??\.split\(\s*['"]@['"]\s*\)/.test(readFileSync(p, 'utf8'))).map(p => path.relative(radice, p));
        expect(colpe).toEqual([]);
    });
});
