/**
 * DNA-6 — «Il tuo DNA» nel Profilo: i pesi veri (dal registro), in parole semplici, e la correzione
 * per categoria («più di questo», «meno di questo», «azzera»). Una correzione e' una riga in piu' nel
 * registro, non una cancellazione: la scheda si ricalcola solo se il server l'ha scritta.
 */

import { useState } from 'react';
import { Compass, Minus, Plus } from 'lucide-react';
import { fraseDna, ETICHETTE_CATEGORIA } from '../lib/dnaProfilo';
import { CORE_CATEGORIES } from '../services/preferenceEngine';

const TESTO_FATTO = {
    piu: (e) => `Fatto: più ${e}.`,
    meno: (e) => `Fatto: meno ${e}.`,
    azzera: (e) => `Fatto: ${e} riparte da zero.`,
};

export default function DnaProfilo({ pesi, eventi = 0, ritmo = null, compagnia = null, puoCorreggere = false, onCorreggi }) {
    const [inCorso, setInCorso] = useState(null);   // `${categoria}:${azione}` mentre si scrive
    const [esito, setEsito] = useState(null);       // { ok, testo }
    const [chiediAzzeraTutto, setChiediAzzeraTutto] = useState(false);

    const { frasi } = fraseDna(pesi, ritmo, compagnia);
    const righe = CORE_CATEGORIES
        .map((categoria, i) => ({ categoria, peso: Number(pesi?.[categoria]) || 0, i }))
        .sort((a, b) => (b.peso - a.peso) || (a.i - b.i));
    const piuForte = righe[0]?.peso > 0 ? righe[0].categoria : null;

    const correggi = async (categoria, azione) => {
        if (!puoCorreggere || inCorso) return;
        setInCorso(`${categoria}:${azione}`);
        setEsito(null);
        const r = await onCorreggi(categoria, azione);
        setInCorso(null);
        const nome = (ETICHETTE_CATEGORIA[categoria] || categoria).toLowerCase();
        setEsito(r?.ok
            ? { ok: true, testo: TESTO_FATTO[azione](nome) }
            : { ok: false, testo: 'Non sono riuscito a salvare la correzione. Riprova tra poco.' });
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
        setEsito(tutte
            ? { ok: true, testo: 'Fatto: il tuo DNA riparte da zero.' }
            : { ok: false, testo: 'Non sono riuscito ad azzerare tutto. Riprova tra poco.' });
    };

    const haPesi = righe.some(r => r.peso > 0);

    return (
        <div className="mb-6 bg-obsidian-card border border-obsidian-border rounded-2xl p-5 shadow-sm" data-testid="dna-profilo">
            <h3 className="font-bold text-obsidian-primary text-sm mb-3 flex items-center gap-2">
                <Compass className="w-4 h-4 text-obsidian-secondary" /> Il tuo DNA
            </h3>

            {frasi.length > 0 ? (
                <p className="text-sm text-obsidian-primary leading-relaxed" data-testid="dna-frasi">{frasi.join(' ')}</p>
            ) : (
                <p className="text-sm text-obsidian-secondary italic">Il tuo DNA si sta formando: ogni giro che completi e ogni tappa che raggiungi aggiunge un pezzo.</p>
            )}
            {eventi > 0 && (
                <p className="text-xs text-obsidian-secondary mt-1.5">Costruito su {eventi} {eventi === 1 ? 'tuo gesto' : 'tuoi gesti'}.</p>
            )}

            <ul className="mt-4 space-y-2.5">
                {righe.map(({ categoria, peso }) => {
                    const nome = ETICHETTE_CATEGORIA[categoria] || categoria;
                    return (
                        <li key={categoria} className="flex items-center gap-2" data-testid={`dna-${categoria}`}>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-baseline justify-between text-xs mb-1">
                                    <span className="font-medium text-obsidian-primary">{nome}</span>
                                    <span className="text-obsidian-secondary font-mono">{Math.round(peso * 100)}%</span>
                                </div>
                                <div className="h-1.5 rounded-full bg-obsidian-raised overflow-hidden">
                                    <div
                                        className={`h-full rounded-full ${categoria === piuForte ? 'bg-brand-orange' : 'bg-obsidian-secondary'}`}
                                        style={{ width: `${Math.round(peso * 100)}%` }}
                                    />
                                </div>
                            </div>
                            {puoCorreggere && (
                                <div className="flex items-center gap-1 shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => correggi(categoria, 'meno')}
                                        disabled={!!inCorso}
                                        aria-label={`Meno ${nome.toLowerCase()}`}
                                        title="Meno di questo"
                                        className="w-9 h-9 flex items-center justify-center rounded-lg bg-obsidian-raised border border-obsidian-border text-obsidian-primary hover:border-brand-orange disabled:opacity-50 cursor-pointer"
                                    >
                                        <Minus className="w-4 h-4" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => correggi(categoria, 'piu')}
                                        disabled={!!inCorso}
                                        aria-label={`Più ${nome.toLowerCase()}`}
                                        title="Più di questo"
                                        className="w-9 h-9 flex items-center justify-center rounded-lg bg-obsidian-raised border border-obsidian-border text-obsidian-primary hover:border-brand-orange disabled:opacity-50 cursor-pointer"
                                    >
                                        <Plus className="w-4 h-4" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => correggi(categoria, 'azzera')}
                                        disabled={!!inCorso || peso <= 0}
                                        aria-label={`Azzera ${nome.toLowerCase()}`}
                                        className="h-9 px-2 text-xs font-bold text-obsidian-secondary hover:text-obsidian-primary disabled:opacity-40 cursor-pointer"
                                    >
                                        Azzera
                                    </button>
                                </div>
                            )}
                        </li>
                    );
                })}
            </ul>

            <div role="status" aria-live="polite" className="min-h-[1.25rem] mt-3">
                {esito && (
                    <p className={`text-xs font-medium ${esito.ok ? 'text-obsidian-primary' : 'text-brand-orange'}`} data-testid="dna-esito">{esito.testo}</p>
                )}
            </div>

            {puoCorreggere ? (
                haPesi && (
                    <button
                        type="button"
                        onClick={azzeraTutto}
                        disabled={!!inCorso}
                        className="mt-1 text-xs font-bold text-obsidian-secondary hover:text-obsidian-primary disabled:opacity-50 cursor-pointer"
                    >
                        {chiediAzzeraTutto ? 'Sicuro? Tocca di nuovo per azzerare tutto' : 'Azzera tutto il DNA'}
                    </button>
                )
            ) : (
                <p className="text-xs text-obsidian-secondary mt-1">Accedi per correggere il tuo DNA.</p>
            )}
        </div>
    );
}
