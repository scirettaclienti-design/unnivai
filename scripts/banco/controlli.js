// BANCO-ESTESO — i controlli automatici delle 12 classi di errore.
//
// Funzioni pure: dal risultato grezzo di un caso (scritto da esteso.live.js) a
// un elenco di violazioni. Ogni classe ha la sua DEFINIZIONE scritta qui sotto
// (e nel report); le soglie stanno in banco.config.json, sezione "esteso".
// Nessun import dei servizi: si provano senza rete (src/__tests__/scripts).
//
// Forma di un caso: { id, modo, tipo, luogo, ora, oggi, richiesta, vincoli,
//   tourDate, schermo: { giorni: [{ titolo, meteo }], note: [] },
//   ripiegoDichiarato, orari: { [place_id]: { periods|null, chiamato } },
//   tours: [{ stops: [{ title, types, moment, at, stay, pasto, description,
//   place_id, tempoLibero, ripiego, scelta, dietaCercata, dietaSolo }] }] }
import { giornoEMinuti, apertoAlle, apertoPerTutta, orariDelGiorno, dataRoma, coperta, apertoPerTuttaGiorno, orariDelGiornoData } from './orari.js';

export const CLASSI = [
    ['c1', 'Pasti fuori fascia'],
    ['c2', 'Ristoranti a mattina/pomeriggio senza richiesta'],
    ['c3', 'Colazione in un posto non da colazione o chiuso'],
    ['c4', 'Sotto il minimo di tappe per la durata, senza ripiego dichiarato'],
    ['c5', 'Posto chiuso all\'ora della tappa'],
    ['c6', 'Durate uguali per tipi diversi'],
    ['c7', 'Grammatica e ripetizioni nelle frasi'],
    ['c8', 'Inglese a schermo e meteo di adesso su un tour futuro'],
    ['c9', 'Onboarding o interessi persi dopo logout'],
    ['c10', 'Vincolo vegetariano violato o esteso ai non pasti'],
    ['c11', 'Buco non dichiarato oltre 45 minuti, o tappa senza orario'],
    ['c12', 'Zona generica come tappa'],
    ['c13', 'Sera: drink corto, secondo bar o buco senza passeggiata'],
];

export const DEFINIZIONI = {
    c1: 'Una tappa-pasto (un ristorante: il TIPO PRINCIPALE di Google, non bar/caffè/forno: un cocktail bar marcato anche `restaurant` è un bar) con orario di arrivo fuori dalle fasce del pasto (pranzo e cena, da banco.config.json) '
        + 'oppure due pasti seduti a meno di `pastiDistanzaMinOre` ore uno dall\'altro nello stesso giro (il "secondo pranzo"); '
        + 'C8c — oppure un secondo dolce/gelato/pasticceria nello stesso tour (un bar scelto per l\'aperitivo o il drink non è un dolce: TESTI), o un dolce prima del pasto (a pranzo prima del ristorante, di mattina prima di una colazione, come prima tappa prima delle 14:45). '
        + 'C8b — vale anche per Per Te (gli orari di arrivo sono stimati da ora, cammino e soste). Un ristorante in un momento che il testo chiede esplicitamente ("un pomeriggio tra portici e osterie") non conta.',
    c2: 'Un ristorante (tipo principale) nel momento mattina, pomeriggio, aperitivo o dopocena, salvo che il testo della richiesta chieda quel momento (mattina e pomeriggio): colazione/brunch per la mattina, '
        + 'merenda per il pomeriggio, o il nome del momento insieme a una parola di cibo. "ristoranti", "trattorie" ecc. da soli NON chiedono un momento.',
    c3: 'Una tappa-locale (dove si mangia o beve) nel momento mattina che non è un posto da colazione (un ristorante/trattoria/pizzeria senza tipo cafe/bakery né nome da bar/caffè/pasticceria; '
        + 'o un wine bar/cocktail bar/enoteca) oppure che, secondo gli orari, è chiuso all\'ora di arrivo.',
    c4: 'C8b — un giro (itinerario) con meno tappe vere del MINIMO della sua durata e nessun ripiego dichiarato (tempo libero, tappa di ripiego, "un solo posto", query di base): '
        + 'finestra di 6 ore o più → 4, da 3 a 6 ore → 3, meno di 3 ore → 2, mai 1 (`minimiTappe`). Le righe di tempo libero non sono tappe. '
        + 'Una sera completa — drink + cena, drink + passeggiata, cena + passeggiata — vale come giro completo. Di giorno Per Te non si applica (giri da 3 tappe per progetto); di sera è un itinerario.',
    c5: 'Una tappa il cui posto, secondo gli opening_hours.periods di Google, è chiuso all\'ora di arrivo. Orario assente → "sconosciuto", contato a parte (non è una violazione).',
    c6: 'Una tappa la cui sosta è uguale alla sosta tipica di un tipo molto diverso dal suo (almeno `sostaScala` volte più lunga o più corta): '
        + 'es. un caffè che dura quanto un ristorante (75 min), un ristorante che dura quanto una chiesa (20 min).',
    c7: 'Nelle frasi a schermo: numero e unità che non concordano ("1 minuti", "2 minuto", "alle 1"), parola funzionale doppia ("di di"), segnaposto o vuoti (null, {x}), '
        + 'oppure la stessa frase (nome e numeri mascherati) almeno `frasiUgualiMin` volte nella stessa giornata.',
    c8: 'Inglese a schermo: la condizione meteo che non è una voce italiana (sunny, rainy, cloudy…), o due parole funzionali inglesi nelle frasi/nei titoli. '
        + 'TESTI — oppure una sezione che si chiama «Aperitivo» dopo le 21:30 (dalle 21:30 è «Dopocena»), «fascia €» (i prezzi si dicono «prezzi bassi / medi / alti»), il numero del giorno («Giorno 1 a …») in un tour di un solo giorno. '
        + 'Meteo di adesso su un tour futuro: il tour ha la data di un altro giorno ma mostra il meteo (quello della richiesta).',
    c9: 'Lo script ONB-1 (login → logout → login su browser vuoto → modifica interessi → logout/login): ogni passo deve essere OK, e i passi devono essere tutti.',
    c10: 'Con una dieta vegetariana: (a) un pasto che non viene da una ricerca col criterio della dieta; (b) un NON pasto (museo, chiesa, parco…) trovato solo da ricerche col criterio della dieta '
        + '(il vincolo esteso a ciò che non è cibo).',
    c11: 'CONTINUITA\' — in un giro (itinerario, non Per Te) fra due voci consecutive (tappe e righe di tempo libero) il tempo che non e\' coperto da sosta, cammino o da una riga di tempo libero '
        + 'supera `buchiMinuti` (45); oppure una tappa vera non ha l\'orario di arrivo. Il cammino e\' haversine a `camminoKmh`, ricalcolato qui. L\'attesa prima della prima tappa del giorno non conta.',
    c13: 'C8a — in un giro con un drink (aperitivo, o il drink serale del Percorso Veloce): (a) il drink dura meno di `sostaAperitivoMinuti` (45) — all\'aperitivo un bar è una sosta vera; '
        + '(b) un SECONDO bar fra il drink e la cena (o dopo il drink, se la cena non c\'è); (c) fra la fine del drink e la cena restano più di `passeggiataSogliaMinuti` (30) minuti senza una passeggiata e senza una riga di tempo libero che li dichiara; '
        + '(d) un Percorso Veloce che parte dalle 18:00 in poi (o prima dell\'alba) con UNA tappa sola: mai 1 tappa (il messaggio "quasi tutto chiuso", senza tappe, è un altro caso: vale solo se nel pool non c\'è niente di aperto); '
        + '(e) C8c — un giro che parte la sera (dalle 18:00, prima delle 23:00) senza la cena e senza la riga «Nessun locale aperto qui vicino a quest\'ora.» al suo posto.',
    c12: 'C7 — una tappa che è una ZONA: tipo principale o tipo da zona (locality, sublocality, neighborhood, political, route…) oppure un nome che è solo quello di un\'area ("Centro Storico Catania", "Zona Centro"). '
        + 'Una zona può orientare la ricerca, non essere una tappa.',
};

// ─── strumenti ──────────────────────────────────────────────────────────────
const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
const tappeDi = (tour) => (tour?.stops || []).filter(s => !s.tempoLibero);
const nome = (s) => s.title || s.name || '?';
const hhmmDi = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const minDi = (hhmm) => { const [h, m] = String(hhmm).split(':').map(Number); return h * 60 + m; };
const quando = (s) => (s.at ? giornoEMinuti(s.at) : null);
const oraTesto = (s) => { const q = quando(s); return q ? hhmmDi(q.minuti) : '?'; };

const NOME_TAVOLA = /\b(trattoria|osteria|ristorante|pizzeria|taverna|hostaria|bistrot|braceria|rosticceria|friggitoria)\b/;
const NOME_COLAZIONE = /\b(bar|caffe|caffetteria|pasticceria|pasticcerie|panificio|forno|cornetteria|gelateria|gelaterie|cafe)\b/;
const NOME_SERALE = /\b(wine|cocktail|enoteca|lounge|pub|birreria|club|discoteca|speakeasy)\b/;
const TIPI_LOCALE = ['restaurant', 'food', 'cafe', 'bar', 'bakery', 'meal_takeaway', 'meal_delivery', 'night_club', 'ice_cream_shop'];

const tipi = (s) => s.types || [];
const isLocale = (s) => !!s.pasto || tipi(s).some(t => TIPI_LOCALE.includes(t));

// C6a — il tipo principale di Google decide il tipo per la sosta (codice del banco, indipendente dal motore).
const PT_CAFFE = /^(bar|pub|irish_pub|cocktail_bar|wine_bar|lounge_bar|sports_bar|cafe|coffee_shop|cafeteria|tea_house|bakery|ice_cream_shop|dessert_shop|confectionery|candy_store|chocolate_shop|donut_shop|juice_shop)$/;
const PT_PASTO = /(^|_)restaurant$|^(bistro|diner|steak_house|food_court)$/;
const PT_VELOCE = /^(fast_food_restaurant|meal_takeaway|meal_delivery|sandwich_shop|deli)$/;
const PT_MUSEO = /(^|_)museum$|^art_gallery$/;
const PT_CHIESA = /^(church|place_of_worship|synagogue|mosque|hindu_temple)$/;
const PT_VERDE = /^(park|city_park|national_park|state_park|garden|botanical_garden|natural_feature|zoo|aquarium)$/;
function tipoDaPrincipale(pt) {
    if (!pt) return null;
    if (PT_VELOCE.test(pt)) return 'altro';
    if (PT_CAFFE.test(pt)) return 'caffe';
    if (PT_PASTO.test(pt)) return 'pasto';
    if (PT_MUSEO.test(pt)) return 'museo';
    if (PT_CHIESA.test(pt)) return 'chiesa';
    if (PT_VERDE.test(pt)) return 'verde';
    return null;
}

/** Il tipo per la sosta: pasto, caffe, museo, chiesa, verde, altro. */
export function tipoSosta(s) {
    const dalPrincipale = tipoDaPrincipale(s.primaryType);
    // un luogo di culto che e' anche museo (`museum` tra i types) si visita come un museo
    if (dalPrincipale === 'chiesa' && tipi(s).includes('museum')) return 'museo';
    if (dalPrincipale) return dalPrincipale;
    const n = norm(nome(s));
    const t = tipi(s);
    if (NOME_TAVOLA.test(n)) return 'pasto';
    if (NOME_COLAZIONE.test(n) || t.includes('cafe') || t.includes('bakery') || t.includes('ice_cream_shop')) return 'caffe';
    if (s.pasto) return 'pasto';
    if (t.some(x => ['museum', 'art_gallery'].includes(x))) return 'museo';
    if (t.some(x => ['church', 'place_of_worship', 'synagogue', 'mosque', 'hindu_temple'].includes(x))) return 'chiesa';
    if (t.some(x => ['park', 'natural_feature', 'zoo', 'aquarium', 'botanical_garden'].includes(x))) return 'verde';
    return 'altro';
}

// C7 — il "pasto" dei controlli 1 e 2 e' un posto dove ci si siede: il tipo principale e' un ristorante.
// Un cocktail bar marcato anche `restaurant`, un forno, un caffe' non lo sono (la colazione e l'aperitivo non sono pasti).
export const eRistorante = (s) => tipoSosta(s) === 'pasto';

const viol = (s, testo, classe, cfg) => ({ tappa: s ? nome(s) : null, momento: s?.moment ?? null, testo, gravita: cfg.esteso.gravita[classe] ?? 1 });
const esito = (id, applicabile, violazioni = [], extra = {}) => ({ id, applicabile, violazioni, ...extra });

// ─── 1 — pasti fuori fascia ─────────────────────────────────────────────────
// Le parole con cui il testo chiede un locale in un MOMENTO (usate da c1 e c2).
const RICHIESTA_MOMENTO = {
    mattina: (t) => /\b(colazione|brunch|cornett\w*|cappuccin\w*)\b/.test(t)
        || (/\b(mattin\w*)\b/.test(t) && /\b(ristorant\w*|trattori\w*|osteri\w*|pizzeri\w*|mangiar\w*|cibo|pranz\w*)\b/.test(t)),
    pomeriggio: (t) => /\b(merenda)\b/.test(t)
        || (/\b(pomerigg\w*)\b/.test(t) && /\b(ristorant\w*|trattori\w*|osteri\w*|pizzeri\w*|mangiar\w*|cibo|pranz\w*|osterie)\b/.test(t)),
};
// C8c — un dolce, un gelato, una pasticceria (indipendente dal motore: tipo o nome)
const NOME_DOLCE = /\b(pasticceri[ae]|gelateri[ae]|gelato|cioccolateri[ae])\b/;
const TIPI_DOLCE = /^(ice_cream_shop|gelato_shop|pastry_shop|dessert_shop|cake_shop|confectionery|chocolate_shop|candy_store|donut_shop)$/;
const PT_DOLCE = /^(ice_cream_shop|gelato_shop|dessert_shop|dessert_restaurant|confectionery|candy_store|chocolate_shop|donut_shop|pastry_shop|cake_shop)$/;
// TESTI — un bar scelto per l'aperitivo o il drink non e' un dolce, anche se e' pure una pasticceria o ha `cake_shop` tra i types
// (Bar Sgroi, C8e): il dolce e' quello che si sceglie come dolce.
const PT_BAR = /^(bar|cocktail_bar|lounge_bar|sports_bar|bar_and_grill|wine_bar|pub|irish_pub|brewpub|brewery)$/;
export const barDelDrink = (s) => ['aperitivo', 'dopocena'].includes(s.moment) && PT_BAR.test(s.primaryType || '');
export const eDolce = (s) => PT_DOLCE.test(s.primaryType || '') || (!s.pasto && !eRistorante(s) && (NOME_DOLCE.test(norm(nome(s))) || tipi(s).some(t => TIPI_DOLCE.test(t))));
export function c1(caso, cfg) {
    const E = cfg.esteso;
    const [p0, p1] = E.fasce.pranzo.map(minDi);
    const [c0, c1_] = E.fasce.cena.map(minDi);
    const testo = norm(caso.richiesta);
    // un ristorante in un momento che il testo chiede esplicitamente si rispetta
    const chiesto = (s) => !!RICHIESTA_MOMENTO[s.moment]?.(testo);
    const out = [];
    for (const t of caso.tours || []) {
        const pasti = tappeDi(t).filter(s => eRistorante(s) && s.at);
        for (const s of pasti) {
            const m = quando(s)?.minuti;
            if (m == null || chiesto(s)) continue;
            if (!((m >= p0 && m <= p1) || (m >= c0 && m <= c1_))) {
                out.push(viol(s, `${nome(s)} alle ${hhmmDi(m)}: un pasto fuori dalle fasce (pranzo ${E.fasce.pranzo.join('–')}, cena ${E.fasce.cena.join('–')})`, 'c1', cfg));
            }
        }
        // C8c — UN DOLCE PER TOUR, E DOPO UN PASTO: al massimo un dolce/gelato/pasticceria; mai prima del pasto (a pranzo dopo un ristorante,
        // di mattina dopo una colazione) e mai come prima tappa prima di pranzo. Dalla merenda (14:45) in poi un dolce solo va bene anche per primo.
        const inOrdine = tappeDi(t).filter(s => s.at).sort((a, b) => new Date(a.at) - new Date(b.at));
        const dolci = inOrdine.filter(x => eDolce(x) && !barDelDrink(x));
        for (const s of dolci.slice(1)) out.push(viol(s, `${nome(s)} alle ${oraTesto(s)}: un secondo dolce nello stesso tour (dopo ${nome(dolci[0])})`, 'c1', cfg));
        for (const s of dolci.slice(0, 1)) {
            const m = quando(s)?.minuti;
            if (m == null || m >= p1) continue;
            // C8d — la COLAZIONE chiesta per nome e' un pasto: la pasticceria che e' la prima tappa del mattino ne e' la colazione
            if (/\b(colazione|brunch|cornett\w*|cappuccin\w*|brioche)\b/.test(testo) && s === inOrdine[0] && m < 11 * 60) continue;
            const prima = inOrdine.slice(0, inOrdine.indexOf(s));
            const dopoPasto = m < p0 ? prima.some(x => tipoSosta(x) === 'caffe' && !eDolce(x)) : prima.some(eRistorante);
            if (!dopoPasto) out.push(viol(s, `${nome(s)} alle ${hhmmDi(m)}: un dolce prima del pasto${prima.length === 0 ? ' (è la prima tappa)' : ''}`, 'c1', cfg));
        }
        const ord = [...pasti].sort((a, b) => new Date(a.at) - new Date(b.at));
        for (let i = 1; i < ord.length; i++) {
            const dt = (new Date(ord[i].at) - new Date(ord[i - 1].at)) / 60000;
            if (dt < E.pastiDistanzaMinOre * 60 && !chiesto(ord[i]) && !chiesto(ord[i - 1])) {
                out.push(viol(ord[i], `${nome(ord[i])} alle ${oraTesto(ord[i])}: secondo pasto seduto a ${Math.round(dt)} min da ${nome(ord[i - 1])} (alle ${oraTesto(ord[i - 1])})`, 'c1', cfg));
            }
        }
    }
    return esito('c1', true, out);
}

// ─── 2 — ristoranti a mattina/pomeriggio senza richiesta ────────────────────
export function c2(caso, cfg) {
    const testo = norm(caso.richiesta);
    const MOMENTI = ['mattina', 'pomeriggio', 'aperitivo', 'dopocena'];
    const out = [];
    for (const t of caso.tours || []) {
        for (const s of tappeDi(t)) {
            if (!eRistorante(s) || !MOMENTI.includes(s.moment)) continue;
            // mattina e pomeriggio si possono chiedere ("la colazione", "il pomeriggio nelle osterie"); aperitivo e dopocena no: li' un ristorante non e' mai quello che si chiede
            if (RICHIESTA_MOMENTO[s.moment]?.(testo)) continue;
            out.push(viol(s, `${nome(s)} (${s.moment}, alle ${oraTesto(s)}): un ristorante in un momento che non è un pasto e che la richiesta non chiede`, 'c2', cfg));
        }
    }
    return esito('c2', true, out);
}

// ─── 3 — colazione in un posto non da colazione o chiuso ────────────────────
export function colazioneNonDaColazione(s) {
    const n = norm(nome(s));
    const t = tipi(s);
    const okCol = t.includes('cafe') || t.includes('bakery') || NOME_COLAZIONE.test(n);
    const serale = NOME_SERALE.test(n) && !(t.includes('cafe') || t.includes('bakery'));
    const tavola = s.pasto || NOME_TAVOLA.test(n);
    return serale || (tavola && !okCol);
}
export function chiusoAllaTappa(caso, s, { sosta = false, soloSettimana = false } = {}) {
    // true | false | null (sconosciuto) — e perche' e' sconosciuto.
    // Con `sosta` (c5, regola ORARI) il posto deve essere aperto per TUTTA la sosta,
    // non solo all'arrivo: `dove` dice se chiude all'arrivo o dopo.
    const q = quando(s);
    const o = caso.orari?.[s.place_id];
    if (!q) return { chiuso: null, perche: 'senza-orario-tappa' };
    if (!o || !o.chiamato) return { chiuso: null, perche: 'orari-non-richiesti' };
    // ORARI-FESTIVI — per una data coperta dagli orari del giorno vincono loro (festivi, ferie); oltre vale la settimana.
    if (!soloSettimana && o.current) {
        const data = dataRoma(s.at);
        const g = apertoPerTuttaGiorno(o.current, data, q.minuti, sosta && Number.isFinite(s.stay) ? s.stay : 0);
        if (g.aperto !== null) return { chiuso: g.aperto === false, perche: null, dove: g.perche || null, orari: orariDelGiornoData(o.current, data), fonte: 'giorno' };
    }
    if (!o.periods) return { chiuso: null, perche: 'senza-orari' };
    const r = apertoPerTutta(o.periods, q.giorno, q.minuti, sosta && Number.isFinite(s.stay) ? s.stay : 0);
    if (r.aperto === null) return { chiuso: null, perche: 'senza-orari' };
    return { chiuso: r.aperto === false, perche: null, dove: r.perche || null, orari: orariDelGiorno(o.periods, q.giorno), fonte: 'settimana' };
}
export function c3(caso, cfg) {
    const out = [];
    let sconosciuti = 0;
    for (const t of caso.tours || []) {
        for (const s of tappeDi(t)) {
            if (s.moment !== 'mattina' || !isLocale(s)) continue;
            if (colazioneNonDaColazione(s)) out.push(viol(s, `${nome(s)} alle ${oraTesto(s)}: non è un posto da colazione`, 'c3', cfg));
            const c = chiusoAllaTappa(caso, s);
            if (c.chiuso) out.push(viol(s, `${nome(s)} alle ${oraTesto(s)}: chiuso (${c.orari})`, 'c3', cfg));
            else if (c.chiuso === null) sconosciuti++;
        }
    }
    return esito('c3', true, out, { sconosciuti });
}

// ─── 4 — meno di 4 tappe senza ripiego dichiarato ───────────────────────────
/** C8b — il minimo di tappe per la durata della finestra (minuti): 6 ore o piu' → 4, da 3 a 6 ore → 3, meno → 2. Mai 1. */
export function minimoPerFinestra(minuti, cfg) {
    const M = cfg.esteso.minimiTappe;
    if (!Number.isFinite(minuti)) return M.corto;
    if (minuti >= M.lungoOre * 60) return M.lungo;
    if (minuti >= M.medioOre * 60) return M.medio;
    return M.corto;
}
export function c4(caso, cfg) {
    if (caso.tipo !== 'itinerario') return esito('c4', false);
    const out = [];
    const tutte = (caso.tours || []).flatMap(t => t.stops || []);
    const dichiarato = !!caso.ripiegoDichiarato || tutte.some(s => s.tempoLibero || s.ripiego || s.scelta === 'ripiego');
    const minimi = [];
    (caso.tours || []).forEach((t, i) => {
        const stops = tappeDi(t);
        // senza la finestra nel grezzo (giri vecchi) vale il minimo fisso di prima
        const minimo = Number.isFinite(caso.finestraMinuti?.[i]) ? minimoPerFinestra(caso.finestraMinuti[i], cfg) : cfg.esteso.tappeMin;
        minimi.push(minimo);
        if (stops.length >= minimo || dichiarato) return;
        const drink = stops.some(s => ['aperitivo', 'dopocena'].includes(s.moment));
        const cena = stops.some(s => s.moment === 'cena');
        // C8a — se la cena non e' piu' possibile (nessun locale aperto per tutta la sosta) il giro serale e' drink + passeggiata
        // C8b — o cena + passeggiata (la cena tardi): in tutti i casi una sera completa
        const passeggiata = stops.some(s => s.passeggiata);
        if (stops.length >= 2 && ((drink && (cena || passeggiata)) || (cena && passeggiata))) return;
        out.push(viol(null, `${stops.length} ${stops.length === 1 ? 'tappa' : 'tappe'} su un minimo di ${minimo} (${stops.map(nome).join(', ') || 'nessuna'}) e nessun ripiego dichiarato`, 'c4', cfg));
    });
    return esito('c4', true, out, { minimi });
}

// ─── 5 — posto chiuso all'ora della tappa ───────────────────────────────────
export function c5(caso, cfg) {
    const out = [];
    const sconosciuti = { totale: 0, 'orari-non-richiesti': 0, 'senza-orari': 0, 'senza-orario-tappa': 0 };
    let oltre = 0, allArrivo = 0, orarioSegnato = 0, daGiorno = 0, daSettimana = 0, soloGiornoChiude = 0;
    for (const t of caso.tours || []) {
        for (const s of tappeDi(t)) {
            const c = chiusoAllaTappa(caso, s, { sosta: true });
            if (c.fonte === 'giorno') daGiorno++; else if (c.fonte === 'settimana') daSettimana++;
            // quante tappe la sola settimana avrebbe accettato e il giorno speciale no (o viceversa)
            if (c.fonte === 'giorno' && chiusoAllaTappa(caso, s, { sosta: true, soloSettimana: true }).chiuso !== c.chiuso) soloGiornoChiude++;
            if (c.chiuso) {
                if (c.dove === 'oltre-chiusura') { oltre++; out.push(viol(s, `${nome(s)} alle ${oraTesto(s)}: la sosta (${s.stay} min) finisce oltre la chiusura (${c.orari})`, 'c5', cfg)); }
                else { allArrivo++; out.push(viol(s, `${nome(s)} alle ${oraTesto(s)}: chiuso (${c.orari})`, 'c5', cfg)); }
            } else if (c.chiuso === null) { sconosciuti.totale++; sconosciuti[c.perche]++; }
            if (s.orario === 'sconosciuto') orarioSegnato++;
        }
    }
    return esito('c5', true, out, { sconosciuti: sconosciuti.totale, sconosciutiPerCausa: sconosciuti, chiuseAllArrivo: allArrivo, oltreChiusura: oltre, orarioSconosciutoSegnato: orarioSegnato, daOrarioDelGiorno: daGiorno, daOrarioDellaSettimana: daSettimana, verdettoDiversoDallaSettimana: soloGiornoChiude });
}

// ─── 6 — durate uguali per tipi diversi ─────────────────────────────────────
export function c6(caso, cfg) {
    const { sostaTipica: T, sostaScala: K } = cfg.esteso;
    const out = [];
    const esercitate = {}; // C6a — quante tappe di ogni tipo sono state davvero controllate
    for (const t of caso.tours || []) {
        for (const s of tappeDi(t)) {
            if (!Number.isFinite(s.stay)) continue;
            const k = tipoSosta(s);
            esercitate[k] = (esercitate[k] || 0) + 1;
            const altri = Object.entries(T).filter(([k2, m2]) => k2 !== k && (m2 / T[k] >= K || T[k] / m2 >= K) && m2 === s.stay).map(([k2]) => k2);
            if (altri.length) out.push(viol(s, `${nome(s)} (${k}): sosta di ${s.stay} min, la durata tipica di ${altri.join('/')} (per ${k}: ${T[k]} min)`, 'c6', cfg));
        }
    }
    return esito('c6', true, out, { esercitate });
}

// ─── 7 — grammatica e ripetizioni ───────────────────────────────────────────
const GRAMMATICA = [
    [/(^|[^\d:.,])1 (minuti|ore|metri|giorni|persone|tappe|chilometri)\b/i, 'numero 1 con unità al plurale'],
    [/(^|[^\d:.,])(0|[2-9]|[1-9]\d+) (minuto|ora|metro|giorno|persona|tappa|chilometro)\b/i, 'numero maggiore di 1 con unità al singolare'],
    [/\balle 1(?!\d)/i, '"alle 1" (si dice "all\'una")'],
    [/\b(il|lo|la|le|di|da|in|con|per|che|un|una|è|e) \1\b/i, 'parola funzionale doppia'],
    [/\b(null|undefined|NaN)\b|\{\w+\}/, 'segnaposto o valore vuoto'],
    [/ {2,}/, 'spazio doppio'],
];
const frasiDi = (testo) => String(testo || '').split(/(?<=[.!?])\s+/).map(f => f.trim()).filter(Boolean);
export function c7(caso, cfg) {
    const out = [];
    const mascherate = new Map();
    for (const t of caso.tours || []) {
        for (const s of tappeDi(t)) {
            for (const f of frasiDi(s.description)) {
                for (const [re, perche] of GRAMMATICA) if (re.test(f)) out.push(viol(s, `«${f}» — ${perche}`, 'c7', cfg));
                const m = norm(f).split(norm(nome(s))).join('<nome>').replace(/\d+/g, '<n>');
                const lista = mascherate.get(m) || [];
                lista.push({ s, f });
                mascherate.set(m, lista);
            }
        }
    }
    for (const lista of mascherate.values()) {
        if (lista.length >= cfg.esteso.frasiUgualiMin) {
            out.push(viol(lista[0].s, `la stessa frase ${lista.length} volte nella giornata: «${lista[0].f}» (${lista.map(x => nome(x.s)).join(', ')})`, 'c7', cfg));
        }
    }
    for (const n of caso.schermo?.note || []) for (const [re, perche] of GRAMMATICA) if (re.test(n)) out.push(viol(null, `«${n}» — ${perche}`, 'c7', cfg));
    return esito('c7', true, out);
}

// ─── 8 — inglese a schermo e meteo di adesso su un tour futuro ──────────────
const METEO_ITALIANO = new Set(['soleggiato', 'sereno', 'nuvoloso', 'coperto', 'pioggia', 'piovoso', 'pioggia leggera', 'temporale', 'neve', 'nebbia', 'variabile', 'poco nuvoloso', 'parzialmente nuvoloso']);
const INGLESE = /\b(the|and|with|your|you|is|are|walk|visit|lunch|dinner|breakfast|morning|afternoon|evening|sunny|cloudy|rainy|clear sky|free time)\b/gi;
export function c8(caso, cfg) {
    const out = [];
    const g = caso.schermo?.giorni || [];
    for (const d of g) {
        const m = d.meteo;
        if (m?.condition && !METEO_ITALIANO.has(norm(m.condition))) out.push(viol(null, `meteo a schermo «${m.condition}, ${m.temperature}°C» in inglese`, 'c8', cfg));
        if (m && caso.tourDate && caso.oggi && caso.tourDate !== caso.oggi) {
            out.push(viol(null, `il tour è del ${caso.tourDate} ma mostra il meteo di adesso («${m.condition}, ${m.temperature}°C», richiesta del ${caso.oggi})`, 'c8', cfg));
        }
        const eng = (String(d.titolo || '').match(INGLESE) || []);
        if (eng.length >= 2) out.push(viol(null, `titolo del giorno «${d.titolo}» con parole inglesi (${eng.join(', ')})`, 'c8', cfg));
        // TESTI — un tour di un giorno (o di poche ore) non ha il numero del giorno
        if (g.length === 1 && /^\s*giorno\s*\d/i.test(String(d.titolo || ''))) out.push(viol(null, `titolo «${d.titolo}» con il numero del giorno in un tour di un giorno solo`, 'c8', cfg));
    }
    // TESTI — la sezione «Aperitivo» dopo le 21:30: dalle 21:30 (e fino all'alba) si chiama «Dopocena». `sezioni` = i nomi che la schermata mostra davvero.
    for (const z of caso.schermo?.sezioni || []) {
        const m = /^(\d{1,2}):(\d{2})$/.exec(z.ora || '');
        const minuti = m ? Number(m[1]) * 60 + Number(m[2]) : null;
        if (minuti != null && (minuti >= 21 * 60 + 30 || minuti < 6 * 60) && /^aperitivo$/i.test(String(z.etichetta || '').trim())) {
            out.push(viol(null, `sezione «${z.etichetta}» alle ${z.ora}: dalle 21:30 la sezione si chiama «Dopocena»`, 'c8', cfg));
        }
    }
    for (const t of caso.tours || []) {
        for (const s of tappeDi(t)) {
            const eng = (String(s.description || '').match(INGLESE) || []);
            if (eng.length >= 2) out.push(viol(s, `«${s.description}» — parole inglesi (${[...new Set(eng.map(x => x.toLowerCase()))].join(', ')})`, 'c8', cfg));
            // TESTI — i prezzi si dicono a parole
            if (/\bfascia\s*€/i.test(String(s.description || ''))) out.push(viol(s, `«${s.description}» — «fascia €» a schermo (si dice «prezzi bassi / medi / alti»)`, 'c8', cfg));
        }
    }
    for (const n of caso.schermo?.note || []) {
        const eng = (String(n).match(INGLESE) || []);
        if (eng.length >= 2) out.push(viol(null, `«${n}» — parole inglesi`, 'c8', cfg));
    }
    return esito('c8', true, out);
}

// ─── 9 — onboarding o interessi persi dopo logout (a livello di giro) ───────
export const PASSI_ONB1_ATTESI = 12;
export function c9(onb1, cfg) {
    const out = [];
    if (!onb1 || !Array.isArray(onb1.passi)) {
        return esito('c9', true, [{ tappa: null, momento: null, testo: 'ONB-1 non eseguito o senza risultato', gravita: cfg.esteso.gravita.c9 ?? 5 }]);
    }
    for (const p of onb1.passi.filter(x => !x.ok)) out.push({ tappa: null, momento: null, testo: `passo KO: ${p.nome}${p.dettaglio ? ` (${p.dettaglio})` : ''}`, gravita: cfg.esteso.gravita.c9 ?? 5 });
    if (onb1.passi.length < PASSI_ONB1_ATTESI) out.push({ tappa: null, momento: null, testo: `solo ${onb1.passi.length} passi su ${PASSI_ONB1_ATTESI}: la prova si è fermata prima`, gravita: cfg.esteso.gravita.c9 ?? 5 });
    return esito('c9', true, out);
}

// ─── 10 — vincolo vegetariano ───────────────────────────────────────────────
export function c10(caso, cfg) {
    const dieta = caso.vincoli?.dieta || [];
    if (!dieta.length) return esito('c10', false);
    const out = [];
    for (const t of caso.tours || []) {
        for (const s of tappeDi(t)) {
            if (s.pasto && s.dietaCercata === false) out.push(viol(s, `${nome(s)}: pasto che non viene da una ricerca ${dieta.join('+')}`, 'c10', cfg));
            if (!s.pasto && s.dietaSolo === true) out.push(viol(s, `${nome(s)}: non è un pasto ma è stato trovato solo da ricerche ${dieta.join('+')} (vincolo esteso ai non pasti)`, 'c10', cfg));
        }
    }
    return esito('c10', true, out);
}

// ─── 11 — buchi non dichiarati e tappe senza orario (CONTINUITA') ────────────
const kmTra = (a, b) => {
    const R = 6371; const r = (x) => (x * Math.PI) / 180;
    const x = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
};
const haCoord = (s) => Number.isFinite(s?.lat) && Number.isFinite(s?.lng);
export function c11(caso, cfg) {
    if (caso.tipo === 'perte') return esito('c11', false);   // Per Te non ha orari veri: l'arrivo e' stimato
    const E = cfg.esteso;
    const out = [];
    let buchi = 0; let senzaOrario = 0; let dichiarati = 0; let minutiBuco = 0;
    for (const t of caso.tours || []) {
        let fineAttesa = null;       // fine dell'ultima voce con orario (ms)
        let ultimaVera = null;       // l'ultima tappa vera (per il cammino)
        for (const s of t.stops || []) {
            const inizio = s.at ? new Date(s.at).getTime() : NaN;
            if (!Number.isFinite(inizio)) {
                if (!s.tempoLibero) { senzaOrario++; out.push(viol(s, `${nome(s)}: tappa senza orario di arrivo`, 'c11', cfg)); }
                fineAttesa = null;   // la catena si e' rotta: niente confronto su dati che non ci sono
                if (!s.tempoLibero) ultimaVera = s;
                continue;
            }
            if (s.tempoLibero) dichiarati++;
            if (fineAttesa != null) {
                const cammino = (!s.tempoLibero && ultimaVera && haCoord(ultimaVera) && haCoord(s)) ? (kmTra(ultimaVera, s) / E.camminoKmh) * 60 : 0;
                const buco = (inizio - fineAttesa) / 60000 - cammino;
                if (buco > E.buchiMinuti) {
                    buchi++; minutiBuco += Math.round(buco);
                    out.push(viol(s, `${Math.round(buco)} min senza tappa né riga prima di ${nome(s)} (alle ${oraTesto(s)}), dopo la voce che finiva alle ${hhmmDi(giornoEMinuti(new Date(fineAttesa).toISOString()).minuti)}`, 'c11', cfg));
                }
            }
            fineAttesa = inizio + (Number.isFinite(s.stay) ? s.stay : 0) * 60000;
            if (!s.tempoLibero) ultimaVera = s;
        }
    }
    return esito('c11', true, out, { buchi, senzaOrario, righeTempoLibero: dichiarati, minutiBuco });
}

// ─── 12 — zone come tappe (C7) ──────────────────────────────────────────────
const ZONA_PRINCIPALE = new Set(['locality', 'sublocality', 'sublocality_level_1', 'sublocality_level_2', 'sublocality_level_3', 'sublocality_level_4',
    'administrative_area_level_1', 'administrative_area_level_2', 'administrative_area_level_3', 'administrative_area_level_4', 'administrative_area_level_5',
    'political', 'neighborhood', 'route', 'postal_code', 'country', 'continent', 'archipelago', 'geocode']);
const ZONA_TIPI = new Set([...ZONA_PRINCIPALE].filter(t => t !== 'route' && t !== 'geocode'));
const NOMI_AREA = new Set(['centro storico', 'centro', 'centro citta', 'centro urbano', 'centro antico', 'citta vecchia', 'citta antica', 'quartiere', 'zona', 'rione',
    'zona centro', 'zona centrale', 'quartiere storico', 'old town', 'historic center', 'historic centre', 'downtown', 'city center', 'city centre']);
export function motivoZona(s, citta) {
    const pt = s.primaryType || null;
    if (pt && ZONA_PRINCIPALE.has(pt)) return `tipo principale ${pt}`;
    const t = tipi(s).find(x => ZONA_TIPI.has(x));
    if (t) return `tipo da zona ${t}`;
    // il nome e' solo quello di un'area, tolta la citta'
    const c = norm(citta);
    let resto = norm(nome(s));
    if (c) resto = resto.split(c).join(' ');
    resto = resto.replace(/[^a-z0-9' ]+/g, ' ').split(' ').filter(w => w && !['di', 'del', 'della', 'dello', 'de', 'il', 'lo', 'la', 'a', 'in', 'e', "l'"].includes(w)).join(' ');
    return NOMI_AREA.has(resto) ? `nome da area («${nome(s)}»)` : null;
}
export function c12(caso, cfg) {
    const out = [];
    for (const t of caso.tours || []) {
        for (const s of tappeDi(t)) {
            const m = motivoZona(s, caso.luogo);
            if (m) out.push(viol(s, `${nome(s)}: una zona, non una tappa (${m})`, 'c12', cfg));
        }
    }
    return esito('c12', true, out);
}

// ─── 13 — la sera: drink corto, secondo bar, buco senza passeggiata (C8a) ────
const eBar = (s) => tipoSosta(s) === 'caffe';
const RIGA_NESSUN_LOCALE = /nessun locale aperto/i;
/** C8c — un giro "serale": la prima tappa e' un aperitivo, una cena o un dopocena e il giro parte prima delle 23:00 (dopo, la cena non e' piu' possibile). */
export function giroSerale(caso, vere) {
    const [hh] = String(caso.ora || '').split(':').map(Number);
    const primo = vere[0];
    return !!primo && ['aperitivo', 'cena', 'dopocena'].includes(primo.moment) && Number.isFinite(hh) && hh >= 18 && hh < 23;
}
/** C8c — una sera con la cena (un ristorante di sera) o con la riga approvata al suo posto. */
export function sera_senza_cena_ok(caso, righe, vere) {
    if (!giroSerale(caso, vere)) return true;
    return vere.some(s => s.moment === 'cena' && s.pasto) || righe.some(s => s.tempoLibero && RIGA_NESSUN_LOCALE.test(s.description || ''));
}
/** C8c — una sera COMPLETA: drink + cena, oppure cena + passeggiata (o, se la cena non c'e', la riga approvata e almeno due tappe). */
export function seraCompleta(righe, vere) {
    const drink = vere.some(s => !s.passeggiata && ['aperitivo', 'dopocena'].includes(s.moment) && tipoSosta(s) === 'caffe');
    const cena = vere.some(s => s.moment === 'cena' && s.pasto);
    const passeggiata = vere.some(s => s.passeggiata);
    if ((drink && cena) || (cena && passeggiata)) return true;
    return vere.length >= 2 && righe.some(s => s.tempoLibero && RIGA_NESSUN_LOCALE.test(s.description || ''));
}
export function c13(caso, cfg) {
    if (caso.tipo !== 'itinerario') return esito('c13', false);
    const E = cfg.esteso;
    const out = [];
    let sere = 0;
    for (const t of caso.tours || []) {
        const righe = t.stops || [];
        const vere = tappeDi(t);
        // (e) C8c — LA SERA SI CENA: un giro che parte la sera (aperitivo, cena, dopocena) prima delle 23:00 ha la cena, o la riga approvata
        // «Nessun locale aperto qui vicino a quest'ora.» al suo posto. Mai una sera senza cena in silenzio.
        if (!sera_senza_cena_ok(caso, righe, vere)) {
            out.push(viol(vere[0] || null, `Giro serale delle ${caso.ora}: nessuna cena (${vere.map(nome).join(', ') || 'nessuna tappa'}) e nessuna riga «nessun locale aperto» al suo posto`, 'c13', cfg));
        }
        // il drink: la prima tappa-bar dell'aperitivo; nel Percorso Veloce serale anche il drink notturno (dopocena) in testa al giro
        const i = vere.findIndex((s, k) => !s.passeggiata && eBar(s) && (s.moment === 'aperitivo' || (caso.modo === 'veloce' && s.moment === 'dopocena' && k === 0)));
        if (i < 0) continue;
        sere++;
        const drink = vere[i];
        const cena = vere.slice(i + 1).find(s => s.moment === 'cena' && s.pasto);
        // (a) il drink dura almeno sostaAperitivoMinuti
        if (Number.isFinite(drink.stay) && drink.stay < E.sostaAperitivoMinuti) {
            out.push(viol(drink, `${nome(drink)}: il drink dura ${drink.stay} min, meno di ${E.sostaAperitivoMinuti} (all'aperitivo un bar è una sosta vera)`, 'c13', cfg));
        }
        // (b) un secondo bar dopo il drink e prima della cena
        const fine = cena ? vere.indexOf(cena) : vere.length;
        for (const s of vere.slice(i + 1, fine)) {
            if (eBar(s) && !s.passeggiata) out.push(viol(s, `${nome(s)}: un secondo bar fra il drink (${nome(drink)}) e la cena`, 'c13', cfg));
        }
        // (c) il buco fra la fine del drink e la cena: una passeggiata, o una riga di tempo libero che lo dichiara
        if (cena && drink.at && cena.at) {
            const buco = (new Date(cena.at).getTime() - (new Date(drink.at).getTime() + (Number.isFinite(drink.stay) ? drink.stay : 0) * 60000)) / 60000;
            const dopoDrink = righe.indexOf(drink);
            const primaCena = righe.indexOf(cena);
            const fra = righe.slice(dopoDrink + 1, primaCena);
            const conPasseggiata = fra.some(s => s.passeggiata);
            const dichiarato = fra.some(s => s.tempoLibero);
            if (buco > E.passeggiataSogliaMinuti && !conPasseggiata && !dichiarato) {
                out.push(viol(cena, `${Math.round(buco)} min fra la fine del drink (${nome(drink)}) e la cena senza una passeggiata né una riga di tempo libero`, 'c13', cfg));
            }
        }
    }
    // (d) il Percorso Veloce serale non e' mai una tappa sola (un giro senza tappe e' il messaggio dichiarato, non questo)
    if (caso.modo === 'veloce') {
        const [hh] = String(caso.ora || '').split(':').map(Number);
        const serale = Number.isFinite(hh) && (hh >= 18 || hh < 5);
        const vere = (caso.tours || []).flatMap(t => tappeDi(t));
        if (serale && vere.length === 1) {
            out.push(viol(vere[0], `Percorso Veloce delle ${caso.ora}: una tappa sola (${nome(vere[0])}); il giro serale e' drink + passeggiata (+ cena se aperta)`, 'c13', cfg));
        }
    }
    return esito('c13', true, out, { sere });
}

export const CONTROLLI = { c1, c2, c3, c4, c5, c6, c7, c8, c10, c11, c12, c13 };

/** Tutti i controlli per-caso. c9 e' del giro (vedi c9) e non sta qui. */
export function eseguiControlli(caso, cfg) {
    if (caso.errore || caso.saltato) return null;
    return Object.fromEntries(Object.entries(CONTROLLI).map(([k, f]) => [k, f(caso, cfg)]));
}
