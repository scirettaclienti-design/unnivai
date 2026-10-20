/**
 * NAV-1-FIX — le regole senza la pagina: tappa superata dopo una pausa (D1), conferma dell'arrivo (D2), centro della
 * mappa dal giro salvato (D3), link «Apri in Mappe» per piattaforma.
 */
import { describe, it, expect } from 'vitest';
import { valutaPassaggio, NAV_PASSAGGIO } from '@/lib/navPassaggio';
import { valutaArrivo, NAV_ARRIVO } from '@/lib/navArrivo';
import { centroDelGiro } from '@/lib/navSession';
import { linkMappe, usaMappeApple } from '@/lib/navMessaggi';

const sposta = (p, est, nord) => ({ lat: p.lat + nord / 111320, lng: p.lng + est / (111320 * Math.cos((p.lat * Math.PI) / 180)) });
const R = 6371000, rad = (x) => (x * Math.PI) / 180;
const d = (a, b) => 2 * R * Math.asin(Math.sqrt(Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2));

describe('D1 — dopo una pausa: «oltre» solo se non ci stai ancora arrivando', () => {
    const paese = { lat: 37.78, lng: 14.6 };
    const monte = sposta(paese, 0, 900);
    const bar = sposta(paese, 100, 50);
    const tick = (st, pos, now) => valutaPassaggio(st, {
        stepId: 'monte', dist: d(pos, monte), soglia: 25, now, pos,
        distDopoDaUtente: d(pos, bar), distDopoDaTappa: d(monte, bar),
    });

    it('Monte Muganà: a metà salita, più vicino al bar che il monte, nessuna domanda', () => {
        const prima = sposta(paese, 0, 300);
        const dopo = sposta(paese, 0, 445);
        expect(d(dopo, bar) + NAV_PASSAGGIO.OLTRE_MARGINE_M).toBeLessThan(d(monte, bar)); // la regola di NAV-1 avrebbe chiesto
        let { st } = tick(null, prima, 0);
        const r = tick(st, dopo, NAV_PASSAGGIO.PAUSA_MS + 60_000);
        expect(r.superata).toBe(false);
    });

    it('passata davvero (eri a 60 m, ora sei 90 m oltre verso la tappa dopo): superata', () => {
        const tappa = { lat: 37.505, lng: 15.085 };
        const dopoT = sposta(tappa, 300, 0);
        const prima = sposta(tappa, -60, 0);
        const ora = sposta(tappa, 90, 0);
        const t = (st, pos, now) => valutaPassaggio(st, { stepId: 'x', dist: d(pos, tappa), soglia: 25, now, pos, distDopoDaUtente: d(pos, dopoT), distDopoDaTappa: d(tappa, dopoT) });
        const { st } = t(null, prima, 0);
        expect(t(st, ora, NAV_PASSAGGIO.PAUSA_MS + 1).superata).toBe(true);
    });
});

describe('D2 — l\'arrivo vuole due letture di fila dentro la soglia', () => {
    it('una dentro e una fuori azzera; due di fila scattano; senza armatura no', () => {
        expect(NAV_ARRIVO.CONFERME).toBe(2);
        let r = valutaArrivo(null, { stepId: 'a', dist: 24, soglia: 25, puoScattare: true });
        expect(r.scattato).toBe(false);
        r = valutaArrivo(r.st, { stepId: 'a', dist: 41, soglia: 25, puoScattare: true });
        expect(r.conferme).toBe(0);
        r = valutaArrivo(r.st, { stepId: 'a', dist: 20, soglia: 25, puoScattare: true });
        r = valutaArrivo(r.st, { stepId: 'a', dist: 12, soglia: 25, puoScattare: true });
        expect(r.scattato).toBe(true);
        const n = valutaArrivo(valutaArrivo(null, { stepId: 'b', dist: 5, soglia: 25, puoScattare: false }).st, { stepId: 'b', dist: 5, soglia: 25, puoScattare: false });
        expect(n.scattato).toBe(false);
        // la tappa cambia: si riparte da zero
        expect(valutaArrivo(r.st, { stepId: 'c', dist: 5, soglia: 25, puoScattare: true }).scattato).toBe(false);
    });
});

describe('D3 — il centro della mappa dal giro in corso', () => {
    const tour = { id: 't', steps: [{ id: 'a', lat: 1, lng: 2 }, { id: 'b', lat: 3, lng: 4 }, { lat: 5, lng: 6 }] };
    it('la prima tappa né fatta né saltata; il bersaglio di «Naviga»; null per un altro tour', () => {
        expect(centroDelGiro({ chiave: 'id:t', completedSteps: ['a'], skippedSteps: ['b'] }, tour)).toEqual({ latitude: 5, longitude: 6 });
        expect(centroDelGiro({ chiave: 'id:t', completedSteps: [], targetStepId: 'b' }, tour)).toEqual({ latitude: 3, longitude: 4 });
        expect(centroDelGiro({ chiave: 'id:altro', completedSteps: [] }, tour)).toBeNull();
        expect(centroDelGiro(null, tour)).toBeNull();
    });
});

describe('«Apri in Mappe» — Apple su iPhone, Google altrove, solo le coordinate della tappa', () => {
    const IPHONE = { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148', maxTouchPoints: 5 };
    const IPAD = { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15', maxTouchPoints: 5 };
    const MAC = { userAgent: IPAD.userAgent, maxTouchPoints: 0 };
    const ANDROID = { userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/128 Mobile Safari/537.36', maxTouchPoints: 5 };
    it('la piattaforma', () => {
        expect(usaMappeApple(IPHONE)).toBe(true);
        expect(usaMappeApple(IPAD)).toBe(true);
        expect(usaMappeApple(MAC)).toBe(false);
        expect(usaMappeApple(ANDROID)).toBe(false);
        expect(usaMappeApple(null)).toBe(false);
    });
    it('i link: a piedi, solo la destinazione', () => {
        const tappa = { latitude: 37.7845, longitude: 14.5972 };
        expect(linkMappe(tappa, 'walking', { apple: true })).toBe('https://maps.apple.com/?daddr=37.7845,14.5972&dirflg=w');
        expect(linkMappe(tappa, 'walking', { apple: false })).toBe('https://www.google.com/maps/dir/?api=1&destination=37.7845,14.5972&travelmode=walking');
        expect(linkMappe(tappa, 'driving', { apple: false })).toContain('travelmode=driving');
        for (const apple of [true, false]) {
            const u = linkMappe(tappa, 'walking', { apple });
            expect(u).not.toMatch(/saddr|origin|user|email|id=/i);
        }
    });
});
