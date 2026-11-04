// LINK-DOMINIO — i link delle email di Supabase Auth (conferma, accesso, recupero password) puntano al nostro sito con
// ?token_hash=…&type=…, e a verificarli è l'app. I link vecchi di Supabase (già nelle caselle di posta) continuano a
// funzionare: tornano sul sito con la sessione nell'indirizzo e la legge il client, come prima.
// Per un link nuovo: verifyOtp, poi i due parametri escono dall'indirizzo (senza ricaricare) e la pagina è quella pulita.

// Tipi accettati: quelli che le nostre email mettono nel link ('email' per conferma e accesso, 'recovery' per la password)
// più i nomi storici di Supabase. Altro (es. email_change, che usa il codice a 6 cifre) non si tocca.
const TIPI = ['email', 'recovery', 'signup', 'magiclink', 'invite'];

// Dove finisce chi ha un link non valido o scaduto. Login.jsx mostra il messaggio.
export const DOVE_LINK_RECUPERO = '/login?recupero=1';
export const DOVE_LINK_SCADUTO = '/login?link=scaduto';

// Il link si usa una volta sola: in modalità di sviluppo React monta due volte, la seconda non deve rifare la verifica.
const inCorso = new Map();

const togliParametri = (location, history) => {
    const params = new URLSearchParams(location.search);
    params.delete('token_hash');
    params.delete('type');
    const resto = params.toString();
    history.replaceState(history.state, '', `${location.pathname}${resto ? `?${resto}` : ''}${location.hash || ''}`);
};

/**
 * Verifica il link dell'email, se l'indirizzo ne ha uno.
 * Ritorna { esito: 'nessuno' }, { esito: 'ok', tipo, user } o { esito: 'errore', tipo, dove }.
 * Se la verifica fallisce `dove` è la pagina su cui mandare l'utente (cambiare l'indirizzo senza ricaricare).
 */
export const verificaLinkEmail = (supabase, location = window.location, history = window.history) => {
    const params = new URLSearchParams(location.search);
    const tokenHash = params.get('token_hash');
    const tipo = params.get('type');
    if (!tokenHash || !TIPI.includes(tipo)) return Promise.resolve({ esito: 'nessuno' });
    if (inCorso.has(tokenHash)) return inCorso.get(tokenHash);

    const lavoro = (async () => {
        let esito;
        try {
            const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: tipo });
            esito = error || !data?.user
                ? { esito: 'errore', tipo, dove: tipo === 'recovery' ? DOVE_LINK_RECUPERO : DOVE_LINK_SCADUTO }
                : { esito: 'ok', tipo, user: data.user };
        } catch {
            esito = { esito: 'errore', tipo, dove: tipo === 'recovery' ? DOVE_LINK_RECUPERO : DOVE_LINK_SCADUTO };
        }
        togliParametri(location, history);
        if (esito.esito === 'errore') history.replaceState(history.state, '', esito.dove);
        return esito;
    })();
    inCorso.set(tokenHash, lavoro);
    return lavoro;
};
