// BANCO-DIFETTI-2 (T23) — IL SESTO CONTROLLO DEL BANCO: «la richiesta precisa è nel giro, o il giro dice perché no».
// Controllo NUOVO ordinato da Ivano (i cinque di controlli40.js non cambiano). Funzione pura, nessuna rete: legge il grezzo del caso
// (la frase, le tappe con nome, tipi e momento, le note del giorno) e rifà da sé la lettura della richiesta, con un vocabolario suo,
// indipendente dal motore.
//
// Che cosa conta come richiesta precisa:
//   · Crea (la frase dell'utente): i luoghi per nome (parole con la maiuscola, tolta la città), i tipi di posto (cioccolato, mercati,
//     spa, musei, chiese, panorami, cucina), il tema per tutto il giro (natura), il pasto (pranzo, cena), l'ora («alle 15»), le
//     esclusioni («niente chiese»);
//   · Veloce (la frase del wizard, prima di «Escludi»): solo i tipi precisi (spa, mercati, cioccolato); la categoria scelta la
//     misura già la pertinenza;
//   · Sorprendimi e Per Te: niente (non c'è una richiesta precisa).
// Passa se ogni cosa chiesta è nel giro (un luogo: una tappa col suo nome, mai la fermata dei mezzi che lo porta; un tipo: almeno una
// tappa di quel tipo; il tema: ogni visita di mattina e pomeriggio; il pasto: la tappa o la riga del pasto mancante; l'ora: la prima
// tappa entro 30 minuti) oppure se una nota del giorno la nomina con il motivo (chiuso, km, non entra, non trovato). Un'esclusione
// non ha scuse: una tappa del tipo escluso è una violazione.

const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, ' ').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const vere = (t) => (t?.stops || []).filter(s => s && !s.tempoLibero && s.place_id);
const nome = (s) => s.title || s.name || '?';
const tipi = (s) => [...(s.types || []), s.primaryType].filter(Boolean).map(t => String(t).toLowerCase());
const haTipo = (s, lista) => tipi(s).some(t => lista.includes(t));

const TRANSITO = ['subway_station', 'transit_station', 'train_station', 'bus_station', 'light_rail_station', 'tram_stop', 'bus_stop'];
export const eFermata = (s) => {
    if (TRANSITO.includes(String(s.primaryType || '').toLowerCase())) return true;
    const t = tipi(s).filter(x => !['point_of_interest', 'establishment', 'transportation_service'].includes(x));
    return t.length > 0 && t.every(x => TRANSITO.includes(x));
};
const NATURA_TIPI = ['park', 'city_park', 'national_park', 'state_park', 'nature_preserve', 'botanical_garden', 'garden', 'natural_feature', 'hiking_area', 'beach',
    'scenic_spot', 'observation_deck', 'viewpoint', 'mountain_peak', 'lake', 'campground'];
const NATURA_NOME = /^(monte|lago|riserva|bosco|sentiero|parco|giardin\w*|villa|orto botanico|belvedere|pineta|oasi|spiaggia|lungomare|terrazza)\b/;
const eNatura = (s) => haTipo(s, NATURA_TIPI) || ['verde', 'panorama'].includes(s.famiglia) || NATURA_NOME.test(norm(nome(s)));

// il vocabolario del controllo: parola nella frase → come si riconosce una tappa di quel tipo
const TIPI = [
    { id: 'natura', re: /\b(natura|naturalistic\w*|parchi|parco|giardini|verde)\b/, etichetta: 'natura', tema: true, tappa: eNatura },
    { id: 'panorami', re: /\b(panoram\w*|belvedere)\b/, etichetta: 'panorami',
        tappa: (s) => haTipo(s, ['scenic_spot', 'observation_deck', 'viewpoint']) || s.famiglia === 'panorama' || /\b(belvedere|panoram\w*|terrazza)\b/.test(norm(nome(s))) },
    { id: 'cioccolato', re: /\bcioccolat\w*/, etichetta: 'cioccolato', veloce: true, tappa: (s) => haTipo(s, ['chocolate_shop', 'chocolate_factory']) || /\bcioccolat/.test(norm(nome(s))) },
    { id: 'mercati', re: /\bmercat[oi]\b/, etichetta: 'mercat', veloce: true, tappa: (s) => haTipo(s, ['market', 'farmers_market']) || /\bmercat[oi]\b/.test(norm(nome(s))) },
    { id: 'spa', re: /\b(spa|terme|termal\w*|hammam|benessere)\b/, etichetta: 'spa', veloce: true, tappa: (s) => haTipo(s, ['spa', 'wellness_center', 'sauna', 'public_bath', 'massage_spa', 'day_spa']) },
    { id: 'musei', re: /\bmuse[oi]\b/, etichetta: 'muse', tappa: (s) => haTipo(s, ['museum', 'art_museum', 'history_museum', 'art_gallery']) },
    { id: 'chiese', re: /\b(chies[ae]|basilic[ah]e?|cattedral[ei])\b/, etichetta: 'chies', tappa: (s) => haTipo(s, ['church', 'place_of_worship']) },
    { id: 'cucina', re: /\b(cucina|ristorant[ei]|trattori[ae]|osteri[ae]|pizzeri[ae]|street ?food)\b/, etichetta: 'cucina', tappa: (s) => !!s.pasto },
];
// esclusioni: solo per tipo di Google (il nome «Piazza del Duomo» non è una chiesa)
const ESCLUSIONI = [
    { re: /\b(chies[ae]|basilic\w*|cattedral\w*)\b/, tipi: ['church', 'place_of_worship'] },
    { re: /\bmuse[oi]\b/, tipi: ['museum', 'art_museum'] },
    { re: /\b(ristorant\w*|trattori\w*)\b/, tipi: ['restaurant'] },
    { re: /\b(bar|pub|cocktail)\b/, tipi: ['bar', 'cocktail_bar', 'pub', 'wine_bar'] },
];
const NON_NOMI = new Set(['domani', 'oggi', 'stasera', 'dopodomani', 'lunedi', 'martedi', 'mercoledi', 'giovedi', 'venerdi', 'sabato', 'domenica', 'italia',
    'un', 'una', 'uno', 'il', 'lo', 'la', 'le', 'i', 'gli', 'pranzo', 'cena', 'natura', 'cioccolato', 'cucina', 'giornata', 'giro', 'pomeriggio', 'mattina', 'serata', 'passeggiata']);
const CONN = /^(de'|de’|di|del|dei|della|delle|dello|degli|d'|d’)$/i;
const radice = (w) => { const n = norm(w); return n.length > 4 ? n.replace(/[aeiou]$/, '') : n; };

/** I nomi propri della frase di Crea (tolta la città): «tra Colosseo e Fori Imperiali» → Colosseo, Fori Imperiali. */
export function nomiChiesti(testo, citta) {
    const parole = String(testo || '').replace(/[.,;:!?()«»"]/g, ' $& ').split(/\s+/).filter(Boolean);
    const out = [];
    let cur = [];
    const chiudi = () => {
        while (cur.length && CONN.test(cur[cur.length - 1])) cur.pop();
        const k = norm(cur.join(' '));
        const cittaParole = new Set(norm(citta).split(' '));
        if (k && k !== norm(citta) && !k.split(' ').every(w => cittaParole.has(w)) && !NON_NOMI.has(k) && !out.some(x => norm(x) === k)) out.push(cur.join(' '));
        cur = [];
    };
    parole.forEach((w, i) => {
        if (/^[A-ZÀ-Ý]/.test(w) && !NON_NOMI.has(norm(w))) cur.push(w);
        else if (cur.length && CONN.test(w) && /^[A-ZÀ-Ý]/.test(parole[i + 1] || '')) cur.push(w);
        else if (cur.length) chiudi();
    });
    if (cur.length) chiudi();
    return out;
}
const portaIlNome = (s, n) => {
    const chieste = norm(n).split(' ').filter(w => w.length >= 3 && !CONN.test(w)).map(radice);
    const del = new Set(norm(nome(s)).split(' ').map(radice));
    return chieste.length > 0 && chieste.every(w => del.has(w));
};
const MOTIVO = /(chius|\bkm\b|non entra|non l ho trovato|non ho trovato|non sono di|non e di|il giro parte alle)/;

/** Le cose precise chieste in un caso del banco. */
export function richiesteDelCaso(caso, meta) {
    const voci = [];
    const modo = caso.modo || meta?.modo;
    const testo = caso.richiesta || meta?.richiesta || '';
    if (modo === 'crea') {
        const t = norm(testo);
        const positivo = t.replace(/\b(niente|senza|tranne|eccetto|escludi|evita\w*|no)\s+[a-z ]{0,40}/g, ' ');
        for (const n of nomiChiesti(testo, meta?.attesa || caso.luogo)) voci.push({ tipo: 'luogo', cosa: n });
        for (const v of TIPI) if (v.re.test(positivo)) voci.push({ tipo: v.tema ? 'tema' : 'tipo', cosa: v.id, v });
        if (/\bpranz[oi]\b/.test(positivo)) voci.push({ tipo: 'pasto', cosa: 'pranzo' });
        if (/\bcen[ae]\b/.test(positivo)) voci.push({ tipo: 'pasto', cosa: 'cena' });
        const ora = t.match(/\b(?:alle|dalle|verso le|per le)\s+(\d{1,2})(?:\s+(\d{2}))?\b/);
        if (ora && Number(ora[1]) <= 23) voci.push({ tipo: 'ora', cosa: `${ora[1]}:${ora[2] || '00'}`, minuti: Number(ora[1]) * 60 + Number(ora[2] || 0) });
        for (const m of t.matchAll(/\b(?:niente|senza|tranne|eccetto|escludi|evita\w*|no)\s+([a-z ]{0,40})/g)) {
            for (const e of ESCLUSIONI) if (e.re.test(m[1])) voci.push({ tipo: 'esclusione', cosa: m[1].trim(), tipi: e.tipi });
        }
    } else if (modo === 'veloce') {
        const cerco = norm(String(testo).split(/escludi/i)[0]);
        for (const v of TIPI) if (v.veloce && v.re.test(cerco)) voci.push({ tipo: 'tipo', cosa: v.id, v });
    }
    return voci;
}

const minutiLocali = (iso, fuso = 60) => { const d = new Date(Date.parse(iso) + fuso * 60000); return d.getUTCHours() * 60 + d.getUTCMinutes(); };

/** 6 — richiesta: ogni cosa precisa chiesta è nel giro, o una nota del giorno la nomina col motivo. */
export function richiesta(caso, meta) {
    const voci = richiesteDelCaso(caso, meta);
    const stops = (caso.tours || []).flatMap(vere);
    const righe = (caso.tours || []).flatMap(t => t.stops || []);
    const note = (caso.schermo?.note || []).flatMap(n => String(n).split(/(?<=[.!?])\s+/)).map(norm);
    const dichiarata = (parola) => note.some(n => n.includes(norm(parola)) && MOTIVO.test(n));
    const v = [];
    let nelGiro = 0, dichiarate = 0;
    const conta = (ok, dich, testo) => { if (ok) nelGiro++; else if (dich) dichiarate++; else v.push(testo); };
    for (const x of voci) {
        if (x.tipo === 'luogo') {
            const q = caso.citta?.quartiere;
            const comeQuartiere = q?.nome && /^nominato/.test(q.motivo || '') && portaIlNome({ title: q.nome }, x.cosa);
            const ok = comeQuartiere || stops.some(s => !eFermata(s) && portaIlNome(s, x.cosa));
            const fermata = stops.find(s => eFermata(s) && portaIlNome(s, x.cosa));
            conta(ok, dichiarata(x.cosa), `«${x.cosa}» chiesto per nome: nessuna tappa lo è${fermata ? ` (c'è solo la fermata «${nome(fermata)}»)` : ''} e nessuna nota dice perché`);
        } else if (x.tipo === 'tipo') {
            conta(stops.some(x.v.tappa), dichiarata(x.v.etichetta), `«${x.cosa}» chiesto: nessuna tappa di quel tipo e nessuna nota dice perché`);
        } else if (x.tipo === 'tema') {
            const visite = stops.filter(s => ['mattina', 'pomeriggio'].includes(s.moment) && !s.pasto && !s.colazione);
            const fuori = visite.filter(s => !x.v.tappa(s));
            conta(visite.length > 0 && fuori.length === 0, fuori.length > 0 && note.some(n => n.includes(`non sono di ${x.v.etichetta}`) || n.includes(`non e di ${x.v.etichetta}`)),
                `tema «${x.cosa}» per tutto il giro: ${fuori.length} visite non lo sono (${fuori.map(nome).join(', ')}) e nessuna nota lo dice`);
        } else if (x.tipo === 'pasto') {
            const ok = stops.some(s => s.moment === x.cosa && s.pasto) || righe.some(s => s.tempoLibero && s.moment === x.cosa && /nessun locale aperto/i.test(s.description || ''));
            conta(ok, false, `«${x.cosa}» chiesto: il giro non ha né il pasto né la riga del pasto mancante`);
        } else if (x.tipo === 'ora') {
            const prima = stops[0]?.at ? minutiLocali(stops[0].at) : null;
            conta(prima != null && prima >= x.minuti && prima <= x.minuti + 30, note.some(n => n.includes('il giro parte alle')), `ora chiesta ${x.cosa}: la prima tappa è alle ${prima != null ? `${Math.floor(prima / 60)}:${String(prima % 60).padStart(2, '0')}` : '?'} e nessuna nota lo dice`);
        } else if (x.tipo === 'esclusione') {
            const dentro = stops.filter(s => haTipo(s, x.tipi));
            conta(dentro.length === 0, false, `«${x.cosa}» escluso: nel giro ${dentro.map(nome).join(', ')}`);
        }
    }
    return { ok: v.length === 0, violazioni: v, voci: voci.length, nelGiro, dichiarate };
}
