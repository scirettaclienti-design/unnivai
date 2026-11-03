// BANCO-40 — i cinque controlli automatici di ogni caso del banco, sul grezzo di un giro (vero o replay).
// Funzioni pure, nessuna rete. Le soglie vengono da banco.config.json (soglie.minutiCammino, esteso.camminoKmh).
//
//   aperte     ogni tappa è aperta all'ora in cui ci arrivi, per tutta la sosta (c5 del banco esteso, orari di Google)
//   distanze   fra due tappe la distanza sta nel tetto del mezzo (a piedi 20 minuti = 1,5 km; ritmo Intenso 5 km) e il tempo
//              fra un arrivo e l'altro basta per farla
//   citta      nessuna tappa fuori dalla città del giro (centro e raggio in casi-banco40.js) e la destinazione è quella chiesta
//   titolo     il titolo nomina luoghi che sono nel giro (almeno 70% delle parole di luogo) e nessun'altra città
//   frasi      nessuna frase uguale due volte nello stesso giro (stessa regola di c7, ma da 2, non da 3)
//
// Un caso con errore, saltato o senza tappe vere non passa nessun controllo: è un giro che non esce.
import { c5 } from './controlli.js';
import { haversineKm } from './misure.js';
import { CENTRI } from './casi-banco40.js';

export const CONTROLLI40 = [
    ['aperte', 'Tappe aperte all\'ora del giro'],
    ['distanze', 'Distanze plausibili per il mezzo'],
    ['citta', 'Nessun luogo di un\'altra città'],
    ['titolo', 'Titolo coerente con le tappe'],
    ['frasi', 'Nessuna frase ripetuta'],
];

const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const vere = (t) => (t?.stops || []).filter(s => s && !s.tempoLibero && s.place_id);
const nome = (s) => s.title || s.name || '?';
const giro = (caso) => (caso.tours || []).filter(t => vere(t).length);
const ok = (extra = {}) => ({ ok: true, violazioni: [], ...extra });
const ko = (violazioni, extra = {}) => ({ ok: false, violazioni, ...extra });
const esito = (violazioni, extra = {}) => (violazioni.length ? ko(violazioni, extra) : ok(extra));

// ─── 1 — aperte ──────────────────────────────────────────────────────────────────────────────────────────────────────
export function aperte(caso, cfg) {
    const r = c5(caso, cfg);
    return esito(r.violazioni.map(v => `${v.tappa}: ${v.testo.replace(/^.*?: /, '')}`),
        { sconosciute: r.sconosciuti ?? 0, nota: r.sconosciuti ? `${r.sconosciuti} tappe senza orari di Google (non misurabili)` : null });
}

// ─── 2 — distanze ────────────────────────────────────────────────────────────────────────────────────────────────────
const LIMITE_MEZZO_KM = 5; // ritmo Intenso: «con qualche mezzo» (bus, metro)
export function distanze(caso, meta, cfg) {
    const intenso = /intenso/i.test(meta?.prefs?.pace || '');
    const kmh = cfg.esteso.camminoKmh;
    const limite = intenso ? LIMITE_MEZZO_KM : (cfg.soglie.minutiCammino * kmh) / 60;
    const mezzo = intenso ? 'con qualche mezzo' : 'a piedi';
    const v = [];
    let tratti = 0, maxKm = 0;
    for (const t of giro(caso)) {
        const s = vere(t);
        for (let i = 1; i < s.length; i++) {
            const a = s[i - 1], b = s[i];
            if (![a.lat, a.lng, b.lat, b.lng].every(Number.isFinite)) continue;
            const km = haversineKm({ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng });
            tratti++; maxKm = Math.max(maxKm, km);
            if (km > limite * 1.05) v.push(`${nome(a)} → ${nome(b)}: ${km.toFixed(2)} km, oltre il tetto ${mezzo} (${limite.toFixed(1)} km)`);
            // il tempo fra i due arrivi deve bastare per fare la strada (a piedi 4,5 km/h; con un mezzo 18 km/h), con 3 minuti di margine
            if (a.at && b.at) {
                const libero = (Date.parse(b.at) - Date.parse(a.at)) / 60000 - (a.stay || 0);
                const serve = (km / (intenso ? 18 : kmh)) * 60;
                if (libero + 3 < serve) v.push(`${nome(a)} → ${nome(b)}: ${Math.round(libero)} min fra la fine della sosta e l'arrivo, ne servono ${Math.round(serve)} ${mezzo}`);
            }
        }
    }
    return esito(v, { tratti, maxKm: Math.round(maxKm * 100) / 100, limiteKm: Math.round(limite * 100) / 100, mezzo });
}

// ─── 3 — città ───────────────────────────────────────────────────────────────────────────────────────────────────────
export function citta(caso, meta) {
    const centro = CENTRI[meta?.attesa || caso.luogo];
    if (!centro) return ko([`città «${meta?.attesa || caso.luogo}» senza centro in casi-banco40.js`]);
    const v = [];
    let max = 0;
    for (const t of giro(caso)) for (const s of vere(t)) {
        if (![s.lat, s.lng].every(Number.isFinite)) { v.push(`${nome(s)}: senza coordinate`); continue; }
        const km = haversineKm({ lat: centro.lat, lng: centro.lng }, { lat: s.lat, lng: s.lng });
        max = Math.max(max, km);
        if (km > centro.km) v.push(`${nome(s)}: a ${km.toFixed(1)} km dal centro di ${meta?.attesa || caso.luogo} (raggio ${centro.km} km)`);
    }
    const dest = caso.destinazione?.city;
    if (dest && norm(dest) !== norm(meta?.attesa || caso.luogo) && caso.modo === 'crea') v.push(`destinazione del giro «${dest}», chiesta «${meta?.attesa || caso.luogo}»`);
    return esito(v, { maxKm: Math.round(max * 10) / 10, raggioKm: centro.km });
}

// ─── 4 — titolo ──────────────────────────────────────────────────────────────────────────────────────────────────────
// Un titolo è coerente se (1) non nomina un'altra città, (2) ogni parola di tema che usa (piazze, colli, fontane, musei…) ha almeno una tappa
// del suo tipo, (3) se nomina luoghi per nome («Dal Colosseo al Pantheon»), quelli stanno nel giro, e (4) nomina la città o almeno un luogo.
const PAROLE_VUOTE = new Set(['dal', 'dalla', 'dallo', 'dall', 'dai', 'dalle', 'dagli', 'al', 'alla', 'allo', 'all', 'ai', 'alle', 'agli', 'del', 'della', 'dello', 'dei', 'delle', 'degli', 'di', 'da', 'il', 'la', 'lo', 'le', 'gli', 'un', 'una', 'tuo', 'giro', 'tour', 'giornata', 'tra', 'fra', 'con', 'per', 'in', 'e', 'a', 'sera', 'notte', 'mattina', 'pomeriggio', 'serata', 'passeggiata', 'intorno', 'dintorni', 'attorno', 'lungo', 'verso', 'sotto', 'sopra', 'nel', 'nella', 'nei', 'nelle', 'cuore', 'centro', 'storico', 'storica', 'antico', 'antica']);
// parola di tema nel titolo → come si riconosce una tappa di quel tipo (nome o tipi di Google)
const TEMI = [
    [/^(piazz[ae])$/, /piazz|plaza|largo|campo /],
    [/^(coll[ei]|monte|monti|alture)$/, /colle|colli|monte|gianicolo|aventino|palatino|campidoglio|pincio|quirinale|esquilino|viminale|celio|capitolino|belvedere|altura/],
    [/^(fontan[ae])$/, /fontana|fontane|trevi|fountain/],
    [/^(terrazz[ae]|belvedere|panoram\w*|balcon\w*)$/, /terrazz|belvedere|panoram|balcon|viewpoint|vista|monte|gianicolo|pincio|lungomare/],
    [/^(chies[ae]|basilich[ae]|duomo|cattedral\w*)$/, /chiesa|chiese|basilica|duomo|cattedrale|santa|santo|san |sant'|church|abbazia|oratorio/],
    [/^(muse[io]|gallerie|galleria|pinacoteca)$/, /muse|galleri|pinacoteca|palazzo|art_gallery/],
    [/^(giardin\w*|parch[io]|ville|villa|orti|orto|verde|natura)$/, /giardin|parco|parchi|villa|orto|botanic|park|bosco|riserva|natur|monte|lungomare/],
    [/^(mercat\w*)$/, /mercato|mercati|market|ballaro|capo|vucciria|pescheria|fera/],
    [/^(vicol\w*|vie|via|strade|strada)$/, /via |vico|vicolo|corso|strada|rione|quartiere|largo/],
    [/^(ponti|ponte)$/, /ponte/],
    [/^(castell\w*|fortezz\w*|rocc\w*|torr\w*)$/, /castell|fortezz|rocca|torre|forte|castle|mura/],
];
export function titolo(caso, meta) {
    const v = [];
    const attesa = meta?.attesa || caso.luogo;
    const altre = Object.keys(CENTRI).filter(c => norm(c) !== norm(attesa));
    let n = 0;
    for (const t of giro(caso)) {
        const tit = t.titolo || t.tema;
        n++;
        if (!tit || !String(tit).trim()) { v.push('tour senza titolo'); continue; }
        const nt = norm(tit);
        const stops = vere(t);
        const nomiTappe = stops.map(s => norm(nome(s))).join(' | ');
        const testoTappe = stops.map(s => `${norm(nome(s))} ${(s.types || []).join(' ')} ${s.primaryType || ''}`).join(' | ');
        for (const c of altre) if (new RegExp(`(^| )${norm(c)}( |$)`).test(nt) && !nomiTappe.includes(norm(c))) v.push(`il titolo «${tit}» nomina ${c}, il giro è a ${attesa}`);
        const parole = nt.split(' ').filter(p => p.length >= 3 && !PAROLE_VUOTE.has(p) && p !== norm(attesa));
        const delGiro = new Set(nomiTappe.replace(/\|/g, ' ').split(' '));
        const tema = [], proprie = [];
        for (const p of parole) {
            const riga = TEMI.find(([re]) => re.test(p));
            if (riga) tema.push([p, riga[1]]); else proprie.push(p);
        }
        for (const [p, re] of tema) if (!re.test(testoTappe)) v.push(`il titolo «${tit}» parla di «${p}», nessuna tappa lo è`);
        const nomina = nt.split(' ').includes(norm(attesa).split(' ')[0]);
        if (proprie.length) {
            const mancano = proprie.filter(p => !delGiro.has(p));
            // con la città nel titolo («Colli e fontane di Roma») le parole libere sono colore; senza, i luoghi nominati devono esserci
            if (!nomina && mancano.length / proprie.length > 0.3) v.push(`il titolo «${tit}» nomina luoghi che non sono nel giro (${mancano.join(', ')})`);
        } else if (!tema.length && !nomina) v.push(`il titolo «${tit}» non nomina né luoghi del giro né ${attesa}`);
    }
    if (!n) v.push('nessun tour con titolo');
    return esito(v);
}

// ─── 5 — frasi ───────────────────────────────────────────────────────────────────────────────────────────────────────
const frasiDi = (testo) => String(testo || '').split(/(?<=[.!?])\s+/).map(f => f.trim()).filter(Boolean);
export function frasi(caso) {
    const v = [];
    for (const t of giro(caso)) {
        const viste = new Map();
        for (const s of vere(t)) {
            for (const f of frasiDi(s.description)) {
                const m = norm(f).split(norm(nome(s))).join('<nome>').replace(/\d+/g, '<n>');
                if (m.length < 12) continue;
                const l = viste.get(m) || [];
                l.push({ s, f });
                viste.set(m, l);
            }
        }
        for (const l of viste.values()) if (l.length >= 2) v.push(`«${l[0].f}» — ${l.length} volte (${l.map(x => nome(x.s)).join(', ')})`);
    }
    return esito(v);
}

// ─── Il caso intero ──────────────────────────────────────────────────────────────────────────────────────────────────
/** @returns {{ id, stato: 'ok'|'ko'|'errore'|'saltato', motivo?, controlli?, tappe, nota? }} */
export function controllaCaso(caso, meta, cfg) {
    const tappe = (caso.tours || []).reduce((n, t) => n + vere(t).length, 0);
    if (caso.saltato) return { id: caso.id, stato: 'saltato', motivo: caso.saltato, tappe: 0 };
    if (caso.errore) return { id: caso.id, stato: 'errore', motivo: String(caso.errore), tappe };
    if (caso.replay?.uscite?.length) return { id: caso.id, stato: 'errore', motivo: `replay: ${caso.replay.uscite.length} uscite in rete`, tappe };
    if (!tappe) {
        // un ripiego dichiarato («tutto chiuso a quest'ora») non è un giro con tappe sbagliate: si dichiara, non si misura
        if (caso.ripiegoDichiarato) return { id: caso.id, stato: 'ok', tappe: 0, nota: `ripiego dichiarato dal motore: «${caso.chiusoOra || caso.source}»`, controlli: {} };
        return { id: caso.id, stato: 'errore', motivo: `nessuna tappa vera (source ${caso.source ?? '?'})`, tappe: 0 };
    }
    const controlli = { aperte: aperte(caso, cfg), distanze: distanze(caso, meta, cfg), citta: citta(caso, meta), titolo: titolo(caso, meta), frasi: frasi(caso) };
    return { id: caso.id, stato: Object.values(controlli).every(c => c.ok) ? 'ok' : 'ko', controlli, tappe };
}
