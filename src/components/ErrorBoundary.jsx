/**
 * Gate GG (16/07) — ErrorBoundary con reload chunk-load + reporting reale.
 *
 * Prima: qualunque errore -> schermata rossa con stack tecnico + "Il team
 * tecnico e' stato notificato" (BUGIA — nessuno riceveva niente, solo
 * console.error).
 *
 * Ora:
 *  1. Chunk-load / MIME-error dopo deploy -> reload automatico UNA volta.
 *     Flag dvai_chunk_reload_attempted in sessionStorage anti-loop: se il
 *     reload non risolve, mostra la schermata (allora e' un bug vero, non
 *     stale cache).
 *  2. reportError() a Supabase public.error_logs — la frase "team tecnico
 *     e' stato notificato" e' ora VERA.
 *  3. Zero stack tecnico esposto in UI. Copy umano. Lo stack e' nei log
 *     (console + tabella error_logs). Stessa regola del GPS in inglese di
 *     Gate W: dettaglio tecnico nei log, messaggio umano in interfaccia.
 */

import React from 'react';
import { reportError, classifyError } from '@/lib/errorReporting';

const CHUNK_RELOAD_FLAG = 'dvai_chunk_reload_attempted';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, errorType: 'generic' };
    }

    static getDerivedStateFromError(error) {
        // Classifica subito qui: se e' chunk_load, componentDidCatch fara'
        // il reload automatico (una volta) prima che la fallback UI compaia.
        return { hasError: true, errorType: classifyError(error) };
    }

    componentDidCatch(error, errorInfo) {
        // Log tecnico sempre (dev + prod). Il messaggio esposto all'utente
        // e' un altro (vedi render()).
        console.error('[ErrorBoundary]', error, errorInfo);

        // Riporta a Supabase (fire-and-forget, non blocca la UI).
        reportError(error, {
            componentStack: errorInfo?.componentStack?.slice(0, 2000) || null,
            errorType: this.state.errorType,
        });

        // Chunk-load: l'app e' stata deployata mentre l'utente aveva la
        // pagina aperta. Un reload prende i chunk nuovi. Facciamo il reload
        // UNA volta: se dopo il reload l'errore persiste, e' un bug vero
        // (non stale cache), e mostriamo la fallback UI normalmente.
        if (this.state.errorType === 'chunk_load') {
            try {
                if (sessionStorage.getItem(CHUNK_RELOAD_FLAG)) {
                    // Gia' provato: non entrare in loop. Fallback UI mostrata.
                    return;
                }
                sessionStorage.setItem(CHUNK_RELOAD_FLAG, String(Date.now()));
                // Reload silenzioso. L'utente vede un lampo, non la schermata rossa.
                window.location.reload();
            } catch {
                /* sessionStorage bloccato (private mode strict) → fallback UI */
            }
        }
    }

    componentDidMount() {
        // Se questo boundary monta senza errori, il reload precedente ha
        // funzionato: pulisci il flag cosi' il prossimo chunk-load in futuro
        // avra' di nuovo il suo reload disponibile.
        try {
            if (sessionStorage.getItem(CHUNK_RELOAD_FLAG)) {
                sessionStorage.removeItem(CHUNK_RELOAD_FLAG);
            }
        } catch { /* private mode strict */ }
    }

    handleGoHome = () => {
        window.location.href = '/';
    };

    handleRetry = () => {
        window.location.reload();
    };

    render() {
        if (!this.state.hasError) return this.props.children;

        // Chunk-load in corso di reload: schermata neutra di caricamento,
        // non l'errore rosso. Il reload sta per accadere in componentDidCatch;
        // qui evitiamo il flash della schermata di errore.
        if (this.state.errorType === 'chunk_load') {
            let alreadyReloaded = false;
            try {
                alreadyReloaded = !!sessionStorage.getItem(CHUNK_RELOAD_FLAG);
            } catch { /* private mode */ }
            if (!alreadyReloaded) {
                return (
                    <div className="min-h-screen flex items-center justify-center bg-gray-50">
                        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                );
            }
            // Se siamo qui, reload gia' tentato e non ha risolto. Cadi
            // nella schermata errore generica sotto.
        }

        // Fallback UI umano. Nessun stack, nessun toString(). Il dettaglio
        // tecnico e' gia' nei log (console + error_logs Supabase).
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6 text-center">
                <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border border-gray-100">
                    <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="12" />
                            <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold text-gray-800 mb-2">Qualcosa non ha funzionato</h1>
                    <p className="text-gray-500 mb-6">
                        Non siamo riusciti a caricare questa schermata. L'errore è stato registrato
                        e lo guardiamo. Riprova, o torna alla home.
                    </p>
                    <div className="space-y-3">
                        <button
                            onClick={this.handleRetry}
                            className="w-full py-3 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-600 transition"
                        >
                            Riprova
                        </button>
                        <button
                            onClick={this.handleGoHome}
                            className="w-full py-3 bg-white text-gray-600 border border-gray-200 rounded-xl font-bold hover:bg-gray-50 transition"
                        >
                            Torna alla home
                        </button>
                    </div>
                </div>
            </div>
        );
    }
}

export default ErrorBoundary;
