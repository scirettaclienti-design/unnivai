/**
 * LA FRECCIA DI PARTENZA — prima del primo passo: una freccia grande al centro dello schermo punta la direzione FISICA verso la prima tappa.
 * Sparisce (lo decide la pagina, `partenzaCompiuta`) dopo 10 m nel verso giusto. Palette Ossidiana, un solo accento.
 * @param {{ angolo: number|null, nome?: string }} p `angolo` in gradi, in senso orario, 0 = in alto
 */
import { Navigation2 } from 'lucide-react';

export default function FrecciaPartenza({ angolo, nome = null }) {
    if (!Number.isFinite(angolo)) return null;
    return (
        <div data-testid="freccia-partenza" data-angolo={angolo} className="fixed inset-0 z-[60] pointer-events-none flex flex-col items-center justify-center" aria-live="polite">
            <div className="w-40 h-40 rounded-full bg-obsidian-card/80 border border-brand-orange/50 shadow-2xl flex items-center justify-center" style={{ transform: `rotate(${angolo}deg)`, transition: 'transform 300ms ease' }}>
                <Navigation2 size={84} strokeWidth={1.6} className="text-brand-orange fill-brand-orange/25" aria-hidden="true" />
            </div>
            <p className="mt-4 px-4 py-2 rounded-2xl bg-obsidian-card/90 border border-obsidian-border text-obsidian-primary text-sm font-bold text-center max-w-[80%]">
                {nome ? `Parti da qui verso ${nome}` : 'Parti da qui, nella direzione della freccia'}
            </p>
        </div>
    );
}
