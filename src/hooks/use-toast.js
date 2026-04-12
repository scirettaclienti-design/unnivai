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

export function useToast() {
    const toast = ({ title, description, type = 'info', duration = 3000 }) => {
        const message = description ? `${title}: ${description}` : title;
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
