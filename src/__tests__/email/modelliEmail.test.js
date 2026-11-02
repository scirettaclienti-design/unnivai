// @vitest-environment node
//
// EMAIL-LANCIO — le quattro email di Unnivai: voce, variabili di Supabase, logo, modalità scura.
// Le parole vietate sono quelle dell'elenco unico del repo (BANNED_VOICE_WORDS, via filterBannedWords) più le
// regole di voce dei racconti («benvenut», superlativi in -issimo, aggettivi da brochure: VIETATE di racconto.ts).
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { filterBannedWords } from '@/lib/narrationLight';
import {
    MODELLI_AUTH, emailListaAttesa, esc, LOGO_URL, CITTA_DI_PARTENZA,
} from '../../../supabase/functions/_shared/emailUnnivai.ts';
import { corpoPatch } from '../../../scripts/email/carica-modelli.mjs';

const DIR = path.resolve(__dirname, '../../../supabase/templates');

// Le stesse regole di voce di supabase/functions/openai-proxy/racconto.ts (VIETATE non è esportata: copiate qui).
const VOCE = [
    [/benvenut/i, '«benvenuti»'],
    [/\b(imperdibil\w*|meraviglios\w*|spettacolar\w*|incantevol\w*|splendid\w*|straordinari\w*|favolos\w*|magnific\w*|stupend\w*|affascinant\w*|suggestiv\w*|unico nel suo genere|da non perdere|gioiello|must[- ]see)\b/i, 'aggettivo da brochure'],
    [/\b\w{4,}issim[oaie]\b/i, 'superlativo'],
    [/\b(fantastic\w*|incredibil\w*|eccezional\w*|esclusiv\w*|perfett\w*|migliore|migliori)\b/i, 'aggettivo vuoto'],
    [/\b(vi|voi)\b/i, 'parla a più persone'],
    [/[!]/, 'punto esclamativo'],
    [/\p{Extended_Pictographic}/u, 'emoji'],
];

/** Il testo che il lettore vede: niente tag, niente stile, niente variabili di Supabase. */
const testoVisibile = (html) => html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<title>[\s\S]*?<\/title>/gi, ' ')
    .replace(/\{\{[^}]*\}\}/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ').trim();

const problemiDiVoce = (testo) => [
    ...VOCE.filter(([re]) => re.test(testo)).map(([, m]) => m),
    ...filterBannedWords(testo).removed.map((r) => `parola vietata: ${r.parole.join(', ') || r.regola}`),
];

const LISTA = {
    'nessuna città': emailListaAttesa({ email: 'prova@example.com', citta: null }),
    Catania: emailListaAttesa({ email: 'prova@example.com', citta: 'Catania' }),
    'altra città': emailListaAttesa({ email: 'prova@example.com', citta: 'Bologna' }),
};
const TUTTE = [
    ...Object.entries(MODELLI_AUTH).map(([k, m]) => [k, m.oggetto, m.html]),
    ...Object.entries(LISTA).map(([k, m]) => [`lista d'attesa (${k})`, m.oggetto, m.html]),
];

describe('la voce di Unnivai', () => {
    it.each(TUTTE)('%s: niente «benvenuti», superlativi, parole vietate, esclamativi', (_nome, oggetto, html) => {
        expect(problemiDiVoce(oggetto)).toEqual([]);
        expect(problemiDiVoce(testoVisibile(html))).toEqual([]);
    });
    it('il controllo funziona davvero (una frase sbagliata si vede)', () => {
        expect(problemiDiVoce('Benvenuti in Unnivai, il posto più bellissimo e imperdibile!')).toEqual(
            expect.arrayContaining(['«benvenuti»', 'superlativo', 'aggettivo da brochure', 'punto esclamativo']),
        );
        expect(problemiDiVoce("Un'esperienza unica ti aspetta.").join()).toMatch(/parola vietata/);
    });
    it('frasi brevi: nessuna frase oltre 25 parole', () => {
        for (const [, , html] of TUTTE) {
            const frasi = testoVisibile(html).split(/(?<=[.:?])\s+/);
            for (const f of frasi) expect(f.split(/\s+/).length, f).toBeLessThanOrEqual(25);
        }
    });
});

describe('i modelli di Supabase Auth', () => {
    const CON_LINK = Object.entries(MODELLI_AUTH).filter(([k]) => k !== 'email_change');
    it.each(CON_LINK)('%s ha le variabili giuste', (_k, m) => {
        expect(m.html.match(/\{\{ \.ConfirmationURL \}\}/g)).toHaveLength(3); // pulsante, link scritto, testo del link
        expect(m.html).toContain('{{ .SiteURL }}');
        expect(m.html).toContain('{{ .Email }}');
        // solo variabili che Supabase conosce, scritte come le scrive la documentazione
        const variabili = [...m.html.matchAll(/\{\{([^}]*)\}\}/g)].map((x) => x[1].trim());
        for (const v of variabili) expect(['.ConfirmationURL', '.SiteURL', '.Email']).toContain(v);
    });
    it('email_change (OSPITE-GIRO): il codice di 6 cifre, nessun link da toccare', () => {
        const m = MODELLI_AUTH.email_change;
        expect(m.html.match(/\{\{ \.Token \}\}/g)).toHaveLength(1);
        expect(m.html).toContain('{{ .NewEmail }}');
        expect(m.html).not.toContain('{{ .ConfirmationURL }}');
        const variabili = [...m.html.matchAll(/\{\{([^}]*)\}\}/g)].map((x) => x[1].trim());
        for (const v of variabili) expect(['.Token', '.NewEmail', '.SiteURL']).toContain(v);
    });
    it('i file del repo sono quelli generati da emailUnnivai.ts (genera-modelli.mjs)', () => {
        const soggetti = JSON.parse(fs.readFileSync(path.join(DIR, 'soggetti.json'), 'utf8'));
        expect(Object.keys(soggetti).sort()).toEqual(['confirmation', 'email_change', 'magic_link', 'recovery']);
        for (const [k, m] of Object.entries(MODELLI_AUTH)) {
            expect(fs.readFileSync(path.join(DIR, m.file), 'utf8'), m.file).toBe(m.html);
            expect(soggetti[k]).toEqual({ file: m.file, oggetto: m.oggetto });
        }
    });
    it('il caricamento tocca solo gli 8 campi dei quattro modelli', () => {
        const corpo = corpoPatch(DIR);
        expect(Object.keys(corpo).sort()).toEqual([
            'mailer_subjects_confirmation', 'mailer_subjects_email_change', 'mailer_subjects_magic_link', 'mailer_subjects_recovery',
            'mailer_templates_confirmation_content', 'mailer_templates_email_change_content', 'mailer_templates_magic_link_content',
            'mailer_templates_recovery_content',
        ]);
        expect(corpo.mailer_templates_recovery_content).toBe(MODELLI_AUTH.recovery.html);
    });
});

describe('fatte per i client di posta', () => {
    it.each(TUTTE)('%s: tabelle, modalità scura, logo assoluto, nessun testo in immagine', (_nome, _o, html) => {
        expect(html).toMatch(/<table role="presentation"/);
        expect(html).not.toMatch(/<div[^>]*class=|display:\s*flex|display:\s*grid/i); // il layout sta nelle tabelle
        expect(html).toContain('<meta name="color-scheme" content="light dark">');
        expect(html).toContain('<meta name="supported-color-schemes" content="light dark">');
        expect(html).toContain('@media (prefers-color-scheme: dark)');
        expect(html).toContain('<html lang="it"');
        const immagini = [...html.matchAll(/<img\b[^>]*>/g)].map((x) => x[0]);
        expect(immagini).toHaveLength(1);
        expect(immagini[0]).toContain(`src="${LOGO_URL}"`);
        expect(immagini[0]).toContain('alt="Unnivai"');
        expect(LOGO_URL).toMatch(/^https:\/\//);
        expect(html).not.toMatch(/src="(?!https:\/\/)/); // niente allegati né percorsi relativi
        expect(html).not.toMatch(/<script/i);
    });
});

describe("l'email della lista d'attesa", () => {
    it('dice la stessa cosa della pagina dopo l\'invio, nei tre casi', () => {
        expect(testoVisibile(LISTA['nessuna città'].html)).toContain('Ti scrivo quando il tuo accesso è pronto.');
        expect(testoVisibile(LISTA.Catania.html)).toContain(`${CITTA_DI_PARTENZA} è la prima città. Ti scrivo quando il tuo accesso è pronto.`);
        expect(testoVisibile(LISTA['altra città'].html)).toContain('Si parte da Catania. Ti scrivo quando Unnivai arriva anche a Bologna.');
        expect(emailListaAttesa({ email: 'a@b.it', citta: 'catania' }).testo).toContain('Catania è la prima città.');
    });
    it('ha la versione solo testo, l\'oggetto e il modo per uscire dalla lista', () => {
        const m = LISTA.Catania;
        expect(m.oggetto).toBe("Sei nella lista d'attesa di Unnivai");
        expect(m.testo).toContain('Sei in lista.');
        expect(m.testo).toContain('«cancellami»');
        expect(m.testo).not.toMatch(/<[a-z]/i);
    });
    it('la città e l\'indirizzo del modulo pubblico non entrano come HTML', () => {
        const m = emailListaAttesa({ email: '"><img src=x>@x.it', citta: '<script>alert(1)</script>' });
        expect(m.html).not.toContain('<script>alert');
        expect(m.html).not.toContain('<img src=x>');
        expect(m.html).toContain('&lt;script&gt;');
        expect(esc(`a<b>"c'&`)).toBe('a&lt;b&gt;&quot;c&#39;&amp;');
    });
    it('una città lunghissima si ferma a 40 caratteri (come il vincolo della tabella)', () => {
        const m = emailListaAttesa({ email: 'a@b.it', citta: 'x'.repeat(200) });
        expect(m.testo).toContain(`a ${'x'.repeat(40)}.`);
        expect(m.testo).not.toContain('x'.repeat(41));
    });
});
