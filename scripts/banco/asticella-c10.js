// C10 — le voci nuove dell'asticella: conosce la città, giornata piena, su misura, invenzioni, costo e tempo.
// Funzioni pure sui grezzi del banco (nessun import del motore). I controlli c1–c13 non cambiano: queste sono voci in più.

/** Le liste per il controllo: Catania come da task, Roma/Napoli/Palermo/Lecce le 6 del report C9, Troina 3 (dichiarate qui). */
export const ESSENZIALI_CONTROLLO = {
    Catania: [
        // alias dello stesso posto (dichiarati nel report C10): la Pescheria su Google è anche «Storico mercato del pesce di Catania»,
        // la Chiesa di San Nicolò l'Arena è la chiesa del Monastero dei Benedettini
        ["Cattedrale di Sant'Agata", /cattedrale di sant.?agata/i], ['Pescheria', /pescheria|mercato del pesce/i], ['Via Etnea', /^via etnea/i],
        ['Monastero dei Benedettini', /benedettini|san nicol[oò] l.?arena/i], ['Castello Ursino', /ursino/i], ['Teatro Massimo Bellini', /teatro (massimo )?bellini/i],
        ['Villa Bellini', /villa bellini|giardino bellini/i], ["Fera 'o Luni", /fera.{0,3}o.{0,3}luni/i],
    ],
    Roma: [
        ['Colosseo', /colosseo|anfiteatro flavio/i], ['Fontana di Trevi', /^fontana di trevi/i], ['Pantheon', /^pantheon/i],
        ['Basilica di San Pietro', /basilica (papale )?di san pietro|^san pietro/i], ['Foro Romano', /foro romano|fori imperiali/i], ['Piazza Navona', /^piazza navona/i],
    ],
    Napoli: [
        ['Duomo di Napoli', /duomo di (napoli|santa maria assunta)|cattedrale di (napoli|santa maria assunta)/i], ['Cappella Sansevero', /sansevero/i],
        ['Museo Archeologico Nazionale', /museo archeologico nazionale/i], ["Castel dell'Ovo", /castel dell.?ovo/i],
        ['Piazza del Plebiscito', /plebiscito/i], ['Spaccanapoli', /^spaccanapoli|^via benedetto croce|^via san biagio dei librai/i],
    ],
    Palermo: [
        ['Cattedrale di Palermo', /cattedrale (metropolitana )?di palermo|^cattedrale/i], ['Palazzo dei Normanni / Cappella Palatina', /palazzo dei normanni|palazzo reale di palermo|cappella palatina/i],
        ['Teatro Massimo', /teatro massimo/i], ['Mercato di Ballarò', /mercato.{0,6}ballar|^ballar[oò]$|mercato storico di ballar/i],
        ['Quattro Canti', /quattro canti|piazza vigliena/i], ['Chiesa della Martorana', /martorana|santa maria dell.?ammiraglio/i],
    ],
    Lecce: [
        ['Basilica di Santa Croce', /santa croce/i], ['Piazza del Duomo', /^piazza (del )?duomo/i], ['Anfiteatro Romano', /anfiteatro/i],
        ['Porta Napoli', /porta napoli/i], ['Teatro Romano', /^teatro romano/i], ['Castello di Carlo V', /carlo v/i],
    ],
    // Troina (borgo, ~9.000 abitanti): dichiarate per C10.
    Troina: [
        ['Cattedrale di Maria Santissima Assunta (Chiesa Madre)', /cattedrale|chiesa madre|maria (santissima|ss\.?) assunta/i],
        ['Torre Capitania', /torre capitania/i],
        ['Monastero di San Michele Arcangelo (ruderi)', /san michele|monastero nuovo/i],
    ],
};
// C10b3-ter (decisione di Ivano) — il SIMBOLO atteso di ogni citta' e' il primo nome della sua lista di controllo (l'ordine
// c'era gia': Colosseo, Duomo di Napoli, Cattedrale di Palermo, Basilica di Santa Croce, Cattedrale di Sant'Agata, Chiesa
// Madre). Le liste non cambiano: il primo posto diventa il simbolo da controllare.
export const SIMBOLO_CONTROLLO = Object.fromEntries(Object.entries(ESSENZIALI_CONTROLLO).map(([c, l]) => [c, l[0]]));
/**
 * Il simbolo della lista e' quello atteso? Il simbolo della citta' e' il PRIMO posto segnato simbolo dall'AI (non dedotto): in
 * una metropoli i simboli sono uno per quartiere, e un'ancora qualsiasi (il Pantheon a Roma) non basta.
 * `simboli`: [{ nome, dedotto? }] nell'ordine della lista.
 */
export function simboloGiusto(simboli, luogo) {
    const atteso = SIMBOLO_CONTROLLO[luogo];
    if (!atteso) return { applicabile: false };
    const primo = (simboli || []).find(x => x && !x.dedotto) || null;
    const [nome, rx] = atteso;
    return { applicabile: true, atteso: nome, simbolo: primo?.nome ?? null, dedotto: !primo && (simboli || []).length > 0, ok: !!primo && rx.test(primo.nome || '') };
}
export const BORGHI = new Set(['Troina']);
export const SOGLIE_C10 = {
    ancoreMin: 3, visiteDallaListaMin: 0.5, borgoDallaListaMin: 2, tempoLiberoMax: 45, giornataMinuti: 360,
    // C10b — metropoli (decisione di Ivano): almeno 2 ancore del quartiere scelto e metà delle visite dalla lista
    ancoreQuartiereMin: 2,
    diverseMin: 0.5, invenzioniMax: 0.2, costoPrimoMax: 0.60, costoAltriMax: 0.20, tempoPeggioreMaxSec: 5,
};

const tappe = (c) => (c.tours || []).flatMap(t => t.stops || []);
const vere = (c) => tappe(c).filter(s => !s.tempoLibero);
const intera = (c) => {
    const f = Array.isArray(c.finestraMinuti) ? c.finestraMinuti.filter(Number.isFinite) : [];
    return f.length > 0 ? Math.max(...f) >= SOGLIE_C10.giornataMinuti : /1 Giorno/.test(JSON.stringify(c.chiamata?.prefs || {}));
};
const visite = (c) => vere(c).filter(s => ['mattina', 'pomeriggio'].includes(s.moment) && !s.pasto && !s.passeggiata);

/**
 * Conosce la città: almeno 3 essenziali della lista di controllo nel tour e almeno metà delle visite dalla lista verificata
 * (borgo: almeno 2 posti della lista verificata, anche in mezza giornata: C10b, un borgo con pochi posti si gira in mezza
 * giornata). C10b — metropoli: almeno 2 ancore del quartiere scelto (gli essenziali verificati di quel quartiere) e metà
 * delle visite dalla lista.
 */
export function conosceCitta(c) {
    const scala = c.citta?.scala?.scala || null;
    const borgo = scala === 'borgo' || (!scala && BORGHI.has(c.luogo));
    if (!intera(c) && !borgo) return { applicabile: false };
    const lista = ESSENZIALI_CONTROLLO[c.luogo] || null;
    const ids = new Set((c.citta?.verificati || []).map(x => x.place_id));
    const dallaLista = vere(c).filter(s => ids.has(s.place_id));
    const vis = visite(c);
    const visDallaLista = vis.filter(s => ids.has(s.place_id));
    if (scala === 'metropoli' && c.citta?.quartiere?.nome) {
        // C10b2 — in giornata intera i quartieri sono due (mattina e pomeriggio): contano le ancore di entrambi; un quartiere
        // chiesto conta anche i luoghi della sua lista dedicata (sono le sue ancore)
        const nomi = new Set((c.citta.quartieri?.length ? c.citta.quartieri.map(x => x.nome) : [c.citta.quartiere.nome]).map(n => String(n).toLowerCase()));
        const q = [...nomi].join(' + ');
        const ancoreQ = new Set([
            ...(c.citta.verificati || []).filter(x => x.tipo === 'essenziale' && nomi.has(String(x.quartiere || '').toLowerCase())).map(x => x.place_id),
            ...(c.citta.listaQuartiere?.verificati || []).map(x => x.place_id),
        ]);
        for (const x of c.citta.listaQuartiere?.verificati || []) ids.add(x.place_id);
        const nelTour = vere(c).filter(s => ancoreQ.has(s.place_id)).map(s => s.title);
        const visQ = vis.filter(s => ids.has(s.place_id));
        const quota = vis.length ? visQ.length / vis.length : 0;
        const essenziali = lista ? lista.filter(([, rx]) => vere(c).some(s => rx.test(s.title || ''))).map(([n]) => n) : [];
        return {
            applicabile: true, borgo: false, metropoli: true, quartiere: c.citta.quartieri?.length ? c.citta.quartieri.map(x => x.nome).join(' + ') : q, ancoreQuartiere: nelTour, essenziali,
            visite: vis.length, visiteDallaLista: visQ.length, quota,
            ok: nelTour.length >= SOGLIE_C10.ancoreQuartiereMin && quota >= SOGLIE_C10.visiteDallaListaMin,
        };
    }
    if (borgo) {
        const essenziali = lista ? lista.filter(([, rx]) => vere(c).some(s => rx.test(s.title || ''))).map(([n]) => n) : [];
        return { applicabile: true, borgo: true, essenziali, dallaLista: dallaLista.map(s => s.title), ok: dallaLista.length >= SOGLIE_C10.borgoDallaListaMin };
    }
    if (!lista) return { applicabile: false };
    const essenziali = lista.filter(([, rx]) => vere(c).some(s => rx.test(s.title || ''))).map(([n]) => n);
    const quota = vis.length ? visDallaLista.length / vis.length : 0;
    return {
        applicabile: true, borgo: false, essenziali, visite: vis.length, visiteDallaLista: visDallaLista.length, quota,
        ok: essenziali.length >= SOGLIE_C10.ancoreMin && quota >= SOGLIE_C10.visiteDallaListaMin,
    };
}

/** Giornata piena: in una giornata intera, tempo libero totale al massimo 45 minuti. */
export function giornataPiena(c) {
    if (!intera(c)) return { applicabile: false };
    const minuti = tappe(c).filter(s => s.tempoLibero).reduce((a, s) => a + (Number(s.stay) || 0), 0);
    // posti aperti rimasti nel pool (candidati di mattina e pomeriggio mai scelti): dice se il vuoto poteva riempirsi
    const pool = c.pool || {};
    const aperti = new Set();
    for (const [m, v] of Object.entries(pool)) if (/mattina|pomeriggio/.test(m)) for (const x of v.candidati || []) if (!x.scelto && !x.nelGiro) aperti.add(x.place_id);
    return { applicabile: true, minuti, postiApertiNonUsati: aperti.size, ok: minuti <= SOGLIE_C10.tempoLiberoMax };
}

/** Su misura: due giri della stessa città con profili opposti hanno almeno metà delle tappe diverse. */
export function suMisura(a, b) {
    const ia = new Set(vere(a).map(s => s.place_id)), ib = new Set(vere(b).map(s => s.place_id));
    const comuni = [...ia].filter(x => ib.has(x));
    const max = Math.max(ia.size, ib.size) || 1;
    const diverse = 1 - comuni.length / max;
    return { comuni: comuni.length, tappeA: ia.size, tappeB: ib.size, diverse, ok: diverse >= SOGLIE_C10.diverseMin,
        nomiComuni: vere(a).filter(s => ib.has(s.place_id)).map(s => s.title) };
}

/** Invenzioni: la quota di nomi proposti dall'AI che Google non verifica (indicatore, obiettivo sotto il 20%). */
export function invenzioni(conti) {
    if (!conti || !conti.proposti) return { applicabile: false };
    const quota = conti.scartati / conti.proposti;
    return { applicabile: true, proposti: conti.proposti, scartati: conti.scartati, quota, ok: quota < SOGLIE_C10.invenzioniMax };
}

/** Costo del tour (primo della città nel giorno: con la lista nuova) e tempo contro quello di oggi. */
export function costoETempo(c, costo, baseSec) {
    const primo = c.citta ? c.citta.cached === false : false;
    const max = primo ? SOGLIE_C10.costoPrimoMax : SOGLIE_C10.costoAltriMax;
    const peggio = Number.isFinite(baseSec) && Number.isFinite(c.secs) ? c.secs - baseSec : null;
    return { primo, costo, okCosto: costo <= max, sogliaCosto: max, secs: c.secs ?? null, peggioSec: peggio, okTempo: peggio === null ? null : peggio <= SOGLIE_C10.tempoPeggioreMaxSec };
}
