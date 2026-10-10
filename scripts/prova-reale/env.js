// TEST-ACC — URL e chiave anon veri dal .env; le credenziali dell'account di
// prova (se ci sono) da .env.local, che non e' mai committato (*.local).
// Le credenziali non si stampano mai: qui si legge solo se esistono.
import { vi } from 'vitest';
import { config } from 'dotenv';
config({ path: '.env', quiet: true });
config({ path: '.env.local', quiet: true, override: true });
vi.stubEnv('VITE_SUPABASE_URL', process.env.VITE_SUPABASE_URL);
vi.stubEnv('VITE_SUPABASE_ANON_KEY', process.env.VITE_SUPABASE_ANON_KEY);
vi.stubEnv('VITE_PLACES_PROXY_URL', `${process.env.VITE_SUPABASE_URL}/functions/v1/places-proxy`);
