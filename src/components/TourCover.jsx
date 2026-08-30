// DVAI-058 — Copertina tour unificata per griglia "Per Te" (tematici + featured).
//
// Due rami, coerenza garantita, zero layout shift:
// - Ramo A (foto Places verificata): <img> + filtro brand costante + overlay identico.
// - Ramo B (foto assente / non verificata): gradient per categoria + glifo centrato.
//
// Autodetect ramo via isPlacesPhoto(url). Override esplicito con prop `verified`.
// Si aspetta un container padre con position:relative e altezza definita:
// TourCover fa `absolute inset-0` per riempirlo, così A e B sono intercambiabili.

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getCoverPalette, isPlacesPhoto } from '@/lib/categoryPalette';

// Overlay identico su TUTTE le copertine (leggibilità testo bianco).
const BRAND_OVERLAY = 'linear-gradient(to top, rgba(14,12,11,.90) 0%, rgba(14,12,11,.35) 45%, rgba(14,12,11,0) 80%)';

export default function TourCover({
    cover,
    category,
    type,
    title = '',
    verified,
    animateKey,
    showGlyph = true,
    gradientOverride,
    overlay,
    className = '',
    children,
}) {
    const [imgError, setImgError] = useState(false);

    // Autodetect ramo. `verified` esplicito ha priorità.
    const branchA = verified === true
        || (verified === undefined && !imgError && isPlacesPhoto(cover));

    const palette = getCoverPalette(category, type);
    const IconComponent = palette.IconComponent;

    // Overlay brand attivo solo se richiesto esplicitamente o se sono presenti children sovrapposti
    const showOverlay = overlay !== undefined ? overlay : Boolean(children);

    return (
        <div className={`absolute inset-0 overflow-hidden ${className}`}>
            {branchA ? (
                // ─── RAMO A: foto Places reale al 100% (zero filtri di attenuazione) ────
                <AnimatePresence mode="popLayout">
                    <motion.img
                        key={animateKey || cover}
                        initial={{ opacity: 0, scale: 1.05 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.5 }}
                        src={cover}
                        alt={title}
                        loading="lazy"
                        onError={() => setImgError(true)}
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700"
                    />
                </AnimatePresence>
            ) : (
                // ─── RAMO B: illustrato per categoria (icona lineare monocroma) ─
                <div
                    className="absolute inset-0 w-full h-full flex items-center justify-center relative"
                    style={{ background: gradientOverride || palette.gradient }}
                    aria-hidden="true"
                >
                    {/* Alone di luce speculare diffuso */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-white/10 pointer-events-none" />
                    {showGlyph && IconComponent && (
                        <div className="relative z-10 p-3.5 rounded-2xl bg-black/20 backdrop-blur-[2px] border border-white/5 shadow-2xl">
                            <IconComponent
                                className="w-10 h-10 stroke-[1.5] text-brand-orange/50 drop-shadow-sm"
                                aria-hidden="true"
                            />
                        </div>
                    )}
                </div>
            )}

            {/* Overlay brand IDENTICO su ramo A e B → leggibilità quando c'è testo sovrapposto */}
            {showOverlay && (
                <div
                    className="absolute inset-0 pointer-events-none z-10"
                    style={{ background: BRAND_OVERLAY }}
                    aria-hidden="true"
                />
            )}

            {/* Slot per badge/testo sovrapposto (rating, titolo, meta) */}
            {children}
        </div>
    );
}
