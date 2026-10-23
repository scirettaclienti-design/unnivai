-- DVAI-050: Quota anti-abuso giornaliera per generazioni AI nuove.
-- Una riga per (user_id, day). RLS: il proprietario può leggere e upsertare la propria riga.
CREATE TABLE IF NOT EXISTS public.ai_quota_daily (
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    day date NOT NULL DEFAULT CURRENT_DATE,
    count integer NOT NULL DEFAULT 0,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, day)
);

ALTER TABLE public.ai_quota_daily ENABLE ROW LEVEL SECURITY;

-- Lettura: solo la propria riga
DROP POLICY IF EXISTS "ai_quota_select_own" ON public.ai_quota_daily;
CREATE POLICY "ai_quota_select_own" ON public.ai_quota_daily
    FOR SELECT USING (auth.uid() = user_id);

-- Insert: solo la propria riga
DROP POLICY IF EXISTS "ai_quota_insert_own" ON public.ai_quota_daily;
CREATE POLICY "ai_quota_insert_own" ON public.ai_quota_daily
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Update: solo la propria riga
DROP POLICY IF EXISTS "ai_quota_update_own" ON public.ai_quota_daily;
CREATE POLICY "ai_quota_update_own" ON public.ai_quota_daily
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Trigger per aggiornare updated_at
CREATE OR REPLACE FUNCTION public.ai_quota_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS ai_quota_daily_touch ON public.ai_quota_daily;
CREATE TRIGGER ai_quota_daily_touch
    BEFORE UPDATE ON public.ai_quota_daily
    FOR EACH ROW EXECUTE FUNCTION public.ai_quota_touch_updated_at();
