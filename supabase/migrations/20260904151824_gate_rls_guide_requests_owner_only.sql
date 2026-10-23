-- =============================================================================
-- Gate RLS — guide_requests: SELECT ristretto al solo proprietario
-- =============================================================================
--
-- PERCHE'. Misurato il 04/09/2026 con la sola chiave anon (quella che viaggia
-- nel bundle client, quindi pubblica), SENZA autenticazione:
--
--   GET /rest/v1/guide_requests?select=id,user_name,city,status,request_text
--   -> 200, righe reali
--
-- Tornavano nome e cognome veri, il testo libero delle richieste e — su una
-- riga — numero di telefono, email, handle Instagram e link WhatsApp in
-- chiaro. PII di persone reali, leggibile da chiunque avesse la chiave anon.
--
-- COME ACCADEVA. Tre policy SELECT, tutte PERMISSIVE: i loro USING si
-- combinano in OR, quindi valeva sempre la piu' larga.
--
--   1. "Users read own requests"        ruolo public
--      (auth.uid() = user_id) OR (status = 'open')
--      -> bastava status='open' per aprire la riga a chiunque.
--
--   2. "Guides view own and open requests"  ruolo public
--      (auth.uid() = user_id) OR (guide_id = auth.uid()) OR (guide_id IS NULL)
--      -> bastava guide_id NULL per aprire la riga a chiunque.
--
--   3. "Guides see local requests"      ruolo authenticated
--      city = (SELECT city FROM profiles WHERE id = auth.uid())
--      -> qualunque utente autenticato leggeva le richieste altrui della
--         propria citta'.
--
-- Il ruolo `public` include `anon`: le prime due erano aperte anche a un
-- visitatore non autenticato. Nessuna delle tre verificava un ruolo 'guide':
-- il nome "Guides..." descriveva un'intenzione che il predicato non
-- implementava.
--
-- Il filtro .eq('user_id', userId) in Profile.jsx sta LATO CLIENT: nascondeva
-- le richieste altrui nell'interfaccia, non nei dati.
--
-- COSA FA QUESTA MIGRATION. Elimina tutte e tre e le sostituisce con una sola
-- regola: si legge la propria riga, e basta. Con `auth.uid()` NULL (anon) il
-- confronto e' NULL, quindi non e' TRUE, quindi zero righe: la chiusura vale
-- anche senza affidarsi al solo `TO authenticated`.
--
-- PERIMETRO — cosa NON tocca, di proposito:
--   * INSERT: nessuna policy rimossa. La creazione della richiesta continua a
--     funzionare esattamente come prima.
--   * UPDATE / DELETE: fuori mandato, restano invariate.
--   * Colonne, vincoli, dati: invariati.
--
-- CONSEGUENZA DA SAPERE. Con SELECT owner-only, una guida NON vede piu' le
-- richieste "a pioggia" (guide_id NULL) ne' quelle assegnate a lei: la lista
-- di DashboardGuide.jsx resta vuota. In V1 il sistema guide e' spento
-- (GUIDE_TOURS_ENABLED=false), quindi oggi non toglie nulla che sia vivo. Il
-- giorno che le guide tornano, la lettura lato guida va riaperta con una
-- policy DEDICATA che verifichi davvero il ruolo — non riallargando questa.
-- =============================================================================

-- 1) Via le tre policy SELECT troppo larghe.
DROP POLICY IF EXISTS "Users read own requests"           ON public.guide_requests;
DROP POLICY IF EXISTS "Guides view own and open requests" ON public.guide_requests;
DROP POLICY IF EXISTS "Guides see local requests"         ON public.guide_requests;

-- 2) Una sola regola di lettura: il proprietario, sulla propria riga.
CREATE POLICY "guide_requests_select_owner_only"
    ON public.guide_requests
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- 3) RLS resta attiva (era gia' true; esplicitato per non dipendere da uno
--    stato implicito).
ALTER TABLE public.guide_requests ENABLE ROW LEVEL SECURITY;
