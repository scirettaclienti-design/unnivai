import { useState } from 'react';
import { MapPin, Loader, ChevronRight } from 'lucide-react';
import { useCity } from '../context/CityContext';

export default function GpsActivationBanner() {
    const { gpsActive, requestGPS } = useCity();
    const [isLoading, setIsLoading] = useState(false);
    const [feedback, setFeedback] = useState(null); // { type: 'success'|'error', message }

    if (gpsActive) return null; // GPS già attivo — nascondi banner

    const handleClick = () => {
        setIsLoading(true);
        setFeedback(null);

        requestGPS(
            (city) => {
                setIsLoading(false);
                // Gate X.3: city puo' essere null se reverse geocode e' fallito
                // (coordinate GPS OK, ma nessun nome citta' risolto). Copy onesto.
                const message = city
                    ? `Posizione trovata: ${city}`
                    : 'Posizione trovata, ma non riesco a leggere il nome della citta\'. Scegli la citta\' dall\'header.';
                setFeedback({ type: city ? 'success' : 'error', message });
                setTimeout(() => setFeedback(null), city ? 3000 : 5000);
            },
            (errorMsg) => {
                setIsLoading(false);
                setFeedback({ type: 'error', message: errorMsg });
            }
        );
    };

    return (
        <div className="w-full">
            {feedback?.type === 'success' ? (
                <div className="flex items-center gap-2 bg-obsidian-card border border-obsidian-border rounded-2xl p-3 text-obsidian-primary text-sm font-medium">
                    <MapPin className="w-4 h-4 text-brand-orange inline shrink-0" />
                    <span>{feedback.message}</span>
                </div>
            ) : feedback?.type === 'error' ? (
                <div className="bg-obsidian-card border border-brand-orange/30 rounded-2xl p-3">
                    <p className="text-brand-orange text-xs font-semibold mb-1">Posizione non disponibile</p>
                    <p className="text-obsidian-secondary text-xs">{feedback.message}. Puoi selezionare la città dall'header in alto.</p>
                </div>
            ) : (
                <button
                    onClick={handleClick}
                    disabled={isLoading}
                    className="w-full flex items-center gap-3 bg-obsidian-card border border-obsidian-border hover:border-brand-orange/40 rounded-2xl p-4 text-left active:scale-[0.98] transition-all disabled:opacity-70 group"
                >
                    <div className="w-10 h-10 rounded-xl bg-obsidian-raised border border-brand-orange/30 flex items-center justify-center shrink-0 text-brand-orange">
                        {isLoading ? (
                            <Loader className="w-5 h-5 text-brand-orange animate-spin" />
                        ) : (
                            <MapPin className="w-5 h-5 text-brand-orange" />
                        )}
                    </div>
                    <div className="flex-1">
                        <p className="text-sm font-bold text-obsidian-primary group-hover:text-brand-orange transition-colors">
                            {isLoading ? 'Ricerca posizione...' : 'Attiva la tua posizione'}
                        </p>
                        <p className="text-xs text-obsidian-secondary">Per tour personalizzati nella tua zona</p>
                    </div>
                    {!isLoading && <ChevronRight className="w-5 h-5 text-obsidian-secondary group-hover:text-brand-orange group-hover:translate-x-0.5 transition-all" />}
                </button>
            )}
        </div>
    );
}
