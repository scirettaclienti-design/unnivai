/**
 * SEGNAPOSTI CHE NON SI SOVRAPPONGONO (panoramica del giro). Due segnaposti numerati piu' vicini del loro diametro, allo zoom attuale, si
 * allontanano in linea retta (a coppie, qualche passo di rilassamento) fino a non toccarsi; mai piu' di `MAX_SPOSTAMENTO_PX`. Funzione pura:
 * i punti si proiettano sul piano del mondo (256 px a zoom 0, il doppio a ogni zoom), nessuna chiamata alla mappa. Con la mappa inclinata (`inclinazione`,
 * gradi) le distanze in verticale si accorciano di cos(inclinazione): le si misura come le vede l'occhio, sullo schermo.
 */
export const DIAMETRO_SEGNAPOSTO_PX = 56; // il badge e' 44 px + il respiro: due numeri a questa distanza non si toccano
export const MAX_SPOSTAMENTO_PX = 140; // un mucchio di cinque ha bisogno di un raggio largo; oltre, il numero starebbe lontano dal suo posto

const mondo = (lat, lng, zoom) => {
    const scala = 256 * 2 ** zoom;
    const s = Math.sin((lat * Math.PI) / 180);
    return { x: ((lng + 180) / 360) * scala, y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * scala };
};

/**
 * @param {Array<{ id: string|number, lat: number, lng: number }>} punti
 * @param {number} zoom lo zoom attuale della mappa
 * @param {{ inclinazione?: number }} opzioni `inclinazione` della mappa in gradi (0 = vista dall'alto)
 * @returns {Map<string|number, { dx: number, dy: number }>} lo spostamento in pixel (solo per chi si sposta)
 */
export function separaSegnaposti(punti, zoom, { diametro = DIAMETRO_SEGNAPOSTO_PX, max = MAX_SPOSTAMENTO_PX, passi = 80, inclinazione = 0 } = {}) {
    const out = new Map();
    if (!Number.isFinite(zoom) || !Array.isArray(punti) || punti.length < 2) return out;
    const scorcio = Math.max(0.35, Math.cos(((Number(inclinazione) || 0) * Math.PI) / 180)); // mai meno di 0,35: oltre, la mappa e' quasi di taglio
    const P = punti.filter(p => Number.isFinite(p?.lat) && Number.isFinite(p?.lng)).map(p => { const w = mondo(p.lat, p.lng, zoom); return { id: p.id, x: w.x, y: w.y * scorcio, dx: 0, dy: 0 }; });
    for (let k = 0; k < passi; k++) {
        let mosso = false;
        for (let i = 0; i < P.length; i++) {
            for (let j = i + 1; j < P.length; j++) {
                const ax = P[i].x + P[i].dx, ay = P[i].y + P[i].dy, bx = P[j].x + P[j].dx, by = P[j].y + P[j].dy;
                let vx = bx - ax, vy = by - ay;
                let d = Math.hypot(vx, vy);
                if (d >= diametro) continue;
                if (d < 0.01) { const a = ((i * 7 + j * 13) % 360) * Math.PI / 180; vx = Math.cos(a); vy = Math.sin(a); d = 0.01; } // stesso punto: una direzione fissa per coppia
                const spinta = (diametro - d) / 2 + 0.5;
                const ux = vx / Math.hypot(vx, vy), uy = vy / Math.hypot(vx, vy);
                P[i].dx -= ux * spinta; P[i].dy -= uy * spinta; P[j].dx += ux * spinta; P[j].dy += uy * spinta;
                mosso = true;
            }
        }
        if (!mosso) break;
    }
    for (const p of P) {
        const m = Math.hypot(p.dx, p.dy);
        if (m < 1) continue;
        const k = m > max ? max / m : 1;
        out.set(p.id, { dx: Math.round(p.dx * k), dy: Math.round(p.dy * k) });
    }
    return out;
}
