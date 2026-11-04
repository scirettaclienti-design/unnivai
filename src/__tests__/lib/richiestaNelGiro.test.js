// BANCO-DIFETTI-2 (T23, D6) — la richiesta precisa si rispetta, o il giro dice perché no.
import { describe, it, expect } from 'vitest';
import { nomiPropri, vociDellaRichiesta, luogoCorrisponde, isTransito, rispettaRichiesta, voceNelGiro } from '@/lib/richiestaNelGiro';
import { provaInserire } from '@/lib/inserisciTappa';
import { TESTI_GIRO } from '@/lib/testiGiro';

// 5/11/2026, ora di Roma = UTC+1
const T = (hm) => new Date(`2026-11-05T${hm}:00+01:00`);
const M = (key, da, a) => ({ id: `g1-${key}`, key, label: key, dayIndex: 0, start: T(da), end: T(a) });
const MATTINA = M('mattina', '09:30', '12:30');
const PRANZO = M('pranzo', '12:30', '14:30');
const POMERIGGIO = M('pomeriggio', '14:30', '18:00');
const CENA = M('cena', '20:00', '22:30');
const momenti = [MATTINA, PRANZO, POMERIGGIO, CENA];
const posto = (name, lat, lng, extra = {}) => ({ place_id: `id-${name}`, name, latitude: lat, longitude: lng, types: ['tourist_attraction'], rating: 4.5, user_ratings_total: 1000, ...extra });
const voce = (c, moment, hm) => ({ candidate: c, moment, start: T(hm), waitMinutesBefore: 0, source: 'modello' });
const sempreAperto = () => true;
const base = { capKm: 1.2, aperto: sempreAperto, momentiDi: () => momenti, fineDi: () => T('22:30'), citta: 'Roma', minutiDi: (d) => d.getHours() * 60 + d.getMinutes() };

const FERMATA = posto('Colosseo', 41.8915, 12.4915, { place_id: 'id-fermata-colosseo', types: ['subway_station', 'transit_station', 'point_of_interest'], primaryType: 'subway_station' });
const FORI = posto('Via dei Fori Imperiali', 41.8932, 12.4871, { types: ['route'] });
const COLOSSEO = posto('Colosseo', 41.8902, 12.4922, { types: ['historical_landmark', 'tourist_attraction'], user_ratings_total: 510970 });

describe('D6 — la richiesta: cosa chiede la frase', () => {
    it('i luoghi per nome (non la città, non le parole comuni in testa)', () => {
        expect(nomiPropri('Un pomeriggio tra Colosseo e Fori Imperiali a Roma', 'Roma')).toEqual(['Colosseo', 'Fori Imperiali']);
        expect(nomiPropri('Una giornata a Roma tra Vaticano e centro storico', 'Roma')).toEqual(['Vaticano']);
        expect(nomiPropri('Domani, una giornata a Polignano a Mare', 'Polignano a Mare')).toEqual([]);
        expect(nomiPropri('Cioccolato e cucina tipica a Scicli', 'Scicli')).toEqual([]);
    });
    it('i tipi di posto, il tema, il pasto, l\'ora; nel Veloce solo i tipi precisi', () => {
        const v = vociDellaRichiesta({ testo: 'Pranzo e giro ai mercati di Ballarò e del Capo a Palermo', pathType: 'custom', citta: 'Palermo' });
        expect(v.map(x => x.id)).toEqual(['luogo:ballaro', 'luogo:capo', 'mercati', 'pranzo']);
        expect(vociDellaRichiesta({ testo: 'Natura e panorami a Troina', pathType: 'custom', citta: 'Troina' }).map(x => [x.id, !!x.tutte])).toEqual([['natura', true], ['panorami', false]]);
        expect(vociDellaRichiesta({ testo: 'Un giro a Roma alle 15', pathType: 'custom', citta: 'Roma' })).toEqual([{ tipo: 'ora', id: 'ora', cosa: 'ora', minuti: 900 }]);
        expect(vociDellaRichiesta({ testo: 'A Catania cerco: spa, hammam, terme, centri benessere. Escludi: cattedrali, musei.', pathType: 'quick' }).map(x => x.id)).toEqual(['spa']);
        // nel Quiz la categoria larga la misura il Gate RAGGIO-CATEGORIA, non questa regola; Sorprendimi non chiede niente
        expect(vociDellaRichiesta({ testo: 'A Roma cerco: parchi, giardini, natura.', pathType: 'quick' })).toEqual([]);
        expect(vociDellaRichiesta({ testo: 'Genera un\'esperienza a sorpresa a Firenze', pathType: undefined })).toEqual([]);
        // la parte negata non e' una richiesta
        expect(vociDellaRichiesta({ testo: 'Una giornata a Roma, niente musei', pathType: 'custom', citta: 'Roma' })).toEqual([]);
    });
    it('un posto corrisponde al nome chiesto (stessa radice); la fermata dei mezzi è riconosciuta', () => {
        expect(luogoCorrisponde({ name: 'Musei Vaticani' }, 'Vaticano')).toBe(true);
        expect(luogoCorrisponde({ name: 'Mercato del Capo' }, 'Capo')).toBe(true);
        expect(luogoCorrisponde({ name: 'Piazza Ballaro' }, 'Ballarò')).toBe(true);
        expect(luogoCorrisponde({ name: 'Foro Romano' }, 'Fori Imperiali')).toBe(false);
        expect(isTransito(FERMATA)).toBe(true);
        expect(isTransito(COLOSSEO)).toBe(false);
    });
});

describe('D6 — la richiesta: il giro la rispetta', () => {
    it('il Colosseo vero prende il posto della fermata col suo nome (n-roma-1300-specifica)', () => {
        const sched = { days: [[voce(FERMATA, POMERIGGIO, '14:30'), voce(FORI, POMERIGGIO, '15:10')]] };
        const voci = vociDellaRichiesta({ testo: 'Un pomeriggio tra Colosseo e Fori Imperiali a Roma', pathType: 'custom', citta: 'Roma' });
        const r = rispettaRichiesta({ ...base, sched, voci, candidati: [FERMATA, COLOSSEO, FORI] });
        const nomi = r.sched.days[0].map(e => `${e.candidate.name}|${e.candidate.primaryType ?? e.candidate.types[0]}`);
        expect(nomi).toContain('Colosseo|historical_landmark');
        expect(nomi.some(n => n.endsWith('subway_station'))).toBe(false);
        expect(r.note).toEqual([]);
        expect(r.sched.days[0].find(e => e.candidate === COLOSSEO).source).toBe('richiesta');
    });

    it('il tipo chiesto entra in un\'attesa del pomeriggio, entro 1,2 km, senza spostare la tappa dopo (cioccolato a Scicli)', () => {
        const chiesa = posto('Chiesa di San Matteo', 36.7926, 14.7088, { types: ['church'] });
        const palazzo = posto('Palazzo Beneventano', 36.7936, 14.7061);
        const cena = posto('Osteria', 36.7938, 14.7049, { types: ['restaurant'], primaryType: 'restaurant' });
        const cioccolato = posto('Crema & Cioccolato Scicli', 36.7930, 14.7060, { types: ['ice_cream_shop', 'chocolate_shop'], primaryType: 'ice_cream_shop' });
        const sched = { days: [[voce(chiesa, POMERIGGIO, '14:30'), voce(palazzo, POMERIGGIO, '15:05'), voce(cena, CENA, '20:00')]] };
        const voci = vociDellaRichiesta({ testo: 'Cioccolato e cucina tipica a Scicli', pathType: 'custom', citta: 'Scicli' });
        const r = rispettaRichiesta({ ...base, citta: 'Scicli', sched, voci, candidati: [cioccolato] });
        const day = r.sched.days[0];
        const i = day.findIndex(e => e.candidate === cioccolato);
        expect(i).toBe(2);
        expect(day[i].start.getTime()).toBeGreaterThanOrEqual(POMERIGGIO.start.getTime());
        expect(day[i + 1].start.getTime()).toBe(T('20:00').getTime());
        expect(r.report.find(x => x.voce === 'cioccolato').esito).toBe('inserita');
    });

    it('chiuso a tutte le ore possibili: il giro lo dice (spa a Catania alle 23:15)', () => {
        const SERA = M('dopocena', '23:00', '01:30');
        const bar = posto('Bar Popolare', 37.5022, 15.0849, { types: ['bar'] });
        const spa = posto('Magma Harmony SPA', 37.5022, 15.0915, { types: ['spa'], primaryType: 'spa' });
        const sched = { days: [[voce(bar, SERA, '23:15')]] };
        const voci = vociDellaRichiesta({ testo: 'A Catania cerco: spa, hammam, terme, centri benessere.', pathType: 'quick' });
        const r = rispettaRichiesta({ ...base, citta: 'Catania', momentiDi: () => [SERA], fineDi: () => T('23:59'), sched, voci, candidati: [spa], aperto: () => false });
        expect(r.note).toEqual([TESTI_GIRO.richiesta.chiuso({ cosa: 'spa e centri benessere', citta: 'Catania' })]);
        expect(r.note[0]).toBe('Spa e centri benessere: a Catania quelli trovati sono chiusi nelle ore del giro.');
        expect(r.sched.days[0]).toHaveLength(1);
    });

    it('oltre il tetto di 1,2 km a piedi: il giro lo dice con i km, il tetto non si tocca', () => {
        const pantheon = posto('Pantheon', 41.8986, 12.4769);
        const trevi = posto('Fontana di Trevi', 41.9009, 12.4833);
        const musei = posto('Musei Vaticani', 41.9065, 12.4536, { types: ['museum'] });
        const sched = { days: [[voce(pantheon, MATTINA, '09:30'), voce(trevi, MATTINA, '11:00')]] };
        const voci = vociDellaRichiesta({ testo: 'Una giornata a Roma tra Vaticano e centro storico', pathType: 'custom', citta: 'Roma' });
        const r = rispettaRichiesta({ ...base, sched, voci, candidati: [musei] });
        expect(r.note[0]).toMatch(/^Vaticano: Musei Vaticani è a 2,1 km dalle tappe del giro, oltre 1,2 km a piedi\.$/);
        // con il ritmo Intenso (qualche mezzo, 5 km) entra
        const intenso = rispettaRichiesta({ ...base, capKm: 5, sched, voci, candidati: [musei] });
        expect(intenso.note).toEqual([]);
        expect(intenso.sched.days[0].map(e => e.candidate.name)).toContain('Musei Vaticani');
    });

    it('il tema per tutto il giro: una visita che non è di natura si cambia, quelle che restano si dicono', () => {
        const teatro = posto('Teatro Massimo', 38.1203, 13.3575, { types: ['performing_arts_theater'], primaryType: 'performing_arts_theater' });
        const pretoria = posto('Piazza Pretoria', 38.1156, 13.3619, { types: ['route'] });
        const villa = posto('Villa Bonanno', 38.1124, 13.3552, { types: ['park'], primaryType: 'park' });
        const sched = { days: [[voce(teatro, MATTINA, '09:30'), voce(pretoria, MATTINA, '10:30')]] };
        const voci = vociDellaRichiesta({ testo: 'Natura a Palermo', pathType: 'custom', citta: 'Palermo' });
        const r = rispettaRichiesta({ ...base, citta: 'Palermo', sched, voci, candidati: [villa] });
        const nomi = r.sched.days[0].map(e => e.candidate.name);
        expect(nomi).toContain('Villa Bonanno');
        expect(r.note).toEqual(['1 tappa su 2 non è di natura: entro 1,2 km non ho trovato altri parchi, giardini o belvedere aperti che entrino negli orari del giro.']);
    });

    it('niente trovato: il giro lo dice; quello che è già nel giro non cambia niente', () => {
        const pantheon = posto('Pantheon', 41.8986, 12.4769);
        const sched = { days: [[voce(pantheon, MATTINA, '09:30')]] };
        const r = rispettaRichiesta({ ...base, sched, voci: vociDellaRichiesta({ testo: 'Cioccolato a Roma', pathType: 'custom', citta: 'Roma' }), candidati: [] });
        expect(r.note).toEqual(['Cioccolato: a Roma non ho trovato posti di questo tipo.']);
        const gia = rispettaRichiesta({ ...base, sched, voci: vociDellaRichiesta({ testo: 'Il Pantheon a Roma', pathType: 'custom', citta: 'Roma' }), candidati: [] });
        expect(gia.sched).toEqual(sched);
        expect(gia.note).toEqual([]);
        expect(voceNelGiro({ tipo: 'luogo', cosa: 'Pantheon' }, sched.days)).toBe(true);
    });

    it('una tappa nuova di visita non va di sera e non arriva prima del pomeriggio: aspetta l\'inizio del momento', () => {
        const a = voce(posto('A', 41.9, 12.48), PRANZO, '12:30');
        const b = voce(posto('B', 41.9, 12.481), CENA, '20:00');
        const e = provaInserire([a, b], 1, posto('C', 41.9005, 12.4805), { capKm: 1.2, aperto: sempreAperto, momenti });
        expect(e.ok).toBe(true);
        expect(e.arrivo).toBe(POMERIGGIO.start.getTime());
        expect(e.moment.key).toBe('pomeriggio');
    });
});
