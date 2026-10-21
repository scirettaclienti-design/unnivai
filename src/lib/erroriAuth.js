/**
 * ACCESSO-1 — gli errori di Supabase Auth, in italiano e nella voce dell'app
 * (brevi, diretti). Mai il testo inglese del server: se non lo riconosciamo,
 * una frase generica.
 */

const PER_CODICE = {
    invalid_credentials: 'Email o password non corrette.',
    email_not_confirmed: 'Prima conferma l\'email: ti abbiamo scritto un link.',
    user_already_exists: 'Email già registrata. Prova ad accedere.',
    email_exists: 'Email già registrata. Prova ad accedere.',
    over_email_send_rate_limit: 'Troppe email inviate. Riprova tra qualche minuto.',
    over_request_rate_limit: 'Troppi tentativi. Riprova tra qualche minuto.',
    over_sms_send_rate_limit: 'Troppi tentativi. Riprova tra qualche minuto.',
    weak_password: 'Password troppo debole. Scegline una più lunga e meno comune.',
    same_password: 'Scegli una password diversa da quella di prima.',
    email_address_invalid: 'Email non valida. Controlla come l\'hai scritta.',
    validation_failed: 'Email non valida. Controlla come l\'hai scritta.',
    signup_disabled: 'Le registrazioni sono chiuse per ora.',
    user_banned: 'Questo account non può accedere.',
    session_not_found: 'Il link non è più valido. Richiedine uno nuovo.',
    session_expired: 'Il link non è più valido. Richiedine uno nuovo.',
    refresh_token_not_found: 'Il link non è più valido. Richiedine uno nuovo.',
    reauthentication_needed: 'Il link non è più valido. Richiedine uno nuovo.',
    user_not_found: 'Il link non è più valido. Richiedine uno nuovo.',
    otp_expired: 'Il link è scaduto. Richiedine uno nuovo.',
};

// Per le versioni del server che non mandano il codice: si riconosce il testo.
const PER_TESTO = [
    [/invalid login credentials/i, PER_CODICE.invalid_credentials],
    [/email not confirmed/i, PER_CODICE.email_not_confirmed],
    [/already (been )?registered|already exists/i, PER_CODICE.user_already_exists],
    [/rate limit|too many requests|security purposes/i, PER_CODICE.over_request_rate_limit],
    [/password (is )?(too )?(weak|short)|at least \d+ characters|should contain at least/i, PER_CODICE.weak_password],
    [/different from the old password|same as the old/i, PER_CODICE.same_password],
    [/invalid.*email|email.*invalid|unable to validate email/i, PER_CODICE.email_address_invalid],
    [/signups? (not allowed|are disabled)|signup is disabled/i, PER_CODICE.signup_disabled],
    [/session.*(missing|not found|expired)|token.*(expired|invalid)|expired|jwt/i, PER_CODICE.session_expired],
    [/failed to fetch|networkerror|network request failed|load failed|fetch failed/i, 'Connessione assente. Riprova tra poco.'],
];

export const ERRORE_AUTH_GENERICO = 'Qualcosa non ha funzionato. Riprova tra poco.';

export function erroreAuthItaliano(err) {
    if (!err) return ERRORE_AUTH_GENERICO;
    if (err.code && PER_CODICE[err.code]) return PER_CODICE[err.code];
    const testo = String(err.message || err);
    for (const [re, frase] of PER_TESTO) {
        if (re.test(testo)) return frase;
    }
    return ERRORE_AUTH_GENERICO;
}
