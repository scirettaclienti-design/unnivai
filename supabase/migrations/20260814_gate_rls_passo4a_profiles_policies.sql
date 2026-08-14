-- ============================================================================
-- GATE SICUREZZA RLS — PASSO 4a: policy su profiles, con RLS ANCORA SPENTA
-- Data: 2026-08-14
--
-- Una policy su una tabella con RLS OFF non ha alcun effetto: questo passo
-- e' inerte per costruzione. Serve a separare "scrivere le regole" da
-- "accenderle", cosi' l'unico momento rischioso (4b) e' un solo comando
-- reversibile con un solo comando.
--
-- Precondizioni verificate PRIMA di scrivere queste policy:
--   - profiles NON ha un trigger set_updated_at (l'unico trigger e'
--     protect_profile_is_unlimited, BEFORE UPDATE, che non tocca updated_at).
--     Quindi il difetto che rompe ogni UPDATE su guides_profile ed explorers
--     qui NON esiste.
--   - BASELINE pre-RLS misurata: l'UPDATE di current_city_override da parte
--     del proprietario funziona OGGI (1 riga aggiornata). Se dopo l'ENABLE
--     smettesse di funzionare, la causa sarebbe l'RLS e nient'altro.
--   - protect_profile_is_unlimited funziona: un client autenticato che prova
--     a mettersi is_unlimited=true si vede ripristinare false; con il claim
--     JWT role=service_role l'assegnazione passa. La UPDATE own qui sotto
--     NON apre una scalata di privilegi su quel campo.
-- ============================================================================

-- Lettura della propria riga.
-- Serve a: aiRecommendationService.js:322 e :359 (is_unlimited),
--          userContextService.js:260 (current_city_override).
CREATE POLICY "profiles_select_own"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (auth.uid() = id);

-- Scrittura della propria riga.
-- Serve a: userContextService.js:251 (current_city_override).
-- WITH CHECK oltre a USING: impedisce di "spostare" la riga a un altro id.
CREATE POLICY "profiles_update_own"
    ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Creazione della propria riga.
-- NON serve oggi: la riga la crea il trigger handle_new_user (SECURITY
-- DEFINER) al signup. Serve appena il Gate PERSISTENZA riparera' l'upsert di
-- Onboarding.jsx:98 — PostgREST valuta il tentativo di INSERT prima del
-- DO UPDATE on conflict, quindi senza questa policy l'upsert fallirebbe per
-- un motivo nuovo appena le colonne esisteranno.
CREATE POLICY "profiles_insert_own"
    ON public.profiles
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- Lettura incrociata guida -> richiedente.
--
-- E' l'UNICA lettura cross-user di profiles che oggi funziona davvero in
-- produzione (DashboardGuide.jsx:144 e :430, embed
-- author:profiles!guide_requests_user_id_profiles_fk). Senza questa policy la
-- guida vedrebbe le richieste senza il nome di chi le ha scritte, perche' il
-- fallback guide_requests.user_name e' NULL nei dati reali.
--
-- COSA ESPONE, ESPLICITAMENTE:
--   Espone la RIGA INTERA del profilo di un richiedente — quindi non solo
--   first_name/last_name/image_urls che servono alla dashboard, ma anche
--   city, preferred_city, current_city_override, address, website,
--   instagram_handle, description, ai_metadata, is_unlimited, role.
--   RLS e' row-level: non sa restringere le colonne. Per restringerle
--   servirebbe una vista, e la vista richiede di toccare il codice.
--
-- A CHI:
--   (1) guide_id = auth.uid()  -> alla guida a cui la richiesta e' indirizzata.
--   (2) guide_id IS NULL       -> le richieste "a pioggia" non hanno un
--       destinatario, quindi la riga del richiedente diventa leggibile da
--       OGNI utente che superi il secondo EXISTS.
--
-- IL SECONDO EXISTS — correzione rispetto a come il caso e' stato descritto:
--   senza di esso "a pioggia" non significa "visibile a qualunque guida" ma
--   "visibile a QUALUNQUE UTENTE AUTENTICATO", perche' nulla nella prima
--   condizione verifica che il lettore sia una guida. Il secondo EXISTS
--   richiede che il lettore abbia una riga in guides_profile, riportando il
--   perimetro a quello inteso.
--
--   Costo del secondo EXISTS: accoppia questa policy a guides_profile. Una
--   guida senza riga in guides_profile non vedrebbe alcun nome. Oggi non
--   peggiora nulla — l'auto-creazione della riga guida e' gia' rotta
--   (DashboardGuide.jsx:75, errore 428C9: user_id e' GENERATED ALWAYS AS (id)
--   e non e' scrivibile), quindi una guida senza riga non riesce comunque a
--   caricare la dashboard. Da rivedere quando il Gate V2 riparera' quel path.
--
-- NON copre: il nome della guida in TourDetails.jsx:585, che e' rotto per
--   conto suo (chiede profiles.username e profiles.bio, colonne inesistenti).
-- ---------------------------------------------------------------------------
CREATE POLICY "profiles_select_guide_on_request"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.guide_requests gr
            WHERE gr.user_id = profiles.id
              AND (gr.guide_id = auth.uid() OR gr.guide_id IS NULL)
        )
        AND EXISTS (
            SELECT 1
            FROM public.guides_profile gp
            WHERE gp.user_id = auth.uid()
        )
    );

-- Nessuna policy DELETE: nessuna query dell'app cancella profili.
-- L'assenza di policy e' la scelta, non una dimenticanza.

-- RLS NON viene abilitata qui. Vedi 20260814_gate_rls_passo4b_profiles_enable.sql
