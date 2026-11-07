/**
 * ESTETICA-MOVIMENTO — il movimento del marchio (logo, curve di sfondo, camera lenta della home) si ferma da solo:
 * con «riduci movimento» (lo fa il CSS con `prefers-reduced-motion`) e quando la pagina non è visibile
 * (qui: `data-pagina-nascosta` sull'elemento radice, che il CSS legge con `animation-play-state: paused`).
 * Nessuna logica dell'app: solo l'attributo.
 */

/** «Riduci movimento» è acceso? (iOS: Impostazioni › Accessibilità › Movimento). */
export function riduciMovimento(win = typeof window !== 'undefined' ? window : undefined) {
    try {
        return !!win?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    } catch {
        return false;
    }
}

/** Segna sulla radice se la pagina è nascosta; ritorna la funzione che toglie l'ascolto. */
export function inizializzaMovimento(doc = typeof document !== 'undefined' ? document : undefined) {
    if (!doc?.documentElement) return () => {};
    const aggiorna = () => {
        if (doc.visibilityState === 'hidden') doc.documentElement.setAttribute('data-pagina-nascosta', '');
        else doc.documentElement.removeAttribute('data-pagina-nascosta');
    };
    aggiorna();
    doc.addEventListener('visibilitychange', aggiorna);
    return () => doc.removeEventListener('visibilitychange', aggiorna);
}
