// C10c-replay — la rete del banco, registrata e rigiocata.
//
// Un giro del banco esteso registra, caso per caso, ogni risposta dei due proxy (places-proxy: le ricerche di Google con
// orari e tipi; openai-proxy: la lista della citta', la lista del quartiere, traduttore, selettore e narratore) e i fatti
// aperti delle tappe. Il replay rifa' il giro con il motore vero servendo quelle risposte al posto della rete: 0 $, e la
// scelta del selettore e' quella registrata (non un'altra estrazione del modello).
//
// Regole del replay:
//   · places-proxy: la risposta si cerca per richiesta (parametri ordinati, senza `path`, `key` ed `engine`: come la chiave
//     della cache del proxy). Le foto non si scaricano (204: l'immagine non serve a tappe e orari).
//   · openai-proxy: la lista e la lista del quartiere per citta', giorno e quartiere; traduttore, selettore e narratore
//     nell'ordine in cui il giro li ha chiamati (la n-esima chiamata riceve la n-esima risposta registrata). Un prompt
//     diverso da quello registrato si segna (`promptDiversi`) ma non ferma il replay: e' il caso di una modifica al codice.
//   · qualunque altra richiesta, o una richiesta che il tracciato non ha, e' un'USCITA IN RETE: `fetch` lancia
//     ReteVietataError e il replay e' fallito. Mai una chiamata vera.
//   · eccezione dichiarata, solo con `racconto: 'vuoto'`: il narratore non registrato risponde con un errore (il motore
//     lascia le frasi al codice: tappe e orari non cambiano) e si segna in `raccontoMancante`.
import { createHash } from 'node:crypto';

export const FORMATO = 'tracciato-banco/1';

export class ReteVietataError extends Error {
    constructor(tipo, chiave) {
        super(`replay: uscita in rete vietata (${tipo}: ${String(chiave).slice(0, 200)})`);
        this.name = 'ReteVietataError';
        this.code = 'RETE_VIETATA';
        this.tipo = tipo;
        this.chiave = chiave;
    }
}

const sha = (s) => createHash('sha1').update(String(s)).digest('hex').slice(0, 16);
const corpoJson = (body) => { try { return JSON.parse(String(body ?? '')); } catch { return null; } };

/** La chiave di una richiesta a places-proxy: path + parametri ordinati, senza path, key ed engine (come la cache del proxy). */
export function chiavePlaces(url) {
    const p = new URL(String(url), 'http://x').searchParams;
    const path = p.get('path') || 'altro';
    const e = [...p.entries()].filter(([k]) => !['path', 'key', 'engine'].includes(k)).sort(([a], [b]) => a.localeCompare(b));
    return `${path}:${e.map(([k, v]) => `${k}=${v}`).join('&')}`;
}

/** La stessa chiave da una riga di `places_cache` (`v1:new2-…:place/textsearch:…` o `v1:place/findplacefromtext:…`). */
export function chiaveDaCache(cacheKey) {
    return String(cacheKey).replace(/^v\d+:/, '').replace(/^new\d*-[a-z0-9]+:/, '');
}

/** Quale passaggio dell'AI chiede una richiesta a openai-proxy. */
export function passaggioAI(body) {
    const j = corpoJson(body) || {};
    const dv = j.dv || {};
    if (dv.purpose === 'city_list') return 'lista';
    if (dv.purpose === 'quartiere_list') return 'quartiere';
    if (['traduttore', 'selettore', 'narratore'].includes(dv.passaggio)) return dv.passaggio;
    const sys = String(j.messages?.[0]?.content || '');
    if (sys.includes('traduttore di intenti')) return 'traduttore';
    return 'altro';
}

const norm = (s) => String(s ?? '').trim().toLowerCase();
/** La chiave di una lista: citta', giorno e (per la lista dedicata) quartiere. */
export function chiaveLista(body) {
    const dv = corpoJson(body)?.dv || {};
    return `${norm(dv.citta)}|${dv.giorno ?? ''}|${norm(dv.quartiere)}`;
}

/** L'impronta del prompt (i messaggi senza `dv`, che porta il biglietto della generazione). */
export function impronta(body) {
    const j = corpoJson(body);
    return j ? sha(JSON.stringify(j.messages ?? null)) : null;
}

// Le foto non servono a tappe e orari: della ricerca si tiene solo il riferimento della prima (l'immagine della tappa).
const alleggerisci = (corpo) => {
    if (!corpo || typeof corpo !== 'object') return corpo;
    const r = { ...corpo };
    for (const k of ['results', 'candidates']) {
        if (Array.isArray(r[k])) r[k] = r[k].map(x => (Array.isArray(x?.photos) ? { ...x, photos: x.photos.slice(0, 1).map(f => ({ photo_reference: f?.photo_reference })) } : x));
    }
    return r;
};

export const tracciaVuota = () => ({ places: {}, ai: { lista: {}, quartiere: {}, traduttore: [], selettore: [], narratore: [], altro: [] } });

/**
 * Il registratore di un caso: `annota` riceve ogni risposta dei proxy durante il giro vero (solo corpi e chiavi: nessuna
 * intestazione, nessun token).
 */
export function creaRegistratore() {
    const rete = tracciaVuota();
    return {
        rete,
        annota(url, init, status, corpo) {
            const u = String(url);
            if (u.includes('places-proxy')) {
                const k = chiavePlaces(u);
                if (k.startsWith('place/photo')) return;
                rete.places[k] = { status, corpo: alleggerisci(corpo) };
            } else if (u.includes('openai-proxy')) {
                const p = passaggioAI(init?.body);
                if (p === 'lista' || p === 'quartiere') rete.ai[p][chiaveLista(init?.body)] = { status, corpo };
                else rete.ai[p].push({ status, corpo, prompt: impronta(init?.body) });
            }
        },
    };
}

const risposta = (status, corpo) => new Response(corpo == null ? null : JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json' } });

/**
 * La rete del replay: un `fetch` che serve SOLO dal tracciato.
 * @param {{ rete: object }} tracciato
 * @param {{ racconto?: 'registrato'|'vuoto' }} [opts]
 * @returns {{ fetch: Function, stato: { servite: number, uscite: Array, promptDiversi: Array, raccontoMancante: Array } }}
 */
export function creaReteReplay(tracciato, { racconto = 'registrato' } = {}) {
    const rete = tracciato?.rete || tracciaVuota();
    const stato = { servite: 0, uscite: [], promptDiversi: [], raccontoMancante: [] };
    const contatori = {};
    const vieta = (tipo, chiave) => {
        const e = new ReteVietataError(tipo, chiave);
        stato.uscite.push({ tipo, chiave: String(chiave).slice(0, 300) });
        throw e;
    };
    const fetch = async (url, init) => {
        const u = String(url instanceof URL ? url.href : (url?.url ?? url));
        if (u.includes('places-proxy')) {
            const k = chiavePlaces(u);
            if (k.startsWith('place/photo')) return new Response(null, { status: 204 });
            const r = rete.places[k];
            if (!r) return vieta('places', k);
            stato.servite += 1;
            return risposta(r.status, r.corpo);
        }
        if (u.includes('openai-proxy')) {
            const p = passaggioAI(init?.body);
            if (p === 'lista' || p === 'quartiere') {
                const k = chiaveLista(init?.body);
                const r = rete.ai[p]?.[k];
                if (!r) return vieta(`ai:${p}`, k);
                stato.servite += 1;
                return risposta(r.status, r.corpo);
            }
            const i = contatori[p] = (contatori[p] ?? -1) + 1;
            const r = rete.ai[p]?.[i];
            if (!r) {
                if (racconto === 'vuoto' && p === 'narratore') {
                    stato.raccontoMancante.push({ passaggio: p, chiamata: i + 1 });
                    return risposta(503, { error: 'replay: risposta del narratore non registrata', code: 'REPLAY_NARRATORE' });
                }
                return vieta(`ai:${p}`, `chiamata ${i + 1}`);
            }
            if (r.prompt && r.prompt !== impronta(init?.body)) stato.promptDiversi.push({ passaggio: p, chiamata: i + 1 });
            stato.servite += 1;
            return risposta(r.status, r.corpo);
        }
        return vieta('rete', u);
    };
    return { fetch, stato };
}

/** I fatti aperti delle tappe (factsService.fetchFactsForStops), registrati per place_id: solo il racconto. */
export function fattiRegistrati(res) {
    const out = {};
    for (const [id, v] of res?.byId || []) out[id] = v;
    return out;
}

/** In replay i fatti si servono dal tracciato; una tappa senza fatti registrati non ne ha (nessuna rete). */
export function fattiDalTracciato(fatti, stops) {
    const byId = new Map();
    const mancanti = [];
    for (const s of Array.isArray(stops) ? stops : []) {
        if (!s?.place_id) continue;
        if (fatti && fatti[s.place_id]) byId.set(s.place_id, fatti[s.place_id]);
        else { byId.set(s.place_id, { fatti: [], fonti: [] }); mancanti.push(s.place_id); }
    }
    return { byId, report: { richieste: byId.size, locali: 0, daCache: byId.size - mancanti.length, conFatti: 0, timeout: false, ms: 0, errori: [], scartati: [], replay: true, senzaFatti: mancanti.length } };
}

/** Le tappe di un caso del grezzo, per il confronto di fedelta': titolo, ora, momento (le righe di tempo libero comprese). */
export const tappeDi = (caso) => (caso?.tours || []).flatMap(t => t.stops || [])
    .map(s => ({ titolo: s.tempoLibero ? 'tempo libero' : s.title, at: s.at ?? null, momento: s.moment ?? null, ...(s.tempoLibero ? { minuti: s.stay ?? null } : { place_id: s.place_id ?? null }) }));

/** Lo stesso tour? Stesse tappe, nello stesso ordine, con lo stesso orario (e lo stesso tempo libero). */
export function confrontaTour(prima, dopo) {
    const a = tappeDi(prima);
    const b = tappeDi(dopo);
    const diff = [];
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
        const x = a[i], y = b[i];
        const ugualeTappa = x && y && x.titolo === y.titolo && (x.place_id ?? null) === (y.place_id ?? null);
        const ugualeOra = x && y && x.at === y.at && (x.minuti ?? null) === (y.minuti ?? null);
        if (!ugualeTappa || !ugualeOra) diff.push({ i, prima: x ? `${x.at?.slice(11, 16) ?? '?'} ${x.titolo}${x.minuti ? ` ${x.minuti}′` : ''}` : null, dopo: y ? `${y.at?.slice(11, 16) ?? '?'} ${y.titolo}${y.minuti ? ` ${y.minuti}′` : ''}` : null });
    }
    return { identico: diff.length === 0 && a.length > 0, tappePrima: a.length, tappeDopo: b.length, diff };
}
