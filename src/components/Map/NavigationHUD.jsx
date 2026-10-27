/**
 * NAV-3 — la navigazione-guida (schermata 1, «Cammino»). Presenter PURO: zero stato, zero effetti.
 *
 *  · IN ALTO UNA pillola: freccia grande + «120 m · a sinistra» + «in <via>» (solo alle svolte principali);
 *  · A DESTRA due tasti tondi: vista del giro, centra su di me;
 *  · IN BASSO la scheda: miniatura della tappa, «PROSSIMA · N MIN», nome, una riga insider; tre tasti Pausa / Salta / Voce
 *    (Voce pieno arancione); la barra «Tappa X di N».
 * Palette Ossidiana, UN solo accento arancione, tasti da almeno 44 px, angoli 14–28 px. La barra sta nella zona sicura in alto, la scheda
 * in quella in basso (`env(safe-area-inset-*)`).
 *
 * NAV-1: «Sono arrivato» (qui un'azione discreta, serve senza GPS), «Salta», un avviso alla volta (GPS, rete, percorso), la domanda
 * sulla tappa superata. NAV-2: nessun «Apri in Mappe». Mai un codice d'errore di Google a schermo.
 */
import { useState, useEffect, cloneElement } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Navigation, CornerUpLeft, CornerUpRight, CornerDownLeft, CornerDownRight, ArrowUp, RotateCcw, RotateCw, CircleDot, Split, GitMerge,
    Volume2, VolumeX, LocateFixed, X, Check, SkipForward, AlertTriangle, Pause, Play, Map as MapIcon, MapPin, Settings2,
} from 'lucide-react';
import { NAV_TESTI } from '../../lib/navMessaggi';
import { VOCI } from '../../lib/voce';
import { formatMetri, versoDa, viaDa, minutiAPiedi, rigaInsider, testoTappa, fotoVera } from '../../lib/navGuida';

// Mapping Google Directions maneuver → lucide icon. Cade su Navigation di default.
const maneuverIcon = (maneuver) => {
    switch (maneuver) {
        case 'turn-left': case 'turn-slight-left': case 'turn-sharp-left': return CornerUpLeft;
        case 'turn-right': case 'turn-slight-right': case 'turn-sharp-right': return CornerUpRight;
        case 'ramp-left': return CornerDownLeft;
        case 'ramp-right': return CornerDownRight;
        case 'uturn-left': return RotateCcw;
        case 'uturn-right': return RotateCw;
        case 'roundabout-left': case 'roundabout-right': return CircleDot;
        case 'fork-left': case 'fork-right': return Split;
        case 'merge': return GitMerge;
        case 'straight': return ArrowUp;
        default: return Navigation;
    }
};

const TASTO = 'min-h-[44px] min-w-[44px] flex items-center justify-center gap-1.5 rounded-full text-sm font-semibold border transition-transform active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-orange';

export default function NavigationHUD({
    activeRoute,
    completedSteps,
    nextStepDistanceM,
    activeManeuver,
    voiceEnabled,
    onToggleVoice,
    voceId = 'marin',
    onCambiaVoce,
    onEndNavigation,
    isCameraFollowing,
    onRecenterCamera,
    onVistaGiro,
    onApriScheda,
    nextStop: nextStopProp,
    skippedSteps,
    avviso,
    onArrived,
    onSkip,
    tappaPassata,
    onPassataVista,
    onPassataSalta,
    inPausa = false,
    onTogglePausa,
    sussurro = null,
    sopra = null,
    nascondi = false,
}) {
    const [aperta, setAperta] = useState(false); // la scheda in basso: compatta (una riga) o aperta (tirata in su)
    const [filoAperto, setFiloAperto] = useState(false); // il filo del giorno: una riga sottile, il dettaglio con un tocco sulla fascia
    const [impostazioni, setImpostazioni] = useState(false);
    const totalSteps = activeRoute?.length || 0;
    const doneSteps = (completedSteps?.length || 0) + (skippedSteps?.length || 0);
    const nextStop = nextStopProp !== undefined
        ? nextStopProp
        : (activeRoute || []).find(s => !(completedSteps || []).includes(s.id) && !(skippedSteps || []).includes(s.id));
    const nextStopName = nextStop?.name || nextStop?.title || null;
    const allDone = totalSteps > 0 && !nextStop;
    // a ogni nuova tappa la scheda torna compatta
    useEffect(() => { setAperta(false); }, [nextStop?.id]);
    const currentStopName = allDone ? 'Giro completato' : (nextStopName || 'Prossima tappa');
    const progressPct = totalSteps > 0 ? Math.min(100, Math.max(0, ((doneSteps + 1) / totalSteps) * 100)) : 0;

    // la pillola: la prossima svolta (se la barra la conosce), altrimenti «verso <tappa>»
    const svolta = activeManeuver?.prossima || (activeManeuver?.maneuver ? { maneuver: activeManeuver.maneuver, instructionHtml: activeManeuver.instructionHtml } : null);
    const distSvolta = formatMetri(activeManeuver?.distanzaM) || formatMetri(nextStepDistanceM);
    const via = viaDa(svolta?.instructionHtml);
    const IconaSvolta = maneuverIcon(svolta?.maneuver ?? null);
    const rigaPrincipale = allDone ? 'Giro completato' : [distSvolta, svolta ? versoDa(svolta.maneuver) : (nextStopName ? `verso ${nextStopName}` : null)].filter(Boolean).join(' · ') || 'Seguo il percorso';
    const rigaVia = !allDone && via ? `in ${via}` : null;

    const minuti = minutiAPiedi(nextStepDistanceM);
    const insider = rigaInsider(nextStop);
    const foto = fotoVera(nextStop);

    return (
        <AnimatePresence>
            <motion.div key="nav-hud" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className="pointer-events-none font-sans" data-testid="nav-hud">
                {/* ─── IN ALTO: il filo del giorno (se c'è), UNA pillola, gli avvisi ─────────────────────────────── */}
                <div className={`fixed left-3 right-3 z-[70] max-w-md mx-auto pointer-events-none transition-opacity duration-200 ${nascondi ? 'opacity-0 [&_*]:!pointer-events-none' : ''}`} style={{ top: 'calc(max(0.5rem, env(safe-area-inset-top)) + 3.5rem)' }}>
                    <div data-testid="nav-hud-barra" className="pointer-events-auto bg-obsidian-card rounded-[22px] border border-obsidian-border shadow-2xl px-3 py-2">
                        <div role="button" tabIndex={0} aria-expanded={filoAperto} onClick={() => sopra && setFiloAperto(v => !v)} onKeyDown={(e) => { if (sopra && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setFiloAperto(v => !v); } }} className="flex items-center gap-3 min-h-[44px]">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-obsidian-raised border border-obsidian-border text-brand-orange">
                                <IconaSvolta size={24} strokeWidth={2.4} aria-hidden="true" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p data-testid="nav-pillola" className="text-[15px] font-bold text-obsidian-primary leading-tight break-words">{inPausa ? 'In pausa' : rigaPrincipale}</p>
                                {!inPausa && rigaVia && <p className="text-[12px] text-obsidian-secondary leading-tight break-words mt-0.5">{rigaVia}</p>}
                            </div>
                        </div>
                        {sopra && cloneElement(sopra, { aperto: filoAperto })}
                    </div>

                    {avviso && (
                        <div role="status" data-testid="nav-avviso" data-tipo={avviso.tipo} className="pointer-events-auto mt-1.5 px-3 py-1.5 rounded-2xl bg-obsidian-card border border-obsidian-border flex items-start gap-2 shadow-xl">
                            <AlertTriangle size={16} className="text-status-warning shrink-0 mt-0.5" />
                            <p className="text-[12px] text-obsidian-primary leading-tight">{avviso.testo}</p>
                        </div>
                    )}

                    {tappaPassata && (
                        <div role="alertdialog" data-testid="nav-passata" className="pointer-events-auto mt-2 px-3.5 py-3 rounded-2xl bg-obsidian-card border border-brand-orange/50 shadow-xl">
                            <p className="text-sm font-semibold text-obsidian-primary leading-snug">{NAV_TESTI.PASSATA(tappaPassata.name || tappaPassata.title || 'questa tappa')}</p>
                            <div className="flex gap-2 mt-2.5">
                                <button onClick={onPassataVista} className={`${TASTO} flex-1 bg-brand-orange text-obsidian-bg border-transparent`}>{NAV_TESTI.PASSATA_VISTA}</button>
                                <button onClick={onPassataSalta} className={`${TASTO} flex-1 bg-obsidian-raised text-obsidian-primary border-obsidian-border`}>{NAV_TESTI.PASSATA_SALTA}</button>
                            </div>
                        </div>
                    )}
                </div>

                {/* ─── A DESTRA: due tasti tondi ───────────────────────────────────────────────────────────────── */}
                <div className={`fixed right-3 z-[65] flex flex-col gap-2.5 pointer-events-auto transition-opacity duration-200 ${nascondi ? 'opacity-0 [&_*]:!pointer-events-none pointer-events-none' : ''}`} style={{ top: '42%' }}>
                    <button onClick={onVistaGiro} aria-label="Vedi tutto il giro" data-testid="nav-vista-giro" className={`${TASTO} w-12 h-12 bg-obsidian-card text-obsidian-primary border-obsidian-border shadow-xl`}>
                        <MapIcon size={20} aria-hidden="true" />
                    </button>
                    {onCambiaVoce && (
                        <button onClick={() => setImpostazioni(v => !v)} aria-label={NAV_TESTI.IMPOSTAZIONI} aria-expanded={impostazioni} data-testid="nav-impostazioni" className={`${TASTO} w-12 h-12 bg-obsidian-card text-obsidian-primary border-obsidian-border shadow-xl`}>
                            <Settings2 size={20} aria-hidden="true" />
                        </button>
                    )}
                    <button onClick={onRecenterCamera} aria-label="Centra su di me" aria-pressed={!!isCameraFollowing} data-testid="nav-centra" className={`${TASTO} w-12 h-12 shadow-xl ${isCameraFollowing ? 'bg-obsidian-card text-brand-orange border-brand-orange/60' : 'bg-obsidian-card text-obsidian-primary border-obsidian-border'}`}>
                        <LocateFixed size={20} aria-hidden="true" />
                    </button>
                </div>

                {/* ─── LE IMPOSTAZIONI DEL GIRO: la voce della guida ───────────────────────────────────────────────── */}
                {impostazioni && onCambiaVoce && (
                    <div role="dialog" aria-label={NAV_TESTI.IMPOSTAZIONI} data-testid="nav-impostazioni-pannello" className="fixed left-3 right-3 z-[85] max-w-md mx-auto pointer-events-auto bg-obsidian-card rounded-[22px] border border-obsidian-border shadow-2xl p-3.5" style={{ bottom: 'calc(max(0.75rem, env(safe-area-inset-bottom) + 0.5rem) + 6.5rem)' }}>
                        <div className="flex items-center justify-between">
                            <h2 className="text-[13px] font-bold uppercase tracking-wider text-obsidian-secondary">{NAV_TESTI.IMPOSTAZIONI}</h2>
                            <button onClick={() => setImpostazioni(false)} aria-label={NAV_TESTI.CHIUDI} className={`${TASTO} w-11 h-11 bg-obsidian-raised text-obsidian-primary border-obsidian-border`}><X size={18} aria-hidden="true" /></button>
                        </div>
                        <div data-testid="voce-selettore" role="radiogroup" aria-label="Voce della guida" className="flex items-center gap-2 mt-2">
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-obsidian-secondary">Voce della guida</span>
                            {VOCI.map(v => (
                                <button key={v.id} role="radio" aria-checked={voceId === v.id} onClick={() => onCambiaVoce(v.id)}
                                    className={`min-h-[44px] px-4 rounded-full text-[13px] font-semibold border ${voceId === v.id ? 'border-brand-orange text-brand-orange' : 'border-obsidian-border text-obsidian-secondary'}`}>
                                    {v.nome}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* ─── IN BASSO: la scheda compatta (una riga), si apre tirandola verso l'alto ─────────────────────── */}
                <div className={`fixed left-3 right-3 z-[70] max-w-md mx-auto pointer-events-none transition-opacity duration-200 ${nascondi ? 'opacity-0 [&_*]:!pointer-events-none' : ''}`} style={{ bottom: 'max(0.75rem, calc(env(safe-area-inset-bottom) + 0.5rem))' }}>
                    {sussurro}
                    <motion.div data-testid="nav-scheda" data-aperta={aperta ? 'si' : 'no'} drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={0.25}
                        onDragEnd={(_, info) => { if (info.offset.y < -30) setAperta(true); else if (info.offset.y > 30) setAperta(false); }}
                        className="pointer-events-auto relative bg-obsidian-card rounded-[22px] border border-obsidian-border shadow-2xl px-3 pt-3 pb-2.5">
                        <button onClick={() => setAperta(v => !v)} aria-expanded={aperta} aria-label={aperta ? NAV_TESTI.COMPRIMI : NAV_TESTI.ESPANDI} data-testid="nav-scheda-maniglia"
                            className="absolute left-1/3 right-1/3 -top-3 h-11 flex items-start justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-orange rounded-full">
                            <span className="mt-[18px] block w-9 h-1 rounded-full bg-obsidian-border" aria-hidden="true" />
                        </button>
                        <div className="flex items-center gap-2">
                            <div role={onApriScheda ? 'button' : undefined} tabIndex={onApriScheda ? 0 : undefined} aria-label={onApriScheda ? `Apri la scheda: ${currentStopName}` : undefined} onClick={onApriScheda} onKeyDown={onApriScheda ? (e) => { if (e.key === 'Enter') onApriScheda(); } : undefined} className="flex items-center gap-2.5 flex-1 min-w-0 min-h-[44px] cursor-pointer">
                                {foto && (
                                    <div data-testid="nav-foto" className="w-11 h-11 rounded-xl overflow-hidden shrink-0 bg-obsidian-raised border border-obsidian-border">
                                        <img src={foto} alt="" className="w-full h-full object-cover" loading="lazy" onError={(e) => { e.currentTarget.parentElement.style.display = 'none'; }} />
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <h2 className="text-[15px] font-bold text-obsidian-primary leading-tight break-words">{currentStopName}</h2>
                                    <p className="text-[11px] font-bold tracking-wider uppercase mt-0.5 flex flex-wrap gap-x-2">
                                        <span className="text-brand-orange">{allDone ? 'FINE' : `PROSSIMA${minuti ? ` · ${minuti} MIN` : ''}`}</span>
                                        {totalSteps > 0 && <span className="text-obsidian-secondary">{testoTappa(doneSteps, totalSteps)}</span>}
                                    </p>
                                </div>
                            </div>
                            <button onClick={onTogglePausa} aria-pressed={inPausa} aria-label={inPausa ? NAV_TESTI.RIPRENDI : NAV_TESTI.PAUSA} className={`${TASTO} w-11 h-11 shrink-0 bg-obsidian-raised text-obsidian-primary border-obsidian-border`}>
                                {inPausa ? <Play size={18} aria-hidden="true" /> : <Pause size={18} aria-hidden="true" />}
                            </button>
                            {nextStop && !allDone && onSkip && (
                                <button onClick={() => onSkip(nextStop)} aria-label={NAV_TESTI.SALTA_TAPPA} className={`${TASTO} w-11 h-11 shrink-0 bg-obsidian-raised text-obsidian-primary border-obsidian-border`}>
                                    <SkipForward size={18} aria-hidden="true" />
                                </button>
                            )}
                            <button onClick={onToggleVoice} aria-label={voiceEnabled ? 'Disattiva voce' : 'Attiva voce'} aria-pressed={!!voiceEnabled} className={`${TASTO} w-11 h-11 shrink-0 ${voiceEnabled ? 'bg-brand-orange text-obsidian-bg border-transparent' : 'bg-obsidian-raised text-obsidian-primary border-obsidian-border'}`}>
                                {voiceEnabled ? <Volume2 size={18} aria-hidden="true" /> : <VolumeX size={18} aria-hidden="true" />}
                            </button>
                        </div>

                        {aperta && (
                            <div data-testid="nav-scheda-dettaglio" className="mt-2">
                                {insider && <p data-testid="nav-insider" className="text-[13px] text-obsidian-secondary leading-snug">{insider}</p>}
                                {totalSteps > 0 && (
                                    <div className="mt-2">
                                        <div className="flex items-center justify-between mb-1.5">
                                            <div className="flex items-center ml-auto">
                                                {nextStop && !allDone && onArrived && (
                                                    <button onClick={() => onArrived(nextStop)} className="min-h-[44px] px-3 flex items-center gap-1 text-xs font-semibold text-obsidian-primary">
                                                        <Check size={14} aria-hidden="true" /><span>{NAV_TESTI.ARRIVATO}</span>
                                                    </button>
                                                )}
                                                <button onClick={onEndNavigation} aria-label="Termina navigazione" className="min-h-[44px] px-3 flex items-center gap-1 text-xs font-semibold text-status-error">
                                                    <X size={14} strokeWidth={2.5} aria-hidden="true" /><span>Fine</span>
                                                </button>
                                            </div>
                                        </div>
                                        <div className="h-1.5 bg-obsidian-raised rounded-full overflow-hidden border border-obsidian-border">
                                            <motion.div className="h-full rounded-full bg-brand-orange" initial={{ width: 0 }} animate={{ width: `${progressPct}%` }} transition={{ duration: 0.5, ease: 'easeOut' }} />
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </motion.div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
