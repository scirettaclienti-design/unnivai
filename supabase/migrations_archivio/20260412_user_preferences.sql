-- User Preferences / Preference Graph
-- Traccia le interazioni dell'utente per personalizzare l'AI
-- Le preferenze si ARRICCHISCONO ad ogni sessione, non si sovrascrivono

CREATE TABLE IF NOT EXISTS public.user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Aggregato delle preferenze (aggiornato ad ogni interazione)
  preference_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Storico interazioni recenti (ultime 30)
  interactions JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Contatori
  total_interactions INTEGER NOT NULL DEFAULT 0,
  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Un record per utente
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_preferences_user
  ON public.user_preferences(user_id);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own preferences"
  ON public.user_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences"
  ON public.user_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
  ON public.user_preferences FOR UPDATE
  USING (auth.uid() = user_id);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_user_preferences_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_preferences_updated_at ON user_preferences;
CREATE TRIGGER user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW EXECUTE FUNCTION update_user_preferences_timestamp();
