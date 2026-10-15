// PORTA-UNICA / MERGE-3 — la versione che si vede in fondo al Profilo: «Versione <commit corto> · <data del build>».
// Il commit e la data li mette il build (vite.config.js: define __DV_COMMIT__ / __DV_BUILD__): su Vercel il commit e' quello che il
// sistema fornisce (VERCEL_GIT_COMMIT_SHA); in locale (vite serve, test) non c'e' e si scrive «sviluppo».

/** Il testo della riga. `commit` pieno o corto (si taglia a 7), `buildIso` la data del build (ISO). Senza commit: «Versione sviluppo». */
export function testoVersione(commit, buildIso) {
    const sha = String(commit || '').trim().slice(0, 7);
    if (!sha) return 'Versione sviluppo';
    const d = new Date(buildIso);
    if (!buildIso || Number.isNaN(d.getTime())) return `Versione ${sha}`;
    const data = new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
    return `Versione ${sha} · ${data}`;
}

/* global __DV_COMMIT__, __DV_BUILD__ */
export const VERSIONE_APP = testoVersione(
    typeof __DV_COMMIT__ !== 'undefined' ? __DV_COMMIT__ : '',
    typeof __DV_BUILD__ !== 'undefined' ? __DV_BUILD__ : '',
);
