/**
 * VOCE-1 — TUTTI i testi che la voce dice, in un file solo (prepara il multilingue: oggi c'è solo `it`).
 * Chi parla non scrive frasi altrove: chiede `dire('chiave', parametri)`. I racconti delle tappe e la prima frase dell'arrivo
 * vengono dai dati del giro (descrizioni), non da qui.
 *
 * Le indicazioni di svolta sono poche e ricorrenti («Fra cinquanta metri gira a sinistra.»): si generano una volta per tutti
 * e restano nella cache del server.
 */

export const LINGUA_PREDEFINITA = 'it';

/** Cosa fa il piede alla svolta, dal verso di `navGuida.versoDa`. */
const AZIONE_IT = {
    'a sinistra': 'gira a sinistra',
    'a destra': 'gira a destra',
    'leggermente a sinistra': 'gira leggermente a sinistra',
    'leggermente a destra': 'gira leggermente a destra',
    'stretto a sinistra': 'gira stretto a sinistra',
    'stretto a destra': 'gira stretto a destra',
    'inversione a U': 'fai inversione',
    dritto: 'prosegui dritto',
};

const azioneIt = (verso) => AZIONE_IT[verso] || AZIONE_IT.dritto;

const TESTI = {
    it: {
        prossimaTappa: ({ nome }) => `Si va verso ${nome}.`,
        svolta100: ({ verso }) => `Fra cento metri ${azioneIt(verso)}.`,
        svolta50: ({ verso }) => `Fra cinquanta metri ${azioneIt(verso)}.`,
        svoltaOra: ({ verso }) => `Adesso ${azioneIt(verso)}.`,
        curiosita: [
            'Molti palazzi storici italiani hanno cortili segreti. Prova ad affacciarti dal portone più bello che vedi!',
            'Gli artisti di strada in Italia devono avere un permesso comunale. Ogni esibizione che vedi è certificata.',
            'Le trattorie con i menù scritti a mano sono quasi sempre le migliori. Segui la calligrafia!',
            'Roma ha più di duemila fontanelle pubbliche, tutte potabili. Cerca i nasoni!',
            'I locali del posto sanno che il tramonto migliore non è dal punto panoramico, ma dal bar accanto.',
            'Le botteghe artigiane nei vicoli spesso esistono da generazioni. Chiedi la loro storia, ti sorprenderanno.',
            'In molte piazze italiane, la musica che senti non è casuale. È programmata dal comune per creare atmosfera.',
        ],
    },
};

/** `dire('svolta50', { verso: 'a sinistra' })` → «Fra cinquanta metri gira a sinistra.» */
export function dire(chiave, parametri = {}, lingua = LINGUA_PREDEFINITA) {
    const voce = (TESTI[lingua] || TESTI[LINGUA_PREDEFINITA])[chiave];
    return typeof voce === 'function' ? voce(parametri) : voce;
}

/** Le tre indicazioni che la voce dà avvicinandosi a una svolta, dalla più lontana alla più vicina. */
export const SOGLIE_SVOLTA = [
    { chiave: 'svolta100', finoAM: 110, daM: 80 },
    { chiave: 'svolta50', finoAM: 55, daM: 30 },
    { chiave: 'svoltaOra', finoAM: 20, daM: 0 },
];

/** Quale indicazione dire a `distanzaM` dalla svolta (null se nessuna finestra). Le finestre non si toccano: ogni indicazione scatta una volta sola. */
export function indicazioneSvolta(distanzaM) {
    if (!Number.isFinite(distanzaM)) return null;
    return SOGLIE_SVOLTA.find(s => distanzaM <= s.finoAM && distanzaM >= s.daM)?.chiave ?? null;
}
