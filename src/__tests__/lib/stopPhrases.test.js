// P3d-j — Il modello sceglie, il codice scrive.
//
// (1) La matrice: ogni frase approvata, per famiglia × momento × gancio, passa
//     la rete esistente (parole vietate, luce/ora, oggetti, giudizi, voce), non
//     porta mai "null"/"undefined"/segnaposto, ha al massimo 2 frasi.
// (2) Le scelte del modello fuori elenco o non vere → riserva del codice.
// (3) I casi ✗ di P3d-e, P3d-g e P3d-i: per le stesse tappe la descrizione
//     composta e' vera e ha la voce giusta.

import { describe, it, expect } from 'vitest';
import {
    FRASI_LUOGO, FRASI_LOCALE, FRASI_GANCIO, GANCI, INTERESSI, stopData, composeStop, guardComposed, apertura,
    ganciValidi, userInterests, interessiPerTappa, famigliaFrase, fattoDi, testoPulito, oraParlata, FATTO_MAX,
} from '../../lib/stopPhrases';
import { voiceIssues, filterBannedWords } from '../../lib/narrationLight';
import { sunTimes } from '../../lib/sunTimes';

// Roma, 11/10/2026: alba ~07:15, tramonto ~18:3x (calcolato, non scritto a mano).
const DAY = { y: 2026, m: 10, d: 11 };
const SUN = sunTimes(DAY, 41.8986, 12.4769);
const hhmm = (d) => new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
const TRAMONTO = hhmm(SUN.sunset);
const at = (h, m) => new Date(`2026-10-11T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00+02:00`);
const minus = (d, min) => new Date(d.getTime() - min * 60000);

// Un arrivo coerente con ogni momento; all'aperitivo 35 minuti prima del tramonto.
const ARRIVI = {
    mattina: at(10, 0), pranzo: at(13, 0), pomeriggio: at(16, 0),
    aperitivo: minus(SUN.sunset, 35), cena: at(20, 30), dopocena: at(22, 30),
};

const LUOGHI = {
    panorama: { title: 'Belvedere Cederna', types: ['tourist_attraction'] },
    chiesa: { title: 'Basilica di San Clemente', types: ['church', 'tourist_attraction'] },
    museo: { title: 'Museo Barracco', types: ['museum'] },
    piazza: { title: 'Piazza Colonna', types: ['establishment'] },
    verde: { title: 'Villa Sciarra', types: ['park'] },
    porta: { title: 'Porta Garibaldi', types: ['establishment'] },
    arco: { title: 'Arco di San Benedetto', types: ['establishment'] },
    monumento: { title: "Fontana dell'Amenano", types: ['tourist_attraction'] },
    altro: { title: 'Hortus Urbis', types: ['point_of_interest'] },
};
const LOCALI = {
    colazione: ['mattina', { title: 'Bar del Fico', types: ['bar', 'cafe'] }],
    pranzo: ['pranzo', { title: 'Trattoria Della Stampa', types: ['restaurant', 'food'] }],
    aperitivo: ['aperitivo', { title: 'Drinkeria cocktail bar', types: ['bar'] }],
    cena: ['cena', { title: 'Osteria Navona', types: ['restaurant', 'bar', 'food'] }],
    dopocena: ['dopocena', { title: 'Gelateria del Teatro', types: ['ice_cream_shop', 'food'] }],
};
const FATTI_AVENTINO = [{ testo: "L'Aventino è uno dei sette colli su cui venne fondata Roma, il più a sud.", fonte: 'wikipedia' }];

// Tutte le varianti: la tappa cambia place_id finche' le ha viste tutte.
const conIdPerVariante = (stop, dati, n) => {
    const ids = [];
    const visti = new Set();
    for (let i = 0; i < 400 && visti.size < n; i++) {
        const d = stopData({ ...dati, stop: { ...stop, place_id: `pid-${i}` } });
        const a = apertura(d);
        if (!visti.has(a.replace(stop.title, '#'))) { visti.add(a.replace(stop.title, '#')); ids.push(`pid-${i}`); }
    }
    return ids;
};

const passaLaRete = (d, scelta, arrivo, fatti = [], interessi = []) => guardComposed(d, scelta, {
    interessi, arrival: arrivo, sunrise: SUN.sunrise, sunset: SUN.sunset, fatti,
});
const frasiDi = (t) => t.split(/(?<=[.!?])\s+/).filter(Boolean);

describe('P3d-j — le frasi sono esattamente quelle approvate', () => {
    it('elenco e conteggio', () => {
        expect(GANCI).toEqual(['tramonto', 'legame', 'distanza', 'prima', 'ultima', 'orario']);
        expect(FRASI_GANCIO.tramonto).toBe('Il sole tramonta alle {tramonto}: sei qui {delta} minuti prima.');
        expect(FRASI_LUOGO.panorama).toEqual(['Ti fermi a {nome}: qui si guarda, non si corre.', '{nome} è il punto in cui la giornata rallenta.']);
        expect(FRASI_LOCALE.pranzo[1]).toBe('A {min} minuti a piedi ti siedi da {nome}, {tipo} in fascia {fascia}.');
        expect(Object.values(FRASI_LUOGO).flat()).toHaveLength(15);
        expect(Object.values(FRASI_LOCALE).flat()).toHaveLength(7);
    });
});

describe('P3d-j — matrice: famiglia × momento × gancio, tutte passano verita\' e voce', () => {
    const casi = [];
    for (const [fam, stop] of Object.entries(LUOGHI)) {
        for (const momento of ['mattina', 'pomeriggio', 'aperitivo']) casi.push({ nome: `${fam}/${momento}`, stop, momento, locale: false, fam });
    }
    for (const [k, [momento, stop]] of Object.entries(LOCALI)) casi.push({ nome: `locale-${k}`, stop, momento, locale: true, fam: k });

    for (const c of casi) {
        it(c.nome, () => {
            const arrivo = ARRIVI[c.momento];
            const base = {
                momento: c.momento, orario: hhmm(arrivo), tramonto: TRAMONTO, minutiDaPrima: 12,
                locale: c.locale, priceLevel: 2,
            };
            const nVar = c.locale ? FRASI_LOCALE[c.fam].length : FRASI_LUOGO[c.fam].length;
            const ids = conIdPerVariante(c.stop, base, nVar);
            expect(ids.length, 'tutte le varianti raggiunte').toBe(nVar);
            const interessi = ['panorami', 'chiese', 'piazze', 'arte', 'storia', 'verde', 'aperitivo', 'sera'];
            for (const id of ids) {
                for (const [primo, ultimo] of [[false, false], [true, false], [false, true]]) {
                    const d = stopData({ ...base, stop: { ...c.stop, place_id: id }, primo, ultimo });
                    expect(famigliaFrase(c.stop)).toBe(c.locale ? famigliaFrase(c.stop) : c.fam);
                    const interessiVeri = interessiPerTappa(d, interessi);
                    for (const gancio of [...GANCI, null]) {
                        const scelta = { usaFatto: false, gancio, interesse: gancio === 'legame' ? (interessiVeri[0] || 'arte') : null };
                        const r = passaLaRete(d, scelta, arrivo, [], interessi);
                        expect(r.rete, `${r.text}`).toEqual([]);
                        expect(testoPulito(r.text), r.text).toBe(true);
                        expect(frasiDi(r.text).length).toBeLessThanOrEqual(2);
                        for (const f of frasiDi(r.text)) expect(voiceIssues(f), f).toEqual([]);
                        // se il gancio scelto e' vero, e' quello che si legge
                        const validi = ganciValidi(d, { aperturaTesto: apertura(d), interesse: scelta.interesse });
                        if (gancio && validi.has(gancio) && (gancio !== 'legame' || interessiVeri.includes(scelta.interesse))) {
                            expect(r.composta.gancio).toBe(gancio);
                        }
                    }
                }
            }
        });
    }

    it('con un fatto: la prima frase e\' il fatto, poi il gancio; le parole vietate non valgono sul fatto', () => {
        const porta = [{ testo: 'Porta Garibaldi è un arco trionfale storico costruito nel 1768 in onore delle nozze di Ferdinando IV.', fonte: 'wikipedia' }];
        expect(filterBannedWords(porta[0].testo).text).toBeNull(); // da sola, "storico" la toglierebbe
        const d = stopData({ stop: { title: 'Porta Garibaldi', place_id: 'pg', types: ['establishment'] }, momento: 'pomeriggio', orario: '16:00', tramonto: TRAMONTO, minutiDaPrima: 14, fatti: porta });
        const r = passaLaRete(d, { usaFatto: true, gancio: 'distanza' }, at(16, 0), porta);
        expect(r.rete).toEqual([]);
        expect(r.text).toBe(`${porta[0].testo} Sono 14 minuti a piedi dalla tappa prima.`);
    });

    it('il fatto si taglia alla prima frase intera e al massimo a 180 caratteri; le etichette "Nome: descrizione." non sono fatti', () => {
        expect(fattoDi([{ testo: 'Pincio: colle di Roma.', fonte: 'wikidata' }, ...FATTI_AVENTINO])).toBe(FATTI_AVENTINO[0].testo);
        expect(fattoDi([{ testo: 'Piazza Navona: piazza di Roma.', fonte: 'wikipedia' }])).toBeNull();
        expect(fattoDi([{ testo: 'La piazza fu costruita nel 1651. Ospita tre fontane.', fonte: 'wikipedia' }])).toBe('La piazza fu costruita nel 1651.');
        expect(fattoDi([{ testo: `${'A'.repeat(FATTO_MAX)} fine.`, fonte: 'wikipedia' }])).toBeNull();
    });
});

describe('P3d-j — scelte fuori elenco → riserva del codice', () => {
    const base = { stop: { title: 'Belvedere Cederna', place_id: 'bc', types: ['tourist_attraction'] }, momento: 'aperitivo', orario: hhmm(ARRIVI.aperitivo), tramonto: TRAMONTO, minutiDaPrima: 8 };

    it('gancio inventato, usaFatto non booleano, interesse non dell\'utente → riserva, dichiarata', () => {
        const d = stopData(base);
        const r = composeStop(d, { usaFatto: 'forse', gancio: 'atmosfera', interesse: 'gelato' }, ['panorami']);
        expect(r.riserva).toEqual(expect.arrayContaining(['usaFatto', 'gancio', 'interesse']));
        expect(r.gancio).toBe('tramonto'); // il primo vero, in ordine di riserva
        expect(r.text).toMatch(/Il sole tramonta alle \d{1,2}(:\d{2})?: sei qui 35 minuti prima\.$/);
    });

    it('(6) tramonto solo fra 0 e 60 minuti dopo l\'arrivo; mai sole alto o basso', () => {
        const presto = stopData({ ...base, orario: hhmm(minus(SUN.sunset, 75)) });
        expect(ganciValidi(presto, { aperturaTesto: apertura(presto) }).has('tramonto')).toBe(false);
        const dopo = stopData({ ...base, orario: hhmm(new Date(SUN.sunset.getTime() + 10 * 60000)) });
        expect(ganciValidi(dopo, { aperturaTesto: apertura(dopo) }).has('tramonto')).toBe(false);
        const giusto = stopData({ ...base, orario: hhmm(minus(SUN.sunset, 60)) });
        expect(ganciValidi(giusto, { aperturaTesto: apertura(giusto) }).has('tramonto')).toBe(true);
        for (const t of Object.values(FRASI_GANCIO)) expect(t).not.toMatch(/sole (alto|basso)|luce/);
    });

    it('(5) legame solo con un interesse dell\'utente e vero per QUEL posto', () => {
        const d = stopData(base);
        expect(composeStop(d, { gancio: 'legame', interesse: 'panorami' }, ['panorami']).text).toMatch(/È qui perché cerchi i panorami\.$/);
        // "le chiese" su un belvedere non e' vero → riserva
        expect(composeStop(d, { gancio: 'legame', interesse: 'chiese' }, ['chiese']).gancio).not.toBe('legame');
        // "i panorami" non chiesto dall'utente → riserva
        expect(composeStop(d, { gancio: 'legame', interesse: 'panorami' }, []).gancio).not.toBe('legame');
    });

    it('(4) niente doppioni: orario gia\' detto → no "orario"; minuti gia\' detti → no "distanza"', () => {
        const museo = { stop: { title: 'Museo Barracco', types: ['museum'] }, momento: 'mattina', orario: '10:00', minutiDaPrima: 7 };
        const id = conIdPerVariante(museo.stop, museo, 2).find(x => apertura(stopData({ ...museo, stop: { ...museo.stop, place_id: x } })).includes('alle 10'));
        const d = stopData({ ...museo, stop: { ...museo.stop, place_id: id } });
        expect(apertura(d)).toBe('Entri a Museo Barracco alle 10: il resto può aspettare.');
        expect(composeStop(d, { gancio: 'orario' }).gancio).not.toBe('orario');
        const pranzo = { stop: { title: 'Trattoria Uno', types: ['restaurant'] }, momento: 'pranzo', minutiDaPrima: 9, locale: true, priceLevel: 2 };
        const idp = conIdPerVariante(pranzo.stop, pranzo, 2).find(x => apertura(stopData({ ...pranzo, stop: { ...pranzo.stop, place_id: x } })).startsWith('A 9 minuti'));
        const dp = stopData({ ...pranzo, stop: { ...pranzo.stop, place_id: idp } });
        expect(apertura(dp)).toBe('A 9 minuti a piedi ti siedi da Trattoria Uno, trattoria in fascia €€.');
        expect(composeStop(dp, { gancio: 'distanza' }).gancio).not.toBe('distanza');
    });

    it('scelta fissa: la stessa tappa ha sempre la stessa variante', () => {
        const a = composeStop(stopData(base), { gancio: 'prima' }).text;
        for (let i = 0; i < 5; i++) expect(composeStop(stopData(base), { gancio: 'prima' }).text).toBe(a);
    });

    it('dati mancanti: mai un buco — senza orario l\'altra variante, senza tipo o fascia la coda si accorcia', () => {
        for (let i = 0; i < 30; i++) {
            const museo = stopData({ stop: { title: 'Museo Barracco', place_id: `m${i}`, types: ['museum'] }, momento: 'pomeriggio' });
            expect(apertura(museo)).toBe('Museo Barracco è la tappa da fare con calma.');
            const altro = stopData({ stop: { title: 'Hortus Urbis', place_id: `h${i}`, types: [] }, momento: 'pomeriggio' });
            expect(apertura(altro)).toBe('Hortus Urbis è la prossima tappa del tuo giro.');
        }
        const senzaTipo = stopData({ stop: { title: 'Da Enzo al 29', place_id: 'e', types: ['restaurant'] }, momento: 'cena', locale: true, priceLevel: 2 });
        expect(apertura(senzaTipo)).toMatch(/^(La cena è da Enzo al 29\.|Chiudi la giornata a tavola da Enzo al 29\.)$/);
        const senzaFascia = stopData({ stop: { title: 'Osteria Navona', place_id: 'o', types: ['restaurant'] }, momento: 'cena', locale: true });
        expect(apertura(senzaFascia)).toMatch(/, osteria\.$/);
        expect(oraParlata('18:00')).toBe('18');
        expect(oraParlata('09:05')).toBe('9:05');
    });
});

describe('P3d-j — interessi dell\'utente: elenco chiuso con forma breve', () => {
    it('ogni interesse ha una forma breve con articolo', () => {
        for (const i of INTERESSI) expect(i.forma, i.key).toMatch(/^(il|lo|la|i|gli|le|l')\s?\S/);
    });
    it('dal wizard, dal testo e dal DNA sopra la soglia di fiducia', () => {
        expect(userInterests({ wizard: ['Arte', 'Cibo'] })).toEqual(['arte']);
        // P3d-j (chiusura) — "il cibo" tolto: nessun legame sui pasti.
        expect(INTERESSI.map(i => i.key)).not.toContain('cibo');
        expect(userInterests({ text: 'i belvederi di Roma e le chiese barocche' })).toEqual(expect.arrayContaining(['panorami', 'chiese']));
        expect(userInterests({ wizard: ['Piazze Eterne', 'Ville Nobiliari'] })).toEqual(expect.arrayContaining(['piazze', 'verde']));
        expect(userInterests({ dnaWeights: { natura: 0.8, food: 0.3, _share: 0.2 } })).toEqual(['verde']);
        expect(userInterests({ dnaWeights: { natura: 0.8, _share: 0 } })).toEqual([]);
        expect(userInterests({ text: 'Domani voglio vivere Roma da romano' })).toEqual([]);
    });
});

// ─── I casi ✗ di P3d-e, P3d-g, P3d-i: stesse tappe, descrizione composta ─────
describe('P3d-j — i casi ✗ di P3d-e, P3d-g e P3d-i diventano descrizioni vere', () => {
    const PINCIO = [
        { testo: 'Il Pincio è un colle di Roma, alto 61 m s.l.m., che si trova a nord del Quirinale.', fonte: 'wikipedia' },
        { testo: 'Pincio: colle di Roma.', fonte: 'wikidata' },
    ];
    // [tappa, types, momento, locale, fatti, fattiSu, cosa NON deve piu' comparire]
    const CASI = [
        ['Belvedere Tarpeo', ['tourist_attraction'], 'aperitivo', false, [], null, /straordinari|vista/],
        ['Terrazza Belvedere Aventino', ['tourist_attraction'], 'mattina', false, FATTI_AVENTINO, null, /miglior|richiesta/],
        ['Piazza Vincenzo Bellini', ['establishment'], 'mattina', false, [], null, /cuore/],
        ['Belvedere del Salviati · Terrazza Panoramica Passeggiata del Gianicolo', ['tourist_attraction'], 'aperitivo', false, [], null, /meno frequentat/],
        ['Osteria Navona', ['restaurant', 'bar', 'food'], 'cena', true, [], null, /trattoria|\bbar\b/i],
        ['Galleria Colonna', ['museum', 'art_gallery'], 'pomeriggio', false, [], null, /uniche|raccont/],
        ['Gianicolo Belvedere', ['tourist_attraction'], 'aperitivo', false, [], null, /incantevol|luna/],
        ['Ingresso di Villa Pamphili', ['park'], 'mattina', false, [], null, /incontaminat|invita/],
        ['Belvedere Cederna', ['tourist_attraction'], 'aperitivo', false, [], null, /richiesta|insider|cercando/],
        ['Piazza Umbrella', ['establishment'], 'mattina', false, [], null, /richiesta|insider/],
        ['Belvedere Di Carminello', ['tourist_attraction'], 'aperitivo', false, [], null, /richiesta/],
        ['Piazza Colonna', ['establishment'], 'pomeriggio', false, [], null, /^Arriverai/],
        ['Hortus Urbis', ['point_of_interest'], 'pomeriggio', false, [], null, /scelt[oa] per il tour/],
        ['Basilica dei Santi XII Apostoli', ['church'], 'pomeriggio', false, [], null, /scelt[oa] per il tour/],
        ['Villa Sciarra', ['park'], 'pomeriggio', false, [], null, /scelt[oa] per il tour/],
        ['È Passata la Moretta | Osteria Romana di un Tempo', ['restaurant', 'food'], 'pranzo', true, [], null, /^Per il pranzo:/],
        ['Trattoria Sorano', ['restaurant', 'food'], 'cena', true, [], null, /^Per la cena:/],
        ['Osteria da Fortunata - Baullari', ['restaurant', 'food'], 'dopocena', true, [], null, /disposizione/],
        ['Trattoria Della Stampa', ['restaurant', 'food'], 'dopocena', true, [], null, /disposizione/],
        ['Terrazza del Pincio', ['tourist_attraction'], 'pomeriggio', false, PINCIO, 'Pincio', /^Un colle/],
    ];
    for (const [nome, types, momento, locale, fatti, fattiSu, vietato] of CASI) {
        it(`${nome} (${momento})`, () => {
            const arrivo = ARRIVI[momento];
            const d = stopData({ stop: { title: nome, place_id: nome, types }, momento, orario: hhmm(arrivo), tramonto: TRAMONTO, minutiDaPrima: 8, locale, priceLevel: locale ? 2 : null, fatti });
            for (const scelta of [{ usaFatto: true, gancio: 'tramonto' }, { usaFatto: false, gancio: 'distanza' }, { usaFatto: false, gancio: 'orario' }]) {
                const r = guardComposed(d, scelta, { arrival: arrivo, sunrise: SUN.sunrise, sunset: SUN.sunset, fatti, fattiSu, voce: { richiesta: 'Domani voglio vivere Roma da romano', oggetto: 'un giro insider' } });
                expect(r.rete, r.text).toEqual([]);
                expect(r.text).not.toMatch(vietato);
                expect(testoPulito(r.text)).toBe(true);
            }
        });
    }

    it('alle 00:04 un\'osteria non e\' "a disposizione": nel dopocena la frase dice solo dove vai', () => {
        const d = stopData({ stop: { title: 'Osteria da Fortunata - Baullari', place_id: 'f', types: ['restaurant'] }, momento: 'dopocena', locale: true });
        expect(apertura(d)).toBe('Osteria da Fortunata - Baullari è la prossima tappa del tuo giro.');
    });
});

// ─── P3d-j (chiusura) — il legame viene SOLO dagli interessi dell'utente ─────
describe('P3d-j (chiusura) — legame mai dal tema del tour', () => {
    it('interesse scelto "Cibo": su un museo o una chiesa nessun "È qui perché cerchi l\'arte/la storia"', () => {
        const interessi = userInterests({ wizard: ['Cibo'] });
        expect(interessi).toEqual([]);
        for (const [title, types] of [['Musei Capitolini', ['museum']], ['Chiesa del Gesù', ['church']]]) {
            const d = stopData({ stop: { title, place_id: title, types }, momento: 'pomeriggio', orario: '16:00', minutiDaPrima: 9 });
            for (const scelta of [{ gancio: 'legame', interesse: 'arte' }, { gancio: 'legame', interesse: 'storia' }, { gancio: 'legame', interesse: 'cibo' }]) {
                const r = composeStop(d, scelta, interessi);
                expect(r.text, r.text).not.toMatch(/È qui perché cerchi/);
                expect(r.gancio).not.toBe('legame');
            }
            expect(ganciValidi(d, { aperturaTesto: apertura(d), interesse: interessiPerTappa(d, interessi)[0] || null }).has('legame')).toBe(false);
        }
    });
});

// ─── P3d-j (chiusura) — i ✗ della prova reale dell'11/10 ─────────────────────
describe('P3d-j (chiusura) — i ✗ della prova reale', () => {
    it('"Osteria Pizzeria Come Va?" (type Google anche bar) non e\' un bar da colazione', () => {
        const d = stopData({ stop: { title: 'Osteria Pizzeria Come Va?', place_id: 'cv', types: ['restaurant', 'bar', 'food'] }, momento: 'mattina', locale: true, priceLevel: 2 });
        expect(apertura(d)).not.toMatch(/caffè/);
        const bar = stopData({ stop: { title: 'Bar del Fico', place_id: 'bf', types: ['bar', 'cafe'] }, momento: 'mattina', locale: true });
        expect(apertura(bar)).toBe('Si parte da Bar del Fico: un caffè e si comincia.');
    });

    it('"prima della prossima tappa" mai sull\'ultima tappa', () => {
        for (let i = 0; i < 20; i++) {
            const d = stopData({ stop: { title: 'Parco delle Valli', place_id: `pv${i}`, types: ['park'] }, momento: 'pomeriggio', ultimo: true });
            expect(apertura(d)).toBe('Ti prendi una pausa a Parco delle Valli.');
        }
    });

    it('"da Da Tonino" → "da Tonino"', () => {
        const d = stopData({ stop: { title: 'Da Tonino - Trattoria Bassetti', place_id: 'dt', types: ['restaurant'] }, momento: 'cena', locale: true, priceLevel: 2 });
        expect(apertura(d)).toMatch(/^(La cena è da Tonino - Trattoria Bassetti|Chiudi la giornata a tavola da Tonino - Trattoria Bassetti), trattoria in fascia €€\.$/);
    });

    it('una passeggiata si attraversa, non ci si ferma "davanti a" lei', () => {
        const d = stopData({ stop: { title: 'Passeggiata del Gianicolo', place_id: 'pg', types: ['tourist_attraction'] }, momento: 'pomeriggio' });
        expect(apertura(d)).toMatch(/^(Attraversi Passeggiata del Gianicolo piano, senza fretta\.|Passi da Passeggiata del Gianicolo: guardati intorno prima di ripartire\.)$/);
    });

    it('"Per Te" non e\' una giornata: niente "Qui la giornata si chiude"', () => {
        const d = stopData({ stop: { title: 'Parco delle Valli', place_id: 'pv', types: ['park'] }, ultimo: true, giornata: false });
        expect(ganciValidi(d, { aperturaTesto: apertura(d) }).has('ultima')).toBe(false);
        expect(composeStop(d, { gancio: 'ultima' }).text).not.toMatch(/giornata si chiude/);
    });
});
