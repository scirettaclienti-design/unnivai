/**
 * FORNITORE-AI — il testo del proxy può uscire da Claude (Anthropic) al posto di OpenAI.
 *
 * Il client e i prompt non cambiano: il proxy riceve sempre il formato di OpenAI (`/chat/completions`), lo traduce nel
 * formato Messages di Anthropic, e restituisce la risposta nel formato di OpenAI (`choices[0].message.content`, `usage`).
 * Il fornitore lo sceglie il secret `AI_PROVIDER` (`anthropic` | `openai`; assente o diverso = `openai`, come prima).
 * La voce (`gpt-4o-mini-tts`) non passa da qui.
 *
 * Modelli: uno per compito, ognuno cambiabile con un secret senza deploy (`ANTHROPIC_MODEL_<COMPITO>`, es. `ANTHROPIC_MODEL_LISTA`).
 * Il valore e' un elenco separato da virgole: si prova il primo; se Anthropic non lo conosce (404) si passa al successivo, e un modello
 * che non esiste non si richiede piu' fino al prossimo avvio. Difetti sotto (decisione di Ivano). Opus non si usa nella generazione dei giri.
 *
 * Modulo PURO (nessun import, `fetch` passato da fuori): lo usa openai-proxy (Deno) e lo prova la suite (vitest).
 */

export type Fornitore = 'anthropic' | 'openai';

export const FORNITORE_DI_PRIMA: Fornitore = 'openai';
export const MODELLO_VELOCE = 'claude-haiku-5-5,claude-haiku-4-5';   // il 5.5 se risponde, altrimenti il 4.5
export const MODELLO_NARRATORE = 'claude-sonnet-5-5';
export type Compito = 'traduttore' | 'selettore' | 'notifiche' | 'narratore' | 'lista' | 'quartiere' | 'contorno';
/** Compito → modelli di difetto. `contorno` = ogni chiamata senza passaggio (chat, monumenti, meteo, business). */
export const MODELLI_ANTHROPIC_DIFETTO: Record<Compito, string> = {
    traduttore: MODELLO_VELOCE, selettore: MODELLO_VELOCE, notifiche: MODELLO_VELOCE,
    narratore: MODELLO_NARRATORE, lista: MODELLO_NARRATORE, quartiere: MODELLO_NARRATORE, contorno: MODELLO_NARRATORE,
};
export const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
export const ANTHROPIC_VERSION = '2023-06-01';

type Env = (nome: string) => string | undefined;

export const fornitoreScelto = (env: Env): Fornitore => (String(env('AI_PROVIDER') ?? '').trim().toLowerCase() === 'anthropic' ? 'anthropic' : FORNITORE_DI_PRIMA);

export const compitoDi = (passaggio: unknown): Compito =>
    (typeof passaggio === 'string' && passaggio in MODELLI_ANTHROPIC_DIFETTO && passaggio !== 'contorno' ? passaggio : 'contorno') as Compito;

/** I modelli Claude di un compito, in ordine di preferenza: il secret `ANTHROPIC_MODEL_<COMPITO>` (elenco con virgole) o il difetto. */
export function modelliAnthropicPer(passaggio: unknown, env: Env): string[] {
    const c = compitoDi(passaggio);
    const voce = String(env(`ANTHROPIC_MODEL_${c.toUpperCase()}`) ?? '').trim() || MODELLI_ANTHROPIC_DIFETTO[c];
    return voce.split(',').map((m) => m.trim()).filter(Boolean);
}

/** Sonnet 5.5 rifiuta temperature diverse da quella di difetto (400) e ragiona di suo: lo si tiene senza ragionamento. */
const eSonnet5 = (modello: string) => /^claude-sonnet-5/.test(modello);
/** I modelli della famiglia 5 rifiutano `temperature` (400: «`temperature` is deprecated for this model», visto dal vivo su claude-haiku-5-5). */
const rifiutaTemperature = (modello: string) => /^claude-[a-z]+-5/.test(modello);

// deno-lint-ignore no-explicit-any
type Corpo = Record<string, any>;

const testoDi = (c: unknown): string => {
    if (typeof c === 'string') return c;
    if (!Array.isArray(c)) return '';
    return c.map((p) => (p && typeof p === 'object' && p.type === 'text' ? String(p.text ?? '') : '')).filter(Boolean).join('\n');
};

/** Un pezzo di contenuto OpenAI (testo o immagine) → blocco Anthropic. Un'immagine data: diventa base64, un URL resta URL. */
// deno-lint-ignore no-explicit-any
function bloccoDa(p: any): Corpo | null {
    if (typeof p === 'string') return p ? { type: 'text', text: p } : null;
    if (!p || typeof p !== 'object') return null;
    if (p.type === 'text') return p.text ? { type: 'text', text: String(p.text) } : null;
    if (p.type === 'image_url') {
        const url = String(p.image_url?.url ?? p.image_url ?? '');
        const m = /^data:(image\/[a-z+.-]+);base64,(.+)$/i.exec(url);
        if (m) return { type: 'image', source: { type: 'base64', media_type: m[1].toLowerCase(), data: m[2] } };
        if (/^https?:\/\//i.test(url)) return { type: 'image', source: { type: 'url', url } };
    }
    return null;
}

const CHIEDE_JSON = 'Rispondi solo con un oggetto JSON valido, senza testo prima o dopo e senza blocchi di codice.';

/**
 * Il corpo di OpenAI → il corpo di Anthropic. Stessi messaggi, stesso tetto di token; i messaggi `system` diventano `system`;
 * `response_format: json_object` (che Anthropic non ha) diventa una riga in coda al system (e la risposta si ripulisce, vedi `estraiJson`).
 */
export function corpoAnthropic(modello: string, payload: Corpo): Corpo {
    const sistema: string[] = [];
    const messaggi: Array<{ role: 'user' | 'assistant'; content: Corpo[] | string }> = [];
    for (const m of Array.isArray(payload.messages) ? payload.messages : []) {
        if (!m || typeof m !== 'object') continue;
        if (m.role === 'system' || m.role === 'developer') { const t = testoDi(m.content); if (t) sistema.push(t); continue; }
        const ruolo = m.role === 'assistant' ? 'assistant' : 'user';
        const blocchi = (typeof m.content === 'string' ? [m.content] : Array.isArray(m.content) ? m.content : []).map(bloccoDa).filter(Boolean) as Corpo[];
        if (blocchi.length) messaggi.push({ role: ruolo, content: blocchi });
    }
    // Anthropic vuole che si cominci da un messaggio dell'utente
    if (!messaggi.length || messaggi[0].role !== 'user') messaggi.unshift({ role: 'user', content: [{ type: 'text', text: '.' }] });
    const json = payload.response_format?.type === 'json_object';
    if (json) sistema.push(CHIEDE_JSON);
    const chiesti = Number(payload.max_tokens ?? payload.max_completion_tokens);
    const corpo: Corpo = {
        model: modello,
        max_tokens: Number.isFinite(chiesti) && chiesti > 0 ? Math.floor(chiesti) : 2000,
        messages: messaggi,
    };
    if (sistema.length) corpo.system = sistema.join('\n\n');
    // la famiglia 5 ragiona di suo e i token del ragionamento si pagano dal tetto di uscita: senza spegnerlo un testo breve puo' uscire vuoto
    if (eSonnet5(modello) || rifiutaTemperature(modello)) corpo.thinking = { type: 'between_tools' };
    if (!rifiutaTemperature(modello) && Number.isFinite(Number(payload.temperature)) && payload.temperature !== undefined) corpo.temperature = Math.min(1, Math.max(0, Number(payload.temperature)));
    return corpo;
}

/** Da un testo che dovrebbe essere JSON: toglie i blocchi di codice e prende il primo oggetto completo. Se non lo trova, restituisce il testo. */
export function estraiJson(testo: string): string {
    const t = String(testo ?? '').trim();
    if (!t) return t;
    const senzaCodice = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    try { JSON.parse(senzaCodice); return senzaCodice; } catch { /* si cerca l'oggetto */ }
    const a = senzaCodice.indexOf('{');
    if (a < 0) return t;
    let livello = 0, dentro = false, esc = false;
    for (let i = a; i < senzaCodice.length; i++) {
        const c = senzaCodice[i];
        if (dentro) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') dentro = false; continue; }
        if (c === '"') dentro = true;
        else if (c === '{') livello++;
        else if (c === '}' && --livello === 0) {
            const cand = senzaCodice.slice(a, i + 1);
            try { JSON.parse(cand); return cand; } catch { return t; }
        }
    }
    return t;
}

/** La risposta di Anthropic → la forma di OpenAI che il client legge. Un rifiuto o un testo vuoto restano vuoti (il chiamante ripiega). */
export function rispostaComeOpenAi(d: Corpo, voleJson: boolean): Corpo {
    const testo = (Array.isArray(d?.content) ? d.content : []).filter((b: Corpo) => b?.type === 'text').map((b: Corpo) => String(b.text ?? '')).join('');
    const rifiuto = d?.stop_reason === 'refusal';
    const u = d?.usage ?? {};
    const input = (Number(u.input_tokens) || 0) + (Number(u.cache_creation_input_tokens) || 0) + (Number(u.cache_read_input_tokens) || 0);
    return {
        id: d?.id ?? null,
        object: 'chat.completion',
        model: d?.model ?? null,
        choices: [{ index: 0, message: { role: 'assistant', content: rifiuto ? '' : (voleJson ? estraiJson(testo) : testo) }, finish_reason: d?.stop_reason === 'max_tokens' ? 'length' : 'stop' }],
        usage: { prompt_tokens: input, completion_tokens: Number(u.output_tokens) || 0, total_tokens: input + (Number(u.output_tokens) || 0) },
        // per i log quando il testo e' vuoto: perche' Anthropic si e' fermato e che blocchi ha mandato
        _stop: { stop_reason: d?.stop_reason ?? null, blocchi: (Array.isArray(d?.content) ? d.content : []).map((b: Corpo) => String(b?.type)) },
    };
}

export type CodiceMotore = 'OPENAI_CREDIT_EXHAUSTED' | 'OPENAI_RATE_LIMITED' | 'OPENAI_ERROR';

/** Il tipo di guasto di Anthropic (credito finito = 400 «credit balance is too low», 402 o 403 di fatturazione), con i codici che il client gia' conosce. */
export function classificaErroreAnthropic(status: number, tipo: unknown, messaggio: unknown): CodiceMotore {
    const m = String(messaggio ?? '').toLowerCase();
    if (status === 402 || tipo === 'billing_error' || /credit balance|billing|insufficient/.test(m)) return 'OPENAI_CREDIT_EXHAUSTED';
    if (status === 429 || status === 529 || tipo === 'rate_limit_error' || tipo === 'overloaded_error') return 'OPENAI_RATE_LIMITED';
    return 'OPENAI_ERROR';
}

export class ErroreAnthropic extends Error {
    status: number; codice: CodiceMotore;
    constructor(status: number, tipo: unknown, messaggio: unknown) {
        super(`HTTP ${status} ${String(tipo ?? '-').slice(0, 40)} ${String(messaggio ?? '').replace(/\s+/g, ' ').slice(0, 60)}`.slice(0, 120));
        this.name = 'ErroreAnthropic';
        this.status = status;
        this.codice = classificaErroreAnthropic(status, tipo, messaggio);
    }
}

/**
 * Una chiamata a Anthropic con il corpo di OpenAI; restituisce la risposta nella forma di OpenAI.
 * Lancia `ErroreAnthropic` (HTTP non ok), l'errore di rete, o `AbortError` allo scadere di `limiteMs`. La chiave non esce mai da qui.
 */
export async function chiamaAnthropic(apiKey: string, modello: string, payload: Corpo, limiteMs: number,
    // deno-lint-ignore no-explicit-any
    invia: (url: string, init: any) => Promise<Response> = fetch): Promise<Corpo> {
    try {
        return await chiamaAnthropicUna(apiKey, modello, payload, limiteMs, invia, false);
    } catch (err) {
        // un modello che non conosce il parametro del ragionamento (400 che lo nomina): si riprova senza, con margine di token per un eventuale ragionamento
        if (err instanceof ErroreAnthropic && err.status === 400 && /thinking|between_tools/i.test(err.message)) {
            return await chiamaAnthropicUna(apiKey, modello, payload, limiteMs, invia, true);
        }
        throw err;
    }
}

async function chiamaAnthropicUna(apiKey: string, modello: string, payload: Corpo, limiteMs: number,
    // deno-lint-ignore no-explicit-any
    invia: (url: string, init: any) => Promise<Response>, senzaRagionamento: boolean): Promise<Corpo> {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), limiteMs);
    try {
        const r = await invia(ANTHROPIC_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': ANTHROPIC_VERSION },
            body: JSON.stringify(senzaRagionamento
                ? (({ thinking: _t, ...resto }) => ({ ...resto, max_tokens: Math.min(resto.max_tokens + 1500, 8000) }))(corpoAnthropic(modello, payload))
                : corpoAnthropic(modello, payload)),
            signal: c.signal,
        });
        const d = await r.json().catch(() => null);
        if (!r.ok) throw new ErroreAnthropic(r.status, d?.error?.type, d?.error?.message);
        // il modello chiesto (la sigla del listino), non l'alias datato che Anthropic restituisce
        return { ...rispostaComeOpenAi(d, payload.response_format?.type === 'json_object'), model: modello };
    } finally {
        clearTimeout(t);
    }
}

/** Modelli che Anthropic ha dichiarato inesistenti (404): non si richiedono piu' finche' l'istanza vive. */
const inesistenti = new Set<string>();

/**
 * Come `chiamaAnthropic`, con l'elenco dei modelli del compito: il primo che esiste. Solo un 404 («model not found») fa passare al
 * successivo; ogni altro errore (credito, tempo, 5xx) lo lancia, e decide il chiamante (nuovo tentativo, poi OpenAI).
 */
export async function chiamaAnthropicElenco(apiKey: string, modelli: string[], payload: Corpo, limiteMs: number,
    // deno-lint-ignore no-explicit-any
    invia: (url: string, init: any) => Promise<Response> = fetch): Promise<Corpo> {
    const candidati = modelli.filter((m) => !inesistenti.has(m));
    let ultimo: unknown = new ErroreAnthropic(404, 'not_found_error', 'nessun modello disponibile');
    for (const m of candidati.length ? candidati : modelli.slice(-1)) {
        try {
            return await chiamaAnthropic(apiKey, m, payload, limiteMs, invia);
        } catch (err) {
            if (err instanceof ErroreAnthropic && err.status === 404) { inesistenti.add(m); ultimo = err; continue; }
            throw err;
        }
    }
    throw ultimo;
}

/** Per i test: dimentica i modelli segnati come inesistenti. */
export const dimenticaInesistenti = () => inesistenti.clear();

/** Costo stimato in dollari di una chiamata Claude dai token (listino in banco.config.json). */
export const PREZZI_ANTHROPIC_USD_PER_MILIONE: Record<string, { input: number; output: number }> = {
    'claude-haiku-4-5': { input: 1.0, output: 5.0 },
    'claude-haiku-5-5': { input: 1.0, output: 5.0 },   // da verificare sul listino se esiste
    'claude-sonnet-5-5': { input: 2.0, output: 10.0 },
};
