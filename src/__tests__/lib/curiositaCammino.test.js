// CURIOSITÀ-QUARTIERI — quando chiedere e quando dire la curiosità del cammino. Puro, 0 $.
import { describe, it, expect, beforeEach } from 'vitest';
import {
    statoIniziale, aggiornaCammino, staCamminando, devoChiedere, richiestaPartita, rispostaArrivata, prontaScaduta, possoDire, segnaDetta,
    leggiGiro, salvaGiro, metriParlando, secondiParlando, INTERVALLO_MS, PRIMA_DOPO_M, FINESTRA_SVOLTA_M, FINESTRA_ARRIVO_M, MARGINE_M, CHIAVE_GIRO,
} from '@/lib/curiositaCammino';

const P0 = { lat: 37.5027, lng: 15.0871 };
const nord = (p, m) => ({ lat: p.lat + m / 111320, lng: p.lng });
const C = { testo: 'Via dei Crociferi fu realizzata nel XVIII secolo. Nei suoi 410 metri ci sono quattro chiese.', chiave: 'curiosita-itwiki-443726', luogo: 'Via dei Crociferi', tipo: 'via' };

/** Cammina a 1,25 m/s per `secondi`, una lettura ogni 20 s. */
function cammina(st, { da = P0, secondi = 300, t0 = 0, v = 1.25 } = {}) {
    let s = st, p = da, t = t0;
    for (let k = 0; k < secondi / 20; k++) { t += 20_000; p = nord(p, v * 20); s = aggiornaCammino(s, { ...p, oraMs: t }); }
    return { st: s, p, t };
}
const libero = { attivo: true, camminando: true, distanzaSvoltaM: null, distanzaTappaM: null, voceOccupata: false, schedaAperta: false };

describe('camminando', () => {
    it('a passo d\'uomo sì; fermo, in bici veloce o con una lettura sola no', () => {
        expect(staCamminando(cammina(statoIniziale()).st, 300_000)).toBe(true);
        const fermo = cammina(statoIniziale(), { v: 0 });
        expect(staCamminando(fermo.st, fermo.t)).toBe(false);
        const veloce = cammina(statoIniziale(), { v: 6 });
        expect(staCamminando(veloce.st, veloce.t)).toBe(false);
        expect(staCamminando(aggiornaCammino(statoIniziale(), { ...P0, oraMs: 0 }), 0)).toBe(false);
    });
    it('i metri camminati: un salto del GPS oltre 80 m non conta', () => {
        let s = aggiornaCammino(statoIniziale(), { ...P0, oraMs: 0 });
        s = aggiornaCammino(s, { ...nord(P0, 500), oraMs: 1000 });
        expect(s.camminatiM).toBe(0);
    });
});

describe('quando chiederla', () => {
    it('la prima dopo 300 m camminati, non prima', () => {
        const a = cammina(statoIniziale(), { secondi: 200 }); // 225 m (la prima lettura non è un passo)
        expect(a.st.camminatiM).toBeLessThan(PRIMA_DOPO_M);
        expect(devoChiedere(a.st, { oraMs: a.t, attivo: true, camminando: true })).toBe(false);
        const b = cammina(a.st, { da: a.p, t0: a.t, secondi: 100 });
        expect(devoChiedere(b.st, { oraMs: b.t, attivo: true, camminando: true })).toBe(true);
    });
    it('una richiesta alla volta; dopo una risposta vuota si aspettano 90 s e 150 m', () => {
        const a = cammina(statoIniziale(), { secondi: 300 });
        let s = richiestaPartita(a.st, { oraMs: a.t });
        expect(devoChiedere(s, { oraMs: a.t + 1000, attivo: true, camminando: true })).toBe(false);
        s = rispostaArrivata(s, null, { oraMs: a.t + 3000 });
        expect(devoChiedere(s, { oraMs: a.t + 60_000, attivo: true, camminando: true })).toBe(false);
        const b = cammina(s, { da: a.p, t0: a.t, secondi: 140 }); // 175 m, 140 s
        expect(devoChiedere(b.st, { oraMs: b.t, attivo: true, camminando: true })).toBe(true);
    });
    it('in pausa, fuori dal giro o fermo: mai', () => {
        const a = cammina(statoIniziale());
        expect(devoChiedere(a.st, { oraMs: a.t, attivo: false, camminando: true })).toBe(false);
        expect(devoChiedere(a.st, { oraMs: a.t, attivo: true, camminando: false })).toBe(false);
    });
    it('dopo una detta: la richiesta riparte un minuto prima dei 10 minuti', () => {
        const a = cammina(statoIniziale());
        let s = rispostaArrivata(richiestaPartita(a.st, { oraMs: a.t }), C, { oraMs: a.t });
        s = segnaDetta(s, { oraMs: a.t });
        expect(devoChiedere(s, { oraMs: a.t + 8 * 60_000, attivo: true, camminando: true })).toBe(false);
        expect(devoChiedere(s, { oraMs: a.t + 9 * 60_000, attivo: true, camminando: true })).toBe(true);
    });
});

describe('quando dirla: mai sopra le indicazioni, al massimo una ogni 10 minuti, mai due volte', () => {
    let s, t;
    beforeEach(() => {
        const a = cammina(statoIniziale());
        t = a.t;
        s = rispostaArrivata(richiestaPartita(a.st, { oraMs: t }), C, { oraMs: t });
    });
    it('strada libera: sì', () => {
        expect(possoDire(s, { oraMs: t, ...libero })).toEqual({ si: true, motivo: 'ok' });
    });
    it('la svolta: aspetta finché la frase finirebbe dentro la finestra della prima indicazione', () => {
        const serve = FINESTRA_SVOLTA_M + metriParlando(C.testo) + MARGINE_M;
        expect(possoDire(s, { oraMs: t, ...libero, distanzaSvoltaM: serve - 1 }).motivo).toBe('svolta vicina');
        expect(possoDire(s, { oraMs: t, ...libero, distanzaSvoltaM: 50 }).motivo).toBe('svolta vicina');
        expect(possoDire(s, { oraMs: t, ...libero, distanzaSvoltaM: serve }).si).toBe(true);
        expect(secondiParlando(C.testo)).toBe(Math.ceil(C.testo.length / 14));
    });
    it('la tappa vicina, la voce che parla, una scheda aperta: aspetta', () => {
        expect(possoDire(s, { oraMs: t, ...libero, distanzaTappaM: FINESTRA_ARRIVO_M + metriParlando(C.testo) }).motivo).toBe('tappa vicina');
        expect(possoDire(s, { oraMs: t, ...libero, voceOccupata: true }).motivo).toBe('la voce sta parlando');
        expect(possoDire(s, { oraMs: t, ...libero, schedaAperta: true }).motivo).toBe('scheda aperta');
        expect(possoDire(s, { oraMs: t, ...libero, camminando: false }).motivo).toBe('non stai camminando');
        expect(possoDire(s, { oraMs: t, ...libero, attivo: false }).motivo).toBe('giro fermo o in pausa');
    });
    it('dopo una detta: la prossima non prima di 10 minuti, e mai la stessa', () => {
        const d = segnaDetta(s, { oraMs: t });
        expect(d.dette).toEqual([C.chiave]);
        const altra = { ...C, chiave: 'curiosita-itwiki-2', testo: 'Trastevere era la regione XIV augustea. Il nome viene da trans Tiberim.' };
        let x = rispostaArrivata(richiestaPartita(d, { oraMs: t + 9 * 60_000 }), altra, { oraMs: t + 9 * 60_000 });
        expect(possoDire(x, { oraMs: t + INTERVALLO_MS - 1, ...libero }).motivo).toBe('meno di 10 minuti dall\'ultima');
        expect(possoDire(x, { oraMs: t + INTERVALLO_MS, ...libero }).si).toBe(true);
        // la stessa chiave che torna dal server non si tiene
        x = rispostaArrivata(richiestaPartita(d, { oraMs: t + 9 * 60_000 }), C, { oraMs: t + 9 * 60_000 });
        expect(x.pronta).toBeNull();
    });
    it('una via vale a 250 m da dove l\'hai chiesta, un quartiere a 800 m', () => {
        expect(prontaScaduta(s.pronta, { oraMs: t + 1000, pos: nord(s.pronta.pos, 240) })).toBe(false);
        expect(prontaScaduta(s.pronta, { oraMs: t + 1000, pos: nord(s.pronta.pos, 260) })).toBe(true);
        const q = { ...s.pronta, tipo: 'quartiere' };
        expect(prontaScaduta(q, { oraMs: t + 1000, pos: nord(q.pos, 700) })).toBe(false);
        expect(prontaScaduta(q, { oraMs: t + 1000, pos: nord(q.pos, 900) })).toBe(true);
        expect(prontaScaduta(s.pronta, { oraMs: t + 5 * 60_000, pos: s.pronta.pos })).toBe(true);
    });
});

describe('sul telefono, per il giro', () => {
    beforeEach(() => localStorage.clear());
    it('le dette e l\'ora dell\'ultima tornano dopo una ricarica dello stesso giro; un altro giro riparte da zero', () => {
        salvaGiro('giro-1', { dette: ['curiosita-itwiki-1'], ultimaMs: 123 });
        expect(leggiGiro('giro-1')).toEqual({ dette: ['curiosita-itwiki-1'], ultimaMs: 123 });
        expect(leggiGiro('giro-2')).toEqual({ dette: [], ultimaMs: null });
        localStorage.setItem(CHIAVE_GIRO, '{rotto');
        expect(leggiGiro('giro-1')).toEqual({ dette: [], ultimaMs: null });
    });
});
