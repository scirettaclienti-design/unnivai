-- ============================================================================
-- GATE SICUREZZA RLS — PASSO 1: guides
-- Data: 2026-08-14
--
-- Stato pre-gate (misurato, non dedotto):
--   RLS OFF, 0 policy, 0 righe, 0 riferimenti in tutto il codice applicativo.
--   anon e authenticated hanno SELECT/INSERT/UPDATE/DELETE per grant.
--
-- Decisione: ENABLE senza alcuna policy. Tabella chiusa a chiave.
--   Zero righe e zero consumatori: se qualcosa dovesse rompersi, avremmo
--   scoperto un consumatore nascosto — informazione utile a costo zero.
--
-- NON risolve: se `guides` vada eliminata del tutto. È una decisione di
--   prodotto, non una diagnosi, e resta aperta.
--
-- Rollback: supabase/GATE_RLS_ROLLBACK.sql
-- ============================================================================

ALTER TABLE public.guides ENABLE ROW LEVEL SECURITY;
