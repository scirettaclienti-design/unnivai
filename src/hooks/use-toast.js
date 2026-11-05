/**
 * DVAI-039 — useToast() reale.
 * Sostituisce lo stub console.log con un sistema toast globale basato su
 * CustomEvent + ToastProvider in App.jsx.
 *
 * Uso:
 *   const { toast } = useToast();
 *   toast({ title: 'Successo!', type: 'success' });
 *   toast({ title: 'Errore', description: 'Dettaglio', type: 'error' });
 *
 * Tipi: 'success' | 'error' | 'warning' | 'info'  (default: 'info')
 */

const TOAST_EVENT = 'dvai:toast';
// Un toast «persistente» resta qui finché ToastProvider non lo mostra: serve quando l'albero si smonta
// subito dopo (l'uscita di signOut passa dalla schermata di caricamento e smonta anche ToastProvider).
const TOAST_IN_ATTESA = 'dvai_toast_in_attesa_v1';

// Gate PULIZIA P2 — il separatore ': ' si aggiunge solo se il titolo non ha
// gia' una punteggiatura finale. Prima produceva ".:" su ogni toast con titolo
// che era una frase compiuta (AiItinerary.jsx:241/268/358, SurpriseTour.jsx:273).
const joinTitleAndDescription = (title, description) => {
    const t = String(title ?? '').trimEnd();
    if (!description) return title;
    return /[.!?:;…]$/.test(t) ? `${t} ${description}` : `${t}: ${description}`;
};

export function useToast() {
    const toast = ({ title, description, type = 'info', duration = 3000, persistente = false }) => {
        const message = joinTitleAndDescription(title, description);
        const detail = { message, type, duration, persistente };
        if (persistente) {
            try { sessionStorage.setItem(TOAST_IN_ATTESA, JSON.stringify(detail)); } catch { /* storage ko: resta l'evento */ }
        }
        window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail }));
    };

    // Shorthand helpers
    toast.success = (msg, opts = {}) => toast({ title: msg, type: 'success', ...opts });
    toast.error   = (msg, opts = {}) => toast({ title: msg, type: 'error',   ...opts });
    toast.warning = (msg, opts = {}) => toast({ title: msg, type: 'warning', ...opts });
    toast.info    = (msg, opts = {}) => toast({ title: msg, type: 'info',    ...opts });

    return { toast };
}

/** Il toast persistente non ancora mostrato (e lo toglie): lo legge ToastProvider quando si monta. */
export function prendiToastInAttesa() {
    try {
        const v = sessionStorage.getItem(TOAST_IN_ATTESA);
        if (!v) return null;
        sessionStorage.removeItem(TOAST_IN_ATTESA);
        return JSON.parse(v);
    } catch { return null; }
}

/** Mostrato: non serve più tenerlo. */
export function toastMostrato() {
    try { sessionStorage.removeItem(TOAST_IN_ATTESA); } catch { /* storage ko */ }
}

export { TOAST_EVENT, TOAST_IN_ATTESA };
