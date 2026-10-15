/**
 * NAV-1 — lo schermo resta acceso durante la navigazione (Screen Wake Lock), dove il browser lo permette.
 * Dove non lo permette (API assente, rifiuto, batteria scarica) non succede niente: nessun errore, nessun messaggio.
 * iOS rilascia il blocco quando la pagina va in background: al ritorno in primo piano si richiede.
 */
export function creaSchermoAcceso({ nav = typeof navigator !== 'undefined' ? navigator : null, doc = typeof document !== 'undefined' ? document : null } = {}) {
    let sentinel = null;
    let attivo = false;
    const richiedi = async () => {
        if (!attivo || !nav?.wakeLock?.request) return;
        if (doc && doc.visibilityState && doc.visibilityState !== 'visible') return;
        try {
            sentinel = await nav.wakeLock.request('screen');
            sentinel?.addEventListener?.('release', () => { sentinel = null; });
        } catch { sentinel = null; /* niente: lo schermo si spegne come sempre */ }
    };
    const suVisibilita = () => { if (attivo && !sentinel) richiedi(); };
    return {
        supportato: () => !!nav?.wakeLock?.request,
        attivo: () => !!sentinel,
        async attiva() {
            if (attivo) return;
            attivo = true;
            doc?.addEventListener?.('visibilitychange', suVisibilita);
            await richiedi();
        },
        async rilascia() {
            attivo = false;
            doc?.removeEventListener?.('visibilitychange', suVisibilita);
            const s = sentinel;
            sentinel = null;
            try { await s?.release?.(); } catch { /* niente */ }
        },
    };
}
