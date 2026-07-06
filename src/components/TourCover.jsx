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
const BRAND_OVERLAY = 'linear-gradient(to top, rgba(20,12,6,.85) 0%, rgba(20,12,6,.35) 45%, rgba(20,12,6,0) 100%)';

// Filtro CSS uniforme per il ramo A. Legge sat/contrasto + velo warm sepia
// leggerissimo, così luce/dominante di ogni foto si accordano in famiglia.
const BRAND_PHOTO_FILTER = 'saturate(.92) contrast(1.03) sepia(.03) brightness(.98)';

export default function TourCover({
    cover,
    category,
    type,
    title = '',
    verified,
    animateKey,
    className = '',
    children,
}) {
    const [imgError, setImgError] = useState(false);

    // Autodetect ramo. `verified` esplicito ha priorità.
    const branchA = verified === true
        || (verified === undefined && !imgError && isPlacesPhoto(cover));

    const palette = getCoverPalette(category, type);

    return (
        <div className={`absolute inset-0 overflow-hidden ${className}`}>
            {branchA ? (
                // ─── RAMO A: foto Places con trattamento brand uniforme ────────
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
                        style={{ filter: BRAND_PHOTO_FILTER }}
                    />
                </AnimatePresence>
            ) : (
                // ─── RAMO B: illustrato per categoria ─────────────────────────
                <div
                    className="absolute inset-0 w-full h-full flex items-center justify-center"
                    style={{ background: palette.gradient }}
                    aria-hidden="true"
                >
                    <span
                        className="select-none"
                        style={{
                            fontSize: 'clamp(4rem, 22vw, 8rem)',
                            opacity: 0.18,
                            filter: 'drop-shadow(0 4px 12px rgba(0,0,0,.25))',
                        }}
                    >
                        {palette.icon}
                    </span>
                </div>
            )}

            {/* Overlay brand IDENTICO su ramo A e B → leggibilità testo bianco + famiglia visiva */}
            <div
                className="absolute inset-0 pointer-events-none"
                style={{ background: BRAND_OVERLAY }}
                aria-hidden="true"
            />

            {/* Slot per badge/testo sovrapposto (rating, titolo, meta) */}
            {children}
        </div>
    );
}
