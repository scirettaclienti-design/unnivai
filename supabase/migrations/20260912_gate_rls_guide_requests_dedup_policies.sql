-- =============================================================================
-- Gate RLS — guide_requests: una sola policy per operazione, tutte owner-only
-- =============================================================================
--
-- Terzo passo sullo stesso perimetro dei due gate del 04/09
-- (20260904_gate_rls_guide_requests_owner_only.sql,
--  20260904_gate_rls_guide_requests_insert_update.sql). I primi due avevano
-- chiuso i buchi di sicurezza reali (SELECT troppo larga, INSERT senza
-- controllo, UPDATE self-assign pubblico). Nessun buco nuovo qui: questa
-- migration NON cambia cosa un utente puo' fare. Chiude una fragilita'
-- diversa — la ridondanza lasciata indietro dai due gate precedenti.
--
-- STATO MISURATO IL 12/09/2026 su pg_policies (produzione, non dedotto dalle
-- migration):
--
--   SELECT (1 policy)   guide_requests_select_owner_only   authenticated
--                        USING (auth.uid() = user_id)                    <- corretta, invariata
--
--   INSERT (4 policy, TUTTE con lo stesso WITH CHECK)
--     "Users can create requests"        authenticated  (auth.uid() = user_id)
--     "Users can insert guide requests"  public          (auth.uid() = user_id)
--     "Users can insert requests"        authenticated  (auth.uid() = user_id)
--     "Users insert own requests"        public          (auth.uid() = user_id)
--
--   UPDATE (1 policy)   "Users update own requests"   public
--                        USING (auth.uid() = user_id), WITH CHECK assente
--
--   DELETE (1 policy)   "Users delete own requests"   public
--                        USING (auth.uid() = user_id)
--
-- PERCHE'. Quattro regole INSERT identiche non sono piu' sicure di una, sono
-- piu' fragili: il giorno che qualcuno ne modifica una convinta che sia
-- l'unica, le altre tre restano valide alle sue spalle — sono PERMISSIVE, si
-- combinano in OR, e la storia di questa stessa tabella (vedi
-- 20260904_gate_rls_guide_requests_insert_update.sql, BUCO 1) mostra che e'
-- gia' successo una volta: una delle quattro era silenziosamente scivolata a
-- `WITH CHECK (true)` senza che le altre tre lo segnalassero in nessun modo.
-- Oggi le quattro sono identiche e non sfruttabile — e' esattamente il
-- terreno su cui quel buco e' nato.
--
-- COSA FA QUESTA MIGRATION.
--   1. Una sola policy INSERT, ruolo authenticated, nome coerente con la
--      SELECT gia' esistente: guide_requests_insert_owner_only.
--   2. UPDATE e DELETE allineate a ruolo authenticated (erano public — il
--      comportamento non cambia: un utente anonimo ha auth.uid() NULL, il
--      confronto era gia' sempre falso; ora l'intenzione e' esplicita nel
--      ruolo, non solo nel predicato) e ai nomi
--      guide_requests_update_owner_only / guide_requests_delete_owner_only.
--   3. UPDATE riceve un WITH CHECK esplicito, identico allo USING: senza,
--      una riga propria si poteva aggiornare per riassegnarne lo user_id a
--      un altro utente (RLS valuta USING sulla riga PRIMA della modifica,
--      non dopo — un WITH CHECK e' l'unico modo per vincolare anche il
--      risultato).
--   4. Le quattro INSERT vecchie e le due UPDATE/DELETE vecchie vengono
--      droppate SOLO DOPO che le tre nuove sono gia' create, nella stessa
--      transazione: in nessun istante la tabella resta priva di una via di
--      scrittura per il proprietario.
--
-- PERIMETRO — invariati di proposito: SELECT (gia' corretta), colonne,
-- vincoli, dati, tutto il codice applicativo. Nessuna delle quattro INSERT
-- aveva un WITH CHECK diverso dalle altre (verificato su pg_policies prima
-- di scrivere questa migration): se fosse stato cosi', la migration non
-- sarebbe stata scritta.
-- =============================================================================

BEGIN;

-- 1) INSERT — una sola policy al posto di quattro identiche.
CREATE POLICY "guide_requests_insert_owner_only"
    ON public.guide_requests
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- 2) UPDATE — ruolo esplicito authenticated, e WITH CHECK oltre a USING:
--    non basta possedere la riga PRIMA dell'update, deve restare propria
--    anche DOPO.
CREATE POLICY "guide_requests_update_owner_only"
    ON public.guide_requests
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 3) DELETE — stesso allineamento, nessun WITH CHECK (DELETE non ne prevede:
--    non c'e' una riga "dopo").
CREATE POLICY "guide_requests_delete_owner_only"
    ON public.guide_requests
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- 4) Solo ORA, con le tre nuove gia' al loro posto, via le vecchie.
DROP POLICY IF EXISTS "Users can create requests"       ON public.guide_requests;
DROP POLICY IF EXISTS "Users can insert guide requests" ON public.guide_requests;
DROP POLICY IF EXISTS "Users can insert requests"       ON public.guide_requests;
DROP POLICY IF EXISTS "Users insert own requests"       ON public.guide_requests;
DROP POLICY IF EXISTS "Users update own requests"       ON public.guide_requests;
DROP POLICY IF EXISTS "Users delete own requests"       ON public.guide_requests;

-- RLS resta attiva (era gia' true; esplicitato per non dipendere da uno
-- stato implicito, stesso pattern dei due gate precedenti).
ALTER TABLE public.guide_requests ENABLE ROW LEVEL SECURITY;

COMMIT;
