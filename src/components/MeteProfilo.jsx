/**
 * DNA-6 — Profilo › Mete: un elemento per ogni giro completato (citta', data, tappe, categorie),
 * letto dal registro; sotto, i giri che l'utente ha salvato. Niente testo inventato: dove un dato
 * non c'e' (citta', totale delle tappe) non si scrive.
 */

import { MapPin, Bookmark, X } from 'lucide-react';
import { testoTappe, ETICHETTE_CATEGORIA } from '../lib/dnaProfilo';

const dataBreve = (iso) => {
    const d = new Date(iso);
    return Number.isFinite(d.getTime())
        ? d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })
        : null;
};

export default function MeteProfilo({ mete = [], giriSalvati = [], onRimuovi, onApri }) {
    return (
        <div data-testid="mete-profilo">
            {mete.length === 0 ? (
                <p className="text-sm text-obsidian-secondary italic" data-testid="mete-vuote">
                    Le mete che completi appariranno qui: ogni giro finito lascia il suo segno.
                </p>
            ) : (
                <ul className="space-y-3">
                    {mete.map((m) => (
                        <li key={m.tourId || m.data} className="bg-obsidian-bg p-4 rounded-xl border border-obsidian-border" data-testid="meta">
                            <div className="flex items-start justify-between gap-3">
                                <h4 className="font-bold text-obsidian-primary text-sm flex items-center">
                                    <MapPin className="w-3.5 h-3.5 mr-1.5 text-obsidian-secondary shrink-0" />
                                    {m.citta || 'Giro completato'}
                                </h4>
                                {dataBreve(m.data) && <span className="text-xs text-obsidian-secondary shrink-0">{dataBreve(m.data)}</span>}
                            </div>
                            <p className="text-xs text-obsidian-secondary mt-1.5">{testoTappe(m)}</p>
                            {m.categorie.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                    {m.categorie.map(c => (
                                        <span key={c} className="text-[10px] font-medium text-obsidian-primary bg-obsidian-raised border border-obsidian-border px-2 py-0.5 rounded-lg">
                                            {ETICHETTE_CATEGORIA[c] || c}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </li>
                    ))}
                </ul>
            )}

            {giriSalvati.length > 0 && (
                <div className="mt-5" data-testid="giri-salvati">
                    <h4 className="font-bold text-obsidian-primary text-sm mb-2 flex items-center">
                        <Bookmark className="w-3.5 h-3.5 mr-1.5 text-obsidian-secondary" /> Giri salvati
                    </h4>
                    <ul className="space-y-2">
                        {giriSalvati.map((g) => (
                            <li key={g.id} className="bg-obsidian-bg p-3 rounded-xl border border-obsidian-border flex items-center justify-between gap-3" data-testid="giro-salvato">
                                {/* il giro si riapre com'era stato salvato: tappe, orari, modifiche (nessuna generazione, 0 $) */}
                                <button type="button" onClick={() => onApri?.(g)} disabled={!onApri} data-testid="giro-salvato-apri" aria-label={`Apri ${g.title}`}
                                    className="min-w-0 flex-1 text-left cursor-pointer disabled:cursor-default">
                                    <p className="text-sm font-bold text-obsidian-primary truncate">{g.title}</p>
                                    <p className="text-xs text-obsidian-secondary">
                                        {[g.city, `${Array.isArray(g.stops) ? g.stops.filter(s => !s?.tempoLibero).length : 0} tappe`, dataBreve(g.created_at)].filter(Boolean).join(' • ')}
                                    </p>
                                </button>
                                {onRimuovi && (
                                    <button
                                        type="button"
                                        onClick={() => onRimuovi(g.id)}
                                        aria-label={`Rimuovi ${g.title}`}
                                        className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg text-obsidian-secondary hover:text-obsidian-primary cursor-pointer"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
