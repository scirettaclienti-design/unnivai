-- DVAI-REVIEWS: Sistema recensioni post-tour
-- Tabella reviews + RLS + indici + vincolo unicità per booking

CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_id UUID NOT NULL,
  guide_id UUID NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  booking_id UUID,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own reviews"
  ON public.reviews FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Anyone can read reviews"
  ON public.reviews FOR SELECT
  USING (true);

CREATE POLICY "Users can delete own reviews"
  ON public.reviews FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_reviews_guide ON public.reviews(guide_id);
CREATE INDEX IF NOT EXISTS idx_reviews_tour ON public.reviews(tour_id);

-- Un utente può lasciare una sola recensione per booking
CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_unique_booking
  ON public.reviews(user_id, booking_id) WHERE booking_id IS NOT NULL;
