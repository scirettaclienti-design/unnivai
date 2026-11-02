/**
 * CURIOSITÀ DEL CAMMINO — fra una tappa e l'altra, una curiosità vera sulla via o sul quartiere che stai attraversando. Modulo puro (nessuna
 * rete, nessun Deno): lo usano il proxy (`dv.purpose = 'curiosita'`) e i test.
 *
 * È la macchina dei racconti di tappa (racconto.ts) con un'altra prima richiesta: stesse regole di voce (`REGOLE_VOCE`), stesso controllo
 * automatico (`controllaRacconto`: 2–4 frasi, numeri, nomi, parole-fatto, divieti), stesso revisore (`messaggiVerifica`, una frase «no» scarta),
 * stessa riscrittura unica, stessa soglia delle fonti (200 caratteri). Le fonti sono solo la voce di Wikipedia del luogo (curiositaFonti.ts).
 * Una curiosità per luogo, salvata in public.place_racconti con la chiave `curiosita-itwiki-<pageid>` (nessuna colonna nuova).
 */
import { REGOLE_VOCE, RISPOSTA_NIENTE, fontiPulite, TTL_RACCONTO_GIORNI, TTL_SCARTATO_GIORNI, type FontiRacconto } from './racconto.ts';

/** Versione del prompt della curiosità: se cambia, le curiosità in cache si riscrivono. Prompt di voce e controlli: quelli di racconto r7. */
export const VERSIONE_CURIOSITA = 'c1';
export const PREFISSO_CHIAVE = 'curiosita-itwiki-';
export const chiaveCuriosita = (pageid: number | string): string => `${PREFISSO_CHIAVE}${pageid}`;
export const eChiaveCuriosita = (k: unknown): boolean => typeof k === 'string' && /^curiosita-itwiki-\d{1,12}$/.test(k);

export type TipoLuogo = 'via' | 'quartiere';

export const SYSTEM_CURIOSITA = [
    'Sei la voce di Unnivai: un amico del posto che cammina con te fra una tappa e l\'altra.',
    'Racconta UNA curiosità del luogo che stai attraversando (una via, una piazza o un quartiere): da 2 a 3 frasi brevi, in italiano, in seconda persona singolare («tu»), dette ad alta voce mentre si cammina.',
    'Scegli nelle FONTI un fatto curioso e concreto (da dove viene il nome, com\'era una volta, un fatto successo lì, chi ci ha vissuto o lavorato) e raccontalo; la frase dopo, se c\'è, dice un altro fatto delle fonti sullo stesso tema.',
    'Chi ascolta sta camminando e può essere a qualche passo dal luogo: chiama il luogo per nome («Via dei Crociferi…», «Trastevere…»), non dire «sei in…», «qui», «guarda».',
    '',
    ...REGOLE_VOCE,
    '',
    'Rispondi solo con il testo della curiosità (o con la parola indicata sopra), niente altro.',
].join('\n');

const COSA: Record<TipoLuogo, string> = { via: 'la via o la piazza che stai attraversando', quartiere: 'il quartiere che stai attraversando' };

/** La prima richiesta al narratore per la curiosità di un luogo (stesso formato delle fonti del racconto: il revisore le legge uguali). */
export function messaggiCuriosita(f: FontiRacconto, tipo: TipoLuogo = 'via'): Array<{ role: 'system' | 'user'; content: string }> {
    const p = fontiPulite(f);
    const blocchi = [`LUOGO: ${p.nome}${p.citta ? ` (${p.citta})` : ''} — ${COSA[tipo] || COSA.via}`, ''];
    blocchi.push(p.wikipedia ? `FONTE 1 — Wikipedia:\n«${p.wikipedia}»` : 'FONTE 1 — Wikipedia: nessun testo.');
    blocchi.push('');
    blocchi.push(p.google ? `FONTE 2 — Descrizione Google del posto:\n«${p.google}»` : 'FONTE 2 — Descrizione Google del posto: nessuna.');
    blocchi.push('', 'Scrivi la curiosità.');
    return [{ role: 'system', content: SYSTEM_CURIOSITA }, { role: 'user', content: blocchi.join('\n') }];
}

/** Una riga di place_racconti vale ancora come curiosità? Stessa versione e dentro il suo tempo (passata 30 giorni, scartata o senza fonti 7). */
export function curiositaInCacheValida(riga: { versione?: string | null; esito?: string | null; created_at?: string | null } | null | undefined, oraMs = Date.now()): boolean {
    if (!riga || riga.versione !== VERSIONE_CURIOSITA || !riga.created_at) return false;
    const giorni = (oraMs - new Date(riga.created_at).getTime()) / 86_400_000;
    return Number.isFinite(giorni) && giorni < (riga.esito === 'passato' ? TTL_RACCONTO_GIORNI : TTL_SCARTATO_GIORNI);
}

export { RISPOSTA_NIENTE };
