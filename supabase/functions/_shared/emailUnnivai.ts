// EMAIL-LANCIO — le quattro email di Unnivai, in un posto solo.
//
// · conferma della registrazione, link di accesso, reset della password: sono i modelli di Supabase Auth.
//   Le variabili ({{ .ConfirmationURL }}, {{ .Email }}, {{ .SiteURL }}) le riempie Supabase al momento dell'invio.
//   I file supabase/templates/*.html si rigenerano da qui (scripts/email/genera-modelli.mjs) e un test controlla
//   che siano uguali; Ivano li carica con scripts/email/carica-modelli.mjs.
// · iscrizione alla lista d'attesa: la spedisce l'Edge Function lista-attesa-email con l'API di Resend.
//
// La voce: fatti, frasi brevi, nessun aggettivo da brochure, mai «Benvenuti» (test: src/__tests__/email/modelliEmail.test.js).
// HTML a tabelle, stili in linea, nessun testo dentro le immagini; il logo è un URL pubblico assoluto.
// Modalità scura: color-scheme + supported-color-schemes e @media (prefers-color-scheme: dark) per Apple Mail;
// i colori chiari di partenza reggono anche l'inversione automatica di Gmail e Outlook.

export const LOGO_URL = 'https://unnivai.com/logo.png'; // 441×125, servito dal progetto Vercel unnivai-site
export const SITO_URL = 'https://unnivai.com/';
export const CITTA_DI_PARTENZA = 'Catania'; // come HOME nella pagina della lista d'attesa su unnivai.com

/** La durata dei link delle email di Auth: mailer_otp_exp = 3600 s in produzione (letto il 02/11/2026). */
export const DURATA_LINK = "un'ora";

const C = {
    sfondo: '#F3F1EC', scheda: '#FFFFFF', bordo: '#E4E0D8', testo: '#06161E', tenue: '#4A5A60',
    accento: '#FF6B3D', suAccento: '#1A0A04', link: '#B4401A',
    // scuro (gli stessi della pagina unnivai.com)
    sfondoScuro: '#06161E', schedaScura: '#0B2029', bordoScuro: '#1D3B47', testoScuro: '#EAF2F0', tenueScuro: '#9BB5BC', linkScuro: '#FF8A5B',
};
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

/** Testo sicuro dentro l'HTML (città ed email arrivano da un modulo pubblico). */
export const esc = (s: unknown): string => String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

type Pulsante = { testo: string; url: string };
type Parti = {
    titolo: string;          // h1 e <title>
    anteprima: string;       // la riga che i client mostrano accanto all'oggetto
    paragrafi: string[];     // HTML già sicuro
    pulsante?: Pulsante;     // url già sicuro (o variabile di Supabase)
    dopoPulsante?: string[]; // righe piccole sotto il pulsante (HTML già sicuro)
    piede: string[];         // righe sotto la scheda (HTML già sicuro)
};

const p = (html: string, classe = 'testo', colore = C.testo, size = 16) =>
    `<p class="${classe}" style="margin:0 0 14px;font-family:${FONT};font-size:${size}px;line-height:1.5;color:${colore};">${html}</p>`;

function pulsante({ testo, url }: Pulsante): string {
    return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 20px;">
<tr><td class="pulsante" bgcolor="${C.accento}" style="background:${C.accento};border-radius:999px;">
<a href="${url}" target="_blank" style="display:inline-block;padding:14px 26px;font-family:${FONT};font-size:16px;font-weight:700;line-height:1.2;color:${C.suAccento};text-decoration:none;border-radius:999px;">${testo}</a>
</td></tr></table>`;
}

/** Il guscio comune: logo, scheda, piede. */
export function guscio(x: Parti): string {
    const corpo = [
        `<h1 class="testo" style="margin:0 0 14px;font-family:${FONT};font-size:24px;font-weight:800;line-height:1.25;color:${C.testo};">${x.titolo}</h1>`,
        ...x.paragrafi.map((h) => p(h)),
        x.pulsante ? pulsante(x.pulsante) : '',
        ...(x.dopoPulsante ?? []).map((h) => p(h, 'tenue', C.tenue, 14)),
    ].filter(Boolean).join('\n');
    const piede = x.piede.map((h) => p(h, 'tenue', C.tenue, 13)).join('\n');
    return `<!doctype html>
<html lang="it" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no,address=no,email=no,date=no">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${x.titolo}</title>
<style>
:root{color-scheme:light dark;supported-color-schemes:light dark}
body{margin:0;padding:0;-webkit-text-size-adjust:100%;}
a{color:${C.link};}
@media (prefers-color-scheme: dark){
  .sfondo{background:${C.sfondoScuro} !important;}
  .scheda{background:${C.schedaScura} !important;border-color:${C.bordoScuro} !important;}
  .testo{color:${C.testoScuro} !important;}
  .tenue{color:${C.tenueScuro} !important;}
  .tenue a,.testo a,a.link{color:${C.linkScuro} !important;}
}
[data-ogsc] .sfondo{background:${C.sfondoScuro} !important;}
[data-ogsc] .scheda{background:${C.schedaScura} !important;}
[data-ogsc] .testo{color:${C.testoScuro} !important;}
[data-ogsc] .tenue{color:${C.tenueScuro} !important;}
</style>
</head>
<body class="sfondo" style="margin:0;padding:0;background:${C.sfondo};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${x.anteprima}</div>
<table role="presentation" class="sfondo" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.sfondo};">
<tr><td align="center" style="padding:28px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">
<tr><td style="padding:0 4px 18px;">
<a href="${SITO_URL}" target="_blank"><img src="${LOGO_URL}" width="141" height="40" alt="Unnivai" style="display:block;border:0;outline:none;width:141px;height:40px;"></a>
</td></tr>
<tr><td class="scheda" style="background:${C.scheda};border:1px solid ${C.bordo};border-radius:16px;padding:28px 24px 14px;">
${corpo}
</td></tr>
<tr><td style="padding:18px 4px 0;">
${piede}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>
`;
}

const linkCopiabile = (url: string) =>
    `<a class="link" href="${url}" target="_blank" style="color:${C.link};word-break:break-all;">${url}</a>`;
const scadenza = `Il link vale ${DURATA_LINK} e funziona una volta. Se il pulsante non si apre, copia questo indirizzo nel browser:`;
const apriUnnivai = `<a class="link" href="{{ .SiteURL }}" target="_blank" style="color:${C.link};">Apri Unnivai</a>`;

/** I modelli di Supabase Auth: chiave = nome del modello nella Management API (mailer_templates_<chiave>_content). */
export const MODELLI_AUTH = {
    confirmation: {
        file: 'conferma.html',
        oggetto: 'Conferma la tua email per Unnivai',
        html: guscio({
            titolo: 'Conferma la tua email',
            anteprima: `Un tocco e l'account è attivo. Il link vale ${DURATA_LINK}.`,
            paragrafi: [
                'Hai creato un account Unnivai con {{ .Email }}.',
                'Tocca il pulsante per attivarlo. Poi entri con la tua password.',
            ],
            pulsante: { testo: "Conferma l'email", url: '{{ .ConfirmationURL }}' },
            dopoPulsante: [scadenza, linkCopiabile('{{ .ConfirmationURL }}')],
            piede: ["Non hai creato tu l'account? Ignora questa email: senza conferma non si attiva.", apriUnnivai],
        }),
    },
    magic_link: {
        file: 'accesso.html',
        oggetto: 'Il tuo link per entrare in Unnivai',
        html: guscio({
            titolo: 'Entra in Unnivai',
            anteprima: `Entri senza password. Il link vale ${DURATA_LINK}.`,
            paragrafi: [
                'Hai chiesto di entrare con {{ .Email }}.',
                'Tocca il pulsante: entri senza password.',
            ],
            pulsante: { testo: 'Entra', url: '{{ .ConfirmationURL }}' },
            dopoPulsante: [scadenza, linkCopiabile('{{ .ConfirmationURL }}')],
            piede: ["Non l'hai chiesto tu? Ignora questa email: senza questo link non entra nessuno.", apriUnnivai],
        }),
    },
    recovery: {
        file: 'password.html',
        oggetto: 'Reimposta la password di Unnivai',
        html: guscio({
            titolo: 'Reimposta la password',
            anteprima: `Scegli la password nuova. Il link vale ${DURATA_LINK}.`,
            paragrafi: [
                "È arrivata una richiesta per cambiare la password dell'account {{ .Email }}.",
                'Tocca il pulsante e scegli quella nuova.',
            ],
            pulsante: { testo: 'Scegli la nuova password', url: '{{ .ConfirmationURL }}' },
            dopoPulsante: [scadenza, linkCopiabile('{{ .ConfirmationURL }}')],
            piede: ["Non l'hai chiesta tu? Ignora questa email: la password resta quella di adesso.", apriUnnivai],
        }),
    },
} as const;

export type EmailComposta = { oggetto: string; html: string; testo: string };

/**
 * L'email dell'iscrizione alla lista d'attesa. Le tre frasi seguono quelle che la pagina mostra dopo l'invio
 * (nessuna città / Catania / un'altra città), così email e pagina dicono la stessa cosa.
 */
export function emailListaAttesa({ email, citta }: { email: string; citta?: string | null }): EmailComposta {
    const c = String(citta ?? '').trim().slice(0, 40);
    const casa = c.toLowerCase() === CITTA_DI_PARTENZA.toLowerCase();
    const quando = !c
        ? 'Ti scrivo quando il tuo accesso è pronto.'
        : casa
            ? `${CITTA_DI_PARTENZA} è la prima città. Ti scrivo quando il tuo accesso è pronto.`
            : `Si parte da ${CITTA_DI_PARTENZA}. Ti scrivo quando Unnivai arriva anche a ${c}.`;
    const righe = {
        titolo: 'Sei in lista.',
        quando,
        prossima: "Questa email conferma l'iscrizione. La prossima arriva con il tuo accesso: prima, nessuna newsletter.",
        uscita: 'Per uscire dalla lista rispondi a questa email con «cancellami».',
        piede: `Questo indirizzo (${email}) è nella lista d'attesa di unnivai.com, con il consenso dato nel modulo.`,
    };
    const html = guscio({
        titolo: righe.titolo,
        anteprima: esc(quando),
        paragrafi: [esc(quando), esc(righe.prossima)],
        dopoPulsante: [esc(righe.uscita)],
        piede: [esc(righe.piede), `<a class="link" href="${SITO_URL}" target="_blank" style="color:${C.link};">unnivai.com</a>`],
    });
    const testo = [righe.titolo, '', quando, righe.prossima, '', righe.uscita, '', righe.piede, SITO_URL].join('\n');
    return { oggetto: "Sei nella lista d'attesa di Unnivai", html, testo };
}
