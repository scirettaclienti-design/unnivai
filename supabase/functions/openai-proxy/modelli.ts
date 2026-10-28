/**
 * C10b2 — IL MODELLO DI OGNI PASSAGGIO, in un posto solo (decisione di Ivano).
 *
 * Il client non sceglie il modello: dice quale passaggio sta chiamando (`dv.passaggio`) e il proxy usa quello scritto qui.
 * Lista della città (con la chiamata degli abitanti) e lista dedicata del quartiere passano dal server; traduttore,
 * selettore e narratore arrivano dal client. Il narratore (frasi chiuse) resta sul modello di prima.
 *
 * Se il modello del passaggio risponde con un errore, lo si richiama una volta (C10b3-bis); se non risponde, risponde
 * vuoto, va oltre `timeoutMs` o sbaglia anche la seconda volta, il proxy rifà la stessa chiamata con MODELLO_DI_PRIMA e lo scrive nella risposta (`_modello`: chiesto, usato, ripiego, motivo, ms).
 *
 * Modulo PURO (nessun import): lo usa openai-proxy (Deno) e lo prova la suite (vitest).
 */

export const MODELLO_DI_PRIMA = 'gpt-4o-mini';

export type Passaggio = 'lista' | 'quartiere' | 'traduttore' | 'selettore' | 'narratore' | 'notifiche';

/**
 * Il modello e il tempo massimo di ogni passaggio. Tempi scelti perche' il ripiego stia dentro l'attesa del client:
 * selettore 22 s (+ ripiego ~10 s, il client aspetta 50 s); traduttore 15 s (il client non ha un tempo massimo);
 * lista e quartiere 60 s (+ ripiego e verifica su Google, il client aspetta 110 s). Misurato il 14/10: gpt-6.1-sol scrive
 * ~37 token al secondo, una lista da 15–18 posti (1.000–1.400 token) chiede 30–45 s; con 28 s ripiegavano 5 liste su 6.
 */
export const MODELLI: Record<Passaggio, { modello: string; timeoutMs: number }> = {
    lista: { modello: 'gpt-6.1-sol', timeoutMs: 60_000 },
    quartiere: { modello: 'gpt-6.1-sol', timeoutMs: 60_000 },
    traduttore: { modello: 'gpt-6.1-sol', timeoutMs: 15_000 },
    selettore: { modello: 'gpt-6.1-sol', timeoutMs: 22_000 },
    narratore: { modello: MODELLO_DI_PRIMA, timeoutMs: 25_000 },
    notifiche: { modello: MODELLO_DI_PRIMA, timeoutMs: 25_000 },   // FORNITORE-AI: la nota breve; con OpenAI resta com'era (gpt-4o-mini)
};

/**
 * Come si chiama ogni modello. gpt-6.1-sol ragiona (prova del 14/10 sull'account): rifiuta `max_tokens` (vuole
 * `max_completion_tokens`, che conta anche il ragionamento), accetta solo la `temperature` di difetto (1), e
 * `reasoning_effort` va da 'low' in su. `margine`: token in piu' per il ragionamento, oltre a quelli della risposta.
 */
export const CARATTERISTICHE: Record<string, { ragiona: boolean; sforzo?: string; margine?: number; tettoToken?: number }> = {
    'gpt-6.1-sol': { ragiona: true, sforzo: 'low', margine: 3000, tettoToken: 8000 },
    'gpt-4o-mini': { ragiona: false },
};

/** Il primo tentativo di un passaggio quando il fornitore non e' OpenAI: modello, tempo massimo e la chiamata (corpo di OpenAI → risposta nella forma di OpenAI). */
export type Primo = { fornitore: string; modello: string; timeoutMs: number; tentativi?: number; invia: (payload: Record<string, any>, limiteMs: number) => Promise<any> };

export const PASSAGGI = new Set<string>(Object.keys(MODELLI));
export const passaggioValido = (p: unknown): p is Passaggio => typeof p === 'string' && PASSAGGI.has(p);
export const MODELLI_AMMESSI = new Set<string>([MODELLO_DI_PRIMA, ...Object.values(MODELLI).map(m => m.modello)]);

/** Il modello del passaggio (senza passaggio: quello chiesto dal client, come prima). */
export const modelloPer = (passaggio: unknown, chiesto: string): string => (passaggioValido(passaggio) ? MODELLI[passaggio].modello : chiesto);
export const timeoutPer = (passaggio: unknown, difetto: number): number => (passaggioValido(passaggio) ? MODELLI[passaggio].timeoutMs : difetto);

/**
 * Il corpo della chiamata adattato al modello. Per un modello che ragiona: `max_tokens` → `max_completion_tokens` (+ il
 * margine del ragionamento, fino al tetto), via `temperature`, `reasoning_effort` dal listino sopra. Per gli altri: com'e'.
 */
// deno-lint-ignore no-explicit-any
export function corpoPer(modello: string, payload: Record<string, any>): Record<string, any> {
    const c = CARATTERISTICHE[modello];
    // deno-lint-ignore no-explicit-any
    const base: Record<string, any> = { ...payload, model: modello };
    if (!c?.ragiona) return base;
    const { max_tokens, max_completion_tokens, temperature: _t, top_p: _p, ...resto } = base;
    const chiesti = Number(max_completion_tokens ?? max_tokens);
    const uscita = Math.min(c.tettoToken ?? 8000, (Number.isFinite(chiesti) && chiesti > 0 ? chiesti : 2000) + (c.margine ?? 0));
    return { ...resto, max_completion_tokens: uscita, ...(c.sforzo ? { reasoning_effort: c.sforzo } : {}) };
}

/** Una risposta di OpenAI senza testo (un modello che ragiona puo' finire i token nel ragionamento) e' un guasto: si ripiega. */
// deno-lint-ignore no-explicit-any
export const rispostaVuota = (data: any): boolean => !String(data?.choices?.[0]?.message?.content ?? '').trim();

/**
 * La chiamata di un passaggio col suo modello e, se fallisce, col modello di prima. `invia(corpo, limiteMs)` fa la chiamata
 * vera (con il suo tempo massimo) e restituisce il JSON di OpenAI, o lancia: un errore con `name === 'AbortError'` e' un
 * tempo massimo superato. Restituisce i dati e `info` per il tracciato (chiesto, usato, ripiego, motivo, ms, usage).
 */
// deno-lint-ignore no-explicit-any
export async function chiamaConRipiego(passaggio: Passaggio, payload: Record<string, any>, invia: (corpo: Record<string, any>, limiteMs: number) => Promise<any>,
    limiteDiPrima = 45_000, primo?: Primo) {
    // FORNITORE-AI — con `primo` (Claude) il primo tentativo e' il suo; se fallisce si torna a OpenAI (`invia`), sempre al modello di prima.
    const { modello, timeoutMs } = primo ? { modello: primo.modello, timeoutMs: primo.timeoutMs } : MODELLI[passaggio];
    const fornitore = primo ? primo.fornitore : 'openai';
    const t0 = Date.now();
    let motivo: string | null = null;
    // C10b3-bis (decisione di Ivano) — un ERRORE del modello nuovo (non il tempo scaduto, non la risposta vuota) ha UN nuovo
    // tentativo, con lo stesso tempo massimo, prima del ripiego. Il primo errore resta nel tracciato (`primoErrore`).
    let primoErrore: string | null = null;
    if (primo || modello !== MODELLO_DI_PRIMA) {
        for (let tentativo = 1; tentativo <= (primo?.tentativi ?? 2); tentativo++) {
            try {
                const d = primo ? await primo.invia(payload, timeoutMs) : await invia(corpoPer(modello, payload), timeoutMs);
                if (rispostaVuota(d)) throw Object.assign(new Error(`risposta vuota${d?._stop ? ` (${d._stop.stop_reason}; ${d._stop.blocchi.join('+') || 'nessun blocco'})` : ''}`), { vuota: true });
                return { data: d, info: { passaggio, chiesto: modello, usato: primo ? String(d?.model || modello) : modello, fornitore, ...(d?._variante ? { ragionamento: d._variante } : {}), ripiego: false, ms: Date.now() - t0, usage: d?.usage ?? null,
                    ...(primoErrore ? { tentativi: 2, primoErrore } : {}) } };
            } catch (err) {
                const scaduto = (err as Error)?.name === 'AbortError';
                motivo = scaduto ? `oltre il tempo massimo (${timeoutMs / 1000} s)` : String((err as Error)?.message ?? err).slice(0, 80);
                if (scaduto || (err as { vuota?: boolean })?.vuota || tentativo === (primo?.tentativi ?? 2) || (err as { codice?: string })?.codice === 'OPENAI_CREDIT_EXHAUSTED') break;
                primoErrore = motivo;
            }
        }
    }
    const t1 = Date.now();
    const d = await invia(corpoPer(MODELLO_DI_PRIMA, payload), limiteDiPrima);
    return {
        data: d,
        info: { passaggio, chiesto: modello, usato: MODELLO_DI_PRIMA, fornitore: 'openai', ripiego: !!primo || modello !== MODELLO_DI_PRIMA, ...(fornitore !== 'openai' ? { fornitoreChiesto: fornitore } : {}), ...(motivo ? { motivo, msChiesto: t1 - t0 } : {}),
            ...(primoErrore ? { tentativi: 2, primoErrore } : {}), ms: Date.now() - t1, usage: d?.usage ?? null },
    };
}

/**
 * C10b3-bis — i token di TUTTE le chiamate di una lista (abitanti, lista, completamento, ripieghi), dal tracciato dei modelli:
 * il costo salvato nella riga li conta tutti. Per modello, perche' i prezzi sono diversi.
 */
// deno-lint-ignore no-explicit-any
export function usageTotale(chiamate: Array<Record<string, any>>) {
    const perModello: Record<string, { prompt_tokens: number; completion_tokens: number }> = {};
    let prompt_tokens = 0, completion_tokens = 0;
    for (const c of chiamate || []) {
        const u = c?.usage;
        if (!u) continue;
        const p = Number(u.prompt_tokens) || 0, o = Number(u.completion_tokens) || 0;
        prompt_tokens += p; completion_tokens += o;
        const m = String(c.usato || '?');
        perModello[m] = { prompt_tokens: (perModello[m]?.prompt_tokens || 0) + p, completion_tokens: (perModello[m]?.completion_tokens || 0) + o };
    }
    return { prompt_tokens, completion_tokens, perModello };
}
