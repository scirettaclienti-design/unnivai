// CURIOSITÀ-QUARTIERI — le fonti della curiosità del cammino (via e quartiere da OpenStreetMap, voce di Wikipedia verificata per nome e
// coordinate) e la prima richiesta al narratore. 0 $, nessuna rete: Nominatim e Wikipedia sono finti, con pezzi veri letti il 02/11/2026.
import { describe, it, expect, vi } from 'vitest';
import { createHash } from 'node:crypto';
import {
    leggiIndirizzo, leggiPhoton, indirizzoDi, indirizzoDaClient, luoghiVicini, stessoLuogo, paroleProprie, eUnaTappa, testoDelLuogo, STRADA, RAGGIO_VIA_KM, RAGGIO_QUARTIERE_KM, UA_CURIOSITA,
} from '../../../supabase/functions/openai-proxy/curiositaFonti.ts';
import {
    SYSTEM_CURIOSITA, messaggiCuriosita, VERSIONE_CURIOSITA, chiaveCuriosita, eChiaveCuriosita, curiositaInCacheValida,
} from '../../../supabase/functions/openai-proxy/curiosita.ts';
import { SYSTEM_RACCONTO, SYSTEM_VERIFICA, REGOLE_VOCE, controllaRacconto, scriviERivedi, haFonti } from '../../../supabase/functions/openai-proxy/racconto.ts';

const CROCIFERI = [
    "La via dei Crociferi (in siciliano strata o via di li Crucìfiri) a Catania è una monumentale direttrice stradale realizzata nel XVIII secolo. Essa ha inizio in piazza San Francesco d’Assisi e vi si accede passando sotto l'arco di San Benedetto.",
    '', '== Descrizione ==',
    "La strada, contornata da chiese, monasteri e poche abitazioni civili, è un esempio di unità dell'architettura barocca. Nel breve spazio di circa 410 metri sono presenti ben quattro chiese.",
    '== Note ==', 'Nota a piè di pagina.',
].join('\n');

/** Un Wikipedia e un Nominatim finti: risposte per parametro. */
function rete({ indirizzo, cerca = {}, geo = [], testi = {}, falliscono = [] } = {}) {
    return vi.fn(async (url, init) => {
        const u = new URL(String(url));
        const p = Object.fromEntries(u.searchParams);
        const ok = (j) => ({ ok: true, status: 200, json: async () => j });
        if (u.hostname === 'nominatim.openstreetmap.org') {
            if (falliscono.includes('nominatim')) return { ok: false, status: 503, json: async () => ({}) };
            expect(init?.headers?.['User-Agent']).toBe(UA_CURIOSITA);
            return ok({ address: indirizzo });
        }
        if (p.list === 'geosearch') {
            if (falliscono.includes('geo')) return { ok: false, status: 500, json: async () => ({}) };
            return ok({ query: { geosearch: geo } });
        }
        if (p.generator === 'search') return ok({ query: { pages: cerca[p.gsrsearch] || [] } });
        if (p.titles) return ok({ query: { pages: [{ title: p.titles, extract: testi[p.titles] ?? '' }] } });
        throw new Error(`richiesta inattesa ${url}`);
    });
}

describe('i nomi di OpenStreetMap', () => {
    it('la strada e i quartieri dal più piccolo; mai un municipio; «Rione XIII» via', () => {
        expect(leggiIndirizzo({ road: 'Vicolo di Sant\'Agata', neighbourhood: 'Trastevere', quarter: 'Trastevere', suburb: 'Municipio Roma I', city: 'Roma' }))
            .toEqual({ via: 'Vicolo di Sant\'Agata', quartieri: ['Trastevere'], citta: 'Roma' });
        expect(leggiIndirizzo({ road: 'Via Crociferi', neighbourhood: 'Giudecca', suburb: 'Centro storico', city: 'Catania' }).quartieri).toEqual(['Giudecca', 'Centro storico']);
        expect(leggiIndirizzo({ quarter: 'Rione XIII Trastevere', city: 'Roma' }).quartieri).toEqual(['Trastevere']);
        expect(leggiIndirizzo({ suburb: 'Roma', city: 'Roma' }).quartieri).toEqual([]);
        expect(leggiIndirizzo(null)).toEqual({ via: null, quartieri: [], citta: null });
    });
    it('Nominatim e Photon giù: «errore», non «nessun posto»; il motivo è lo stato HTTP', async () => {
        const diagnosi = [];
        expect(await indirizzoDi(37.5, 15.08, rete({ falliscono: ['nominatim'] }), diagnosi)).toBe('errore');
        expect(diagnosi[0]).toBe('nominatim 503');
        expect(diagnosi[1]).toMatch(/^photon/);
    });
    it('l\'indirizzo dal telefono: solo i campi noti, solo stringhe corte', () => {
        expect(indirizzoDaClient({ road: 'Via Crociferi', suburb: 'Centro storico', city: 'Catania', house_number: '7', x: { y: 1 } })).toEqual({ via: 'Via Crociferi', quartieri: ['Centro storico'], citta: 'Catania' });
        expect(indirizzoDaClient({ road: 'x'.repeat(81) })).toBeNull();
        expect(indirizzoDaClient('Via Roma')).toBeNull();
        expect(indirizzoDaClient(['Via Roma'])).toBeNull();
        expect(indirizzoDaClient(null)).toBeNull();
    });
    it('Nominatim giù: i nomi da Photon (stessi dati OpenStreetMap)', async () => {
        const f = vi.fn(async (url) => {
            const u = new URL(String(url));
            if (u.hostname === 'nominatim.openstreetmap.org') return { ok: false, status: 403, json: async () => ({}) };
            expect(u.hostname).toBe('photon.komoot.io');
            return { ok: true, status: 200, json: async () => ({ features: [{ properties: { type: 'street', name: "Vicolo di Sant'Agata", locality: 'Trastevere', district: 'Municipio Roma I', city: 'Roma' } }] }) };
        });
        const diagnosi = [];
        expect(await indirizzoDi(41.8899, 12.4735, f, diagnosi)).toEqual({ via: "Vicolo di Sant'Agata", quartieri: ['Trastevere'], citta: 'Roma' });
        expect(diagnosi).toEqual(['nominatim 403']);
        expect(leggiPhoton({ type: 'house', street: 'Via Etnea', locality: 'San Berillo', city: 'Catania' })).toEqual({ via: 'Via Etnea', quartieri: ['San Berillo'], citta: 'Catania' });
    });
});

describe('stesso luogo: stesse parole proprie', () => {
    it('articoli, preposizioni, città e ordinali non contano', () => {
        expect(stessoLuogo('Via Crociferi', 'Via dei Crociferi', 'Catania')).toBe(true);
        expect(stessoLuogo('Via Vittorio Emanuele Secondo', 'Via Vittorio Emanuele II (Catania)', 'Catania')).toBe(true);
        expect(stessoLuogo('Centro storico', 'Centro Storico (Catania)', 'Catania')).toBe(true);
        expect(stessoLuogo('Monti', 'Monti (rione di Roma)', 'Roma')).toBe(true);
        expect(paroleProprie('Piazza di Santa Maria in Trastevere', 'Roma')).toEqual(['piazza', 'maria', 'trastevere']);
    });
    it('una parola in più o in meno è un altro luogo', () => {
        expect(stessoLuogo('Via Etnea', 'Via Etnea alta', 'Catania')).toBe(false);
        expect(stessoLuogo('Via Roma', 'Piazza Roma', 'Troina')).toBe(false);
        expect(stessoLuogo('Trastevere', 'Viale di Trastevere', 'Roma')).toBe(false);
        expect(stessoLuogo('Borgo', 'Borgo', '')).toBe(true);
        expect(stessoLuogo('Via', 'Via', '')).toBe(false); // nessuna parola propria di 4 lettere oltre il tipo? «via» ha 3 lettere
    });
    it('il titolo di una via comincia con una parola di strada', () => {
        for (const t of ['Via dei Crociferi', 'Piazza Trilussa', 'Lungotevere Raffaello Sanzio', 'Viale di Trastevere', 'Salita dei Borgia']) expect(STRADA.test(t)).toBe(true);
        for (const t of ['Trastevere', 'Basilica di Santa Maria in Trastevere', 'Palazzo Corsini alla Lungara']) expect(STRADA.test(t)).toBe(false);
    });
});

describe('i luoghi attorno a te', () => {
    const CATANIA = { lat: 37.505, lng: 15.0848, citta: 'Catania' };
    const indirizzo = leggiIndirizzo({ road: 'Via Crociferi', neighbourhood: 'Giudecca', suburb: 'Centro storico', city: 'Catania' });
    const cerca = {
        'Via Crociferi Catania': [{ pageid: 443726, title: 'Via dei Crociferi', index: 1, coordinates: [{ lat: 37.50497, lon: 15.08483 }] }],
        'Giudecca Catania': [
            { pageid: 1, title: 'Giudecca', index: 1, coordinates: [{ lat: 45.43, lon: 12.33 }] }, // Venezia: troppo lontana
            { pageid: 2, title: 'Giudecca di Catania', index: 2, coordinates: [{ lat: 37.5009, lon: 15.0829 }] },
        ],
        'Centro storico Catania': [{ pageid: 3, title: 'Centro Storico (Catania)', index: 1, coordinates: [{ lat: 37.503, lon: 15.0884 }] }],
    };
    const geo = [
        { pageid: 443726, title: 'Via dei Crociferi', dist: 4 },
        { pageid: 9, title: 'Chiesa di San Giuliano (Catania)', dist: 30 }, // un monumento: ha il suo racconto, non è una via
        { pageid: 10, title: 'Piazza Asmundo', dist: 90 },
    ];
    it('via per nome, poi vie e piazze vicine, poi i quartieri; ogni voce verificata per nome e coordinate', async () => {
        const r = await luoghiVicini(CATANIA, indirizzo, rete({ indirizzo, cerca, geo }));
        expect(r.errore).toBe(false);
        expect(r.luoghi.map(l => [l.tipo, l.titolo, l.trovata])).toEqual([
            ['via', 'Via dei Crociferi', 'indirizzo'],
            ['via', 'Piazza Asmundo', 'vicina'],
            ['quartiere', 'Giudecca di Catania', 'indirizzo'],
            ['quartiere', 'Centro Storico (Catania)', 'indirizzo'],
        ]);
        expect(r.luoghi[0].chiave).toBe('curiosita-itwiki-443726');
        expect(r.luoghi[0].url).toBe('https://it.wikipedia.org/wiki/Via_dei_Crociferi');
    });
    it('una voce senza coordinate, lontana o con un altro nome non vale', async () => {
        const c2 = {
            'Via Crociferi Catania': [
                { pageid: 5, title: 'Via dei Crociferi', index: 1 }, // senza coordinate
                { pageid: 6, title: 'Via Crociferi (Roma)', index: 2, coordinates: [{ lat: 41.9, lon: 12.48 }] },
                { pageid: 7, title: 'Chiesa dei Crociferi', index: 3, coordinates: [{ lat: 37.505, lon: 15.0848 }] }, // non è una via
            ],
        };
        const r = await luoghiVicini(CATANIA, { via: 'Via Crociferi', quartieri: [], citta: 'Catania' }, rete({ cerca: c2, geo: [] }));
        expect(r.luoghi).toEqual([]);
        expect(RAGGIO_VIA_KM).toBe(1.5);
        expect(RAGGIO_QUARTIERE_KM).toBe(3);
    });
    it('Wikipedia giù su una ricerca: errore, e i luoghi trovati dalle altre restano', async () => {
        const r = await luoghiVicini(CATANIA, indirizzo, rete({ indirizzo, cerca, falliscono: ['geo'] }));
        expect(r.errore).toBe(true);
        expect(r.luoghi.map(l => l.titolo)).toContain('Via dei Crociferi');
    });
    it('in un borgo senza voci: nessun luogo', async () => {
        const r = await luoghiVicini({ lat: 37.7848, lng: 14.5995, citta: 'Troina' }, { via: 'Via Roma', quartieri: ['Borgo'], citta: 'Troina' }, rete({}));
        expect(r).toEqual({ luoghi: [], errore: false });
    });
    it('il testo della voce: introduzione e sezioni, senza note', async () => {
        const t = await testoDelLuogo({ titolo: 'Via dei Crociferi' }, rete({ testi: { 'Via dei Crociferi': CROCIFERI } }));
        expect(t).toMatch(/^La via dei Crociferi/);
        expect(t).toMatch(/quattro chiese\.$/);
        expect(t).not.toMatch(/Nota a piè/);
    });
    it('una tappa del giro non è una curiosità del cammino', () => {
        const l = { titolo: 'Piazza Trilussa' };
        expect(eUnaTappa(l, ['Piazza Trilussa'], 'Roma')).toBe(true);
        expect(eUnaTappa({ titolo: 'Trastevere' }, ['Basilica di Santa Maria in Trastevere'], 'Roma')).toBe(false);
        expect(eUnaTappa({ titolo: 'Via dei Crociferi' }, ['Via Crociferi'], 'Catania')).toBe(true);
    });
});

describe('la prima richiesta della curiosità: le stesse regole dei racconti', () => {
    it('il prompt dei racconti e del revisore è quello di r7, carattere per carattere', () => {
        const h = (s) => createHash('sha256').update(s).digest('hex');
        expect(h(SYSTEM_RACCONTO)).toBe('6323d9d665d8381453136ad99b847036fef331761cff6e84f7abf76a82f734c8');
        expect(h(SYSTEM_VERIFICA)).toBe('eee223a66c8fff39f37c3391e7fcdbac2e7558ae3b04c77b11d6bb0a690079f3');
    });
    it('la curiosità ha tutte le regole di voce del racconto, 2–3 frasi, il luogo per nome', () => {
        for (const r of REGOLE_VOCE) expect(SYSTEM_CURIOSITA).toContain(r);
        expect(SYSTEM_CURIOSITA).toMatch(/da 2 a 3 frasi/);
        expect(SYSTEM_CURIOSITA).toMatch(/non dire «sei in…», «qui», «guarda»/);
    });
    it('i messaggi: il luogo, la città, che cosa è, la fonte', () => {
        const m = messaggiCuriosita({ nome: 'Via dei Crociferi', citta: 'Catania', wikipedia: { testo: 'Testo della voce.' } }, 'via');
        expect(m[0]).toEqual({ role: 'system', content: SYSTEM_CURIOSITA });
        expect(m[1].content).toMatch(/^LUOGO: Via dei Crociferi \(Catania\) — la via o la piazza che stai attraversando/);
        expect(m[1].content).toContain('FONTE 1 — Wikipedia:\n«Testo della voce.»');
        expect(m[1].content).toContain('FONTE 2 — Descrizione Google del posto: nessuna.');
        expect(messaggiCuriosita({ nome: 'Trastevere', citta: 'Roma', wikipedia: { testo: 'x' } }, 'quartiere')[1].content).toMatch(/il quartiere che stai attraversando/);
    });
    it('il controllo automatico e il revisore sono quelli dei racconti: un numero inventato cade, la riscrittura riparte dalla curiosità', async () => {
        const fonti = { nome: 'Via dei Crociferi', citta: 'Catania', wikipedia: { titolo: 'Via dei Crociferi', testo: CROCIFERI.replace(/==[^=]+==/g, '') } };
        expect(haFonti(fonti)).toBe(true);
        expect(controllaRacconto('Via dei Crociferi è lunga 900 metri. Ci sono quattro chiese.', fonti).ok).toBe(false);
        const scritti = [];
        const scrivi = async (m) => { scritti.push(m); return { testo: scritti.length === 1 ? 'Via dei Crociferi è lunga 900 metri. Ci sono quattro chiese.' : 'Via dei Crociferi fu realizzata nel XVIII secolo. Nei suoi 410 metri ci sono quattro chiese.', modello: 'claude-sonnet-5-5', costoUsd: 0.004 }; };
        const rivedi = async () => ({ testo: '{"frasi":[{"n":1,"nelle_fonti":true,"motivo":""},{"n":2,"nelle_fonti":true,"motivo":""}]}', modello: 'claude-haiku-4-5', costoUsd: 0.001 });
        const e = await scriviERivedi(fonti, scrivi, rivedi, { prima: (f) => messaggiCuriosita(f, 'via') });
        expect(e.ok).toBe(true);
        expect(e.riscritto).toBe(true);
        expect(scritti[0][0].content).toBe(SYSTEM_CURIOSITA);
        expect(scritti[1][0].content).toBe(SYSTEM_CURIOSITA); // la riscrittura continua la conversazione della curiosità
        expect(scritti[1][2].role).toBe("assistant");
        expect(scritti[1][3].content).toMatch(/numeri non nelle fonti: 900/);
    });
});

describe('la cache: una riga di place_racconti per luogo', () => {
    it('chiave e versione', () => {
        expect(chiaveCuriosita(443726)).toBe('curiosita-itwiki-443726');
        expect(eChiaveCuriosita('curiosita-itwiki-443726')).toBe(true);
        expect(eChiaveCuriosita('ChIJa-FrY0BgLxMRDN1UR07SMIE')).toBe(false);
        expect(/^[A-Za-z0-9_-]+$/.test(chiaveCuriosita(1)) && chiaveCuriosita(1).length >= 10).toBe(true); // il CHECK di place_racconti
        expect(VERSIONE_CURIOSITA).toBe('c1');
    });
    it('passata 30 giorni, scartata 7, un racconto r7 non è una curiosità', () => {
        const ora = Date.parse('2026-11-02T12:00:00Z');
        const fa = (g) => new Date(ora - g * 86_400_000).toISOString();
        expect(curiositaInCacheValida({ versione: 'c1', esito: 'passato', created_at: fa(29) }, ora)).toBe(true);
        expect(curiositaInCacheValida({ versione: 'c1', esito: 'passato', created_at: fa(31) }, ora)).toBe(false);
        expect(curiositaInCacheValida({ versione: 'c1', esito: 'scartato', created_at: fa(6) }, ora)).toBe(true);
        expect(curiositaInCacheValida({ versione: 'c1', esito: 'scartato', created_at: fa(8) }, ora)).toBe(false);
        expect(curiositaInCacheValida({ versione: 'r7', esito: 'passato', created_at: fa(1) }, ora)).toBe(false);
        expect(curiositaInCacheValida(null, ora)).toBe(false);
    });
});
