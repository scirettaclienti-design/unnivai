import { vi } from 'vitest'

// ─── Mock declarations (hoisted before any real import) ──────────────────────
//
// userContextService.js imports supabase, weatherService, dataService, and
// aiRecommendationService as singleton instances.  All four must be mocked
// here so the module is initialised with fakes, not the real clients.

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getSession: vi.fn() },
    from:  vi.fn(),
  },
}))

vi.mock('@/services/weatherService', () => ({
  weatherService: { getWeather: vi.fn() },
}))

// dataService is imported but only its .useRealData flag is read inside
// getUserContext().  Setting it false skips the live tours-count query.
vi.mock('@/services/dataService', () => ({
  dataService: { useRealData: false },
}))

// aiRecommendationService is imported but never called; mock to prevent
// module-level side effects (OpenAI client init, etc.).
vi.mock('@/services/aiRecommendationService', () => ({
  aiRecommendationService: {},
}))

// ─── Imports (AFTER vi.mock) ─────────────────────────────────────────────────
import { supabase }           from '@/lib/supabase'
import { weatherService }     from '@/services/weatherService'
import { userContextService } from '@/services/userContextService'
import {
  createQueryBuilder,
  createSessionMock,
  NO_SESSION,
} from '@/test/mocks/supabase'

// ─── Shared helpers ──────────────────────────────────────────────────────────

/** Stub weatherService so every test has a valid weather response by default */
const stubWeather = (overrides = {}) =>
  vi.mocked(weatherService.getWeather).mockResolvedValue({
    temperature: 22,
    condition:   'sunny',
    ...overrides,
  })

/** Simulate a guest (unauthenticated) session */
const stubGuest = () =>
  vi.mocked(supabase.auth.getSession).mockResolvedValue(NO_SESSION)

/** Simulate an authenticated session (default: user-123 / Test User) */
const stubAuth = (userId = 'user-123') =>
  vi.mocked(supabase.auth.getSession).mockResolvedValue(createSessionMock(userId))

/** Stub supabase.from so getSupabaseProfileCity resolves to a given city (or null) */
const stubProfileCity = (city) =>
  vi.mocked(supabase.from).mockReturnValue(
    createQueryBuilder({ data: { current_city: city }, error: null })
  )

/** GPS object with an explicit city name — no reverse-geocode fetch needed */
const gpsWithCity = (city = 'Roma') => ({
  latitude:  41.9028,
  longitude: 12.4964,
  city,
})

// ─── getUserContext() ─────────────────────────────────────────────────────────

describe('userContextService.getUserContext()', () => {
  beforeEach(() => {
    // vi.resetAllMocks resets implementations so each test starts clean.
    vi.resetAllMocks()
    localStorage.clear()
    stubWeather()
  })

  afterEach(() => {
    // Restore any fetch (or other global) stubs set by individual tests.
    vi.unstubAllGlobals()
  })

  // ── GPS denied / unavailable ─────────────────────────────────────────────

  describe('GPS denied or unavailable', () => {
    it('returns city=Roma without throwing when gpsLocation is null (guest)', async () => {
      stubGuest()
      const ctx = await userContextService.getUserContext(null, null)
      expect(ctx.city).toBe('Roma')
      expect(ctx.isGuest).toBe(true)
    })

    it('returns city=Roma without throwing when gpsLocation has no coordinates', async () => {
      stubGuest()
      const ctx = await userContextService.getUserContext({}, null)
      expect(ctx.city).toBe('Roma')
    })

    it('returns source="fallback" when no GPS, no manual, and no stored city', async () => {
      stubGuest()
      const ctx = await userContextService.getUserContext(null, null)
      expect(ctx.source).toBe('fallback')
    })

    it('keeps lat and lng null when GPS is unavailable', async () => {
      stubGuest()
      const ctx = await userContextService.getUserContext(null, null)
      expect(ctx.lat).toBeNull()
      expect(ctx.lng).toBeNull()
    })
  })

  // ── Manual city override (Priority 1) ────────────────────────────────────

  describe('manual city override (Priority 1)', () => {
    it('uses manual city when provided', async () => {
      stubGuest()
      const ctx = await userContextService.getUserContext(null, 'Milano')
      expect(ctx.city).toBe('Milano')
      expect(ctx.source).toBe('manual')
    })

    it('resolves hardcoded coords for a known Italian city without calling fetch', async () => {
      const fetchSpy = vi.fn()
      vi.stubGlobal('fetch', fetchSpy)
      stubGuest()
      const ctx = await userContextService.getUserContext(null, 'Firenze')
      expect(ctx.lat).toBe(43.7696)
      expect(ctx.lng).toBe(11.2558)
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('takes priority over GPS when both manual and GPS are provided', async () => {
      stubGuest()
      const ctx = await userContextService.getUserContext(gpsWithCity('Napoli'), 'Roma')
      expect(ctx.city).toBe('Roma')
      expect(ctx.source).toBe('manual')
    })
  })

  // ── GPS available (Priority 2) ───────────────────────────────────────────

  describe('GPS available (Priority 2)', () => {
    it('uses GPS city name when coordinates and city are both provided', async () => {
      stubGuest()
      const ctx = await userContextService.getUserContext(gpsWithCity('Roma'), null)
      expect(ctx.city).toBe('Roma')
      expect(ctx.source).toBe('gps')
      expect(ctx.lat).toBe(41.9028)
      expect(ctx.lng).toBe(12.4964)
    })

    it('reverse-geocodes via Google Maps when GPS has coords but no city name', async () => {
      stubGuest()
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok:   true,
        json: () => Promise.resolve({ results: [{ address_components: [{ types: ['locality'], long_name: 'Napoli' }] }] }),
      }))
      const ctx = await userContextService.getUserContext(
        { latitude: 40.8518, longitude: 14.2681 },
        null,
      )
      expect(ctx.city).toBe('Napoli')
      expect(ctx.source).toBe('gps')
    })
  })

  // ── Supabase profile city (Priority 3 — authenticated, no GPS) ───────────

  describe('Supabase profile city (Priority 3)', () => {
    beforeEach(() => {
      stubAuth()
      stubProfileCity('Venezia')
    })

    it('uses profile city when authenticated and GPS is absent', async () => {
      const ctx = await userContextService.getUserContext(null, null)
      expect(ctx.city).toBe('Venezia')
      expect(ctx.source).toBe('manual')
    })

    it('falls back to localStorage city when profile city is null', async () => {
      stubProfileCity(null)
      localStorage.setItem('user_city', 'Torino')
      const ctx = await userContextService.getUserContext(null, null)
      expect(ctx.city).toBe('Torino')
    })

    it('falls back to Roma when both profile city and localStorage are empty', async () => {
      stubProfileCity(null)
      const ctx = await userContextService.getUserContext(null, null)
      expect(ctx.city).toBe('Roma')
    })
  })

  // ── localStorage (Priority 4 — guest) ───────────────────────────────────

  describe('localStorage city (Priority 4 — guest)', () => {
    it('uses localStorage city for guest users without GPS', async () => {
      stubGuest()
      localStorage.setItem('user_city', 'Palermo')
      const ctx = await userContextService.getUserContext(null, null)
      expect(ctx.city).toBe('Palermo')
      expect(ctx.source).toBe('manual')
    })
  })

  // ── City name sanitization ───────────────────────────────────────────────

  describe('city name sanitization', () => {
    it('replaces a coordinate-string city with Roma when no real coords are available', async () => {
      stubGuest()
      // Nominatim won't resolve this — make fetch fail so we confirm the
      // sanitisation guard catches it and forces Roma.
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))
      localStorage.setItem('user_city', 'Lat: 41.90, Lon: 12.49')
      const ctx = await userContextService.getUserContext(null, null)
      expect(ctx.city).toBe('Roma')
    })

    it('capitalises city names to title-case', async () => {
      stubGuest()
      // 'bologna' → getCoordinatesForCity normalises → 'Bologna' (in fast-path cache)
      // so no fetch is triggered; only capitalisation is exercised.
      localStorage.setItem('user_city', 'bologna')
      const ctx = await userContextService.getUserContext(null, null)
      expect(ctx.city).toBe('Bologna')
    })
  })

  // ── Auth integration ─────────────────────────────────────────────────────

  describe('auth integration', () => {
    beforeEach(() => {
      // Provide a profile query stub so authenticated tests don't throw
      // when getSupabaseProfileCity is called (returns null → Roma).
      stubProfileCity(null)
    })

    it('returns isGuest=true and firstName="Ospite" when there is no session', async () => {
      stubGuest()
      const ctx = await userContextService.getUserContext(null, null)
      expect(ctx.isGuest).toBe(true)
      expect(ctx.firstName).toBe('Ospite')
      expect(ctx.userId).toBeNull()
    })

    it('extracts first name from user_metadata.full_name', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: {
          session: {
            user: {
              id:            'u-1',
              email:         'marco@dovevai.it',
              user_metadata: { full_name: 'Marco Rossi' },
            },
          },
        },
        error: null,
      })
      const ctx = await userContextService.getUserContext(null, null)
      expect(ctx.firstName).toBe('Marco')
      expect(ctx.isGuest).toBe(false)
    })

    it('falls back to email-prefix when full_name is absent from metadata', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: {
          session: {
            user: {
              id:            'u-2',
              email:         'giulia@dovevai.it',
              user_metadata: {},
            },
          },
        },
        error: null,
      })
      const ctx = await userContextService.getUserContext(null, null)
      // Email prefix is used as-is; no capitalisation is applied to firstName.
      expect(ctx.firstName).toBe('giulia')
    })

    it('continues as guest and returns city=Roma when supabase.auth throws', async () => {
      vi.mocked(supabase.auth.getSession).mockRejectedValue(new Error('network error'))
      const ctx = await userContextService.getUserContext(null, null)
      expect(ctx.isGuest).toBe(true)
      expect(ctx.city).toBe('Roma')
    })
  })

  // ── Weather integration ──────────────────────────────────────────────────

  describe('weather integration', () => {
    it('includes temperature and condition returned by weatherService', async () => {
      stubGuest()
      stubWeather({ temperature: 28, condition: 'cloudy' })
      const ctx = await userContextService.getUserContext(null, null)
      expect(ctx.temperatureC).toBe(28)
      expect(ctx.weatherCondition).toBe('cloudy')
    })

    it('uses default temperature (24 °C, sunny) when weatherService throws', async () => {
      stubGuest()
      vi.mocked(weatherService.getWeather).mockRejectedValue(new Error('timeout'))
      const ctx = await userContextService.getUserContext(null, null)
      expect(ctx.temperatureC).toBe(24)
      expect(ctx.weatherCondition).toBe('sunny')
    })
  })

  // ── Full return-shape smoke test ─────────────────────────────────────────

  describe('return shape', () => {
    it('always returns all required context keys for a guest with no GPS', async () => {
      stubGuest()
      const ctx = await userContextService.getUserContext(null, null)
      expect(ctx).toMatchObject({
        userId:           null,
        firstName:        'Ospite',
        isGuest:          true,
        city:             'Roma',
        lat:              null,
        lng:              null,
        temperatureC:     expect.any(Number),
        weatherCondition: expect.any(String),
        toursCount:       3,
        source:           'fallback',
      })
    })
  })
})

// ─── reverseGeocodeCity() ─────────────────────────────────────────────────────

describe('userContextService.reverseGeocodeCity()', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('returns city from Google locality field', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok:   true,
      json: () => Promise.resolve({ results: [{ address_components: [{ types: ['locality'], long_name: 'Firenze' }] }] }),
    }))
    const result = await userContextService.reverseGeocodeCity(43.77, 11.26)
    expect(result).toBe('Firenze')
  })

  it('falls back to administrative_area_level_3 when locality is absent', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok:   true,
      json: () => Promise.resolve({ results: [{ address_components: [{ types: ['administrative_area_level_3'], long_name: 'Orvieto' }] }] }),
    }))
    const result = await userContextService.reverseGeocodeCity(42.71, 12.10)
    expect(result).toBe('Orvieto')
  })

  it('falls back to administrative_area_level_2 when locality and level 3 are absent', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok:   true,
      json: () => Promise.resolve({ results: [{ address_components: [{ types: ['administrative_area_level_2'], long_name: 'Unknown Town' }] }] }),
    }))
    const result = await userContextService.reverseGeocodeCity(0.1, 0.1)
    expect(result).toBe('Unknown Town')
  })

  it('returns Roma when fetch rejects with a network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))
    const result = await userContextService.reverseGeocodeCity(0, 0)
    expect(result).toBe('Roma')
  })

  it('returns Roma when Nominatim responds with a non-ok HTTP status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: vi.fn() }))
    const result = await userContextService.reverseGeocodeCity(0, 0)
    expect(result).toBe('Roma')
  })
})

// ─── getCoordinatesForCity() ──────────────────────────────────────────────────

describe('userContextService.getCoordinatesForCity()', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('returns hardcoded Roma coords without calling fetch', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const coords = await userContextService.getCoordinatesForCity('Roma')
    expect(coords).toEqual({ lat: 41.9028, lng: 12.4964 })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('normalises city name casing before the fast-path cache lookup (roma → Roma)', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const coords = await userContextService.getCoordinatesForCity('roma')
    expect(coords).toEqual({ lat: 41.9028, lng: 12.4964 })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('fetches from Google Geocoding for a city not in the fast-path cache', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok:   true,
      json: () => Promise.resolve({ results: [{ geometry: { location: { lat: 44.0, lng: 12.0 } } }] }),
    }))
    const coords = await userContextService.getCoordinatesForCity('Rimini')
    expect(coords).toEqual({ lat: 44.0, lng: 12.0 })
  })

  it('returns null when Google Geocoding returns an empty result set', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok:   true,
      json: () => Promise.resolve({ results: [] }),
    }))
    const coords = await userContextService.getCoordinatesForCity('Atlantide')
    expect(coords).toBeNull()
  })

  it('returns null when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('fail')))
    const coords = await userContextService.getCoordinatesForCity('Atlantide')
    expect(coords).toBeNull()
  })
})
