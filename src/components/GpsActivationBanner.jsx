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
                setFeedback({ type: 'success', message: `Posizione trovata: ${city}` });
                setTimeout(() => setFeedback(null), 3000);
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
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-2xl p-3 text-green-700 text-sm font-medium">
                    <span>✅</span> {feedback.message}
                </div>
            ) : feedback?.type === 'error' ? (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3">
                    <p className="text-amber-700 text-xs font-medium mb-2">⚠️ {feedback.message}</p>
                    <p className="text-amber-600 text-xs">Seleziona una città manualmente dall'header.</p>
                </div>
            ) : (
                <button
                    onClick={handleClick}
                    disabled={isLoading}
                    className="w-full flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-2xl p-4 text-left active:scale-[0.98] transition-transform disabled:opacity-70"
                >
                    <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center shrink-0">
                        {isLoading ? (
                            <Loader className="w-5 h-5 text-white animate-spin" />
                        ) : (
                            <MapPin className="w-5 h-5 text-white" />
                        )}
                    </div>
                    <div className="flex-1">
                        <p className="text-sm font-bold text-blue-800">
                            {isLoading ? 'Ricerca posizione...' : 'Attiva la tua posizione'}
                        </p>
                        <p className="text-xs text-blue-600">Per tour personalizzati nella tua zona</p>
                    </div>
                    {!isLoading && <ChevronRight className="w-5 h-5 text-blue-400" />}
                </button>
            )}
        </div>
    );
}
