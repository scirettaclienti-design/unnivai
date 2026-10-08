/**
 * Gate P8b — guasto del motore (OpenAI o proxy): quando OpenAI rifiuta
 * (credito esaurito, troppe richieste, errore) o non risponde.
 *
 * Stesso testo in tutte le schermate, in italiano, senza dettagli tecnici:
 * mai "[object Object]", mai una schermata vuota. `kind` resta per log e test:
 *   'credit' | 'rate' | 'openai' (dal codice del proxy) · 'proxy' (altro
 *   rifiuto del proxy) · 'network' | 'timeout' (nessuna risposta).
 *
 * La quota esaurita NON e' un guasto: ha i suoi testi (AiQuotaExceededError).
 * Modulo senza import, perche' lo usano sia il servizio sia le pagine (che nei
 * test simulano il servizio).
 */

export const AI_ENGINE_MESSAGE = 'Il motore si è fermato un attimo. Riprova tra qualche minuto.';

export const AI_ENGINE_KIND_BY_CODE = {
    OPENAI_CREDIT_EXHAUSTED: 'credit',
    OPENAI_RATE_LIMITED: 'rate',
    OPENAI_ERROR: 'openai',
};

export class AiEngineError extends Error {
    constructor(kind = 'openai', status = null) {
        super(`AI engine down (${kind})`);
        this.name = 'AiEngineError';
        this.code = 'AI_ENGINE_DOWN';
        this.kind = kind;
        this.status = status;
        this.userMessage = AI_ENGINE_MESSAGE;
    }
}

export const isAiEngineError = (err) => err?.code === 'AI_ENGINE_DOWN';
