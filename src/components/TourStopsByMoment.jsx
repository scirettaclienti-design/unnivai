import React, { useState } from 'react';
import { groupStopsByDayAndMoment } from '@/lib/stopMoments';
import { FactSources } from '@/components/FactSources';

// P3e — la dissolvenza in cima alla lista scorrevole (trasparente nei primi
// 26px) copriva la PRIMA intestazione di momento, che a lista ferma sta
// proprio li' (10–26px dal bordo): a schermo la prima tappa sembrava senza
// momento. La dissolvenza serve solo quando c'e' qualcosa che scorre sotto il
// bordo: si accende appena la lista e' scorsa. Stessa sfumatura di prima.
const TOP_FADE = 'linear-gradient(to bottom, transparent 0%, black 26px, black 100%)';

export function TopFadeScroll({ className, children }) {
    const [scrolled, setScrolled] = useState(false);
    return (
        <div
            className={className}
            data-top-fade={scrolled ? 'on' : 'off'}
            onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 0)}
            style={scrolled ? { maskImage: TOP_FADE, WebkitMaskImage: TOP_FADE } : undefined}
        >
            {children}
        </div>
    );
}

// Gate TAPPE PER MOMENTO — l'elenco compatto delle tappe di un tour, raggruppato
// per giorno (solo se i giorni sono piu' d'uno) e per momento della giornata,
// con l'orario reale di arrivo. Usato da QuickPathSummary e SurpriseTour, che
// avevano lo stesso markup copiato due volte.
//
// Nessun testo di riempimento: senza descrizione il blocco non si monta (prima
// c'era una frase generica, o la categoria, al posto della descrizione).
// Senza scheduledTime nessun orario: vedi src/lib/stopMoments.js.
export function TourStopsByMoment({ stops }) {
    const days = groupStopsByDayAndMoment(stops);
    const total = Array.isArray(stops) ? stops.length : 0;
    const multiDay = days.length > 1;

    return (
        <div className="space-y-4">
            {days.map((day, di) => (
                <div key={day.dayKey ?? `giorno-${di}`} data-day-group className="space-y-3">
                    {multiDay && (
                        <h5 className="text-xs font-bold text-obsidian-primary px-1 capitalize">
                            Giorno {di + 1}{day.dayLabel ? ` · ${day.dayLabel}` : ''}
                        </h5>
                    )}
                    {day.groups.map((group, gi) => (
                        <div key={`${group.moment?.key ?? 'senza'}-${gi}`} className="space-y-2">
                            {group.moment && (
                                <h6 data-moment-header className="text-[11px] font-bold text-brand-orange uppercase tracking-widest px-1">
                                    {group.moment.label}
                                </h6>
                            )}
                            {group.items.map(({ stop, index, timeLabel }) => (
                                <div key={index} data-stop-card className="flex items-start gap-3 bg-obsidian-card p-3 rounded-xl border border-obsidian-border shadow-sm relative overflow-hidden group">
                                    {index !== total - 1 && (
                                        <div className="absolute left-[1.35rem] top-8 bottom-[-12px] w-0.5 bg-obsidian-border z-0" />
                                    )}
                                    <div className="w-6 h-6 rounded-full bg-brand-orange text-obsidian-bg flex items-center justify-center text-[11px] font-bold shrink-0 relative z-10 shadow-sm mt-0.5">
                                        {index + 1}
                                    </div>
                                    <div className="flex-1 min-w-0 relative z-10">
                                        <div className="flex items-start justify-between gap-2">
                                            <p className="text-sm font-bold text-obsidian-primary leading-tight">{stop.name || stop.title || `Tappa ${index + 1}`}</p>
                                            {timeLabel && (
                                                <span className="text-xs font-bold text-obsidian-primary tabular-nums shrink-0">{timeLabel}</span>
                                            )}
                                        </div>
                                        {stop.description && (
                                            <p data-stop-description className="text-xs text-obsidian-secondary mt-1 leading-relaxed font-medium">{stop.description}</p>
                                        )}
                                        {/* P3d-e — attribuzione, solo sotto le tappe raccontate con dei fatti */}
                                        {stop.description && <FactSources fonti={stop.fonti} />}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
}
