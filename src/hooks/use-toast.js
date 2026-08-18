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

// Gate PULIZIA P2 — il separatore ': ' si aggiunge solo se il titolo non ha
// gia' una punteggiatura finale. Prima produceva ".:" su ogni toast con titolo
// che era una frase compiuta (AiItinerary.jsx:241/268/358, SurpriseTour.jsx:273).
const joinTitleAndDescription = (title, description) => {
    const t = String(title ?? '').trimEnd();
    if (!description) return title;
    return /[.!?:;…]$/.test(t) ? `${t} ${description}` : `${t}: ${description}`;
};

export function useToast() {
    const toast = ({ title, description, type = 'info', duration = 3000 }) => {
        const message = joinTitleAndDescription(title, description);
        window.dispatchEvent(
            new CustomEvent(TOAST_EVENT, { detail: { message, type, duration } })
        );
    };

    // Shorthand helpers
    toast.success = (msg, opts = {}) => toast({ title: msg, type: 'success', ...opts });
    toast.error   = (msg, opts = {}) => toast({ title: msg, type: 'error',   ...opts });
    toast.warning = (msg, opts = {}) => toast({ title: msg, type: 'warning', ...opts });
    toast.info    = (msg, opts = {}) => toast({ title: msg, type: 'info',    ...opts });

    return { toast };
}

export { TOAST_EVENT };
