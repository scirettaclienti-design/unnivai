-- Gate GG (16/07) — Error reporting minimo per l'ErrorBoundary.
--
-- Motivo (Ivano): la schermata "Qualcosa è andato storto" diceva "Il team
-- tecnico è stato notificato" ma nessuno riceveva niente (solo console.error).
-- Bugia rassicurante, stessa classe di "Marco R.". Due strade: cancellare la
-- frase o renderla vera. Scelto: renderla vera. Al lancio serve visibilità
-- sui crash reali (specie chunk-load post-deploy che orfanano sessioni aperte).
--
-- Design:
--  - Insert PUBLIC (anche anon/guest): un crash deve essere loggato SEMPRE,
--    anche se l'utente non è autenticato (spesso è proprio il flow signup a
--    rompersi). Rate limit lato client via reportError (dedup su hash message
--    entro N minuti).
--  - Select SOLO service_role: la tabella è per noi, non per gli utenti.
--    RLS default deny per authenticated/anon → nessuno legge crash altrui.
--  - Cleanup periodico: righe piu' vecchie di 30 giorni via cron (fuori dal
--    perimetro del lancio). La tabella non deve crescere infinita.
--  - error_type: categoria discreta ('chunk_load' | 'generic' | 'network' |
--    ecc), utile per aggregazioni.
--  - Payload compatto: message + stack + url + user_agent + userId + timestamp.

CREATE TABLE IF NOT EXISTS public.error_logs (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    error_type TEXT NOT NULL DEFAULT 'generic',
    message TEXT NOT NULL,
    stack TEXT,
    url TEXT,
    user_agent TEXT,
    -- Extra libero per contesto (chunk name, retry count, componente):
    context JSONB
);

-- Index sull'ordinamento temporale per dashboard di analisi.
CREATE INDEX IF NOT EXISTS idx_error_logs_created_at
    ON public.error_logs (created_at DESC);

-- Index sul tipo per aggregazioni ("quanti chunk_load ieri?").
CREATE INDEX IF NOT EXISTS idx_error_logs_error_type
    ON public.error_logs (error_type);

ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

-- INSERT public: chiunque (anon incluso) puo' loggare un crash. Necessario
-- perche' spesso e' il flow di signup/login che rompe, quando l'utente non
-- ha ancora sessione. Il codice client-side dedupa via hash per evitare spam
-- (vedi src/lib/errorReporting.js).
DROP POLICY IF EXISTS error_logs_public_insert ON public.error_logs;
CREATE POLICY error_logs_public_insert
    ON public.error_logs
    FOR INSERT
    WITH CHECK (true);

-- SELECT/UPDATE/DELETE solo service_role. Gli utenti NON leggono crash
-- altrui, e nessuno modifica/cancella righe salvo cleanup periodico
-- (che gira con service_role via cron Supabase o SQL manuale).
DROP POLICY IF EXISTS error_logs_service_manage ON public.error_logs;
CREATE POLICY error_logs_service_manage
    ON public.error_logs
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- Cleanup manuale (non schedulato in questa migration; da schedulare in
-- Supabase Cron dopo il lancio se il volume cresce):
--   DELETE FROM public.error_logs WHERE created_at < NOW() - INTERVAL '30 days';
