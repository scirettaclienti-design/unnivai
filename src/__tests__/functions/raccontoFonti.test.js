// RACCONTO-FONTI — quando la ricerca per nome lascia una tappa senza fonti: voce intera, voce vicina, frasi che la nominano. 0 $, nessuna rete.
// I testi sono pezzi veri delle voci di it.wikipedia.org (letti il 02/11/2026), ridotti.
import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import {
    allargaWikipedia, cercaWikipedia, pezzoColNome, frasiDi, sezioniDi, testoVoceIntera, menzioniIn, stessoNomeProprio, nomeDaCercare,
    RAGGIO_VICINA_M, RAGGIO_CONTENITORE_M, TESTO_MAX, UA_WIKIPEDIA,
} from '../../../supabase/functions/openai-proxy/raccontoFonti.ts';
import { versioneValida, VERSIONE_RACCONTO, haFonti, LIMITI } from '../../../supabase/functions/openai-proxy/racconto.ts';

const PORTA_UZEDA = [
    'La porta Uzeda collega la piazza Duomo alla via Dusmet, nel cuore della Catania settecentesca.',
    '', '', '== Descrizione ==',
    "Per chi viene da via Etnea, la porta Uzeda costituisce l'uscita verso sud dalla piazza del Duomo e collega il seminario dei chierici con il palazzo arcivescovile e la cattedrale di Sant'Agata.",
    'La porta si apre nelle cinquecentesche mura di Carlo V ed è intitolata al viceré spagnolo Giovanni Francesco Paceco, duca di Uceda.',
    '', '', '== Curiosità ==', '',
    'La cittadina di Uceda conta circa 2 000 abitanti e si trova in Spagna, nella provincia di Guadalajara.',
    '', '== Bibliografia ==', 'Vittorio Consoli, Enciclopedia di Catania, Tringale, Catania, 1987.',
].join('\n');
const TROINA = [
    'Troina è un comune italiano della provincia di Enna in Sicilia.',
    '== Storia ==',
    "Il sito su cui sorge l'odierna città di Troina fu abitato fin dai tempi più antichi, con insediamenti risalenti al Neolitico — una fattoria del 6000 a. C. — e la necropoli ancora visitabile e sita sul monte Muganà.",
    'I Normanni arrivarono a Troina nel 1062.',
    '== Monumenti e luoghi d\'interesse ==',
    'Torre Capitania, impianto XII secolo',
    'Cinta muraria e Necropoli Monte Muganà',
    "Principale piazza di Troina è la Piazza Conte Ruggero, situata nella parte più alta del centro storico, da dove è possibile osservare l'Etna, la costa del Mar Jonio e il monte San Pantheon. Dalla parte opposta i boschi dei Nebrodi e il lago Sartori.",
    '== Note ==', 'Piazza Conte Ruggero, foto del 1950.',
].join('\n');
const VITTORIANO = [
    'Il Vittoriano è un monumento nazionale situato a Roma, in piazza Venezia.',
    '== Descrizione ==',
    "Il complesso monumentale del Vittoriano è alto 70 metri. Dal giugno 2007 è possibile salire alla terrazza delle quadrighe usufruendo di un ascensore: questa terrazza, che è la più alta del monumento, è anche raggiungibile tramite 196 scalini che partono dal sommoportico.",
].join('\n');
const SORDI = 'La galleria Alberto Sordi (già Galleria Colonna) è un edificio di Roma, situato in piazza Colonna.';

const EX_CATTEDRALE = "L'ex cattedrale di Maria Santissima Assunta è il principale luogo di culto della città di Troina, già sede dell'antica diocesi di Troina. Dopo la sua costruzione, nel 1082 la chiesa madre fu elevata a cattedrale fino a quando la sede vescovile venne spostata a Messina.";

/** Wikipedia finta: risponde secondo i parametri (ricerca per nome, geosearch, ricerca della frase, testo intero di una voce). */
function wikiFinta({ perNome = [], vicine = [], conFrase = {}, voci = {}, fallisce = () => false } = {}) {
    return vi.fn(async (url, init) => {
        const p = new URL(url).searchParams;
        if (fallisce(p)) throw new Error('rete');
        const ok = (j) => ({ ok: true, status: 200, json: async () => j });
        if (p.get('generator') === 'geosearch') return ok({ query: { pages: vicine } });
        if (p.get('generator') === 'search' && /^".*"$/.test(p.get('gsrsearch'))) return ok({ query: { pages: conFrase[p.get('gsrsearch').slice(1, -1)] || [] } });
        if (p.get('generator') === 'search') return ok({ query: { pages: perNome } });
        if (p.get('titles')) return ok({ query: { pages: [{ title: p.get('titles'), extract: voci[p.get('titles')] ?? '' }] } });
        return ok({ query: { pages: [] } });
    });
}

describe('il testo di una voce: frasi e sezioni', () => {
    it('«a. C.» e «S. Pietro» non spezzano la frase; una riga di elenco è una frase sua, col punto', () => {
        const f = frasiDi(TROINA);
        expect(f.find(x => x.includes('6000 a. C.'))).toMatch(/monte Muganà\.$/);
        expect(f).toContain('Torre Capitania, impianto XII secolo.');
        expect(frasiDi('Sta in piazza S. Francesco. Risale al II secolo.')).toEqual(['Sta in piazza S. Francesco.', 'Risale al II secolo.']);
    });
    it('le sezioni si leggono dai titoli «== … ==»; la prima è l\'introduzione', () => {
        const s = sezioniDi(PORTA_UZEDA);
        expect(s.map(x => x.titolo)).toEqual(['', 'Descrizione', 'Curiosità', 'Bibliografia']);
    });
    it('voce intera: introduzione e sezioni di testo, senza Curiosità, Bibliografia, Note; mai oltre 1500 caratteri', () => {
        const t = testoVoceIntera(PORTA_UZEDA);
        expect(t).toMatch(/^La porta Uzeda collega/);
        expect(t).toMatch(/duca di Uceda\.$/);
        expect(t).not.toMatch(/Guadalajara|Consoli/);
        const lunga = ['Intro.', '== Storia ==', ...Array.from({ length: 80 }, (_, i) => `La frase numero ${i} della storia del posto.`)].join('\n');
        expect(testoVoceIntera(lunga).length).toBeLessThanOrEqual(TESTO_MAX);
        expect(testoVoceIntera(lunga)).toMatch(/\.$/);
    });
});

describe('menzioni: solo le frasi che nominano la tappa', () => {
    it('Troina: le frasi con «Piazza Conte Ruggero», non la frase dopo né le Note', () => {
        expect(menzioniIn(TROINA, 'Piazza Conte Ruggero')).toEqual([
            "Principale piazza di Troina è la Piazza Conte Ruggero, situata nella parte più alta del centro storico, da dove è possibile osservare l'Etna, la costa del Mar Jonio e il monte San Pantheon.",
        ]);
    });
    it('il nome si trova senza maiuscole e senza accenti, a parola intera', () => {
        expect(menzioniIn(TROINA, 'Monte Muganà')).toEqual(['e la necropoli ancora visitabile e sita sul monte Muganà.', 'Cinta muraria e Necropoli Monte Muganà.']);
        expect(menzioniIn(VITTORIANO, 'Terrazza delle Quadrighe')).toEqual([expect.stringMatching(/^Dal giugno 2007 è possibile salire alla terrazza delle quadrighe/)]);
        expect(menzioniIn('La Porta Uzedana è un\'altra cosa.', 'Porta Uzeda')).toEqual([]);
    });
    it('di una frase a pezzi (trattini, punto e virgola) resta solo il pezzo col nome: la fattoria del Neolitico non è sul Muganà', () => {
        const f = "Il sito fu abitato fin dai tempi più antichi — una fattoria del 6000 a. C. — e la necropoli ancora visitabile e sita sul monte Muganà.";
        expect(pezzoColNome(f, 'Monte Muganà')).toBe('e la necropoli ancora visitabile e sita sul monte Muganà.');
        expect(pezzoColNome('Dal giugno 2007 si sale alla terrazza delle quadrighe: è la più alta del monumento.', 'Terrazza delle Quadrighe'))
            .toBe('Dal giugno 2007 si sale alla terrazza delle quadrighe: è la più alta del monumento.'); // i due punti non spezzano
        expect(pezzoColNome('La piazza ha tre chiese; la Torre Capitania è del XII secolo; il municipio è accanto.', 'Torre Capitania')).toBe('la Torre Capitania è del XII secolo.');
    });
    it('una sezione intitolata col nome vale per intero', () => {
        const t = 'Intro.\n== Terrazza delle Quadrighe ==\nSi sale con un ascensore. Da qui si vede tutta la città.';
        expect(menzioniIn(t, 'Terrazza delle Quadrighe')).toEqual(['Si sale con un ascensore.', 'Da qui si vede tutta la città.']);
    });
    it('un nome troppo corto non si cerca dentro un testo («Duomo»); l\'articolo iniziale e le parentesi si tolgono', () => {
        expect(menzioniIn('Il Duomo è in piazza. Il Duomo è barocco.', 'Duomo')).toEqual([]);
        expect(nomeDaCercare('Il Palazzo dei Conservatori')).toBe('Palazzo dei Conservatori');
        expect(nomeDaCercare("Fontana dell'Elefante (uʻ Liotru)")).toBe("Fontana dell'Elefante");
    });
});

describe('lo stesso posto con un altro nome (solo con le coordinate)', () => {
    it('«Chiesa Madre di Maria Santissima Assunta» = «Ex cattedrale di Maria Santissima Assunta (Troina)»', () => {
        expect(stessoNomeProprio('Chiesa Madre di Maria Santissima Assunta', 'Ex cattedrale di Maria Santissima Assunta (Troina)', 'Troina')).toBe(true);
    });
    it('un altro posto vicino non lo è: altro nome proprio, altra famiglia, una parola in più', () => {
        expect(stessoNomeProprio("Giardino di Sant'Alessio", 'Basilica dei Santi Bonifacio e Alessio', 'Roma')).toBe(false);
        expect(stessoNomeProprio('Galleria Colonna', 'Palazzo Colonna', 'Roma')).toBe(false); // una galleria non è il palazzo
        expect(stessoNomeProprio('Galleria del Cardinale Colonna', 'Galleria Colonna', 'Roma')).toBe(false); // «Cardinale» non c'è
        expect(stessoNomeProprio('Chiesa Madre', 'Duomo', 'Troina')).toBe(false); // niente nome proprio: non si decide
    });
});

describe('allargaWikipedia: le tre strade, ognuna col posto verificato', () => {
    it('1. voce intera: Porta Uzeda (introduzione di 94 caratteri) prende la sezione Descrizione', async () => {
        const tappa = { nome: 'Porta Uzeda', citta: 'Catania', lat: 37.5018, lng: 15.08764 };
        const trovata = { titolo: 'Porta Uzeda', url: 'https://it.wikipedia.org/wiki/Porta_Uzeda', testo: PORTA_UZEDA.split('\n')[0], distanzaM: 7, via: 'nome' };
        const { fonte, errore } = await allargaWikipedia(tappa, trovata, wikiFinta({ voci: { 'Porta Uzeda': PORTA_UZEDA } }));
        expect(errore).toBe(false);
        expect(fonte).toMatchObject({ titolo: 'Porta Uzeda', via: 'voce-intera', distanzaM: 7 });
        expect(fonte.testo).toMatch(/mura di Carlo V/);
        expect(haFonti({ nome: 'Porta Uzeda', wikipedia: { testo: trovata.testo } })).toBe(false); // prima: senza fonti
        expect(haFonti({ nome: 'Porta Uzeda', wikipedia: { testo: fonte.testo } })).toBe(true);  // dopo: la soglia di sempre basta
    });
    it('2. vicina: la Chiesa Madre di Troina è la voce «Ex cattedrale…» a 12 m; a 500 m o con un altro nome no', async () => {
        const tappa = { nome: 'Chiesa Madre di Maria Santissima Assunta', citta: 'Troina', lat: 37.78542, lng: 14.60089 };
        const ex = { title: 'Ex cattedrale di Maria Santissima Assunta (Troina)', extract: EX_CATTEDRALE, coordinates: [{ lat: 37.78552, lon: 14.60086 }] };
        const { fonte } = await allargaWikipedia(tappa, null, wikiFinta({ vicine: [ex], voci: { [ex.title]: EX_CATTEDRALE } }));
        expect(fonte).toMatchObject({ titolo: ex.title, via: 'vicina' });
        expect(fonte.distanzaM).toBeLessThanOrEqual(RAGGIO_VICINA_M);
        const lontana = { ...ex, coordinates: [{ lat: 37.7899, lon: 14.60089 }] };
        expect((await allargaWikipedia(tappa, null, wikiFinta({ vicine: [lontana] }))).fonte).toBeNull();
        const altra = { ...ex, title: 'Chiesa di San Silvestro (Troina)' };
        expect((await allargaWikipedia(tappa, null, wikiFinta({ vicine: [altra] }))).fonte).toBeNull();
    });
    it('3. menzioni: la Terrazza delle Quadrighe dal Vittoriano (29 m); la «Galleria Colonna» di piazza Colonna (600 m) non entra', async () => {
        const terrazza = { nome: 'Terrazza delle Quadrighe', citta: 'Roma', lat: 41.8943466, lng: 12.4831966 };
        const f = wikiFinta({
            conFrase: { 'Terrazza delle Quadrighe': [{ title: 'Vittoriano', coordinates: [{ lat: 41.8946, lon: 12.4831 }] }] },
            voci: { Vittoriano: VITTORIANO },
        });
        const { fonte } = await allargaWikipedia(terrazza, null, f);
        expect(fonte).toMatchObject({ titolo: 'Vittoriano', via: 'menzioni' });
        expect(fonte.testo).toMatch(/^Dal giugno 2007/);
        expect(fonte.testo).not.toMatch(/alto 70 metri/); // la frase sul Vittoriano non nomina la terrazza

        const galleria = { nome: 'Galleria Colonna', citta: 'Roma', lat: 41.8975648, lng: 12.4847388 };
        const g = wikiFinta({ conFrase: { 'Galleria Colonna': [{ title: 'Galleria Alberto Sordi', coordinates: [{ lat: 41.9010, lon: 12.4800 }] }] }, voci: { 'Galleria Alberto Sordi': SORDI } });
        expect((await allargaWikipedia(galleria, null, g)).fonte).toBeNull();
        expect(RAGGIO_CONTENITORE_M).toBeLessThan(600);
    });
    it('3. menzioni: la voce della città vale fino a 5 km (Monte Muganà, 1 km dal centro di Troina), ma solo il pezzo col nome; la voce di un\'altra città no', async () => {
        const mugana = { nome: 'Monte Muganà', citta: 'Troina', lat: 37.7876, lng: 14.61054 };
        const f = wikiFinta({ conFrase: { 'Monte Muganà': [{ title: 'Troina', coordinates: [{ lat: 37.7845, lon: 14.5980 }] }] }, voci: { Troina: TROINA } });
        const { fonte } = await allargaWikipedia(mugana, null, f);
        expect(fonte).toMatchObject({ titolo: 'Troina', via: 'menzioni' });
        expect(fonte.testo).toBe('e la necropoli ancora visitabile e sita sul monte Muganà. Cinta muraria e Necropoli Monte Muganà.');
        expect(haFonti({ nome: 'Monte Muganà', wikipedia: { testo: fonte.testo } })).toBe(false); // troppo poco: resta senza racconto
        const g = wikiFinta({ conFrase: { 'Monte Muganà': [{ title: 'Cerami', coordinates: [{ lat: 37.80, lon: 14.55 }] }] }, voci: { Cerami: TROINA } });
        expect((await allargaWikipedia(mugana, null, g)).fonte).toBeNull();
    });
    it('niente di vero = niente fonte: Giardino di Sant\'Alessio e Galleria del Cardinale Colonna restano senza', async () => {
        const giardino = { nome: "Giardino di Sant'Alessio", citta: 'Roma', lat: 41.8840901, lng: 12.4788047 };
        const basilica = { title: 'Basilica dei Santi Bonifacio e Alessio', extract: 'La basilica è un luogo di culto di Roma.', coordinates: [{ lat: 41.8843, lon: 12.4791 }] };
        expect(await allargaWikipedia(giardino, null, wikiFinta({ vicine: [basilica] }))).toEqual({ fonte: null, errore: false });
        const cardinale = { nome: 'Galleria del Cardinale Colonna', citta: 'Roma', lat: 41.8974878, lng: 12.4848434 };
        expect(await allargaWikipedia(cardinale, null, wikiFinta({ conFrase: {} }))).toEqual({ fonte: null, errore: false });
    });
    it('Wikipedia che non risponde è un errore, non «nessuna voce» (il proxy risponde 503 e non memorizza)', async () => {
        const tappa = { nome: 'Torre Capitania', citta: 'Troina', lat: 37.78433, lng: 14.5992 };
        const r = await allargaWikipedia(tappa, null, wikiFinta({ fallisce: () => true }));
        expect(r).toEqual({ fonte: null, errore: true });
    });
    it('ogni richiesta porta il User-Agent vero (senza, Wikimedia la conta «non identificata»: 10 al minuto)', async () => {
        const f = wikiFinta();
        await cercaWikipedia({ nome: 'Porta Uzeda', citta: 'Catania', lat: 37.5018, lng: 15.08764 }, f);
        expect(f.mock.calls[0][1].headers['User-Agent']).toBe(UA_WIKIPEDIA);
        expect(UA_WIKIPEDIA).toMatch(/https:\/\//); // contatto: un URL intero, come chiede la policy
    });
});

describe('proxy: si allarga solo una tappa che resterebbe senza fonti; la soglia e i controlli non cambiano', () => {
    const src = fs.readFileSync('supabase/functions/openai-proxy/index.ts', 'utf8');
    it('allargaWikipedia solo dopo haFonti falso e Wikipedia che ha risposto; un errore non diventa «senza fonti»', () => {
        expect(src).toMatch(/if \(!haFonti\(fonti\) && !wikiRes\.errore\) \{[\s\S]{0,400}allargaWikipedia\(\{ nome, citta, lat, lng \}, wiki,/);
        expect(src).toMatch(/else if \(largo\.errore\) wikiRes\.errore = true/);
        expect(LIMITI.fonteMin).toBe(200);
    });
    it('cache: r7 vale; r6 vale salvo le fonti da menzioni (prese prima del pezzo col nome); r5 passato e scartato valgono; un «senza fonti» di prima si ricerca', () => {
        expect(VERSIONE_RACCONTO).toBe('r7');
        expect(versioneValida({ versione: 'r7', esito: 'senza-fonti' })).toBe(true);
        expect(versioneValida({ versione: 'r6', esito: 'passato', fonti: [{ fonte: 'wikipedia', titolo: 'Ex cattedrale', via: 'vicina' }] })).toBe(true);
        expect(versioneValida({ versione: 'r6', esito: 'senza-fonti', fonti: [] })).toBe(true);
        expect(versioneValida({ versione: 'r6', esito: 'passato', fonti: [{ fonte: 'wikipedia', titolo: 'Troina', via: 'menzioni' }] })).toBe(false); // Monte Muganà
        expect(versioneValida({ versione: 'r5', esito: 'passato' })).toBe(true);
        expect(versioneValida({ versione: 'r5', esito: 'scartato' })).toBe(true);
        expect(versioneValida({ versione: 'r5', esito: 'senza-fonti' })).toBe(false);
        expect(versioneValida({ versione: 'r4', esito: 'passato' })).toBe(true);
        expect(versioneValida({ versione: 'r4', esito: 'senza-fonti' })).toBe(false);
        expect(versioneValida({ versione: 'r3', esito: 'senza-fonti' })).toBe(false);
    });
});
