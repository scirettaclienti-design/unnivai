// APP-NATIVA — il tasto «Simula il cammino» del giro dimostrativo. Lo monta MapPage solo per l'account demo
// del revisore Apple con il giro demo (giroDemoAttivo): nessun altro lo vede.
import { useEffect, useState } from 'react';
import { TESTI_APP_NATIVA as T } from '../../lib/testiAppNativa';

export default function SimulaCammino({ cammino }) {
    const [stato, setStato] = useState(() => cammino?.stato?.() || 'fermo');
    useEffect(() => cammino?.suCambio?.(setStato), [cammino]);
    if (!cammino) return null;
    const finito = stato === 'finito';
    const inMoto = stato === 'cammina' || stato === 'sosta';
    const etichetta = finito ? T.SIMULA_FINE : stato === 'sosta' ? T.SIMULA_SOSTA : inMoto ? T.SIMULA_PAUSA : T.SIMULA_AVVIA;
    return (
        <button
            type="button"
            data-testid="simula-cammino"
            disabled={finito}
            onClick={() => (inMoto ? cammino.pausa() : cammino.avvia())}
            className="fixed left-3 z-[65] min-h-[44px] px-4 rounded-[22px] bg-obsidian-card border border-obsidian-border text-white text-sm font-semibold shadow-xl disabled:opacity-60 flex items-center gap-2"
            style={{ top: '42%' }}
        >
            <span aria-hidden="true" className={`w-2.5 h-2.5 rounded-full ${inMoto ? 'bg-brand-orange animate-pulse' : 'bg-brand-orange'}`} />
            {etichetta}
        </button>
    );
}
