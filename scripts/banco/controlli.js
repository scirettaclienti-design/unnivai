// BANCO-ESTESO — i controlli automatici delle 10 classi di errore.
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
import { giornoEMinuti, apertoAlle, orariDelGiorno } from './orari.js';

export const CLASSI = [
    ['c1', 'Pasti fuori fascia'],
    ['c2', 'Ristoranti a mattina/pomeriggio senza richiesta'],
    ['c3', 'Colazione in un posto non da colazione o chiuso'],
    ['c4', 'Meno di 4 tappe senza ripiego dichiarato'],
    ['c5', 'Posto chiuso all\'ora della tappa'],
    ['c6', 'Durate uguali per tipi diversi'],
    ['c7', 'Grammatica e ripetizioni nelle frasi'],
    ['c8', 'Inglese a schermo e meteo di adesso su un tour futuro'],
    ['c9', 'Onboarding o interessi persi dopo logout'],
    ['c10', 'Vincolo vegetariano violato o esteso ai non pasti'],
];

export const DEFINIZIONI = {
    c1: 'Una tappa-pasto (ristorante, trattoria, pizzeria…: `pasto`, non bar/caffè) con orario di arrivo fuori dalle fasce del pasto (pranzo e cena, da banco.config.json) '
        + 'oppure due pasti seduti a meno di `pastiDistanzaMinOre` ore uno dall\'altro nello stesso giro (il "secondo pranzo").',
    c2: 'Una tappa-pasto nel momento mattina o pomeriggio, salvo che il testo della richiesta chieda quel momento: colazione/brunch per la mattina, '
        + 'merenda per il pomeriggio, o il nome del momento insieme a una parola di cibo. "ristoranti", "trattorie" ecc. da soli NON chiedono un momento.',
    c3: 'Una tappa-locale (dove si mangia o beve) nel momento mattina che non è un posto da colazione (un ristorante/trattoria/pizzeria senza tipo cafe/bakery né nome da bar/caffè/pasticceria; '
        + 'o un wine bar/cocktail bar/enoteca) oppure che, secondo gli orari, è chiuso all\'ora di arrivo.',
    c4: 'Un giro (itinerario) con meno di `tappeMin` tappe vere e nessun ripiego dichiarato (tempo libero, tappa di ripiego, "un solo posto", query di base). '
        + 'Di sera, un drink (aperitivo/dopocena) più la cena valgono come giro completo. Per Te non si applica (giri da 3 tappe per progetto).',
    c5: 'Una tappa il cui posto, secondo gli opening_hours.periods di Google, è chiuso all\'ora di arrivo. Orario assente → "sconosciuto", contato a parte (non è una violazione).',
    c6: 'Una tappa la cui sosta è uguale alla sosta tipica di un tipo molto diverso dal suo (almeno `sostaScala` volte più lunga o più corta): '
        + 'es. un caffè che dura quanto un ristorante (75 min), un ristorante che dura quanto una chiesa (20 min).',
    c7: 'Nelle frasi a schermo: numero e unità che non concordano ("1 minuti", "2 minuto", "alle 1"), parola funzionale doppia ("di di"), segnaposto o vuoti (null, {x}), '
        + 'oppure la stessa frase (nome e numeri mascherati) almeno `frasiUgualiMin` volte nella stessa giornata.',
    c8: 'Inglese a schermo: la condizione meteo che non è una voce italiana (sunny, rainy, cloudy…), o due parole funzionali inglesi nelle frasi/nei titoli. '
        + 'Meteo di adesso su un tour futuro: il tour ha la data di un altro giorno ma mostra il meteo (quello della richiesta).',
    c9: 'Lo script ONB-1 (login → logout → login su browser vuoto → modifica interessi → logout/login): ogni passo deve essere OK, e i passi devono essere tutti.',
    c10: 'Con una dieta vegetariana: (a) un pasto che non viene da una ricerca col criterio della dieta; (b) un NON pasto (museo, chiesa, parco…) trovato solo da ricerche col criterio della dieta '
        + '(il vincolo esteso a ciò che non è cibo).',
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

/** Il tipo per la sosta: pasto, caffe, museo, chiesa, verde, altro. */
export function tipoSosta(s) {
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

const viol = (s, testo, classe, cfg) => ({ tappa: s ? nome(s) : null, momento: s?.moment ?? null, testo, gravita: cfg.esteso.gravita[classe] ?? 1 });
const esito = (id, applicabile, violazioni = [], extra = {}) => ({ id, applicabile, violazioni, ...extra });

// ─── 1 — pasti fuori fascia ─────────────────────────────────────────────────
export function c1(caso, cfg) {
    const E = cfg.esteso;
    const [p0, p1] = E.fasce.pranzo.map(minDi);
    const [c0, c1_] = E.fasce.cena.map(minDi);
    const out = [];
    for (const t of caso.tours || []) {
        const pasti = tappeDi(t).filter(s => s.pasto && s.at);
        for (const s of pasti) {
            const m = quando(s)?.minuti;
            if (m == null) continue;
            if (!((m >= p0 && m <= p1) || (m >= c0 && m <= c1_))) {
                out.push(viol(s, `${nome(s)} alle ${hhmmDi(m)}: un pasto fuori dalle fasce (pranzo ${E.fasce.pranzo.join('–')}, cena ${E.fasce.cena.join('–')})`, 'c1', cfg));
            }
        }
        const ord = [...pasti].sort((a, b) => new Date(a.at) - new Date(b.at));
        for (let i = 1; i < ord.length; i++) {
            const dt = (new Date(ord[i].at) - new Date(ord[i - 1].at)) / 60000;
            if (dt < E.pastiDistanzaMinOre * 60) {
                out.push(viol(ord[i], `${nome(ord[i])} alle ${oraTesto(ord[i])}: secondo pasto seduto a ${Math.round(dt)} min da ${nome(ord[i - 1])} (alle ${oraTesto(ord[i - 1])})`, 'c1', cfg));
            }
        }
    }
    return esito('c1', true, out);
}

// ─── 2 — ristoranti a mattina/pomeriggio senza richiesta ────────────────────
const RICHIESTA_MOMENTO = {
    mattina: (t) => /\b(colazione|brunch|cornett\w*|cappuccin\w*)\b/.test(t)
        || (/\b(mattin\w*)\b/.test(t) && /\b(ristorant\w*|trattori\w*|osteri\w*|pizzeri\w*|mangiar\w*|cibo|pranz\w*)\b/.test(t)),
    pomeriggio: (t) => /\b(merenda)\b/.test(t)
        || (/\b(pomerigg\w*)\b/.test(t) && /\b(ristorant\w*|trattori\w*|osteri\w*|pizzeri\w*|mangiar\w*|cibo|pranz\w*|osterie)\b/.test(t)),
};
export function c2(caso, cfg) {
    const testo = norm(caso.richiesta);
    const out = [];
    for (const t of caso.tours || []) {
        for (const s of tappeDi(t)) {
            if (!s.pasto || !RICHIESTA_MOMENTO[s.moment]) continue;
            if (RICHIESTA_MOMENTO[s.moment](testo)) continue;
            out.push(viol(s, `${nome(s)} (${s.moment}, alle ${oraTesto(s)}): un posto dove mangiare in un momento che la richiesta non chiede`, 'c2', cfg));
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
export function chiusoAllaTappa(caso, s) {
    // true | false | null (sconosciuto) — e perche' e' sconosciuto
    const q = quando(s);
    const o = caso.orari?.[s.place_id];
    if (!q) return { chiuso: null, perche: 'senza-orario-tappa' };
    if (!o || !o.chiamato) return { chiuso: null, perche: 'orari-non-richiesti' };
    const ap = apertoAlle(o.periods, q.giorno, q.minuti);
    if (ap === null) return { chiuso: null, perche: 'senza-orari' };
    return { chiuso: ap === false, perche: null, orari: orariDelGiorno(o.periods, q.giorno) };
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
export function c4(caso, cfg) {
    if (caso.tipo !== 'itinerario') return esito('c4', false);
    const out = [];
    const tutte = (caso.tours || []).flatMap(t => t.stops || []);
    const dichiarato = !!caso.ripiegoDichiarato || tutte.some(s => s.tempoLibero || s.ripiego || s.scelta === 'ripiego');
    for (const t of caso.tours || []) {
        const stops = tappeDi(t);
        if (stops.length >= cfg.esteso.tappeMin || dichiarato) continue;
        const drink = stops.some(s => ['aperitivo', 'dopocena'].includes(s.moment));
        const cena = stops.some(s => s.moment === 'cena');
        if (drink && cena) continue;
        out.push(viol(null, `${stops.length} ${stops.length === 1 ? 'tappa' : 'tappe'} (${stops.map(nome).join(', ') || 'nessuna'}) e nessun ripiego dichiarato`, 'c4', cfg));
    }
    return esito('c4', true, out);
}

// ─── 5 — posto chiuso all'ora della tappa ───────────────────────────────────
export function c5(caso, cfg) {
    const out = [];
    const sconosciuti = { totale: 0, 'orari-non-richiesti': 0, 'senza-orari': 0, 'senza-orario-tappa': 0 };
    for (const t of caso.tours || []) {
        for (const s of tappeDi(t)) {
            const c = chiusoAllaTappa(caso, s);
            if (c.chiuso) out.push(viol(s, `${nome(s)} alle ${oraTesto(s)}: chiuso (${c.orari})`, 'c5', cfg));
            else if (c.chiuso === null) { sconosciuti.totale++; sconosciuti[c.perche]++; }
        }
    }
    return esito('c5', true, out, { sconosciuti: sconosciuti.totale, sconosciutiPerCausa: sconosciuti });
}

// ─── 6 — durate uguali per tipi diversi ─────────────────────────────────────
export function c6(caso, cfg) {
    const { sostaTipica: T, sostaScala: K } = cfg.esteso;
    const out = [];
    for (const t of caso.tours || []) {
        for (const s of tappeDi(t)) {
            if (!Number.isFinite(s.stay)) continue;
            const k = tipoSosta(s);
            const altri = Object.entries(T).filter(([k2, m2]) => k2 !== k && (m2 / T[k] >= K || T[k] / m2 >= K) && m2 === s.stay).map(([k2]) => k2);
            if (altri.length) out.push(viol(s, `${nome(s)} (${k}): sosta di ${s.stay} min, la durata tipica di ${altri.join('/')} (per ${k}: ${T[k]} min)`, 'c6', cfg));
        }
    }
    return esito('c6', true, out);
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
    }
    for (const t of caso.tours || []) {
        for (const s of tappeDi(t)) {
            const eng = (String(s.description || '').match(INGLESE) || []);
            if (eng.length >= 2) out.push(viol(s, `«${s.description}» — parole inglesi (${[...new Set(eng.map(x => x.toLowerCase()))].join(', ')})`, 'c8', cfg));
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

export const CONTROLLI = { c1, c2, c3, c4, c5, c6, c7, c8, c10 };

/** Tutti i controlli per-caso. c9 e' del giro (vedi c9) e non sta qui. */
export function eseguiControlli(caso, cfg) {
    if (caso.errore || caso.saltato) return null;
    return Object.fromEntries(Object.entries(CONTROLLI).map(([k, f]) => [k, f(caso, cfg)]));
}
