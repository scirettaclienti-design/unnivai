// TESTI-SCHEDE — la preposizione articolata giusta davanti al nome di un luogo (una sola funzione per guida e schede).
import { describe, it, expect } from 'vitest';
import { conPrep, alNome, articoloDi } from '../../lib/preposizioni';
import { stopData, apertura, conPreposizioni, frasiUsateDa, registraFrasi, guardComposed } from '../../lib/stopPhrases';

// nome reale → [a, da, davanti a, in]
const NOMI = [
    ['Parco del Gianicolo', 'al Parco del Gianicolo', 'dal Parco del Gianicolo', 'davanti al Parco del Gianicolo', 'nel Parco del Gianicolo'],
    ['Galleria del Cardinale Colonna', 'alla Galleria del Cardinale Colonna', 'dalla Galleria del Cardinale Colonna', 'davanti alla Galleria del Cardinale Colonna', 'nella Galleria del Cardinale Colonna'],
    ['Passeggiata del Gianicolo', 'alla Passeggiata del Gianicolo', 'dalla Passeggiata del Gianicolo', 'davanti alla Passeggiata del Gianicolo', 'nella Passeggiata del Gianicolo'],
    ['Piazza del Campidoglio', 'alla Piazza del Campidoglio', 'dalla Piazza del Campidoglio', 'davanti alla Piazza del Campidoglio', 'nella Piazza del Campidoglio'],
    ['Villa Borghese', 'alla Villa Borghese', 'dalla Villa Borghese', 'davanti alla Villa Borghese', 'nella Villa Borghese'],
    ['Orto Botanico', "all'Orto Botanico", "dall'Orto Botanico", "davanti all'Orto Botanico", "nell'Orto Botanico"],
    ['Teatro Marcello', 'al Teatro Marcello', 'dal Teatro Marcello', 'davanti al Teatro Marcello', 'nel Teatro Marcello'],
    ['Via Etnea', 'alla Via Etnea', 'dalla Via Etnea', 'davanti alla Via Etnea', 'nella Via Etnea'],
    ['Chiesa del Gesù', 'alla Chiesa del Gesù', 'dalla Chiesa del Gesù', 'davanti alla Chiesa del Gesù', 'nella Chiesa del Gesù'],
    ["Basilica Cattedrale di Sant'Agata", "alla Basilica Cattedrale di Sant'Agata", "dalla Basilica Cattedrale di Sant'Agata", "davanti alla Basilica Cattedrale di Sant'Agata", "nella Basilica Cattedrale di Sant'Agata"],
    ["Fontana dell'Acqua Paola", "alla Fontana dell'Acqua Paola", "dalla Fontana dell'Acqua Paola", "davanti alla Fontana dell'Acqua Paola", "nella Fontana dell'Acqua Paola"],
    ['Palazzo Altemps', 'al Palazzo Altemps', 'dal Palazzo Altemps', 'davanti al Palazzo Altemps', 'nel Palazzo Altemps'],
    ['Museo Barracco', 'al Museo Barracco', 'dal Museo Barracco', 'davanti al Museo Barracco', 'nel Museo Barracco'],
    ['Castello Ursino', 'al Castello Ursino', 'dal Castello Ursino', 'davanti al Castello Ursino', 'nel Castello Ursino'],
    ['Ponte Sisto', 'al Ponte Sisto', 'dal Ponte Sisto', 'davanti al Ponte Sisto', 'nel Ponte Sisto'],
    ['Mercato di Testaccio', 'al Mercato di Testaccio', 'dal Mercato di Testaccio', 'davanti al Mercato di Testaccio', 'nel Mercato di Testaccio'],
    ['Duomo di Catania', 'al Duomo di Catania', 'dal Duomo di Catania', 'davanti al Duomo di Catania', 'nel Duomo di Catania'],
    ['Lungotevere dei Mellini', 'al Lungotevere dei Mellini', 'dal Lungotevere dei Mellini', 'davanti al Lungotevere dei Mellini', 'nel Lungotevere dei Mellini'],
    ['Scalinata di Trinità dei Monti', 'alla Scalinata di Trinità dei Monti', 'dalla Scalinata di Trinità dei Monti', 'davanti alla Scalinata di Trinità dei Monti', 'nella Scalinata di Trinità dei Monti'],
    ['Isola Tiberina', "all'Isola Tiberina", "dall'Isola Tiberina", "davanti all'Isola Tiberina", "nell'Isola Tiberina"],
    ['Anfiteatro Flavio', "all'Anfiteatro Flavio", "dall'Anfiteatro Flavio", "davanti all'Anfiteatro Flavio", "nell'Anfiteatro Flavio"],
    ['Stadio Massimino', 'allo Stadio Massimino', 'dallo Stadio Massimino', 'davanti allo Stadio Massimino', 'nello Stadio Massimino'],
    ['Terme di Caracalla', 'alle Terme di Caracalla', 'dalle Terme di Caracalla', 'davanti alle Terme di Caracalla', 'nelle Terme di Caracalla'],
    ['Musei Capitolini', 'ai Musei Capitolini', 'dai Musei Capitolini', 'davanti ai Musei Capitolini', 'nei Musei Capitolini'],
    ['Giardini Margherita', 'ai Giardini Margherita', 'dai Giardini Margherita', 'davanti ai Giardini Margherita', 'nei Giardini Margherita'],
    ['Mura Aureliane', 'alle Mura Aureliane', 'dalle Mura Aureliane', 'davanti alle Mura Aureliane', 'nelle Mura Aureliane'],
    ['Il Duomo', 'al Duomo', 'dal Duomo', 'davanti al Duomo', 'nel Duomo'],
    ["L'Antica Pizzeria", "all'Antica Pizzeria", "dall'Antica Pizzeria", "davanti all'Antica Pizzeria", "nell'Antica Pizzeria"],
    ['Colosseo', 'al Colosseo', 'dal Colosseo', 'davanti al Colosseo', 'nel Colosseo'],
    ['Santa Maria in Trastevere', 'a Santa Maria in Trastevere', 'da Santa Maria in Trastevere', 'davanti a Santa Maria in Trastevere', 'in Santa Maria in Trastevere'],
];

describe('TESTI-SCHEDE — la preposizione articolata davanti al nome', () => {
    it('almeno 20 nomi reali, maschili e femminili, singolari e plurali, con iniziale vocale', () => {
        expect(NOMI.length).toBeGreaterThanOrEqual(20);
    });
    it.each(NOMI)('%s', (nome, a, da, davanti, dentro) => {
        expect(conPrep('a', nome)).toBe(a);
        expect(conPrep('da', nome)).toBe(da);
        expect(conPrep('davanti a', nome)).toBe(davanti);
        expect(conPrep('in', nome)).toBe(dentro);
    });
    it('alNome è la stessa funzione (la guida e le schede non hanno due regole)', () => {
        for (const [nome, a] of NOMI) expect(alNome(nome)).toBe(a);
    });
    it('«Isola» non è l\'articolo «i»: nessun «ai sola»', () => {
        expect(articoloDi('Isola Tiberina').art).toBe("l'");
        expect(articoloDi('Il Duomo')).toEqual({ art: 'il', resto: 'Duomo' });
    });
    it('articolo semplice per le altre preposizioni: sotto, dentro, intorno a, fino a', () => {
        expect(conPrep('sotto', "Arco di Costantino")).toBe("sotto l'Arco di Costantino");
        expect(conPrep('dentro', 'Chiesa del Gesù')).toBe('dentro la Chiesa del Gesù');
        expect(conPrep('intorno a', 'Fontana di Trevi')).toBe('intorno alla Fontana di Trevi');
        expect(conPrep('fino a', 'Bar Popolare')).toBe('fino al Bar Popolare');
        expect(conPrep('', 'Colosseo')).toBe('il Colosseo');
    });
    it('nei titoli i toponimi non hanno l\'articolo: «Da Piazza Navona a Villa Borghese»', () => {
        expect(conPrep('da', 'Piazza Navona', { toponimi: true })).toBe('da Piazza Navona');
        expect(conPrep('a', 'Villa Borghese', { toponimi: true })).toBe('a Villa Borghese');
        expect(conPrep('a', 'Parco del Gianicolo', { toponimi: true })).toBe('al Parco del Gianicolo');
    });
    it('un locale che non si riconosce resta senza articolo: «da Roscioli», «da Enzo al 29», «dal Convivio»', () => {
        expect(conPrep('da', 'Roscioli', { fallback: 'nessuno' })).toBe('da Roscioli');
        expect(conPrep('da', 'Da Enzo al 29', { fallback: 'nessuno' })).toBe('da Enzo al 29');
        expect(conPrep('da', 'Il Convivio', { fallback: 'nessuno' })).toBe('dal Convivio');
    });
});

describe('TESTI-SCHEDE — i casi veri di Ivano, nelle frasi delle schede', () => {
    it('«Ti prendi una pausa al Parco del Gianicolo», mai «a Parco»', () => {
        const verde = stopData({ stop: { title: 'Parco del Gianicolo', place_id: 'pg1', types: ['park'] }, momento: 'pomeriggio' });
        const lista = [];
        const evita = new Set();
        for (let i = 0; i < 8; i++) { const f = apertura(verde, { evita }); lista.push(f); registraFrasi(evita, f, verde.nome); }
        expect(lista).toContain('Ti prendi una pausa al Parco del Gianicolo.');
        for (const f of lista) expect(f).not.toMatch(/\b(a|da|davanti a) Parco\b/);
    });
    it('«Ti fermi davanti alla Galleria del Cardinale Colonna» e «Passi dalla Passeggiata del Gianicolo»', () => {
        const mon = stopData({ stop: { title: 'Galleria del Cardinale Colonna', place_id: 'gc', types: ['tourist_attraction', 'museum'] }, momento: 'pomeriggio' });
        const v = conPreposizioni(mon);
        expect(v.davantiNome).toBe('davanti alla Galleria del Cardinale Colonna');
        const pass = stopData({ stop: { title: 'Passeggiata del Gianicolo', place_id: 'pg', types: ['tourist_attraction'] }, momento: 'pomeriggio' });
        expect(conPreposizioni(pass).daNome).toBe('dalla Passeggiata del Gianicolo');
        const lista = [];
        const evita = new Set();
        for (let i = 0; i < 8; i++) { const f = apertura(pass, { evita }); lista.push(f); registraFrasi(evita, f, pass.nome); }
        expect(lista).toContain('Passi dalla Passeggiata del Gianicolo: guardati intorno prima di ripartire.');
        expect(lista).toContain('Attraversi la Passeggiata del Gianicolo piano, senza fretta.');
    });
    it('nessuna frase composta ha una preposizione semplice davanti a un nome con articolo', () => {
        const nomi = NOMI.map(n => n[0]);
        for (const nome of nomi) {
            for (const types of [['park'], ['tourist_attraction'], ['church'], ['museum']]) {
                const d = stopData({ stop: { title: nome, place_id: `${nome}-${types[0]}`, types }, momento: 'pomeriggio', orario: '15:00' });
                const evita = new Set();
                for (let i = 0; i < 8; i++) {
                    const f = apertura(d, { evita });
                    registraFrasi(evita, f, d.nome);
                    expect(f, `${nome} / ${types[0]}`).not.toMatch(/\b(a|da|davanti a|in|fino a) (Parco|Galleria|Passeggiata|Piazza|Villa|Teatro|Via|Chiesa|Basilica|Fontana|Palazzo|Museo|Castello|Ponte|Mercato|Duomo|Lungotevere|Scalinata|Isola|Orto|Anfiteatro|Stadio|Terme|Musei|Giardini|Mura)\b/);
                }
            }
        }
    });
});

describe('TESTI-SCHEDE — la stessa frase non torna sulle schede della lista', () => {
    it('frasiUsateDa: una seconda tornata di schede parte dalle frasi già dette', () => {
        const prima = [{ stops: [{ title: 'Torre Capitania', description: 'Torre Capitania è sulla tua strada: entri, guardi, riparti. Sono 3 minuti a piedi dalla tappa prima.' }] }];
        const usate = frasiUsateDa(prima);
        expect(usate.has('sono <n> minuti a piedi dalla tappa prima.')).toBe(true);
        const d = stopData({ stop: { title: 'Convento di Sant\'Agostino', place_id: 'ca', types: ['place_of_worship'] }, momento: 'pomeriggio', minutiDaPrima: 3, giornata: false });
        const r = guardComposed(d, {}, { evita: usate });
        expect(r.text).not.toMatch(/Sono 3 minuti a piedi/);
        expect(r.text).not.toMatch(/sulla tua strada: entri/);
    });
    it('14 tappe di una lista di Per Te: nessuna frase (mascherata) due volte', () => {
        const tappe = [
            ['Chiesa di San Francesco Borgia', ['church']], ['Antica Putia Odeon', ['restaurant']], ['Palazzo della Cultura Catania', ['museum']],
            ['Museo degli Antichi Strumenti di Scrittura', ['museum']], ['Monastero dei Benedettini di San Nicolò l\'Arena', ['tourist_attraction']],
            ['Odeon Romano', ['tourist_attraction']], ['Basilica Cattedrale di Sant\'Agata', ['church']], ['Lungomare di Acicastello', ['tourist_attraction']],
            ['Chiesa della Badia di Sant\'Agata', ['church']], ['Fontana dell’Amenano', ['tourist_attraction']], ['Palazzo dei Chierici', ['tourist_attraction']],
            ['Palazzo degli Elefanti', ['tourist_attraction']], ['Lungomare Ognina', ['tourist_attraction']], ['La Scogliera', ['natural_feature']],
        ];
        const usate = new Set();
        const viste = new Map();
        tappe.forEach(([titolo, types], i) => {
            const d = stopData({ stop: { title: titolo, place_id: `c${i}`, types }, momento: 'pomeriggio', minutiDaPrima: 3 + (i % 2), locale: types[0] === 'restaurant', giornata: false });
            const r = guardComposed(d, {}, { evita: usate });
            registraFrasi(usate, r.text, d.nome);
            for (const f of r.text.split(/(?<=[.!?])\s+/)) {
                const m = f.toLowerCase().replace(d.nome.toLowerCase(), '<nome>').replace(/\d+/g, '#');
                viste.set(m, [...(viste.get(m) || []), titolo]);
            }
        });
        const doppie = [...viste].filter(([, v]) => v.length > 1);
        expect(doppie).toEqual([]);
    });
});
