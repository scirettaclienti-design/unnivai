// DNA-5 — i tre utenti finti della prova: (A) lento e culturale, (B) veloce e a piedi tanto, (C) famiglia con bambini.
// Ognuno ha un registro del DNA finto (righe di dna_events come le scrive l'app: stop_reached con km, sosta prevista e tipo nel
// `value`, tour_completed, company_chosen) e, per C, la compagnia impostata dal Profilo. Ritmo e compagnia NON sono scritti a mano:
// li calcolano le funzioni vere (ritmoAppreso, ritmoDelGiro, compagniaDelGiro) da questi dati. Dati puri, nessuna rete.
import { valoreTappaRaggiunta } from '../../src/lib/dnaRitmo.js';
import { pesiDaEventi } from '../../src/services/preferenceEngine.js';

const WALK = 4.5; // km/h, come tourTiming.WALKING_KMH

/**
 * Le righe di un giro finito: arrivo alla tappa i+1 = arrivo a i + sosta vera di i + cammino (km / 4,5 km/h).
 * @param {string} tourId
 * @param {string} inizio ISO
 * @param {{ cat: string, tipo: string|null, prevista: number, vera: number, km: number }[]} tappe  km = dalla tappa prima
 */
export function giroFinto(tourId, inizio, tappe, citta = 'Roma') {
    let t = new Date(inizio).getTime();
    const righe = [];
    tappe.forEach((x, i) => {
        if (i > 0) t += (tappe[i - 1].vera + (x.km / WALK) * 60) * 60000;
        righe.push({
            id: `${tourId}-${i}`, kind: 'stop_reached', category: x.cat, city: citta, tour_id: tourId,
            value: valoreTappaRaggiunta({ km: i === 0 ? null : x.km, sosta: x.prevista, tipo: x.tipo }), created_at: new Date(t).toISOString(),
        });
    });
    const fine = new Date(t + 60000).toISOString();
    for (const c of [...new Set(tappe.map(x => x.cat))]) {
        righe.push({ id: `${tourId}-fine-${c}`, kind: 'tour_completed', category: c, city: citta, tour_id: tourId, value: `${tappe.length}/${tappe.length}`, created_at: fine });
    }
    return righe;
}

const scelta = (id, kind, value, quando) => ({ id, kind, category: null, city: 'Roma', tour_id: null, value, created_at: quando });

// (A) lento e culturale: 4 giri da 3 tappe (musei e chiese), soste piu' lunghe della stima, tratti brevi
const museo = (vera, km) => ({ cat: 'cultura', tipo: 'museo', prevista: 60, vera, km });
const chiesa = (vera, km) => ({ cat: 'cultura', tipo: 'chiesa', prevista: 20, vera, km });
const REGISTRO_A = [
    ...giroFinto('a1', '2026-10-10T09:30:00+02:00', [museo(78, 0), chiesa(27, 0.35), museo(80, 0.4)]),
    ...giroFinto('a2', '2026-10-17T10:00:00+02:00', [chiesa(26, 0), museo(76, 0.3), museo(70, 0.45)]),
    ...giroFinto('a3', '2026-10-24T09:45:00+02:00', [museo(82, 0), chiesa(25, 0.5), museo(75, 0.3)]),
    ...giroFinto('a4', '2026-10-31T10:15:00+01:00', [museo(74, 0), museo(79, 0.4), chiesa(24, 0.35)]),
];

// (B) veloce e a piedi tanto: 4 giri da 6 tappe, soste corte, tratti da 0,8–1,1 km
const verde = (vera, km) => ({ cat: 'natura', tipo: 'verde', prevista: 30, vera, km });
const luogo = (vera, km) => ({ cat: 'cultura', tipo: null, prevista: 30, vera, km });
const caffe = (vera, km) => ({ cat: 'food', tipo: 'caffe', prevista: 20, vera, km });
const REGISTRO_B = [
    ...giroFinto('b1', '2026-10-11T08:30:00+02:00', [caffe(12, 0), verde(20, 0.9), luogo(18, 1.0), verde(21, 0.8), luogo(16, 1.1), verde(22, 0.95)]),
    ...giroFinto('b2', '2026-10-18T08:45:00+02:00', [verde(19, 0), luogo(17, 1.0), caffe(11, 0.85), verde(20, 1.05), luogo(19, 0.9), verde(18, 1.0)]),
    ...giroFinto('b3', '2026-10-25T09:00:00+01:00', [luogo(18, 0), verde(21, 0.95), verde(19, 1.1), caffe(12, 0.8), luogo(17, 1.0), verde(20, 0.9)]),
    ...giroFinto('b4', '2026-11-01T08:30:00+01:00', [verde(22, 0), luogo(16, 1.0), verde(20, 0.9), luogo(18, 1.05), caffe(13, 0.85), verde(19, 1.0)]),
    scelta('b-c1', 'company_chosen', 'amici', '2026-10-11T08:00:00+02:00'),
    scelta('b-c2', 'company_chosen', 'amici', '2026-10-18T08:00:00+02:00'),
    scelta('b-c3', 'company_chosen', 'amici', '2026-10-25T08:00:00+01:00'),
];

// (C) famiglia con bambini: 2 giri da 4 tappe nel verde e un dolce, ritmo medio; la compagnia «famiglia» e' impostata nel Profilo
const dolce = (vera, km) => ({ cat: 'food', tipo: 'dolce', prevista: 20, vera, km });
const REGISTRO_C = [
    ...giroFinto('c1', '2026-10-19T10:00:00+02:00', [verde(40, 0), luogo(30, 0.6), dolce(25, 0.5), verde(35, 0.7)]),
    ...giroFinto('c2', '2026-10-26T10:30:00+01:00', [verde(38, 0), dolce(22, 0.55), luogo(28, 0.6), verde(36, 0.65)]),
];

export const ORA_PROVA = '2026-11-05T09:00:00+01:00';
export const UTENTI = {
    A: {
        nome: 'A — lento e culturale', registro: REGISTRO_A,
        pesi: { cultura: 0.9, arte: 0.5, food: 0.2, natura: 0.1, nightlife: 0, avventura: 0, shopping: 0, relax: 0.1, _share: 0.45 },
        onboardingPrefs: { dieta: [], budget: null, stile: null, ritmo: null, compagnia: null }, interessi: ['cultura', 'arte'],
    },
    B: {
        nome: 'B — veloce e a piedi tanto', registro: REGISTRO_B,
        pesi: { natura: 0.8, food: 0.5, cultura: 0.3, arte: 0, nightlife: 0.1, avventura: 0.2, shopping: 0, relax: 0.1, _share: 0.45 },
        onboardingPrefs: { dieta: [], budget: null, stile: null, ritmo: null, compagnia: null }, interessi: ['natura', 'food'],
    },
    C: {
        nome: 'C — famiglia con bambini', registro: REGISTRO_C,
        pesi: { natura: 0.7, avventura: 0.5, food: 0.4, cultura: 0.2, arte: 0, nightlife: 0, shopping: 0, relax: 0.2, _share: 0.45 },
        onboardingPrefs: { dieta: [], budget: null, stile: null, ritmo: null, compagnia: 'famiglia' }, interessi: ['natura', 'avventura'],
    },
};

/** Ritmo e compagnia suggeriti dalle scelte passate (come useAILearning: pesiDaEventi(...).ritmo / .compagnia). */
export const preferenzeDi = (u) => {
    const p = pesiDaEventi(u.registro, [], ORA_PROVA);
    return { ritmoPreferito: p.ritmo, compagniaPreferita: p.compagnia };
};
