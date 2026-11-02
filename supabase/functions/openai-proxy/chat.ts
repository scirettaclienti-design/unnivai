/**
 * CHAT-VERITA — la chat libera con la guida (`dv.purpose = 'chat'`): sui luoghi dice solo fatti delle fonti verificate, quando non ha una
 * fonte lo dice; su tutto il resto (consigli, ritmo, gusti) parla libera. Puro: niente rete, niente Deno (lo usa anche la prova in Node).
 *
 * Le fonti sono quelle dei racconti (raccontoFonti.ts: Wikipedia per nome e coordinate, descrizione Google), la macchina è quella dei
 * racconti (racconto.ts, scriviERivedi: controllo automatico, revisore con lo stesso modello, UNA riscrittura). Qui cambiano solo:
 *  · la prima richiesta (la domanda, la conversazione, il giro, le fonti di più luoghi);
 *  · la domanda al revisore: una frase senza fatti (un consiglio, un invito, «su questo non ho una fonte») è «sì»; una frase con un fatto è «sì»
 *    solo se il fatto sta nelle FONTI o nel GIRO;
 *  · il controllo automatico: numeri da 100 in su (date), cifre romane, nomi propri, parole vietate; non la forma del racconto;
 *  · se cade anche la riscrittura: restano le frasi che il revisore ha passato, più «Su questo non ho una fonte sicura.».
 */
import {
    REGOLE_VOCE, controllaRacconto, fontiPulite, frasiDi, ripulisciRacconto, scriviERivedi,
    type FontiRacconto, type EsitoControllo, type ChiamataModello, type Messaggi,
} from './racconto.ts';

export const VERSIONE_CHAT = 'c1';
export const RISPOSTA_ONESTA = 'Su questo non ho una fonte sicura.';
/** Dopo le frasi passate di una risposta ridotta: quello che manca è «il resto», non «questo». */
export const RISPOSTA_ONESTA_RESTO = 'Sul resto non ho una fonte sicura.';
export const LIMITI_CHAT = Object.freeze({
    domandaMax: 500, turnoMax: 600, turni: 6, luoghi: 12, luoghiConFonti: 3, luoghiDallaDomanda: 2,
    wikipediaPerLuogo: 1100, googlePerLuogo: 400, frasiMax: 5, carMax: 650,
});

/** Un luogo del giro come lo manda il telefono (solo dati strutturati: nessun testo libero oltre al nome). */
export type LuogoChat = { place_id?: string | null; nome: string; lat: number; lng: number; ora?: string | null; sosta?: number | null };
/** Le fonti di un luogo, come le prende il server. */
export type FonteLuogo = { nome: string; wikipedia?: { titolo: string; testo: string; url?: string } | null; google?: string | null };
export type Turno = { ruolo: 'utente' | 'guida'; testo: string };

/** Le fonti di tutta la richiesta: il formato dei racconti (il revisore e il controllo le leggono uguali) + la conversazione e il giro. */
export type FontiChat = FontiRacconto & { domanda: string; storia: Turno[]; giro: string; luoghiFonti: FonteLuogo[] };

const pulisci = (s: unknown, max: number) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’`´]/g, "'");

/** Le fonti di più luoghi in un blocco solo per luogo: «— Nome —» e il testo. Anche il revisore e il controllo automatico le leggono così. */
export function fontiChat(input: { citta: string; domanda: string; storia?: Turno[]; luoghi?: LuogoChat[]; prossima?: number | null; luoghiFonti: FonteLuogo[] }): FontiChat {
    const conFonti = input.luoghiFonti.filter((l) => (l.wikipedia?.testo || l.google));
    const wiki = conFonti.filter((l) => l.wikipedia?.testo).map((l) => `— ${pulisci(l.nome, 120)} —\n${pulisci(l.wikipedia!.testo, LIMITI_CHAT.wikipediaPerLuogo)}`).join('\n\n');
    const goog = conFonti.filter((l) => l.google).map((l) => `— ${pulisci(l.nome, 120)} —\n${pulisci(l.google, LIMITI_CHAT.googlePerLuogo)}`).join('\n\n');
    const luoghi = (input.luoghi || []).slice(0, LIMITI_CHAT.luoghi);
    return {
        nome: [...new Set([...luoghi.map((l) => pulisci(l.nome, 120)), ...input.luoghiFonti.map((l) => pulisci(l.nome, 120))])].filter(Boolean).join('; '),
        citta: pulisci(input.citta, 80),
        wikipedia: wiki ? { titolo: null, testo: wiki } : null,
        google: goog ? { testo: goog } : null,
        limiti: { wikipediaMax: (LIMITI_CHAT.wikipediaPerLuogo + 140) * (LIMITI_CHAT.luoghiConFonti + LIMITI_CHAT.luoghiDallaDomanda), googleMax: (LIMITI_CHAT.googlePerLuogo + 140) * (LIMITI_CHAT.luoghiConFonti + LIMITI_CHAT.luoghiDallaDomanda) },
        domanda: pulisci(input.domanda, LIMITI_CHAT.domandaMax),
        storia: (input.storia || []).slice(-LIMITI_CHAT.turni).map((t) => ({ ruolo: t.ruolo === 'guida' ? 'guida' : 'utente', testo: pulisci(t.testo, LIMITI_CHAT.turnoMax) })),
        giro: testoGiro(luoghi, input.prossima ?? null),
        luoghiFonti: input.luoghiFonti,
    };
}

/**
 * Il giro come lo vede la guida: tappe in ordine, con ora e sosta se ci sono, e quale è la prossima se il telefono lo sa (in navigazione).
 * Senza la prossima la guida non sa dove sei: lo dice la riga in fondo. Lo compone il server da campi controllati.
 */
export function testoGiro(luoghi: LuogoChat[], prossima: number | null = null): string {
    if (!luoghi.length) return '';
    const righe = luoghi.map((l, i) => {
        const ora = /^\d{1,2}:\d{2}$/.test(String(l.ora ?? '')) ? ` alle ${l.ora}` : '';
        const sosta = Number.isFinite(Number(l.sosta)) && Number(l.sosta) > 0 ? `, sosta ${Math.round(Number(l.sosta))} minuti` : '';
        return `${i + 1}. ${pulisci(l.nome, 120)}${ora}${sosta}${i === prossima ? ' ← la prossima tappa' : ''}`;
    });
    righe.push(prossima != null && luoghi[prossima] ? '' : 'Dove si trova adesso l\'utente nel giro non si sa.');
    return righe.filter(Boolean).join('\n');
}

/** Il corpo della chat dal telefono → dati controllati (solo campi attesi, lunghezze massime), o null se non valido. */
// deno-lint-ignore no-explicit-any
export function leggiRichiestaChat(dv: Record<string, any>): { domanda: string; citta: string; storia: Turno[]; luoghi: LuogoChat[]; aperto: LuogoChat | null; prossima: number | null; centro: { lat: number; lng: number } | null } | null {
  const domanda = typeof dv.domanda === 'string' ? dv.domanda.trim() : '';
  const citta = typeof dv.citta === 'string' ? dv.citta.trim() : '';
  if (!domanda || domanda.length > LIMITI_CHAT.domandaMax || citta.length > 80) return null;
  // null, '' e false non sono 0: Number(null) = 0 faceva della prima tappa «la prossima» quando il telefono non la sa (misura del 03/11)
  const numero = (x: unknown, max: number) => { const n = x == null || x === '' || typeof x === 'boolean' ? NaN : Number(x); return Number.isFinite(n) && Math.abs(n) <= max ? n : null; };
  // deno-lint-ignore no-explicit-any
  const storia: Turno[] = (Array.isArray(dv.storia) ? dv.storia : []).slice(-LIMITI_CHAT.turni).filter((t: any) => t && typeof t.testo === 'string' && t.testo.trim())
    // deno-lint-ignore no-explicit-any
    .map((t: any) => ({ ruolo: t.ruolo === 'guida' ? 'guida' : 'utente', testo: String(t.testo).slice(0, LIMITI_CHAT.turnoMax) }));
  // deno-lint-ignore no-explicit-any
  const luogo = (l: any): LuogoChat => ({
    place_id: typeof l?.place_id === 'string' && /^[A-Za-z0-9_-]{10,300}$/.test(l.place_id) ? l.place_id : null,
    nome: typeof l?.nome === 'string' ? l.nome.trim().slice(0, 120) : '',
    lat: numero(l?.lat, 90) as number, lng: numero(l?.lng, 180) as number,
    ora: typeof l?.ora === 'string' && /^\d{1,2}:\d{2}$/.test(l.ora) ? l.ora : null,
    sosta: numero(l?.sosta, 600),
  });
  const valido = (l: LuogoChat) => !!l.nome && l.lat != null && l.lng != null;
  const luoghi: LuogoChat[] = (Array.isArray(dv.luoghi) ? dv.luoghi : []).slice(0, LIMITI_CHAT.luoghi).map(luogo).filter(valido);
  const aperto = dv.aperto && typeof dv.aperto === 'object' ? luogo(dv.aperto) : null;
  const p = numero(dv.prossima, LIMITI_CHAT.luoghi);
  const prossima = p != null && Number.isInteger(p) && p >= 0 && p < luoghi.length ? p : null;
  const cLat = numero(dv.centro?.lat, 90), cLng = numero(dv.centro?.lng, 180);
  const centro = cLat != null && cLng != null ? { lat: cLat, lng: cLng }
    : luoghi.length ? { lat: luoghi.reduce((s, l) => s + l.lat, 0) / luoghi.length, lng: luoghi.reduce((s, l) => s + l.lng, 0) / luoghi.length } : null;
  return { domanda, citta, storia, luoghi, aperto: aperto && valido(aperto) ? aperto : null, prossima, centro };
}

// ─── quali luoghi hanno bisogno di fonti ─────────────────────────────────────────────────────────────────────────────

const PAROLE_VUOTE = new Set(['della', 'delle', 'degli', 'dello', 'dell', 'del', 'dei', 'di', 'da', 'la', 'il', 'lo', 'le', 'gli', 'i', 'e', 'a', 'in',
    'chiesa', 'piazza', 'via', 'palazzo', 'teatro', 'museo', 'fontana', 'monastero', 'basilica', 'cattedrale', 'parco', 'villa', 'porta', 'castello', 'san', 'santa', 'sant']);
const paroleProprie = (nome: string) => norm(nome).split(/[^a-z0-9']+/).flatMap((w) => w.split("'")).filter((w) => w.length >= 4 && !PAROLE_VUOTE.has(w));

/** Un luogo è nominato nella domanda se una sua parola propria (non «chiesa», «piazza»…) ci compare. */
export function nominatoIn(domanda: string, nome: string): boolean {
    const d = ` ${norm(domanda).replace(/[^a-z0-9]+/g, ' ')} `; // «dell'elefante» → «dell elefante»
    return paroleProprie(nome).some((w) => d.includes(` ${w} `) || d.includes(` ${w.slice(0, -1)}`));
}

/**
 * Le tappe di cui prendere le fonti, al più LIMITI_CHAT.luoghiConFonti: prima quelle nominate nella domanda (o nell'ultima risposta
 * della guida, per una domanda di seguito), poi il luogo aperto sulla mappa, la prossima tappa, le altre nell'ordine del giro.
 */
export function luoghiDaCercare(luoghi: LuogoChat[], domanda: string, storia: Turno[] = [], aperto: LuogoChat | null = null, prossima: number | null = null): LuogoChat[] {
    const tutti = aperto && !luoghi.some((l) => l.nome === aperto.nome) ? [aperto, ...luoghi] : luoghi;
    const ultima = [...storia].reverse().find((t) => t.ruolo === 'guida')?.testo || '';
    const nella = tutti.filter((l) => nominatoIn(domanda, l.nome));
    const prima = nella.length ? nella : tutti.filter((l) => nominatoIn(ultima, l.nome));
    const ordine = [...prima, ...(aperto ? tutti.filter((l) => l.nome === aperto.nome) : []), ...(prossima != null && luoghi[prossima] ? [luoghi[prossima]] : []), ...tutti];
    return ordine.filter((l, i) => ordine.findIndex((x) => x.nome === l.nome) === i).slice(0, LIMITI_CHAT.luoghiConFonti);
}

/** La ricerca su Wikipedia dei luoghi nominati nella domanda che non sono tappe: le parole della domanda senza quelle vuote, più la città. */
export function ricercaDallaDomanda(domanda: string, citta: string): string {
    const VUOTE = new Set(['che', 'chi', 'cosa', 'come', 'quando', 'dove', 'perche', 'quanto', 'quanti', 'quante', 'vero', 'raccontami', 'dimmi', 'parlami',
        'sai', 'puoi', 'qualcosa', 'storia', 'questo', 'questa', 'quello', 'quella', 'sono', 'stato', 'stata', 'fatto', 'fatta', 'ha', 'hanno', 'giusto', 'anche']);
    const parole = norm(domanda).replace(/[^a-z0-9' ]+/g, ' ').split(/\s+/).filter((w) => w.length >= 3 && !VUOTE.has(w) && !PAROLE_VUOTE.has(w));
    return [...parole.slice(0, 8), norm(citta)].join(' ').trim();
}

// ─── il prompt ──────────────────────────────────────────────────────────────────────────────────────────────────────

export const SYSTEM_CHAT = [
    'Sei la voce di Unnivai: un amico del posto che cammina con chi fa il giro e risponde alle sue domande in chat.',
    'Rispondi in italiano, in seconda persona singolare («tu»), con frasi brevi: da 1 a 4 frasi, al massimo 450 caratteri.',
    '',
    'DUE TIPI DI FRASE:',
    '- Frasi di FATTO: tutto ciò che si può dire vero o falso su un luogo, una persona, una storia (chi, cosa, quando, quanto, com\'è fatto, a cosa serviva, orari, prezzi, nomi, date, numeri). Ogni fatto deve stare scritto nelle FONTI o nel GIRO qui sotto, con le loro parole o con parole che dicono la stessa cosa. Niente da memoria, nemmeno se lo sai vero.',
    '- Frasi LIBERE: consigli, ritmo, gusti, inviti, domande, come goderti il giro («Fermati dieci minuti, te li sei guadagnati.»). Queste sono libere, purché non contengano fatti.',
    '',
    'QUANDO NON HAI UNA FONTE:',
    `- Se ti chiedono un fatto che le FONTI e il GIRO non dicono, dillo in modo naturale, con le parole tue o con «${RISPOSTA_ONESTA}», e se puoi offri quello che le fonti dicono davvero.`,
    '- Se la domanda contiene un fatto sbagliato o che le fonti non confermano («è vero che…?»), non confermarlo: di\' cosa dicono le fonti, oppure che su questo non hai una fonte.',
    '- Se ti chiedono di un luogo di un\'altra città, non raccontarlo: di\' che oggi sei qui e torna al giro.',
    '- Non dire «le fonti dicono», «secondo le fonti»: di\' il fatto e basta, come lo direbbe un amico che lo sa.',
    '',
    'REGOLE DI VOCE (le stesse dei racconti di tappa, dove parlano di «racconto» vale per la risposta):',
    ...REGOLE_VOCE.filter((r) => !/^8\. /.test(r) && !/NIENTE/.test(r)),
    '',
    'Rispondi solo con il testo della risposta, niente altro.',
].join('\n');

function blocchiFonti(f: FontiChat): string[] {
    const p = fontiPulite(f);
    return [
        `CITTÀ: ${p.citta || 'non indicata'}`,
        '',
        f.giro ? `GIRO (dall'app, in ordine):\n${f.giro}` : 'GIRO: nessuno.',
        '',
        p.wikipedia ? `FONTI — Wikipedia:\n${p.wikipedia}` : 'FONTI — Wikipedia: nessun testo.',
        '',
        p.google ? `FONTI — Descrizioni Google dei posti:\n${p.google}` : 'FONTI — Descrizioni Google dei posti: nessuna.',
    ];
}

export function messaggiChat(fonti: FontiRacconto): Array<{ role: 'system' | 'user'; content: string }> {
    const f = fonti as FontiChat;
    const storia = f.storia.length
        ? ['CONVERSAZIONE FIN QUI:', ...f.storia.map((t) => `${t.ruolo === 'guida' ? 'Tu' : 'Utente'}: ${t.testo}`), '']
        : [];
    return [
        { role: 'system', content: SYSTEM_CHAT },
        { role: 'user', content: [...blocchiFonti(f), '', ...storia, `DOMANDA: ${f.domanda}`, '', 'Rispondi.'].join('\n') },
    ];
}

// ─── il revisore: stesso modello dei racconti, la domanda per la chat ─────────────────────────────────────────────────

export const SYSTEM_VERIFICA_CHAT = [
    'Sei un revisore severo. Ricevi delle FONTI, il GIRO dell\'app e una RISPOSTA divisa in frasi numerate.',
    'Per OGNI frase decidi:',
    '- se la frase non afferma fatti (un consiglio, un invito, una domanda, un modo di dire, «su questo non ho una fonte», «oggi sei qui») → nelle_fonti = true;',
    '- se afferma fatti (chi, cosa, quando, quanto, com\'è fatto, a cosa serviva, nomi, date, numeri, titoli, qualità, colori, orari, prezzi, luoghi) → nelle_fonti = true SOLO se tutto ciò che afferma è scritto nelle FONTI o nel GIRO (anche con altre parole).',
    'Basta un dettaglio in più (un titolo, una data, un materiale, un autore, una conclusione non scritta) per «no». Non conta se il dettaglio è vero nella realtà: conta solo se è scritto qui.',
    'Una frase che conferma un fatto della domanda che le fonti non dicono è «no». Una frase su un luogo che le fonti non descrivono è «no».',
    '',
    'Rispondi SOLO con un oggetto JSON, nessun altro testo:',
    '{"frasi":[{"n":1,"nelle_fonti":true,"motivo":""},{"n":2,"nelle_fonti":false,"motivo":"cosa non c\'è nelle fonti"}]}',
    'Una voce per ogni frase, nello stesso ordine; «motivo» vuoto se nelle_fonti è true.',
].join('\n');

export function messaggiVerificaChat(testo: string, fonti: FontiRacconto): Messaggi {
    const f = fonti as FontiChat;
    const frasi = frasiDi(testo);
    return [
        { role: 'system', content: SYSTEM_VERIFICA_CHAT },
        { role: 'user', content: [...blocchiFonti(f), '', `DOMANDA DELL'UTENTE: ${f.domanda}`, '', 'RISPOSTA:', ...frasi.map((fr, i) => `${i + 1}. ${fr}`), '', 'Rispondi con il JSON.'].join('\n') },
    ];
}

/** Il controllo automatico della chat: quello dei racconti senza la forma del racconto, numeri da 100 in su; più la lunghezza della chat. */
export function controllaChat(testo: string, fonti: FontiRacconto): EsitoControllo {
    // I nomi della domanda («Michelangelo», «Colosseo») e il nome dell'app possono comparire anche in una risposta onesta («Michelangelo non
    // c'entra», «Unnivai»): non fanno cadere la risposta qui. Se una frase conferma un fatto della domanda, la ferma il revisore.
    const f = fonti as FontiChat;
    const ammessi = [f.domanda ?? '', f.giro ?? '', 'Unnivai', RISPOSTA_ONESTA, RISPOSTA_ONESTA_RESTO].join(' ');
    const c = controllaRacconto(testo, fonti, { forma: false, paroleFatto: false, numeroMin: 100, ammessi });
    const t = String(testo ?? '').trim();
    const motivi = [...c.motivi];
    if (frasiDi(t).length > LIMITI_CHAT.frasiMax) motivi.push(`più di ${LIMITI_CHAT.frasiMax} frasi`);
    if (t.length > LIMITI_CHAT.carMax) motivi.push(`più di ${LIMITI_CHAT.carMax} caratteri`);
    return { ...c, ok: motivi.length === 0, motivi };
}

export const CHIUSURA_CHAT: readonly string[] = [
    'Non aggiungere fatti che non siano nelle FONTI o nel GIRO. Le frasi libere (consigli, inviti) puoi tenerle. Da 1 a 4 frasi, nessuna direzione.',
    `Se togliendo quelle frasi non resta niente da dire sulla domanda, di\' in modo naturale che su questo non hai una fonte sicura («${RISPOSTA_ONESTA}»).`,
    'Rispondi solo con il nuovo testo della risposta.',
];

// ─── la risposta ────────────────────────────────────────────────────────────────────────────────────────────────────

export type EsitoChat = {
    testo: string;
    /** verificata: passata così; riscritta: passata dopo la riscrittura; ridotta: restano le frasi passate + la frase onesta; onesta: solo la frase onesta. */
    esito: 'verificata' | 'riscritta' | 'ridotta' | 'onesta';
    motivi: string[];
    modello: string | null;
    modelloVerifica: string | null;
    costoUsd: number;
    /** La prima stesura, se è stata riscritta: testo e perché è caduta. */
    prima: { testo: string; motivi: string[] } | null;
};

export async function rispondiInChat(f: FontiChat, scrivi: ChiamataModello, rivedi: ChiamataModello): Promise<EsitoChat> {
    const e = await scriviERivedi(f, scrivi, rivedi, { prima: messaggiChat, verifica: messaggiVerificaChat, controllo: controllaChat, chiusura: CHIUSURA_CHAT });
    const base = { motivi: e.motivi, modello: e.modello, modelloVerifica: e.modelloVerifica, costoUsd: e.costoUsd, prima: e.prima };
    if (e.ok) return { ...base, testo: e.testo, esito: e.riscritto ? 'riscritta' : 'verificata' };
    // Cade anche la riscrittura: restano solo le frasi che il revisore ha passato (mai una frase che non ha letto), poi la frase onesta.
    const frasi = frasiDi(ripulisciRacconto(e.testo));
    const passate = (e.verifica || []).filter((v) => v.nelleFonti).map((v) => frasi[v.n - 1]).filter(Boolean)
        .filter((fr) => !/non ho una fonte/i.test(fr));
    if (passate.length) return { ...base, testo: `${passate.join(' ')} ${RISPOSTA_ONESTA_RESTO}`, esito: 'ridotta' };
    return { ...base, testo: RISPOSTA_ONESTA, esito: 'onesta' };
}

