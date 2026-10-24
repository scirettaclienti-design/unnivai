/**
 * NAV-1 — i messaggi della navigazione (testi di Ivano, alla lettera: non si cambiano qui).
 * Mai un codice d'errore inglese a schermo: un errore di Google Directions diventa PERCORSO.
 */
export const NAV_TESTI = Object.freeze({
    GPS_ATTESA: 'Cerco il segnale. Intanto segui la mappa: le tappe si sbloccano appena ti trovo.',
    GPS_PERSO: 'Ho perso il segnale. Continua pure: quando torna, riparto da dove sei.',
    POSIZIONE_NEGATA: 'Senza posizione non posso guidarti. Attivala in Impostazioni › Safari › Posizione, oppure segna le tappe a mano.',
    OFFLINE: 'Sei offline. La mappa resta; il percorso si aggiorna quando torna la rete.',
    // NAV-2: l'utente resta in Unnivai, niente invio verso altre app (il testo di NAV-1 mandava a Mappe: da approvare)
    PERCORSO: 'Non riesco a calcolare il percorso fin qui. Intanto segui la mappa o passa alla tappa dopo.',
    RIPRESA: (n, m) => `Hai un giro in corso: tappa ${n} di ${m}. Riprendi?`,
    RIPRESA_SI: 'Riprendi',
    RIPRESA_NO: 'Chiudi il giro',
    PASSATA: (nome) => `Sei passato da ${nome}?`,
    PASSATA_VISTA: 'Vista',
    PASSATA_SALTA: 'Saltala',
    ARRIVATO: 'Sono arrivato',
    SALTA: 'Salta',
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
