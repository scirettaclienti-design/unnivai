/**
 * RACCONTO DI TAPPA — il racconto da insider (2–4 frasi) di un posto, scritto da Claude (narratore) SOLO con le fonti verificate:
 * il testo di Wikipedia della tappa e la descrizione Google del posto. Modulo puro (nessuna rete, nessun Deno): lo usano il proxy
 * (`dv.purpose = 'racconto'`), i test e la prova con le tappe vere.
 *
 * Il modello scrive; poi un CONTROLLO AUTOMATICO verifica che ogni data, numero, nome proprio e parola-fatto del racconto compaia nelle
 * fonti. Se no il racconto è scartato e la tappa resta con la frase breve di oggi. Tutti i testi (prompt, parole vietate) stanno qui.
 */

export const LIMITI = Object.freeze({ frasiMin: 2, frasiMax: 4, carMax: 600, wikipediaMax: 1500, googleMax: 500, fonteMin: 200 });
export const RISPOSTA_NIENTE = 'NIENTE';
/** Versione del prompt e del controllo: se cambia, i racconti in cache si riscrivono. */
export const VERSIONE_RACCONTO = 'r4'; // r4: ogni frase su un fatto delle fonti (niente frasi di colore) + una sola riscrittura dopo il «no» del revisore
/**
 * Le versioni precedenti che valgono ancora: r4 cambia come si scrive, non i controlli. Un racconto r3 PASSATO ha superato gli stessi due
 * controlli di oggi e resta valido (fino al suo TTL); si riscrive con r4 solo uno scartato. Un «senza fonti» r3 non dipende dal prompt e vale anch'esso.
 */
export const VERSIONI_ANCORA_VALIDE = Object.freeze(['r3']);
export const versioneValida = (riga: { versione?: string | null; esito?: string | null } | null | undefined): boolean =>
    !!riga && (riga.versione === VERSIONE_RACCONTO || (VERSIONI_ANCORA_VALIDE.includes(String(riga.versione)) && riga.esito !== 'scartato'));
export const MODELLO_REVISORE = 'claude-haiku-4-5';
export const TTL_RACCONTO_GIORNI = 30; // come place_facts: il testo di Google non si tiene oltre
export const TTL_SCARTATO_GIORNI = 7; // un racconto scartato non si riprova a ogni giro (costa), ma dopo una settimana sì

export const SYSTEM_RACCONTO = [
    'Sei la voce di Unnivai: un amico del posto che cammina con te e ti mostra una tappa.',
    'Scrivi il racconto di UNA tappa: da 2 a 4 frasi brevi, in italiano, in seconda persona singolare («tu»), dette ad alta voce a chi sta arrivando.',
    '',
    'COME SI SCRIVE:',
    '- Ogni frase poggia su un fatto scritto nelle FONTI. Prima scegli i fatti, poi scrivi: una frase, un fatto.',
    '- La voce da insider nasce da tre cose sole: QUALE fatto scegli (il più concreto, quello che si vede o si può fare lì), in che ORDINE li metti, e frasi BREVI. Non nasce da frasi di colore.',
    '- Frase di colore = una frase, o un pezzo di frase, che le fonti non dicono: un\'immagine, un paragone, un sentimento, un giudizio, una spiegazione, un perché, una conseguenza, una conclusione, una cosa che fa una cosa («è il cuore della città», «la fontana tiene d\'occhio la piazza», «qui la storia si sente», «è il posto dove si svolgeva lo spettacolo»). Non scriverne nessuna.',
    '- Meglio 2 frasi vere che 4 con un abbellimento. Quando i fatti concreti sono finiti, fermati.',
    '',
    'REGOLE (valgono tutte, senza eccezioni):',
    '1. Usa SOLO fatti presenti nelle FONTI qui sotto. Ogni data, numero, nome proprio e fatto deve stare nelle fonti. Niente di tuo, niente «si dice», niente da memoria.',
    '   Anche ciò che sai vero NON si dice se non è scritto nelle fonti: niente titoli o qualifiche aggiunti (principe, duca, famoso), niente spiegazioni, niente colori, aspetto o rumori che le fonti non dicono. Meglio un racconto corto e fedele che uno ricco e inventato.',
    '2. Dì i fatti con le parole delle fonti, o con parole che dicono esattamente la stessa cosa: non allargare («la statua» non diventa «tutta la fontana»), non spiegare a cosa serve una cosa, non dire perché è stata fatta se le fonti non lo dicono, non dare vita alle cose (una fontana non guarda, una piazza non respira).',
    '3. Numeri solo se sono nelle fonti: non contare tu («tre stili», «due palazzi») se le fonti non scrivono quel numero.',
    '4. Come parla un insider: puoi aprire una frase con «Guarda…», «Qui…», «Fermati…», ma poi la frase dice un fatto delle fonti. Una sola cosa per frase, mai un elenco di date.',
    '5. Mai «Benvenuti», mai il tono da guida turistica o da brochure, mai superlativi o aggettivi vuoti (imperdibile, meraviglioso, spettacolare, unico, splendido, incantevole).',
    '6. Mai «vi», mai «voi»: parli a una persona sola. Niente emoji, niente virgolette decorative, niente titoli, niente elenchi.',
    '7. Mai indicazioni di direzione o di posizione rispetto a chi ascolta: niente «a sinistra», «a destra», «davanti a te», «dietro di te», «alle tue spalle», «di fronte a te», «girati», «dall\'altra parte». L\'app non sa da che lato arrivi.',
    '   Non ripetere il nome del luogo più di una volta. Non dire che sei un\'intelligenza artificiale e non nominare le fonti.',
    `8. Se le fonti non bastano per almeno due frasi vere e concrete, rispondi esattamente: ${RISPOSTA_NIENTE}`,
    '',
    'Rispondi solo con il testo del racconto (o con la parola indicata sopra), niente altro.',
].join('\n');

export type FontiRacconto = {
    nome: string;
    citta?: string | null;
    wikipedia?: { titolo?: string | null; testo?: string | null } | null;
    google?: { testo?: string | null } | null;
};

const pulisci = (s: unknown, max: number): string => {
    const t = String(s ?? '').replace(/\s+/g, ' ').trim();
    if (t.length <= max) return t;
    const taglio = t.slice(0, max);
    const fine = Math.max(taglio.lastIndexOf('. '), taglio.lastIndexOf('! '), taglio.lastIndexOf('? '));
    return fine > max * 0.5 ? taglio.slice(0, fine + 1) : taglio;
};

/** Le fonti come le vede il modello (e il controllo): testi puliti e tagliati a frase intera. */
export function fontiPulite(f: FontiRacconto): { nome: string; citta: string; wikipedia: string; google: string } {
    return {
        nome: pulisci(f.nome, 120),
        citta: pulisci(f.citta, 80),
        wikipedia: pulisci(f.wikipedia?.testo, LIMITI.wikipediaMax),
        google: pulisci(f.google?.testo, LIMITI.googleMax),
    };
}

/** Il racconto ha qualcosa da cui partire? Una riga di Google da sola (≈ 80 caratteri) non basta: senza fonti vere non si scrive niente e resta «Perché sei qui adesso». */
export function haFonti(f: FontiRacconto): boolean {
    const p = fontiPulite(f);
    return p.wikipedia.length + p.google.length >= LIMITI.fonteMin;
}

export function messaggiRacconto(f: FontiRacconto): Array<{ role: 'system' | 'user'; content: string }> {
    const p = fontiPulite(f);
    const blocchi = [`TAPPA: ${p.nome}${p.citta ? ` (${p.citta})` : ''}`, ''];
    blocchi.push(p.wikipedia ? `FONTE 1 — Wikipedia:\n«${p.wikipedia}»` : 'FONTE 1 — Wikipedia: nessun testo.');
    blocchi.push('');
    blocchi.push(p.google ? `FONTE 2 — Descrizione Google del posto:\n«${p.google}»` : 'FONTE 2 — Descrizione Google del posto: nessuna.');
    blocchi.push('', 'Scrivi il racconto.');
    return [{ role: 'system', content: SYSTEM_RACCONTO }, { role: 'user', content: blocchi.join('\n') }];
}

/** Impronta delle fonti (con la versione): se cambiano, il racconto in cache non vale più. */
export async function impronta(f: FontiRacconto): Promise<string> {
    const p = fontiPulite(f);
    const dati = new TextEncoder().encode(`${VERSIONE_RACCONTO}\n${p.nome}\n${p.citta}\n${p.wikipedia}\n${p.google}`);
    const h = await crypto.subtle.digest('SHA-256', dati);
    return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

// ─── il controllo ────────────────────────────────────────────────────────────────────────────────────────────────────
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’`´]/g, "'");
const PAROLE = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu;

const NUMERI_PAROLA: Record<string, number> = {
    due: 2, tre: 3, quattro: 4, cinque: 5, sei: 6, sette: 7, otto: 8, nove: 9, dieci: 10, undici: 11, dodici: 12, tredici: 13, quattordici: 14,
    quindici: 15, sedici: 16, diciassette: 17, diciotto: 18, diciannove: 19, venti: 20, trenta: 30, quaranta: 40, cinquanta: 50, sessanta: 60,
    settanta: 70, ottanta: 80, novanta: 90, cento: 100, duecento: 200, trecento: 300, quattrocento: 400, cinquecento: 500, seicento: 600,
    settecento: 700, ottocento: 800, novecento: 900, mille: 1000, duemila: 2000, milione: 1000000, milioni: 1000000, centinaia: 100, migliaia: 1000,
    decine: 10, doppio: 2, triplo: 3,
};
// «sei» (anche voce del verbo essere: «Sei nella piazza») e «metà» non si contano come numeri: troppi falsi allarmi
const NON_NUMERI = new Set(['sei', 'meta']);
// I secoli detti all'italiana valgono la cifra romana delle fonti: «nel Duecento» = «XIII secolo»
const SECOLI: Record<string, string> = {
    duecento: 'xiii', trecento: 'xiv', quattrocento: 'xv', cinquecento: 'xvi', seicento: 'xvii', settecento: 'xviii', ottocento: 'xix', novecento: 'xx',
};
const SANTI = new Set(['san', 'santa', 'santo', 'sant', 'ss', 'beato']);

const VIETATE: Array<[RegExp, string]> = [
    [/benvenut/i, 'dice «benvenuti»'],
    [/\b(imperdibil\w*|meraviglios\w*|spettacolar\w*|incantevol\w*|splendid\w*|straordinari\w*|favolos\w*|magnific\w*|stupend\w*|affascinant\w*|suggestiv\w*|unico nel suo genere|da non perdere|gioiello|must[- ]see)\b/i, 'aggettivo vuoto o tono da brochure'],
    [/\b\w{4,}issim[oaie]\b/i, 'superlativo'],
    [/\b(ammirar\w+|scoprirete|scoprirai|vi invito|vi consiglio|vi invitiamo|visitatori)\b/i, 'tono da guida turistica'],
    [/\b(vi|voi)\b/i, 'parla a più persone'],
    [/(?<![\p{L}])(sinistr[aeio]|destr[aeio]|davanti|dietro|spalle|di fronte a te|di fronte a ti|girati|voltati|volgi lo sguardo|dall'altra parte|dall'altro lato)(?![\p{L}])/iu, 'indicazione di direzione'],
    [/\p{Extended_Pictographic}/u, 'emoji'],
    [/https?:|www\./i, 'indirizzo web'],
    [/\b(intelligenza artificiale|wikipedia|google)\b/i, 'nomina le fonti o l\'AI'],
];

// Le parole della voce da insider (imperativi, avverbi di luogo, connettivi): non sono fatti, non si cercano nelle fonti.
const PAROLE_DI_VOCE = new Set((
    'guarda guardala guardalo fermati fermiamoci cerca cercala alza alzalo entra entrarci sali scendi voltati girati siediti resta restaci prova provaci ' +
    'nota notala immagina pensa ricorda lascia lasciati avvicinati allontanati aspetta aspettati concediti ' +
    'davanti dietro accanto intorno attorno dentro fuori sopra sotto vicino lontano adesso ancora sempre quando mentre quindi perche anche allora ' +
    'proprio soltanto appena subito tutto tutti tutta tutte nessuno nessuna ognuno ognuna qualcosa momento attimo istante ' +
    'cammini cammina camminare passo passi'
).split(/\s+/).filter(Boolean).map((w) => w.slice(0, 5)));
const frasiDi = (t: string): string[] => t.split(/(?<=[.!?…])\s+/).map((x) => x.trim()).filter(Boolean);
const maiuscola = (w: string) => /^\p{Lu}/u.test(w);

export type EsitoControllo = {
    ok: boolean;
    motivi: string[];
    /** Cosa non compare nelle fonti, diviso per tipo (vuoto se passa). */
    fuoriFonti: { numeri: string[]; nomi: string[]; parole: string[]; romani: string[] };
    stats: { frasi: number; caratteri: number; parolePiene: number; estranee: number };
};

/**
 * Ogni data, numero, nome proprio e fatto del racconto deve comparire nelle fonti (o nel nome della tappa e della città).
 *  · numeri: cifre, numeri scritti in lettere («dodici», «settecento») e cifre romane (XVIII);
 *  · nomi propri: ogni parola con la maiuscola che non sta a inizio frase (a inizio frase se è seguita da un'altra maiuscola);
 *  · fatti: le parole piene (7 lettere o più) devono avere la radice (5 lettere) nelle fonti; oltre una quota di estranee il racconto cade.
 * Più le regole di voce (niente «benvenuti», superlativi, tono da brochure) e la lunghezza (2–4 frasi, al massimo 600 caratteri).
 */
export function controllaRacconto(testo: unknown, fonti: FontiRacconto, { sogliaEstranee = 0.34, minEstranee = 3 } = {}): EsitoControllo {
    const t = String(testo ?? '').replace(/\s+/g, ' ').trim();
    const motivi: string[] = [];
    const fuori = { numeri: [] as string[], nomi: [] as string[], parole: [] as string[], romani: [] as string[] };
    const p = fontiPulite(fonti);
    const corpoFonti = norm(`${p.wikipedia} ${p.google}`);
    const corpoNomi = norm(`${p.nome} ${p.citta}`);
    const tutto = `${corpoFonti} ${corpoNomi}`;
    const paroleFonti = new Set((tutto.match(/[\p{L}\p{N}]+/gu) || []));
    const radiciFonti = new Set([...paroleFonti].map((w) => w.slice(0, 5)));
    const cifreFonti = new Set((tutto.replace(/(\d)[.,](\d{3})(?!\d)/g, '$1$2').match(/\d+/g) || []));
    const haParola = (w: string) => paroleFonti.has(w) || [...paroleFonti].some((x) => x.length >= 4 && w.length >= 4 && (x.startsWith(w.slice(0, Math.max(4, w.length - 2))) || w.startsWith(x.slice(0, Math.max(4, x.length - 2)))));

    if (!t) return { ok: false, motivi: ['vuoto'], fuoriFonti: fuori, stats: { frasi: 0, caratteri: 0, parolePiene: 0, estranee: 0 } };
    if (t.toUpperCase().replace(/[^A-Z]/g, '') === RISPOSTA_NIENTE) return { ok: false, motivi: ['il modello dice che le fonti non bastano'], fuoriFonti: fuori, stats: { frasi: 0, caratteri: t.length, parolePiene: 0, estranee: 0 } };

    // forma
    const frasi = frasiDi(t);
    if (frasi.length < LIMITI.frasiMin) motivi.push(`meno di ${LIMITI.frasiMin} frasi`);
    if (frasi.length > LIMITI.frasiMax) motivi.push(`più di ${LIMITI.frasiMax} frasi`);
    if (t.length > LIMITI.carMax) motivi.push(`più di ${LIMITI.carMax} caratteri`);
    for (const [re, perche] of VIETATE) if (re.test(t)) motivi.push(perche);

    // numeri, cifre romane, nomi propri
    const nomiVisti = new Set<string>();
    frasi.forEach((fr) => {
        const parole = fr.match(PAROLE) || [];
        parole.forEach((w, i) => {
            if (/^\d+$/.test(w)) {
                if (!cifreFonti.has(w.replace(/^0+/, '') || '0') && !cifreFonti.has(w) && !fuori.numeri.includes(w)) fuori.numeri.push(w);
                return;
            }
            if (/^[IVXLCDM]{2,}$/.test(w)) {
                if (!paroleFonti.has(w.toLowerCase()) && !fuori.romani.includes(w)) fuori.romani.push(w);
                return;
            }
            const n = norm(w);
            if (n in SECOLI) {
                if (!paroleFonti.has(n) && !paroleFonti.has(SECOLI[n]) && !fuori.numeri.includes(w)) fuori.numeri.push(w);
                return;
            }
            if (n in NUMERI_PAROLA && !NON_NUMERI.has(n)) {
                const valore = NUMERI_PAROLA[n];
                // «sei» e «meta» sono anche altro: si controlla solo se il numero è scritto con la minuscola dopo un nome o un articolo? Meglio severo: serve la parola o la cifra nelle fonti
                if (!paroleFonti.has(n) && !cifreFonti.has(String(valore)) && !fuori.numeri.includes(w)) fuori.numeri.push(w);
                return;
            }
            const prossima = parole[i + 1];
            const propria = maiuscola(w) && (i > 0 || (prossima && maiuscola(prossima)));
            if (!propria) return;
            for (const pezzo of norm(w).split("'")) {
                if (pezzo.length < 3 || nomiVisti.has(pezzo) || SANTI.has(pezzo)) continue;
                nomiVisti.add(pezzo);
                if (!haParola(pezzo) && !fuori.nomi.includes(w)) fuori.nomi.push(w);
            }
        });
    });
    if (fuori.numeri.length) motivi.push(`numeri non nelle fonti: ${fuori.numeri.join(', ')}`);
    if (fuori.romani.length) motivi.push(`cifre romane non nelle fonti: ${fuori.romani.join(', ')}`);
    if (fuori.nomi.length) motivi.push(`nomi non nelle fonti: ${fuori.nomi.join(', ')}`);

    // parole-fatto
    const piene = (norm(t).match(/[\p{L}]+/gu) || []).filter((w) => w.length >= 7);
    // un secolo detto all'italiana («Ottocento») non è fuori dalle fonti se le fonti hanno la sua cifra romana (XIX)
    const secoloNelleFonti = (w: string) => w in SECOLI && paroleFonti.has(SECOLI[w]);
    const estranee = piene.filter((w) => !radiciFonti.has(w.slice(0, 5)) && !PAROLE_DI_VOCE.has(w.slice(0, 5)) && !secoloNelleFonti(w));
    const quota = piene.length ? estranee.length / piene.length : 0;
    if (estranee.length >= minEstranee && quota > sogliaEstranee) {
        for (const w of estranee) if (!fuori.parole.includes(w)) fuori.parole.push(w);
        motivi.push(`troppe parole fuori dalle fonti (${estranee.length} su ${piene.length}): ${fuori.parole.slice(0, 6).join(', ')}`);
    }

    return { ok: motivi.length === 0, motivi, fuoriFonti: fuori, stats: { frasi: frasi.length, caratteri: t.length, parolePiene: piene.length, estranee: estranee.length } };
}

/** Il testo del modello pronto per il controllo: via virgolette di contorno e markdown, spazi in ordine. */
export function ripulisciRacconto(grezzo: unknown): string {
    return String(grezzo ?? '')
        .replace(/^```[a-z]*\n?|```$/gim, '')
        .replace(/^[«"“”'\s]+|[»"“”'\s]+$/g, '')
        .replace(/[*_#>`]/g, '')
        .replace(/\s*\n+\s*/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}


// ─── il secondo controllo: frase per frase, con un altro modello ─────────────────────────────────────────────────────
export const SYSTEM_VERIFICA = [
    'Sei un revisore severo. Ricevi delle FONTI e un RACCONTO diviso in frasi numerate.',
    'Per OGNI frase decidi se tutto ciò che afferma è scritto nelle FONTI (anche con altre parole): fatti, date, numeri, nomi, titoli, qualità, colori, aspetto, rumori, luoghi, relazioni tra le cose.',
    'Rispondi «sì» solo se la frase non aggiunge niente che le fonti non dicano. Basta un dettaglio in più (un titolo, un colore, una qualifica, un luogo, un\'immagine inventata, una conclusione non scritta) per rispondere «no».',
    'Non conta se il dettaglio è vero nella realtà: conta solo se è scritto nelle FONTI. Le frasi di voce («Guarda…», «Fermati…») senza fatti nuovi sono «sì».',
    '',
    'Rispondi SOLO con un oggetto JSON, nessun altro testo:',
    '{"frasi":[{"n":1,"nelle_fonti":true,"motivo":""},{"n":2,"nelle_fonti":false,"motivo":"cosa non c\'è nelle fonti"}]}',
    'Una voce per ogni frase, nello stesso ordine; «motivo» vuoto se nelle_fonti è true.',
].join('\n');

export function messaggiVerifica(testo: string, f: FontiRacconto): Array<{ role: 'system' | 'user'; content: string }> {
    const p = fontiPulite(f);
    const frasi = frasiDi(testo);
    const blocchi = [`TAPPA: ${p.nome}${p.citta ? ` (${p.citta})` : ''}`, ''];
    blocchi.push(p.wikipedia ? `FONTE 1 — Wikipedia:\n«${p.wikipedia}»` : 'FONTE 1 — Wikipedia: nessun testo.');
    blocchi.push('', p.google ? `FONTE 2 — Descrizione Google del posto:\n«${p.google}»` : 'FONTE 2 — Descrizione Google del posto: nessuna.');
    blocchi.push('', 'RACCONTO:', ...frasi.map((fr, i) => `${i + 1}. ${fr}`), '', 'Rispondi con il JSON.');
    return [{ role: 'system', content: SYSTEM_VERIFICA }, { role: 'user', content: blocchi.join('\n') }];
}

export type EsitoVerifica = { ok: boolean; motivi: string[]; frasi: Array<{ n: number; nelleFonti: boolean; motivo: string }> };

/**
 * La risposta del revisore → esito. Passa SOLO se ogni frase del racconto ha la sua voce con nelle_fonti === true.
 * Una risposta che non si legge, o che salta una frase, vale «no»: nel dubbio il racconto non esce.
 */
export function leggiVerifica(risposta: unknown, testo: string): EsitoVerifica {
    const frasi = frasiDi(testo);
    const grezzo = String(risposta ?? '');
    const m = grezzo.match(/\{[\s\S]*\}/);
    let j: any = null;
    try { j = m ? JSON.parse(m[0]) : null; } catch { j = null; }
    const voci: any[] = Array.isArray(j?.frasi) ? j.frasi : [];
    if (!voci.length) return { ok: false, motivi: ['verifica: risposta del revisore non leggibile'], frasi: [] };
    const out: EsitoVerifica['frasi'] = [];
    const motivi: string[] = [];
    frasi.forEach((fr, i) => {
        const v = voci.find((x) => Number(x?.n) === i + 1);
        const si = v?.nelle_fonti === true;
        const motivo = String(v?.motivo ?? '').replace(/\s+/g, ' ').trim().slice(0, 140);
        out.push({ n: i + 1, nelleFonti: si, motivo });
        if (!v) motivi.push(`verifica: frase ${i + 1} senza risposta`);
        else if (!si) motivi.push(`verifica: frase ${i + 1} non è nelle fonti${motivo ? ` (${motivo})` : ''}`);
    });
    return { ok: motivi.length === 0 && out.length > 0, motivi, frasi: out };
}


// ─── una sola riscrittura: il modello riceve le frasi «no» del revisore, riscrive una volta, si riverifica ─────────────
/**
 * La richiesta di riscrittura: la stessa conversazione della prima stesura (fonti, racconto scritto) più le frasi che il revisore ha
 * segnato «no», ognuna con il suo motivo. Il modello toglie o corregge quelle frasi e non aggiunge niente che le fonti non dicano.
 */
export function messaggiRiscrittura(f: FontiRacconto, testo: string, no: Array<{ n: number; motivo: string }>): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
    const frasi = frasiDi(testo);
    const righe = no.map(({ n, motivo }) => `- frase ${n}: «${frasi[n - 1] ?? ''}»${motivo ? ` — ${motivo}` : ''}`);
    return [
        ...messaggiRacconto(f),
        { role: 'assistant', content: testo },
        {
            role: 'user', content: [
                'Un revisore ha confrontato ogni frase con le FONTI. Queste frasi dicono qualcosa che le fonti non dicono:',
                ...righe,
                '',
                'Riscrivi il racconto una volta: togli quelle frasi, oppure riscrivile dicendo solo ciò che le fonti dicono. Le altre frasi tienile come sono.',
                'Non aggiungere niente che non sia nelle fonti. Valgono tutte le regole di prima (da 2 a 4 frasi, nessuna frase di colore, nessuna direzione).',
                `Se togliendo quelle frasi ne restano meno di due, aggiungi un altro fatto concreto preso dalle fonti; se non ce ne sono, rispondi esattamente: ${RISPOSTA_NIENTE}`,
                'Rispondi solo con il nuovo testo del racconto.',
            ].join('\n'),
        },
    ];
}

type Messaggi = Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
/** Una chiamata al modello: testo grezzo, modello usato, costo. Se non risponde lancia un errore (il proxy non salva niente e si riprova). */
export type ChiamataModello = (messaggi: Messaggi) => Promise<{ testo: string; modello?: string | null; costoUsd?: number }>;

export type EsitoRacconto = {
    ok: boolean;
    testo: string;
    motivi: string[];
    /** Le risposte del revisore frase per frase sull'ultimo testo controllato (null se il controllo automatico l'ha fermato prima). */
    verifica: EsitoVerifica['frasi'] | null;
    modello: string | null;
    modelloVerifica: string | null;
    costoUsd: number;
    riscritto: boolean;
    /** La prima stesura, se è stata riscritta: testo e motivi del revisore. */
    prima: { testo: string; motivi: string[] } | null;
};

/**
 * Scrive e controlla il racconto, con UNA sola riscrittura:
 *  1. il narratore scrive; 2. controllo automatico (se cade: scartato, nessuna riscrittura); 3. il revisore legge frase per frase;
 *  4. se il revisore segna delle frasi «no», il narratore le riceve con il motivo e riscrive una volta; 5. il nuovo testo ripassa da
 *  ENTRAMBI i controlli; se cade ancora, il racconto è scartato e la tappa resta con la frase breve di oggi.
 * Una risposta del revisore che non si legge non ha frasi «no» da correggere: scartato senza riscrittura.
 */
export async function scriviERivedi(f: FontiRacconto, scrivi: ChiamataModello, rivedi: ChiamataModello): Promise<EsitoRacconto> {
    let costoUsd = 0;
    let modello: string | null = null;
    let modelloVerifica: string | null = null;
    const controlla = async (testo: string) => {
        const controllo = controllaRacconto(testo, f);
        if (!controllo.ok) return { ok: false, motivi: controllo.motivi, verifica: null as EsitoVerifica | null };
        const v = await rivedi(messaggiVerifica(testo, f));
        costoUsd += v.costoUsd || 0;
        modelloVerifica = v.modello ?? modelloVerifica;
        const verifica = leggiVerifica(v.testo, testo);
        return { ok: verifica.ok, motivi: verifica.motivi, verifica };
    };
    const w1 = await scrivi(messaggiRacconto(f));
    costoUsd += w1.costoUsd || 0;
    modello = w1.modello ?? null;
    const t1 = ripulisciRacconto(w1.testo);
    const c1 = await controlla(t1);
    const fine = (ok: boolean, testo: string, c: typeof c1, riscritto: boolean, prima: EsitoRacconto['prima']): EsitoRacconto => ({
        ok, testo, motivi: c.motivi, verifica: c.verifica?.frasi ?? null, modello, modelloVerifica, costoUsd: +costoUsd.toFixed(6), riscritto, prima,
    });
    if (c1.ok) return fine(true, t1, c1, false, null);
    const no = (c1.verifica?.frasi ?? []).filter((x) => !x.nelleFonti).map(({ n, motivo }) => ({ n, motivo }));
    if (!no.length) return fine(false, t1, c1, false, null);

    const w2 = await scrivi(messaggiRiscrittura(f, t1, no));
    costoUsd += w2.costoUsd || 0;
    modello = w2.modello ?? modello;
    const t2 = ripulisciRacconto(w2.testo);
    const c2 = await controlla(t2);
    return fine(c2.ok, t2, c2, true, { testo: t1, motivi: c1.motivi });
}
