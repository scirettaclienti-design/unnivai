/**
 * Gate NARRATORE ANCORATO — DIFF 4 FASE B: l'innesto dei guard nel motore.
 *
 * La Fase A ha scritto gli invarianti come funzione pura, e li ha testati su
 * oggetti letterali. Questo file verifica una cosa diversa e piu' stretta: che
 * quegli invarianti vengano applicati AL VERO output del motore, cioe' alle
 * tappe canonizzate da `canonicalizeStopsFromCandidates`.
 *
 * La Fase B e' SOLO LOG. Il test piu' importante qui non e' quello che verifica
 * il warn: e' `il numero di tappe e' invariato`. E' la prova che l'innesto non
 * cambia comportamento — bundle diverso, output identico. Se un domani qualcuno
 * fara' la Fase C (annullare i campi in violazione), quel test diventera' rosso,
 * ed e' esattamente quello che deve fare: la Fase C e' una DECISIONE, non
 * manutenzione, e non deve poter entrare di soppiatto.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { canonicalizeStopsFromCandidates } from '@/services/aiRecommendationService';

const CANDIDATES = [
    { place_id: 'p1', name: 'Basilica di San Nicola', latitude: 41.13, longitude: 16.87, type: 'cultura', city: 'Bari' },
    { place_id: 'p2', name: 'Castello Svevo', latitude: 41.12, longitude: 16.86, type: 'storia', city: 'Bari' },
];

/** Uno stop AI minimo: `place_id` + i campi di testo che il narratore produce. */
const stop = (place_id, campi) => ({ place_id, time: '10:00', suggestedMinutes: 45, ...campi });

describe('DIFF 4 FASE B — innesto dei guard in canonicalizeStopsFromCandidates', () => {
    let warn;

    beforeEach(() => {
        // setup.js silenzia console.warn a livello di modulo. Qui la si ri-spia
        // per POTERLA LEGGERE: senza questo il marker non sarebbe osservabile.
        warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        warn.mockRestore();
    });

    /** Tutte le righe di warn che portano il marker della Fase B. */
    const violazioniLoggate = () =>
        warn.mock.calls.map(c => String(c[0])).filter(m => m.includes('[Narratore] VIOLAZIONE'));

    it('un orario affermato nella description viene loggato con campo e nome POI', () => {
        const aiStops = [stop('p1', { description: 'La basilica chiude alle 19, arriva prima.' })];

        canonicalizeStopsFromCandidates(aiStops, CANDIDATES);

        const righe = violazioniLoggate();
        expect(righe).toHaveLength(1);
        expect(righe[0]).toContain('no-orario-affermato');
        expect(righe[0]).toContain('description');
        // Il nome POI e' quello CANONICO di Google, non quello che l'AI credeva:
        // serve a rendere la riga di log utile in produzione.
        expect(righe[0]).toContain('Basilica di San Nicola');
    });

    it('un riferimento al presente viene loggato', () => {
        const aiStops = [stop('p2', { insiderTip: 'Adesso il cortile e\' quasi vuoto.' })];

        canonicalizeStopsFromCandidates(aiStops, CANDIDATES);

        const righe = violazioniLoggate();
        expect(righe).toHaveLength(1);
        expect(righe[0]).toContain('no-presente-affermato');
        expect(righe[0]).toContain('insiderTip');
        expect(righe[0]).toContain('Castello Svevo');
    });

    it('due description identiche producono la violazione di tour, non solo di tappa', () => {
        const testo = 'Un luogo che vale la sosta.';
        const aiStops = [stop('p1', { description: testo }), stop('p2', { description: testo })];

        canonicalizeStopsFromCandidates(aiStops, CANDIDATES);

        const righe = violazioniLoggate();
        expect(righe.some(r => r.includes('no-description-duplicata'))).toBe(true);
        // Prova che si guarda il TOUR e non lo stop isolato: un duplicato non e'
        // visibile a `findViolations`, che vede una tappa alla volta.
        expect(righe.some(r => r.includes('Castello Svevo'))).toBe(true);
    });

    it('tappe pulite non producono nessun marker', () => {
        const aiStops = [
            stop('p1', { description: 'Tre navate romaniche e la cripta con le reliquie.' }),
            stop('p2', { description: 'Fortezza normanna ampliata da Federico II.' }),
        ];

        canonicalizeStopsFromCandidates(aiStops, CANDIDATES);

        expect(violazioniLoggate()).toHaveLength(0);
    });

    // ─── La prova che la Fase B non cambia comportamento ──────────────────────
    it('il numero di tappe e\' invariato a parita\' di input, anche con violazioni', () => {
        const aiStops = [
            stop('p1', { description: 'Chiude alle 19 e adesso e\' pieno.' }),
            stop('p2', { description: 'Chiude alle 19 e adesso e\' pieno.' }),
        ];

        const risultato = canonicalizeStopsFromCandidates(aiStops, CANDIDATES);

        // Due stop in ingresso, due in uscita: nessuna tappa scartata dai guard.
        expect(risultato).toHaveLength(2);
        // E i campi in violazione sono ancora AL LORO POSTO, non annullati.
        // E' la riga che la Fase C dovra' cambiare esplicitamente.
        expect(risultato[0].description).toBe('Chiude alle 19 e adesso e\' pieno.');
        expect(risultato[1].description).toBe('Chiude alle 19 e adesso e\' pieno.');
        // Il logging non ha toccato nemmeno i campi canonici di Google.
        expect(risultato[0].title).toBe('Basilica di San Nicola');
        expect(risultato[0].latitude).toBe(41.13);
    });

    it('lo scarto per place_id sconosciuto resta l\'unica ragione per perdere una tappa', () => {
        const aiStops = [
            stop('p1', { description: 'Chiude alle 19.' }),
            stop('inesistente', { description: 'Testo pulito.' }),
        ];

        const risultato = canonicalizeStopsFromCandidates(aiStops, CANDIDATES);

        // La tappa in violazione resta, quella con place_id inventato no.
        expect(risultato).toHaveLength(1);
        expect(risultato[0].title).toBe('Basilica di San Nicola');
    });
});
