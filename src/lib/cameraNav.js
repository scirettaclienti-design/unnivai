/**
 * LA CAMERA DELLA NAVIGAZIONE (nav-camera). Funzioni pure + un volo animato:
 *  · `interpola` / `lerpAngolo`: il cammino da una vista all'altra (la rotazione prende la via corta);
 *  · `direzioneDiMarcia`: heading dalla bussola; se manca, dalla direzione del percorso davanti a te; se manca, verso la prossima tappa;
 *  · `lisciaAngolo`: l'orientamento segue la direzione senza scatti (ogni posizione muove di una frazione);
 *  · `volaCamera`: il volo di ~1,5 s su di te (zoom 17–18, inclinazione 45–55°), un fotogramma per volta con `moveCamera`.
 */
import { direzioneVerso, distanzaFraM, scartoAngolo } from './navGuida.js';

export const VOLO_MS = 1500;
export const ZOOM_NAV = 18;
export const ZOOM_NAV_MIN = 17;
export const ZOOM_NAV_MAX = 18;
export const TILT_NAV = 50;
export const TILT_NAV_MIN = 45;
export const TILT_NAV_MAX = 55;
/** Il tratto di percorso «davanti a te» da cui si legge la direzione. */
export const GUARDA_AVANTI_M = 25;

const limita = (v, a, b) => Math.min(Math.max(v, a), b);
export const zoomNav = (z) => limita(Number.isFinite(z) ? z : ZOOM_NAV, ZOOM_NAV_MIN, ZOOM_NAV_MAX);
export const tiltNav = (t) => limita(Number.isFinite(t) ? t : TILT_NAV, TILT_NAV_MIN, TILT_NAV_MAX);

/** easeInOutCubic */
export const dolce = (t) => (t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2);
export const lerp = (a, b, t) => a + (b - a) * t;
/** L'angolo da `a` a `b` percorso per la via corta (gradi, 0–360). */
export const lerpAngolo = (a, b, t) => (((a + scartoAngolo(b, a) * t) % 360) + 360) % 360;
/** Un passo verso `verso`: ad ogni posizione l'orientamento si avvicina di `frazione` (0–1). */
export const lisciaAngolo = (attuale, verso, frazione = 0.35) => (Number.isFinite(attuale) ? lerpAngolo(attuale, verso, frazione) : verso);

/** Lo stato della camera a meta' (o dove sei) del volo. */
export function interpola(da, a, t) {
    const k = dolce(limita(t, 0, 1));
    return {
        lat: lerp(da.lat, a.lat, k), lng: lerp(da.lng, a.lng, k),
        zoom: lerp(da.zoom, a.zoom, k), tilt: lerp(da.tilt, a.tilt, k),
        heading: lerpAngolo(da.heading ?? 0, a.heading ?? 0, k),
    };
}

/**
 * La direzione di marcia (gradi, 0 = nord). Ordine: la bussola (se un numero), poi la direzione del percorso a ~25 m davanti a te,
 * poi la direzione verso la prossima tappa. Senza niente di tutto questo: null (la camera non ruota).
 * @param {{ bussola?: number|null, posizione: {lat,lng}, percorso?: Array<{lat,lng}>, tappa?: {lat,lng}|null }} p
 */
export function direzioneDiMarcia({ bussola = null, posizione, percorso = [], tappa = null } = {}) {
    if (Number.isFinite(bussola)) return ((bussola % 360) + 360) % 360;
    if (posizione && Array.isArray(percorso) && percorso.length > 1) {
        // il punto del percorso piu' vicino a te, poi si va avanti fino a GUARDA_AVANTI_M
        let i0 = 0, dMin = Infinity;
        percorso.forEach((p, i) => { const d = distanzaFraM(posizione, p); if (d < dMin) { dMin = d; i0 = i; } });
        for (let i = i0 + 1; i < percorso.length; i++) {
            if (distanzaFraM(posizione, percorso[i]) >= GUARDA_AVANTI_M || i === percorso.length - 1) return direzioneVerso(posizione, percorso[i]);
        }
    }
    if (posizione && tappa) return direzioneVerso(posizione, tappa);
    return null;
}

/**
 * Il volo della camera. `map` e' un google.maps.Map vettoriale (o una funzione che rende la mappa ATTIVA: a ogni fotogramma si comanda quella di
 * adesso, cosi' il volo segue la mappa anche quando una dissolvenza di fascia la sostituisce a meta') (getCenter/getZoom/getTilt/getHeading/moveCamera). Un fotogramma per
 * `requestAnimationFrame`; ogni nuovo volo interrompe il precedente. Rende una funzione che lo ferma.
 * @param {object} map
 * @param {{ lat: number, lng: number, zoom?: number, tilt?: number, heading?: number|null }} verso
 * @param {{ durata?: number, onFine?: () => void, raf?: Function, ora?: () => number }} [o]
 */
export function volaCamera(mappa, verso, { durata = VOLO_MS, onFine = null, raf = (typeof requestAnimationFrame === 'function' ? requestAnimationFrame : null), ora = () => Date.now() } = {}) {
    const attiva = () => (typeof mappa === 'function' ? mappa() : mappa);
    const map = attiva();
    if (!map || !Number.isFinite(verso?.lat) || !Number.isFinite(verso?.lng)) return () => {};
    volaCamera.corrente?.();
    const c = map.getCenter?.();
    const da = {
        lat: c?.lat?.() ?? verso.lat, lng: c?.lng?.() ?? verso.lng,
        zoom: map.getZoom?.() ?? verso.zoom ?? ZOOM_NAV, tilt: map.getTilt?.() ?? 0, heading: map.getHeading?.() ?? 0,
    };
    const a = { lat: verso.lat, lng: verso.lng, zoom: zoomNav(verso.zoom), tilt: tiltNav(verso.tilt), heading: Number.isFinite(verso.heading) ? verso.heading : da.heading };
    let fermo = false;
    const t0 = ora();
    const passo = () => {
        if (fermo) return;
        const t = (ora() - t0) / durata;
        const s = interpola(da, a, t);
        attiva()?.moveCamera({ center: { lat: s.lat, lng: s.lng }, zoom: s.zoom, tilt: s.tilt, heading: s.heading });
        if (t >= 1) { volaCamera.corrente = null; onFine?.(); return; }
        raf(passo);
    };
    const ferma = () => { fermo = true; };
    volaCamera.corrente = ferma;
    if (!raf) { attiva()?.moveCamera({ center: { lat: a.lat, lng: a.lng }, zoom: a.zoom, tilt: a.tilt, heading: a.heading }); onFine?.(); return ferma; }
    passo();
    return ferma;
}
volaCamera.corrente = null;
