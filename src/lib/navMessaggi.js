/**
 * NAV-1 — i messaggi della navigazione (testi di Ivano, alla lettera: non si cambiano qui).
 * Mai un codice d'errore inglese a schermo: un errore di Google Directions diventa PERCORSO.
 */
export const NAV_TESTI = Object.freeze({
    GPS_ATTESA: 'Cerco il segnale. Intanto segui la mappa: le tappe si sbloccano appena ti trovo.',
    GPS_PERSO: 'Ho perso il segnale. Continua pure: quando torna, riparto da dove sei.',
    POSIZIONE_NEGATA: 'Senza posizione non posso guidarti. Attivala in Impostazioni › Safari › Posizione, oppure segna le tappe a mano.',
    OFFLINE: 'Sei offline. La mappa resta; il percorso si aggiorna quando torna la rete.',
    PERCORSO: 'Non riesco a calcolare il percorso fin qui. Aprilo in Mappe o passa alla tappa dopo.',
    RIPRESA: (n, m) => `Hai un giro in corso: tappa ${n} di ${m}. Riprendi?`,
    RIPRESA_SI: 'Riprendi',
    RIPRESA_NO: 'Chiudi il giro',
    PASSATA: (nome) => `Sei passato da ${nome}?`,
    PASSATA_VISTA: 'Vista',
    PASSATA_SALTA: 'Saltala',
    ARRIVATO: 'Sono arrivato',
    SALTA: 'Salta',
    APRI_MAPPE: 'Apri in Mappe',
});

/**
 * L'avviso da mostrare nella barra, uno alla volta, dal più grave: posizione negata, rete assente, percorso non
 * calcolabile, segnale perso, segnale in attesa. null = niente da dire.
 * @param {{ gps?: 'attesa'|'ok'|'perso'|'negato'|null, attesaVisibile?: boolean, offline?: boolean, percorsoErrore?: boolean }} s
 * @returns {{ tipo: string, testo: string }|null}
 */
export function avvisoNavigazione({ gps = null, attesaVisibile = false, offline = false, percorsoErrore = false } = {}) {
    if (gps === 'negato') return { tipo: 'negato', testo: NAV_TESTI.POSIZIONE_NEGATA };
    if (offline) return { tipo: 'offline', testo: NAV_TESTI.OFFLINE };
    if (percorsoErrore) return { tipo: 'percorso', testo: NAV_TESTI.PERCORSO };
    if (gps === 'perso') return { tipo: 'perso', testo: NAV_TESTI.GPS_PERSO };
    if (gps === 'attesa' && attesaVisibile) return { tipo: 'attesa', testo: NAV_TESTI.GPS_ATTESA };
    return null;
}

/**
 * NAV-1-FIX: Mappe di Apple su iPhone (e iPad: iPadOS si presenta come un Mac, lo tradiscono i punti di contatto),
 * Google Maps altrove.
 */
export const usaMappeApple = (nav = typeof navigator !== 'undefined' ? navigator : null) => {
    const ua = String(nav?.userAgent || '');
    if (/iPhone|iPad|iPod/i.test(ua)) return true;
    return /Macintosh/i.test(ua) && Number(nav?.maxTouchPoints || 0) > 1;
};

/**
 * Il link «Apri in Mappe» verso una tappa: le indicazioni a piedi (in auto se la navigazione è in auto).
 * Solo le coordinate della tappa: nessuna partenza (l'app di mappe usa la posizione del telefono), nessun dato
 * dell'utente. Mappe di Apple su iPhone, Google Maps altrove (`apple` per forzarlo).
 */
export const linkMappe = (tappa, modo = 'walking', { apple = usaMappeApple() } = {}) => {
    const lat = Number(tappa?.latitude ?? tappa?.lat);
    const lng = Number(tappa?.longitude ?? tappa?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    const inAuto = modo === 'driving';
    if (apple) return `https://maps.apple.com/?daddr=${lat},${lng}&dirflg=${inAuto ? 'd' : 'w'}`;
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=${inAuto ? 'driving' : 'walking'}`;
};
