// BORGO-SCHERMO — il riquadro «Il tuo DNA Esplorativo» del riepilogo del Quiz (QuickPathSummary) mostra la scelta («Natura /
// Parchi e Verde») SOLO se almeno una tappa del giro e' di quella famiglia (decisione di Ivano, task BORGO-COMPLETO, fase 3):
// a Troina alle 23 il riquadro diceva «Natura» sopra un bar e una via. Funzione pura sulle tappe (types, nome): la stessa la usa
// il banco per scrivere nel grezzo se il riquadro e' mostrato (giro-caso.js, controllo 1 della pertinenza).
import { isNaturaOPanorama, isLuogoStorico } from './borgoConfini';
import { placeKind } from './placeKind';

const tipiDi = (s) => [...(Array.isArray(s?.types) ? s.types : []), s?.primaryType ?? s?.primary_type].filter(Boolean);
const nomeDi = (s) => String(s?.title || s?.name || '');
const KIND_CIBO = new Set(['pasto', 'spuntino', 'forno', 'dolce', 'caffe', 'bar']);
const TIPI_MARE = new Set(['beach', 'natural_feature', 'marina']);
const TIPI_RELAX = new Set(['spa', 'park', 'garden', 'beach', 'wellness_center', 'sauna']);
const TIPI_SHOPPING = new Set(['store', 'clothing_store', 'shoe_store', 'jewelry_store', 'shopping_mall', 'department_store', 'market']);

/** La tappa e' della famiglia della scelta principale del Quiz (`main`: natura, parchi, montagna, mare, vulcano, storia, cibo, moda, canali, relax, citta). */
export function tappaDellaScelta(stop, main) {
    const m = String(main || '').toLowerCase();
    const tipi = tipiDi(stop);
    const nome = nomeDi(stop);
    const kind = placeKind(stop).kind;
    switch (m) {
        case 'natura': case 'parchi': case 'montagna': case 'vulcano':
            return isNaturaOPanorama(stop);
        case 'mare':
            return isNaturaOPanorama(stop) || tipi.some(t => TIPI_MARE.has(t)) || /\b(spiaggi\w*|lungomare|lido|cala|scoglier\w*|porto|molo)\b/i.test(nome);
        case 'storia':
            return isLuogoStorico(stop);
        case 'cibo':
            return KIND_CIBO.has(kind);
        case 'moda':
            return kind === 'negozio' || tipi.some(t => TIPI_SHOPPING.has(t));
        case 'canali':
            return /\b(canal\w*|navigl\w*|darsena|ponte|alzaia)\b/i.test(nome);
        case 'relax':
            return isNaturaOPanorama(stop) || tipi.some(t => TIPI_RELAX.has(t)) || /\b(spa|terme|hammam|benessere)\b/i.test(nome);
        default:
            // «Città» e le scelte senza una famiglia riconoscibile: il giro e' la scelta
            return true;
    }
}

/** La scelta del Quiz si mostra nel riquadro? Almeno una tappa vera (non tempo libero) della sua famiglia. Senza tappe: no. */
export function sceltaConfermata({ main, steps } = {}) {
    const vere = (Array.isArray(steps) ? steps : []).filter(s => s && !s.tempoLibero);
    if (!vere.length) return false;
    return vere.some(s => tappaDellaScelta(s, main));
}
