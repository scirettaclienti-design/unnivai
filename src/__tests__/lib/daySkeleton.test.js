// Gate SCHELETRO (P2) — tabella dei casi di buildDaySkeleton.
//
// Le finestre si costruiscono con resolveTourWindow (P1), cosi' il test prova
// la catena reale finestra → scheletro. Istanti con offset di Roma esplicito:
// la CI gira in UTC. Lunedi' 5 ottobre 2026 e' il giorno della richiesta.

import { describe, it, expect } from 'vitest';
import { buildDaySkeleton, normalizePace, parseExplicitCategory, MAX_STOPS_PER_DAY } from '@/lib/daySkeleton';
import { resolveTourWindow, DAY_START, DAY_END, FASCE } from '@/lib/tourWindow';
import { MOMENTS, MOMENT_BY_KEY } from '@/lib/dayMoments';

const LUN_2057 = new Date('2026-10-05T20:57:00+02:00');
const LUN_1500 = new Date('2026-10-05T15:00:00+02:00');
const LUN_2200 = new Date('2026-10-05T22:00:00+02:00');

const custom = (text, requestTime, duration = '') =>
    resolveTourWindow({ text, requestTime, pathType: 'custom', duration });
const quick = (requestTime, duration) =>
    resolveTourWindow({ text: '', requestTime, pathType: 'quick', duration });

const keys = (sk, i = 0) => sk.days[i].moments.map(m => m.key);
const stops = (sk, i = 0) => sk.days[i].moments.map(m => m.stops);
const iso = (s) => new Date(s).toISOString();

describe('buildDaySkeleton — la tabella', () => {
    it('domani, giornata intera, Rilassato, Arte+Cibo → 5 momenti, 1 tappa ciascuno', () => {
        const sk = buildDaySkeleton({
            window: custom('Domani voglio vivere Roma da romano', LUN_2057),
            pace: 'Rilassato', interests: ['Arte', 'Cibo'],
        });
        expect(keys(sk)).toEqual(['mattina', 'pranzo', 'pomeriggio', 'aperitivo', 'cena']);
        expect(stops(sk)).toEqual([1, 1, 1, 1, 1]);
        expect(sk.days[0].totalStops).toBe(5);
        expect(sk.days[0].date).toBe('2026-10-06');
    });

    it('stasera alle 20:57 → solo cena, tagliata alla finestra', () => {
        const sk = buildDaySkeleton({ window: custom('stasera', LUN_2057), pace: 'Attivo', interests: ['Arte'] });
        expect(keys(sk)).toEqual(['cena']);
        const cena = sk.days[0].moments[0];
        expect(cena.start.toISOString()).toBe(iso('2026-10-05T20:57:00+02:00'));
        expect(cena.end.toISOString()).toBe(iso('2026-10-05T22:30:00+02:00'));
    });

    it('stasera alle 20:57 con Vita Notturna → cena + dopocena fino alle 00:30', () => {
        const sk = buildDaySkeleton({ window: custom('stasera', LUN_2057), pace: 'Attivo', interests: ['Vita Notturna'] });
        expect(keys(sk)).toEqual(['cena', 'dopocena']);
        const dopo = sk.days[0].moments[1];
        expect(dopo.start.toISOString()).toBe(iso('2026-10-05T22:30:00+02:00'));
        expect(dopo.end.toISOString()).toBe(iso('2026-10-06T00:30:00+02:00'));
        expect(dopo.categories).toEqual(['vita notturna']);
    });

    it('Percorso Veloce alle 15:00 per 2 ore → solo pomeriggio, nessun pasto', () => {
        const sk = buildDaySkeleton({ window: quick(LUN_1500, 'Veloce'), pace: 'Attivo', interests: ['Cibo'] });
        expect(keys(sk)).toEqual(['pomeriggio']);
        expect(sk.days[0].moments[0].start.toISOString()).toBe(iso('2026-10-05T15:00:00+02:00'));
        expect(sk.days[0].moments[0].end.toISOString()).toBe(iso('2026-10-05T17:00:00+02:00'));
    });

    it('P3e — una categoria scelta (testo o chiamante) non tocca pranzo e cena; l\'aperitivo la segue', () => {
        const giorno = custom('domani', LUN_2057);
        for (const sk of [
            buildDaySkeleton({ window: giorno, category: 'cultura' }),
            buildDaySkeleton({ window: giorno, text: 'musei' }),
        ]) {
            const by = Object.fromEntries(sk.days[0].moments.map(m => [m.key, m]));
            expect(by.pranzo.categories).toEqual(['cibo']);
            expect(by.cena.categories).toEqual(['cibo']);
            expect(by.pranzo.stops).toBe(1);
            expect(by.aperitivo.categories).toEqual([sk.explicitCategory]);
            expect(by.mattina.categories).toEqual([sk.explicitCategory]);
        }
    });

    it('"ristoranti stasera" → il cibo e\' un TEMA: cena cibo, aperitivo un bar (C7), orari invariati', () => {
        const w = custom('ristoranti stasera', LUN_1500);
        const sk = buildDaySkeleton({ window: w, pace: 'Attivo', text: 'ristoranti stasera' });
        expect(sk.explicitCategory).toBe('cibo');
        expect(sk.foodTheme).toBe(true);
        expect(keys(sk)).toEqual(['aperitivo', 'cena']);
        const [aperitivo, cena] = sk.days[0].moments;
        expect(cena.categories).toEqual(['cibo']);
        // C7 — l'aperitivo non e' un ristorante: come senza il tema. C8a — in un tour che parte di sera il drink e' un bar
        // (la vista e' della passeggiata); la giornata che comincia al mattino tiene bar e punti panoramici.
        expect(aperitivo.categories).toEqual(['bar']);
        expect(buildDaySkeleton({ window: w, pace: 'Attivo', text: 'stasera' }).days[0].moments[0].categories).toEqual(['bar']);
        // Gli orari sono quelli dello scheletro senza categoria esplicita.
        const senza = buildDaySkeleton({ window: w, pace: 'Attivo', text: 'stasera' });
        expect(sk.days[0].moments.map(m => [m.start.getTime(), m.end.getTime()]))
            .toEqual(senza.days[0].moments.map(m => [m.start.getTime(), m.end.getTime()]));
    });

    it('C7 — "un giorno da catanese, nei ristoranti tipici": mattina e pomeriggio sono esperienze, mai cibo; pranzo e cena cibo', () => {
        const w = custom('domani un giorno da catanese, nei ristoranti tipici', LUN_2057);
        const sk = buildDaySkeleton({ window: w, pace: 'Attivo', text: 'domani un giorno da catanese, nei ristoranti tipici', interests: ['Cibo'] });
        const per = Object.fromEntries(sk.days[0].moments.map(m => [m.key, m]));
        expect(sk.foodTheme).toBe(true);
        expect(per.pranzo.categories).toEqual(['cibo']);
        expect(per.cena.categories).toEqual(['cibo']);
        for (const k of ['mattina', 'pomeriggio']) {
            expect(per[k].categories, k).not.toContain('cibo');
            expect(per[k].tema, k).toBe('esperienze');
            expect(per[k].esplicito, k).toBeUndefined();
        }
        // niente locali di merito la mattina: una colazione c'e' solo se il testo la chiede (esplicito)
        expect(per.mattina.categories).not.toContain('bar');
        expect(per.aperitivo.categories).toEqual(['bar', 'punti panoramici']);
    });

    it('C7 — la categoria cibo del traduttore (foodTheme dal chiamante) fa lo stesso senza la parola nel testo', () => {
        const sk = buildDaySkeleton({ window: custom('domani', LUN_2057), pace: 'Attivo', foodTheme: true });
        const per = Object.fromEntries(sk.days[0].moments.map(m => [m.key, m]));
        expect(per.mattina.categories).not.toContain('cibo');
        expect(per.pomeriggio.categories).not.toContain('cibo');
        expect(per.mattina.tema).toBe('esperienze');
    });

    it('C7 — una richiesta ESPLICITA per quel momento ("il pomeriggio in pasticceria") si rispetta', () => {
        const t = 'domani il pomeriggio in pasticceria';
        const sk = buildDaySkeleton({ window: custom(t, LUN_2057), pace: 'Attivo', text: t });
        const per = Object.fromEntries(sk.days[0].moments.map(m => [m.key, m]));
        expect(per.pomeriggio.esplicito).toBe(true);
        expect(per.pomeriggio.categories).toEqual(expect.arrayContaining(['cibo', 'bar']));
        // la finestra e' solo il pomeriggio: gli altri momenti non ci sono
        expect(Object.keys(per)).toEqual(['pomeriggio']);
    });

    it('C7 — le altre categorie esplicite (musei, bar…) valgono per tutti i momenti come prima', () => {
        const sk = buildDaySkeleton({ window: custom('domani musei', LUN_2057), pace: 'Attivo', text: 'domani musei' });
        const per = Object.fromEntries(sk.days[0].moments.map(m => [m.key, m]));
        expect(per.mattina.categories).toEqual(['musei']);
        expect(per.pomeriggio.categories).toEqual(['musei']);
        expect(per.pranzo.categories).toEqual(['cibo']);
        expect(sk.foodTheme).toBe(false);
    });

    it('Famiglia → mai dopocena, nemmeno con Vita Notturna e Intenso', () => {
        for (const group of ['Famiglia', 'In famiglia', 'famiglia']) {
            const sk = buildDaySkeleton({
                window: custom('domani', LUN_2057), pace: 'Intenso', interests: ['Vita Notturna'], group,
            });
            expect(keys(sk)).not.toContain('dopocena');
        }
    });

    it('"Intenso" e "intenso" → stesso risultato', () => {
        const w = custom('domani', LUN_2057);
        const a = buildDaySkeleton({ window: w, pace: 'Intenso', interests: ['Arte'] });
        const b = buildDaySkeleton({ window: w, pace: 'intenso', interests: ['arte'] });
        const c = buildDaySkeleton({ window: w, pace: '  INTENSO ', interests: ['ARTE'] });
        expect(b).toEqual(a);
        expect(c).toEqual(a);
    });
});

describe('buildDaySkeleton — ritmo e tetto', () => {
    const giorno = custom('domani', LUN_2057);

    it('Rilassato → 1 tappa per momento', () => {
        expect(new Set(stops(buildDaySkeleton({ window: giorno, pace: 'Rilassato' }))).size).toBe(1);
    });

    it('Attivo → 2 tappe solo nei momenti di almeno 3 ore (mattina 3h, pomeriggio 3h30)', () => {
        const sk = buildDaySkeleton({ window: giorno, pace: 'Attivo' });
        expect(keys(sk)).toEqual(['mattina', 'pranzo', 'pomeriggio', 'aperitivo', 'cena']);
        expect(stops(sk)).toEqual([2, 1, 2, 1, 1]);
    });

    it('Attivo: un momento tagliato sotto le 3 ore torna a 1 tappa', () => {
        const sk = buildDaySkeleton({ window: quick(new Date('2026-10-05T15:00:00+02:00'), 'Lungo'), pace: 'Attivo' });
        // 15:00–21:00: pomeriggio 3h → 2; aperitivo 2h → 1; cena 60' → 1.
        expect(keys(sk)).toEqual(['pomeriggio', 'aperitivo', 'cena']);
        expect(stops(sk)).toEqual([2, 1, 1]);
    });

    it('Intenso con dopocena → 2+1+2+1+1+2 = 9, tagliato a 8 dalla sera', () => {
        const sk = buildDaySkeleton({ window: giorno, pace: 'Intenso' });
        expect(keys(sk)).toEqual(['mattina', 'pranzo', 'pomeriggio', 'aperitivo', 'cena', 'dopocena']);
        expect(sk.days[0].totalStops).toBe(MAX_STOPS_PER_DAY);
        expect(stops(sk)).toEqual([2, 1, 2, 1, 1, 1]);
    });

    // P3 — prima correzione: nessuno pranza (o cena) due volte.
    it('pranzo e cena fanno sempre 1 tappa, qualunque sia il ritmo', () => {
        const pasti = (pace) => buildDaySkeleton({ window: giorno, pace }).days[0].moments
            .filter(m => m.key === 'pranzo' || m.key === 'cena').map(m => m.stops);
        for (const pace of ['Rilassato', 'Attivo', 'Intenso', undefined]) {
            expect(pasti(pace)).toEqual([1, 1]);
        }
    });

    it('Intenso aggiunge tappe solo a mattina, pomeriggio e dopocena', () => {
        const sk = buildDaySkeleton({ window: giorno, pace: 'Intenso', interests: ['Vita Notturna'] });
        const doppi = sk.days[0].moments.filter(m => m.stops > 1).map(m => m.key);
        expect(doppi.every(k => ['mattina', 'pomeriggio', 'dopocena'].includes(k))).toBe(true);
        // Senza dopocena (Famiglia): niente da tagliare, 2+1+2+1+1.
        const famiglia = buildDaySkeleton({ window: giorno, pace: 'Intenso', group: 'Famiglia' });
        expect(stops(famiglia)).toEqual([2, 1, 2, 1, 1]);
    });

    it('category del chiamante vale come categoria esplicita; il testo vince', () => {
        // P3e — tranne pranzo e cena, che restano cibo.
        const moments = buildDaySkeleton({ window: giorno, category: 'natura' }).days[0].moments;
        expect(moments.filter(m => m.key !== 'pranzo' && m.key !== 'cena')
            .every(m => m.categories.length === 1 && m.categories[0] === 'natura')).toBe(true);
        expect(moments.filter(m => m.key === 'pranzo' || m.key === 'cena').map(m => m.categories))
            .toEqual([['cibo'], ['cibo']]);
        expect(buildDaySkeleton({ window: giorno, category: 'natura', text: 'ristoranti' }).explicitCategory)
            .toBe('cibo');
    });

    it('ritmo assente → Attivo', () => {
        expect(normalizePace(undefined)).toBe('attivo');
        expect(normalizePace('')).toBe('attivo');
        expect(normalizePace('Rilassato')).toBe('rilassato');
    });
});

describe('buildDaySkeleton — interessi e categorie', () => {
    const giorno = custom('domani', LUN_2057);
    const byKey = (sk) => Object.fromEntries(sk.days[0].moments.map(m => [m.key, m]));

    it('Arte/Storia/Cultura → categorie di cultura in testa a mattina e pomeriggio', () => {
        for (const interesse of ['Arte', 'Storia', 'Cultura']) {
            const m = byKey(buildDaySkeleton({ window: giorno, interests: [interesse] }));
            expect(m.mattina.preferred).toEqual(['cultura', 'monumenti', 'musei']);
            expect(m.pomeriggio.categories.slice(0, 1)).toEqual(['cultura']);
            expect(m.pranzo.preferred).toEqual([]);
        }
    });

    it('Natura e Shopping → privilegiano il pomeriggio, non la mattina', () => {
        const m = byKey(buildDaySkeleton({ window: giorno, interests: ['Natura', 'Shopping'] }));
        expect(m.pomeriggio.categories.slice(0, 2)).toEqual(['natura', 'shopping']);
        expect(m.mattina.preferred).toEqual([]);
    });

    it('privilegiare riordina, non aggiunge e non toglie categorie', () => {
        const m = byKey(buildDaySkeleton({ window: giorno, interests: ['Natura'] }));
        expect([...m.pomeriggio.categories].sort()).toEqual([...MOMENT_BY_KEY.pomeriggio.categories].sort());
    });

    it('Cibo → nessun momento in piu\', pranzo/aperitivo/cena "da scegliere con cura"', () => {
        const con = buildDaySkeleton({ window: giorno, pace: 'Rilassato', interests: ['Cibo'] });
        const senza = buildDaySkeleton({ window: giorno, pace: 'Rilassato', interests: [] });
        expect(keys(con)).toEqual(keys(senza));
        const m = byKey(con);
        expect([m.pranzo.careful, m.aperitivo.careful, m.cena.careful]).toEqual([true, true, true]);
        expect([m.mattina.careful, m.pomeriggio.careful]).toEqual([false, false]);
        expect(byKey(senza).pranzo.careful).toBe(false);
    });

    it('categorie esplicite riconosciute nel testo', () => {
        expect(parseExplicitCategory('i migliori ristoranti')).toBe('cibo');
        expect(parseExplicitCategory('solo musei')).toBe('musei');
        expect(parseExplicitCategory('un bar dopo l\'altro')).toBe('bar');
        expect(parseExplicitCategory('Domani voglio vivere Roma da romano')).toBeNull();
    });
});

describe('buildDaySkeleton — finestra e giorni', () => {
    it('un momento che si sovrappone per meno di 60 minuti non entra', () => {
        // Veloce alle 18:30 per 2 ore (18:30–20:30): l'aperitivo ne ha 90, la cena 30' → fuori.
        const LUN_1830 = new Date('2026-10-05T18:30:00+02:00');
        expect(keys(buildDaySkeleton({ window: quick(LUN_1830, 'Veloce') }))).toEqual(['aperitivo']);
        // Con Vita Notturna il dopocena 22:30–00:00 (90') entra.
        expect(keys(buildDaySkeleton({ window: quick(LUN_2200, 'Veloce'), interests: ['Vita Notturna'] })))
            .toEqual(['dopocena']);
    });

    it('C8a — mai uno scheletro vuoto: una finestra senza momenti riceve il momento sera/notte', () => {
        // Veloce alle 22:00 per 2 ore (22:00–00:00): la cena ne ha 30', il dopocena non e' ammesso → prima restava vuoto.
        const sk = buildDaySkeleton({ window: quick(LUN_2200, 'Veloce') });
        expect(keys(sk)).toEqual(['dopocena']);
        const m = sk.days[0].moments[0];
        expect(m.daRiserva).toBe(true);
        expect(m.start.toISOString()).toBe(iso('2026-10-05T22:00:00+02:00'));
        expect(m.end.toISOString()).toBe(iso('2026-10-06T00:00:00+02:00'));
        expect(m.categories).toEqual(['vita notturna']);
        expect(sk.days[0].totalStops).toBe(1);
        // 21:45–23:45 (il caso Catania): la cena ha 45', il dopocena 75' → il momento e' la notte, non uno scheletro vuoto
        const LUN_2145 = new Date('2026-10-05T21:45:00+02:00');
        expect(keys(buildDaySkeleton({ window: quick(LUN_2145, 'Veloce') }))).toEqual(['dopocena']);
        // prima dell'alba (05:00–07:00, nessun momento): il momento che contiene l'ora
        const LUN_0500 = new Date('2026-10-05T05:00:00+02:00');
        expect(buildDaySkeleton({ window: quick(LUN_0500, 'Veloce') }).days[0].moments).toHaveLength(1);
    });

    it('Mezza Giornata non si prolunga nel dopocena', () => {
        const sk = buildDaySkeleton({ window: custom('domani', LUN_2057, 'Mezza Giornata'), pace: 'Intenso' });
        // 9:30–13:30: il pranzo, tagliato a 12:30–13:30, fa esattamente 60' ed entra.
        expect(keys(sk)).toEqual(['mattina', 'pranzo']);
        expect(sk.days[0].moments[1].minutes).toBe(60);
    });

    it('"2-3 Giorni" → uno scheletro per giorno', () => {
        const sk = buildDaySkeleton({ window: custom('domani', LUN_2057, '2-3 Giorni'), pace: 'Rilassato' });
        expect(sk.days.map(d => d.date)).toEqual(['2026-10-06', '2026-10-07', '2026-10-08']);
        expect(sk.days.every(d => d.moments.length === 5)).toBe(true);
    });

    it('finestra assente → nessun giorno, senza lanciare', () => {
        expect(buildDaySkeleton({}).days).toEqual([]);
    });
});

describe('tabella unica — tourWindow legge da dayMoments', () => {
    it('i bordi della giornata e le fasce sono quelli della tabella', () => {
        expect(DAY_START).toBe(MOMENT_BY_KEY.mattina.start);
        expect(DAY_END).toBe(MOMENT_BY_KEY.cena.end);
        expect(FASCE.mattina).toEqual({ start: MOMENT_BY_KEY.mattina.start, end: MOMENT_BY_KEY.mattina.end });
        expect(FASCE.pranzo).toEqual({ start: MOMENT_BY_KEY.pranzo.start, end: MOMENT_BY_KEY.pranzo.end });
        expect(FASCE.pomeriggio).toEqual({ start: MOMENT_BY_KEY.pomeriggio.start, end: MOMENT_BY_KEY.pomeriggio.end });
        expect(FASCE.sera).toEqual({ start: MOMENT_BY_KEY.aperitivo.start, end: MOMENT_BY_KEY.cena.end });
    });

    it('i momenti sono contigui: la fine di uno e\' l\'inizio del successivo', () => {
        for (let i = 1; i < MOMENTS.length; i++) {
            expect(MOMENTS[i].start).toEqual(MOMENTS[i - 1].end);
        }
    });

    it('tourWindow.js non scrive orari di fascia a mano', async () => {
        const { readFileSync } = await import('fs');
        const src = readFileSync('src/lib/tourWindow.js', 'utf8');
        // Un orario di fascia e' una coppia start/end. ("all'una" = 13:00 resta:
        // e' un'ora detta dall'utente, non una fascia.)
        expect(src).not.toMatch(/(start|end):\s*\{\s*h:/);
    });
});
