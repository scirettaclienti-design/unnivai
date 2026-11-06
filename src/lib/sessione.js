/**
 * LOGIN-SESSIONE (T26) — la sessione resta finché non premi «Esci».
 *
 * Il client di Supabase tiene la sessione in localStorage (`sb-<progetto>-auth-token`, persistSession e autoRefreshToken
 * di difetto) e rinnova da solo il token d'accesso (1 ora) col token di rinnovo. Qui i tre punti dove l'app la perdeva
 * o sembrava perderla:
 *  1. «Esci» chiudeva la sessione su TUTTI i telefoni (signOut di difetto è `global`): `SCOPE_ESCI = 'local'` chiude
 *     solo questo.
 *  2. All'apertura, se la lettura della sessione fallisce o resta appesa (rete assente, blocco del browser sullo
 *     storage), l'app non è «fuori»: si legge la sessione salvata sul telefono e si resta dentro; se il server la
 *     rifiutasse davvero, ci pensa l'evento di uscita (AuthContext) a portare al login.
 *  3. Chiede al browser di tenere la memoria del sito (`navigator.storage.persist()`): dove il browser lo concede
 *     (Chrome, Firefox, app dalla Home) non la butta via quando il telefono ha poco spazio.
 */

/** Esci = solo questo telefono. Gli altri restano dentro. */
export const SCOPE_ESCI = 'local';

/** Quanto si aspetta la lettura della sessione prima di usare quella salvata sul telefono. */
export const ATTESA_SESSIONE_MS = 8000;

/** La sessione salvata da Supabase sul telefono (utente + token di rinnovo), o null. Non fa chiamate di rete. */
export function sessioneSalvata(storage) {
    try {
        const s = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
        if (!s) return null;
        for (let i = 0; i < s.length; i++) {
            const k = s.key(i);
            if (!k || !/^sb-.+-auth-token$/.test(k)) continue;
            const v = JSON.parse(s.getItem(k) || 'null');
            if (v?.user?.id && v?.refresh_token) return v;
        }
    } catch { /* storage non leggibile o JSON rovinato: come se non ci fosse */ }
    return null;
}

const SCADUTO = Symbol('scaduto');

/**
 * Legge la sessione all'apertura dell'app. `daMemoria: true` = non l'ha confermata il server (rete, blocco): l'app resta
 * dentro con quella salvata e Supabase continua a rinnovarla in background.
 * @returns {Promise<{ session: object|null, daMemoria: boolean }>}
 */
export async function leggiSessioneAlAvvio(supabase, { attesaMs = ATTESA_SESSIONE_MS, storage } = {}) {
    const leggi = async () => {
        try {
            const { data, error } = await supabase.auth.getSession();
            return { session: data?.session ?? null, error: error ?? null };
        } catch (error) {
            return { session: null, error };
        }
    };
    let timer;
    const tempo = new Promise((ok) => { timer = setTimeout(() => ok(SCADUTO), attesaMs); });
    let esito = await Promise.race([leggi(), tempo]);
    clearTimeout(timer);

    if (esito !== SCADUTO && esito.session?.user) return { session: esito.session, daMemoria: false };
    if (esito !== SCADUTO && !esito.error) return { session: null, daMemoria: false }; // nessuna sessione: ospite o fuori

    // Errore o attesa troppo lunga: un solo nuovo tentativo, poi la sessione salvata.
    if (esito !== SCADUTO) {
        await new Promise((ok) => setTimeout(ok, 400));
        esito = await Promise.race([leggi(), new Promise((ok) => setTimeout(() => ok(SCADUTO), Math.min(attesaMs, 3000)))]);
        if (esito !== SCADUTO && esito.session?.user) return { session: esito.session, daMemoria: false };
    }
    const salvata = sessioneSalvata(storage);
    return salvata ? { session: salvata, daMemoria: true } : { session: null, daMemoria: false };
}

/** Chiede al browser di non cancellare la memoria del sito. Silenzioso: dove non c'è o non lo concede, non cambia niente. */
export async function chiediMemoriaStabile(nav = typeof navigator !== 'undefined' ? navigator : null) {
    try {
        const st = nav?.storage;
        if (!st?.persist) return false;
        if (st.persisted && (await st.persisted())) return true;
        return !!(await st.persist());
    } catch { return false; }
}
