/**
 * AVVISI (L6) — la logica di calcolo, PURA: nessuna rete, nessun database, nessuna data letta da sola.
 * La usa la funzione `avvisi` (Deno) e la prova la suite (vitest). I dati arrivano già letti; qui si decide e si scrive.
 *
 *  · costiGiorno       costo AI e costo Google stimati del giorno
 *  · valutaAvvisi      quali avvisi immediati mandare (costo sopra soglia, errori del proxy > 5% in un'ora), senza doppioni
 *  · decidiRiepilogo   se è ora di mandare il riepilogo di ieri
 *  · comporreRiepilogo le righe del riepilogo
 */
import { emailRiepilogo, emailAvviso, type EmailComposta, type RigaRiepilogo } from './emailUnnivai.ts';

// ─── Prezzi stimati (dollari). Sono stime: stanno qui, in un posto solo, e il riepilogo lo dice. ──────────────────────────
export const PREZZI = {
    /** Token di un giro (banco 11/10: «token $0,002» per giro). */
    giroAi: 0.002,
    /** Una chiamata di contorno (chat con verifica, monumenti, meteo…): stima prudente, da rivedere con i numeri veri. */
    contornoAi: 0.004,
    /** Un audio nuovo della voce (frase di ~10 s, TTS OpenAI). I racconti usano `costo_usd` scritto dal server. */
    voceAudio: 0.003,
    /** Una chiamata a Google Places (banco 11/10: «Google $0,177 per 6 chiamate»). */
    googleChiamata: 0.0295,
    /** Una foto di Google Places ($7 ogni 1.000). */
    googleFoto: 0.007,
} as const;

export const SOGLIA_COSTO_USD_DI_DIFETTO = 15;
export const SOGLIA_ERRORI = 0.05;          // si avvisa SOPRA il 5%
export const MIN_RICHIESTE_ORA = 20;        // sotto, una percentuale non dice niente (1 su 3 = 33%)
export const ORA_RIEPILOGO = 7;             // dalle 7 (Europe/Rome) il riepilogo di ieri parte alla prima esecuzione

// ─── Tipi ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
export type Conteggi = {
    giorno: string;                       // YYYY-MM-DD, Europe/Rome
    giri: number;                         // biglietti di generazione (account di prova esclusi: non contano nella quota)
    racconti: { passati: number; scartati: number; senzaFonti: number; costoUsd: number };
    chat: number;                         // chiamate di contorno di utenti e ospiti
    ospiti: number;                       // account anonimi nati nel giorno
    vociNuove: number;                    // audio nuovi della voce
    erroriApp: { totale: number; top: { messaggio: string; n: number }[] };
};
/** Traffico delle funzioni, letto dai log di Supabase. `null` = i log non si sono potuti leggere. */
export type Traffico = { proxyRichieste: number; proxyErrori: number; placesChiamate: number; placesFoto: number };
export type Costi = { ai: number; google: number; totale: number; googleDisponibile: boolean };

export const arrotonda = (n: number, cifre = 2) => Math.round(n * 10 ** cifre) / 10 ** cifre;

// ─── Costi ────────────────────────────────────────────────────────────────────────────────────────────────────────────
export function costiGiorno(c: Conteggi, t: Traffico | null): Costi {
    const ai = c.giri * PREZZI.giroAi + c.chat * PREZZI.contornoAi + c.vociNuove * PREZZI.voceAudio + c.racconti.costoUsd;
    const google = t ? t.placesChiamate * PREZZI.googleChiamata + t.placesFoto * PREZZI.googleFoto : 0;
    return { ai: arrotonda(ai, 3), google: arrotonda(google, 3), totale: arrotonda(ai + google, 3), googleDisponibile: t !== null };
}

/** Quota di richieste fallite (0..1). Zero richieste = 0, mai NaN. */
export const tassoErrori = (richieste: number, errori: number): number => (richieste > 0 ? errori / richieste : 0);

// ─── Tempo (Europe/Rome) ──────────────────────────────────────────────────────────────────────────────────────────────
export function partiRoma(d: Date): { giorno: string; ora: number; chiaveOra: string } {
    const f = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' });
    const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
    const giorno = `${p.year}-${p.month}-${p.day}`;
    return { giorno, ora: Number(p.hour), chiaveOra: `${giorno}T${p.hour}` };
}
export function giornoPrima(giorno: string): string {
    const d = new Date(`${giorno}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
}
export function giornoDopo(giorno: string): string {
    const d = new Date(`${giorno}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
}
const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
export function giornoEsteso(giorno: string): string {
    const [a, m, g] = giorno.split('-').map(Number);
    return `${g} ${MESI[m - 1]} ${a}`;
}

// ─── Formati ──────────────────────────────────────────────────────────────────────────────────────────────────────────
export const dollari = (n: number): string => `$${n.toFixed(2).replace('.', ',')}`;
export const percentuale = (q: number): string => `${(q * 100).toFixed(1).replace('.', ',')}%`;
export const numero = (n: number): string => n.toLocaleString('it-IT');

// ─── Avvisi immediati ─────────────────────────────────────────────────────────────────────────────────────────────────
export type Avviso = { chiave: string; tipo: 'costo' | 'errori'; email: EmailComposta };

export type InputValutazione = {
    ora: Date;
    costoOggi: Costi;                                   // costo del giorno in corso (Europe/Rome)
    sogliaCostoUsd: number;
    ultimaOra: { richieste: number; errori: number } | null;   // proxy, ultima ora; null = log non leggibili
    giaInviati: ReadonlySet<string>;                    // chiavi già mandate (tabella avvisi_inviati)
    minRichieste?: number;
};

/**
 * Quali avvisi mandare adesso. Chiavi: `costo:<giorno>` (una volta al giorno) e `errori:<giorno>T<ora>` (una volta per ora).
 * Costo: SOPRA la soglia (uguale non avvisa). Errori: SOPRA il 5% con almeno `minRichieste` richieste nell'ora.
 */
export function valutaAvvisi(x: InputValutazione): Avviso[] {
    const { giorno, chiaveOra } = partiRoma(x.ora);
    const out: Avviso[] = [];

    const chiaveCosto = `costo:${giorno}`;
    if (x.costoOggi.totale > x.sogliaCostoUsd && !x.giaInviati.has(chiaveCosto)) {
        out.push({
            chiave: chiaveCosto,
            tipo: 'costo',
            email: emailAvviso({
                titolo: `Costo di oggi ${dollari(x.costoOggi.totale)}, soglia ${dollari(x.sogliaCostoUsd)}`,
                messaggio: 'Il costo stimato del giorno ha superato la soglia. Controlla chi sta generando prima che salga ancora.',
                righe: [
                    { etichetta: 'AI stimata', valore: dollari(x.costoOggi.ai) },
                    { etichetta: 'Google stimato', valore: x.costoOggi.googleDisponibile ? dollari(x.costoOggi.google) : 'log non leggibili' },
                    { etichetta: 'Totale', valore: dollari(x.costoOggi.totale) },
                    { etichetta: 'Soglia', valore: dollari(x.sogliaCostoUsd) },
                ],
            }),
        });
    }

    const min = x.minRichieste ?? MIN_RICHIESTE_ORA;
    const chiaveErrori = `errori:${chiaveOra}`;
    if (x.ultimaOra && x.ultimaOra.richieste >= min && x.ultimaOra.richieste > 0
        && tassoErrori(x.ultimaOra.richieste, x.ultimaOra.errori) > SOGLIA_ERRORI && !x.giaInviati.has(chiaveErrori)) {
        const q = tassoErrori(x.ultimaOra.richieste, x.ultimaOra.errori);
        out.push({
            chiave: chiaveErrori,
            tipo: 'errori',
            email: emailAvviso({
                titolo: `Errori del proxy ${percentuale(q)} nell'ultima ora`,
                messaggio: `Su ${numero(x.ultimaOra.richieste)} richieste, ${numero(x.ultimaOra.errori)} sono finite in errore (503 o 5xx). La soglia è ${percentuale(SOGLIA_ERRORI)}.`,
                righe: [
                    { etichetta: 'Richieste', valore: numero(x.ultimaOra.richieste) },
                    { etichetta: 'Errori', valore: numero(x.ultimaOra.errori) },
                    { etichetta: 'Quota', valore: percentuale(q) },
                ],
            }),
        });
    }
    return out;
}

// ─── Riepilogo ────────────────────────────────────────────────────────────────────────────────────────────────────────
/** Il riepilogo di IERI parte dalle 7 (Roma), una volta sola: la chiave `riepilogo:<ieri>` lo ricorda. */
export function decidiRiepilogo(ora: Date, giaInviati: ReadonlySet<string>): { giorno: string; chiave: string } | null {
    const { giorno, ora: h } = partiRoma(ora);
    if (h < ORA_RIEPILOGO) return null;
    const ieri = giornoPrima(giorno);
    const chiave = `riepilogo:${ieri}`;
    return giaInviati.has(chiave) ? null : { giorno: ieri, chiave };
}

export function comporreRiepilogo(c: Conteggi, t: Traffico | null): EmailComposta {
    const costi = costiGiorno(c, t);
    const righe: RigaRiepilogo[] = [
        { etichetta: 'Giri generati', valore: numero(c.giri) },
        { etichetta: 'Racconti nuovi (passati / scartati / senza fonti)', valore: `${c.racconti.passati} / ${c.racconti.scartati} / ${c.racconti.senzaFonti}` },
        { etichetta: 'Chiamate di chat e contorno', valore: numero(c.chat) },
        { etichetta: 'Ospiti nuovi', valore: numero(c.ospiti) },
        { etichetta: 'Audio nuovi della voce', valore: numero(c.vociNuove) },
        {
            etichetta: 'Errori del proxy',
            valore: t ? `${numero(t.proxyErrori)} su ${numero(t.proxyRichieste)} (${percentuale(tassoErrori(t.proxyRichieste, t.proxyErrori))})` : 'log non leggibili',
        },
        { etichetta: "Errori dell'app", valore: numero(c.erroriApp.totale) },
        { etichetta: 'Costo AI stimato', valore: dollari(costi.ai) },
        { etichetta: 'Costo Google stimato', valore: costi.googleDisponibile ? dollari(costi.google) : 'log non leggibili' },
        { etichetta: 'Totale stimato', valore: dollari(costi.totale) },
    ];
    const note: string[] = [];
    if (!t) note.push('I log delle funzioni non si sono potuti leggere: errori del proxy e costo Google mancano (secret AVVISI_SUPABASE_TOKEN).');
    if (c.erroriApp.top.length) note.push(`Errori dell'app più frequenti: ${c.erroriApp.top.map((e) => `«${e.messaggio}» ×${e.n}`).join('; ')}.`);
    note.push('I giri contano i biglietti della quota: gli account di prova non ne hanno, quindi non entrano.');
    return emailRiepilogo({
        giornoEtichetta: giornoEsteso(c.giorno),
        titolo: `Unnivai ${giornoEsteso(c.giorno)}: ${numero(c.giri)} giri, ${dollari(costi.totale)} stimati`,
        righe,
        note,
    });
}

// ─── Orchestrazione (con le dipendenze iniettate: la funzione le collega, i test le fingono) ────────────────────────────
export type Dipendenze = {
    ora: Date;
    sogliaCostoUsd: number;
    leggiConteggi: (giorno: string) => Promise<Conteggi>;
    /** Traffico dei log: `giorno` intero (Europe/Rome) oppure l'ultima ora. null = log non leggibili. */
    leggiTraffico: (da: Date, a: Date) => Promise<Traffico | null>;
    /** Chiavi già mandate (avvisi_inviati). */
    leggiInviati: () => Promise<Set<string>>;
    /** Prende la chiave una volta sola; false = qualcuno l'ha già presa. */
    prendi: (chiave: string) => Promise<boolean>;
    rilascia: (chiave: string) => Promise<void>;
    invia: (email: EmailComposta) => Promise<boolean>;
};
export type Esito = { mandati: string[]; saltati: string[]; errori: string[] };

/** L'inizio del giorno Roma `giorno` come istante UTC (prova le due ore possibili per l'ora legale). */
export function inizioGiornoRoma(giorno: string): Date {
    for (const off of [1, 2]) {
        const d = new Date(`${giorno}T00:00:00Z`);
        d.setUTCHours(d.getUTCHours() - off);
        if (partiRoma(d).giorno === giorno && partiRoma(new Date(d.getTime() - 1)).giorno !== giorno) return d;
    }
    return new Date(`${giorno}T00:00:00Z`);
}

async function manda(chiave: string, email: EmailComposta, d: Dipendenze, e: Esito) {
    if (!(await d.prendi(chiave))) { e.saltati.push(chiave); return; }
    let ok = false;
    try { ok = await d.invia(email); } catch { ok = false; }
    if (ok) e.mandati.push(chiave);
    else { await d.rilascia(chiave); e.errori.push(chiave); }
}

/** Una esecuzione oraria: avvisi immediati + il riepilogo di ieri se è l'ora. */
export async function eseguiOraria(d: Dipendenze): Promise<Esito> {
    const e: Esito = { mandati: [], saltati: [], errori: [] };
    const inviati = await d.leggiInviati();
    const { giorno } = partiRoma(d.ora);
    const inizio = inizioGiornoRoma(giorno);

    const [conteggiOggi, trafficoOggi, trafficoOra] = await Promise.all([
        d.leggiConteggi(giorno), d.leggiTraffico(inizio, d.ora), d.leggiTraffico(new Date(d.ora.getTime() - 3600_000), d.ora),
    ]);
    const avvisi = valutaAvvisi({
        ora: d.ora, costoOggi: costiGiorno(conteggiOggi, trafficoOggi), sogliaCostoUsd: d.sogliaCostoUsd,
        ultimaOra: trafficoOra ? { richieste: trafficoOra.proxyRichieste, errori: trafficoOra.proxyErrori } : null,
        giaInviati: inviati,
    });
    for (const a of avvisi) await manda(a.chiave, a.email, d, e);

    const r = decidiRiepilogo(d.ora, inviati);
    if (r) {
        const [c, t] = await Promise.all([d.leggiConteggi(r.giorno), d.leggiTraffico(inizioGiornoRoma(r.giorno), inizio)]);
        await manda(r.chiave, comporreRiepilogo(c, t), d, e);
    }
    return e;
}
