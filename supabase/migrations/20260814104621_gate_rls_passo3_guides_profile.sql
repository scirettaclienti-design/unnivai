-- ============================================================================
-- GATE SICUREZZA RLS — PASSO 3: guides_profile
-- Data: 2026-08-14
--
-- Stato pre-gate (misurato con la anon key, senza sessione):
--   RLS gia' ATTIVA, ma con DUE policy SELECT USING (true) sovrapposte
--   ("Enable read access for all" e "Guide profiles are viewable by everyone").
--   Essendo PERMISSIVE si sommano: rimuoverne una sola non cambia nulla.
--   Effetto: GET /rest/v1/guides_profile?select=piva,license_number rispondeva
--   HTTP 200 con i dati a chiunque possieda la anon key, che e' pubblica nel
--   bundle. Le scritture erano gia' chiuse (richiedono auth.uid() non nullo):
--   l'esposizione era in sola lettura.
--
-- Colonne riservate che erano leggibili: license_number, piva,
--   license_file_url, insurance_file_url, commission_rate.
--   commission_rate e' l'unica valorizzata oggi (20). Le altre sono vuote/NULL
--   SOLO perche' nessuno ha ancora compilato il form di accreditamento, che e'
--   vivo e raggiungibile (DashboardGuide.jsx:475 -> :201-203). Il giorno in cui
--   una guida vera lo compila, la sua PIVA diventa pubblica nello stesso
--   istante e senza nessun altro segnale.
--
-- Terza policy rimossa: "Enable all access for users" era FOR ALL con chiave
--   `id`, mentre INSERT/UPDATE own usano `user_id`. Due chiavi diverse sulla
--   stessa tabella: oggi combaciano per coincidenza (nell'unica riga
--   id = user_id), ma `id` e' NOT NULL SENZA DEFAULT, quindi nulla garantisce
--   che continuino a coincidere. INSERT e UPDATE own restano coperte dalle
--   policy #4 e #5, che usano la chiave giusta. Nessuna query dell'app
--   cancella righe da guides_profile, quindi la DELETE che quella policy
--   copriva non serve a nessuno.
--
-- PERCHE' NON CREIAMO LA VISTA PUBBLICA ORA:
--   La diagnosi ha misurato che NON esiste un solo consumatore pubblico di
--   questa tabella. Tutti i lettori nel codice filtrano sulla propria riga
--   (DashboardGuide.jsx:68, 75, 208, 735, 758 — tutti .eq('user_id', user.id)).
--   L'unico altro accesso e' get_nearby_requests_for_guide(), SECURITY DEFINER,
--   che bypassa RLS comunque. Le due USING (true) erano un permesso concesso a
--   un consumatore mai scritto.
--   Costruire ora una vista `public_guides` significherebbe progettare
--   l'interfaccia di una vetrina che non esiste e indovinare quali colonne
--   servira' esporre. La vetrina va progettata quando il codice che la consuma
--   esiste — insieme al fix del nome guida in TourDetails.jsx:585, oggi rotto
--   (chiede profiles.username e profiles.bio, colonne che non esistono).
--   Un gate solo, con il consumatore davanti agli occhi.
--
-- ROLLBACK: NON e' un DISABLE. Spegnere RLS qui peggiorerebbe lo stato
--   (da "lettura pubblica di troppe colonne" a "scrittura libera per
--   chiunque"). Il rollback e' la ricreazione delle policy rimosse —
--   vedi supabase/GATE_RLS_ROLLBACK.sql.
-- ============================================================================

-- Le due letture pubbliche sovrapposte.
DROP POLICY "Enable read access for all"              ON public.guides_profile;
DROP POLICY "Guide profiles are viewable by everyone" ON public.guides_profile;

-- La policy ALL con la chiave sbagliata.
DROP POLICY "Enable all access for users"             ON public.guides_profile;

-- La guida legge la propria riga, per intero (DashboardGuide.jsx:68 usa select('*')).
CREATE POLICY "guides_profile_select_own"
    ON public.guides_profile
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Restano invariate, chiave corretta:
--   "Guides can insert own profile"  INSERT  WITH CHECK (auth.uid() = user_id)
--   "Guides can update own profile"  UPDATE  USING      (auth.uid() = user_id)
