/**
 * OSPITE-GIRO — il giro di prova senza account.
 *
 * Chi tocca «Prova un giro, senza account» entra con un account anonimo di Supabase (`signInAnonymously`): ha un id vero,
 * le sue righe (DNA, preferenze, giri) sono sue come per ogni utente. Quando si registra, l'email e la password si
 * aggiungono allo STESSO account (`updateUser({ email })` → codice di 6 cifre → `verifyOtp` → `updateUser({ password })`):
 * giro e DNA restano dove sono, niente da copiare.
 *
 * I limiti li decide il server (openai-proxy → public.ai_quota_ospite): un giro generato per account, un tetto per rete,
 * un tetto giornaliero per tutti gli ospiti. Qui c'è solo la parte del telefono: il giro di prova finito (per proporre
 * l'account al secondo giro anche quando il giro fatto era un Per Te) e l'invito a registrarsi, aperto da un evento.
 *
 * Mai un invito prima del primo giro: i tre momenti sono la fine del giro («Salva questo giro»), la richiesta del secondo
 * giro e il salvataggio.
 */

import { supabase } from './supabase';

export const isOspite = (user) => user?.is_anonymous === true;

/** I testi dell'invito, per momento. Voce Unnivai: diretta, frasi brevi. */
export const INVITO = {
    fine: {
        titolo: 'Salva questo giro',
        testo: 'Lo ritrovi nel Profilo. E il prossimo parte da quello che ho capito di te oggi.',
    },
    secondo: {
        titolo: 'Il prossimo giro parte dal tuo account',
        testo: 'Quello di prova l\'hai fatto. Con l\'account ne fai altri, e il giro di oggi resta tuo.',
    },
    salva: {
        titolo: 'Per salvare serve un account',
        testo: 'Un minuto: email, codice, password. Il giro e i tuoi gusti restano.',
    },
    limite: {
        titolo: 'Parti con il tuo account',
        testo: '',
    },
};

export const TESTI_OSPITE = {
    PROVA: 'Prova un giro, senza account',
    PROVA_SOTTO: 'Un giro completo, gratis. L\'account lo crei dopo, se ti serve.',
    PROVA_CHIUSA: 'Il giro di prova non è disponibile adesso. Crea l\'account e parti.',
    EMAIL_INVIATA: (email) => `Ti ho scritto a ${email}. Dentro c'è un codice di 6 cifre.`,
    CODICE_SBAGLIATO: 'Codice sbagliato o scaduto. Fatti mandare un codice nuovo.',
    EMAIL_GIA_USATA: 'Con questa email c\'è già un account. Se entri lì, il giro di prova resta su questo telefono e non passa.',
    FATTO: 'Fatto. Il giro è nel tuo Profilo.',
    PROFILO_OSPITE: 'Giro di prova, senza account',
};

// ─── Entrare come ospite ─────────────────────────────────────────────────────

/** @returns {Promise<{ ok: true } | { ok: false, motivo: string }>} */
export async function entraComeOspite() {
    try {
        const { error } = await supabase.auth.signInAnonymously();
        if (!error) return { ok: true };
        // Accessi anonimi spenti nel pannello, tetto per IP di Supabase, rete: in tutti i casi resta la registrazione.
        console.warn('[ospite] accesso anonimo non riuscito:', error.code || error.status || 'senza codice');
        return { ok: false, motivo: TESTI_OSPITE.PROVA_CHIUSA };
    } catch (err) {
        console.warn('[ospite] accesso anonimo non riuscito:', err?.name || 'errore');
        return { ok: false, motivo: TESTI_OSPITE.PROVA_CHIUSA };
    }
}

// ─── Il giro di prova finito (sul telefono, legato all'account anonimo) ──────

const CHIAVE_GIRO = 'dvai_ospite_giro_v1';

export function giroDiProva(userId) {
    if (!userId) return null;
    try {
        const v = JSON.parse(localStorage.getItem(CHIAVE_GIRO) || 'null');
        return v && v.utente === userId ? v : null;
    } catch {
        return null;
    }
}

/** Il giro di prova è arrivato alla fine (schermata «Giro completato»). */
export function segnaGiroDiProva(userId, giroId) {
    if (!userId) return;
    try {
        localStorage.setItem(CHIAVE_GIRO, JSON.stringify({ utente: userId, giro: giroId ? String(giroId) : null, fineAt: Date.now() }));
    } catch { /* storage pieno o spento: decide il server */ }
}

/**
 * Un ospite che ha già finito il giro di prova e chiede un giro DIVERSO: si propone l'account.
 * Lo stesso giro (riaperto, ripreso) resta suo.
 */
export function secondoGiroDaOspite(user, giroId) {
    if (!isOspite(user)) return false;
    const fatto = giroDiProva(user.id);
    if (!fatto) return false;
    return !giroId || !fatto.giro || String(giroId) !== fatto.giro;
}

/** Prima di generare (Crea, Quiz, Sorprendimi): l'ospite che ha finito il giro di prova riceve l'invito, nessuna chiamata. */
export async function ospiteDaFermare() {
    try {
        const { data } = await supabase.auth.getSession();
        const user = data?.session?.user;
        return isOspite(user) && !!giroDiProva(user.id);
    } catch {
        return false;
    }
}

// ─── L'invito a registrarsi (uno solo, in App) ──────────────────────────────

export const EVENTO_REGISTRATI = 'dvai:registrati';

/** @param {'fine'|'secondo'|'salva'|'limite'} momento  @param {string} [testo] il testo del server per «limite» */
export function chiediRegistrazione(momento, testo) {
    try {
        window.dispatchEvent(new CustomEvent(EVENTO_REGISTRATI, { detail: { momento, testo: testo || null } }));
    } catch { /* fuori dal browser */ }
}

/** I codici del server che chiudono il giro di prova (openai-proxy). */
export const CODICI_OSPITE = {
    OSPITE_GIRO_USATO: 'secondo',
    OSPITE_PER_TE_USATO: null,  // Per Te resta quello di prima: nessun invito, è automatico
    OSPITE_IP_LIMITE: 'limite',
    OSPITI_LIMITE: 'limite',
};

// ─── Registrazione: email → codice → password, sullo stesso account ──────────

const ERRORI_REGISTRAZIONE = {
    email_exists: TESTI_OSPITE.EMAIL_GIA_USATA,
    user_already_exists: TESTI_OSPITE.EMAIL_GIA_USATA,
    otp_expired: TESTI_OSPITE.CODICE_SBAGLIATO,
    otp_disabled: TESTI_OSPITE.CODICE_SBAGLIATO,
    email_address_not_authorized: 'Le email non partono ancora verso questo indirizzo. Riprova più tardi.',
    manual_linking_disabled: 'La registrazione dal giro di prova non è ancora attiva. Riprova più tardi.',
};

export function erroreRegistrazione(err, ripiego) {
    if (err?.code && ERRORI_REGISTRAZIONE[err.code]) return ERRORI_REGISTRAZIONE[err.code];
    if (/token has expired|invalid.*(otp|token)/i.test(String(err?.message || ''))) return TESTI_OSPITE.CODICE_SBAGLIATO;
    if (/already.*registered|already exists|already been/i.test(String(err?.message || ''))) return TESTI_OSPITE.EMAIL_GIA_USATA;
    return ripiego(err);
}

/** Passo 1: l'email sull'account anonimo. Supabase manda il codice. */
export async function mandaCodice(email) {
    const { error } = await supabase.auth.updateUser({ email: String(email).trim() });
    return { error: error || null };
}

/** Passo 2: il codice conferma l'email, poi la password. Lo stesso id: giro e DNA restano. */
export async function confermaEPassword(email, codice, password) {
    const { error: e1 } = await supabase.auth.verifyOtp({ email: String(email).trim(), token: String(codice).trim(), type: 'email_change' });
    if (e1) return { error: e1, passo: 'codice' };
    const { data, error: e2 } = await supabase.auth.updateUser({ password });
    if (e2) return { error: e2, passo: 'password' };
    return { error: null, user: data?.user || null };
}

/** Solo la password (l'email era già confermata, ma la password scelta non andava bene). */
export async function scegliPassword(password) {
    const { error } = await supabase.auth.updateUser({ password });
    return { error: error || null };
}
