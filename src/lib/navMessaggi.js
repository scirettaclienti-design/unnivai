/**
 * NAV-1 — i messaggi della navigazione (testi di Ivano, alla lettera: non si cambiano qui).
 * Mai un codice d'errore inglese a schermo: un errore di Google Directions diventa PERCORSO.
 */
export const NAV_TESTI = Object.freeze({
    GPS_ATTESA: 'Cerco il segnale. Intanto segui la mappa: le tappe si sbloccano appena ti trovo.',
    PARTENZA_VERSO: (nome) => (nome ? `Parti da qui verso ${nome}` : 'Parti da qui, nella direzione della freccia'),
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
    // fine giro dopo «Salta»: i numeri sono quelli di dove sei arrivato davvero
    FINE_FIN_DOVE: (n, tot) => (n === 0 ? 'Hai saltato tutte le tappe: il giro finisce qui.' : `Sei arrivato a ${n} ${n === 1 ? 'tappa' : 'tappe'} su ${tot}.`),
    ARRIVATO: 'Sono arrivato',
    SALTA: 'Salta',
    // NAV-MAPPA: la scheda compatta (tasti a icona con etichetta accessibile) e le impostazioni del giro
    PAUSA: 'Pausa',
    RIPRENDI: 'Riprendi',
    SALTA_TAPPA: 'Salta tappa',
    IMPOSTAZIONI: 'Impostazioni del giro',
    CHIUDI: 'Chiudi',
    // NAV-TESTI-TAPPA
    RIPARTI: 'Riparti',
    AVANTI: 'Avanti',
    RIPARTI_VERSO: (min, versoNome) => `Riparti · ${min ? `${min} min ` : ''}${versoNome}`,
    LA_MIA_POSIZIONE: 'Vai alla mia posizione',
    // GIRO-LONTANO: da più di 20 km dalla tappa 1 la guida non parte (niente navigazione verso un punto a centinaia di km)
    LONTANO_AVVIA: (km, citta) => `Sei a ${km} km da ${citta || 'questo giro'}: la guida parte quando sei lì.`,
    LONTANO_CAMMINO: 'Il cammino conta solo fra le tappe.',
    // la partenza di un giro di Crea guardato da lontano (domani alle 9:30) e il tasto per scegliere un altro momento
    PARTENZA_DOMANI: 'Domani · 9:30',
    PARTENZA_CAMBIA: 'cambia',
    PARTENZA_CAMBIA_ETICHETTA: 'Cambia quando parti: scrivilo nella richiesta (per esempio «sabato alle 10»)',
    ESPANDI: 'Mostra i dettagli della tappa',
    COMPRIMI: 'Nascondi i dettagli della tappa',
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
