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
    // ONBOARDING-ACCESSO: «confirmation» e «magic_link» portano SIA il codice SIA il link (l'app di prima usa il link, quella
    // nuova il codice: i modelli si caricano in qualsiasi momento). «recovery» resta solo link, «email_change» solo codice.
    // LINK-DOMINIO: il link punta al sito con il token_hash (lo verifica l'app, src/lib/linkEmail.js), non a Supabase.
    const LINK = {
        confirmation: '{{ .SiteURL }}/login?token_hash={{ .TokenHash }}&type=email',
        magic_link: '{{ .SiteURL }}/login?token_hash={{ .TokenHash }}&type=email',
        recovery: '{{ .SiteURL }}/update-password?token_hash={{ .TokenHash }}&type=recovery',
    };
    const VARIABILI = {
        confirmation: ['.Token', '.TokenHash', '.Email', '.SiteURL'],
        magic_link: ['.Token', '.TokenHash', '.Email', '.SiteURL'],
        recovery: ['.TokenHash', '.Email', '.SiteURL'],
        email_change: ['.Token', '.NewEmail', '.SiteURL'],
    };
    it.each(Object.entries(VARIABILI))('%s ha le variabili giuste, scritte come la documentazione', (k, ammesse) => {
        const m = MODELLI_AUTH[k];
        const variabili = [...m.html.matchAll(/\{\{([^}]*)\}\}/g)].map((x) => x[1].trim());
        for (const v of variabili) expect(ammesse).toContain(v);
        for (const v of ammesse) expect(variabili).toContain(v);
        expect(m.html).not.toContain('{{ .ConfirmationURL }}');
    });
    it.each(['confirmation', 'magic_link'])('%s: il codice di 6 cifre in grande E il link al sito (pulsante + indirizzo scritto)', (k) => {
        const m = MODELLI_AUTH[k];
        expect(m.html.match(/\{\{ \.Token \}\}/g)).toHaveLength(1);
        expect(m.html.split(`href="${LINK[k]}"`)).toHaveLength(3); // pulsante e testo del link
        expect(m.html.split(LINK[k])).toHaveLength(4); // pulsante, link scritto, testo del link
        expect(m.html.indexOf('{{ .Token }}')).toBeLessThan(m.html.indexOf(LINK[k])); // prima il codice
        expect(testoVisibile(m.html)).toContain('Oppure apri questo link:');
    });
    it('recovery: solo il link; email_change (OSPITE-GIRO): solo il codice', () => {
        expect(MODELLI_AUTH.recovery.html).not.toContain('{{ .Token }}');
        expect(MODELLI_AUTH.recovery.html.split(LINK.recovery)).toHaveLength(4);
        expect(MODELLI_AUTH.email_change.html.match(/\{\{ \.Token \}\}/g)).toHaveLength(1);
        expect(MODELLI_AUTH.email_change.html).not.toContain('{{ .ConfirmationURL }}');
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

describe('ONBOARDING-ACCESSO — la grafica del marchio nelle email', () => {
    it('logo: PNG del nostro sito, URL assoluto, misure scritte, testo alternativo visibile se le immagini sono bloccate', () => {
        expect(LOGO_URL).toBe('https://unnivai.vercel.app/brand/logo-email.png');
        expect(fs.existsSync(path.resolve(__dirname, '../../../public/brand/logo-email.png'))).toBe(true);
        for (const [, , html] of TUTTE) {
            const img = html.match(/<img\b[^>]*>/)[0];
            expect(img).toMatch(/width="141" height="40"/);
            expect(img).toMatch(/alt="Unnivai"/);
            expect(img).toMatch(/font-size:24px;font-weight:800/); // l'alt si legge, in arancione
            expect(html).not.toMatch(/\.svg/i);
        }
    });
    it.each(['confirmation', 'magic_link', 'email_change'])('%s: il codice in un riquadro, cifre grandi a spaziatura fissa, anche al buio', (k) => {
        const html = MODELLI_AUTH[k].html;
        expect(html).toMatch(/<td class="codice"[^>]*border:2px solid #FF6B3D/);
        expect(html).toMatch(/monospace;font-size:34px;font-weight:700;letter-spacing:8px[^"]*">\{\{ \.Token \}\}<\/span>/);
        expect(html).toMatch(/@media \(prefers-color-scheme: dark\)[\s\S]*\.codice\{background:#0A2733/);
    });
    it('nessuna tabella dentro un paragrafo (HTML valido: il codice e le righe degli avvisi sono blocchi)', () => {
        for (const [, , html] of TUTTE) expect(html).not.toMatch(/<p[^>]*>\s*<table/);
    });
    it('il pulsante ha i colori di Unnivai e i titoli il carattere del marchio dove il client lo carica', () => {
        const html = MODELLI_AUTH.magic_link.html;
        expect(html).toMatch(/class="pulsante" bgcolor="#FF6B3D"/);
        expect(html).toMatch(/color:#1A0A04;text-decoration:none/);
        expect(html).toContain("@font-face{font-family:'Bricolage Grotesque'");
        expect(fs.existsSync(path.resolve(__dirname, '../../../public/brand/fonts/bricolage-grotesque-latin-800-normal.woff2'))).toBe(true);
    });
});
