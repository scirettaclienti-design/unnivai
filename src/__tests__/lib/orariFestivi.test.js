// ORARI-FESTIVI — gli orari speciali di Google (currentOpeningHours, 7 giorni con date) vincono
// sull'orario della settimana per le date che coprono; oltre vale la settimana; senza dati speciali
// il comportamento e' quello di ORARI.
import { describe, it, expect, afterEach, vi } from 'vitest';
import { openStatus, localClockDate, OPEN, CLOSED, UNKNOWN, FONTE_GIORNO, FONTE_SETTIMANA } from '../../lib/openingHours';
import {
    flattenSkeleton, bucketCandidates, repairMomentSelection, scheduleMomentPlan,
    applyOpeningToBuckets, settleOpeningHours, scheduleHoursSources,
} from '../../services/momentSelection';
import { keepOpenStops } from '../../lib/openStops';
import { computeStopTimings } from '../../lib/tourTiming';
import { discoverRealPOIs } from '../../services/placesDiscoveryService';
import { normalizeNewPlace, normalizeNewResponse, normalizeCurrentHours, NEW_FIELD_MASK } from '../../../supabase/functions/places-proxy/placesNew.ts';

// sabato 17/10/2026 (CEST)
const SAB = '2026-10-17';
const at = (hhmm, day = SAB) => new Date(`${day}T${hhmm}:00+02:00`);
const P = (day, open, close, closeDay = day) => ({ open: { day, time: open }, close: { day: closeDay, time: close } });
const tutti = (open, close) => [0, 1, 2, 3, 4, 5, 6].map(d => P(d, open, close));
// finestra di Google: 13/10 → 19/10 (oggi + 6)
const FINESTRA = { from: '2026-10-13', to: '2026-10-19' };
const giorno = (date, open, close, close_date) => ({ date, open, close, ...(close_date ? { close_date } : {}) });
// una settimana normale 10:00–20:00 tutti i giorni, tranne quelli tolti/sostituiti
const settimana = (override = {}) => {
    const out = [];
    for (let d = 13; d <= 19; d++) {
        const date = `2026-10-${d}`;
        if (date in override) { for (const p of override[date] || []) out.push(giorno(date, p[0], p[1])); } else out.push(giorno(date, '1000', '2000'));
    }
    return out;
};
const current = (override, extra = {}) => ({ ...FINESTRA, periods: settimana(override), ...extra });
const posto = (extra = {}) => ({ place_id: 'x', openingPeriods: tutti('1000', '2000'), ...extra });

describe('openStatus — gli orari del giorno vincono sulla settimana', () => {
    it('un posto aperto di solito il sabato ma chiuso quel sabato (giorno speciale) e\' chiuso', () => {
        const p = posto({ currentHours: current({ [SAB]: [] }, { special_days: [SAB] }) });
        const st = openStatus(p, at('12:00'), 60);
        expect(st).toMatchObject({ stato: CLOSED, fonte: FONTE_GIORNO, speciale: true, motivo: "chiuso all'arrivo" });
        // lo stesso posto senza orari del giorno (come ORARI) e' aperto
        expect(openStatus(posto(), at('12:00'), 60)).toMatchObject({ stato: OPEN, fonte: FONTE_SETTIMANA });
    });
    it('lo stesso posto il sabato dopo (fuori dalla finestra) torna a valere la settimana', () => {
        const p = posto({ currentHours: current({ [SAB]: [] }) });
        expect(openStatus(p, at('12:00', '2026-10-24'), 60)).toMatchObject({ stato: OPEN, fonte: FONTE_SETTIMANA });
    });
    it('orario speciale ridotto: la sosta ci sta -> aperto', () => {
        const p = posto({ currentHours: current({ [SAB]: [['1000', '1300']] }) });
        expect(openStatus(p, at('11:00'), 60)).toMatchObject({ stato: OPEN, fonte: FONTE_GIORNO });
        expect(openStatus(p, at('11:00'), 120)).toMatchObject({ stato: OPEN });            // finisce alle 13:00 esatte
    });
    it('orario speciale ridotto: la sosta non ci sta -> chiuso, e dice a che ora chiude', () => {
        const p = posto({ currentHours: current({ [SAB]: [['1000', '1300']] }) });
        expect(openStatus(p, at('12:30'), 60)).toMatchObject({ stato: CLOSED, fonte: FONTE_GIORNO, chiudeAlle: '13:00' });
        // con l'orario della settimana (fino alle 20) sarebbe aperto: e' il giorno speciale a toglierlo
        expect(openStatus(posto(), at('12:30'), 60).stato).toBe(OPEN);
    });
    it('aperto di sabato solo in un giorno speciale, chiuso di norma: il giorno vince', () => {
        const p = { place_id: 'y', openingPeriods: [0, 1, 2, 3, 4, 5].map(d => P(d, '1000', '2000')), currentHours: current({ [SAB]: [['1000', '1400']] }) };
        expect(openStatus(p, at('11:00'), 60)).toMatchObject({ stato: OPEN, fonte: FONTE_GIORNO });
    });
    it('un posto con i soli orari del giorno (senza settimana) e\' noto per quei 7 giorni, sconosciuto oltre', () => {
        const p = { place_id: 'z', currentHours: current({}) };
        expect(openStatus(p, at('12:00'), 30)).toMatchObject({ stato: OPEN, fonte: FONTE_GIORNO });
        expect(openStatus(p, at('12:00', '2026-10-24'), 30).stato).toBe(UNKNOWN);
    });
    it('chiusura dopo la mezzanotte: il periodo di un giorno copre le prime ore del giorno dopo', () => {
        const p = posto({ currentHours: current({ [SAB]: [['2000', '0200']] }) });
        // il periodo e' dichiarato con close_date = domenica 18
        p.currentHours.periods = p.currentHours.periods.map(x => (x.date === SAB ? { ...x, close_date: '2026-10-18' } : x));
        expect(openStatus(p, at('23:30'), 60)).toMatchObject({ stato: OPEN, fonte: FONTE_GIORNO });
        expect(openStatus(p, at('23:30'), 180)).toMatchObject({ stato: CLOSED });          // finirebbe alle 02:30
    });
    it('una sosta che scavalca la finestra (ultimo giorno, tarda sera) cade sulla settimana, non su dati che non ha', () => {
        const p = posto({ currentHours: current({ '2026-10-19': [['1000', '2000']] }) });
        const st = openStatus(p, at('23:00', '2026-10-19'), 120);
        expect(st.fonte).toBe(FONTE_SETTIMANA);
    });
    it('currentHours senza periodi non conta: vale la settimana', () => {
        const p = posto({ currentHours: { ...FINESTRA, periods: [] } });
        expect(openStatus(p, at('12:00'), 60)).toMatchObject({ stato: OPEN, fonte: FONTE_SETTIMANA });
    });
    it('senza dati speciali il verdetto e\' quello di ORARI (stesso stato e stessi motivi)', () => {
        const museo = { place_id: 'm', openingPeriods: tutti('0900', '1800') };
        expect(openStatus(museo, at('17:15'), 60)).toMatchObject({ stato: CLOSED, chiudeAlle: '18:00', motivo: 'chiude alle 18:00, prima della fine della sosta' });
        expect(openStatus(museo, at('17:00'), 60).stato).toBe(OPEN);
        expect(openStatus({ place_id: 'n' }, at('12:00'), 30)).toEqual({ stato: UNKNOWN });
    });
    it('la data locale usa il fuso di Roma alla data vera', () => {
        expect(localClockDate(new Date('2026-10-17T22:30:00Z'), null).date).toBe('2026-10-18'); // 00:30 a Roma
    });
});

describe('motore a momenti — un posto chiuso per giorno speciale non entra quel giorno', () => {
    const moment = (key, a, b, categories) => ({ key, label: key, start: at(a), end: at(b), stops: 1, categories });
    let n = 0;
    const luogo = (name, extra, dx = 0) => ({ place_id: `f${++n}-${name}`, name, types: ['museum'], rating: 4.5, user_ratings_total: 300, latitude: 41.9, longitude: 12.48 + dx, openingPeriods: tutti('0900', '1900'), ...extra });
    const gira = (pool, aiStops) => {
        const ms = flattenSkeleton({ days: [{ moments: [moment('mattina', '09:30', '12:30', ['cultura', 'musei'])] }] });
        const raw = bucketCandidates(ms, pool);
        const veto = new Map();
        const out = settleOpeningHours({
            veto,
            repair: () => repairMomentSelection({ moments: ms, buckets: applyOpeningToBuckets(ms, raw, { veto }).buckets, aiStops, pool }),
            schedule: (plan) => scheduleMomentPlan(plan, ms[0].start),
        });
        return { out, nomi: out.sched.days.flat().map(s => s.candidate.name) };
    };
    it('il modello sceglie il museo chiuso per il giorno speciale: il codice lo sostituisce', () => {
        const chiuso = luogo('Museo In Ferie', { currentHours: current({ [SAB]: [] }, { special_days: [SAB] }) });
        const aperto = luogo('Museo Aperto', {}, 0.001);
        const r = gira([chiuso, aperto], [{ place_id: chiuso.place_id, moment: 'g1-mattina' }]);
        expect(r.nomi).toEqual(['Museo Aperto']);
        expect(r.out.residui).toEqual([]);
    });
    it('senza orari del giorno il museo "in ferie" e\' scelto come in ORARI', () => {
        const normale = luogo('Museo In Ferie', {});
        const aperto = luogo('Museo Aperto', {}, 0.001);
        expect(gira([normale, aperto], [{ place_id: normale.place_id, moment: 'g1-mattina' }]).nomi).toEqual(['Museo In Ferie']);
    });
    it('il tracciato dice da quale orario viene ogni tappa', () => {
        const ferie = luogo('Museo Orario Ridotto', { currentHours: current({ [SAB]: [['0900', '1300']] }) });
        const settimanale = luogo('Museo Settimana', {}, 0.001);
        const ms = flattenSkeleton({ days: [{ moments: [moment('mattina', '09:30', '12:30', ['cultura', 'musei'])] }] });
        const ms2 = ms.map(m => ({ ...m, stops: 2 }));
        const pool = [ferie, settimanale];
        const raw = bucketCandidates(ms2, pool);
        const { repaired, sched } = settleOpeningHours({
            veto: new Map(),
            repair: () => repairMomentSelection({ moments: ms2, buckets: raw, aiStops: [], pool }),
            schedule: (plan) => scheduleMomentPlan(plan, ms2[0].start),
        });
        expect(repaired).toBeTruthy();
        const fonti = scheduleHoursSources(sched);
        expect(fonti.get(ferie.place_id)).toBe(FONTE_GIORNO);
        expect(fonti.get(settimanale.place_id)).toBe(FONTE_SETTIMANA);
    });
});

describe('liste senza scheletro (Per Te, Veloce serale, Sorprendimi) — keepOpenStops', () => {
    let n = 0;
    const luogo = (name, extra = {}, dx = 0) => ({ place_id: `k${++n}-${name}`, name, title: name, types: ['museum'], latitude: 41.9, longitude: 12.48 + dx, openingPeriods: tutti('0900', '1900'), ...extra });
    const timed = (l) => computeStopTimings(l).stops;
    const run = (pool, picks, start) => keepOpenStops({ stops: timed(picks), pool, start, retime: timed, toStop: (c) => ({ ...c }) });
    it('una tappa chiusa per il giorno speciale e\' sostituita; la fonte va sulla tappa', () => {
        const a = luogo('Aperto 1');
        const ferie = luogo('In Ferie', { currentHours: current({ [SAB]: [] }) }, 0.001);
        const b = luogo('Aperto 2', {}, 0.002);
        const sostituto = luogo('Sostituto', { currentHours: current({}) }, 0.0015);
        const r = run([a, ferie, b, sostituto], [a, ferie, b], at('10:00'));
        const nomi = r.stops.map(s => s.name);
        expect(nomi).not.toContain('In Ferie');
        expect(nomi).toContain('Sostituto');
        expect(r.stops.find(s => s.name === 'Sostituto')._orarioFonte).toBe(FONTE_GIORNO);
        expect(r.stops.find(s => s.name === 'Aperto 1')._orarioFonte).toBe(FONTE_SETTIMANA);
    });
    it('senza orari del giorno la lista e\' quella di ORARI', () => {
        const a = luogo('Aperto 1'), b = luogo('Aperto 2', {}, 0.001);
        const r = run([a, b], [a, b], at('10:00'));
        expect(r.stops.map(s => s.name)).toEqual(['Aperto 1', 'Aperto 2']);
        expect(r.chiuse).toEqual([]);
    });
});

describe('proxy — currentOpeningHours normalizzato', () => {
    const NOW = Date.UTC(2026, 9, 13, 8, 0); // 13/10 10:00 a Roma
    const d = (day) => ({ year: 2026, month: 10, day });
    const google = {
        openNow: true,
        periods: [
            { open: { day: 2, hour: 9, minute: 30, date: d(13) }, close: { day: 2, hour: 19, minute: 0, date: d(13) } },
            { open: { day: 6, hour: 20, minute: 0, date: d(17) }, close: { day: 0, hour: 1, minute: 0, date: d(18) } },
        ],
        specialDays: [{ date: d(17) }],
    };
    it('periodi con data, finestra di 7 giorni dal giorno del posto, giorni speciali', () => {
        const c = normalizeCurrentHours(google, NOW, 120);
        expect(c).toEqual({
            from: '2026-10-13', to: '2026-10-19',
            periods: [
                { date: '2026-10-13', open: '0930', close: '1900' },
                { date: '2026-10-17', open: '2000', close: '0100', close_date: '2026-10-18' },
            ],
            special_days: ['2026-10-17'],
        });
    });
    it('la data del posto segue il fuso: a mezzanotte e mezza in Italia e' + "' gia' il giorno dopo", () => {
        const c = normalizeCurrentHours({ periods: [{ open: { day: 3, hour: 9, minute: 0, date: d(14) }, close: { day: 3, hour: 18, minute: 0, date: d(14) } }] }, Date.UTC(2026, 9, 13, 22, 30), 120);
        expect(c.from).toBe('2026-10-14');
    });
    it('senza periodi o senza date: nessun dato (vale la settimana)', () => {
        expect(normalizeCurrentHours(undefined, NOW, 120)).toBeNull();
        expect(normalizeCurrentHours({ periods: [] }, NOW, 120)).toBeNull();
        expect(normalizeCurrentHours({ periods: [{ open: { day: 1, hour: 9, minute: 0 } }] }, NOW, 120)).toBeNull();
    });
    it('il posto normalizzato porta current_opening_hours; senza il campo l\'oggetto e\' quello di prima', () => {
        const base = { id: 'p1', displayName: { text: 'Museo' }, location: { latitude: 41.9, longitude: 12.48 }, types: ['museum'], utcOffsetMinutes: 120,
            regularOpeningHours: { openNow: true, periods: [{ open: { day: 1, hour: 9, minute: 0 }, close: { day: 1, hour: 18, minute: 0 } }] } };
        const senza = normalizeNewPlace(base, NOW);
        expect(senza).not.toHaveProperty('current_opening_hours');
        const con = normalizeNewPlace({ ...base, currentOpeningHours: google }, NOW);
        expect(con.current_opening_hours.from).toBe('2026-10-13');
        const { current_opening_hours: _c, ...resto } = con;
        expect(resto).toEqual(senza);
        expect(normalizeNewResponse({ places: [{ ...base, currentOpeningHours: google }] }, NOW).results[0].current_opening_hours.periods).toHaveLength(2);
    });
    it('la maschera chiede il campo', () => {
        expect(NEW_FIELD_MASK.split(',')).toContain('places.currentOpeningHours');
    });
});

describe('candidato — currentHours', () => {
    afterEach(() => vi.unstubAllGlobals());
    const cerca = async (results) => {
        window.localStorage.clear();
        vi.stubGlobal('fetch', async (url) => {
            if (String(url).includes('textsearch')) return { ok: true, json: async () => ({ status: 'OK', results }) };
            throw new Error(`fetch inatteso: ${url}`);
        });
        return discoverRealPOIs('Catania', 37.5, 15.08, 'food');
    };
    const base = { place_id: 'pid-1', name: 'Trattoria Uno', rating: 4.5, user_ratings_total: 400, business_status: 'OPERATIONAL', types: ['restaurant'], geometry: { location: { lat: 37.5, lng: 15.08 } } };
    it('il candidato porta currentHours se il proxy lo manda', async () => {
        const ch = { from: '2026-10-13', to: '2026-10-19', periods: [{ date: '2026-10-13', open: '1200', close: '2300' }] };
        const [c] = await cerca([{ ...base, current_opening_hours: ch }]);
        expect(c.currentHours).toEqual(ch);
    });
    it('senza il campo il candidato non ha currentHours (chiavi di ORARI)', async () => {
        const [c] = await cerca([base]);
        expect(c).not.toHaveProperty('currentHours');
    });
});
