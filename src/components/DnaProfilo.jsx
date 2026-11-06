/**
 * DNA-6 — «Il tuo DNA» nel Profilo: i pesi veri (dal registro), in parole semplici, e la correzione
 * per categoria («più di questo», «meno di questo», «azzera»). Una correzione e' una riga in piu' nel
 * registro, non una cancellazione: la scheda si ricalcola solo se il server l'ha scritta.
 */

import { useState } from 'react';
import { Check, Minus, Plus } from 'lucide-react';
import { fraseDna, livelloPeso, ETICHETTE_CATEGORIA } from '../lib/dnaProfilo';
import { TESTI_DNA_PROFILO as T } from '../lib/dnaDelGiro';
import { gradinoFiducia } from '../lib/fasciaDna';
import { CORE_CATEGORIES } from '../services/preferenceEngine';
import { SchedaProfilo } from './profilo/SchedaProfilo';

const pct = (peso) => Math.round((Number(peso) || 0) * 100);
const TASTO = 'w-11 h-11 flex items-center justify-center rounded-2xl bg-obsidian-raised border border-obsidian-border text-obsidian-primary hover:border-brand-orange disabled:opacity-50 cursor-pointer';

/** La riga sotto il gusto appena corretto: l'esito e, se e' salvato, il numero che si e' mosso. */
function EsitoRiga({ esito, peso }) {
    const dopo = pct(peso);
    const mosso = esito.ok && esito.prima !== dopo;
    const fermo = esito.ok && !mosso && esito.azione !== 'azzera' ? (esito.azione === 'meno' ? T.fermoAZero : T.fermoAlMassimo) : null;
    return (
        <div role="status" aria-live="polite" className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-medium">
            {esito.ok && <Check className="w-3.5 h-3.5 text-brand-orange shrink-0" aria-hidden="true" />}
            <span className={esito.ok ? 'text-obsidian-primary' : 'text-brand-orange'} data-testid="dna-esito">{esito.testo}</span>
            {mosso && <span className="font-etichetta text-brand-orange" data-testid="dna-esito-numeri">{T.numeri(esito.prima, dopo)}</span>}
            {fermo && <span className="text-obsidian-secondary" data-testid="dna-esito-fermo">{fermo}</span>}
        </div>
    );
}

export default function DnaProfilo({ pesi, eventi = 0, ritmo = null, compagnia = null, fiducia = 0, puoCorreggere = false, onCorreggi }) {
    const [inCorso, setInCorso] = useState(null);   // `${categoria}:${azione}` mentre si scrive
    const [esito, setEsito] = useState(null);       // { ok, testo, categoria?, azione?, prima? }
    const [chiediAzzeraTutto, setChiediAzzeraTutto] = useState(false);
    // dalla prima correzione l'ordine resta fermo: la riga che stai toccando non deve scappare da sotto il dito
    const [ordineFermo, setOrdineFermo] = useState(null);

    const { frasi } = fraseDna(pesi, ritmo, compagnia);
    const righe = CORE_CATEGORIES
        .map((categoria, i) => ({ categoria, peso: Number(pesi?.[categoria]) || 0, i }))
        .sort((a, b) => (ordineFermo
            ? ordineFermo.indexOf(a.categoria) - ordineFermo.indexOf(b.categoria)
            : (b.peso - a.peso) || (a.i - b.i)));
    const massimo = Math.max(...righe.map(r => r.peso));

    const correggi = async (categoria, azione) => {
        if (!puoCorreggere || inCorso) return;
        setOrdineFermo(righe.map(r => r.categoria));
        const prima = pct(pesi?.[categoria]);
        setInCorso(`${categoria}:${azione}`);
        setEsito(null);
        const r = await onCorreggi(categoria, azione);
        setInCorso(null);
        const nome = (ETICHETTE_CATEGORIA[categoria] || categoria).toLowerCase();
        setEsito(r?.ok
            ? { ok: true, testo: T.fatto[azione](nome), categoria, azione, prima }
            : { ok: false, testo: T.nonSalvata, categoria });
    };

    const azzeraTutto = async () => {
        if (!puoCorreggere || inCorso) return;
        if (!chiediAzzeraTutto) { setChiediAzzeraTutto(true); return; }
        setChiediAzzeraTutto(false);
        setInCorso('tutto:azzera');
        setEsito(null);
        let tutte = true;
        for (const { categoria, peso } of righe) {
            if (peso <= 0) continue;
            const r = await onCorreggi(categoria, 'azzera');
            if (!r?.ok) { tutte = false; break; }
        }
        setInCorso(null);
        setEsito({ ok: tutte, testo: tutte ? T.azzerato : T.nonAzzerato });
    };

    const haPesi = righe.some(r => r.peso > 0);

    return (
        <SchedaProfilo data-testid="dna-profilo" etichetta={T.etichetta} titolo={T.titolo}>
            <div>
                {frasi.length > 0 ? (
                    <p className="text-[15px] text-obsidian-primary leading-relaxed" data-testid="dna-frasi">{frasi.join(' ')}</p>
                ) : (
                    <p className="text-sm text-obsidian-secondary">{T.formazione}</p>
                )}
                {eventi > 0 && <p className="text-xs text-obsidian-secondary mt-1.5">{T.gesti(eventi)}</p>}
                <p className="text-xs text-obsidian-primary mt-1.5" data-testid="dna-fiducia">{T.fiducia[gradinoFiducia(fiducia)]}</p>
            </div>

            <div className="rounded-2xl bg-obsidian-bg border border-obsidian-border px-3.5 py-3 space-y-1.5 text-xs leading-snug text-obsidian-secondary" data-testid="dna-legenda">
                <p>{T.comeSiLegge}</p>
                {puoCorreggere && <p>{T.comeCorreggi}</p>}
            </div>

            <ul className="divide-y divide-obsidian-border">
                {righe.map(({ categoria, peso }) => {
                    const nome = ETICHETTE_CATEGORIA[categoria] || categoria;
                    const liv = livelloPeso(peso);
                    return (
                        <li key={categoria} className="py-3 first:pt-0 last:pb-0" data-testid={`dna-${categoria}`}>
                            <div className="flex items-center gap-3">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-baseline justify-between gap-2">
                                        <span className="text-sm font-semibold text-obsidian-primary truncate">{nome}</span>
                                        <span className="font-etichetta text-lg leading-none text-obsidian-primary tabular-nums">{pct(peso)}%</span>
                                    </div>
                                    <div className="h-2 mt-1.5 rounded-full bg-obsidian-raised overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-[width] duration-300 ${peso > 0 && peso === massimo ? 'bg-brand-orange' : 'bg-obsidian-secondary'}`}
                                            style={{ width: `${pct(peso)}%` }}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between min-h-[32px]">
                                        <p className="font-etichetta text-[10px] tracking-[0.12em] uppercase text-obsidian-secondary">{T.livello[liv]}</p>
                                        {puoCorreggere && peso > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => correggi(categoria, 'azzera')}
                                                disabled={!!inCorso}
                                                aria-label={`Azzera ${nome.toLowerCase()}`}
                                                className="min-h-[32px] pl-3 text-xs font-semibold text-obsidian-secondary hover:text-obsidian-primary disabled:opacity-40 cursor-pointer"
                                            >
                                                Azzera
                                            </button>
                                        )}
                                    </div>
                                </div>
                                {puoCorreggere && (
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <button type="button" onClick={() => correggi(categoria, 'meno')} disabled={!!inCorso} aria-label={`Meno ${nome.toLowerCase()}`} title="Meno di questo" className={TASTO}>
                                            <Minus className="w-4 h-4" />
                                        </button>
                                        <button type="button" onClick={() => correggi(categoria, 'piu')} disabled={!!inCorso} aria-label={`Più ${nome.toLowerCase()}`} title="Più di questo" className={TASTO}>
                                            <Plus className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                            </div>
                            {esito?.categoria === categoria && <EsitoRiga esito={esito} peso={peso} />}
                        </li>
                    );
                })}
            </ul>

            {esito && !esito.categoria && (
                <p role="status" aria-live="polite" className={`text-xs font-medium ${esito.ok ? 'text-obsidian-primary' : 'text-brand-orange'}`} data-testid="dna-esito">{esito.testo}</p>
            )}

            {puoCorreggere ? (
                haPesi && (
                    <button
                        type="button"
                        onClick={azzeraTutto}
                        disabled={!!inCorso}
                        className="min-h-[44px] text-xs font-bold text-obsidian-secondary hover:text-obsidian-primary disabled:opacity-50 cursor-pointer"
                    >
                        {chiediAzzeraTutto ? T.azzeraConferma : T.azzeraTutto}
                    </button>
                )
            ) : (
                <p className="text-xs text-obsidian-secondary">{T.accedi}</p>
            )}
        </SchedaProfilo>
    );
}
