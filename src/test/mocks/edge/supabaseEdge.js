// Gate QUOTA-SERVER — sostituto di https://esm.sh/@supabase/supabase-js@2.39.0
// per le Edge Function sotto Vitest. Il test imposta la factory su globalThis.
export const createClient = (...args) => {
  if (typeof globalThis.__edgeSupabaseFactory !== 'function') {
    throw new Error('Test: __edgeSupabaseFactory non impostata');
  }
  return globalThis.__edgeSupabaseFactory(...args);
};
