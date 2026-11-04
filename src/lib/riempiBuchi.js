/**
 * BANCO-DIFETTI-2 (T23, D7) — NIENTE BUCHI MUTI DI OLTRE 2 ORE.
 *
 * Dopo il tetto di 1,2 km (T19) alcuni giri avevano un «Tempo libero» di 2–4 ore fra due tappe (Troina 15:33–20:00, Roma Intenso
 * 13:45–18:00). Qui, sul giro gia' in orario e dopo la richiesta e le soste del DNA:
 *  1. ogni attesa di oltre 2 ore (`SOGLIA_BUCO_MINUTI`) fra due tappe — e la coda dopo l'ultima visita di un giro che finisce di
 *     pomeriggio — si riempie con visite vicine: entro il tetto di 1,2 km dalla tappa prima e dalla tappa dopo (il tetto non si tocca),
 *     aperte per tutta la sosta, coerenti col giro (la categoria chiesta, il tema, le esclusioni; il DNA sceglie fra quelle che
 *     restano), senza superare il tetto delle visite del giorno;
 *  2. quello che resta oltre 2 ore si dichiara: la riga «Tempo libero» dice il motivo (testiGiro.buco), mai un buco muto.
 * Nessuna ricerca nuova: i posti sono quelli che il motore ha gia' trovato e verificato. Funzioni PURE.
 */
import { provaInserire, inserisci, usatiNelGiro, giaUsato, kmFra, fineDi, idDi } from './inserisciTappa';
import { travelMinutes } from './tourTiming';
import { eVisita } from './richiestaNelGiro';
import { TESTI_GIRO } from './testiGiro';

export const SOGLIA_BUCO_MINUTI = 120;
const ms = (d) => (d instanceof Date ? d.getTime() : NaN);
const VISITA = new Set(['mattina', 'pomeriggio']);

/** L'attesa (minuti) prima della voce `i` del giorno: inizio − (fine della voce prima + cammino). */
export const attesaPrima = (day, i) => Math.ceil((ms(day[i].start) - fineDi(day[i - 1]) - (travelMinutes(day[i - 1].candidate, day[i].candidate) ?? 0) * 60000) / 60000);

/** Le visite del giorno (contano nel tetto delle visite: C8e). */
export const visiteDel = (day) => day.filter(eVisita).length;

/**
 * @param {object} p
 * @param {{ days: object[][] }} p.sched
 * @param {Array} p.candidati                     i posti verificati del motore
 * @param {(c:object) => boolean} p.ammette       coerente col giro (categoria, tema, esclusioni, una visita e non un locale)
 * @param {(c:object) => number} [p.punteggio]    a parita' di regole, il piu' alto (DNA, merito)
 * @param {(c, arrivo:Date, sosta:number) => boolean} p.aperto
 * @param {number|null} p.capKm
 * @param {(di:number) => object[]} p.momentiDi
 * @param {(di:number) => Date|null} p.fineDi
 * @param {number} p.tettoVisite
 * @returns {{ sched: object, report: { aggiunte: Array, rimasti: Array } }}
 */
export function riempiBuchi({ sched, candidati = [], ammette, punteggio = () => 0, aperto, capKm = null, momentiDi = () => [], fineDi: fineFinestraDi = () => null, tettoVisite = 8, soglia = SOGLIA_BUCO_MINUTI, soloDichiara = null }) {
    // `soloDichiara` ('ritmo' | 'famiglia'): il ritmo Tranquillo e la famiglia tengono le pause lunghe (C8d, DNA-5): nessuna tappa nuova, il
    // buco si dichiara col suo motivo
    const report = { aggiunte: [], rimasti: [] };
    const usati = usatiNelGiro(sched);
    const ordinati = candidati.filter(c => idDi(c) && ammette(c)).sort((x, y) => punteggio(y) - punteggio(x));
    const days = (sched?.days || []).map((day0, di) => {
        let day = [...day0];
        const chiusi = new Set(); // le attese gia' provate senza esito (chiave: la tappa dopo, o «coda»)
        const fineFinestra = fineFinestraDi(di);
        for (let passo = 0; passo < 12; passo++) {
            // le attese oltre la soglia, dalla piu' lunga; la coda solo se il giro finisce con una visita (un giro che finisce a cena no)
            const buchi = [];
            for (let i = 1; i < day.length; i++) {
                const m = attesaPrima(day, i);
                if (m > soglia && !chiusi.has(idDi(day[i].candidate))) buchi.push({ i, minuti: m, chiave: idDi(day[i].candidate) });
            }
            const ultima = day[day.length - 1];
            if (ultima && VISITA.has(ultima.moment?.key) && fineFinestra instanceof Date && !chiusi.has('coda')) {
                const m = Math.floor((fineFinestra.getTime() - fineDi(ultima)) / 60000);
                if (m > soglia) buchi.push({ i: day.length, minuti: m, chiave: 'coda' });
            }
            if (!buchi.length) break;
            const b = buchi.sort((x, y) => y.minuti - x.minuti)[0];
            const dopo = day[b.i - 1]?.candidate;
            const rimasto = { dayIndex: di, prima: b.chiave === 'coda' ? null : b.chiave, dopo: idDi(dopo), minuti: b.minuti, coda: b.chiave === 'coda' };
            if (soloDichiara) { chiusi.add(b.chiave); report.rimasti.push({ ...rimasto, motivo: soloDichiara }); continue; }
            if (visiteDel(day) >= tettoVisite) { chiusi.add(b.chiave); report.rimasti.push({ ...rimasto, motivo: 'tetto visite', visite: visiteDel(day) }); continue; }
            let messa = null;
            // a parita' di regole il piu' alto per DNA e merito, meno 1 punto per km dalla tappa prima (si cammina il meno possibile)
            const vicinanza = (c) => punteggio(c) - (kmFra(dopo, c) ?? 9);
            for (const c of ordinati.slice().sort((x, y) => vicinanza(y) - vicinanza(x))) {
                if (giaUsato(usati, c)) continue;
                const e = provaInserire(day, b.i, c, { capKm, aperto, momenti: momentiDi(di), fineFinestra });
                if (e.ok) { messa = { c, e }; break; }
            }
            if (!messa) { chiusi.add(b.chiave); report.rimasti.push({ ...rimasto, motivo: 'nessun posto' }); continue; }
            day = inserisci(day, b.i, messa.c, messa.e, { source: 'riempimento', trace: { riempimento: { buco: b.minuti, dopo: dopo?.name || dopo?.title || null, km: Math.round((kmFra(dopo, messa.c) ?? 0) * 100) / 100 } } });
            usati.add(idDi(messa.c));
            report.aggiunte.push({ giorno: di + 1, place_id: idDi(messa.c), nome: messa.c.name || messa.c.title, momento: messa.e.moment?.key, buco: b.minuti, minuti: messa.e.sosta });
        }
        // un'attesa che un riempimento ha poi accorciato sotto la soglia non e' piu' un buco rimasto
        return day;
    });
    report.rimasti = report.rimasti.filter(r => {
        const day = days[r.dayIndex];
        if (r.coda) {
            const fine = fineFinestraDi(r.dayIndex), u = day[day.length - 1];
            return fine instanceof Date && u && Math.floor((fine.getTime() - fineDi(u)) / 60000) > soglia;
        }
        const i = day.findIndex(e => idDi(e.candidate) === r.prima);
        return i > 0 && attesaPrima(day, i) > soglia;
    });
    return { sched: { ...sched, days }, report };
}

/**
 * Il testo di una riga di «Tempo libero» di oltre 2 ore (gia' in fascia): il motivo del buco rimasto, o la coda del giro. null = la
 * riga non e' oltre la soglia (resta il testo di sempre).
 * @param {{ stayMinutes:number }} riga
 * @param {{ coda: boolean, prima: string|null, rimasti: Array, capKm: number|null }} ctx
 */
export function testoBucoLungo(riga, { coda = false, prima = null, rimasti = [], capKm = null } = {}) {
    if (!(Number(riga?.stayMinutes) > SOGLIA_BUCO_MINUTI)) return null;
    const cap = Number.isFinite(capKm) ? capKm : 5;
    // la coda: con il motivo solo se il riempimento l'ha provata (un giro che finisce con una visita); dopo la cena il giro finisce e basta
    const r = coda ? rimasti.find(x => x.coda) : rimasti.find(x => x.prima === prima);
    if (r?.motivo === 'ritmo' || r?.motivo === 'famiglia') return TESTI_GIRO.buco[r.motivo]();
    if (coda) return r ? TESTI_GIRO.buco.coda({ capKm: cap }) : TESTI_GIRO.buco.fine();
    if (r?.motivo === 'tetto visite') return TESTI_GIRO.buco.tettoVisite({ visite: r.visite });
    return TESTI_GIRO.buco.nessunPosto({ capKm: cap });
}

/**
 * D7 — I PASTI TOLTI DAL TETTO. L'ultima rete del tetto (T19, tettoNelPiano) toglie un pranzo o una cena il cui locale e' oltre 1,2 km dalla
 * tappa prima, e la giornata restava senza pasto (Napoli: 199 minuti «Nessun locale aperto qui vicino a quest'ora.»). Qui il pasto torna con
 * un altro locale gia' verificato, entro 1,2 km dalla tappa prima e dalla dopo, aperto per tutta la sosta, nel suo momento. Senza, resta la riga.
 * @param {{ sched, tolte: Array<{ momento, dayIndex, nome }>, candidati: Array, aperto, capKm, momentiDi, fineDi }} p
 * @returns {{ sched: object, report: Array<{ momento, tolto, nome: string|null }> }}
 */
export function ripristinaPasti({ sched, tolte = [], candidati = [], aperto, capKm = null, momentiDi = () => [], fineDi: fineFinestraDi = () => null }) {
    const days = (sched?.days || []).map(d => [...d]);
    const usati = usatiNelGiro(sched);
    const report = [];
    for (const t of tolte) {
        const di = t.dayIndex ?? 0;
        const m = momentiDi(di).find(x => x.id === t.momento);
        const day = days[di];
        if (!m || !day || day.some(e => e.moment?.id === m.id)) continue;
        // la posizione: prima della prima tappa che comincia dopo l'inizio del pasto (in coda se non ce n'e')
        let i = day.findIndex(e => ms(e.start) >= ms(m.start));
        if (i < 0) i = day.length;
        let messa = null;
        const ordinati = candidati.filter(c => idDi(c) && !giaUsato(usati, c))
            .sort((x, y) => (kmFra(day[i - 1]?.candidate, x) ?? 9) - (kmFra(day[i - 1]?.candidate, y) ?? 9) || (Number(y.rating) || 0) - (Number(x.rating) || 0));
        for (const c of ordinati) {
            const e = provaInserire(day, i, c, { capKm, aperto, momenti: momentiDi(di), fineFinestra: fineFinestraDi(di), momento: m });
            if (e.ok) { messa = { c, e }; break; }
        }
        if (messa) {
            days[di] = inserisci(day, i, messa.c, messa.e, { source: 'riempimento', trace: { riempimento: { pasto: m.key, alPostoDi: t.nome ?? null } } });
            usati.add(idDi(messa.c));
        }
        report.push({ momento: t.momento, tolto: t.nome ?? null, nome: messa ? (messa.c.name || messa.c.title) : null });
    }
    return { sched: { ...sched, days }, report };
}
