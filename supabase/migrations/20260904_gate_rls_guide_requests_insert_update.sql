-- =============================================================================
-- Gate RLS — guide_requests: chiude INSERT falsificabile e UPDATE self-assign
-- =============================================================================
--
-- Secondo e ultimo passo sullo stesso perimetro del gate
-- 20260904_gate_rls_guide_requests_owner_only.sql, che aveva chiuso il SELECT.
-- Quel gate aveva lasciato in piedi due buchi, dichiarati e non toccati perche'
-- fuori dal suo mandato. Questa migration li chiude.
--
-- -----------------------------------------------------------------------------
-- BUCO 1 — INSERT a nome di un altro utente
-- -----------------------------------------------------------------------------
-- Su guide_requests esistono QUATTRO policy INSERT, tutte PERMISSIVE: i loro
-- WITH CHECK si combinano in OR, quindi vale la piu' permissiva. Tre erano
-- corrette (auth.uid() = user_id); la quarta, "Users can insert requests",
-- aveva:
--
--     WITH CHECK (true)
--
-- Cioe' nessun controllo: un utente autenticato poteva inserire una richiesta
-- con QUALUNQUE `user_id`, fabbricandola a nome di un'altra persona. E poiche'
-- il SELECT e' owner-only, la vittima se la sarebbe trovata nel proprio
-- Profilo sotto "Richieste Attive" senza averla mai scritta.
--
-- Qui la si allinea alle altre tre. Non si rimuove nessuna via di creazione:
-- dopo questa migration restano quattro policy INSERT, tutte con lo stesso
-- check corretto, e `createGuideRequest` continua a funzionare identica.
--
-- -----------------------------------------------------------------------------
-- BUCO 2 — UPDATE pubblico con self-assign su guide_id
-- -----------------------------------------------------------------------------
-- "Guides can update guide requests", ruolo `public`, aveva:
--
--     USING (auth.uid() = guide_id OR (guide_id IS NULL AND auth.uid() IS NOT NULL))
--
-- Il secondo ramo apre qualunque richiesta non ancora assegnata a QUALUNQUE
-- utente autenticato: bastava scriversi dentro `guide_id` per diventare la
-- guida di una richiesta altrui, e da li' leggere il testo (che puo' contenere
-- contatti personali) e ricevere i messaggi della chat.
--
-- Come le vecchie policy SELECT, il nome dice "Guides" ma il predicato non
-- verifica nessun ruolo: descrive un'intenzione che non implementa. Oggi un
-- ruolo guida autenticato e verificabile NON esiste (GUIDE_TOURS_ENABLED=false,
-- un solo profilo con role='guide' nel DB), quindi non c'e' modo di scrivere
-- una versione ristretta che sia vera. Si chiude.
--
-- -----------------------------------------------------------------------------
-- VERIFICA FATTA PRIMA DI DROPPARE — la tabella non resta senza UPDATE
-- -----------------------------------------------------------------------------
-- Cercati tutti gli UPDATE su guide_requests nel codice applicativo. Sono
-- quattro, TUTTI lato guida, tutti in DashboardGuide.jsx:
--   :277  update({status:'accepted', guide_id: user.id})   accetta
--   :305  update({status:'declined'})                      rifiuta
--   :326  update({guide_id: user.id})                      offerta di prezzo
--   :386  update({guide_id: user.id})                      apertura chat
-- Nessun UPDATE lato owner: Profile.jsx legge soltanto, dataService only insert.
--
-- Resta in piedi "Users update own requests" (USING auth.uid() = user_id), che
-- da' al proprietario una via di UPDATE sulla propria riga — non usata oggi dal
-- prodotto, ma disponibile per un futuro "annulla la mia richiesta" senza
-- bisogno di un'altra migration.
--
-- CONSEGUENZA. DashboardGuide non puo' piu' accettare/rifiutare/assegnarsi una
-- richiesta. E' coerente col gate precedente, che gia' impediva alla guida di
-- VEDERLE: senza SELECT quelle UPDATE erano comunque inerti. Quando le guide
-- torneranno, servira' una policy dedicata che verifichi davvero il ruolo
-- (es. EXISTS su profiles.role='guide' / guides_profile), non il ripristino
-- di questa.
--
-- PERIMETRO — invariati di proposito: SELECT (gia' corretto dal gate
-- precedente), DELETE, colonne, vincoli, dati, e tutto il codice applicativo.
-- =============================================================================

-- 1) INSERT: allinea l'unica policy senza controllo alle altre tre.
DROP POLICY IF EXISTS "Users can insert requests" ON public.guide_requests;

CREATE POLICY "Users can insert requests"
    ON public.guide_requests
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- 2) UPDATE: via il self-assign pubblico su guide_id.
DROP POLICY IF EXISTS "Guides can update guide requests" ON public.guide_requests;

-- 3) RLS resta attiva (esplicitato per non dipendere da uno stato implicito).
ALTER TABLE public.guide_requests ENABLE ROW LEVEL SECURITY;
