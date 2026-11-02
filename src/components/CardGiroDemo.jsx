// APP-NATIVA — la scheda del giro dimostrativo nella home. Solo l'account demo del revisore Apple la vede
// (isDemoRevisore: app_metadata scritto dal server); per ogni altro utente non c'è, né sul web né nell'app.
import { useNavigate } from 'react-router-dom';
import { MapPin, ChevronRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { isDemoRevisore } from '../lib/demoRevisore';
import { GIRO_DEMO } from '../data/giroDemo';
import { TESTI_APP_NATIVA as T } from '../lib/testiAppNativa';

export default function CardGiroDemo() {
    const auth = useAuth();
    const navigate = useNavigate();
    if (!isDemoRevisore(auth?.user)) return null;
    return (
        <button
            type="button"
            data-testid="card-giro-demo"
            onClick={() => navigate('/map', { state: { tourData: GIRO_DEMO, isAiGenerated: true } })}
            className="w-full text-left bg-obsidian-card border border-brand-orange/40 rounded-3xl p-5 shadow-lg flex items-center justify-between gap-4"
        >
            <div className="flex items-center gap-4">
                <div className="bg-brand-orange text-obsidian-bg p-3 rounded-2xl"><MapPin className="w-7 h-7" /></div>
                <div>
                    <h3 className="text-lg font-bold text-obsidian-primary leading-tight">{T.DEMO_TITOLO}</h3>
                    <p className="text-obsidian-secondary text-xs mt-1">{T.DEMO_RIGA}</p>
                    <p className="text-obsidian-secondary text-xs mt-0.5">{T.DEMO_COME}</p>
                    <span className="sr-only">{T.DEMO_APRI}</span>
                </div>
            </div>
            <ChevronRight className="w-5 h-5 text-brand-orange shrink-0" />
        </button>
    );
}
