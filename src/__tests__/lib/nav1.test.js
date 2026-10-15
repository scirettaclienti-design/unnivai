/**
 * NAV-1 — i moduli della navigazione senza la pagina: tracciamento, giro salvato, tappa superata,
 * schermo acceso, messaggi.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { avviaTracciamento, NAV_GPS } from '@/lib/navTracking';
import { salvaGiro, leggiGiro, chiudiGiro, puntoDelGiro, GIRO_SCADENZA_MS, chiaveGiro } from '@/lib/navSession';
import { valutaPassaggio, NAV_PASSAGGIO } from '@/lib/navPassaggio';
import { creaSchermoAcceso } from '@/lib/wakeLock';
import { avvisoNavigazione, NAV_TESTI, linkMappe } from '@/lib/navMessaggi';

function gpsFinto() {
    const watchers = new Map();
    let id = 0;
    return {
        watchPosition: vi.fn((ok, ko) => { id += 1; watchers.set(id, { ok, ko }); return id; }),
        clearWatch: vi.fn((i) => watchers.delete(i)),
        emit(lat = 37.5, lng = 15.08) { for (const w of [...watchers.values()]) w.ok({ coords: { latitude: lat, longitude: lng, accuracy: 10 } }); },
        fail(code) { for (const w of [...watchers.values()]) w.ko({ code }); },
        attivi: () => watchers.size,
    };
}

describe('navTracking — il tracciamento parte sempre e non si spegne', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('parte subito in attesa; dopo 5 s lo dice; una posizione anche dopo minuti → ok', () => {
        const geo = gpsFinto();
        const stati = [];
        const onPosizione = vi.fn();
        const onPrimoFixMancato = vi.fn();
        const t = avviaTracciamento({ geolocation: geo, onPosizione, onStato: s => stati.push(s), onPrimoFixMancato, doc: null });
        expect(geo.attivi()).toBe(1);
        expect(t.stato()).toBe('attesa');
        vi.advanceTimersByTime(NAV_GPS.PRIMO_FIX_MS);
        expect(onPrimoFixMancato).toHaveBeenCalledTimes(1);
        vi.advanceTimersByTime(3 * 60_000);
        expect(geo.attivi()).toBe(1); // riavviato, mai spento
        geo.emit();
        expect(t.stato()).toBe('ok');
        expect(onPosizione).toHaveBeenCalledWith(expect.anything(), { primo: true });
        t.stop();
        expect(geo.attivi()).toBe(0);
    });

    it('GPS che sparisce e torna: perso, poi ok; il watch viene riavviato', () => {
        const geo = gpsFinto();
        const t = avviaTracciamento({ geolocation: geo, onPosizione: () => {}, doc: null });
        geo.emit();
        expect(t.stato()).toBe('ok');
        const avvii = geo.watchPosition.mock.calls.length;
        vi.advanceTimersByTime(NAV_GPS.PERSO_MS + 2 * NAV_GPS.CONTROLLO_MS + 1000);
        expect(geo.watchPosition.mock.calls.length).toBeGreaterThan(avvii);
        expect(t.stato()).toBe('perso');
        geo.emit();
        expect(t.stato()).toBe('ok');
        t.stop();
    });

    it('un errore di timeout non spegne il tracciamento: riprova', () => {
        const geo = gpsFinto();
        const t = avviaTracciamento({ geolocation: geo, onPosizione: () => {}, doc: null });
        geo.fail(3);
        expect(geo.attivi()).toBe(0);
        vi.advanceTimersByTime(NAV_GPS.RIPROVA_MS);
        expect(geo.attivi()).toBe(1);
        expect(t.stato()).toBe('attesa');
        t.stop();
    });

    it('posizione negata → negato; tornando in primo piano si riprova (permesso cambiato in Impostazioni)', () => {
        const geo = gpsFinto();
        const listeners = {};
        const doc = { visibilityState: 'visible', addEventListener: (n, f) => { listeners[n] = f; }, removeEventListener: () => {} };
        const t = avviaTracciamento({ geolocation: geo, onPosizione: () => {}, doc });
        geo.fail(1);
        expect(t.stato()).toBe('negato');
        expect(geo.attivi()).toBe(0);
        listeners.visibilitychange();
        expect(geo.attivi()).toBe(1);
        geo.emit();
        expect(t.stato()).toBe('ok');
        t.stop();
    });
});

describe('navSession — il giro salvato', () => {
    beforeEach(() => localStorage.clear());
    const tour = { id: 't1', steps: [{ id: 'a', lat: 1, lng: 2 }, { id: 'b', lat: 3, lng: 4 }, { id: 'c', lat: 5, lng: 6 }] };

    it('salva e rilegge tappe fatte e saltate; N di M', () => {
        const now = 1_000_000;
        salvaGiro({ tourData: tour, completedSteps: ['a'], skippedSteps: ['b'], startedAt: now }, now);
        const g = leggiGiro(now + 60_000);
        expect(g.completedSteps).toEqual(['a']);
        expect(g.skippedSteps).toEqual(['b']);
        expect(g.chiave).toBe(chiaveGiro(tour));
        expect(puntoDelGiro(g)).toEqual({ n: 3, m: 3 });
    });

    it('oltre 12 ore dall\'inizio non si propone e si cancella', () => {
        const now = 1_000_000;
        salvaGiro({ tourData: tour, completedSteps: [], startedAt: now }, now);
        expect(leggiGiro(now + GIRO_SCADENZA_MS - 1)).not.toBeNull();
        expect(leggiGiro(now + GIRO_SCADENZA_MS + 1)).toBeNull();
        expect(leggiGiro(now)).toBeNull();
    });

    it('chiudiGiro lo cancella; senza id la chiave sono le tappe', () => {
        salvaGiro({ tourData: tour, completedSteps: [], startedAt: Date.now() });
        chiudiGiro();
        expect(leggiGiro()).toBeNull();
        expect(chiaveGiro({ steps: [{ lat: 1, lng: 2 }] })).toBe('tappe:1.00000,2.00000');
    });
});

describe('navPassaggio — la tappa superata', () => {
    it('vicino ma fuori soglia, poi lontano: superata (una volta sola)', () => {
        let st = null;
        const passo = (dist, now) => { const r = valutaPassaggio(st, { stepId: 'a', dist, soglia: 25, now }); st = r.st; return r.superata; };
        expect(passo(300, 0)).toBe(false);
        expect(passo(50, 1000)).toBe(false);
        expect(passo(70, 2000)).toBe(false);
        expect(passo(50 + NAV_PASSAGGIO.RISALITA_M, 3000)).toBe(true);
        expect(passo(200, 4000)).toBe(false);
    });

    it('dopo una pausa (schermo bloccato) sei già più vicino alla tappa dopo: superata', () => {
        let st = valutaPassaggio(null, { stepId: 'a', dist: 400, soglia: 25, now: 0 }).st;
        const r = valutaPassaggio(st, { stepId: 'a', dist: 350, soglia: 25, now: NAV_PASSAGGIO.PAUSA_MS + 1, distDopoDaUtente: 100, distDopoDaTappa: 300 });
        expect(r.superata).toBe(true);
    });

    it('avvicinarsi piano non chiede niente', () => {
        let st = null;
        for (const [d, t] of [[500, 0], [400, 1000], [300, 2000], [200, 3000], [100, 4000]]) {
            const r = valutaPassaggio(st, { stepId: 'a', dist: d, soglia: 25, now: t });
            st = r.st;
            expect(r.superata).toBe(false);
        }
    });
});

describe('wakeLock — lo schermo acceso dove il browser lo permette', () => {
    it('senza API: nessun errore', async () => {
        const s = creaSchermoAcceso({ nav: {}, doc: null });
        await expect(s.attiva()).resolves.toBeUndefined();
        expect(s.attivo()).toBe(false);
        await s.rilascia();
    });

    it('rifiuto del browser: nessun errore', async () => {
        const s = creaSchermoAcceso({ nav: { wakeLock: { request: vi.fn(async () => { throw new Error('NotAllowedError'); }) } }, doc: null });
        await expect(s.attiva()).resolves.toBeUndefined();
        expect(s.attivo()).toBe(false);
    });

    it('con API: attivo, rilasciato alla fine, richiesto di nuovo al ritorno in primo piano', async () => {
        const release = vi.fn(async () => {});
        const request = vi.fn(async () => ({ release, addEventListener: () => {} }));
        const listeners = {};
        const doc = { visibilityState: 'visible', addEventListener: (n, f) => { listeners[n] = f; }, removeEventListener: () => {} };
        const s = creaSchermoAcceso({ nav: { wakeLock: { request } }, doc });
        await s.attiva();
        expect(s.attivo()).toBe(true);
        await s.rilascia();
        expect(release).toHaveBeenCalled();
        expect(s.attivo()).toBe(false);
        await s.attiva();
        expect(request).toHaveBeenCalledTimes(2);
    });
});

describe('navMessaggi — un avviso alla volta, i testi di Ivano', () => {
    it('ordine: negata, offline, percorso, perso, attesa (solo dopo 5 s)', () => {
        expect(avvisoNavigazione({ gps: 'negato', offline: true }).testo).toBe(NAV_TESTI.POSIZIONE_NEGATA);
        expect(avvisoNavigazione({ gps: 'perso', offline: true }).testo).toBe(NAV_TESTI.OFFLINE);
        expect(avvisoNavigazione({ gps: 'ok', percorsoErrore: true }).testo).toBe(NAV_TESTI.PERCORSO);
        expect(avvisoNavigazione({ gps: 'perso' }).testo).toBe(NAV_TESTI.GPS_PERSO);
        expect(avvisoNavigazione({ gps: 'attesa' })).toBeNull();
        expect(avvisoNavigazione({ gps: 'attesa', attesaVisibile: true }).testo).toBe(NAV_TESTI.GPS_ATTESA);
        expect(avvisoNavigazione({ gps: 'ok' })).toBeNull();
    });

    it('testi alla lettera', () => {
        expect(NAV_TESTI.RIPRESA(2, 5)).toBe('Hai un giro in corso: tappa 2 di 5. Riprendi?');
        expect(NAV_TESTI.PASSATA('Duomo')).toBe('Sei passato da Duomo?');
        expect(NAV_TESTI.OFFLINE).toBe('Sei offline. La mappa resta; il percorso si aggiorna quando torna la rete.');
    });

    it('link a Mappe solo con coordinate vere', () => {
        expect(linkMappe({ latitude: 37.5, longitude: 15.08 })).toBe('https://maps.apple.com/?daddr=37.5,15.08&dirflg=w');
        expect(linkMappe({})).toBeNull();
    });
});
