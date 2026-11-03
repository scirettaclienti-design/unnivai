// BANCO-40 — i 40 casi fissi del banco: i 18 di sempre (banco nazionale: 11 luoghi neutri, profili A/B a Roma e Catania, Per Te a Roma e
// Catania, Troina → «una giornata a Roma») più 22 che coprono la griglia: città grandi, borghi, ore diverse (mattina, 13, sera, notte),
// richieste generiche e specifiche, ospite, giro lontano, ritmi diversi, DNA forte su cibo / cultura / natura.
// Dati puri, nel formato del banco esteso (casi-esteso.js): li gira esteso.live.js, li rigioca replay.giro.js.
//
// Il giorno: tutti i giri sono per giovedì 5/11/2026 (le liste della città sono una per città e giorno: un giorno solo = una lista
// per città). I 18 di sempre dicono «Domani» da mercoledì 4/11; gli altri partono il 5/11 all'ora indicata.
// `griglia` dice quali caselle della griglia copre il caso (serve al report). `attesa` = la città in cui il giro deve stare.

export const GIORNO_BANCO40 = '2026-11-05';
export const FUSO_BANCO40 = '+01:00'; // CET dal 25/10/2026

/** Il centro e il raggio entro cui una tappa è «di quella città» (km). Controllo statico: nessuna chiamata. */
export const CENTRI = {
    Roma: { lat: 41.8955, lng: 12.4823, km: 15 },
    Milano: { lat: 45.4642, lng: 9.19, km: 12 },
    Napoli: { lat: 40.8518, lng: 14.2681, km: 12 },
    Firenze: { lat: 43.7696, lng: 11.2558, km: 8 },
    Palermo: { lat: 38.1157, lng: 13.3615, km: 12 },
    Catania: { lat: 37.5079, lng: 15.083, km: 10 },
    Siracusa: { lat: 37.0755, lng: 15.2866, km: 8 },
    'Polignano a Mare': { lat: 40.9965, lng: 17.2189, km: 6 },
    Matera: { lat: 40.6663, lng: 16.6043, km: 8 },
    Scicli: { lat: 36.7905, lng: 14.7035, km: 8 },
    Troina: { lat: 37.7836, lng: 14.5967, km: 12 },
    Noto: { lat: 36.8914, lng: 15.0693, km: 10 },
    Cefalù: { lat: 38.0388, lng: 14.0226, km: 12 },
    Gangi: { lat: 37.7908, lng: 14.2025, km: 12 },
};
export const BORGHI = new Set(['Polignano a Mare', 'Scicli', 'Troina', 'Noto', 'Cefalù', 'Gangi']);

const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

const PROFILI = {
    A: { onboarding: { dieta: ['vegetariano'], budget: '€€€', stile: null }, interests: ['Arte', 'Chiese'], dna: { arte: 0.9, cultura: 0.8, _share: 0.45 } },
    B: { onboarding: { dieta: [], budget: '€', stile: null }, interests: ['Street food', 'Panorami'], dna: { food: 0.9, relax: 0.7, _share: 0.45 } },
};

const crea = (id, luogo, ora, richiesta, prefs, extra = {}) => ({ id, modo: 'crea', luogo, ora, richiesta, prefs: { budget: '', group: '', pace: '', ...prefs }, onboarding: null, attesa: luogo, ...extra });
const perte = (id, luogo, ora, extra = {}) => ({ id, modo: 'perte', luogo, ora, onboarding: null, attesa: luogo, ...extra });

// ─── I 18 di sempre (ids e richieste del banco nazionale) ────────────────────────────────────────────────────────────
const NEUTRI = [['Roma', 'Roma'], ['Milano', 'Milano'], ['Napoli', 'Napoli'], ['Firenze', 'Firenze'], ['Palermo', 'Palermo'], ['Catania', 'Catania'],
    ['Siracusa-Ortigia', 'Siracusa'], ['Polignano a Mare', 'Polignano a Mare'], ['Matera', 'Matera'], ['Scicli', 'Scicli'], ['Troina', 'Troina']];
const DI_SEMPRE = [
    ...NEUTRI.map(([nome, citta]) => crea(`a-${slug(nome)}`, citta, '09:30', nome === 'Siracusa-Ortigia' ? 'Domani, una giornata in Ortigia, a Siracusa' : `Domani, una giornata a ${citta}`,
        { duration: '1 Giorno' }, { giorno: '2026-11-04', di: 'sempre', griglia: { scala: BORGHI.has(citta) ? 'borgo' : ['Roma', 'Milano', 'Napoli', 'Palermo', 'Catania'].includes(citta) ? 'grande' : 'citta', ora: 'mattina', richiesta: 'generica' } })),
    ...['Roma', 'Catania'].flatMap(citta => ['A', 'B'].map(p => crea(`b-${slug(citta)}-${p}`, citta, '09:30', `Domani, una giornata a ${citta}`,
        { duration: '1 Giorno', interests: PROFILI[p].interests }, { onboarding: PROFILI[p].onboarding, dna: PROFILI[p].dna, profilo: p, giorno: '2026-11-04', di: 'sempre',
            griglia: { scala: 'grande', ora: 'mattina', richiesta: 'generica', dna: p === 'A' ? 'cultura' : 'cibo' } }))),
    perte('c-roma', 'Roma', '10:30', { giorno: GIORNO_BANCO40, di: 'sempre', griglia: { scala: 'grande', ora: 'mattina', richiesta: 'generica' } }),
    perte('c-catania', 'Catania', '11:30', { giorno: GIORNO_BANCO40, di: 'sempre', griglia: { scala: 'grande', ora: 'mattina', richiesta: 'generica' } }),
    // Troina → «una giornata a Roma»: la posizione è Troina, il giro è a Roma
    crea('d-troina-roma', 'Roma', '09:30', 'una giornata a Roma', { duration: '1 Giorno' }, { posizione: 'Troina', giorno: '2026-11-04', di: 'sempre', griglia: { scala: 'grande', ora: 'mattina', richiesta: 'specifica', lontano: true } }),
];

// ─── I 22 nuovi ───────────────────────────────────────────────────────────────────────────────────────────────────────
const G = (griglia) => ({ giorno: GIORNO_BANCO40, di: 'nuovo', griglia });
const NUOVI = [
    // città grandi, ore diverse, generiche e specifiche
    crea('n-roma-0830', 'Roma', '08:30', 'Una giornata a Roma', { duration: '1 Giorno', pace: 'Attivo' }, G({ scala: 'grande', ora: 'mattina', richiesta: 'generica' })),
    crea('n-roma-1300-specifica', 'Roma', '13:00', 'Un pomeriggio tra Colosseo e Fori Imperiali a Roma', { duration: 'Mezza Giornata', pace: 'Attivo' }, G({ scala: 'grande', ora: '13', richiesta: 'specifica' })),
    crea('n-roma-intenso', 'Roma', '09:30', 'Una giornata a Roma tra Vaticano e centro storico', { duration: '1 Giorno', pace: 'Intenso' }, G({ scala: 'grande', ora: 'mattina', richiesta: 'specifica', mezzo: 'ritmo intenso (qualche mezzo)' })),
    crea('n-catania-2000', 'Catania', '20:00', 'Una serata a Catania', { duration: 'Mezza Giornata', pace: 'Attivo' }, G({ scala: 'grande', ora: 'sera', richiesta: 'generica' })),
    { id: 'n-catania-2315-veloce', modo: 'veloce', luogo: 'Catania', ora: '23:15', scelta: { main: 'relax', sub: 'spa', mainTitle: 'Relax', subTitle: 'Benessere' }, durata: 'Veloce', gruppo: 'Solo', attesa: 'Catania',
        ...G({ scala: 'grande', ora: 'notte', richiesta: 'generica' }) },
    crea('n-catania-rilassato', 'Catania', '10:00', 'Una passeggiata tranquilla a Catania', { duration: '1 Giorno', pace: 'Rilassato' }, G({ scala: 'grande', ora: 'mattina', richiesta: 'specifica', mezzo: 'ritmo rilassato (a piedi)' })),
    crea('n-palermo-1300-mercato', 'Palermo', '13:00', 'Pranzo e giro ai mercati di Ballarò e del Capo a Palermo', { duration: 'Mezza Giornata', interests: ['Cibo'], pace: 'Attivo' }, G({ scala: 'grande', ora: '13', richiesta: 'specifica', dna: 'cibo' })),
    crea('n-palermo-natura', 'Palermo', '09:00', 'Natura e panorami a Palermo', { duration: '1 Giorno', interests: ['Natura'], pace: 'Attivo' },
        { dna: { natura: 0.95, relax: 0.6, _share: 0.45 }, ...G({ scala: 'grande', ora: 'mattina', richiesta: 'specifica', dna: 'natura' }) }),
    crea('n-napoli-dna-cibo', 'Napoli', '09:30', 'Una giornata a Napoli', { duration: '1 Giorno', interests: ['Cibo'], pace: 'Attivo' },
        { dna: { food: 0.95, _share: 0.45 }, ...G({ scala: 'grande', ora: 'mattina', richiesta: 'generica', dna: 'cibo' }) }),
    perte('n-napoli-ospite-1300', 'Napoli', '13:00', G({ scala: 'grande', ora: '13', richiesta: 'generica', ospite: true })),
    crea('n-firenze-dna-cultura', 'Firenze', '09:30', 'Una giornata a Firenze', { duration: '1 Giorno', interests: ['Arte', 'Storia'], pace: 'Rilassato' },
        { dna: { cultura: 0.95, arte: 0.8, _share: 0.45 }, ...G({ scala: 'citta', ora: 'mattina', richiesta: 'generica', dna: 'cultura' }) }),
    { id: 'n-firenze-sorprendimi-2000', modo: 'sorprendimi', luogo: 'Firenze', ora: '20:00', tema: null, attesa: 'Firenze', ...G({ scala: 'citta', ora: 'sera', richiesta: 'generica' }) },
    crea('n-firenze-1300', 'Firenze', '13:00', 'Un giro a Firenze', { duration: 'Mezza Giornata', pace: 'Attivo' }, G({ scala: 'citta', ora: '13', richiesta: 'generica', ospite: true })),
    perte('n-palermo-ospite-1600', 'Palermo', '16:00', G({ scala: 'grande', ora: 'pomeriggio', richiesta: 'generica', ospite: true })),
    // borghi
    crea('n-troina-natura', 'Troina', '09:30', 'Natura e panorami a Troina', { duration: '1 Giorno', interests: ['Natura'], pace: 'Attivo' },
        { dna: { natura: 0.95, _share: 0.45 }, ...G({ scala: 'borgo', ora: 'mattina', richiesta: 'specifica', dna: 'natura' }) }),
    crea('n-troina-2000', 'Troina', '20:00', 'Una serata a Troina', { duration: 'Mezza Giornata', pace: 'Attivo' }, G({ scala: 'borgo', ora: 'sera', richiesta: 'generica' })),
    crea('n-noto-0900', 'Noto', '09:00', 'Una giornata a Noto', { duration: '1 Giorno', pace: 'Attivo' }, G({ scala: 'borgo', ora: 'mattina', richiesta: 'generica' })),
    crea('n-cefalu-1300', 'Cefalù', '13:00', 'Un pomeriggio a Cefalù', { duration: 'Mezza Giornata', pace: 'Rilassato' }, G({ scala: 'borgo', ora: '13', richiesta: 'generica' })),
    crea('n-gangi-1000', 'Gangi', '10:00', 'Una mattina a Gangi', { duration: 'Mezza Giornata', pace: 'Attivo' }, G({ scala: 'borgo', ora: 'mattina', richiesta: 'generica' })),
    crea('n-scicli-cibo', 'Scicli', '09:30', 'Cioccolato e cucina tipica a Scicli', { duration: '1 Giorno', interests: ['Cibo'], pace: 'Attivo' },
        { dna: { food: 0.95, _share: 0.45 }, ...G({ scala: 'borgo', ora: 'mattina', richiesta: 'specifica', dna: 'cibo' }) }),
    // giri lontani: la posizione è in un'altra città, il giro è altrove
    crea('n-lontano-catania-roma', 'Roma', '09:30', 'Una giornata a Roma', { duration: '1 Giorno', pace: 'Attivo' }, { posizione: 'Catania', ...G({ scala: 'grande', ora: 'mattina', richiesta: 'generica', lontano: true }) }),
    crea('n-lontano-palermo-firenze', 'Firenze', '13:00', 'Un pomeriggio a Firenze', { duration: 'Mezza Giornata', pace: 'Attivo' }, { posizione: 'Palermo', ...G({ scala: 'citta', ora: '13', richiesta: 'generica', lontano: true }) }),
];

export const CASI_BANCO40 = [...DI_SEMPRE, ...NUOVI];
if (CASI_BANCO40.length !== 40) throw new Error(`il banco ha ${CASI_BANCO40.length} casi, non 40`);
