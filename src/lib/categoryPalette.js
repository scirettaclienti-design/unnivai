// DVAI-058 — Palette categorie condivisa cross-app.
// Single source of truth per: MapMarker (pin mappa) + TourCover (copertine "Per Te").

export const getCategoryStyles = (category, type) => {
    const typeStr = (type || '').toLowerCase();

    if (typeStr === 'waypoint' || typeStr === 'tour_step') {
        return { bg: '#1f2937', border: '#030712', icon: '📍', isStep: true };
    }
    if (typeStr === 'business_partner') {
        return { bg: '#eab308', border: '#a16207', icon: '⭐' };
    }

    const catLower = (category || '').toLowerCase();

    if (catLower.includes('food') || catLower.includes('cibo') || catLower.includes('ristorazione') || catLower.includes('restaurant')) {
        return { bg: '#f97316', border: '#c2410c', icon: '🍝' };
    }
    if (catLower.includes('shopping') || catLower.includes('negozio')) {
        return { bg: '#ec4899', border: '#be185d', icon: '🛍️' };
    }
    if (catLower.includes('coffee') || catLower.includes('bar') || catLower.includes('cafe')) {
        return { bg: '#8b5cf6', border: '#6d28d9', icon: '☕' };
    }
    if (catLower.includes('storia') || catLower.includes('history') || catLower.includes('museo') || catLower.includes('museum')) {
        return { bg: '#3b82f6', border: '#1d4ed8', icon: '🏛️' };
    }
    if (catLower.includes('art') || catLower.includes('arte')) {
        return { bg: '#10b981', border: '#047857', icon: '🎨' };
    }
    if (catLower.includes('natura') || catLower.includes('parco') || catLower.includes('park')) {
        return { bg: '#84cc16', border: '#4d7c0f', icon: '🌲' };
    }

    return { bg: '#ef4444', border: '#b91c1c', icon: '📌' };
};

import {
    UtensilsCrossed,
    Landmark,
    Trees,
    Palette,
    Coffee,
    ShoppingBag,
    Footprints,
    Sunset,
    Sparkles,
    Compass,
} from 'lucide-react';

// DVAI-058 / Blocco Estetica — Palette Definitiva Copertine: Temperatura Aperta
//
// Regole del Brand:
// 1. Tre Tier di luminosità nettamente staccati (Luce Alta ≈ 0.155, Luce Media ≈ 0.069, Luce Profonda ≈ 0.024).
// 2. Variazione di temperatura circoscritta rigorosamente alla famiglia calda (Rosso-Terracotta → Ambra-Oro).
// 3. Zero tinte estranee (no blu, verde, viola, rosa).
// 4. Icone lineari monocromatiche (stesso set dell'Onboarding).

const COVER_GRADIENTS = [
    // ─── TIER 1: LUCE ALTA (L media ≈ 0.155 | range: 0.142 - 0.165) ──────────
    {
        keys: ['walking', 'segret', 'vicoli', 'passeggia', 'avventura'],
        style: {
            tier: 'high',
            luminance: 0.165,
            tone: 'Ambra dorata solare',
            bg: '#F59E0B',
            icon: '👣',
            IconComponent: Footprints,
            gradient: 'radial-gradient(ellipse at 80% 15%, rgba(251, 191, 36, 0.45) 0%, transparent 65%), linear-gradient(145deg, #78350F 0%, #451A03 55%, #16100C 100%)',
        },
    },
    {
        keys: ['food', 'cibo', 'ristorazione', 'restaurant'],
        style: {
            tier: 'high',
            luminance: 0.158,
            tone: 'Arancio vivo zafferano',
            bg: '#F97316',
            icon: '🍝',
            IconComponent: UtensilsCrossed,
            gradient: 'radial-gradient(ellipse at 80% 15%, rgba(249, 115, 22, 0.48) 0%, transparent 65%), linear-gradient(145deg, #68341A 0%, #381A0E 55%, #16100C 100%)',
        },
    },
    {
        keys: ['shopping', 'negozio', 'mercato'],
        style: {
            tier: 'high',
            luminance: 0.142,
            tone: 'Rame chiaro tufo',
            bg: '#EA580C',
            icon: '🛍️',
            IconComponent: ShoppingBag,
            gradient: 'radial-gradient(ellipse at 80% 15%, rgba(234, 88, 12, 0.45) 0%, transparent 65%), linear-gradient(140deg, #5C2D16 0%, #33180D 55%, #16100C 100%)',
        },
    },

    // ─── TIER 2: LUCE MEDIA (L media ≈ 0.069 | range: 0.065 - 0.074) ─────────
    {
        keys: ['storia', 'history', 'museo', 'museum', 'monumento'],
        style: {
            tier: 'mid',
            luminance: 0.074,
            tone: 'Bronzo antico minerale',
            bg: '#D97706',
            icon: '🏛️',
            IconComponent: Landmark,
            gradient: 'radial-gradient(ellipse at 50% 20%, rgba(217, 119, 6, 0.30) 0%, transparent 70%), linear-gradient(160deg, #3A2214 0%, #20130C 60%, #0E0C0B 100%)',
        },
    },
    {
        keys: ['art', 'arte', 'galleria'],
        style: {
            tier: 'mid',
            luminance: 0.068,
            tone: 'Terracotta argilla toscana',
            bg: '#EA580C',
            icon: '🎨',
            IconComponent: Palette,
            gradient: 'radial-gradient(ellipse at 50% 20%, rgba(225, 29, 72, 0.22) 0%, transparent 70%), linear-gradient(160deg, #3D1815 0%, #22100F 60%, #0E0C0B 100%)',
        },
    },
    {
        keys: ['coffee', 'bar', 'cafe', 'relax'],
        style: {
            tier: 'mid',
            luminance: 0.065,
            tone: 'Moka tostato e cuoio bruno',
            bg: '#D97706',
            icon: '☕',
            IconComponent: Coffee,
            gradient: 'radial-gradient(ellipse at 50% 20%, rgba(180, 83, 9, 0.25) 0%, transparent 70%), linear-gradient(160deg, #301B12 0%, #1A100B 60%, #0E0C0B 100%)',
        },
    },

    // ─── TIER 3: LUCE PROFONDA (L media ≈ 0.024 | range: 0.022 - 0.026) ──────
    {
        keys: ['romance', 'tramonto', 'sunset', 'magia', 'nightlife'],
        style: {
            tier: 'low',
            luminance: 0.026,
            tone: 'Brace serale mattone scuro',
            bg: '#F97316',
            icon: '🌅',
            IconComponent: Sunset,
            gradient: 'radial-gradient(ellipse at 50% 10%, rgba(239, 68, 68, 0.18) 0%, transparent 65%), linear-gradient(180deg, #220F0D 0%, #0E0C0B 65%)',
        },
    },
    {
        keys: ['natura', 'parco', 'park', 'verde'],
        style: {
            tier: 'low',
            luminance: 0.022,
            tone: 'Terra d\'ombra corteccia',
            bg: '#EA580C',
            icon: '🌲',
            IconComponent: Trees,
            gradient: 'radial-gradient(ellipse at 50% 10%, rgba(202, 138, 4, 0.16) 0%, transparent 65%), linear-gradient(180deg, #1C150C 0%, #0E0C0B 65%)',
        },
    },
    {
        keys: ['cultur', 'insider', 'speciale'],
        style: {
            tier: 'low',
            luminance: 0.025,
            tone: 'Ossidiana ambrata profonda',
            bg: '#FB923C',
            icon: '✨',
            IconComponent: Sparkles,
            gradient: 'radial-gradient(ellipse at 50% 10%, rgba(254, 240, 138, 0.20) 0%, transparent 70%), linear-gradient(180deg, #1E140D 0%, #0E0C0B 65%)',
        },
    },
];

export const getCoverPalette = (category, type) => {
    const catLower = (category || '').toLowerCase();
    const matched = COVER_GRADIENTS.find(rule => rule.keys.some(k => catLower.includes(k)));
    if (matched) {
        return matched.style;
    }
    const styles = getCategoryStyles(category, type);
    return {
        bg: '#F97316',
        tier: 'mid',
        luminance: 0.069,
        tone: 'Caldo neutro',
        border: '#18120E',
        icon: styles.icon,
        IconComponent: Compass,
        gradient: 'radial-gradient(ellipse at 50% 20%, rgba(217, 119, 6, 0.30) 0%, transparent 70%), linear-gradient(160deg, #3A2214 0%, #20130C 60%, #0E0C0B 100%)',
    };
};

// DVAI-058 — Rileva se un URL immagine è una foto Google Places verificata.
const PLACES_URL_PATTERNS = [
    /\/places-proxy\??/i,
    /__dev\/places-proxy/i,
    /googleusercontent\.com/i,
    /maps\.googleapis\.com\/maps\/api\/place\/photo/i,
];

export const isPlacesPhoto = (url) => {
    if (!url || typeof url !== 'string') return false;
    return PLACES_URL_PATTERNS.some(p => p.test(url));
};

