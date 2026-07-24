// navGeo.js — utility geometriche PURE per la navigazione (testabili senza React).

// Haversine in metri. Spostata qui da MapPage (fonte unica): usata dal filtro
// business, dal geofence e dallo snap maneuver.
export const haversineM = (lat1, lng1, lat2, lng2) => {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// L2-1: tolleranza di proiezione (m) per lo snap posizione→path. Oltre questa
// distanza dal percorso → nessuna istruzione (l'HUD torna a "→ Prossima tappa"),
// MAI l'ultima valida. DA CALIBRARE su device (insieme alla soglia geofence 2c-3).
export const MANEUVER_SNAP_TOLERANCE_M = 25;

// L2-1: sceglie lo step Directions ATTIVO proiettando la posizione sul path.
//   pts    = [{ lat, lng, stepIdx }] — concatenazione ORDINATA dei path di tutti
//            gli step (precomputata una volta per route).
//   fromIdx = cursore monotòno: la scansione parte da qui e va SOLO in avanti
//            (l'indice non torna mai indietro, anche se un punto precedente è
//            geometricamente più vicino).
//   tol    = tolleranza in metri.
// Ritorna { pointIdx, stepIdx } oppure null se: pts vuoto/non-array, coords non
// numeriche, o il punto più vicino IN AVANTI è oltre tol (fallback onesto, mai
// stale — regola locked #1).
// Determinismo su vertice condiviso: il confronto è strict (`<`), quindi a parità
// di distanza vince il PRIMO incontrato nella scansione forward = indice più
// basso = STEP PRECEDENTE. La monotonia a valle (Math.max in MapPage) impedisce
// comunque regressioni.
export function pickActiveStep(pts, lat, lng, fromIdx = 0, tol = MANEUVER_SNAP_TOLERANCE_M) {
    if (!Array.isArray(pts) || pts.length === 0) return null;
    if (typeof lat !== 'number' || typeof lng !== 'number' || Number.isNaN(lat) || Number.isNaN(lng)) return null;
    const start = Number.isInteger(fromIdx) && fromIdx > 0 ? Math.min(fromIdx, pts.length - 1) : 0;
    let bestIdx = -1;
    let bestDist = Infinity;
    for (let i = start; i < pts.length; i++) {
        const p = pts[i];
        if (!p || typeof p.lat !== 'number' || typeof p.lng !== 'number' || Number.isNaN(p.lat) || Number.isNaN(p.lng)) continue;
        const d = haversineM(lat, lng, p.lat, p.lng);
        if (d < bestDist) { bestDist = d; bestIdx = i; }
    }
    if (bestIdx < 0 || bestDist > tol) return null;
    // snapDistM = distanza di proiezione (quanto sei lontano dal path all'aggancio).
    // Dato-chiave per calibrare MANEUVER_SNAP_TOLERANCE_M. pointIdx/stepIdx invariati.
    return { pointIdx: bestIdx, stepIdx: pts[bestIdx].stepIdx, snapDistM: Math.round(bestDist) };
}
