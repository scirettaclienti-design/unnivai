// C6a — diagnosi a 0 $ sul grezzo del banco esteso: per ogni posto dei pool, la famiglia / categoria /
// sosta che dava il motore di PRIMA (tutti i types in unione, regola congelata qui sotto) contro quella
// che da' il tipo principale (src/lib/placeKind.js, via momentSelection e tourTiming di adesso).
//   npx vite-node scripts/banco/diagnosi-famiglie.mjs docs/prove/dati/2026-10-13-banco-esteso-orari.json \
//        docs/prove/dati/2026-10-13-c6a-tipi-mancanti.json [--md]
// Nessuna chiamata: usa solo il grezzo e i types gia' salvati.
import { readFileSync } from 'node:fs';
import { candidateFamily, candidateMomentCategories } from '../../src/services/momentSelection.js';
import { stayOf } from '../../src/lib/tourTiming.js';
import { placeKind } from '../../src/lib/placeKind.js';

// ─── La regola di PRIMA, congelata (momentSelection / tourTiming a bb15eac) ──────────────────
const OLD_TYPE_CATEGORIES = {
    museum: ['musei', 'cultura'], art_gallery: ['musei', 'cultura'], church: ['cultura', 'monumenti'], place_of_worship: ['cultura', 'monumenti'],
    synagogue: ['cultura', 'monumenti'], mosque: ['cultura', 'monumenti'], hindu_temple: ['cultura', 'monumenti'],
    tourist_attraction: ['monumenti', 'cultura'], historical_landmark: ['monumenti', 'cultura'], monument: ['monumenti', 'cultura'],
    castle: ['monumenti', 'cultura'], city_hall: ['monumenti'], library: ['cultura'], performing_arts_theater: ['cultura'],
    restaurant: ['cibo'], meal_takeaway: ['cibo'], meal_delivery: ['cibo'], bakery: ['cibo'], bar: ['bar', 'vita notturna'],
    night_club: ['vita notturna'], cafe: ['bar'], park: ['natura'], natural_feature: ['natura'], campground: ['natura'], zoo: ['natura'],
    aquarium: ['natura'], store: ['shopping'], clothing_store: ['shopping'], shoe_store: ['shopping'], jewelry_store: ['shopping'],
    book_store: ['shopping'], shopping_mall: ['shopping'], department_store: ['shopping'], route: ['passeggiata'], neighborhood: ['passeggiata'],
};
const PANORAMA_NAME = /\b(belvedere|terrazz[ae]|panoram\w*|affaccio)\b/i;
const WALK_NAME = /^(piazza|piazzale|via|vicolo|largo|lungotevere|lungomare|lungarno|ponte|scalinata|passeggiata)\b/i;
const CHURCH_TYPES = ['church', 'place_of_worship', 'synagogue', 'mosque', 'hindu_temple'];
function oldCategories(c) {
    const types = c.types || [];
    const out = new Set();
    for (const t of types) for (const k of OLD_TYPE_CATEGORIES[t] || []) out.add(k);
    if (types.includes('restaurant')) { out.delete('bar'); out.delete('vita notturna'); }
    if (PANORAMA_NAME.test(c.name)) out.add('punti panoramici');
    if (WALK_NAME.test(c.name)) out.add('passeggiata');
    return out;
}
const OLD_FAMILY_RULES = [
    ['panorama', (types, name) => PANORAMA_NAME.test(name)],
    ['piazza', (types, name) => /^(piazza|piazzale|largo)\b/i.test(name)],
    ['chiesa', (types, name) => types.some(t => CHURCH_TYPES.includes(t)) || /^(chiesa|basilica|duomo|cattedrale|santuario|abbazia)\b/i.test(name)],
    ['museo', (types, name) => types.includes('museum') || types.includes('art_gallery') || /^(museo|pinacoteca)\b/i.test(name)],
    ['verde', (types, name) => types.includes('park') || types.includes('natural_feature') || /^(parco|giardin[oi]|orto botanico|villa comunale)\b/i.test(name)],
];
const oldFamily = (c) => (oldCategories(c).has('cibo') ? null : OLD_FAMILY_RULES.find(([, t]) => t(c.types || [], c.name))?.[0] || null);
const OLD_STAY = [
    [60, ['museum', 'art_gallery']], [75, ['restaurant']], [20, [...CHURCH_TYPES]], [20, ['cafe', 'bar', 'bakery']],
    [30, ['park', 'natural_feature', 'zoo', 'aquarium', 'botanical_garden']], [30, ['tourist_attraction', 'point_of_interest']],
];
const oldStay = (types) => { const s = new Set(types || []); for (const [m, l] of OLD_STAY) if (l.some(t => s.has(t))) return m; return 30; };

// L'etichetta di "che posto era" per la tabella: famiglia se c'e', altrimenti la categoria dominante.
const labelOf = (fam, cats) => fam || (cats.has('cibo') ? 'ristorante/cibo' : cats.has('bar') ? 'bar' : cats.has('shopping') ? 'negozio' : cats.has('vita notturna') ? 'locale notturno'
    : cats.has('musei') ? 'museo' : cats.has('natura') ? 'verde' : cats.has('monumenti') || cats.has('cultura') ? 'monumento/cultura' : 'altro');

// ─── Dati ────────────────────────────────────────────────────────────────────────────────
const [, , rawPath, extraPath] = process.argv;
const raw = JSON.parse(readFileSync(rawPath, 'utf8'));
const extra = extraPath ? JSON.parse(readFileSync(extraPath, 'utf8')).luoghi : {};
const places = new Map();
const upsert = (id, p) => { const o = places.get(id) || { id }; for (const [k, v] of Object.entries(p)) if (v != null && (o[k] == null || (Array.isArray(v) && v.length > (o[k] || []).length))) o[k] = v; places.set(id, o); };
const recorded = new Map(); // id → famiglia registrata dal motore di prima (tracciato)
for (const c of raw.casi) {
    for (const v of Object.values(c.pool || {})) {
        if (Array.isArray(v)) for (const x of v) upsert(x.place_id, { name: x.nome, types: x.types });
        else for (const x of v.candidati || []) { upsert(x.place_id, { name: x.nome }); if (!recorded.has(x.place_id)) recorded.set(x.place_id, x.famiglia ?? null); }
    }
    for (const t of c.tours || []) for (const s of t.stops || []) if (s.place_id) upsert(s.place_id, { name: s.title, types: s.types });
}
for (const [id, p] of places) {
    p.primaryType = raw.luoghiOrari?.[id]?.primaryType || extra[id]?.primaryType || null;
    if (!p.types?.length && extra[id]?.types) p.types = extra[id].types;
}
const all = [...places.values()].filter(p => p.name);
const senzaTypes = all.filter(p => !p.types?.length);

// ─── Prova che la regola congelata e' quella di prima: stesse famiglie registrate ────────
let ok = 0, ko = 0; const kos = [];
for (const [id, fam] of recorded) {
    const p = places.get(id);
    if (!p?.types?.length) continue;
    const f = oldFamily(p);
    if (f === fam) ok++; else { ko++; kos.push(`${p.name}: registrata ${fam}, congelata ${f}`); }
}

// ─── Confronto ───────────────────────────────────────────────────────────────────────────
const rows = all.filter(p => p.types?.length).map(p => {
    const oc = oldCategories(p), nc = candidateMomentCategories(p);
    const of = oldFamily(p), nf = candidateFamily(p);
    const k = placeKind(p);
    return {
        id: p.id, name: p.name, primaryType: p.primaryType, kind: k.kind, fonte: k.fonte,
        old: { fam: of, cats: [...oc].sort(), label: labelOf(of, oc), stay: oldStay(p.types) },
        new: { fam: nf, cats: [...nc].sort(), label: labelOf(nf, nc), stay: stayOf(p) },
    };
});
const diff = rows.filter(r => r.old.label !== r.new.label || r.old.fam !== r.new.fam || r.old.cats.join() !== r.new.cats.join());
const stayDiff = rows.filter(r => r.old.stay !== r.new.stay);
const famDiff = rows.filter(r => r.old.fam !== r.new.fam);
const labelDiff = rows.filter(r => r.old.label !== r.new.label);

const byPair = new Map();
for (const r of labelDiff) { const k = `${r.old.label} → ${r.new.label}`; (byPair.get(k) || byPair.set(k, []).get(k)).push(r); }
const stayByPt = new Map();
for (const r of rows) {
    const k = r.primaryType || '(manca)';
    const e = stayByPt.get(k) || { n: 0, vecchi: new Map(), nuovo: r.new.stay };
    e.n++; e.vecchi.set(r.old.stay, (e.vecchi.get(r.old.stay) || 0) + 1); stayByPt.set(k, e);
}

const out = {
    posti: all.length, conTypes: rows.length, senzaTypes: senzaTypes.length, conTipoPrincipale: rows.filter(r => r.primaryType).length,
    provaRegolaCongelata: { uguali: ok, diverse: ko, diverseElenco: kos.slice(0, 10) },
    cambiaCategorieOFamiglia: diff.length, cambiaFamiglia: famDiff.length, cambiaEtichetta: labelDiff.length, cambiaSosta: stayDiff.length,
    coppie: [...byPair.entries()].sort((a, b) => b[1].length - a[1].length).map(([k, v]) => ({ coppia: k, n: v.length, esempi: v.slice(0, 4).map(r => `${r.name} [${r.primaryType}]`) })),
    soste: stayDiff.reduce((m, r) => { const k = `${r.old.stay}→${r.new.stay}`; m[k] = (m[k] || 0) + 1; return m; }, {}),
    perTipo: [...stayByPt.entries()].sort((a, b) => b[1].n - a[1].n).map(([pt, e]) => ({ pt, n: e.n, nuovo: e.nuovo, prima: Object.fromEntries(e.vecchi) })),
    righe: diff,
};
if (process.argv.includes('--md')) {
    const L = [];
    L.push(`Posti distinti: ${out.posti}; con types: ${out.conTypes}; con tipo principale: ${out.conTipoPrincipale}; senza types (esclusi): ${out.senzaTypes}.`);
    L.push(`Prova della regola congelata: ${ok} famiglie uguali a quelle registrate dal motore, ${ko} diverse.`);
    L.push(`Cambiano: famiglia ${out.cambiaFamiglia}, etichetta ${out.cambiaEtichetta}, categorie o famiglia ${out.cambiaCategorieOFamiglia}, sosta ${out.cambiaSosta}.\n`);
    L.push('| Da (oggi) → a (tipo principale) | Posti | Esempi |\n|---|---|---|');
    for (const c of out.coppie) L.push(`| ${c.coppia} | ${c.n} | ${c.esempi.join('; ')} |`);
    console.log(L.join('\n'));
} else console.log(JSON.stringify(out, null, 1));
