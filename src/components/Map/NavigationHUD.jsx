/**
 * Layer C Fix 3 — NavigationHUD
 *
 * HUD in alto durante la navigazione. Presenter PURO: zero stato, zero effetti
 * collaterali. Riceve routeStats + activeRoute + completedSteps + handler
 * (onToggleVoice, onEndNavigation, onRecenterCamera).
 *
 * Design: Scala Ossidiana canonica DoveVAI (bg-obsidian-card, accento arancione su distanza e progresso).
 */
import { motion, AnimatePresence } from 'framer-motion';
import DOMPurify from 'dompurify';
import {
    Navigation,
    CornerUpLeft,
    CornerUpRight,
    CornerDownLeft,
    CornerDownRight,
    ArrowUp,
    RotateCcw,
    RotateCw,
    CircleDot,
    Split,
    GitMerge,
    Volume2,
    VolumeX,
    LocateFixed,
    X,
} from 'lucide-react';

// Mapping Google Directions maneuver → lucide icon. Cade su Navigation di default.
// Ref: https://developers.google.com/maps/documentation/directions/get-directions#Step
const maneuverIcon = (maneuver) => {
    switch (maneuver) {
        case 'turn-left':
        case 'turn-slight-left':
        case 'turn-sharp-left':
            return CornerUpLeft;
        case 'turn-right':
        case 'turn-slight-right':
        case 'turn-sharp-right':
            return CornerUpRight;
        case 'ramp-left':
            return CornerDownLeft;
        case 'ramp-right':
            return CornerDownRight;
        case 'uturn-left':
            return RotateCcw;
        case 'uturn-right':
            return RotateCw;
        case 'roundabout-left':
        case 'roundabout-right':
            return CircleDot;
        case 'fork-left':
        case 'fork-right':
            return Split;
        case 'merge':
            return GitMerge;
        case 'straight':
            return ArrowUp;
        default:
            return Navigation;
    }
};

// Formatta durata secondi → "12 min" o "1h 20 min".
const formatDuration = (sec) => {
    if (!Number.isFinite(sec) || sec <= 0) return '';
    const m = Math.round(sec / 60);
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60);
    const rem = m % 60;
    return rem === 0 ? `${h}h` : `${h}h ${rem} min`;
};

// Formatta distanza metri → "800 m" o "1.2 km".
const formatDistance = (m) => {
    if (!Number.isFinite(m) || m <= 0) return '';
    return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
};

export default function NavigationHUD({
    routeStats,
    activeRoute,
    completedSteps,
    nextStepDistanceM,
    activeManeuver,
    voiceEnabled,
    onToggleVoice,
    onEndNavigation,
    isCameraFollowing,
    onRecenterCamera,
}) {
    const step0 = routeStats?.steps?.[0];
    // Fase 2b-2 FIX 2: distanza REATTIVA alla prossima tappa (scende camminando).
    const liveDistanceText = Number.isFinite(nextStepDistanceM) ? formatDistance(nextStepDistanceM) : null;
    const distChip = liveDistanceText || step0?.distance?.text;
    const ManeuverIcon = maneuverIcon(activeManeuver?.maneuver ?? null);
    const maneuverHtml = activeManeuver?.instructionHtml
        ? DOMPurify.sanitize(activeManeuver.instructionHtml, { ALLOWED_TAGS: ['b', 'strong', 'span', 'div'], ALLOWED_ATTR: ['style'] })
        : null;
    const totalSteps = activeRoute?.length || 0;
    const doneSteps = completedSteps?.length || 0;
    const nextStop = (activeRoute || []).find(s => !(completedSteps || []).includes(s.id));
    const nextStopName = nextStop?.name || nextStop?.title || null;
    const allDone = totalSteps > 0 && !nextStop;
    const currentStopName = nextStopName || 'Prossima tappa';
    const destinationTitle = allDone ? 'Tour completato' : currentStopName;
    const progressPct = totalSteps > 0
        ? Math.min(100, Math.max(0, ((doneSteps + 1) / totalSteps) * 100))
        : 0;
    const durationText = formatDuration(routeStats?.durationSec);
    const distanceRemainingText = formatDistance(routeStats?.distanceM);

    return (
        <AnimatePresence>
            <motion.div
                key="nav-hud"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
                className="fixed left-2 right-2 z-[70] max-w-md mx-auto pointer-events-auto font-sans"
                style={{ top: 'max(0.5rem, env(safe-area-inset-top))' }}
            >
                <div className="bg-obsidian-card/95 backdrop-blur-xl rounded-[28px] overflow-hidden border border-obsidian-border shadow-2xl">
                    {/* ─── Head: icona manovra + destinazione principale + distanza + istruzione ─────── */}
                    <div className="px-4 pt-4 pb-3 flex items-start gap-3">
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 bg-obsidian-raised border border-obsidian-border text-brand-orange">
                            <ManeuverIcon size={24} strokeWidth={2.4} />
                        </div>
                        <div className="flex-1 min-w-0">
                            {routeStats?.error ? (
                                <p className="text-sm font-medium text-status-error leading-snug break-words">
                                    {routeStats.error}
                                </p>
                            ) : (
                                <>
                                    {/* 1. Nome della tappa di destinazione (elemento principale) */}
                                    <h2 className="text-base sm:text-[17px] font-bold text-obsidian-primary leading-tight truncate">
                                        {destinationTitle}
                                    </h2>

                                    {/* 2. Distanza subito sotto + tempo rimasto */}
                                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                        {distChip && (
                                            <span className="text-xs sm:text-[13px] font-medium text-brand-orange whitespace-nowrap">
                                                {distChip}
                                            </span>
                                        )}
                                        {distChip && durationText && (
                                            <span className="w-1 h-1 rounded-full bg-obsidian-border-elevated shrink-0" />
                                        )}
                                        {durationText && (
                                            <span className="text-xs sm:text-[13px] font-normal text-obsidian-secondary whitespace-nowrap">
                                                {durationText} rimasti
                                            </span>
                                        )}
                                    </div>

                                    {/* 3. Istruzione di manovra (riga piccola secondaria) */}
                                    {maneuverHtml && (
                                        <p
                                            className="text-xs text-obsidian-secondary/80 leading-normal line-clamp-1 break-words font-normal mt-1"
                                            dangerouslySetInnerHTML={{ __html: maneuverHtml }}
                                        />
                                    )}
                                </>
                            )}
                        </div>
                    </div>

                    {/* ─── Progress bar + counter tappa ─────────────────────────────── */}
                    {totalSteps > 0 && (
                        <div className="px-4 pb-3">
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[11px] font-semibold uppercase tracking-wider text-obsidian-secondary">
                                    Tappa {Math.min(doneSteps + 1, totalSteps)}/{totalSteps}
                                </span>
                                <span className="text-xs font-normal text-obsidian-secondary truncate max-w-[180px]">
                                    {currentStopName}
                                </span>
                            </div>
                            <div className="h-1.5 bg-obsidian-raised rounded-full overflow-hidden border border-obsidian-border/50">
                                <motion.div
                                    className="h-full rounded-full bg-brand-orange"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${progressPct}%` }}
                                    transition={{ duration: 0.5, ease: 'easeOut' }}
                                />
                            </div>
                            {distanceRemainingText && durationText && (
                                <div className="text-[11px] text-obsidian-secondary/70 mt-1 font-normal">
                                    {distanceRemainingText} totali · ~{durationText}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ─── Azioni: voce, recenter (se off), fine ────────────────────── */}
                    <div className="px-3 pb-3 pt-2 flex items-center justify-between gap-2 border-t border-obsidian-border">
                        <button
                            onClick={onToggleVoice}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border border-obsidian-border ${
                                voiceEnabled
                                    ? 'bg-obsidian-raised text-obsidian-primary'
                                    : 'bg-obsidian-card text-obsidian-secondary/60 hover:text-obsidian-secondary'
                            }`}
                            aria-label={voiceEnabled ? 'Disattiva voce' : 'Attiva voce'}
                        >
                            {voiceEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
                            <span>{voiceEnabled ? 'Voce' : 'Muto'}</span>
                        </button>

                        {!isCameraFollowing && onRecenterCamera && (
                            <button
                                onClick={onRecenterCamera}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-obsidian-raised hover:bg-obsidian-border text-obsidian-primary border border-obsidian-border transition-colors"
                                aria-label="Torna alla mia posizione"
                            >
                                <LocateFixed size={15} />
                                <span>Centra</span>
                            </button>
                        )}

                        <button
                            onClick={onEndNavigation}
                            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium text-status-error bg-obsidian-raised hover:bg-obsidian-border border border-obsidian-border transition-colors active:scale-95"
                            aria-label="Termina navigazione"
                        >
                            <X size={14} strokeWidth={2.5} />
                            <span>Fine</span>
                        </button>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
