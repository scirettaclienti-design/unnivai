// T29 IMPOSTAZIONI-VERIFICA — le varianti: una impostazione alla volta, stesso luogo, stessa ora. Dati puri.

const BASI = { Roma: 'a-roma', Catania: 'a-catania' };

/** Su misura: le preferenze come le manda AiItinerary (ogni voce del wizard, vuota se non scelta). */
const suMisura = (citta, id, prefs, richiesta = null) => ({ id: `sm-${citta.toLowerCase()}-${id}`, flusso: 'Su misura', citta, base: BASI[citta], gruppo: id.split('-')[0], prefs, ...(richiesta ? { richiesta } : {}) });

const IMPOSTAZIONI_SU_MISURA = [
    ['neutro', {}],
    ['controllo', {}],
    ['budget-economico', { budget: 'Economico' }], ['budget-medio', { budget: 'Medio' }], ['budget-lusso', { budget: 'Lusso' }],
    ['durata-mezza', { duration: 'Mezza Giornata' }], ['durata-3giorni', { duration: '2-3 Giorni' }],
    ['gruppo-solo', { group: 'Solo' }], ['gruppo-coppia', { group: 'Coppia' }], ['gruppo-famiglia', { group: 'Famiglia' }], ['gruppo-amici', { group: 'Amici' }],
    ['ritmo-rilassato', { pace: 'Rilassato' }], ['ritmo-attivo', { pace: 'Attivo' }], ['ritmo-intenso', { pace: 'Intenso' }],
    ['interessi-arte', { interests: ['Arte'] }], ['interessi-cibo', { interests: ['Cibo'] }], ['interessi-storia', { interests: ['Storia'] }],
    ['interessi-natura', { interests: ['Natura'] }], ['interessi-shopping', { interests: ['Shopping'] }], ['interessi-notte', { interests: ['Vita Notturna'] }],
];

// Una richiesta scritta articolata (solo testo, nessuna voce del modulo) e i chip senza frase: il giro vero, i tracciati non li coprono.
const ARTICOLATA = {
    Roma: 'Domani a Roma con mia moglie: la mattina arte barocca, pranzo in una trattoria economica, niente musei il pomeriggio, una passeggiata con vista e la sera un aperitivo',
    Catania: 'Domani a Catania con due amici: il mercato del pesce la mattina, street food a pranzo, poi le chiese barocche di Via Crociferi, e la sera un locale con musica',
};
const SENZA_FRASE = [['senzafrase-arte', { interests: ['Arte'] }], ['senzafrase-natura', { interests: ['Natura'] }]];
const VARIANTI_SU_MISURA = ['Roma', 'Catania'].flatMap(c => IMPOSTAZIONI_SU_MISURA.map(([id, prefs]) => suMisura(c, id, prefs)));

// ─── Al volo (QuickPath): umore, sotto-scelta, durata, gruppo. Il tour parte da adesso: le 11:00 stanno oltre la colazione automatica e prendono il pranzo ───
const GIORNO = '2026-11-05';
const AL_VOLO = {
    Roma: { base: { main: 'citta', sub: 'piazze', mainTitle: 'Città', subTitle: 'Piazze Eterne' },
        umori: { natura: { main: 'natura', sub: 'villa', mainTitle: 'Natura', subTitle: 'Ville Nobiliari' }, storia: { main: 'storia', sub: 'imperiale', mainTitle: 'Storia', subTitle: 'Roma Imperiale' },
            cibo: { main: 'cibo', sub: 'street', mainTitle: 'Gusto', subTitle: 'Street Food' }, sotto: { main: 'citta', sub: 'rione', mainTitle: 'Città', subTitle: 'Rioni Storici' } } },
    Catania: { base: { main: 'citta', sub: 'centro', mainTitle: 'Città', subTitle: 'Centro Storico' },
        umori: { natura: { main: 'natura', sub: 'parco', mainTitle: 'Natura', subTitle: 'Parchi e Verde' }, storia: { main: 'storia', sub: 'musei', mainTitle: 'Storia', subTitle: 'Cultura e Musei' },
            relax: { main: 'relax', sub: 'spa', mainTitle: 'Relax', subTitle: 'Benessere' } } },
};
const alVolo = (citta, id, { scelta = AL_VOLO[citta].base, durata = 'Medio', gruppo = 'Solo' } = {}) => ({
    id: `av-${citta.toLowerCase()}-${id}`, modo: 'veloce', luogo: citta, ora: '11:00', giorno: GIORNO, attesa: citta, scelta, durata, gruppo, onboarding: null,
});
export const CASI_AL_VOLO = ['Roma', 'Catania'].flatMap(c => [
    alVolo(c, 'neutro'), alVolo(c, 'controllo'),
    alVolo(c, 'durata-veloce', { durata: 'Veloce' }), alVolo(c, 'durata-lungo', { durata: 'Lungo' }),
    alVolo(c, 'gruppo-coppia', { gruppo: 'In coppia' }), alVolo(c, 'gruppo-amici', { gruppo: 'Con gli amici' }), alVolo(c, 'gruppo-famiglia', { gruppo: 'In famiglia' }),
    ...Object.entries(AL_VOLO[c].umori).map(([k, scelta]) => alVolo(c, `umore-${k}`, { scelta })),
]);

// In replay durata e gruppo si rigiocano dal tracciato del neutro (stessa traduzione); ogni umore ha il suo.
const varianteAlVolo = (c) => {
    const citta = c.luogo.toLowerCase();
    const proprio = /umore/.test(c.id);
    return { id: c.id, flusso: 'Al volo', citta: c.luogo, base: proprio ? c.id : `av-${citta}-neutro`, gruppo: c.id.split('-')[2], alVolo: { durata: c.durata, gruppo: c.gruppo } };
};
export const VARIANTI = [...VARIANTI_SU_MISURA, ...CASI_AL_VOLO.map(varianteAlVolo)];

/** Il caso del banco di una variante: quello base con le impostazioni cambiate ; `comeLaPagina`: giro-caso calcola il dnaGiro come la pagina, per un utente nuovo. */
export function casoDellaVariante(v, base) {
    if (v.alVolo) return { ...base, id: v.id, ...v.alVolo, comeLaPagina: true };
    const prefs = { ...base.prefs, ...v.prefs };
    const richiesta = v.richiesta ?? base.richiesta;
    return { ...base, id: v.id, prefs, richiesta, comeLaPagina: true };
}

const suMisuraVero = (v) => ({ id: v.id, modo: 'crea', luogo: v.citta, ora: '09:30', giorno: '2026-11-04', attesa: v.citta, onboarding: null, comeLaPagina: true,
    richiesta: v.richiesta ?? `Domani, una giornata a ${v.citta}`, prefs: { budget: '', group: '', pace: '', duration: '1 Giorno', ...v.prefs } });
export const CASI_SU_MISURA = [
    ...VARIANTI_SU_MISURA.filter(v => !/ritmo-attivo/.test(v.id)).map(suMisuraVero),
    ...['Roma', 'Catania'].map(c => suMisuraVero({ id: `sm-${c.toLowerCase()}-articolata`, citta: c, prefs: {}, richiesta: ARTICOLATA[c] })),
    ...SENZA_FRASE.map(([id, prefs]) => ({ ...suMisuraVero({ id: `sm-roma-${id}`, citta: 'Roma', prefs, richiesta: ' ' }), giorno: GIORNO })),
];
export const CASI_IMPOSTAZIONI = [...CASI_AL_VOLO, ...CASI_SU_MISURA];
