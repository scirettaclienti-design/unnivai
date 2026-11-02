// APP-NATIVA — l'account demo del revisore Apple: si accende solo per quell'account, mai per altri; il giro demo
// ha tappe vere con racconto in cache e la posizione simulata ci cammina sopra.
import { describe, it, expect, vi } from 'vitest';
import { isDemoRevisore, giroDemoAttivo, FLAG_DEMO_REVISORE } from '../../lib/demoRevisore';
import { GIRO_DEMO, TAPPE_DEMO, PERCORSO_DEMO } from '../../data/giroDemo';
import { creaCamminoSimulato, distanzaM, CAMMINO_DEMO } from '../../lib/camminoSimulato';
import { distanzaDalGiro, primaTappa } from '../../lib/giroLontano';

const demo = { id: 'u-demo', app_metadata: { [FLAG_DEMO_REVISORE]: true } };

describe('chi è l\'account demo', () => {
    it('solo app_metadata.unnivai_demo_revisore === true', () => {
        expect(isDemoRevisore(demo)).toBe(true);
    });
    it('mai per altri utenti, per chi lo scrive nei propri user_metadata, per un ospite o senza utente', () => {
        expect(isDemoRevisore(null)).toBe(false);
        expect(isDemoRevisore({ id: 'x' })).toBe(false);
        expect(isDemoRevisore({ id: 'x', app_metadata: {} })).toBe(false);
        expect(isDemoRevisore({ id: 'x', user_metadata: { [FLAG_DEMO_REVISORE]: true } })).toBe(false);
        expect(isDemoRevisore({ id: 'x', app_metadata: { [FLAG_DEMO_REVISORE]: 'true' } })).toBe(false);
        expect(isDemoRevisore({ id: 'x', app_metadata: { [FLAG_DEMO_REVISORE]: 1 } })).toBe(false);
        expect(isDemoRevisore({ ...demo, is_anonymous: true })).toBe(false);
    });
    it('la posizione simulata vale solo con l\'account demo E il giro demo', () => {
        expect(giroDemoAttivo(demo, GIRO_DEMO)).toBe(true);
        expect(giroDemoAttivo({ id: 'altro' }, GIRO_DEMO)).toBe(false);
        expect(giroDemoAttivo(demo, { id: 't', steps: TAPPE_DEMO })).toBe(false);
        expect(giroDemoAttivo(null, GIRO_DEMO)).toBe(false);
    });
});

describe('il giro demo', () => {
    it('cinque tappe vere di Catania, ognuna col suo place_id di Google', () => {
        expect(TAPPE_DEMO).toHaveLength(5);
        for (const t of TAPPE_DEMO) {
            expect(t.place_id).toMatch(/^ChIJ/);
            expect(t.city).toBe('Catania');
            expect(Math.abs(t.lat - 37.50)).toBeLessThan(0.01);
            expect(Math.abs(t.lng - 15.086)).toBeLessThan(0.01);
        }
    });
    it('la partenza simulata è vicina al giro (GIRO-LONTANO non ferma «Avvia») e fuori dal raggio della prima tappa', () => {
        const partenza = { latitude: PERCORSO_DEMO[0].lat, longitude: PERCORSO_DEMO[0].lng };
        expect(distanzaDalGiro(partenza, primaTappa(TAPPE_DEMO)).lontano).toBe(false);
        expect(distanzaM(PERCORSO_DEMO[0], TAPPE_DEMO[0])).toBeGreaterThan(100);
    });
    it('tappe consecutive oltre i 25 m del geofence (ogni arrivo si arma)', () => {
        for (let i = 1; i < TAPPE_DEMO.length; i++) expect(distanzaM(TAPPE_DEMO[i - 1], TAPPE_DEMO[i])).toBeGreaterThan(25);
    });
});

describe('il cammino simulato', () => {
    const timersFinti = () => {
        let t = 0; const coda = [];
        return {
            now: () => t,
            timers: {
                setTimeout: (f, ms) => { coda.push({ f, at: t + ms, una: true }); return coda.length; },
                clearTimeout: () => {},
                setInterval: (f, ms) => { coda.push({ f, ms, at: t + ms }); return coda.length; },
                clearInterval: (id) => { coda[id - 1] = null; },
            },
            avanti(ms) {
                const fine = t + ms;
                for (;;) {
                    const prossimo = coda.filter(Boolean).filter(c => c.at <= fine).sort((a, b) => a.at - b.at)[0];
                    if (!prossimo) break;
                    t = prossimo.at;
                    if (prossimo.una) coda[coda.indexOf(prossimo)] = null; else prossimo.at += prossimo.ms;
                    prossimo.f();
                }
                t = fine;
            },
        };
    };

    it('resta alla partenza finché non si tocca «Simula il cammino»', () => {
        const o = timersFinti();
        const c = creaCamminoSimulato({ percorso: PERCORSO_DEMO, tappe: TAPPE_DEMO, now: o.now, timers: o.timers });
        const visti = [];
        c.watchPosition((p) => visti.push(p));
        o.avanti(10_000);
        expect(c.stato()).toBe('fermo');
        expect(visti.length).toBeGreaterThan(5);
        expect(visti.at(-1).coords).toMatchObject({ latitude: PERCORSO_DEMO[0].lat, longitude: PERCORSO_DEMO[0].lng, speed: 0 });
    });

    it('cammina a passo d\'uomo, si ferma a ogni tappa in ordine e finisce al Castello Ursino', () => {
        const o = timersFinti();
        const c = creaCamminoSimulato({ percorso: PERCORSO_DEMO, tappe: TAPPE_DEMO, now: o.now, timers: o.timers });
        const visti = [];
        const stati = [];
        c.suCambio((s) => stati.push(s));
        c.watchPosition((p) => visti.push(p));
        c.avvia();
        o.avanti(20 * 60_000);
        expect(c.stato()).toBe('finito');
        expect(stati.filter(s => s === 'sosta')).toHaveLength(5);
        // ogni tappa: almeno una posizione entro 25 m (il geofence), nell'ordine del giro
        let da = 0;
        for (const t of TAPPE_DEMO) {
            const i = visti.findIndex((p, k) => k >= da && distanzaM({ lat: p.coords.latitude, lng: p.coords.longitude }, t) <= 25);
            expect(i).toBeGreaterThanOrEqual(da);
            da = i;
        }
        const ultima = visti.at(-1).coords;
        expect(distanzaM({ lat: ultima.latitude, lng: ultima.longitude }, TAPPE_DEMO.at(-1))).toBeLessThan(1);
        // mai più veloce del passo dichiarato (le curiosità vogliono 0,4–3 m/s)
        for (let k = 1; k < visti.length; k++) {
            const a = visti[k - 1].coords; const b = visti[k].coords;
            expect(distanzaM({ lat: a.latitude, lng: a.longitude }, { lat: b.latitude, lng: b.longitude })).toBeLessThanOrEqual(CAMMINO_DEMO.VELOCITA_MS + 0.01);
        }
        expect(CAMMINO_DEMO.VELOCITA_MS).toBeLessThanOrEqual(3);
    });

    it('«Ferma il cammino» blocca la posizione, «Simula il cammino» la riprende', () => {
        const o = timersFinti();
        const c = creaCamminoSimulato({ percorso: PERCORSO_DEMO, tappe: TAPPE_DEMO, now: o.now, timers: o.timers });
        c.watchPosition(() => {});
        c.avvia(); o.avanti(20_000);
        c.pausa();
        const qui = c.posizione();
        o.avanti(20_000);
        expect(c.posizione()).toEqual(qui);
        c.avvia(); o.avanti(5_000);
        expect(distanzaM(c.posizione(), qui)).toBeGreaterThan(5);
    });

    it('senza osservatori niente orologio; un percorso troppo corto è un errore', () => {
        const setInterval = vi.fn();
        creaCamminoSimulato({ percorso: PERCORSO_DEMO, timers: { setTimeout: vi.fn(), clearTimeout: vi.fn(), setInterval, clearInterval: vi.fn() } });
        expect(setInterval).not.toHaveBeenCalled();
        expect(() => creaCamminoSimulato({ percorso: [PERCORSO_DEMO[0]] })).toThrow();
    });
});

describe('lo script per Ivano (scripts/ios/account-demo.mjs)', () => {
    it('crea l\'utente col flag in app_metadata (mai in user_metadata) e email già confermata', async () => {
        const { corpoUtenteDemo, sqlFlag, FLAG } = await import('../../../scripts/ios/account-demo.mjs');
        expect(FLAG).toBe(FLAG_DEMO_REVISORE);
        const c = corpoUtenteDemo('r@esempio.it', 'una-password-lunga');
        expect(c.app_metadata).toEqual({ [FLAG_DEMO_REVISORE]: true });
        expect(c.user_metadata[FLAG_DEMO_REVISORE]).toBeUndefined();
        expect(c.user_metadata.role).toBe('explorer');
        expect(c.email_confirm).toBe(true);
        // l'utente così creato è l'account demo
        expect(isDemoRevisore({ id: 'x', app_metadata: c.app_metadata, user_metadata: c.user_metadata })).toBe(true);
        expect(sqlFlag('R@Esempio.it')).toBe(`update auth.users set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"${FLAG_DEMO_REVISORE}": true}'::jsonb where email = 'r@esempio.it';`);
        expect(() => sqlFlag("x' or '1'='1")).toThrow();
    });
    it('senza argomenti non fa niente', async () => {
        const { execFileSync } = await import('node:child_process');
        const out = execFileSync(process.execPath, ['scripts/ios/account-demo.mjs'], { encoding: 'utf8', env: { PATH: process.env.PATH } });
        expect(out).toMatch(/^Niente fatto/);
    });
});
