import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Gate C1 + C2 — le due trasformazioni che deformavano testo italiano.
//
// Questo file NON importa moduli dell'app: legge il sorgente e basta, come
// gatePulizia / gateF38 / gateF26diff*. Serve a due cose:
//
//  1. dare un rosso che NOMINA il difetto — non "funzione non esportata", ma
//     "la riga incriminata e' ancora li'". I due fix sono estrazioni (la
//     funzione pura nasce col fix), quindi i test funzionali, da soli, senza
//     il fix andrebbero rossi su un errore di import;
//  2. impedire che la trasformazione torni per copia-incolla in un altro punto
//     dello stesso file, dove i test funzionali non guarderebbero.
//
// C1 — normalizzazione Title Case del nome citta':
//     s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
// Quattro punti. Va bene solo sui nomi a parola singola; su tutto il resto
// distrugge il dato ("Reggio Emilia" -> "Reggio emilia", "L'Aquila" ->
// "L'aquila") e il valore storpiato viene PERSISTITO (localStorage +
// profiles.current_city_override).
//
// C2 — filtro tag ASCII-only in AiItinerary:
//     w.replace(/[^\w\s]/gi, '')
// `\w` senza flag `u` e' [A-Za-z0-9_]: ogni lettera accentata veniva
// cancellata in silenzio ("citta'" -> "citt", "e'" -> "" tag vuoto).

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '../');
const read = (f) => readFileSync(resolve(SRC, f), 'utf8');

// Solo il CODICE, senza righe di commento. I commenti dei due fix CITANO la
// riga vecchia per spiegare cosa faceva e perche' e' stata tolta: e' il modo
// in cui questo repo documenta le rimozioni, e non deve far fallire il gate.
// Stesso ruolo di `codeOf` in gateF26diff5.
const codeOf = (f) =>
    read(f)
        .split('\n')
        .filter(l => {
            const t = l.trim();
            return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
        })
        .join('\n');

// La firma esatta della normalizzazione Title Case, qualunque sia il nome
// della variabile e con o senza .trim() in mezzo.
const TITLE_CASE = /charAt\(0\)\.toUpperCase\(\)\s*\+\s*[\w.()]*\bslice\(1\)\.toLowerCase\(\)/;

describe('Gate C1 — la normalizzazione Title Case del nome citta\' non esiste piu\'', () => {
    const FILES = [
        'services/userContextService.js',  // era :126 (getUserContext) e :222 (getCoordinatesForCity)
        'components/TopBar.jsx',           // era :97  (handleSaveCity)
        'pages/QuickPath.jsx',             // era :446 (activeCity)
    ];

    for (const f of FILES) {
        it(`${f} non contiene piu' charAt(0).toUpperCase() + slice(1).toLowerCase()`, () => {
            expect(codeOf(f)).not.toMatch(TITLE_CASE);
        });
    }

    it('nessuno dei tre file normalizza piu\' un nome citta\' con .slice(1).toLowerCase()', () => {
        for (const f of FILES) {
            expect(codeOf(f)).not.toContain('.slice(1).toLowerCase()');
        }
    });

    it('il fast-path CITY_COORDS cerca la CHIAVE via findCityKey', () => {
        // Il lookup deve passare per le chiavi della tabella: e' il confronto
        // a essere case-insensitive, non il dato a essere normalizzato.
        expect(codeOf('services/userContextService.js')).toMatch(/findCityKey\(\s*CITY_COORDS/);
    });

    it('il lookup CITY_CONFIG di QuickPath cerca la CHIAVE via findCityKey', () => {
        expect(codeOf('pages/QuickPath.jsx')).toMatch(/findCityKey\(\s*CITY_CONFIG/);
    });

    it('i due lookup condividono lo stesso motore (regola locked #8)', () => {
        // Un solo helper, importato da entrambi: le due tabelle non possono
        // divergere nel comportamento del match.
        for (const f of ['services/userContextService.js', 'pages/QuickPath.jsx']) {
            expect(codeOf(f)).toMatch(/import\s*\{\s*findCityKey\s*\}\s*from\s*['"][^'"]*cityKey['"]/);
        }
    });

    it('le query Supabase per citta\' non usano piu\' .eq (case-sensitive)', () => {
        // Tolta la normalizzazione, "roma" minuscolo deve continuare a trovare
        // le righe "Roma": il confronto passa a .ilike, gia' in uso nel repo.
        for (const f of ['services/dataService.js', 'services/userContextService.js']) {
            expect(codeOf(f)).not.toMatch(/\.eq\(\s*['"]city['"]/);
        }
    });
});

describe('Gate C2 — il filtro tag non e\' piu\' ASCII-only', () => {
    it('la classe [^\\w\\s] non esiste piu\' ne\' in AiItinerary ne\' nel motore tag', () => {
        for (const f of ['pages/AiItinerary.jsx', 'lib/promptTags.js']) {
            expect(codeOf(f)).not.toContain('[^\\w\\s]');
        }
    });

    it('il motore tag usa una classe Unicode con flag u', () => {
        expect(codeOf('lib/promptTags.js')).toMatch(/\[\^\\p\{L\}\\p\{N\}\]\/gu/);
    });

    it('AiItinerary non costruisce piu\' i tag inline: li chiede al motore', () => {
        const code = codeOf('pages/AiItinerary.jsx');
        expect(code).toMatch(/import\s*\{\s*extractPromptTags\s*\}\s*from\s*['"][^'"]*promptTags['"]/);
        expect(code).toMatch(/\.\.\.extractPromptTags\(userPrompt\)/);
        // La vecchia costruzione inline non deve sopravvivere da nessuna parte.
        expect(code).not.toMatch(/userPrompt\.split\(/);
    });
});
