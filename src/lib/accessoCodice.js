/**
 * ONBOARDING-ACCESSO — entrare (e registrarsi) con email e codice, senza password.
 *
 * `signInWithOtp` con `shouldCreateUser: true`: se l'account c'è, Supabase manda il modello «magic_link»; se non c'è lo
 * crea e manda il modello «confirmation». Tutti e due portano il codice (`{{ .Token }}`, supabase/templates/accesso.html e
 * conferma.html, generati da supabase/functions/_shared/emailUnnivai.ts). `verifyOtp({ type: 'email' })` vale per entrambi:
 * conferma l'email (account nuovo) e apre la sessione.
 *
 * Chi ha già una password entra anche con il codice (stessa email, stesso account): nessun account resta bloccato. La
 * password resta come seconda strada nella pagina di accesso (`signInWithPassword`), non si crea più.
 * L'ospite (account anonimo) non passa da qui: aggiunge l'email al SUO account (lib/ospite.js, `email_change`).
 */
import { supabase } from './supabase';
import { erroreAuthItaliano } from './erroriAuth';
import { ACCESSO } from './testiAccount';

/** Secondi fra due codici: Supabase ne manda uno al minuto per indirizzo (oltre risponde 429). */
export const ATTESA_RIMANDO_S = 60;

/** Solo le cifre; 6 di difetto (lunghezza dell'OTP di Supabase), fino a 10 se il progetto la allunga. */
export const pulisciCodice = (v) => String(v || '').replace(/\D/g, '').slice(0, 10);
export const codiceValido = (v) => /^\d{6,10}$/.test(pulisciCodice(v));

/** Passo 1: il codice per email. I metadati valgono solo per un account nuovo. */
export async function mandaCodiceAccesso(email) {
    try {
        const { error } = await supabase.auth.signInWithOtp({
            email: String(email).trim(),
            options: {
                shouldCreateUser: true,
                emailRedirectTo: `${window.location.origin}/login`,
                data: { role: 'explorer' },
            },
        });
        return { error: error || null };
    } catch (error) {
        return { error };
    }
}

/** Passo 2: il codice apre la sessione (e conferma l'email di un account nuovo). */
export async function entraConCodice(email, codice) {
    try {
        const { data, error } = await supabase.auth.verifyOtp({ email: String(email).trim(), token: pulisciCodice(codice), type: 'email' });
        return { error: error || null, session: data?.session || null };
    } catch (error) {
        return { error, session: null };
    }
}

/** Il testo dell'errore del codice: sbagliato e scaduto si dicono uguale (Supabase non li distingue). */
export function erroreCodice(err) {
    const testo = String(err?.message || '');
    if (err?.code === 'otp_expired' || /token has expired|invalid.*(otp|token)|otp.*(expired|invalid)/i.test(testo)) return ACCESSO.CODICE_SBAGLIATO;
    return erroreAuthItaliano(err);
}
