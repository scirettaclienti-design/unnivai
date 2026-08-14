-- ============================================================================
-- GATE SICUREZZA RLS — PASSO 2: bookings
-- Data: 2026-08-14
--
-- Stato pre-gate (misurato):
--   RLS OFF, 0 policy, 0 righe. anon/authenticated hanno tutti i grant DML.
--
-- Perche' ADESSO e' il momento giusto:
--   La tabella e' vuota e la feature e' gia' rotta a monte — `bookings` non
--   ha le colonne che il codice ci scrive (booking_date, booking_time,
--   guests_count, total_amount in dataService.js:253; stripe_session_id in
--   create-checkout/index.ts:112). Mettere il permesso corretto ora costa
--   zero rischio: quando il gate booking riparera' le colonne, la sicurezza
--   sara' gia' a posto e non ci sara' una seconda decisione da prendere
--   sotto pressione.
--
-- Ruolo TO authenticated (non `public`): anon non ha `auth.uid()`, quindi
--   con `public` le policy sarebbero comunque vuote per lui — ma dichiararlo
--   rende la regola leggibile invece che dedotta.
--
-- Nessuna UPDATE, nessuna DELETE dal client: lo stato del booking lo scrive
--   lo Stripe webhook in service_role (stripe-webhook/index.ts:106), che
--   bypassa RLS. Dare UPDATE al client significherebbe lasciargli scrivere
--   `status = 'paid'` da solo.
-- ============================================================================

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- L'utente vede le proprie prenotazioni.
CREATE POLICY "bookings_select_own"
    ON public.bookings
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- La guida vede le prenotazioni sui propri tour (getPendingBookingsForGuide,
-- dataService.js:574). La sottoquery su `tours` gira con i permessi del
-- chiamante: `tours` ha SELECT pubblico, quindi non introduce un secondo buco.
CREATE POLICY "bookings_select_guide"
    ON public.bookings
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.tours t
            WHERE t.id = bookings.tour_id
              AND t.guide_id = auth.uid()
        )
    );

-- L'utente crea prenotazioni solo a proprio nome (dataService.js:251).
CREATE POLICY "bookings_insert_own"
    ON public.bookings
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Rollback: supabase/GATE_RLS_ROLLBACK.sql
