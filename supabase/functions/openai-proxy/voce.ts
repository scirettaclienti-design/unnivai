/**
 * VOCE-1 — la voce umana della navigazione (OpenAI gpt-4o-mini-tts), pezzi PURI (nessun import):
 * li usa openai-proxy (Deno, `dv.purpose = 'voce'`) e li prova la suite (vitest).
 *
 * Il client manda solo testo e voce: modello, istruzione di tono e formato li scrive QUI, nessuno può cambiarli.
 * Ogni audio è nella cache (Supabase Storage, bucket `voce-cache`) con chiave = SHA-256 di modello + voce + istruzione + testo:
 * una frase già detta non richiama OpenAI e costa 0 $.
 */

export const MODELLO_VOCE = 'gpt-4o-mini-tts';
export const VOCI_AMMESSE = ['marin', 'cedar'] as const;
export const VOCE_PREDEFINITA = 'marin';
export const ISTRUZIONE_TONO =
  'Parli in italiano come un amico del posto che accompagna a piedi: calmo, caldo, sorriso nella voce, frasi naturali, mai da guida turistica, mai enfatico.';
export const BUCKET_VOCE = 'voce-cache';
/** Una frase di navigazione o un racconto di tappa: oltre questo non è una frase, non si genera. */
export const MAX_CARATTERI_VOCE = 900;
/** Tetto giornaliero di audio NUOVI (non della cache), per tutti: protegge la spesa. Il secret VOCE_DAILY_CAP lo cambia senza deploy. */
export const TETTO_NUOVI_DEFAULT = 200;

export const normalizzaTesto = (t: unknown): string => String(t ?? '').replace(/\s+/g, ' ').trim();

export function voceValida(v: unknown): v is (typeof VOCI_AMMESSE)[number] {
  return typeof v === 'string' && (VOCI_AMMESSE as readonly string[]).includes(v);
}

export function testoValido(t: unknown): boolean {
  if (typeof t !== 'string') return false;
  const n = normalizzaTesto(t);
  return n.length >= 2 && n.length <= MAX_CARATTERI_VOCE;
}

export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/** La chiave della cache: testo + voce + modello + istruzione. Cambiare uno dei quattro = un audio nuovo. */
export async function chiaveAudio(testo: string, voce: string): Promise<string> {
  return sha256Hex(JSON.stringify([MODELLO_VOCE, voce, ISTRUZIONE_TONO, normalizzaTesto(testo)]));
}

export const percorsoAudio = (chiave: string): string => `v1/${chiave}.mp3`;

export function tettoNuovi(raw: string | undefined | null): number {
  if (raw === undefined || raw === null || raw === '') return TETTO_NUOVI_DEFAULT;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : TETTO_NUOVI_DEFAULT;
}

/** Il corpo della chiamata a OpenAI /audio/speech. */
export function corpoVoce(testo: string, voce: string) {
  return {
    model: MODELLO_VOCE,
    voice: voce,
    input: normalizzaTesto(testo),
    instructions: ISTRUZIONE_TONO,
    response_format: 'mp3',
  };
}

/** Stima del costo di UN audio nuovo (prezzo di listino ~0,015 $ al minuto di audio; ~14 caratteri al secondo di parlato). Non è una fattura. */
export const COSTO_AL_MINUTO_USD = 0.015;
export const CARATTERI_AL_SECONDO = 14;
export function costoStimatoUsd(testo: string): number {
  const sec = normalizzaTesto(testo).length / CARATTERI_AL_SECONDO;
  return Math.round((sec / 60) * COSTO_AL_MINUTO_USD * 1e6) / 1e6;
}
