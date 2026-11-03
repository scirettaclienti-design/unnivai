// BANCO-40 — la parte del banco che entra nella GUARDIA (`npm run banco:guardia`): alcuni dei 40 casi, rigiocati a 0 $ dai tracciati
// (docs/prove/dati/banco-40-tracciati.json.gz), con gli stessi cinque controlli del banco. Passa solo se ogni caso della lista passa tutti e cinque.
//
// Quali casi: quelli che hanno passato tutti e cinque i controlli nel giro vero del 4/11/2026, uno o due per casella della griglia, scelti perché
// il replay costa pochi secondi. Un caso che il giro vero ha trovato con un difetto dell'app NON entra: sta nell'elenco per Ivano
// (docs/prove/2026-11-04-banco-40.md), e quando il difetto è corretto si aggiunge qui.
import { CASI_BANCO40 } from './casi-banco40.js';
import { esitoDi } from './esiti40.js';

export const CASI_GUARDIA_BANCO40 = [
    'a-roma', 'a-napoli', // città grandi, giornata intera, richiesta generica
    'b-roma-A', 'b-roma-B', // DNA forte su cultura e su cibo (profili A e B)
    'd-troina-roma', // giro lontano: la posizione è Troina, il giro è a Roma
    'a-matera', // città media
    'n-troina-natura', 'n-scicli-cibo', // borghi con DNA forte su natura e su cibo
    'n-cefalu-1300', // borgo, partenza alle 13
    'n-troina-2000', // borgo, sera
];

/** @param {{ casi: object[] }} replay il grezzo del replay @param {object} cfg banco.config.json */
export function controllaGuardiaBanco40(replay, cfg) {
    const perId = new Map((replay?.casi || []).map(c => [c.id, c]));
    const righe = CASI_GUARDIA_BANCO40.map((id) => {
        const m = CASI_BANCO40.find(c => c.id === id);
        const c = perId.get(id);
        if (!c) return { id, ok: false, motivo: 'caso assente nel replay', tappe: 0 };
        const e = esitoDi(c, m, cfg);
        const falliti = Object.entries(e.controlli || {}).filter(([, v]) => !v.ok).map(([k, v]) => `${k}: ${v.violazioni[0]}`);
        return { id, ok: e.stato === 'ok', tappe: e.tappe, motivo: e.stato === 'ok' ? null : (e.motivo || falliti.join(' · ')) };
    });
    return { ok: righe.length > 0 && righe.every(r => r.ok), righe };
}

export const tabellaGuardiaBanco40 = ({ ok, righe }) => [
    `GUARDIA DEL BANCO 40: ${ok ? 'PASSATA' : 'FALLITA'} (${righe.filter(r => r.ok).length}/${righe.length} casi con tutti e cinque i controlli)`,
    ...righe.map(r => `  ${r.ok ? '✅' : '❌'} ${r.id}: ${r.ok ? `${r.tappe} tappe` : r.motivo}`),
].join('\n');
