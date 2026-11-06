// T29 IMPOSTAZIONI-VERIFICA — le misure di un giro e il confronto di due giri. Funzioni pure: leggono il grezzo del banco.
const R = 6371;
const rad = (g) => (g * Math.PI) / 180;
export const kmFra = (a, b) => {
    const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
};
const minuti = (iso) => new Date(iso).getTime() / 60000;
const giornoDi = (s) => String(s.at || '').slice(0, 10);

/** Le tappe vere di un caso, giorno per giorno. */
export const tappeDelGiro = (caso) => (caso?.tours || []).flatMap(t => t.stops || []).filter(s => !s.tempoLibero);

export function misure(caso) {
    const tappe = tappeDelGiro(caso);
    const tutte = (caso?.tours || []).flatMap(t => t.stops || []);
    const giorni = new Map();
    for (const s of tappe) { const k = giornoDi(s); if (!giorni.has(k)) giorni.set(k, []); giorni.get(k).push(s); }
    let km = 0, tratto = 0, minutiGiro = 0;
    for (const [, g] of giorni) {
        for (let i = 1; i < g.length; i++) {
            if (!Number.isFinite(g[i].lat) || !Number.isFinite(g[i - 1].lat)) continue;
            const d = kmFra(g[i - 1], g[i]);
            km += d; tratto = Math.max(tratto, d);
        }
        const a = g[0], z = g[g.length - 1];
        if (a?.at && z?.at) minutiGiro += minuti(z.at) + (Number(z.stay) || 0) - minuti(a.at);
    }
    const pasti = tappe.filter(s => s.pasto);
    const prezzi = tappe.filter(s => Number.isFinite(s.priceLevel));
    const prezziPasti = pasti.filter(s => Number.isFinite(s.priceLevel));
    const media = (a) => (a.length ? a.reduce((x, s) => x + s.priceLevel, 0) / a.length : null);
    return {
        tappe: tappe.length, giorni: giorni.size, km: Math.round(km * 100) / 100, trattoMax: Math.round(tratto * 100) / 100, minuti: Math.round(minutiGiro),
        pasti: pasti.length, minutiPasti: pasti.reduce((x, s) => x + (Number(s.stay) || 0), 0),
        prezzoPasti: media(prezziPasti), prezzoTutti: media(prezzi), senzaPrezzoPasti: pasti.length - prezziPasti.length,
        sosta: Math.round(tappe.reduce((x, s) => x + (Number(s.stay) || 0), 0)),
        tempoLibero: tutte.filter(s => s.tempoLibero).reduce((x, s) => x + (Number(s.stay) || 0), 0),
    };
}

const firma = (s) => s.place_id || s.title;

/** Che cosa cambia fra due giri: tappe tolte e aggiunte, ordine, misure. */
export function confronto(a, b) {
    const ta = tappeDelGiro(a), tb = tappeDelGiro(b);
    const ia = new Set(ta.map(firma)), ib = new Set(tb.map(firma));
    const tolte = ta.filter(s => !ib.has(firma(s))).map(s => s.title);
    const aggiunte = tb.filter(s => !ia.has(firma(s))).map(s => s.title);
    const orario = (t) => t.map(s => `${firma(s)}@${String(s.at).slice(0, 16)}+${s.stay}`).join('|');
    const ma = misure(a), mb = misure(b);
    const unione = new Set([...ia, ...ib]).size;
    return {
        identico: orario(ta) === orario(tb), stesseTappe: tolte.length === 0 && aggiunte.length === 0,
        tolte, aggiunte, diverse: unione ? Math.round(((tolte.length + aggiunte.length) / unione) * 100) : 0,
        delta: { tappe: mb.tappe - ma.tappe, km: Math.round((mb.km - ma.km) * 100) / 100, minuti: mb.minuti - ma.minuti, pasti: mb.pasti - ma.pasti, minutiPasti: mb.minutiPasti - ma.minutiPasti,
            prezzoPasti: ma.prezzoPasti != null && mb.prezzoPasti != null ? Math.round((mb.prezzoPasti - ma.prezzoPasti) * 100) / 100 : null },
        a: ma, b: mb,
    };
}
