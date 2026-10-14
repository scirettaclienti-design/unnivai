/**
 * NAV-1 — il tracciamento della navigazione: parte SEMPRE e non si spegne da solo.
 *
 * Prima (NAV-DIAGNOSI, B1): il `watchPosition` partiva solo se il primo `getCurrentPosition` rispondeva entro 5 s; un
 * primo fix lento (comune su iPhone al chiuso o a freddo) lasciava la navigazione senza GPS per tutto il giro.
 * Ora:
 *   - il `watchPosition` parte subito, ad alta precisione;
 *   - stato `attesa` finché non arriva una posizione (dopo `primoFixMs` lo si dice: `onPrimoFixMancato`);
 *   - una posizione → `ok`, anche dopo minuti: le tappe si sbloccano normalmente;
 *   - errore «permesso negato» → `negato` (nessun nuovo tentativo: lo decide l'utente);
 *   - altri errori (timeout, posizione non disponibile) → il watch si riavvia dopo `riprovaMs`; lo stato non cambia
 *     (`perso` lo decide solo il silenzio: chi sta fermo può ricevere un timeout senza aver perso il segnale);
 *   - nessuna posizione da `persoMs` → `perso`; in attesa da `persoMs` senza risposta → il watch si riavvia
 *     (su iOS a volte non arriva né la posizione né l'errore);
 *   - la pagina torna in primo piano → il watch si riavvia (iOS lo sospende in background), anche dopo un `negato`:
 *     chi ha attivato la posizione in Impostazioni e torna su Safari riparte senza ricaricare.
 * Le dipendenze (geolocation, orologio, timer, document) si passano: il modulo si prova senza browser.
 */
export const NAV_GPS = Object.freeze({ PRIMO_FIX_MS: 5000, PERSO_MS: 30000, RIPROVA_MS: 5000, CONTROLLO_MS: 5000 });
const OPZIONI_WATCH = { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 };

export function avviaTracciamento({
    geolocation,
    onPosizione,
    onStato = () => {},
    onPrimoFixMancato = () => {},
    primoFixMs = NAV_GPS.PRIMO_FIX_MS,
    persoMs = NAV_GPS.PERSO_MS,
    riprovaMs = NAV_GPS.RIPROVA_MS,
    controlloMs = NAV_GPS.CONTROLLO_MS,
    now = () => Date.now(),
    // Avvolti: Safari lancia «Can only call Window.setInterval on instances of Window» se si chiamano come metodi
    // di un altro oggetto (trovato dalla prova WebKit di NAV-1).
    timers = {
        setTimeout: (f, ms) => setTimeout(f, ms),
        clearTimeout: (id) => clearTimeout(id),
        setInterval: (f, ms) => setInterval(f, ms),
        clearInterval: (id) => clearInterval(id),
    },
    doc = typeof document !== 'undefined' ? document : null,
} = {}) {
    let stato = null;
    let watchId = null;
    let fermo = false;
    let primoFix = false;
    let ultimoFix = null;
    let avviatoA = now();
    let riprova = null;
    const imposta = (s) => {
        if (s === stato) return;
        stato = s;
        try { onStato(s); } catch { /* la UI non ferma il tracciamento */ }
    };
    const pulisciWatch = () => {
        if (watchId != null) { try { geolocation.clearWatch(watchId); } catch { /* niente */ } }
        watchId = null;
    };
    const avviaWatch = () => {
        if (fermo || !geolocation) return;
        pulisciWatch();
        avviatoA = now();
        try {
            watchId = geolocation.watchPosition(suPosizione, suErrore, OPZIONI_WATCH);
        } catch {
            programmaRiprova();
        }
    };
    const programmaRiprova = () => {
        if (fermo || riprova) return;
        riprova = timers.setTimeout(() => { riprova = null; avviaWatch(); }, riprovaMs);
    };
    function suPosizione(pos) {
        if (fermo) return;
        const primo = !primoFix;
        primoFix = true;
        ultimoFix = now();
        imposta('ok');
        try { onPosizione(pos, { primo }); } catch (e) { console.warn('[NAV] posizione non elaborata:', e?.message || e); }
    }
    function suErrore(err) {
        if (fermo) return;
        if (err?.code === 1) {
            imposta('negato');
            pulisciWatch();
            return;
        }
        pulisciWatch();
        programmaRiprova();
    }
    const controllo = timers.setInterval(() => {
        if (fermo || stato === 'negato') return;
        const t = now();
        if (primoFix && stato === 'ok' && t - ultimoFix > persoMs) imposta('perso');
        // nessuna risposta (né posizione né errore) da troppo: si riavvia il watch
        const ultimaNotizia = primoFix ? Math.max(ultimoFix, avviatoA) : avviatoA;
        if (t - ultimaNotizia > persoMs) avviaWatch();
    }, controlloMs);
    const primoTimer = timers.setTimeout(() => {
        if (!fermo && !primoFix && stato !== 'negato') {
            try { onPrimoFixMancato(); } catch { /* niente */ }
        }
    }, primoFixMs);
    const suVisibilita = () => { if (doc?.visibilityState === 'visible') avviaWatch(); };
    doc?.addEventListener?.('visibilitychange', suVisibilita);

    imposta('attesa');
    avviaWatch();

    return {
        stato: () => stato,
        haFix: () => primoFix,
        stop() {
            fermo = true;
            pulisciWatch();
            timers.clearInterval(controllo);
            timers.clearTimeout(primoTimer);
            if (riprova) timers.clearTimeout(riprova);
            doc?.removeEventListener?.('visibilitychange', suVisibilita);
        },
    };
}
