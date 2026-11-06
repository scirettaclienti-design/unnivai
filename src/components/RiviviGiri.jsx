/**
 * PROFILO-SEZIONI — Profilo › Rivivi i tuoi giri: i giri finiti, con la loro istantanea (lib/giriSalvati, `leggiGiriFatti`). In elenco il
 * tracciato, le tappe e la data; aperta la scheda, la mappa vera, le tappe una per una e «Rifai questo giro» (stesse tappe, 0 $).
 */
import { lazy, Suspense, useState } from 'react';
import { Check, ChevronRight, Clock, Repeat, X } from 'lucide-react';
import { conteggioGiroFatto } from '../lib/giriSalvati';
import { romeParts } from '../lib/tourWindow';
import { TESTI_PROFILO as T } from '../lib/testiAccount';
import { TracciatoGiro } from './TracciatoGiro';

const MappaDelGiro = lazy(() => import('./MappaDelGiro'));

/** Le schede mostrate prima di «Vedi tutti». */
const IN_ELENCO = 3;

const dataBreve = (iso) => {
    const d = new Date(iso);
    return Number.isFinite(d.getTime()) ? d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Rome' }) : null;
};
const oraDi = (iso) => {
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return null;
    const p = romeParts(d);
    return `${String(p.h).padStart(2, '0')}:${String(p.mi).padStart(2, '0')}`;
};
const vere = (riga) => (Array.isArray(riga?.stops) ? riga.stops : []).filter(s => s && !s.tempoLibero);

function SchedaGiro({ riga, onRifai, onChiudi }) {
    const tappe = vere(riga);
    return (
        <div className="fixed inset-0 z-[100] bg-obsidian-bg flex flex-col font-corpo" role="dialog" aria-label={riga.title} data-testid="rivivi-scheda">
            <div className="flex-1 overflow-y-auto px-4" style={{ paddingTop: 'max(1.25rem, env(safe-area-inset-top))' }}>
                <div className="max-w-md mx-auto">
                    <div className="flex items-center justify-between gap-3">
                        <p className="font-etichetta text-[11px] tracking-[0.16em] uppercase text-brand-orange">{[T.RIVIVI_ETICHETTA, dataBreve(riga.created_at)].filter(Boolean).join(' · ')}</p>
                        <button type="button" onClick={onChiudi} aria-label={T.CHIUDI} data-testid="rivivi-chiudi" className="w-11 h-11 shrink-0 flex items-center justify-center rounded-2xl bg-obsidian-card border border-obsidian-border text-obsidian-primary cursor-pointer">
                            <X className="w-[18px] h-[18px]" aria-hidden="true" />
                        </button>
                    </div>
                    <h2 className="font-marchio font-extrabold text-[28px] leading-[1.1] text-obsidian-primary mt-1">{riga.title}</h2>
                    {riga.city && <p className="text-sm text-obsidian-secondary mt-1">{riga.city}</p>}

                    <div className="mt-4 rounded-3xl overflow-hidden bg-obsidian-card border border-obsidian-border">
                        <Suspense fallback={<TracciatoGiro tappe={tappe} />}>
                            <MappaDelGiro tappe={tappe} />
                        </Suspense>
                    </div>

                    <ol className="mt-4 mb-4 space-y-2" data-testid="rivivi-tappe">
                        {(riga.stops || []).filter(Boolean).map((s, i) => {
                            if (s.tempoLibero) {
                                return (
                                    <li key={i} className="flex items-center gap-3 px-3 text-xs text-obsidian-secondary">
                                        <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />{T.RIVIVI_TEMPO_LIBERO}
                                    </li>
                                );
                            }
                            const numero = tappe.indexOf(s) + 1;
                            const ora = oraDi(s.scheduledTime);
                            return (
                                <li key={i} className="flex items-center gap-3 rounded-2xl bg-obsidian-card border border-obsidian-border p-3" data-testid="rivivi-tappa">
                                    <span className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-xs font-bold border-2 ${s.fatta ? 'bg-brand-orange border-brand-orange text-obsidian-bg' : 'border-obsidian-border text-obsidian-secondary'}`}>{numero}</span>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-semibold text-obsidian-primary truncate">{s.title}</p>
                                        <p className="text-xs text-obsidian-secondary">{[ora, s.fatta ? T.RIVIVI_RAGGIUNTA : T.RIVIVI_NON_RAGGIUNTA].filter(Boolean).join(' · ')}</p>
                                    </div>
                                    {s.fatta && <Check className="w-4 h-4 shrink-0 text-brand-orange" aria-hidden="true" />}
                                </li>
                            );
                        })}
                    </ol>
                </div>
            </div>
            <div className="px-4 pt-3 border-t border-obsidian-border bg-obsidian-bg" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.75rem)' }}>
                <div className="max-w-md mx-auto">
                    <button type="button" onClick={() => onRifai(riga)} data-testid="rivivi-rifai" className="w-full min-h-[52px] rounded-2xl bg-brand-orange hover:bg-brand-orange-hover text-obsidian-bg font-bold text-sm flex items-center justify-center gap-2 cursor-pointer">
                        <Repeat className="w-4 h-4" aria-hidden="true" />{T.RIVIVI_RIFAI}
                    </button>
                    <p className="text-[11px] text-center text-obsidian-secondary mt-2">{T.RIVIVI_RIFAI_NOTA}</p>
                </div>
            </div>
        </div>
    );
}

export default function RiviviGiri({ giri = [], haMete = false, onRifai }) {
    const [aperto, setAperto] = useState(null);
    const [tutti, setTutti] = useState(false);
    const mostrati = tutti ? giri : giri.slice(0, IN_ELENCO);
    return (
        <section className="mb-6 font-corpo" data-testid="rivivi-giri">
            <h3 className="font-marchio font-extrabold text-xl leading-tight text-obsidian-primary mb-3">{T.RIVIVI_TITOLO}</h3>
            {giri.length === 0 ? (
                <p className="bg-obsidian-card border border-obsidian-border rounded-2xl p-5 text-sm text-obsidian-secondary" data-testid="rivivi-vuoto">
                    {haMete ? T.RIVIVI_SOLO_METE : T.RIVIVI_VUOTO}
                </p>
            ) : (
                <ul className="space-y-3">
                    {mostrati.map((g) => {
                        const { raggiunte, totali } = conteggioGiroFatto(g);
                        return (
                            <li key={g.id}>
                                <button type="button" onClick={() => setAperto(g)} aria-label={T.RIVIVI_APRI(g.title)} data-testid="rivivi-giro" className="w-full flex items-center gap-3 text-left bg-obsidian-card border border-obsidian-border hover:border-brand-orange rounded-2xl p-3 transition-colors cursor-pointer">
                                    <div className="w-[84px] h-[84px] shrink-0 rounded-xl bg-obsidian-bg border border-obsidian-border overflow-hidden">
                                        <TracciatoGiro tappe={vere(g)} larghezza={84} altezza={84} raggio={3.5} numeri={false} className="w-full h-full" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-bold text-obsidian-primary truncate">{g.title}</p>
                                        <p className="text-xs text-obsidian-secondary mt-0.5">{[g.city, dataBreve(g.created_at)].filter(Boolean).join(' · ')}</p>
                                        <p className="text-xs text-obsidian-secondary mt-0.5">{T.RIVIVI_TAPPE(raggiunte, totali)}</p>
                                    </div>
                                    <ChevronRight className="w-4 h-4 shrink-0 text-obsidian-secondary" aria-hidden="true" />
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}
            {!tutti && giri.length > IN_ELENCO && (
                <button type="button" onClick={() => setTutti(true)} data-testid="rivivi-altri" className="w-full min-h-[44px] mt-2 text-sm font-semibold text-obsidian-secondary hover:text-obsidian-primary cursor-pointer">
                    {T.RIVIVI_ALTRI(giri.length)}
                </button>
            )}
            {aperto && <SchedaGiro riga={aperto} onRifai={onRifai} onChiudi={() => setAperto(null)} />}
        </section>
    );
}
