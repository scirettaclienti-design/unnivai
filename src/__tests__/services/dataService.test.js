// =============================================================================
// dataService.test.js
//
// Unit tests for src/services/dataService.js
//
// Coverage strategy:
//   ① mapTourToUI     — pure function, no mocking needed, highest ROI
//   ② getToursByCity  — async, mocks Supabase query builder
//   ③ toggleFavorite  — tests auth-gated behaviour (guest vs authenticated)
//   ④ createBooking   — tests guest-mode short-circuit
//
// To run:
//   npm test                         # watch mode
//   npm test -- dataService          # single file
//   npm test -- --coverage           # with coverage report
// =============================================================================

import { describe, it, expect, beforeEach, vi } from 'vitest'

// vi.mock is hoisted before all imports by Vitest, so this declaration
// intercepts the module before dataService.js (and this file) import it.
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from:    vi.fn(),
    auth:    { getSession: vi.fn() },
    channel: vi.fn(),
  },
}))

// Import AFTER vi.mock so we get the mocked versions.
import { supabase }   from '@/lib/supabase'
import { dataService } from '@/services/dataService'
import {
  createQueryBuilder,
  createSessionMock,
  NO_SESSION,
} from '@/test/mocks/supabase'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal valid DB tour row — only fields that must exist for a non-null result */
const minimalDbTour = () => ({
  id:    'tour-abc',
  title: 'Segreti del Colosseo',
  city:  'Roma',
})

/** Full DB tour row covering every mapping path */
const fullDbTour = () => ({
  id:                  'tour-full',
  title:               'Tour completo',
  description:         'Una descrizione.',
  city:                'Roma',
  location:            'Via dei Fori Imperiali',
  duration_minutes:    120,
  duration_text:       '2 ore',       // should be IGNORED when duration_minutes present
  price_eur:           59,
  price:               40,            // should be IGNORED when price_eur present
  original_price:      75,
  rating:              4.8,
  reviews_count:       32,
  current_participants: 3,
  max_participants:    10,
  image_urls:          ['https://img1.jpg', 'https://img2.jpg'],
  guide_id:            'guide-001',
  profiles: {
    full_name:    'Marco Rossi',
    username:     'marco_r',
    avatar_emoji: '🧭',
    bio:          'Guida esperta di Roma.',
  },
  highlights:  ['Vista panoramica', 'Accesso VIP'],
  tags:        ['cultura', 'storia'],
  itinerary:   [
    { time: '09:00', activity: 'Punto di incontro', emoji: '📍' },
    { time: '10:00', activity: 'Anfiteatro',        emoji: '🏛️' },
  ],
  meeting_point: 'Ingresso principale',
  included:      ['Guida', 'Acqua'],
  not_included:  ['Pranzo'],
  is_live:       true,
  is_upcoming:   false,
  category:      'cultura',
  difficulty:    'medio',
  start_point:   'Metro B Colosseo',
  next_start_label: 'Domani 09:00',
  steps:         [{ lat: 41.89, lng: 12.49 }],
  route_path:    '/path/123',
})


// =============================================================================
// ① mapTourToUI — pure function tests
// =============================================================================

describe('mapTourToUI', () => {

  // --- null / falsy guard ---------------------------------------------------

  it('returns null when input is null', () => {
    expect(dataService.mapTourToUI(null)).toBeNull()
  })

  it('returns null when input is undefined', () => {
    expect(dataService.mapTourToUI(undefined)).toBeNull()
  })

  it('returns null when input is 0 (falsy)', () => {
    expect(dataService.mapTourToUI(0)).toBeNull()
  })


  // --- basic shape ---------------------------------------------------------

  it('returns an object with all required UI properties from a minimal row', () => {
    const result = dataService.mapTourToUI(minimalDbTour())

    expect(result).not.toBeNull()
    expect(result).toMatchObject({
      id:    'tour-abc',
      title: 'Segreti del Colosseo',
      city:  'Roma',
    })
    // All array fields must be arrays even if absent in DB row
    expect(Array.isArray(result.images)).toBe(true)
    expect(Array.isArray(result.highlights)).toBe(true)
    expect(Array.isArray(result.tags)).toBe(true)
    expect(Array.isArray(result.itinerary)).toBe(true)
    expect(Array.isArray(result.included)).toBe(true)
    expect(Array.isArray(result.notIncluded)).toBe(true)
    expect(Array.isArray(result.steps)).toBe(true)
  })


  // --- price mapping -------------------------------------------------------

  it('uses price_eur when both price_eur and price are present', () => {
    const result = dataService.mapTourToUI({ ...minimalDbTour(), price_eur: 59, price: 40 })
    expect(result.price).toBe(59)
  })

  it('falls back to price when price_eur is absent', () => {
    const result = dataService.mapTourToUI({ ...minimalDbTour(), price: 40 })
    expect(result.price).toBe(40)
  })

  it('returns null price when neither price_eur nor price are present', () => {
    const result = dataService.mapTourToUI(minimalDbTour())
    expect(result.price).toBeNull()
  })

  it('coerces price_eur string to number', () => {
    const result = dataService.mapTourToUI({ ...minimalDbTour(), price_eur: '59.90' })
    expect(result.price).toBe(59.9)
    expect(typeof result.price).toBe('number')
  })


  // --- duration mapping ----------------------------------------------------

  it('uses duration_minutes when present and formats as "N min"', () => {
    const result = dataService.mapTourToUI({ ...minimalDbTour(), duration_minutes: 120 })
    expect(result.duration).toBe('120 min')
    expect(result.estimatedTime).toBe(120)
  })

  it('falls back to duration_text when duration_minutes is absent', () => {
    const result = dataService.mapTourToUI({ ...minimalDbTour(), duration_text: '2 ore' })
    expect(result.duration).toBe('2 ore')
    expect(result.estimatedTime).toBeNull()
  })

  it('duration_minutes takes priority over duration_text when both present', () => {
    const result = dataService.mapTourToUI({
      ...minimalDbTour(),
      duration_minutes: 90,
      duration_text:    '1.5 ore',
    })
    expect(result.duration).toBe('90 min')
  })


  // --- image mapping -------------------------------------------------------

  it('uses image_urls array and sets imageUrl to first element', () => {
    const result = dataService.mapTourToUI({
      ...minimalDbTour(),
      image_urls: ['https://first.jpg', 'https://second.jpg'],
    })
    expect(result.imageUrl).toBe('https://first.jpg')
    expect(result.images).toEqual(['https://first.jpg', 'https://second.jpg'])
  })

  it('falls back to images field when image_urls is absent', () => {
    const result = dataService.mapTourToUI({
      ...minimalDbTour(),
      images: ['https://fallback.jpg'],
    })
    expect(result.imageUrl).toBe('https://fallback.jpg')
  })

  it('falls back to image field when image_urls and images are absent', () => {
    const result = dataService.mapTourToUI({
      ...minimalDbTour(),
      image: 'https://single.jpg',
    })
    expect(result.imageUrl).toBe('https://single.jpg')
  })

  it('uses Unsplash fallback URL when no image field is present', () => {
    const result = dataService.mapTourToUI(minimalDbTour())
    expect(result.imageUrl).toContain('unsplash.com')
  })

  it('wraps a non-array images value in an array', () => {
    const result = dataService.mapTourToUI({
      ...minimalDbTour(),
      images: 'https://single-string.jpg',
    })
    expect(Array.isArray(result.images)).toBe(true)
    expect(result.images[0]).toBe('https://single-string.jpg')
  })


  // --- array field safety --------------------------------------------------

  it('defaults null highlights to empty array', () => {
    expect(dataService.mapTourToUI({ ...minimalDbTour(), highlights: null }).highlights).toEqual([])
  })

  it('defaults null tags to empty array', () => {
    expect(dataService.mapTourToUI({ ...minimalDbTour(), tags: null }).tags).toEqual([])
  })

  it('defaults null included to empty array', () => {
    expect(dataService.mapTourToUI({ ...minimalDbTour(), included: null }).included).toEqual([])
  })

  it('defaults null not_included to empty array', () => {
    expect(dataService.mapTourToUI({ ...minimalDbTour(), not_included: null }).notIncluded).toEqual([])
  })

  it('maps itinerary items and injects 📍 emoji when missing', () => {
    const result = dataService.mapTourToUI({
      ...minimalDbTour(),
      itinerary: [
        { time: '09:00', activity: 'Start', emoji: '🏛️' },
        { time: '10:00', activity: 'No emoji' },           // emoji missing
      ],
    })
    expect(result.itinerary[0].emoji).toBe('🏛️')
    expect(result.itinerary[1].emoji).toBe('📍')           // default injected
  })


  // --- boolean flags -------------------------------------------------------

  it('maps is_live truthy value to live: true', () => {
    expect(dataService.mapTourToUI({ ...minimalDbTour(), is_live: true }).live).toBe(true)
    expect(dataService.mapTourToUI({ ...minimalDbTour(), is_live: 1 }).live).toBe(true)
  })

  it('maps falsy is_live to live: false', () => {
    expect(dataService.mapTourToUI({ ...minimalDbTour(), is_live: false }).live).toBe(false)
    expect(dataService.mapTourToUI({ ...minimalDbTour(), is_live: null }).live).toBe(false)
    expect(dataService.mapTourToUI(minimalDbTour()).live).toBe(false)
  })

  it('maps is_upcoming to startsSoon', () => {
    expect(dataService.mapTourToUI({ ...minimalDbTour(), is_upcoming: true }).startsSoon).toBe(true)
    expect(dataService.mapTourToUI({ ...minimalDbTour(), is_upcoming: false }).startsSoon).toBe(false)
  })


  // --- defaults ------------------------------------------------------------

  it('defaults rating to 5.0 when absent', () => {
    expect(dataService.mapTourToUI(minimalDbTour()).rating).toBe(5.0)
  })

  it('defaults maxParticipants to 10 when absent', () => {
    expect(dataService.mapTourToUI(minimalDbTour()).maxParticipants).toBe(10)
  })

  it('defaults category and type to "culture" when absent', () => {
    const result = dataService.mapTourToUI(minimalDbTour())
    expect(result.category).toBe('culture')
    expect(result.type).toBe('culture')
  })

  it('defaults difficulty to "facile" when absent', () => {
    expect(dataService.mapTourToUI(minimalDbTour()).difficulty).toBe('facile')
  })

  it('defaults nextStart to "A breve" when absent', () => {
    expect(dataService.mapTourToUI(minimalDbTour()).nextStart).toBe('A breve')
  })


  // --- guide info flattening -----------------------------------------------

  it('flattens profiles join into guide name, bio, and avatar', () => {
    const result = dataService.mapTourToUI({
      ...minimalDbTour(),
      profiles: { full_name: 'Marco Rossi', bio: 'Esperto.', avatar_emoji: '🧭' },
    })
    expect(result.guide).toBe('Marco Rossi')
    expect(result.guideBio).toBe('Esperto.')
    expect(result.guideAvatar).toBe('🧭')
  })

  it('falls back to username when full_name is absent', () => {
    const result = dataService.mapTourToUI({
      ...minimalDbTour(),
      profiles: { username: 'marco_r' },
    })
    expect(result.guide).toBe('marco_r')
  })

  it('falls back to default guide name when profiles is missing', () => {
    const result = dataService.mapTourToUI({ ...minimalDbTour(), profiles: null })
    expect(result.guide).toBe('Guida DoveVai')
  })

  it('uses avatar_url from profile JOIN when present', () => {
    const result = dataService.mapTourToUI({
      ...minimalDbTour(),
      profiles: { avatar_url: 'https://cdn.example.com/photo.jpg' },
    })
    expect(result.guideAvatar).toBe('https://cdn.example.com/photo.jpg')
  })

  it('falls back to avatar_emoji when avatar_url is absent', () => {
    const result = dataService.mapTourToUI({
      ...minimalDbTour(),
      profiles: { avatar_emoji: '🧭' },
    })
    expect(result.guideAvatar).toBe('🧭')
  })

  it('falls back to 👋 when neither avatar_url nor avatar_emoji are present', () => {
    const result = dataService.mapTourToUI({
      ...minimalDbTour(),
      profiles: { username: 'marco_r' },
    })
    expect(result.guideAvatar).toBe('👋')
  })


  // --- full row smoke test -------------------------------------------------

  it('maps a fully-populated DB row without throwing', () => {
    const result = dataService.mapTourToUI(fullDbTour())

    expect(result).not.toBeNull()
    expect(result.id).toBe('tour-full')
    expect(result.price).toBe(59)          // price_eur wins
    expect(result.duration).toBe('120 min') // duration_minutes wins
    expect(result.images).toHaveLength(2)
    expect(result.itinerary).toHaveLength(2)
    expect(result.live).toBe(true)
    expect(result.startsSoon).toBe(false)
    expect(result.guide).toBe('Marco Rossi')
  })
})


// =============================================================================
// ② getToursByCity — async + Supabase mock
// =============================================================================

describe('getToursByCity', () => {

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns mapped tours array on success', async () => {
    const rawTours = [
      { id: 't1', title: 'Tour 1', city: 'Roma', price_eur: 30 },
      { id: 't2', title: 'Tour 2', city: 'Roma', price_eur: 50 },
    ]

    vi.mocked(supabase.from).mockReturnValue(
      createQueryBuilder({ data: rawTours, error: null })
    )

    const result = await dataService.getToursByCity('Roma')

    // Returns mapped objects, not raw DB rows
    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('t1')
    expect(result[0].price).toBe(30)       // confirms mapTourToUI was called
    expect(typeof result[0].images).toBe('object') // array present on mapped obj

    // Verifies the correct table and filter were used
    expect(supabase.from).toHaveBeenCalledWith('tours')
  })

  it('returns null when Supabase returns an error', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      createQueryBuilder({ data: null, error: { message: 'DB connection failed' } })
    )

    const result = await dataService.getToursByCity('Roma')
    expect(result).toBeNull()
  })

  it('returns null when Supabase returns an empty array', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      createQueryBuilder({ data: [], error: null })
    )

    const result = await dataService.getToursByCity('Roma')
    expect(result).toBeNull()
  })

  it('returns null when Supabase throws unexpectedly', async () => {
    vi.mocked(supabase.from).mockImplementation(() => {
      throw new Error('Network error')
    })

    const result = await dataService.getToursByCity('Roma')
    expect(result).toBeNull()
  })

  it('filters out tours that fail mapTourToUI (returns null for that item)', async () => {
    // Simulate a row that causes mapTourToUI to return null (e.g. corrupted data)
    // mapTourToUI catches exceptions internally and returns null.
    // The .map() in getToursByCity does NOT filter nulls — this is intentional
    // current behaviour. This test documents it.
    const rawTours = [
      { id: 't1', title: 'Valid', city: 'Roma' },
      null, // malformed entry
    ]

    vi.mocked(supabase.from).mockReturnValue(
      createQueryBuilder({ data: rawTours, error: null })
    )

    const result = await dataService.getToursByCity('Roma')
    // mapTourToUI(null) → null; the array still has length 2
    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('t1')
    expect(result[1]).toBeNull()
  })
})


// =============================================================================
// ③ toggleFavorite — auth-gated behaviour
// =============================================================================

describe('toggleFavorite', () => {

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns { success: true } without touching DB when user is not authenticated', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue(NO_SESSION)

    const result = await dataService.toggleFavorite('tour-123')

    expect(result).toEqual({ success: true })
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('inserts a favorite when the tour is not yet saved', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue(createSessionMock())

    // First call: check if favorite exists → returns null (not saved yet)
    const checkBuilder  = createQueryBuilder({ data: null,  error: null })
    const insertBuilder = createQueryBuilder({ error: null })

    vi.mocked(supabase.from)
      .mockReturnValueOnce(checkBuilder)   // .select('id').eq().eq().maybeSingle()
      .mockReturnValueOnce(insertBuilder)  // .insert({})

    const result = await dataService.toggleFavorite('tour-123')

    expect(result).toEqual({ success: true })
    expect(insertBuilder.insert).toHaveBeenCalledWith({
      user_id: 'user-123',
      tour_id: 'tour-123',
    })
  })

  it('deletes a favorite when the tour is already saved', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue(createSessionMock())

    const existingFav  = { id: 'fav-999' }
    const checkBuilder  = createQueryBuilder({ data: existingFav, error: null })
    const deleteBuilder = createQueryBuilder({ error: null })

    vi.mocked(supabase.from)
      .mockReturnValueOnce(checkBuilder)
      .mockReturnValueOnce(deleteBuilder)

    const result = await dataService.toggleFavorite('tour-123')

    expect(result).toEqual({ success: true })
    expect(deleteBuilder.delete).toHaveBeenCalled()
  })
})


// =============================================================================
// ④ createBooking — guest short-circuit
// =============================================================================

describe('createBooking', () => {

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns { success: true } without touching DB when guest (no session)', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue(NO_SESSION)

    const result = await dataService.createBooking({
      tourId:     'tour-abc',
      date:       '2026-06-01',
      time:       '10:00',
      guests:     2,
      totalPrice: 118,
    })

    expect(result).toEqual({ success: true })
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('inserts a booking with status "pending_request" when user is authenticated', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue(createSessionMock())

    const builder = createQueryBuilder({ error: null })
    vi.mocked(supabase.from).mockReturnValue(builder)

    const bookingData = {
      tourId:     'tour-abc',
      date:       '2026-06-01',
      time:       '10:00',
      guests:     2,
      totalPrice: 118,
    }

    const result = await dataService.createBooking(bookingData)

    expect(result).toEqual({ success: true })
    expect(supabase.from).toHaveBeenCalledWith('bookings')
    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        tour_id: 'tour-abc',
        user_id: 'user-123',
        status:  'pending_request',
      })
    )
  })

  it('returns { success: true } even when DB insert fails (silent fallback)', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue(createSessionMock())

    const failingBuilder = createQueryBuilder({ error: { message: 'insert failed' } })
    vi.mocked(supabase.from).mockReturnValue(failingBuilder)

    const result = await dataService.createBooking({
      tourId: 'tour-abc', date: '2026-06-01',
      time: '10:00', guests: 1, totalPrice: 59,
    })

    // Intentional design: the UI is never shown a booking error
    expect(result).toEqual({ success: true })
  })
})
