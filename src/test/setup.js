import '@testing-library/jest-dom'

// ---------------------------------------------------------------------------
// DVAI-060 CI fix — Global supabase mock.
//
// In locale i test caricano .env → import.meta.env.VITE_SUPABASE_URL definito
// → createClient() in src/lib/supabase.js va a buon fine.
// In CI (GitHub Actions) manca .env → createClient() a top-level lancia
// "supabaseUrl is required" e i moduli che importano @/lib/supabase (services,
// hooks) crashano al mount.
//
// Fix: mock globale minimale con superficie sufficiente per la maggior parte
// dei test. I test che vogliono comportamenti custom (dataService.test.js)
// sovrascrivono con un vi.mock locale (l'hoisting per-file prevale).
// ---------------------------------------------------------------------------
vi.mock('@/lib/supabase', () => {
  const makeChainable = () => {
    const stub = {
      select: vi.fn(), insert: vi.fn(), update: vi.fn(), upsert: vi.fn(),
      delete: vi.fn(), eq: vi.fn(), neq: vi.fn(), in: vi.fn(), or: vi.fn(),
      order: vi.fn(), limit: vi.fn(), range: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      then: (resolve) => Promise.resolve({ data: [], error: null }).then(resolve),
    }
    for (const k of ['select','insert','update','upsert','delete','eq','neq','in','or','order','limit','range']) {
      stub[k].mockReturnValue(stub)
    }
    return stub
  }
  return {
    supabase: {
      from: vi.fn(() => makeChainable()),
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
        signOut: vi.fn().mockResolvedValue({ error: null }),
        onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      },
      channel: vi.fn(() => ({
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockReturnThis(),
        unsubscribe: vi.fn(),
      })),
      removeChannel: vi.fn(),
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    },
  }
})

// ---------------------------------------------------------------------------
// Browser API stubs
// These don't exist in jsdom and would cause "not a function" errors if called
// during module initialisation of hooks like useEnhancedGeolocation.
// ---------------------------------------------------------------------------

// Geolocation — stubbed as unavailable by default; override per-test as needed.
Object.defineProperty(global.navigator, 'geolocation', {
  value: {
    getCurrentPosition: vi.fn(),
    watchPosition: vi.fn(),
    clearWatch: vi.fn(),
  },
  configurable: true,
})

// Silence console.error calls that come from dataService's missing-column warnings.
// Tests that specifically check these warnings can restore it with vi.spyOn.
vi.spyOn(console, 'error').mockImplementation(() => {})
vi.spyOn(console, 'warn').mockImplementation(() => {})
