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
  // Nullable per contratto: l'identita' della guida o esiste nel DB o non c'e'.
  // Pretendere una stringa qui obbligava mapTourToUI a inventarla ('Guida
  // DoveVai', '👋', 'Esperto locale appassionato.') — lo schema stesso era la
  // ragione per cui esisteva la fabbricazione. Chi rende gestisce il null.
  guide_id:    z.string().nullable(),
  guide:       z.string().nullable(),
  guideAvatar: z.string().nullable(),
  guideBio:    z.string().nullable(),

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
// Mappa i tag italiani dei tour a una CHIAVE DI MOOD. Nient'altro: questa
// struttura non decide piu' l'aspetto della mappa, perche' non lo decideva.
//
// COSA C'ERA E PERCHE' NON C'E' PIU'. Ogni mood portava `style`, e tutti e
// undici avevano lo STESSO valore (il Map ID di default): la promessa "stili
// mappa adattivi al tipo di tour" era nominale, e in piu' quel campo, essendo
// sempre verita', impediva a `VITE_GOOGLE_MAP_ID` di essere letto. Il Map ID
// ora vive in UN SOLO posto, `Map/GoogleMapContainer.jsx`.
//
// Portavano anche `primaryColor`, `colorScheme`, `tilt` e `label`, con ZERO
// letture in tutto il progetto (test compresi). Il commento diceva che MapPage
// li usava per tingere il selettore di trasporto e la Start Tour Bar: non e'
// mai stato vero. Valori conservati qui perche' sono una decisione di design,
// non spazzatura — se un giorno si cablano, si riparte da questi:
//
//   mood        primaryColor  colorScheme     tilt
//   romantico   #E11D48       FOLLOW_SYSTEM   45
//   storia      #92400E       FOLLOW_SYSTEM   30
//   avventura   #047857       LIGHT           60
//   natura      #059669       LIGHT           45
//   cibo        #EA580C       LIGHT            0
//   shopping    #7C3AED       LIGHT            0
//   arte        #9333EA       FOLLOW_SYSTEM   30
//   sorpresa    #F59E0B       DARK            55
//   sport       #0EA5E9       LIGHT           60
//   notturno    #6366F1       DARK            45
//   default     #F97316       FOLLOW_SYSTEM    0
//
// `colorScheme` in particolare e' una prop supportata da
// @vis.gl/react-google-maps: sarebbe l'unica leva davvero a portata di mano.
// Cablarla ricrea l'istanza della mappa (mapId/renderingType/colorScheme sono
// le tre chiavi che forzano il rimontaggio), quindi non e' gratis.
//
// Le CHIAVI restano tutte e undici: sono il vocabolario che il modello deve
// produrre (validato da VALID_MOODS in aiRecommendationService) e il bersaglio
// di getMoodForTags. Chiavi in ASCII minuscolo, nessuna normalizzazione accenti.
//
export const MAP_MOODS = {
  romantico: { tags: ['Romantico'] },
  storia:    { tags: ['Storia', 'Cultura'] },
  avventura: { tags: ['Avventura'] },
  natura:    { tags: ['Natura'] },
  cibo:      { tags: ['Cibo', 'Gastronomia'] },
  shopping:  { tags: ['Shopping'] },
  arte:      { tags: ['Arte'] },
  sorpresa:  { tags: ['Sorpresa'] },
  sport:     { tags: ['Sport'] },
  // Notturno: selezionato automaticamente dopo le 20 da getMoodForTags.
  notturno:  { tags: [] },
  default:   { tags: [] },
}

// getMoodForTags(tags) → mood key
//
// Returns the key of the first MAP_MOODS entry whose tags array contains
// at least one of the given tour tags.  Falls back to 'default'.
//
// Usage:
//   const mood = getMoodForTags(tour.tags)       // e.g. 'romantico'
//
export const getMoodForTags = (tags = []) => {
  // Auto notturno dopo le 20
  const hour = new Date().getHours()
  if (hour >= 20 || hour < 6) return 'notturno'

  if (!Array.isArray(tags) || tags.length === 0) return 'default'
  for (const [key, mood] of Object.entries(MAP_MOODS)) {
    if (key === 'default' || key === 'notturno') continue
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
