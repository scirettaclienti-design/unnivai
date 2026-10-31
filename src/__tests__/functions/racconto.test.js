// RACCONTO DI TAPPA — il controllo automatico, le fonti, il prompt. 0 $, nessuna rete.
import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import {
    controllaRacconto, messaggiRacconto, haFonti, ripulisciRacconto, impronta, fontiPulite, LIMITI, RISPOSTA_NIENTE, SYSTEM_RACCONTO, VERSIONE_RACCONTO,
    messaggiVerifica, leggiVerifica, SYSTEM_VERIFICA, MODELLO_REVISORE, versioneValida, messaggiRiscrittura, scriviERivedi,
    messaggiRiscritturaControllo, numeroInLettere, unisciNumeri,
} from '../../../supabase/functions/openai-proxy/racconto.ts';
import { trovaWikipedia, cercaWikipedia, descrizioneGoogleDa, RAGGIO_MAX_M } from '../../../supabase/functions/openai-proxy/raccontoFonti.ts';

const ELEFANTE = {
    nome: "Fontana dell'Elefante (uʻ Liotru)", citta: 'Catania',
    wikipedia: { titolo: "Fontana dell'Elefante", testo: "La fontana dell'Elefante (in siciliano u Liotru) è un'opera monumentale, realizzata tra il 1735 e il 1737 dall'architetto Giovanni Battista Vaccarini, collocata al centro di piazza del Duomo a Catania. Il suo elemento principale è una statua di basalto nero che raffigura un elefante, detto popolarmente U’Liotru, il quale è considerato l'emblema della città siciliana." },
    google: { testo: 'Fontana con una statua romana di un elefante scolpito nel basalto, ora simbolo della città.' },
};
const BUONO = "Guarda l'elefante nero al centro della piazza: è scolpito nel basalto, e qui lo chiamano U Liotru. Per i catanesi è il simbolo della città, quello che trovi ovunque. È un'opera romana, ma la fontana che la regge l'ha disegnata Vaccarini, tra il 1735 e il 1737.";

describe('controllo: un racconto fedele alle fonti passa', () => {
    it('il racconto di prova della Fontana dell\'Elefante passa', () => {
        const c = controllaRacconto(BUONO, ELEFANTE);
        expect(c.motivi).toEqual([]);
        expect(c.ok).toBe(true);
        expect(c.stats.frasi).toBe(3);
    });
    it('«Sei nella piazza…» non è il numero sei; «nel Duecento» vale «XIII secolo»; «San» non è un nome da cercare', () => {
        const castello = { nome: 'Castello Ursino', citta: 'Catania', wikipedia: { titolo: 'Castello Ursino', testo: 'Il castello Ursino di Catania fu costruito dal re Federico II di Svevia nel XIII secolo. Il maniero fu sede del parlamento siciliano e oggi è sede del Museo Civico, formato dalle collezioni della famiglia Biscari. ' + 'x'.repeat(0) }, google: null };
        expect(controllaRacconto('Sei nel maniero: lo fece costruire Federico II di Svevia nel Duecento. Oggi dentro c\'è il Museo Civico, con le collezioni della famiglia Biscari.', castello).motivi).toEqual([]);
        const teatro = { nome: 'Teatro', citta: 'Catania', wikipedia: { titolo: 'Teatro', testo: 'Il teatro è situato tra piazza S. Francesco e via Timeo, risale al II secolo.' }, google: null };
        expect(controllaRacconto('Fermati qui: il teatro sta tra piazza San Francesco e via Timeo. Risale al II secolo.', teatro).motivi).toEqual([]);
    });
});

describe('controllo: ogni data, numero, nome e fatto deve stare nelle fonti', () => {
    it('una data sbagliata si scarta', () => {
        const c = controllaRacconto(BUONO.replace('1735', '1745'), ELEFANTE);
        expect(c.ok).toBe(false);
        expect(c.fuoriFonti.numeri).toContain('1745');
    });
    it('un nome proprio inventato si scarta', () => {
        const c = controllaRacconto(BUONO.replace('Vaccarini', 'Bernini'), ELEFANTE);
        expect(c.ok).toBe(false);
        expect(c.fuoriFonti.nomi).toContain('Bernini');
    });
    it('un numero scritto in lettere che le fonti non hanno si scarta', () => {
        const c = controllaRacconto("Guarda l'elefante nero: è scolpito nel basalto. La fontana è di Vaccarini e ha sette secoli di storia.", ELEFANTE);
        expect(c.ok).toBe(false);
        expect(c.fuoriFonti.numeri).toContain('sette');
    });
    it('una cifra romana inventata si scarta, una presente nelle fonti passa', () => {
        const f = { nome: 'Duomo', citta: 'Catania', wikipedia: { titolo: 'Duomo', testo: 'La cattedrale fu ricostruita nel XVIII secolo dopo il terremoto del 1693 e guarda la piazza.' }, google: null };
        expect(controllaRacconto('Guarda la cattedrale: è del XVIII secolo. La ricostruirono dopo il terremoto del 1693.', f).motivi).toEqual([]);
        expect(controllaRacconto('Guarda la cattedrale: è del XII secolo. La ricostruirono dopo il terremoto del 1693.', f).fuoriFonti.romani).toContain('XII');
    });
    it('un fatto che non c\'è (troppe parole fuori dalle fonti) si scarta', () => {
        const c = controllaRacconto("Guarda l'elefante: nella notte i pescatori lo accarezzavano portando fortuna ai naviganti. Si racconta che sotto la statua riposino antichi tesori nascosti dai monaci benedettini.", ELEFANTE);
        expect(c.ok).toBe(false);
        expect(c.motivi.join(' ')).toMatch(/parole fuori dalle fonti/);
    });
});

describe('controllo: voce e forma', () => {
    const ok = (t) => controllaRacconto(t, ELEFANTE);
    it('«Benvenuti», superlativi, tono da brochure e «voi» si scartano', () => {
        expect(ok("Benvenuti alla fontana. Guarda l'elefante di basalto, il simbolo della città.").motivi.join()).toMatch(/benvenuti/);
        expect(ok("Guarda l'elefante di basalto: è un simbolo meraviglioso della città. È del 1735.").motivi.join()).toMatch(/aggettivo vuoto/);
        expect(ok("Guarda l'elefante di basalto, il simbolo più bellissimo della città. È del 1735.").motivi.join()).toMatch(/superlativo/);
        expect(ok("Potete ammirare l'elefante di basalto, simbolo della città. Vi invito a guardarlo.").motivi.length).toBeGreaterThan(0);
    });
    it('meno di 2 o più di 4 frasi, o troppo lungo, si scarta', () => {
        expect(ok("Guarda l'elefante di basalto, simbolo della città.").motivi.join()).toMatch(/meno di 2 frasi/);
        expect(ok("Guarda l'elefante. È di basalto. È il simbolo della città. È del 1735. È di Vaccarini.").motivi.join()).toMatch(/più di 4 frasi/);
    });
    it('un secolo detto all\'italiana vale la cifra romana delle fonti anche tra le parole-fatto', () => {
        const f = { nome: 'Teatro', citta: 'Catania', wikipedia: { titolo: 'Teatro', testo: 'Il teatro è stato messo in luce a partire dalla fine del XIX secolo, tra piazza S. Francesco e via Timeo, nel centro storico della città.' }, google: null };
        expect(controllaRacconto('Questo teatro è tornato alla luce dalla fine dell\'Ottocento. Sta nel centro storico, tra piazza Francesco e via Timeo.', f).motivi.join()).not.toMatch(/ottocento/);
    });
    it('NIENTE (le fonti non bastano) e il vuoto si scartano senza essere un errore', () => {
        expect(ok(RISPOSTA_NIENTE).ok).toBe(false);
        expect(ok(RISPOSTA_NIENTE).motivi[0]).toMatch(/fonti non bastano/);
        expect(ok('').motivi).toEqual(['vuoto']);
    });
    it('emoji e indirizzi web si scartano', () => {
        expect(ok("Guarda l'elefante 🐘 di basalto. È del 1735, simbolo della città.").motivi.join()).toMatch(/emoji/);
        expect(ok("Guarda l'elefante di basalto, simbolo della città. Leggi su https://it.wikipedia.org tutto.").motivi.join()).toMatch(/indirizzo web|fonti/);
    });
});

describe('fonti e prompt', () => {
    it('senza fonti vere non si scrive: una riga di Google da sola non basta', () => {
        expect(haFonti({ nome: 'X', citta: 'Y', wikipedia: null, google: { testo: 'Rovine di un anfiteatro del II secolo d.C. con gradinata e orchestra.' } })).toBe(false);
        expect(haFonti({ nome: 'X', citta: 'Y', wikipedia: null, google: null })).toBe(false);
        expect(haFonti(ELEFANTE)).toBe(true);
        expect(LIMITI.fonteMin).toBeGreaterThanOrEqual(150);
    });
    it('il prompt porta le fonti, la voce e la regola «solo fatti delle fonti»', () => {
        const m = messaggiRacconto(ELEFANTE);
        expect(m[0].role).toBe('system'); expect(m[0].content).toBe(SYSTEM_RACCONTO);
        expect(SYSTEM_RACCONTO).toMatch(/SOLO fatti presenti nelle FONTI/);
        expect(SYSTEM_RACCONTO).toMatch(/Benvenuti/);
        expect(SYSTEM_RACCONTO).toMatch(/NIENTE/);
        expect(m[1].content).toContain("Fontana dell'Elefante (uʻ Liotru) (Catania)");
        expect(m[1].content).toContain('Vaccarini');
        expect(m[1].content).toContain('statua romana');
    });
    it('le fonti si tagliano a frase intera e non superano i limiti', () => {
        const lunga = { nome: 'A', citta: 'B', wikipedia: { testo: `${'Una frase completa. '.repeat(200)}` }, google: { testo: 'g'.repeat(900) } };
        const p = fontiPulite(lunga);
        expect(p.wikipedia.length).toBeLessThanOrEqual(LIMITI.wikipediaMax);
        expect(p.wikipedia.endsWith('.')).toBe(true);
        expect(p.google.length).toBeLessThanOrEqual(LIMITI.googleMax);
    });
    it('l\'impronta cambia se cambia una fonte e include la versione', async () => {
        const a = await impronta(ELEFANTE);
        expect(a).toHaveLength(32);
        expect(await impronta(ELEFANTE)).toBe(a);
        expect(await impronta({ ...ELEFANTE, google: { testo: 'altro' } })).not.toBe(a);
        expect(VERSIONE_RACCONTO).toMatch(/^r\d+$/);
    });
    it('ripulisce virgolette, markdown e a capo', () => {
        expect(ripulisciRacconto('«Guarda **qui**.\n\nÈ _bello_.»')).toBe('Guarda qui. È bello.');
    });
});

describe('Wikipedia della tappa (aggancio per nome e coordinate)', () => {
    const pagina = (over = {}) => ({ pageid: 1, title: "Fontana dell'Elefante", index: 1, extract: ELEFANTE.wikipedia.testo, coordinates: [{ lat: 37.50241, lon: 15.08772 }], ...over });
    const fetchCon = (pagine, { occupatoPrima = 0 } = {}) => {
        let n = 0;
        return vi.fn(async () => {
            n += 1;
            if (n <= occupatoPrima) return { ok: false, status: 200, json: async () => ({ error: { code: 'cirrussearch-too-busy-error' } }) };
            return { ok: true, status: 200, json: async () => ({ query: { pages: pagine } }) };
        });
    };
    const tappa = { nome: "Fontana dell'Elefante (uʻ Liotru)", citta: 'Catania', lat: 37.50241, lng: 15.08772 };
    it('aggancia la voce giusta: nome compatibile e dentro il raggio', async () => {
        const w = await trovaWikipedia(tappa, fetchCon([pagina()]));
        expect(w.titolo).toBe("Fontana dell'Elefante");
        expect(w.url).toBe("https://it.wikipedia.org/wiki/Fontana_dell'Elefante".replace("'", '%27').replace('%27', "'")); // encodeURIComponent lascia l'apostrofo
        expect(w.distanzaM).toBeLessThanOrEqual(RAGGIO_MAX_M);
    });
    it('scarta una voce lontana, una disambiguazione, un altro posto e una voce vuota', async () => {
        expect(await trovaWikipedia(tappa, fetchCon([pagina({ coordinates: [{ lat: 38.1, lon: 15.6 }] })]))).toBeNull();
        expect(await trovaWikipedia(tappa, fetchCon([pagina({ pageprops: { disambiguation: '' } })]))).toBeNull();
        expect(await trovaWikipedia(tappa, fetchCon([pagina({ title: 'Teatro Massimo Bellini' })]))).toBeNull();
        expect(await trovaWikipedia(tappa, fetchCon([pagina({ extract: '  ' })]))).toBeNull();
    });
    it('senza coordinate vale solo a nome identico', async () => {
        const senzaCoord = { coordinates: undefined };
        const compatibile = await trovaWikipedia({ ...tappa, nome: 'Elefante di basalto' }, fetchCon([pagina({ ...senzaCoord, title: 'Statua di elefante di basalto' })]));
        expect(compatibile).toBeNull(); // nome compatibile ma non identico e niente coordinate: scartata
        const uguale = await trovaWikipedia(tappa, fetchCon([pagina(senzaCoord)])); // stesso nome una volta tolte le parentesi
        expect(uguale?.titolo).toBe("Fontana dell'Elefante");
    });
    it('riprova quando Wikipedia dice «too busy»', async () => {
        const f = fetchCon([pagina()], { occupatoPrima: 1 });
        const w = await trovaWikipedia(tappa, f);
        expect(w?.titolo).toBe("Fontana dell'Elefante");
        expect(f).toHaveBeenCalledTimes(2);
    });
    it('se Wikipedia non risponde non inventa: null, e lo dice (errore) invece di far credere che non ci sia la voce', async () => {
        const f = vi.fn(async () => { throw new Error('rete'); });
        expect(await trovaWikipedia(tappa, f)).toBeNull();
        expect(await cercaWikipedia(tappa, f)).toEqual({ fonte: null, errore: true });
        expect(await cercaWikipedia(tappa, fetchCon([]))).toEqual({ fonte: null, errore: false }); // risposta vera, nessuna voce
    });
    it('«too busy» tre volte di fila = errore, non «nessuna voce»', async () => {
        const f = fetchCon([pagina()], { occupatoPrima: 5 });
        expect((await cercaWikipedia(tappa, f)).errore).toBe(true);
    });
    it('la descrizione Google si legge da editorial_summary, vuota se manca', () => {
        expect(descrizioneGoogleDa({ result: { editorial_summary: { overview: ' Imponente cattedrale barocca. ' } } })).toBe('Imponente cattedrale barocca.');
        expect(descrizioneGoogleDa({ result: { name: 'Chiesa Madre' }, status: 'OK' })).toBe('');
        expect(descrizioneGoogleDa(null)).toBe('');
    });
});

describe('proxy: il racconto è un percorso suo, fonti e controllo sul server', () => {
    const src = fs.readFileSync('supabase/functions/openai-proxy/index.ts', 'utf8');
    it('dispatch su dv.purpose = racconto, tetto giornaliero, narratore (Sonnet) con ripiego e salvataggio per place_id', () => {
        expect(src).toMatch(/purpose === 'racconto'/);
        expect(src).toMatch(/racconto_consuma/);
        expect(src).toMatch(/chiamaConRipiego\('narratore'/);
        expect(src).toMatch(/primoAnthropic\('narratore'/);
        expect(src).toMatch(/from\('place_racconti'\)/);
        expect(src).toMatch(/scriviERivedi\(fonti, scrivi, rivedi\)/); // scrittura, controllo automatico, revisore e riscrittura: racconto.ts
    });
    it('il client non manda le fonti: il proxy le prende da solo (Wikipedia + places-proxy)', () => {
        expect(src).toMatch(/cercaWikipedia\(\{ nome, citta, lat, lng \}/);
        expect(src).toMatch(/RACCONTO_FONTI/); // Wikipedia che non risponde non diventa un «senza fonti» memorizzato
        expect(src).toMatch(/placesCall\(\{ path: 'place\/details', place_id: placeId, fields: 'editorial_summary' \}\)/);
        expect(src).not.toMatch(/dv\.wikipedia|dv\.fonti|dv\.testo_fonte/);
    });
    it('la migrazione chiude la tabella ad anon e authenticated', () => {
        const sql = fs.readFileSync('supabase/migrations/20261028190000_place_racconti.sql', 'utf8');
        expect(sql).toMatch(/ENABLE ROW LEVEL SECURITY/);
        expect(sql).toMatch(/REVOKE ALL ON public\.place_racconti FROM anon, authenticated/);
        expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.racconto_consuma\(integer\) TO service_role/);
        expect(sql).not.toMatch(/GRANT .* TO (anon|authenticated)/);
    });
});

describe('direzioni: l\'app non sa da che lato arrivi, quindi il racconto non le dice', () => {
    const base = "Guarda l'elefante nero al centro della piazza: è scolpito nel basalto, e qui lo chiamano U Liotru. Per i catanesi è il simbolo della città.";
    it.each([
        'Alla tua sinistra c\'è la fontana.', 'A destra trovi l\'elefante.', 'Davanti a te sta il basalto.', 'Dietro di te c\'è la piazza.',
        'Alle tue spalle sta il simbolo della città.', 'Dall\'altra parte c\'è la statua.', 'Girati e guarda il basalto.', 'Di fronte a te c\'è la statua.',
    ])('«%s» fa scartare un racconto per il resto fedele', (frase) => {
        const c = controllaRacconto(`${base} ${frase}`, ELEFANTE);
        expect(c.ok).toBe(false);
        expect(c.motivi).toContain('indicazione di direzione');
    });
    it('il racconto senza direzioni passa; il prompt le vieta (anche in r4 e r5)', () => {
        expect(controllaRacconto(BUONO, ELEFANTE).ok).toBe(true);
        expect(SYSTEM_RACCONTO).toMatch(/Mai indicazioni di direzione/);
        expect(SYSTEM_RACCONTO).toMatch(/alle tue spalle/);
        expect(SYSTEM_RACCONTO).toMatch(/«girati», «dall'altra parte»\. L'app non sa da che lato arrivi\./);
        expect(VERSIONE_RACCONTO).toBe('r5');
    });
});

describe('secondo controllo: frase per frase, basta un «no»', () => {
    const T = "Guarda l'elefante nero al centro della piazza. Per i catanesi è il simbolo della città. Qui dentro vive Agata.";
    const ok = (n) => ({ n, nelle_fonti: true, motivo: '' });
    it('la richiesta numera le frasi e porta fonti e racconto', () => {
        const m = messaggiVerifica(T, ELEFANTE);
        expect(m[0]).toEqual({ role: 'system', content: SYSTEM_VERIFICA });
        expect(m[1].content).toMatch(/1\. Guarda l'elefante nero/);
        expect(m[1].content).toMatch(/3\. Qui dentro vive Agata\./);
        expect(m[1].content).toMatch(/FONTE 1 — Wikipedia/);
        expect(SYSTEM_VERIFICA).toMatch(/nelle_fonti/);
    });
    it('tutte «sì» → passa', () => {
        const r = leggiVerifica(JSON.stringify({ frasi: [ok(1), ok(2), ok(3)] }), T);
        expect(r.ok).toBe(true);
        expect(r.motivi).toEqual([]);
    });
    it('una sola «no» → scarta e dice quale frase e perché', () => {
        const r = leggiVerifica(JSON.stringify({ frasi: [ok(1), ok(2), { n: 3, nelle_fonti: false, motivo: 'Agata non è nelle fonti' }] }), T);
        expect(r.ok).toBe(false);
        expect(r.motivi).toEqual(['verifica: frase 3 non è nelle fonti (Agata non è nelle fonti)']);
    });
    it('risposta in mezzo a testo o a ```json: si legge lo stesso', () => {
        const r = leggiVerifica('```json\n' + JSON.stringify({ frasi: [ok(1), ok(2), ok(3)] }) + '\n```', T);
        expect(r.ok).toBe(true);
    });
    it('nel dubbio non esce: risposta illeggibile, frase saltata, «sì» non booleano → scarta', () => {
        expect(leggiVerifica('non so', T).ok).toBe(false);
        expect(leggiVerifica('', T).ok).toBe(false);
        expect(leggiVerifica(JSON.stringify({ frasi: [ok(1), ok(2)] }), T).motivi).toEqual(['verifica: frase 3 senza risposta']);
        expect(leggiVerifica(JSON.stringify({ frasi: [ok(1), ok(2), { n: 3, nelle_fonti: 'true' }] }), T).ok).toBe(false);
    });
});

describe('proxy: il secondo controllo e la versione', () => {
    const src = fs.readFileSync('supabase/functions/openai-proxy/index.ts', 'utf8');
    it('dopo il controllo automatico chiama Haiku (passaggio selettore) e scarta con una sola frase «no»', () => {
        expect(src).toMatch(/chiamaConRipiego\('selettore'/);
        expect(src).toMatch(/primoRevisore\(chiaveAnthropic\)/);
        expect(MODELLO_REVISORE).toBe('claude-haiku-4-5'); // un modello suo: non segue il secret del selettore (in produzione è Sonnet)
        expect(src).toMatch(/ANTHROPIC_MODEL_REVISORE/);
        expect(src).toMatch(/messages: messaggiVerifica\(|messages \}, invia, 20_000/);
    });
    it('un narratore o un revisore che non risponde non salva niente (si riprova), non lascia passare il racconto', () => {
        expect(src).toMatch(/chi = 'revisore'/);
        expect(src).toMatch(/\$\{chi\} non disponibile[\s\S]{0,120}RACCONTO_MOTORE/);
    });
    it('la cache vale per la versione di oggi e per un r3/r4 passato o senza fonti: uno scartato r3/r4 si riscrive subito con r5', () => {
        expect(src).toMatch(/gia && versioneValida\(gia\)/);
        expect(VERSIONE_RACCONTO).toBe('r5');
        expect(versioneValida({ versione: 'r5', esito: 'passato' })).toBe(true);
        expect(versioneValida({ versione: 'r5', esito: 'scartato' })).toBe(true); // TTL di 7 giorni, come prima
        expect(versioneValida({ versione: 'r4', esito: 'passato' })).toBe(true);
        expect(versioneValida({ versione: 'r4', esito: 'senza-fonti' })).toBe(true);
        expect(versioneValida({ versione: 'r4', esito: 'scartato' })).toBe(false); // Elefante, Orto Botanico, Villa Sciarra in produzione
        expect(versioneValida({ versione: 'r4', esito: null })).toBe(false);
        expect(versioneValida({ versione: 'r3', esito: 'passato' })).toBe(true);
        expect(versioneValida({ versione: 'r3', esito: 'senza-fonti' })).toBe(true);
        expect(versioneValida({ versione: 'r3', esito: 'scartato' })).toBe(false);
        expect(versioneValida({ versione: 'r2', esito: 'passato' })).toBe(false);
        expect(versioneValida(null)).toBe(false);
    });
    it('la migrazione aggiunge solo colonne facoltative (modello_verifica, verifica)', () => {
        const sql = fs.readFileSync('supabase/migrations/20261029090000_place_racconti_verifica.sql', 'utf8');
        expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS modello_verifica text/);
        expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS verifica jsonb/);
        expect(sql).not.toMatch(/DROP|DELETE|NOT NULL/i);
    });
});

describe('r4: ogni frase su un fatto delle fonti, e una sola riscrittura', () => {
    const T1 = "Guarda l'elefante nero al centro della piazza. Per i catanesi è il simbolo della città. La fontana tiene d'occhio la piazza.";
    const T2 = "Guarda l'elefante nero al centro della piazza. Per i catanesi è il simbolo della città.";
    const si = (n) => ({ n, nelle_fonti: true, motivo: '' });
    const no = (n, motivo) => ({ n, nelle_fonti: false, motivo });
    const voti = (...v) => JSON.stringify({ frasi: v });
    const finto = (risposte) => { const f = vi.fn(async () => ({ ...risposte.shift(), modello: 'm', costoUsd: 0.001 })); return f; };

    it('il prompt: ogni frase poggia su un fatto, la voce nasce da scelta, ordine e frasi brevi, meglio 2 frasi vere', () => {
        expect(SYSTEM_RACCONTO).toMatch(/Ogni frase poggia su un fatto scritto nelle FONTI/);
        expect(SYSTEM_RACCONTO).toMatch(/QUALE fatto scegli[\s\S]*ORDINE[\s\S]*BREVI\. Non nasce da frasi di colore/);
        expect(SYSTEM_RACCONTO).toMatch(/Meglio 2 frasi vere che 4 con un abbellimento/);
        expect(SYSTEM_RACCONTO).toMatch(new RegExp(`rispondi esattamente: ${RISPOSTA_NIENTE}`));
    });
    it('la riscrittura porta la prima stesura e le frasi «no» con il loro motivo', () => {
        const m = messaggiRiscrittura(ELEFANTE, T1, [{ n: 3, motivo: 'immagine non scritta nelle fonti' }]);
        expect(m.slice(0, 2)).toEqual(messaggiRacconto(ELEFANTE));
        expect(m[2]).toEqual({ role: 'assistant', content: T1 });
        expect(m[3].role).toBe('user');
        expect(m[3].content).toMatch(/- frase 3: «La fontana tiene d'occhio la piazza\.» — immagine non scritta nelle fonti/);
        expect(m[3].content).not.toMatch(/frase 1:/);
    });
    it('passa al primo colpo: una scrittura, una verifica, nessuna riscrittura', async () => {
        const scrivi = finto([{ testo: T1 }]);
        const rivedi = finto([{ testo: voti(si(1), si(2), si(3)) }]);
        const e = await scriviERivedi(ELEFANTE, scrivi, rivedi);
        expect(e).toMatchObject({ ok: true, testo: T1, riscritto: false, prima: null, motivi: [] });
        expect(scrivi).toHaveBeenCalledTimes(1);
        expect(rivedi).toHaveBeenCalledTimes(1);
        expect(e.costoUsd).toBeCloseTo(0.002, 6);
    });
    it('il revisore dice «no»: si riscrive UNA volta con le frasi «no», si riverifica, passa', async () => {
        const scrivi = finto([{ testo: T1 }, { testo: T2 }]);
        const rivedi = finto([{ testo: voti(si(1), si(2), no(3, 'immagine non scritta nelle fonti')) }, { testo: voti(si(1), si(2)) }]);
        const e = await scriviERivedi(ELEFANTE, scrivi, rivedi);
        expect(e).toMatchObject({ ok: true, testo: T2, riscritto: true });
        expect(e.prima.testo).toBe(T1);
        expect(e.prima.motivi).toEqual(['verifica: frase 3 non è nelle fonti (immagine non scritta nelle fonti)']);
        expect(scrivi.mock.calls[1][0]).toEqual(messaggiRiscrittura(ELEFANTE, T1, [{ n: 3, motivo: 'immagine non scritta nelle fonti' }]));
        expect(rivedi.mock.calls[1][0]).toEqual(messaggiVerifica(T2, ELEFANTE));
        expect(e.costoUsd).toBeCloseTo(0.004, 6);
    });
    it('cade anche la riscrittura: scartato, mai una seconda riscrittura', async () => {
        const scrivi = finto([{ testo: T1 }, { testo: T1 }, { testo: T2 }]);
        const rivedi = finto([{ testo: voti(si(1), si(2), no(3, 'x')) }, { testo: voti(si(1), si(2), no(3, 'ancora')) }, { testo: voti(si(1), si(2)) }]);
        const e = await scriviERivedi(ELEFANTE, scrivi, rivedi);
        expect(e).toMatchObject({ ok: false, riscritto: true });
        expect(e.motivi).toEqual(['verifica: frase 3 non è nelle fonti (ancora)']);
        expect(scrivi).toHaveBeenCalledTimes(2);
        expect(rivedi).toHaveBeenCalledTimes(2);
    });
    it('la riscrittura ripassa anche dal controllo automatico: una direzione la fa cadere senza chiamare il revisore', async () => {
        const scrivi = finto([{ testo: T1 }, { testo: `${T2} Girati e guarda il basalto.` }]);
        const rivedi = finto([{ testo: voti(si(1), si(2), no(3, 'x')) }]);
        const e = await scriviERivedi(ELEFANTE, scrivi, rivedi);
        expect(e).toMatchObject({ ok: false, riscritto: true, verifica: null });
        expect(e.motivi).toContain('indicazione di direzione');
        expect(rivedi).toHaveBeenCalledTimes(1);
    });
    it('NIENTE o una risposta vuota al primo colpo: niente da correggere, nessuna riscrittura, il revisore non si chiama', async () => {
        for (const testo of [RISPOSTA_NIENTE, '']) {
            const scrivi = finto([{ testo }]);
            const rivedi = finto([]);
            const e = await scriviERivedi(ELEFANTE, scrivi, rivedi);
            expect(e).toMatchObject({ ok: false, riscritto: false });
            expect(scrivi).toHaveBeenCalledTimes(1);
            expect(rivedi).not.toHaveBeenCalled();
        }
    });
    it('NIENTE dalla riscrittura = scartato; revisore illeggibile = scartato senza riscrittura', async () => {
        const a = await scriviERivedi(ELEFANTE, finto([{ testo: T1 }, { testo: RISPOSTA_NIENTE }]), finto([{ testo: voti(si(1), si(2), no(3, 'x')) }]));
        expect(a).toMatchObject({ ok: false, riscritto: true });
        const scrivi = finto([{ testo: T1 }]);
        const b = await scriviERivedi(ELEFANTE, scrivi, finto([{ testo: 'non so' }]));
        expect(b).toMatchObject({ ok: false, riscritto: false });
        expect(scrivi).toHaveBeenCalledTimes(1);
    });
    it('un revisore o un narratore che non risponde fa fallire tutto (il proxy non salva e riprova)', async () => {
        const giu = vi.fn(async () => { throw new Error('HTTP 529'); });
        await expect(scriviERivedi(ELEFANTE, finto([{ testo: T1 }]), giu)).rejects.toThrow('HTTP 529');
        await expect(scriviERivedi(ELEFANTE, finto([{ testo: T1 }]).mockImplementationOnce(async () => ({ testo: T1, modello: 'm', costoUsd: 0 })).mockImplementationOnce(giu),
            finto([{ testo: voti(si(1), si(2), no(3, 'x')) }]))).rejects.toThrow('HTTP 529');
    });
});

describe('r5: «7.000» è un numero, e la riscrittura scatta anche sugli scarti del controllo automatico', () => {
    // le fonti vere dell'Orto Botanico di Roma (Google scrive «7.000»): in r4 cadeva 3 volte su 3 su «7» e «000»
    const ORTO = JSON.parse(fs.readFileSync('docs/prove/dati/2026-10-30-fonti-roma.json', 'utf8')).tappe.find((t) => t.nome === 'Orto Botanico di Roma').fonti;
    const PIANTE = (n) => `Guarda: questo orto ha più di ${n} specie di piante. Ci sono anche serre e un giardino giapponese.`;
    const si = (n) => ({ n, nelle_fonti: true, motivo: '' });
    const voti = (...v) => JSON.stringify({ frasi: v });
    const finto = (risposte) => vi.fn(async () => ({ ...risposte.shift(), modello: 'm', costoUsd: 0.001 }));

    it('caso 1 — Orto Botanico: «7.000», «7 000», «7000», «7 mila» e «settemila» passano come nelle fonti', () => {
        expect(`${ORTO.google.testo}`).toMatch(/7\.000/);
        for (const n of ['7.000', '7 000', '7\u202f000', '7000', '7 mila', 'settemila']) {
            const c = controllaRacconto(PIANTE(n), ORTO);
            expect(c.fuoriFonti.numeri, n).toEqual([]);
            expect(c.motivi.filter((m) => /numeri/.test(m)), n).toEqual([]);
        }
    });
    it('caso 1 — nessun numero che le fonti non hanno passa: «8.000», «70.000», «7.500», «ottomila», «7» da solo', () => {
        for (const [n, fuori] of [['8.000', '8000'], ['70.000', '70000'], ['7.500', '7500'], ['ottomila', 'ottomila'], ['7', '7'], ['7,000', '7']]) {
            const c = controllaRacconto(PIANTE(n), ORTO);
            expect(c.ok, n).toBe(false);
            expect(c.fuoriFonti.numeri, n).toContain(fuori);
        }
    });
    it('cifre e lettere sono lo stesso numero nei due versi; le parole comuni non sono numeri', () => {
        expect(unisciNumeri('7.000 e 1.000.000, 7 mila, 1,5 milioni, 2,5 km, nel 1867 650 metri. Sono 3.000.')).toBe('7000 e 1000000, 7000, 1500000, 2,5 km, nel 1867 650 metri. Sono 3000.');
        expect([['settemila', 7000], ['duecentocinquanta', 250], ['ventotto', 28], ['centottanta', 180], ['milleduecento', 1200], ['ventisei', 26]]
            .map(([w]) => numeroInLettere(w))).toEqual([7000, 250, 28, 180, 1200, 26]);
        for (const w of ['settembre', 'centrale', 'treno', 'dove', 'una', 'uno', 'sei', 'mila', 'vent', 'novecentesco']) expect(numeroInLettere(w), w).toBeNull();
        const scritte = { ...ELEFANTE, wikipedia: { ...ELEFANTE.wikipedia, testo: `${ELEFANTE.wikipedia.testo} Ha dodici zampilli.` } };
        expect(controllaRacconto("Guarda l'elefante di basalto nero: è l'emblema della città. Ha 12 zampilli.", scritte).fuoriFonti.numeri).toEqual([]);
        expect(controllaRacconto("Guarda l'elefante di basalto nero: è l'emblema della città. Ha 13 zampilli.", scritte).fuoriFonti.numeri).toEqual(['13']);
    });

    it('caso 2 — più di 4 frasi: si riscrive una volta con il motivo, il nuovo testo ripassa da entrambi i controlli', async () => {
        const lungo = "Guarda l'elefante. È di basalto nero. Lo chiamano U Liotru. Sta al centro della piazza. È l'emblema della città.";
        const corto = "Guarda l'elefante di basalto nero: lo chiamano U Liotru. Sta al centro di piazza del Duomo ed è l'emblema della città.";
        const scrivi = finto([{ testo: lungo }, { testo: corto }]);
        const rivedi = finto([{ testo: voti(si(1), si(2)) }]);
        const e = await scriviERivedi(ELEFANTE, scrivi, rivedi);
        expect(e).toMatchObject({ ok: true, testo: corto, riscritto: true });
        expect(e.prima).toEqual({ testo: lungo, motivi: ['più di 4 frasi'] });
        expect(scrivi.mock.calls[1][0]).toEqual(messaggiRiscritturaControllo(ELEFANTE, lungo, ['più di 4 frasi']));
        expect(scrivi.mock.calls[1][0][3].content).toMatch(/- più di 4 frasi: ne hai scritte 5/);
        expect(rivedi).toHaveBeenCalledTimes(1); // la prima stesura non arriva al revisore; la riscritta sì
        expect(rivedi.mock.calls[0][0]).toEqual(messaggiVerifica(corto, ELEFANTE));
    });
    it('caso 2 — una direzione: il motivo porta la parola che l\'ha fatto cadere; se la riscritta cade ancora, scartato senza seconda riscrittura', async () => {
        const T = "Guarda l'elefante di basalto nero: lo chiamano U Liotru. Alla tua sinistra c'è la fontana di Vaccarini.";
        const m = messaggiRiscritturaControllo(ELEFANTE, T, ['indicazione di direzione']);
        expect(m.slice(0, 3)).toEqual([...messaggiRacconto(ELEFANTE), { role: 'assistant', content: T }]);
        expect(m[3].content).toMatch(/Un controllo automatico[\s\S]*- indicazione di direzione: «sinistra»/);
        expect(m[3].content).toMatch(/nessuna direzione/);
        const scrivi = finto([{ testo: T }, { testo: `${T} Davanti c'è la piazza.` }, { testo: 'mai' }]);
        const rivedi = finto([]);
        const e = await scriviERivedi(ELEFANTE, scrivi, rivedi);
        expect(e).toMatchObject({ ok: false, riscritto: true, verifica: null });
        expect(e.motivi).toContain('indicazione di direzione');
        expect(scrivi).toHaveBeenCalledTimes(2);
        expect(rivedi).not.toHaveBeenCalled();
    });
    it('caso 2 — un numero che le fonti non hanno: si riscrive col motivo; la riscritta passa dall\'automatico ma il revisore dice «no»: scartato', async () => {
        const T = "Guarda l'elefante di basalto nero: lo chiamano U Liotru. La fontana è di Vaccarini, del 1736.";
        const T2 = "Guarda l'elefante di basalto nero: lo chiamano U Liotru. La fontana è di Vaccarini, tra il 1735 e il 1737.";
        const scrivi = finto([{ testo: T }, { testo: T2 }, { testo: 'mai' }]);
        const rivedi = finto([{ testo: voti(si(1), { n: 2, nelle_fonti: false, motivo: 'x' }) }]);
        const e = await scriviERivedi(ELEFANTE, scrivi, rivedi);
        expect(scrivi.mock.calls[1][0][3].content).toMatch(/- numeri non nelle fonti: 1736/);
        expect(e).toMatchObject({ ok: false, riscritto: true, testo: T2 });
        expect(e.motivi).toEqual(['verifica: frase 2 non è nelle fonti (x)']);
        expect(e.prima.motivi).toEqual(['numeri non nelle fonti: 1736']);
        expect(scrivi).toHaveBeenCalledTimes(2);
    });

    it('caso 3 — gli scartati r4 in produzione (Elefante, Orto Botanico, Villa Sciarra) si riscrivono subito, i passati r4 restano', () => {
        const scartati = [
            { place_id: 'elefante', versione: 'r4', esito: 'scartato', created_at: '2026-10-31T00:06:00Z' },
            { place_id: 'orto', versione: 'r4', esito: 'scartato', created_at: '2026-10-31T00:06:00Z' },
            { place_id: 'sciarra', versione: 'r4', esito: 'scartato', created_at: '2026-10-31T00:06:00Z' },
        ];
        for (const r of scartati) expect(versioneValida(r), r.place_id).toBe(false); // il TTL di 7 giorni non li tiene più
        expect(versioneValida({ place_id: 'cattedrale', versione: 'r4', esito: 'passato', created_at: '2026-10-31T00:06:00Z' })).toBe(true);
    });
});
