/**
 * DVAI-042 — Pagina 404
 * Route catch-all per URL non validi.
 */
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, Map, Compass } from 'lucide-react';

export default function NotFound() {
    return (
        <div className="min-h-screen bg-obsidian-bg flex flex-col items-center justify-center px-4 text-center">
            <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="max-w-sm w-full"
            >
                {/* Illustrazione */}
                <div className="text-8xl mb-6">🗺️</div>
                <h1 className="text-6xl font-black text-brand-orange mb-2">404</h1>
                <h2 className="text-2xl font-bold text-obsidian-primary mb-3">Pagina non trovata</h2>
                <p className="text-obsidian-secondary mb-8 leading-relaxed">
                    Sembra che tu ti sia perso tra i vicoli di Roma.<br />
                    Non preoccuparti — le guide migliori non esistono senza qualche deviazione!
                </p>

                <div className="flex flex-col gap-3">
                    <Link
                        to="/dashboard-user"
                        className="flex items-center justify-center gap-2 py-3.5 bg-brand-orange hover:bg-brand-orange-hover text-obsidian-bg font-bold rounded-2xl shadow-lg transition-all"
                    >
                        <Home className="w-5 h-5" />
                        Torna alla Home
                    </Link>
                    <Link
                        to="/explore"
                        className="flex items-center justify-center gap-2 py-3.5 bg-obsidian-card text-brand-orange font-bold rounded-2xl border border-obsidian-border hover:bg-obsidian-raised transition-all"
                    >
                        <Compass className="w-5 h-5" />
                        Esplora i Tour
                    </Link>
                    <Link
                        to="/map"
                        className="flex items-center justify-center gap-2 py-3.5 bg-obsidian-card text-obsidian-primary font-semibold rounded-2xl border border-obsidian-border hover:bg-obsidian-raised transition-all"
                    >
                        <Map className="w-5 h-5" />
                        Apri la Mappa
                    </Link>
                </div>
            </motion.div>
        </div>
    );
}
