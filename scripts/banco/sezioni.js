// Sezioni comuni ai report che confrontano due giri dello stesso banco (ORARI, C6a): le 12 voci dell'asticella e il costo.
import { semafori, VOCI } from './misure.js';
import { VARIANZA_CASI } from './confronto-places.js';

export const n1 = (x) => (x === null || x === undefined || Number.isNaN(x) ? '—' : String(Math.round(x * 10) / 10).replace('.', ','));
export const usd = (x) => (x === null || x === undefined ? '—' : `$${x.toFixed(3).replace('.', ',')}`);
export const NOMI_VOCE = { verita: 'Verità', voce: 'Voce', distanze: 'Distanze', ripetizioni: 'Ripetizioni', vincoli: 'Vincoli', inComune: 'In comune A/B',
    famosita: 'Famosità', giornata: 'Giornata', tempo: 'Tempo', costo: 'Costo', destinazione: 'Destinazione', percorso: 'Percorso (C5c)', catene: 'Catene' };

/** Le 12 voci: casi rossi prima contro dopo. Scrive su L e ritorna il numero di voci peggiorate oltre la varianza. */
export function sezioneVoci(B, N, ids, config, L, { titolo = 'Le 12 voci dell\'asticella: casi rossi, prima contro dopo' } = {}) {
    L.push(`## ${titolo}`);
    L.push('');
    L.push(`Un campione per caso: la varianza dichiarata è ±${VARIANZA_CASI} casi per voce (scelta mia, non misurata). Una voce "peggiora oltre la varianza" se ha più di ${VARIANZA_CASI} casi rossi in più.`);
    L.push('');
    L.push('| Voce | Rossi prima | Rossi dopo | Δ | Esito |');
    L.push('|---|---|---|---|---|');
    const tieni = ids.filter(id => B.get(id)?.m && N.get(id)?.m);
    const rosse = (X, v) => tieni.filter(id => semafori(X.get(id).m, X.get(id).c, config, null)?.[v] === 'rosso');
    let peggiorate = 0;
    for (const v of VOCI) {
        const a = rosse(B, v), b = rosse(N, v), d = b.length - a.length;
        if (d > VARIANZA_CASI) peggiorate++;
        L.push(`| ${NOMI_VOCE[v]} | ${a.length} | ${b.length} | ${d > 0 ? '+' : ''}${d} | ${d > VARIANZA_CASI ? '🔴 PEGGIORATA' : d > 0 ? '🟡 entro la varianza' : '🟢 invariata o migliore'}${d !== 0 ? ` (nuovi rossi: ${b.filter(x => !a.includes(x)).join(', ') || '—'}; tornati verdi: ${a.filter(x => !b.includes(x)).join(', ') || '—'})` : ''} |`);
    }
    L.push('');
    L.push('Percorso (misura C5c) per caso, dove cambia: ' + (ids.filter(id => B.get(id)?.m?.percorso && N.get(id)?.m?.percorso && B.get(id).m.percorso.ok !== N.get(id).m.percorso.ok)
        .map(id => `${id} ${B.get(id).m.percorso.ok ? '🟢' : '🔴'}→${N.get(id).m.percorso.ok ? '🟢' : '🔴'}`).join(', ') || 'nessun cambio di verdetto') + '.');
    L.push('');
    return peggiorate;
}

/** Costo, ricerche, chiamate AI e tempo per generazione, prima contro dopo. */
export function sezioneCosto(B, N, ids, nuovo, config, L, { etichettaPrima = 'Prima', etichettaDopo = 'Dopo', tetto = config.esteso.tettoOrariUsd } = {}) {
    const tieni = ids.filter(id => B.get(id)?.m && N.get(id)?.m);
    const costo = (X) => tieni.map(id => X.get(id).m.costo.token + X.get(id).m.costo.google);
    const media = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
    const ricerche = (X) => media(tieni.map(id => (X.get(id).c.google?.['place/textsearch#new'] || 0) + (X.get(id).c.google?.['place/textsearch'] || 0)));
    L.push('## Costo per generazione misurato');
    L.push('');
    L.push(`| | ${etichettaPrima} | ${etichettaDopo} | Δ |`);
    L.push('|---|---|---|---|');
    const cb = media(costo(B)), cn = media(costo(N));
    L.push(`| Costo medio per generazione (token + Google contati, senza foto) | ${usd(cb)} | ${usd(cn)} | ${cb && cn ? `${cn - cb >= 0 ? '+' : ''}${usd(cn - cb)} (${n1(((cn - cb) / cb) * 100)}%)` : '—'} |`);
    L.push(`| Ricerche di testo per generazione | ${n1(ricerche(B))} | ${n1(ricerche(N))} | |`);
    L.push(`| Chiamate AI per generazione | ${n1(media(tieni.map(id => B.get(id).c.ai?.chiamate || 0)))} | ${n1(media(tieni.map(id => N.get(id).c.ai?.chiamate || 0)))} | |`);
    L.push(`| Tempo medio per generazione (s) | ${n1(media(tieni.map(id => B.get(id).m.secondi)))} | ${n1(media(tieni.map(id => N.get(id).m.secondi)))} | |`);
    L.push('');
    L.push(`Spesa del giro: **${usd(nuovo.costo?.totale)}** (tetto ${usd(tetto)}).`);
    L.push('');
}
