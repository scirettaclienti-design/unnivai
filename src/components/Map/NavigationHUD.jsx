/**
 * Layer C Fix 3 — NavigationHUD
 *
 * HUD in alto durante la navigazione. Presenter PURO: zero stato, zero effetti
 * collaterali. Riceve routeStats + activeRoute + completedSteps + handler
 * (onToggleVoice, onEndNavigation, onRecenterCamera).
 *
 * Design locked Ivano:
 * - Arancione DoveVAI #f97316 (non verde-Google-Maps).
 * - Compatto: freccia direzione + istruzione + tappa X/Y + azioni. Niente card
 *   espansa — l'utente cammina, guarda la strada.
 * - Icone lucide-react (Volume2/VolumeX, LocateFixed, X), NO emoji.
 * - Progress bar linear tra tappe.
 * - Ombre soft, bg-white/95 backdrop-blur-xl, rounded-[28px].
 * - Recenter integrato quando la camera non segue l'utente.
 * - Safe-area-top rispettato (env(safe-area-inset-top)).
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
    voiceEnabled,
    onToggleVoice,
    onEndNavigation,
    isCameraFollowing,
    onRecenterCamera,
}) {
    const step0 = routeStats?.steps?.[0];
    // Fase 2b-2 FIX 2: distanza REATTIVA alla prossima tappa (scende camminando).
    // Se disponibile sostituisce il valore statico del maneuver leg0 nel chip.
    const liveDistanceText = Number.isFinite(nextStepDistanceM) ? formatDistance(nextStepDistanceM) : null;
    const distChip = liveDistanceText || step0?.distance?.text;
    const ManeuverIcon = maneuverIcon(step0?.maneuver);
    const totalSteps = activeRoute?.length || 0;
    const doneSteps = completedSteps?.length || 0;
    const currentStepIdx = Math.min(doneSteps, Math.max(0, totalSteps - 1));
    const currentStopName = activeRoute?.[currentStepIdx]?.name
        || activeRoute?.[currentStepIdx]?.title
        || 'Prossima tappa';
    const progressPct = totalSteps > 0
        ? Math.min(100, Math.max(0, ((doneSteps + 1) / totalSteps) * 100))
        : 0;
    const durationText = formatDuration(routeStats?.durationSec);
    const distanceRemainingText = formatDistance(routeStats?.distanceM);

    // Istruzione principale sanitizzata (DVAI-002 XSS guard, come JSX inline pre-refactor).
    const instructionHtml = step0?.instructions
        ? DOMPurify.sanitize(step0.instructions, {
            ALLOWED_TAGS: ['b', 'strong', 'span', 'div'],
            ALLOWED_ATTR: ['style'],
        })
        : null;

    // DVAI-065 Fix HUD — Inset assoluto (left-2 right-2) invece di
    // left-1/2 + -translate-x-1/2 + w-[calc(...)]. Nessuna matematica di
    // centraggio, nessun transform: la card è ancorata a 8px da entrambi
    // i lati per costruzione. Robusto contro qualsiasi variazione di
    // safe-area indotta da iOS Chrome (URL bar dinamica, fullscreen).
    // Su desktop max-w-md + mx-auto centra l'elemento nel box definito
    // da left-2/right-2.
    return (
        <AnimatePresence>
            <motion.div
                key="nav-hud"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
                className="fixed left-2 right-2 z-[70] max-w-md mx-auto pointer-events-auto"
                style={{ top: 'max(0.5rem, env(safe-area-inset-top))' }}
            >
                <div
                    className="bg-white/95 backdrop-blur-xl rounded-[28px] overflow-hidden ring-1 ring-black/5"
                    style={{ boxShadow: '0 10px 40px -10px rgba(249,115,22,0.35), 0 4px 12px rgba(0,0,0,0.08)' }}
                >
                    {/* ─── Head: freccia direzione + istruzione + chip distanza ─────── */}
                    <div className="px-4 pt-4 pb-3 flex items-start gap-3">
                        <div
                            className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 text-white shadow-inner"
                            style={{
                                background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                                boxShadow: 'inset 0 -3px 6px rgba(0,0,0,0.15)',
                            }}
                        >
                            <ManeuverIcon size={28} strokeWidth={2.4} />
                        </div>
                        <div className="flex-1 min-w-0">
                            {routeStats?.error ? (
                                <p className="text-[15px] font-semibold text-amber-600 leading-snug break-words">
                                    {routeStats.error}
                                </p>
                            ) : instructionHtml ? (
                                <>
                                    {/* DVAI-063 B — break-words + hyphens: le istruzioni Google
                                        possono contenere stringhe lunghe non separate
                                        (es. "Via Ancipa/SP102") che il line-clamp non spezza
                                        e forzano overflow orizzontale. break-words permette il
                                        break dentro le parole se necessario. */}
                                    <p
                                        className="text-[17px] font-bold text-gray-900 leading-tight line-clamp-2 break-words"
                                        style={{ fontFamily: 'Quicksand, sans-serif', wordBreak: 'break-word', hyphens: 'auto' }}
                                        dangerouslySetInnerHTML={{ __html: instructionHtml }}
                                    />
                                    {/* DVAI-063 B — flex-wrap sul chip: se distanza + tempo
                                        sono lunghi (es. "1.5 km · 35 min rimasti"), la seconda
                                        parte va a capo invece di uscire dallo schermo. */}
                                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                        {distChip && (
                                            <span className="text-[13px] font-bold text-orange-600 whitespace-nowrap">
                                                {distChip}
                                            </span>
                                        )}
                                        {distChip && durationText && (
                                            <span className="w-1 h-1 rounded-full bg-gray-300 shrink-0" />
                                        )}
                                        {durationText && (
                                            <span className="text-[13px] font-semibold text-gray-500 whitespace-nowrap">
                                                {durationText} rimasti
                                            </span>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <p className="text-[15px] font-semibold text-gray-500">
                                    Ricalcolo in corso…
                                </p>
                            )}
                        </div>
                    </div>

                    {/* ─── Progress bar + counter tappa ─────────────────────────────── */}
                    {totalSteps > 0 && (
                        <div className="px-4 pb-3">
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[11px] font-black uppercase tracking-wider text-gray-500">
                                    Tappa {Math.min(doneSteps + 1, totalSteps)}/{totalSteps}
                                </span>
                                <span className="text-[12px] font-semibold text-gray-700 truncate max-w-[180px]">
                                    {currentStopName}
                                </span>
                            </div>
                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <motion.div
                                    className="h-full rounded-full"
                                    style={{ background: 'linear-gradient(90deg, #f97316 0%, #ea580c 100%)' }}
                                    initial={{ width: 0 }}
                                    animate={{ width: `${progressPct}%` }}
                                    transition={{ duration: 0.5, ease: 'easeOut' }}
                                />
                            </div>
                            {distanceRemainingText && durationText && (
                                <div className="text-[11px] text-gray-400 mt-1 font-medium">
                                    {distanceRemainingText} totali · ~{durationText}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ─── Azioni: voce, recenter (se off), fine ────────────────────── */}
                    <div className="px-3 pb-3 pt-1 flex items-center justify-between gap-2 border-t border-gray-100/80">
                        <button
                            onClick={onToggleVoice}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-[12px] font-bold transition-all ${
                                voiceEnabled
                                    ? 'bg-orange-50 text-orange-600 hover:bg-orange-100'
                                    : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                            }`}
                            aria-label={voiceEnabled ? 'Disattiva voce' : 'Attiva voce'}
                        >
                            {voiceEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                            <span>{voiceEnabled ? 'Voce' : 'Muto'}</span>
                        </button>

                        {!isCameraFollowing && onRecenterCamera && (
                            <button
                                onClick={onRecenterCamera}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-full text-[12px] font-bold bg-blue-50 text-blue-600 hover:bg-blue-100 transition-all"
                                aria-label="Torna alla mia posizione"
                            >
                                <LocateFixed size={16} />
                                <span>Centra</span>
                            </button>
                        )}

                        <button
                            onClick={onEndNavigation}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[12px] font-bold text-white shadow-md transition-all hover:scale-105 active:scale-95"
                            style={{ background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' }}
                            aria-label="Termina navigazione"
                        >
                            <X size={14} strokeWidth={3} />
                            <span>Fine</span>
                        </button>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
