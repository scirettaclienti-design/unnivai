import { vi } from 'vitest'

// ---------------------------------------------------------------------------
// Supabase query-builder mock factory
//
// Supabase JS uses a builder/chaining pattern:
//   supabase.from('tours').select('*').eq('city', x).order('is_live') → Promise
//   supabase.from('fav').delete().eq('id', x)                         → Promise
//
// Strategy:
//   • Every filter method (select, eq, neq, or, in, ilike, limit, filter)
//     returns `this` so the chain keeps going.
//   • "Terminal" read methods (order, single, maybeSingle) return a Promise.
//   • Write operations (insert, upsert) return a Promise directly.
//   • update() and delete() return a fresh object whose .eq() is terminal,
//     mirroring how they're used in dataService.js.
//
// Usage in tests:
//   vi.mocked(supabase.from).mockReturnValue(createQueryBuilder({ data: [...], error: null }))
// ---------------------------------------------------------------------------

export function createQueryBuilder(resolveValue = { data: null, error: null }) {
  // Chainable non-terminal methods share a single terminal resolver
  const resolveTerminal = vi.fn().mockResolvedValue(resolveValue)

  const builder = {
    // --- filter chain ---
    select: vi.fn().mockReturnThis(),
    eq:     vi.fn().mockReturnThis(),
    neq:    vi.fn().mockReturnThis(),
    or:     vi.fn().mockReturnThis(),
    in:     vi.fn().mockReturnThis(),
    ilike:  vi.fn().mockReturnThis(),
    limit:  vi.fn().mockReturnThis(),
    filter: vi.fn().mockReturnThis(),

    // --- terminal read methods ---
    order:       resolveTerminal,
    single:      resolveTerminal,
    maybeSingle: resolveTerminal,

    // --- write methods (terminal) ---
    insert: vi.fn().mockResolvedValue(resolveValue),
    upsert: vi.fn().mockResolvedValue(resolveValue),

    // --- update().eq() pattern ---
    // dataService.js: supabase.from('x').update({}).eq('id', id)
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue(resolveValue),
    }),

    // --- delete().eq() and delete().select() patterns ---
    // dataService.js: supabase.from('fav').delete().eq('id', id)
    // DashboardGuide.jsx: supabase.from('tours').delete().eq('id', id).select()
    delete: vi.fn().mockReturnValue({
      eq:     vi.fn().mockResolvedValue(resolveValue),
      select: vi.fn().mockResolvedValue(resolveValue),
    }),
  }

  return builder
}

// ---------------------------------------------------------------------------
// Auth mock factory
//
// Usage:
//   vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session }, error: null })
// ---------------------------------------------------------------------------

export function createSessionMock(userId = 'user-123') {
  return {
    data: {
      session: {
        user: {
          id: userId,
          email: 'test@dovevai.it',
          user_metadata: { full_name: 'Test User', role: 'user' },
        },
      },
    },
    error: null,
  }
}

export const NO_SESSION = { data: { session: null }, error: null }

// ---------------------------------------------------------------------------
// Realtime channel mock
// Used when testing subscribeToLiveTours / subscribeToNotifications
// ---------------------------------------------------------------------------

export function createChannelMock() {
  return {
    on:          vi.fn().mockReturnThis(),
    subscribe:   vi.fn().mockReturnThis(),
    unsubscribe: vi.fn(),
  }
}
