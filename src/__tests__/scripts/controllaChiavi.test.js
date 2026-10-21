import { describe, it, expect, afterEach } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cercaNelTesto, scansiona } from '../../../scripts/controlla-chiavi.mjs';

// SICUREZZA-CHIAVI — il controllo che blocca le chiavi segrete nei file tracciati e in dist/.
// Le chiavi finte si compongono qui a runtime: questo file non contiene nessuna chiave intera,
// quindi il controllo sui file tracciati resta verde su di lui.
const coda = (n, c = 'a') => c.repeat(n);
const FINTE = {
    'anthropic (sk-ant-)': 'sk-' + 'ant-' + 'api03-' + coda(40),
    'openai progetto (sk-proj-)': 'sk-' + 'proj-' + coda(40, 'B'),
    'sk- lungo': 'sk-' + coda(48, '7'),
    'stripe (sk_live_)': 'sk_' + 'live_' + coda(24),
    'stripe webhook (whsec_)': 'whsec' + '_' + coda(24),
    'github (ghp_)': 'ghp' + '_' + coda(36),
    'github (github_pat_)': 'github' + '_pat_' + coda(40),
};
const jwt = (role) => {
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
    return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ iss: 'supabase', role })}.${coda(30, 'x')}`;
};
// l'header base64 di {"alg":...} comincia per «eyJ»: il JWT sopra è nel formato vero
const JWT_SERVICE = jwt('service_role');
const JWT_ANON = jwt('anon');

const cartelle = [];
const temp = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'chiavi-')); cartelle.push(d); return d; };
afterEach(() => { while (cartelle.length) fs.rmSync(cartelle.pop(), { recursive: true, force: true }); });

const CLI = path.resolve(__dirname, '../../../scripts/controlla-chiavi.mjs');

describe('controlla-chiavi — rosso con una chiave finta, per ogni tipo', () => {
    for (const [tipo, chiave] of Object.entries(FINTE)) {
        it(`trova ${tipo}`, () => {
            const t = cercaNelTesto(`const x = "${chiave}";`);
            expect(t.map(r => r.tipo)).toContain(tipo);
        });
    }
    it('trova un JWT Supabase con ruolo service_role', () => {
        expect(cercaNelTesto(`k = '${JWT_SERVICE}'`).map(r => r.tipo)).toContain('JWT Supabase service_role');
    });
});

describe('controlla-chiavi — verde senza chiavi', () => {
    it('un JWT con ruolo anon (pubblico) non è una chiave segreta', () => {
        expect(cercaNelTesto(`k = '${JWT_ANON}'`)).toEqual([]);
    });
    it('i prefissi scritti nei documenti (senza la coda lunga) non fanno allarme', () => {
        expect(cercaNelTesto('Cerca sk-ant-, sk-proj-, sk_live_, whsec_, ghp_ e github_pat_ nei file.')).toEqual([]);
    });
    it('la parola service_role in una policy SQL o in un\'Edge Function è legittima nei file tracciati', () => {
        expect(cercaNelTesto("CREATE POLICY p ON t TO service_role USING (true); // SUPABASE_SERVICE_ROLE_KEY")).toEqual([]);
    });
    it('una parola che finisce in «sk-» (risk-…) non è una chiave', () => {
        expect(cercaNelTesto('risk-' + coda(40))).toEqual([]);
    });
    it('nel sito costruito la parola service_role invece è un errore', () => {
        expect(cercaNelTesto('x="service_role"', { sito: true }).map(r => r.tipo)).toContain('parola service_role');
    });
});

describe('controlla-chiavi — a riga di comando', () => {
    it('una cartella pulita esce con 0', () => {
        const d = temp();
        fs.writeFileSync(path.join(d, 'index.js'), 'console.log("ciao")');
        const r = spawnSync('node', [CLI, '--dir', d], { encoding: 'utf8' });
        expect(r.status).toBe(0);
    });

    it('una cartella con una chiave finta esce con 1, dice file e riga e NON stampa il valore', () => {
        const d = temp();
        const chiave = FINTE['anthropic (sk-ant-)'];
        fs.writeFileSync(path.join(d, 'bundle.js'), `a\nb\nvar k="${chiave}";\n`);
        const r = spawnSync('node', [CLI, '--dir', d], { encoding: 'utf8' });
        expect(r.status).toBe(1);
        expect(r.stderr).toContain('bundle.js:3');
        expect(r.stderr).toContain('anthropic (sk-ant-)');
        expect(r.stderr + r.stdout).not.toContain(chiave);
        expect(r.stderr + r.stdout).not.toContain(chiave.slice(0, 14));
    });

    it('scansiona i file di testo e salta i binari', () => {
        const d = temp();
        fs.writeFileSync(path.join(d, 'img.png'), 'x' + FINTE['github (ghp_)']);
        expect(scansiona([path.join(d, 'img.png')])).toEqual([]);
    });

    it('sui file tracciati del repository è verde (nessuna chiave dentro)', () => {
        const out = execFileSync('node', [CLI], { encoding: 'utf8', cwd: path.resolve(__dirname, '../../..') });
        expect(out).toContain('nessuna chiave segreta');
    });
});
