-- ROME DEMO DATA SEED

-- 1. Create Profiles (Mock UUIDs would usually be Auth UUIDs, here strictly structure)
-- Note: In real usage, these IDs must match auth.users IDs. 
-- For SQL Editor seeding, we might need actual user IDs or placeholders.

-- 2. Activities (Rome Center)
INSERT INTO public.activities (city, name, latitude, longitude, category, tier, owner_id)
VALUES 
('Roma', 'Bistrot del Centro', 41.9020, 12.4960, 'food', 'premium', auth.uid()),
('Roma', 'Artigiani Pelletteria', 41.9035, 12.4950, 'shop', 'pro', auth.uid()),
('Roma', 'Gelateria Antica', 41.9010, 12.4940, 'food', 'base', auth.uid());

-- 3. Tours
INSERT INTO public.tours (city, title, description, price, duration_text, is_live, category, guide_id)
VALUES 
('Roma', 'Segreti del Colosseo', 'Tour esclusivo dei sotterranei.', 59.00, '2 ore', true, 'history', auth.uid()),
('Roma', 'Street Food Testaccio', 'Assaggi autentici nel cuore di Roma.', 35.00, '3 ore', false, 'food', auth.uid());
