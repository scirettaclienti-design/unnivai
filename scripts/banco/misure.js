// BANCO-NAZ — le misure del banco, funzioni pure: dal risultato grezzo di un
// caso (scritto da banco.live.js) ai numeri e ai semafori del report.
// Nessun import dei servizi: si prova da sola e gira anche fuori da Vitest.
// C5 — la forma del percorso viene da src/lib/routeShape.js: puro, senza import.
import { routeMetrics, stopDetours } from '../../src/lib/routeShape.js';

const median = (xs) => {
    if (!xs.length) return null;
    const s = [...xs].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};
const pct = (n, d) => (d > 0 ? Math.round((n / d) * 1000) / 10 : null);

export const haversineKm = (a, b) => {
    if (![a?.lat, a?.lng, b?.lat, b?.lng].every(Number.isFinite)) return null;
    const R = 6371, r = (x) => (x * Math.PI) / 180;
    const dLat = r(b.lat - a.lat), dLng = r(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
};

export const tappeDi = (caso) => (caso.tours || []).flatMap(t => t.stops || []);

/** Costo stimato in dollari: token, chiamate Google contate, foto stimate. */
export function costoUsd(caso, prezzi) {
    const ai = caso.ai || {};
    const tokenUsd = ((ai.tokenIn || 0) * prezzi.openaiInputPerMilione + (ai.tokenOut || 0) * prezzi.openaiOutputPerMilione) / 1e6;
    const googleUsd = Object.entries(caso.google || {})
        .reduce((a, [k, n]) => a + n * (prezzi.google[k] ?? prezzi.google.altro), 0);
    const fotoUsd = tappeDi(caso).length * (prezzi.fotoPerTappa || 0) * (prezzi.google['place/photo'] || 0);
    return { totale: tokenUsd + googleUsd + fotoUsd, token: tokenUsd, google: googleUsd, foto: fotoUsd };
}

/**
 * Le violazioni dei vincoli del profilo, tappa per tappa.
 *   dieta  → una tappa dove si mangia deve venire da una ricerca con il
 *            criterio della dieta (il banco annota `dietaCercata`).
 *   budget → price_level noto sopra il tetto. Sconosciuto: ammesso, come nel motore.
 */
export function violazioniVincoli(caso) {
    const v = caso.vincoli;
    if (!v) return [];
    const out = [];
    for (const s of tappeDi(caso)) {
        if (!s.pasto) continue;
        if (v.dieta?.length && !s.dietaCercata) out.push(`${s.title}: pasto non cercato come ${v.dieta.join('+')}`);
        if (Number.isFinite(v.maxPriceLevel) && Number.isFinite(s.priceLevel) && s.priceLevel > v.maxPriceLevel) {
            out.push(`${s.title}: price_level ${s.priceLevel} oltre il tetto ${v.maxPriceLevel}`);
        }
    }
    return out;
}

const r1 = (x) => Math.round(x * 10) / 10;

/**
 * C5c — la voce 12 su una giornata: incroci, tappe con deviazione oltre
 * S.deviazioneMinuti, deviazione massima (con la tappa e il momento), verdetto.
 * Verde: 0 incroci, al massimo S.deviazioniOltreMax deviazioni oltre soglia,
 * nessuna oltre S.deviazioneMaxMinuti. Nessuna esenzione per i giri corti.
 */
export function misuraGiornata(stops, S) {
    const m = routeMetrics(stops);
    const dev = stopDetours(stops);
    const oltre = dev.filter(d => d.minuti > S.deviazioneMinuti);
    const max = dev.reduce((a, d) => (!a || d.minuti > a.minuti ? d : a), null);
    return {
        km: m.km, incroci: m.incroci, indiceLibero: m.indiceLibero, catene: m.catene,
        deviazioni: dev.map(d => ({ ...d, minuti: r1(d.minuti) })),
        deviazioniOltre: oltre.length,
        deviazioneMax: max ? r1(max.minuti) : null,
        colpevole: max && max.minuti > S.deviazioneMinuti ? { titolo: max.titolo, momento: max.momento, minuti: r1(max.minuti) } : null,
        ok: m.incroci <= S.incrociMax && oltre.length <= S.deviazioniOltreMax && (!max || max.minuti <= S.deviazioneMaxMinuti),
    };
}

/** Le misure di un caso. `null` dove la voce non si applica o manca il dato. */
export function misuraCaso(caso, config) {
    const S = config.soglie;
    if (caso.saltato || caso.errore) return null;
    const tappe = tappeDi(caso);
    const frasi = tappe.flatMap(s => s.frasi || []);
    const tratti = tappe.map(s => s.min).filter(Number.isFinite);
    const rec = tappe.map(s => s.recensioni).filter(Number.isFinite);
    const ids = tappe.map(s => s.place_id).filter(Boolean);
    const duplicati = ids.length - new Set(ids).size;
    // C5b — le famiglie ripetute si contano sul giro finale, giornata per
    // giornata, non dalla dicitura "ripiego" nella traccia: una sostituzione
    // che mette una piazza al posto di un'altra piazza la dicitura la perdeva.
    const famigliaRipetuta = (caso.tours || []).reduce((a, t) => {
        const f = (t.stops || []).map(s => s.famiglia).filter(Boolean);
        return a + f.length - new Set(f).size;
    }, 0);
    const famigliaDaTracce = tappe.filter(s => s.ripiego === 'famiglia').length;
    const famiglie = new Set(tappe.map(s => s.famiglia).filter(Boolean));
    const isPerTe = caso.tipo === 'perte';
    const grande = (config.cittaGrandi || []).includes(caso.luogo);
    let destinazione = null;
    if (caso.attesa) {
        const lontane = tappe.filter(s => {
            const km = haversineKm({ lat: s.lat, lng: s.lng }, caso.attesa.center);
            return km === null || km > S.destinazioneMaxKm;
        });
        destinazione = { citta: caso.destinazione?.city || null, attesa: caso.attesa.city,
            ok: caso.destinazione?.city === caso.attesa.city && lontane.length === 0, tappeLontane: lontane.map(s => s.title) };
    }
    // C5 — la forma del percorso, giornata per giornata (solo itinerari: i
    // giri di Per Te sono tour separati, non una camminata).
    // C5c — voce 12: incroci e deviazioni per tappa (stopDetours), in minuti.
    // `indiceLibero` (C5) resta come informazione, fuori dal verdetto.
    const giornate = caso.tipo === 'itinerario' ? (caso.tours || []).map(t => misuraGiornata(t.stops || [], S)) : [];
    const percorso = giornate.length ? {
        giornate,
        km: Math.round(giornate.reduce((a, g) => a + g.km, 0) * 100) / 100,
        incroci: giornate.reduce((a, g) => a + g.incroci, 0),
        deviazioniOltre: giornate.reduce((a, g) => a + g.deviazioniOltre, 0),
        deviazioneMax: Math.max(...giornate.map(g => g.deviazioneMax ?? 0)),
        indiceLibero: giornate.some(g => g.indiceLibero !== null) ? Math.max(...giornate.map(g => g.indiceLibero ?? 0)) : null,
        catene: giornate.reduce((a, g) => a + g.catene, 0),
        ok: giornate.every(g => g.ok),
    } : null;
    return {
        tappe: tappe.length,
        percorso,
        perGiro: (caso.tours || []).map(t => t.stops.length),
        verita: pct(tappe.filter(s => s.verita).length, tappe.length),
        voce: pct(frasi.filter(f => !(f.problemi || []).length).length, frasi.length),
        frasi: frasi.length,
        maxMinuti: tratti.length ? Math.max(...tratti) : null,
        entro20: pct(tratti.filter(m => m <= S.minutiCammino).length, tratti.length),
        ripieghi: tappe.filter(s => s.scelta === 'ripiego').length,
        motiviRipiego: tappe.filter(s => s.scelta === 'ripiego').map(s => `${s.title}: ${s.motivo || s.ripiego}`),
        ripetizioni: duplicati + famigliaRipetuta,
        ripetizioniDaTracce: duplicati + famigliaDaTracce,
        famiglie: famiglie.size,
        violazioni: violazioniVincoli(caso),
        medianaRecensioni: median(rec),
        sopra2000: rec.filter(n => n > S.recensioniFamoso).length,
        sopra5000: rec.filter(n => n > S.recensioniFamosissimo).length,
        sotto2000: pct(rec.filter(n => n <= S.recensioniFamoso).length, rec.length),
        recensioniNote: rec.length,
        grande,
        secondi: caso.secs ?? null,
        tetto: isPerTe ? S.secondiPerTeMax : S.secondiItinerarioMax,
        chiamateAI: caso.ai?.chiamate ?? null,
        chiamateGoogle: Object.values(caso.google || {}).reduce((a, b) => a + b, 0),
        costo: costoUsd(caso, config.prezziUsd),
        destinazione,
    };
}

/** Tappe in comune fra due giri: quota sul giro piu' corto (la misura piu' severa). */
export function inComune(a, b) {
    const ia = new Set(tappeDi(a).map(s => s.place_id).filter(Boolean));
    const ib = new Set(tappeDi(b).map(s => s.place_id).filter(Boolean));
    const comuni = [...ia].filter(x => ib.has(x));
    const base = Math.min(ia.size, ib.size);
    return { comuni: comuni.length, pct: pct(comuni.length, base), titoli: tappeDi(a).filter(s => comuni.includes(s.place_id)).map(s => s.title) };
}

// Semafori: 'verde' | 'rosso' | null (non si applica / dato mancante).
const sem = (ok) => (ok === null || ok === undefined ? null : (ok ? 'verde' : 'rosso'));
// C5c — la voce 12 e' `percorso` (incroci + deviazioni): sostituisce "incroci"
// e "indice" di C5/C5b.
export const VOCI = ['verita', 'voce', 'distanze', 'ripetizioni', 'vincoli', 'inComune', 'famosita', 'giornata', 'tempo', 'costo', 'destinazione',
    'percorso', 'catene'];

export function semafori(m, caso, config, comune = null) {
    const S = config.soglie;
    if (!m) return null;
    return {
        verita: sem(m.verita === null ? null : m.verita >= S.veritaPct),
        voce: sem(m.voce === null ? null : m.voce >= S.vocePct),
        distanze: sem(m.entro20 === null ? null : m.entro20 >= S.entro20Pct),
        ripetizioni: sem(m.ripetizioni <= S.ripetizioniMax),
        vincoli: caso.vincoli ? sem(m.violazioni.length <= S.violazioniMax) : null,
        inComune: comune ? sem(comune.pct !== null && comune.pct <= S.inComuneABMaxPct) : null,
        famosita: m.grande && m.sotto2000 !== null ? sem(m.sotto2000 >= S.sotto2000MinPct) : null,
        giornata: caso.tipo === 'itinerario' ? sem(m.tappe >= S.tappeGiornataMin) : null,
        tempo: sem(m.secondi === null ? null : m.secondi <= m.tetto),
        costo: sem(m.costo.totale <= S.costoMaxUsd),
        destinazione: m.destinazione ? sem(m.destinazione.ok) : null,
        percorso: m.percorso ? sem(m.percorso.ok) : null,
        catene: m.percorso ? sem(m.percorso.catene <= S.cateneMax) : null,
    };
}
