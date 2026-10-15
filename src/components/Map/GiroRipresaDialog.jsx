/**
 * NAV-1 — «Hai un giro in corso: tappa N di M. Riprendi?» (testi di Ivano, navMessaggi).
 * Presenter puro: lo usano la mappa (dopo una ricarica) e GiroInCorso (all'apertura dell'app).
 */
import { motion } from 'framer-motion';
import { Navigation } from 'lucide-react';
import { NAV_TESTI } from '../../lib/navMessaggi';

export default function GiroRipresaDialog({ n, m, onRiprendi, onChiudi }) {
    return (
        <motion.div
            role="dialog"
            aria-modal="true"
            data-testid="nav-ripresa"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="fixed left-3 right-3 z-[80] max-w-md mx-auto font-sans"
            style={{ bottom: 'max(1rem, env(safe-area-inset-bottom))' }}
        >
            <div className="bg-obsidian-card rounded-[28px] border border-obsidian-border shadow-2xl p-4">
                <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 bg-obsidian-raised border border-obsidian-border text-brand-orange">
                        <Navigation size={20} />
                    </div>
                    <p className="flex-1 text-sm font-semibold text-obsidian-primary leading-snug pt-1">
                        {NAV_TESTI.RIPRESA(n, m)}
                    </p>
                </div>
                <div className="flex gap-2 mt-3">
                    <button
                        onClick={onRiprendi}
                        className="flex-1 py-2 rounded-full text-sm font-semibold bg-brand-orange text-obsidian-bg active:scale-95 transition-transform"
                    >
                        {NAV_TESTI.RIPRESA_SI}
                    </button>
                    <button
                        onClick={onChiudi}
                        className="flex-1 py-2 rounded-full text-sm font-medium bg-obsidian-raised text-obsidian-primary border border-obsidian-border active:scale-95 transition-transform"
                    >
                        {NAV_TESTI.RIPRESA_NO}
                    </button>
                </div>
            </div>
        </motion.div>
    );
}
