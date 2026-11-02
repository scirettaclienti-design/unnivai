/**
 * CURIOSITÀ DEL CAMMINO — quando chiederla e quando dirla, puro (nessuna rete, nessun timer: l'ora la passa chi chiama).
 *
 * Regole (decise da Ivano):
 *  - al massimo una ogni 10 minuti (dall'inizio dell'ultima detta); la prima dopo 300 m camminati nel giro;
 *  - solo camminando: mezzo «a piedi» e in movimento (fra 0,4 e 3 m/s negli ultimi ~60 s);
 *  - mai sopra le indicazioni: non parte se la prossima svolta è così vicina che la frase finirebbe dentro la finestra della prima indicazione
 *    (110 m), se la prossima tappa è così vicina che finirebbe all'arrivo, se la voce sta già parlando (svolta, «Si va verso…», arrivo, lettore)
 *    o se una scheda è aperta: aspetta;
 *  - mai ripetuta nello stesso giro (le chiavi dette restano sul telefono per il giro, anche dopo una ricarica).
 * La curiosità si chiede un minuto prima che la finestra si apra, così testo e audio sono pronti; se nel frattempo ti allontani troppo dal
 * punto in cui l'hai chiesta (250 m per una via, 800 m per un quartiere) o passa troppo tempo, non vale più e si richiede.
 */
import { SOGLIE_SVOLTA } from './vociTesti';

export const INTERVALLO_MS = 10 * 60_000;
export const ANTICIPO_MS = 60_000;
export const PRIMA_DOPO_M = 300;
export const RIPROVA_MS = 90_000;
export const RIPROVA_M = 150;
export const SCADENZA = Object.freeze({ via: { m: 250, ms: 4 * 60_000 }, quartiere: { m: 800, ms: 8 * 60_000 } });
/** La prima indicazione di svolta parla da 110 m: la curiosità deve finire prima. */
export const FINESTRA_SVOLTA_M = SOGLIE_SVOLTA[0].finoAM;
/** L'arrivo scatta entro qualche decina di metri dalla tappa (geofence + precisione). */
export const FINESTRA_ARRIVO_M = 60;
export const MARGINE_M = 30;
export const VELOCITA_PASSO_MS = 1.4;      // m/s, chi cammina in città
export const CARATTERI_AL_SECONDO = 14;    // la voce umana in italiano, all'incirca
export const CAMMINO = Object.freeze({ finestraMs: 60_000, minimoMs: 15_000, vMin: 0.4, vMax: 3 });
export const CHIAVE_GIRO = 'dvai_curiosita_giro_v1';

const R = 6371000;
const rad = (x) => (x * Math.PI) / 180;
export const metriFra = (a, b) => 2 * R * Math.asin(Math.sqrt(Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2));

/** Quanti secondi dura la frase detta, e quanti metri fai intanto. */
export const secondiParlando = (testo) => Math.ceil(String(testo || '').length / CARATTERI_AL_SECONDO);
export const metriParlando = (testo) => Math.ceil(secondiParlando(testo) * VELOCITA_PASSO_MS);

export function statoIniziale({ dette = [], ultimaMs = null } = {}) {
    return { dette: [...dette], ultimaMs, camminatiM: 0, ultimaPos: null, storia: [], richiesta: null, inCorso: false, pronta: null };
}

/** Una posizione nuova: metri camminati e la storia degli ultimi ~60 s. */
export function aggiornaCammino(st, { lat, lng, oraMs }) {
    const p = { lat, lng };
    const passo = st.ultimaPos ? metriFra(st.ultimaPos, p) : 0;
    const storia = [...st.storia, { ...p, t: oraMs }].filter(x => oraMs - x.t <= CAMMINO.finestraMs * 1.5).slice(-60);
    // un salto del GPS oltre 80 m in una lettura non è un passo
    return { ...st, ultimaPos: p, storia, camminatiM: st.camminatiM + (passo <= 80 ? passo : 0) };
}

/** Stai camminando? Velocità media fra la lettura più vecchia degli ultimi ~60 s (almeno 15 s fa) e l'ultima. */
export function staCamminando(st, oraMs) {
    const ultima = st.storia[st.storia.length - 1];
    const prima = st.storia.find(x => oraMs - x.t <= CAMMINO.finestraMs);
    if (!ultima || !prima || ultima.t - prima.t < CAMMINO.minimoMs) return false;
    const v = metriFra(prima, ultima) / ((ultima.t - prima.t) / 1000);
    return v >= CAMMINO.vMin && v <= CAMMINO.vMax;
}

const finestraAperta = (st, oraMs, anticipo = 0) => (st.ultimaMs == null ? st.camminatiM >= PRIMA_DOPO_M : oraMs - st.ultimaMs >= INTERVALLO_MS - anticipo);

/** Chiedere adesso una curiosità al server? Una sola richiesta alla volta; dopo una richiesta vuota si aspetta 90 s e 150 m. */
export function devoChiedere(st, { oraMs, attivo, camminando }) {
    if (!attivo || !camminando || st.inCorso || st.pronta || !st.ultimaPos) return false;
    if (!finestraAperta(st, oraMs, ANTICIPO_MS)) return false;
    if (st.richiesta && (oraMs - st.richiesta.ora < RIPROVA_MS || metriFra(st.richiesta.pos, st.ultimaPos) < RIPROVA_M)) return false;
    return true;
}

/** La richiesta parte da qui. */
export const richiestaPartita = (st, { oraMs }) => ({ ...st, inCorso: true, richiesta: { ora: oraMs, pos: st.ultimaPos } });

/** La risposta del server (null = niente): una curiosità già detta in questo giro non si tiene. */
export function rispostaArrivata(st, curiosita, { oraMs }) {
    const base = { ...st, inCorso: false };
    if (!curiosita?.testo || !curiosita.chiave || st.dette.includes(curiosita.chiave)) return base;
    return { ...base, pronta: { ...curiosita, ora: oraMs, pos: st.richiesta?.pos || st.ultimaPos } };
}

/** La curiosità pronta vale ancora? Una via vale a 250 m da dove l'hai chiesta, un quartiere a 800 m (e per qualche minuto). */
export function prontaScaduta(pronta, { oraMs, pos }) {
    if (!pronta) return false;
    const s = SCADENZA[pronta.tipo] || SCADENZA.via;
    return oraMs - pronta.ora > s.ms || (pos && pronta.pos ? metriFra(pronta.pos, pos) > s.m : false);
}

/**
 * Dire adesso la curiosità pronta? `{ si, motivo }`: il motivo dice perché aspetta (per il registro della prova).
 * @param {{ oraMs: number, attivo: boolean, camminando: boolean, distanzaSvoltaM?: number|null, distanzaTappaM?: number|null, voceOccupata?: boolean, schedaAperta?: boolean }} c
 */
export function possoDire(st, { oraMs, attivo, camminando, distanzaSvoltaM = null, distanzaTappaM = null, voceOccupata = false, schedaAperta = false }) {
    const p = st.pronta;
    if (!p) return { si: false, motivo: 'niente di pronto' };
    if (!attivo) return { si: false, motivo: 'giro fermo o in pausa' };
    if (!camminando) return { si: false, motivo: 'non stai camminando' };
    if (!finestraAperta(st, oraMs)) return { si: false, motivo: 'meno di 10 minuti dall\'ultima' };
    if (st.dette.includes(p.chiave)) return { si: false, motivo: 'già detta' };
    const metri = metriParlando(p.testo);
    if (Number.isFinite(distanzaSvoltaM) && distanzaSvoltaM < FINESTRA_SVOLTA_M + metri + MARGINE_M) return { si: false, motivo: 'svolta vicina' };
    if (Number.isFinite(distanzaTappaM) && distanzaTappaM < FINESTRA_ARRIVO_M + metri + MARGINE_M) return { si: false, motivo: 'tappa vicina' };
    if (voceOccupata) return { si: false, motivo: 'la voce sta parlando' };
    if (schedaAperta) return { si: false, motivo: 'scheda aperta' };
    return { si: true, motivo: 'ok' };
}

/** Detta: parte il conto dei 10 minuti, la chiave non torna più in questo giro. */
export const segnaDetta = (st, { oraMs }) => ({ ...st, ultimaMs: oraMs, dette: [...st.dette, st.pronta.chiave], pronta: null, richiesta: null });

// ─── sul telefono, per il giro (una ricarica a metà giro non fa ripetere né accorcia i 10 minuti) ──────────────────────
export function leggiGiro(chiaveGiro) {
    try {
        const v = JSON.parse(localStorage.getItem(CHIAVE_GIRO) || 'null');
        if (!v || v.giro !== chiaveGiro || !Array.isArray(v.dette) || Date.now() - (v.salvato || 0) > 12 * 3600_000) return { dette: [], ultimaMs: null };
        return { dette: v.dette.filter(x => typeof x === 'string'), ultimaMs: Number.isFinite(v.ultimaMs) ? v.ultimaMs : null };
    } catch { return { dette: [], ultimaMs: null }; }
}
export function salvaGiro(chiaveGiro, st) {
    try { localStorage.setItem(CHIAVE_GIRO, JSON.stringify({ giro: chiaveGiro, dette: st.dette, ultimaMs: st.ultimaMs, salvato: Date.now() })); } catch { /* niente storage: vale per la sessione */ }
}
