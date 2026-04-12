import { z } from 'zod'

// ─── TourUI ───────────────────────────────────────────────────────────────────
//
// Canonical shape produced by dataService.mapTourToUI().
// Consumed by: Explore, TourDetails, MapPage markers, DashboardGuide tour list,
//              AiItinerary, QuickPath, and every Realtime tour-change event.
//
// Any field that deviates from this shape at runtime will be logged as a
// schema error via validateData(), allowing us to catch DB contract breaks
// without crashing the UI.
//
export const TourUISchema = z.object({
  id:              z.string(),
  title:           z.string(),
  description:     z.string(),
  city:            z.string().nullable(),
  location:        z.string(),

  // Duration — string representation shown in UI, numeric value for sorting
  duration:        z.string().nullable(),
  estimatedTime:   z.number().positive().nullable(),

  // Pricing — both may be null for free tours
  price:           z.number().nonnegative().nullable(),
  originalPrice:   z.number().nonnegative().nullable(),

  // Stats — finite() rejects NaN that can slip through Number() coercions
  rating:          z.number().finite().min(0).max(5),
  reviews:         z.number().int().nonnegative(),
  participants:    z.number().int().nonnegative(),
  maxParticipants: z.number().int().positive(),

  // Media — images array always has ≥1 element (fallback URL is pushed in mapper)
  imageUrl:  z.string(),
  images:    z.array(z.string()).min(1),

  // Guide (flattened from profiles JOIN)
  guide_id:    z.string().nullable(),
  guide:       z.string(),
  guideAvatar: z.string(),
  guideBio:    z.string(),

  // Rich content
  highlights:  z.array(z.unknown()),
  tags:        z.array(z.string()),
  itinerary:   z.array(
    z.object({
      time:     z.string(),
      activity: z.string(),
      emoji:    z.string(),
    })
  ),
  meetingPoint: z.string(),
  included:     z.array(z.unknown()),
  notIncluded:  z.array(z.unknown()),

  // Flags
  live:       z.boolean(),
  startsSoon: z.boolean(),
  category:   z.string(),
  type:       z.string(),
  difficulty: z.string(),

  // Labels
  startPoint: z.string(),
  nextStart:  z.string(),

  // Map data
  steps:     z.array(z.unknown()),
  routePath: z.unknown().nullable(),

  // Mood — key into MAP_MOODS; derived from tags in mapTourToUI()
  mood: z.string(),

  // 3D camera preference — saved per tour for Google Maps integration
  mapViewState: z.object({
    pitch:   z.number(),
    bearing: z.number(),
    zoom:    z.number(),
  }).optional(),
})

// ─── ActivityUI ───────────────────────────────────────────────────────────────
//
// Canonical shape produced by dataService.getActivitiesByCity() mapper.
// Mirrors the columns added by migration 20260303_enhance_activities_monuments.sql.
//
// type enum matches the CHECK constraint on activities.type in the DB.
// openingHours mirrors the JSONB format: { "lun": "09:00-18:00", ..., "dom": "Chiuso" }.
// admissionFee: null → ingresso gratuito.
//
export const ActivityUISchema = z.object({
  id:              z.string(),
  name:            z.string(),
  latitude:        z.number().finite(),
  longitude:       z.number().finite(),
  city:            z.string().nullable(),
  category:        z.string(),
  level:           z.string().nullable(),           // 'gold' | 'silver' | 'standard' | null (tier column)

  // Monument/POI type (migration 20260303)
  type: z.enum(['monument','museum','church','viewpoint','poi','food','shopping','nature','sport']),

  // Emoji icon rendered in the map marker (overrides the Lucide icon when present)
  icon:            z.string().nullable(),

  // Content
  tags:            z.array(z.string()),
  description:     z.string().nullable(),

  // Curiosità storiche (scheda monumento)
  historicalNotes: z.string().nullable(),
  funFacts:        z.array(z.string()).nullable(),   // bullet-point facts

  // Practical info
  openingHours:    z.record(z.string()).nullable(),  // { "lun":"09:00-18:00", "dom":"Chiuso" }
  websiteUrl:      z.string().nullable(),
  imageUrl:        z.string().nullable(),
  admissionFee:    z.number().nonnegative().nullable(), // null = free
  durationMinutes: z.number().int().positive().nullable(),

  // Google Places & Routes API integration
  googlePlaceId:  z.string().nullable().optional(),
  transitOptions: z.array(z.unknown()).nullable().optional(),
})

// ─── MAP_MOODS ────────────────────────────────────────────────────────────────
//
// Maps Italian tour tags to a Google Cloud-based Map Style ID + brand colour.
// Used by UnnivaiMap (to switch the basemap aesthetic) and MapPage (to tint
// the transport-mode selector and Start Tour Bar accent).
//
// DVAI-030: I valori 'style' con prefisso GOOGLE_MAP_ID_* sono PLACEHOLDER.
// Per attivarli: creare gli stili in Google Cloud Console → Map Styles,
// poi sostituire ogni placeholder con il Map ID reale (es. '28861a61c07876f8').
// Finché non configurati, tutti i mood usano il Map ID di default.
//
// Map IDs reali da configurare:
//   romantico  → GOOGLE_MAP_ID_ROMANTIC   → toni caldi per percorsi romantici
//   storia     → GOOGLE_MAP_ID_VINTAGE    → seppia muto per passeggiate storiche
//   avventura  → GOOGLE_MAP_ID_OUTDOOR    → terrain-focused per avventura
//   natura     → GOOGLE_MAP_ID_OUTDOOR    → idem avventura
//   cibo       → GOOGLE_MAP_ID_LIGHT      → minimal clean per food & shopping
//   shopping   → GOOGLE_MAP_ID_LIGHT      → idem cibo
//   arte       → GOOGLE_MAP_ID_ROMANTIC   → idem romantico
//   sorpresa   → GOOGLE_MAP_ID_DARK       → cinematografico drammatico
//   sport      → GOOGLE_MAP_ID_SATELLITE  → satellite ibrido
//
// Keys in lowercase ASCII — no accent normalisation needed.
//
export const MAP_MOODS = {
  romantico: {
    tags:         ['Romantico'],
    style:        'GOOGLE_MAP_ID_ROMANTIC',
    primaryColor: '#E11D48',   // rose-600
    label:        'Romantico',
  },
  storia: {
    tags:         ['Storia', 'Cultura'],
    style:        'GOOGLE_MAP_ID_VINTAGE',
    primaryColor: '#92400E',   // amber-800
    label:        'Cultura & Storia',
  },
  avventura: {
    tags:         ['Avventura'],
    style:        'GOOGLE_MAP_ID_OUTDOOR',
    primaryColor: '#047857',   // emerald-700
    label:        'Avventura',
  },
  natura: {
    tags:         ['Natura'],
    style:        'GOOGLE_MAP_ID_OUTDOOR',
    primaryColor: '#059669',   // emerald-600
    label:        'Natura',
  },
  cibo: {
    tags:         ['Cibo', 'Gastronomia'],
    style:        'GOOGLE_MAP_ID_LIGHT',
    primaryColor: '#EA580C',   // orange-600
    label:        'Gastronomia',
  },
  shopping: {
    tags:         ['Shopping'],
    style:        'GOOGLE_MAP_ID_LIGHT',
    primaryColor: '#7C3AED',   // violet-700
    label:        'Shopping',
  },
  arte: {
    tags:         ['Arte'],
    style:        'GOOGLE_MAP_ID_ROMANTIC',
    primaryColor: '#9333EA',   // purple-600
    label:        'Arte',
  },
  sorpresa: {
    tags:         ['Sorpresa'],
    style:        'GOOGLE_MAP_ID_DARK',
    primaryColor: '#F59E0B',   // amber-400
    label:        'Sorpresa',
  },
  sport: {
    tags:         ['Sport'],
    style:        'GOOGLE_MAP_ID_SATELLITE',
    primaryColor: '#0EA5E9',   // sky-500
    label:        'Sport & Attività',
  },
  // Fallback — matches when no tour tag overlaps with the entries above.
  default: {
    tags:         [],
    style:        '28861a61c07876f819652d2d',
    primaryColor: '#F97316',   // orange-500 (app brand colour)
    label:        'Esplora',
  },
}

// getMoodForTags(tags) → mood key
//
// Returns the key of the first MAP_MOODS entry whose tags array contains
// at least one of the given tour tags.  Falls back to 'default'.
//
// Usage:
//   const mood = getMoodForTags(tour.tags)       // e.g. 'romantico'
//   const { style, primaryColor } = MAP_MOODS[mood]
//
export const getMoodForTags = (tags = []) => {
  if (!Array.isArray(tags) || tags.length === 0) return 'default'
  for (const [key, mood] of Object.entries(MAP_MOODS)) {
    if (key === 'default') continue
    if (tags.some(t => mood.tags.includes(t))) return key
  }
  return 'default'
}

// ─── BookingInput ─────────────────────────────────────────────────────────────
//
// Input to dataService.createBooking().
// Validated BEFORE the Supabase insert so that data integrity errors are
// surfaced explicitly instead of being swallowed by the silent-success fallback.
//
// z.coerce.number() handles the case where a UI form passes price/guests as
// strings (e.g. from an <input type="text">).
//
export const BookingInputSchema = z.object({
  tourId:     z.string().min(1, 'tourId è obbligatorio'),
  date:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date deve essere YYYY-MM-DD'),
  time:       z.string().regex(/^\d{2}:\d{2}$/, 'time deve essere HH:MM'),
  guests:     z.coerce.number().int().min(1, 'almeno 1 ospite').max(50),
  totalPrice: z.coerce.number().nonnegative('il prezzo non può essere negativo'),
})

// ─── NotificationUI ───────────────────────────────────────────────────────────
//
// Canonical shape for all notification objects, regardless of whether they
// arrive via REST (dataService.getNotifications) or via Realtime INSERT
// (dataService.subscribeToNotifications).
//
// Historical gap: the two code paths previously produced different shapes —
//   getNotifications  → { time: string, actionData: {} }          (missing actionText/actionUrl)
//   subscribeToNotifs → { timestamp: Date, actionType: string }   (missing actionData, time)
//
// Both paths are now expected to conform to this single schema.
// Deviations are caught by validateData() and logged as console.error.
//
export const NotificationUISchema = z.object({
  id:         z.string(),
  title:      z.string(),
  message:    z.string(),
  type:       z.string(),
  time:       z.string(),       // always HH:MM string — callers must format before returning
  is_read:    z.boolean(),
  actionText: z.string().nullable().default('Vedi'),
  actionUrl:  z.string().nullable().default('/notifications'),
  actionData: z.record(z.unknown()).nullable().default({}),
  category:   z.string().nullable().default('general'),
  city_scope: z.string().nullable().optional(),
})
