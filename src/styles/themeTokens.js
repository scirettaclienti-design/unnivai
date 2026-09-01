/**
 * DOVEVAI — Scala Colore Unica (Design System Canonic)
 *
 * 3 soli livelli di superficie, 1 solo accento arancione,
 * 2 soli grigi di testo conformi a WCAG AA (> 4.5:1).
 */

const raw = {
    surfaceBase: '#0E0C0B',
    surfaceCard: '#161311',
    surfaceElevated: '#1E1A17',
    accentPrimary: '#F97316',
    accentHover: '#EA580C',
    accentDeep: '#9A3412',
    textPrimary: '#F5F5F4',
    textSecondary: '#C4BEB6',
    ivoryBg: '#F5F2EB',
    ivoryBadge: '#E5DFD1',
    borderSubtle: '#26211E',
    borderElevated: '#332C28',
    statusSuccess: '#10B981',
    statusError: '#EF4444',
    statusWarning: '#EAB308',
};

export const THEME = {
    // Stati Semantici (Toast, Error Boundary, Avvisi)
    status: {
        success: raw.statusSuccess,
        error: raw.statusError,
        warning: raw.statusWarning,
    },
    // 3 Livelli di Superficie
    surface: {
        base: 'var(--obsidian-bg)',
        card: 'var(--obsidian-card)',
        elevated: 'var(--obsidian-raised)',
    },

    // Accento Unico dell'App: Arancione
    accent: {
        primary: 'var(--brand-orange)',
        hover: 'var(--brand-orange-hover)',
        subtle: 'var(--brand-orange-deep)',
    },

    // Testo: Due soli grigi
    text: {
        primary: 'var(--text-primary)',
        secondary: 'var(--text-secondary)',
        onAccent: 'var(--text-on-accent)',
        onIvory: 'var(--ivory-text)',
    },

    // Stato Selezionato (Avorio)
    selected: {
        bg: 'var(--ivory-bg)',
        text: 'var(--ivory-text)',
        icon: 'var(--ivory-icon)',
        badge: raw.ivoryBadge,
    },

    // Bordi
    border: {
        subtle: 'var(--obsidian-border)',
        elevated: 'var(--obsidian-border-elevated)',
    },

    // Valori esadecimali grezzi per contesti non-DOM (Canvas, SVG statici)
    raw,
};
