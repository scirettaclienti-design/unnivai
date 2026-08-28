import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { weightsToAIProfile } from '@/services/preferenceEngine';

// Gate INTENT — F65 (28/08). Il traduttore riceve la FRASE, non la frase piu' il
// profilo.
//
// Il difetto: AiItinerary componeva `enrichedPrompt = userPrompt + "[Profilo
// utente: ...]"` e lo passava come terzo argomento a generateItinerary. Quel
// terzo argomento arriva a translateIntentToQueries, che lo mette nel campo
// `Frase dell'utente: "..."`. Con un profilo food-dominante il modello leggeva
// "Evita se possibile: natura" DENTRO una richiesta di parchi.
//
// MISURATO chiamando il modello col prompt reale (la prova e' stata fatta in
// diagnosi, questi test NON chiamano l'AI):
//   "parchi e ville" pulito          -> categoria=natura   corretto
//   "parchi e ville" + profilo food  -> categoria=cultura  deviato

const REPO = process.cwd();
const SRC = join(REPO, 'src');
const readSrc = (rel) => readFileSync(join(SRC, rel), 'utf8');

const SKIP_DIRS = new Set(['node_modules', '__tests__', 'test']);
function walk(dir) {
    const out = [];
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
            if (SKIP_DIRS.has(entry)) continue;
            out.push(...walk(full));
            continue;
        }
        if (/\.(js|jsx)$/.test(entry) && !/\.old\./.test(entry)) out.push(full);
    }
    return out;
}

// Righe di CODICE (i commenti spiegano il difetto e citerebbero le stringhe).
const codeLines = () => {
    const out = [];
    for (const file of walk(SRC)) {
        const rel = relative(REPO, file).replace(/\\/g, '/');
        readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
            const t = line.trim();
            if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return;
            out.push({ rel, line: i + 1, text: line });
        });
    }
    return out;
};

describe('F65 — nessun call site inietta il profilo nella frase utente', () => {
    it('la stringa "[Profilo utente:" non e\' piu\' costruita da nessuna parte', () => {
        const bad = codeLines().filter(l => l.text.includes('[Profilo utente:'));
        expect(bad.map(l => `${l.rel}:${l.line}`)).toEqual([]);
    });

    it('`enrichedPrompt` non esiste piu\' come variabile', () => {
        const bad = codeLines().filter(l => /\benrichedPrompt\b/.test(l.text));
        expect(bad.map(l => `${l.rel}:${l.line}`)).toEqual([]);
    });

    it('AiItinerary passa `userPrompt` come terzo argomento, non una stringa composta', () => {
        const src = readSrc('pages/AiItinerary.jsx');
        const i = src.indexOf('aiRecommendationService.generateItinerary(');
        expect(i).toBeGreaterThan(0);
        const chiamata = src.slice(i, i + 500);
        expect(chiamata).toContain('userPrompt,');
        expect(chiamata).not.toContain('enrichedPrompt');
    });

    // Gli altri due call site erano gia' puliti: verificato in diagnosi e
    // asserito qui, perche' "gia' pulito" oggi non lo garantisce domani.
    it('QuickPath e SurpriseTour non compongono il prompt col profilo', () => {
        for (const f of ['pages/QuickPath.jsx', 'pages/SurpriseTour.jsx']) {
            expect(readSrc(f), f).not.toContain('[Profilo utente:');
        }
    });
});

describe('F65 — il profilo NON e\' stato tolto: e\' stato rimesso al suo posto', () => {
    // Il rischio del fix opposto: spegnere la personalizzazione invece di
    // ripararla. Il profilo deve continuare ad arrivare al SELETTORE.
    it('AiItinerary passa ancora `aiProfile` sul suo parametro dedicato', () => {
        const src = readSrc('pages/AiItinerary.jsx');
        const i = src.indexOf('aiRecommendationService.generateItinerary(');
        const chiamata = src.slice(i, i + 500);
        expect(chiamata).toContain('aiProfile,');
    });

    it('il prompt del selettore riceve il profilo con la sua etichetta', () => {
        const src = readSrc('services/aiRecommendationService.js');
        expect(src).toContain('• profilo implicito: ${aiProfile}');
        // e la richiesta utente resta un campo separato
        expect(src).toContain('• richiesta utente: "${(userPrompt || \'\').slice(0, 300)}"');
    });

    it('il path legacy ha la sua regola dedicata al profilo', () => {
        const src = readSrc('services/aiRecommendationService.js');
        expect(src).toContain('14. PROFILO UTENTE IMPLICITO');
    });

    it('la chiave di cache discrimina ancora sul profilo', () => {
        // insiderCacheKey riceve userPrompt E aiProfile separatamente: togliere
        // il profilo dalla frase non fa collidere due utenti con gusti diversi.
        const src = readSrc('services/aiRecommendationService.js');
        expect(src).toContain('const insiderCacheKey = (city, prefs, userPrompt, aiProfile) =>');
        expect(src).toContain('[city, prefs?.duration, prefs?.group, prefs?.pace, userPrompt, aiProfile]');
    });
});

describe('F65 — il difetto documentato: cosa arrivava al traduttore', () => {
    // Ricostruisce il profilo che l'utente-tipo food-dominante produce, e prova
    // che contiene proprio l'istruzione che deviava l'intento.
    const PESI_FOOD = { food: 0.72, cultura: 0.31, natura: 0.05, shopping: 0.03 };

    it('un profilo food-dominante contiene "Evita se possibile: natura"', () => {
        const profilo = weightsToAIProfile(PESI_FOOD);
        expect(profilo).toContain('Preferenze dominanti');
        expect(profilo).toContain('food');
        expect(profilo).toContain('Evita se possibile');
        expect(profilo).toContain('natura');
    });

    it('quella stringa non puo\' piu\' finire dentro la frase dell\'utente', () => {
        // La forma vecchia — frase + profilo concatenati — non e' piu' costruita
        // in nessun punto del codice: se tornasse, il primo test di questo file
        // diventa rosso. Qui si asserisce l'altra meta': che la funzione che
        // genera il profilo esista ancora e produca ancora quel testo, cioe' che
        // il difetto sia stato chiuso spostando il dato, non svuotandolo.
        const profilo = weightsToAIProfile(PESI_FOOD);
        expect(profilo.length).toBeGreaterThan(0);
        const bad = codeLines().filter(l => /userPrompt[^)]*\[Profilo/.test(l.text));
        expect(bad).toEqual([]);
    });

    it('senza segnale di gusto il profilo resta vuoto (nessun fallback che inventa)', () => {
        expect(weightsToAIProfile({})).toBe('');
        expect(weightsToAIProfile({ food: 0.1 })).toBe('');
    });
});

describe('F65 — la cache non serve intent costruiti col prompt sporco', () => {
    it('intentCacheKey include il prompt, quindi cambiando l\'input la chiave cambia', () => {
        // E' la ragione per cui QUI non serve un bump del prefix, a differenza
        // del diff sui raggi dove la chiave non conteneva il radius.
        // La vecchia chiave era hash("citta|frase [Profilo utente: ...]"), la
        // nuova e' hash("citta|frase"): due chiavi diverse, la vecchia decade
        // da sola col TTL senza mai essere riletta.
        const src = readSrc('services/aiRecommendationService.js');
        expect(src).toContain('const intentCacheKey = (userPrompt, cityName) =>');
        expect(src).toContain("`${String(cityName || '').toLowerCase().trim()}|${String(userPrompt || '').toLowerCase().trim()}`");
    });
});
