// URL e chiave anon veri dal .env (passati come LIVE_*): Places sulla edge function.
import { vi } from 'vitest';
vi.stubEnv('VITE_SUPABASE_URL', process.env.LIVE_SUPABASE_URL);
vi.stubEnv('VITE_SUPABASE_ANON_KEY', process.env.LIVE_ANON_KEY);
vi.stubEnv('VITE_PLACES_PROXY_URL', `${process.env.LIVE_SUPABASE_URL}/functions/v1/places-proxy`);
