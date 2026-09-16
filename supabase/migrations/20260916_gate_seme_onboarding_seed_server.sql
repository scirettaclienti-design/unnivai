-- =============================================================================
-- Gate SEME (L2) — il seme onboarding diventa un dato del server
-- =============================================================================
--
-- PERCHE'. Misurato il 16/09/2026 su information_schema.columns (produzione,
-- non dedotto dal codice): quello che l'utente dichiara nell'onboarding non
-- veniva salvato da nessuna parte se non nel localStorage del device.
--
--   src/pages/Onboarding.jsx:69-92 (prima di questo gate) faceva
--     supabase.from('profiles').upsert({ id, interests, onboarding_complete, ... })
--
--   Colonne REALI di public.profiles al 16/09/2026:
--     id, role, first_name, last_name, city, created_at, preferred_city,
--     current_city_override, description, address, website, instagram_handle,
--     menu_url, image_urls, ai_metadata, is_unlimited
--
--   `interests` NON esiste. `onboarding_complete` NON esiste. L'upsert
--   falliva SEMPRE, PGRST204 (column not found), e l'errore finiva in un
--   `catch` che faceva solo console.warn. Subito dopo il codice chiamava
--   navigate('/dashboard-user') comunque: l'app si comportava come se avesse
--   salvato. E' la terza volta che questo repo paga il pattern "colonna
--   documentata e mai creata + catch silenzioso" (vedi la nota su
--   avatar_url/full_name in CLAUDE.md, e l'embed profiles di Explore.jsx).
--
--   Il seme viveva quindi SOLO in localStorage['unnivai_onboarding_seed_v1'],
--   che AuthContext.jsx:85 cancella di proposito al logout (chiave
--   user-derived, Gate S.3: se sopravvive, il prossimo utente sullo stesso
--   device eredita i gusti del precedente). Risultato netto: il seme moriva
--   al primo logout e non esisteva su un secondo device. Non e' un dettaglio:
--   computeWeights() pesa il seme +0.3 per categoria contro +0.05 per singola
--   interazione comportamentale — e' la meta' forte del DNA dell'utente.
--
-- PERCHE' QUI E NON ALTROVE.
--   - NON su profiles: e' esattamente la tabella la cui storia di colonne
--     documentate e mai create ha causato questo bug. Riaprirla sarebbe
--     ripetere la causa.
--   - NON dentro user_preferences.preference_data: violerebbe la regola locked
--     del Gate DNA (commentata in src/hooks/useAILearning.js:10-15) — "il seme
--     NON entra MAI nel preferenceGraph, e' un input SEPARATO". Il grafo
--     contiene solo gusti misurati dal comportamento vero; il seme e' una
--     dichiarazione. Tenerli separati a livello di schema, e non solo per
--     convenzione applicativa, e' l'unico modo perche' la regola sopravviva a
--     chi non legge il commento.
--   - SI' su user_preferences, colonna propria: e' gia' la tabella del profilo
--     di preferenze, una riga per utente (indice unico su user_id), con RLS
--     gia' corrette e proprietarie, verificate il 16/09/2026 su pg_policies:
--       SELECT  USING (auth.uid() = user_id)
--       INSERT  WITH CHECK (auth.uid() = user_id)
--       UPDATE  USING (auth.uid() = user_id)
--     Le policy RLS sono per RIGA, non per colonna: la colonna nuova eredita
--     la protezione esistente. Nessuna RLS nuova da scrivere, e nessuna
--     modifica a quelle esistenti — se ne servisse una, questa migration non
--     sarebbe stata scritta cosi'.
--
-- COSA FA QUESTA MIGRATION. Una sola cosa: aggiunge la colonna.
--
--   onboarding_seed jsonb, NULLABLE, SENZA default. La nullabilita' porta
--   informazione e va preservata — e' la stessa distinzione a tre stati che
--   il codice fa gia' oggi in locale sulla chiave localStorage:
--     NULL  -> onboarding mai fatto, o mai sincronizzato con questo server
--     []    -> onboarding fatto e saltato di proposito ("Salta per ora")
--     [...] -> gusti dichiarati
--   Un DEFAULT '[]' cancellerebbe la differenza fra i primi due casi su ogni
--   riga preesistente, facendo sembrare "skip esplicito" quello che e' solo
--   "mai chiesto". Per questo niente default e niente backfill: le righe
--   esistenti restano NULL, che e' la verita' su di loro.
--
-- PERIMETRO — invariati di proposito: le tre policy RLS, l'indice unico su
-- user_id, il trigger user_preferences_updated_at, le colonne esistenti
-- (preference_data, interactions, total_interactions) e ogni riga gia'
-- presente. Nessuna riga viene riscritta. Nulla su public.profiles viene
-- toccato, in nessuna forma: in particolare `onboarding_complete` NON viene
-- resuscitato da nessuna parte — era write-only, mai letto da nessun punto
-- del repo (grep esaustivo il 16/09/2026). Il flag di FLUSSO "mostra
-- l'onboarding si'/no" resta localStorage['dvai_onboarding_done']
-- (src/App.jsx:96): e' uno stato di navigazione locale, non un dato
-- dell'utente, e resta fuori da questo perimetro.
-- =============================================================================

BEGIN;

ALTER TABLE public.user_preferences
    ADD COLUMN IF NOT EXISTS onboarding_seed jsonb;

COMMENT ON COLUMN public.user_preferences.onboarding_seed IS
    'Gate SEME (L2). Gusti dichiarati dall''utente nell''onboarding, array JSON '
    'di id CORE normalizzati (es. ["cultura","arte"]). Input SEPARATO dal '
    'preference_data: il seme non entra MAI nel preferenceGraph (regola locked '
    'Gate DNA). NULL = mai fatto/mai sincronizzato, [] = skip esplicito.';

COMMIT;
