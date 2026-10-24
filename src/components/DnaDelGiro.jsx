/**
 * Il riquadro «Il tuo DNA esplorativo» di un giro: le righe vere di `righeDnaDelGiro`, nient'altro. Senza righe non compare.
 * Palette Ossidiana: fondo sollevato, testo primario, un solo accento.
 */
import { Dna } from 'lucide-react';

export default function DnaDelGiro({ righe = [], className = '' }) {
    if (!Array.isArray(righe) || righe.length === 0) return null;
    return (
        <div data-testid="dna-del-giro" className={`bg-obsidian-raised rounded-2xl p-4 border border-obsidian-border ${className}`}>
            <h3 className="text-xs font-bold text-obsidian-secondary uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <Dna size={13} className="text-brand-orange" aria-hidden="true" />
                Il tuo DNA esplorativo
            </h3>
            <ul className="space-y-1.5">
                {righe.map((r) => (
                    <li key={r} data-dna-riga className="text-sm font-semibold text-obsidian-primary leading-snug">{r}</li>
                ))}
            </ul>
        </div>
    );
}
