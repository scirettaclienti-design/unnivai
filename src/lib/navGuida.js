/**
 * NAV-3 — i pezzi di testo della navigazione-guida, tutti PURI (niente rete, niente orologio): distanze, direzioni, via, riga insider,
 * minuti a piedi, «aperto fino alle», il filo del giorno. I testi sono nella voce di Unnivai: brevi, da insider.
 */
import { openStatus } from './openingHours';
import { romeParts } from './tourWindow';

/** 120 m · 1,2 km. Sotto i 100 m a passi di 5, fino a 1 km a passi di 10. */
export function formatMetri(m) {
    if (!Number.isFinite(m) || m <= 0) return null;
    if (m >= 1000) return `${(m / 1000).toFixed(1).replace('.', ',')} km`;
    if (m < 100) return `${Math.max(5, Math.round(m / 5) * 5)} m`;
    return `${Math.round(m / 10) * 10} m`;
}

/** La direzione di una manovra di Google, in italiano: «a sinistra», «a destra», «dritto»… */
export function versoDa(maneuver) {
    switch (maneuver) {
        case 'turn-left': case 'ramp-left': case 'fork-left': case 'roundabout-left': return 'a sinistra';
        case 'turn-right': case 'ramp-right': case 'fork-right': case 'roundabout-right': return 'a destra';
        case 'turn-slight-left': return 'leggermente a sinistra';
        case 'turn-slight-right': return 'leggermente a destra';
        case 'turn-sharp-left': return 'stretto a sinistra';
        case 'turn-sharp-right': return 'stretto a destra';
        case 'uturn-left': case 'uturn-right': return 'inversione a U';
        case 'straight': case 'merge': return 'dritto';
        default: return 'dritto';
    }
}

const PAROLE_DIREZIONE = new Set(['sinistra', 'destra', 'nord', 'sud', 'est', 'ovest', 'nord-est', 'nord-ovest', 'sud-est', 'sud-ovest', 'nordest', 'nordovest', 'sudest', 'sudovest']);
const senzaTag = (s) => String(s).replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

/** La via dell'istruzione («Svolta a <b>sinistra</b> su <b>Via Etnea</b>» → «Via Etnea»); null se non c'è. */
export function viaDa(instructionHtml) {
    if (!instructionHtml) return null;
    const blocchi = [...String(instructionHtml).matchAll(/<b>(.*?)<\/b>/gi)].map(m => senzaTag(m[1])).filter(Boolean);
    const vie = blocchi.filter(b => !PAROLE_DIREZIONE.has(b.toLowerCase()));
    return vie.length ? vie[vie.length - 1] : null;
}

const SVOLTE = new Set(['turn-left', 'turn-right', 'turn-slight-left', 'turn-slight-right', 'turn-sharp-left', 'turn-sharp-right', 'uturn-left', 'uturn-right', 'roundabout-left', 'roundabout-right', 'fork-left', 'fork-right', 'ramp-left', 'ramp-right']);
const metriFra = (a, b) => {
    const la1 = Number(a?.lat ?? a?.latitude), lo1 = Number(a?.lng ?? a?.longitude), la2 = Number(b?.lat ?? b?.latitude), lo2 = Number(b?.lng ?? b?.longitude);
    if (![la1, lo1, la2, lo2].every(Number.isFinite)) return null;
    const rad = (x) => (x * Math.PI) / 180;
    const d = Math.sin(rad(la2 - la1) / 2) ** 2 + Math.cos(rad(la1)) * Math.cos(rad(la2)) * Math.sin(rad(lo2 - lo1) / 2) ** 2;
    return 2 * 6371000 * Math.asin(Math.sqrt(d));
};
/**
 * La PROSSIMA SVOLTA PRINCIPALE di un tratto (solo svolte vere: mai «dritto» o «prosegui»): a che distanza e quale. Lungo il tratto verso la tappa;
 * se non ce ne sono prima della tappa, null (la pillola dice «verso <tappa>»).
 * @param {Array} steps  gli step di Directions con `legIndex`, `maneuver`, `instructions`, `distanceM`, `endLatLng`
 * @param {number} stepIdx lo step in cui sei
 * @param {{ lat: number, lng: number }} pos
 */
export function prossimaSvolta(steps, stepIdx, pos) {
    const cur = Array.isArray(steps) ? steps[stepIdx] : null;
    if (!cur || !pos) return null;
    let d = metriFra(pos, cur.endLatLng);
    if (d === null) d = 0;
    for (let j = stepIdx + 1; j < steps.length; j++) {
        const s = steps[j];
        if (s.legIndex !== cur.legIndex) return null;
        if (SVOLTE.has(s.maneuver)) return { distanzaM: d, maneuver: s.maneuver, instructionHtml: s.instructions || null };
        d += Number(s.distanceM) || 0;
    }
    return null;
}

/** I minuti a piedi per una distanza (4,5 km/h = 75 m al minuto), almeno 1. */
export const minutiAPiedi = (m) => (Number.isFinite(m) && m >= 0 ? Math.max(1, Math.round(m / 75)) : null);

/** La riga insider di una tappa: la prima frase della descrizione, al massimo 90 caratteri; null senza testo. */
export function rigaInsider(stop) {
    const t = String(stop?.description || '').replace(/\s+/g, ' ').trim();
    if (!t) return null;
    const frase = (t.match(/^.*?[.!?](?=\s|$)/) || [t])[0].trim();
    if (frase.length <= 90) return frase;
    return `${frase.slice(0, 87).replace(/[\s,;:]+\S*$/, '')}…`;
}

/** «aperto fino alle 19:00» per una tappa a quell'ora; null se l'orario non si sa o il posto non chiude. */
export function apertoFinoAlle(stop, quando = new Date()) {
    if (!stop || !(quando instanceof Date) || Number.isNaN(quando.getTime())) return null;
    // una sosta lunghissima: se a un certo punto il posto chiude, openStatus dice a che ora
    const st = openStatus(stop, quando, 1500);
    return st?.chiudeAlle ? `aperto fino alle ${st.chiudeAlle}` : null;
}

const durataLeggibile = (min) => {
    if (!Number.isFinite(min) || min <= 0) return null;
    if (min < 60) return `${Math.round(min)} min`;
    const h = Math.floor(min / 60), m = Math.round(min % 60);
    return m === 0 ? `${h} h` : `${h} h ${m} min`;
};
export { durataLeggibile };

/** «chiesa · 20 min · aperto fino alle 19:00»: le parti che si sanno, mai una inventata. */
export function rigaTappa({ categoria = null, stayMinutes = null, stop = null, quando = null } = {}) {
    return [categoria, durataLeggibile(stayMinutes), quando ? apertoFinoAlle(stop, quando) : null].filter(Boolean).join(' · ');
}

/** «Tappa 3 di 12». */
export const testoTappa = (fatte, totale) => `Tappa ${Math.min(Math.max(fatte, 0) + 1, Math.max(totale, 1))} di ${totale}`;

// ─── il filo del giorno (schermata 9) ───────────────────────────────────────────────────────────────────────────────
export const MOMENTI_FILO = [
    { key: 'colazione', label: 'Colazione' }, { key: 'mattina', label: 'Mattina' }, { key: 'pranzo', label: 'Pranzo' },
    { key: 'pomeriggio', label: 'Pomeriggio' }, { key: 'aperitivo', label: 'Aperitivo' }, { key: 'cena', label: 'Cena' }, { key: 'dopocena', label: 'Dopocena' },
];
/**
 * Il filo: i momenti presenti nel giro (dalla colazione al dopocena) con un puntino per tappa e quello attuale evidenziato.
 * @param {Array<{ moment?: string, colazione?: boolean }>} tappe  in ordine di giro
 * @param {number} indiceAttuale   la tappa che si sta raggiungendo (0-based), o l'ultima + 1 a giro finito
 */
export function filoDelGiorno(tappe, indiceAttuale) {
    const lista = Array.isArray(tappe) ? tappe : [];
    const gruppi = [];
    lista.forEach((s, i) => {
        const key = i === 0 && s?.colazione ? 'colazione' : (s?.moment || 'mattina');
        const g = gruppi[gruppi.length - 1];
        if (g && g.key === key) g.punti.push({ indice: i, attuale: i === indiceAttuale, fatta: i < indiceAttuale });
        else gruppi.push({ key, label: MOMENTI_FILO.find(m => m.key === key)?.label || key, punti: [{ indice: i, attuale: i === indiceAttuale, fatta: i < indiceAttuale }] });
    });
    return gruppi;
}
/** La frase sullo stato del giro (voce Unnivai, corta). */
export function fraseDelFilo(rimaste, totale, { sera = false } = {}) {
    if (!(totale > 0)) return null;
    if (rimaste <= 0) return 'Giro finito.';
    if (rimaste === 1) return sera ? 'Ultima tappa. La serata è tua.' : 'Ultima tappa.';
    if (rimaste === 2) return sera ? 'Ultime due tappe. La serata è tua.' : 'Ultime due tappe.';
    if (rimaste === totale) return 'Si parte.';
    if (rimaste <= Math.ceil(totale / 2)) return `Mancano ${rimaste} tappe.`;
    return `${totale - rimaste} fatte, ${rimaste} da vedere.`;
}

// ─── la fine del giro (schermata 5) ─────────────────────────────────────────────────────────────────────────────────
const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
/** «24 OTTOBRE» (ora di Roma) per «GIRO COMPLETATO · 24 OTTOBRE». */
export function dataDelGiro(date = new Date()) {
    const p = romeParts(date);
    return `${p.d} ${MESI[p.m - 1]}`.toUpperCase();
}
/** I tre numeri: km del tracciato (in linea d'aria fra le tappe fatte), tappe, ore (dal tempo reale o dalla stima). */
export function numeriDelGiro({ tappe = [], elapsedMs = null, distanzaM = null }) {
    const R = 6371;
    const rad = (x) => (x * Math.PI) / 180;
    let km = 0;
    for (let i = 1; i < tappe.length; i++) {
        const a = tappe[i - 1], b = tappe[i];
        const la1 = Number(a.lat ?? a.latitude), lo1 = Number(a.lng ?? a.longitude), la2 = Number(b.lat ?? b.latitude), lo2 = Number(b.lng ?? b.longitude);
        if (![la1, lo1, la2, lo2].every(Number.isFinite)) continue;
        const d = Math.sin(rad(la2 - la1) / 2) ** 2 + Math.cos(rad(la1)) * Math.cos(rad(la2)) * Math.sin(rad(lo2 - lo1) / 2) ** 2;
        km += 2 * R * Math.asin(Math.sqrt(d));
    }
    if (Number.isFinite(distanzaM) && distanzaM > 0) km = distanzaM / 1000;
    const ore = Number.isFinite(elapsedMs) && elapsedMs > 0 ? elapsedMs / 3600000 : null;
    return {
        km: km > 0 ? km.toFixed(1).replace('.', ',') : null,
        tappe: tappe.length,
        ore: ore === null ? null : ore < 1 ? `${Math.max(1, Math.round(ore * 60))} min` : `${ore.toFixed(1).replace('.', ',')} h`,
    };
}

// ─── la scheda della tappa (schermate 3 e 4) ────────────────────────────────────────────────────────────────────────
const FRASE_MOMENTO = {
    colazione: 'È l\'ora della colazione.', mattina: 'La mattina è il momento giusto: c\'è ancora poca gente.', pranzo: 'È ora di pranzo.',
    pomeriggio: 'Il pomeriggio è il suo momento.', aperitivo: 'È l\'ora dell\'aperitivo.', cena: 'È ora di cena.', dopocena: 'A quest\'ora è ancora aperto.',
};
/** «PERCHÉ SEI QUI ADESSO»: solo cose vere sulla tappa (il momento, l'orario di apertura, la strada dalla tappa prima). */
// le ore (a Roma) in cui la frase di un momento è vera: «la mattina…» non si dice di sera
const ORE_MOMENTO = { colazione: [6, 11.5], mattina: [6, 13], pranzo: [11.5, 15.5], pomeriggio: [13, 19.5], aperitivo: [17, 22], cena: [18.5, 24], dopocena: [21, 30] };
export function momentoCoerente(moment, ora) {
    const r = ORE_MOMENTO[moment];
    if (!r || !(ora instanceof Date) || Number.isNaN(ora.getTime())) return false;
    const p = romeParts(ora);
    let h = p.h + p.mi / 60;
    if (h < 6) h += 24;
    return h >= r[0] && h < r[1];
}
/** «al Bar», «alla Trattoria», «all'Osteria», «allo Stadio», «ai Quattro Canti»: la preposizione articolata giusta davanti al nome. */
const FEMMINILI = ['trattoria', 'osteria', 'pizzeria', 'basilica', 'cattedrale', 'chiesa', 'fontana', 'piazza', 'via', 'porta', 'villa', 'torre', 'pasticceria', 'gelateria', 'enoteca', 'birreria', 'rosticceria', 'taverna', 'cappella', 'galleria', 'abbazia', 'pescheria', 'panetteria', 'libreria', 'farmacia', 'cantina', 'terrazza', 'scalinata', 'strada', 'loggia', 'rocca', 'fortezza', 'badia', 'pieve', 'torrefazione', 'friggitoria', 'salumeria', 'macelleria', 'bottega', 'sinagoga', 'moschea', 'grotta', 'spiaggia', 'riviera', 'passeggiata', 'cittadella', 'biblioteca', 'pinacoteca', 'università', 'stazione', 'banchina', 'funicolare'];
export function alNome(nome) {
    let n = String(nome || '').trim();
    if (!n) return '';
    const art = n.match(/^(il|lo|la|l'|l’|i|gli|le)\s*(?=\S)/i);
    if (art) {
        const a = art[1].toLowerCase().replace('’', "'");
        const resto = n.slice(art[0].length).trim();
        const mappa = { il: 'al', lo: 'allo', la: 'alla', "l'": "all'", i: 'ai', gli: 'agli', le: 'alle' };
        return a === "l'" ? `all'${resto}` : `${mappa[a]} ${resto}`;
    }
    const prima = n.split(/\s+/)[0].replace(/[^\p{L}']/gu, '').toLowerCase();
    if (/^[aeiouàèéìòùh]/i.test(prima) && !/^(hotel)$/.test(prima)) return `all'${n}`;
    if (FEMMINILI.includes(prima)) return `alla ${n}`;
    if (/^(s[^aeiou]|z|gn|ps|x|pn)/i.test(prima)) return `allo ${n}`;
    return `al ${n}`;
}
export function percheAdesso(stop, quando = null, ora = null) {
    if (!stop) return null;
    const parti = [];
    // il momento si dice solo se è vero all'ora vera (`ora`); senza `ora` (compat) si dice com'era
    if (stop.moment && FRASE_MOMENTO[stop.moment] && (!ora || momentoCoerente(stop.moment, ora))) parti.push(FRASE_MOMENTO[stop.moment]);
    const aperto = quando ? apertoFinoAlle(stop, quando) : null;
    if (aperto) parti.push(`È ${aperto}.`);
    const t = Number(stop.travelMinutesFromPrev);
    if (Number.isFinite(t) && t > 0) parti.push(t === 1 ? 'È a un minuto a piedi dalla tappa prima.' : `È a ${t} minuti a piedi dalla tappa prima.`);
    return parti.length ? parti.join(' ') : null;
}
/** Il racconto da leggere: la descrizione della tappa; null senza testo. */
export const testoRacconto = (stop) => { const t = String(stop?.description || '').replace(/\s+/g, ' ').trim(); return t || null; };
/** La chicca è un testo SUO (il consiglio insider della tappa); se non c'è o è uguale al racconto, non c'è: mai lo stesso testo in due sezioni. */
export function chiccaDistinta(stop, racconto = null) {
    const c = String(stop?.insiderTip || '').replace(/\s+/g, ' ').trim();
    const norm = (x) => String(x || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    if (!c || norm(c) === norm(racconto) || (racconto && norm(racconto).includes(norm(c)))) return null;
    return c;
}
/** La stima della lettura (150 parole al minuto), in secondi. */
export const secondiDiLettura = (testo) => Math.max(5, Math.round((String(testo || '').trim().split(/\s+/).filter(Boolean).length / 150) * 60));
/** 0:12 */
export const minSec = (s) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, '0')}`;

/**
 * «COSA HO IMPARATO DI TE»: una frase vera, dal giro appena fatto e dal DNA. Mai una cosa inventata: senza dati, null.
 * @param {{ fatte: Array<{ categoria?: string|null }>, totale: number, saltate?: number, dnaWeights?: object }} p
 */
export function cosaHoImparato({ fatte = [], totale = 0, saltate = 0, dnaWeights = null } = {}) {
    const conta = {};
    for (const s of fatte) if (s?.categoria) conta[s.categoria] = (conta[s.categoria] || 0) + 1;
    const top = Object.entries(conta).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
    const NOMI = { cultura: 'cultura', food: 'cibo', natura: 'natura', arte: 'arte', nightlife: 'vita notturna', shopping: 'negozi', relax: 'relax', avventura: 'avventura' };
    const righe = [];
    if (top && fatte.length >= 2 && top[1] >= 2) {
        const nome = NOMI[top[0]] || top[0];
        const forte = dnaWeights && Number(dnaWeights[top[0]]) >= 0.2;
        righe.push(forte ? `Ti fermi volentieri sulla ${nome}: ${top[1]} tappe su ${totale || fatte.length}, come le altre volte.` : `Oggi la ${nome} ha vinto: ${top[1]} tappe su ${totale || fatte.length}.`);
    }
    if (saltate > 0) righe.push(saltate === 1 ? 'Hai saltato una tappa: ne terrò conto la prossima volta.' : `Hai saltato ${saltate} tappe: ne terrò conto la prossima volta.`);
    return righe.length ? righe.join(' ') : null;
}

/** Il tracciato del giro come punti in una scatola `larghezza × altezza` (con margine): per disegnarlo in SVG. */
export function tracciatoSvg(tappe, larghezza = 320, altezza = 200, margine = 22) {
    const pts = (tappe || []).map(s => ({ lat: Number(s.lat ?? s.latitude), lng: Number(s.lng ?? s.longitude) })).filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng));
    if (pts.length === 0) return [];
    const lat0 = pts.reduce((a, p) => a + p.lat, 0) / pts.length;
    const k = Math.cos((lat0 * Math.PI) / 180);
    const xs = pts.map(p => p.lng * k), ys = pts.map(p => -p.lat);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const w = larghezza - 2 * margine, h = altezza - 2 * margine;
    const scala = Math.min(maxX - minX > 0 ? w / (maxX - minX) : Infinity, maxY - minY > 0 ? h / (maxY - minY) : Infinity);
    const s = Number.isFinite(scala) ? scala : 1;
    const ox = margine + (w - (maxX - minX) * s) / 2, oy = margine + (h - (maxY - minY) * s) / 2;
    return pts.map((p, i) => ({ x: Number((ox + (xs[i] - minX) * s).toFixed(1)), y: Number((oy + (ys[i] - minY) * s).toFixed(1)) }));
}


// ─── LA FASCIA ORARIA DELLA MAPPA (nav-camera) ──────────────────────────────────────────────────────────────────────
// Durante la navigazione la mappa prende il colore della fascia: `mattina` fino a 2 ore dopo l'alba vera, `tramonto` da 1 ora prima a 30
// minuti dopo il tramonto vero, `notte` dal buio (30 minuti dopo il tramonto) all'alba, `giorno` il resto (resta Ossidiana).
export const FASCE_MAPPA = ['mattina', 'giorno', 'tramonto', 'notte'];
const MIN_MS = 60000;
export const MATTINA_DOPO_ALBA_MIN = 120;
export const TRAMONTO_PRIMA_MIN = 60;
export const TRAMONTO_DOPO_MIN = 30;
/** @param {Date|number} istante  @param {{ sunrise: Date|null, sunset: Date|null }} sole  @returns {'mattina'|'giorno'|'tramonto'|'notte'} */
export function fasciaMappa(istante, sole) {
    const t = istante instanceof Date ? istante.getTime() : istante;
    const alba = sole?.sunrise instanceof Date ? sole.sunrise.getTime() : null;
    const tramonto = sole?.sunset instanceof Date ? sole.sunset.getTime() : null;
    if (!Number.isFinite(t) || alba === null || tramonto === null) return 'giorno';
    if (t >= tramonto - TRAMONTO_PRIMA_MIN * MIN_MS && t < tramonto + TRAMONTO_DOPO_MIN * MIN_MS) return 'tramonto';
    if (t >= tramonto + TRAMONTO_DOPO_MIN * MIN_MS || t < alba) return 'notte';
    if (t >= alba && t < alba + MATTINA_DOPO_ALBA_MIN * MIN_MS) return 'mattina';
    return 'giorno';
}

// ─── LA FRECCIA DI PARTENZA ─────────────────────────────────────────────────────────────────────────────────────────
const RAD = Math.PI / 180;
/** La direzione (gradi, 0 = nord, in senso orario) da un punto a un altro. */
export function direzioneVerso(da, a) {
    const la1 = Number(da?.lat ?? da?.latitude) * RAD, la2 = Number(a?.lat ?? a?.latitude) * RAD;
    const dLo = (Number(a?.lng ?? a?.longitude) - Number(da?.lng ?? da?.longitude)) * RAD;
    const y = Math.sin(dLo) * Math.cos(la2);
    const x = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dLo);
    const g = Math.atan2(y, x) / RAD;
    return Number.isFinite(g) ? (g + 360) % 360 : null;
}
/** La differenza fra due direzioni, in gradi, da -180 a 180. */
export const scartoAngolo = (a, b) => ((((a - b) % 360) + 540) % 360) - 180;
const R_TERRA = 6371000;
/** La distanza in metri fra due punti. */
export function distanzaFraM(a, b) {
    const la1 = Number(a?.lat ?? a?.latitude) * RAD, la2 = Number(b?.lat ?? b?.latitude) * RAD;
    const h = Math.sin((la2 - la1) / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(((Number(b?.lng ?? b?.longitude) - Number(a?.lng ?? a?.longitude)) * RAD) / 2) ** 2;
    return 2 * R_TERRA * Math.asin(Math.sqrt(h));
}
export const PARTENZA_METRI = 10;
export const PARTENZA_TOLLERANZA_GRADI = 60;
/**
 * La freccia di partenza: grande, al centro dello schermo, indica la direzione FISICA verso la prima tappa. L'angolo e' relativo a dove guarda la
 * camera (la freccia e' disegnata sullo schermo: in alto = dove punta la mappa).
 * @returns {number|null} gradi in senso orario, 0 = in alto
 */
export function angoloFrecciaPartenza({ utente, tappa, orientamentoCamera = 0 }) {
    const d = direzioneVerso(utente, tappa);
    return d === null ? null : (Math.round(scartoAngolo(d, Number(orientamentoCamera) || 0)) || 0);
}
/** La partenza e' compiuta: almeno 10 m dal punto di partenza, nel verso giusto verso la prima tappa (entro 60°). */
export function partenzaCompiuta({ partenza, posizione, tappa }) {
    if (!partenza || !posizione || !tappa) return false;
    if (distanzaFraM(partenza, posizione) < PARTENZA_METRI) return false;
    const mossa = direzioneVerso(partenza, posizione), giusta = direzioneVerso(partenza, tappa);
    return mossa !== null && giusta !== null && Math.abs(scartoAngolo(mossa, giusta)) <= PARTENZA_TOLLERANZA_GRADI;
}


/** La foto della tappa nella scheda in basso: una foto vera di Places, oppure nessuna (mai una foto di stock, mai un segnaposto). */
export function fotoVera(stop) {
    const url = [stop?.googlePhoto, stop?.image].find(u => typeof u === 'string' && u.trim());
    if (!url) return null;
    return /unsplash\.com|placeholder|stock/i.test(url) ? null : url;
}
