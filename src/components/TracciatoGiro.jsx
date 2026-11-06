/** PROFILO-SEZIONI — il tracciato disegnato di un giro (lo stesso della fine giro): 0 $, nessuna rete. In «Rivivi» sta nelle schede dell'elenco. */
import { tracciatoSvg } from '@/lib/navGuida';
import { TESTI_PROFILO as T } from '@/lib/testiAccount';

export function TracciatoGiro({ tappe = [], larghezza = 320, altezza = 190, raggio = 9, numeri = true, className = 'w-full h-auto' }) {
    const punti = tracciatoSvg(tappe, larghezza, altezza, raggio + 12);
    if (punti.length === 0) return null;
    return (
        <svg viewBox={`0 0 ${larghezza} ${altezza}`} className={className} role="img" aria-label={T.TRACCIATO_ARIA} data-testid="rivivi-tracciato">
            {punti.length > 1 && <polyline points={punti.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="var(--brand-orange)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" opacity="0.9" />}
            {punti.map((p, i) => (
                <g key={i}>
                    <circle cx={p.x} cy={p.y} r={raggio} fill="var(--obsidian-card)" stroke="var(--brand-orange)" strokeWidth="2" />
                    {numeri && <text x={p.x} y={p.y + 3.5} textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--text-primary)">{i + 1}</text>}
                </g>
            ))}
        </svg>
    );
}
