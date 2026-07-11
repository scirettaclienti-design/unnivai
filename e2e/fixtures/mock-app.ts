// Gate F — Fixture: monta l'app in stato "utente loggato guest" con TUTTE le
// chiamate di rete intercettate (Supabase, OpenAI proxy, Places proxy,
// Nominatim, Google Maps API). Zero rete reale, zero costo, zero flakiness.
//
// Come funziona la session mock:
//   Il client @supabase/supabase-js v2 legge la sessione da localStorage con
//   chiave `sb-<projectRef>-auth-token`. Nel bundle di test il VITE_SUPABASE_URL
//   è "https://test.supabase.co" (da .env di build CI), quindi projectRef=test.
//   Iniettiamo la chiave via addInitScript PRIMA che React monti — al primo
//   getSession() il client restituisce la sessione senza toccare la rete.

import { test as base, Page } from '@playwright/test'

const PROJECT_REF = 'test'
const AUTH_KEY = `sb-${PROJECT_REF}-auth-token`
const USER_ID = '00000000-0000-4000-8000-000000000001' // UUID valido

const FAKE_SESSION = {
    access_token: 'e2e-fake-jwt',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: 9_999_999_999,
    refresh_token: 'e2e-fake-refresh',
    user: {
        id: USER_ID,
        aud: 'authenticated',
        role: 'authenticated',
        email: 'e2e@dovevai.local',
        user_metadata: { role: 'explorer', full_name: 'E2E Tester' },
        app_metadata: { provider: 'email' },
    },
}

// Un tour "reale" fittizio: minimum shape per superare TourUISchema.
export const FAKE_TOUR = {
    id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
    title: 'Tour E2E — passeggiata di prova',
    description: 'Un tour fittizio per verificare che la scheda si apra.',
    city: 'Roma',
    guide_id: 'ffffffff-0000-4000-8000-000000000002',
    is_live: true,
    price_eur: 15,
    duration_minutes: 60,
    image_urls: ['https://picsum.photos/seed/e2e/400/300'],
    rating: 4.5,
    reviews: 12,
    stops: [
        { title: 'Tappa 1 E2E', latitude: 41.9, longitude: 12.5, description: 'Prima tappa' },
        { title: 'Tappa 2 E2E', latitude: 41.91, longitude: 12.51, description: 'Seconda tappa' },
    ],
    // JOIN da mapTourToUI:
    profiles: {
        username: 'e2e-guide',
        first_name: 'Guida',
        last_name: 'E2E',
        image_urls: null,
        bio: null,
    },
}

export const FAKE_PLACES_RESPONSE = {
    results: [
        {
            place_id: 'test_place_1',
            name: 'Piazza E2E Test',
            rating: 4.6,
            user_ratings_total: 100,
            types: ['tourist_attraction'],
            geometry: { location: { lat: 41.9, lng: 12.5 } },
        },
        {
            place_id: 'test_place_2',
            name: 'Museo E2E Test',
            rating: 4.4,
            user_ratings_total: 80,
            types: ['museum'],
            geometry: { location: { lat: 41.905, lng: 12.505 } },
        },
    ],
    status: 'OK',
}

export const FAKE_OPENAI_RESPONSE = {
    choices: [{
        message: {
            content: JSON.stringify({
                days: [{
                    day: 1,
                    title: 'Giornata E2E',
                    stops: [
                        { title: 'Piazza E2E Test', place_id: 'test_place_1', description: 'Bello.', latitude: 41.9, longitude: 12.5 },
                    ],
                    suggestedTransit: 'walking',
                    mapMood: 'default',
                }],
                queries: ['test'],
                categoria: 'misto',
                oggetto_umano: 'posti',
                vincoli: { tempo: null, escludi: [], note: null },
            }),
        },
    }],
}

/**
 * Installa auth mock + route interception sulla pagina. Va chiamato PRIMA
 * di ogni page.goto() dei test.
 */
export async function setupMockedApp(page: Page) {
    // 1) SESSIONE — iniettata prima del mount di React
    // + role fallback in localStorage (letto da RoleGuard se user_metadata non risolve subito).
    // + city manual per stabilità (userContextService priority 1).
    await page.addInitScript(({ key, session }) => {
        try {
            window.localStorage.setItem(key, JSON.stringify(session))
            window.localStorage.setItem('unnivai_role', 'explorer')
            window.localStorage.setItem('user_city', 'Roma')
        } catch { /* private mode */ }
    }, { key: AUTH_KEY, session: FAKE_SESSION })

    // 2) INTERCEPT — qualsiasi chiamata Supabase / proxy / Nominatim / GMaps
    //    torna una risposta finta. Nessuna vera rete.

    // Supabase auth: session/refresh/user
    await page.route('**/test.supabase.co/auth/v1/**', route => {
        const url = route.request().url()
        if (url.includes('/user')) {
            return route.fulfill({ status: 200, contentType: 'application/json',
                body: JSON.stringify(FAKE_SESSION.user) })
        }
        return route.fulfill({ status: 200, contentType: 'application/json',
            body: JSON.stringify(FAKE_SESSION) })
    })

    // Supabase REST: db queries. Distinguo "list" da "single" osservando
    // l'header Accept (postgrest usa vnd.pgrst.object+json per .single()/
    // .maybeSingle()). Per single restituisco un oggetto, per list un array.
    await page.route('**/test.supabase.co/rest/v1/**', async route => {
        const url = new URL(route.request().url())
        const path = url.pathname.split('/').filter(Boolean)
        // path[2] = "tours" | "profiles" | "rpc" | ...
        const table = path[2] || ''
        const accept = route.request().headers()['accept'] || ''
        const isSingle = accept.includes('vnd.pgrst.object')

        // Tours: 1 tour fake per la home + scheda
        if (table === 'tours') {
            const body = isSingle ? FAKE_TOUR : [FAKE_TOUR]
            return route.fulfill({ status: 200, contentType: 'application/json',
                body: JSON.stringify(body) })
        }
        // Profiles: is_unlimited=false (default)
        if (table === 'profiles') {
            const profile = { id: USER_ID, is_unlimited: false, current_city: 'Roma', full_name: 'E2E Tester' }
            const body = isSingle ? profile : [profile]
            return route.fulfill({ status: 200, contentType: 'application/json',
                body: JSON.stringify(body) })
        }
        // Quota
        if (table === 'ai_quota_daily') {
            const row = { count: 0 }
            const body = isSingle ? row : [row]
            return route.fulfill({ status: 200, contentType: 'application/json',
                body: JSON.stringify(body) })
        }
        // Preferences
        if (table === 'user_preferences') {
            return route.fulfill({ status: 200, contentType: 'application/json',
                body: JSON.stringify(isSingle ? null : []) })
        }
        // RPC calls: null (nearby partners, guide rating, ecc.)
        if (table === 'rpc') {
            return route.fulfill({ status: 200, contentType: 'application/json',
                body: JSON.stringify(null) })
        }
        // Notifications / activities / businesses / reviews / guide_requests: []
        return route.fulfill({ status: 200, contentType: 'application/json',
            body: JSON.stringify(isSingle ? null : []) })
    })

    // Supabase realtime (websocket) — Playwright non intercetta ws con route(),
    // ma la connessione può fallire senza rompere l'app (l'error handler è già in place).

    // Supabase RPC
    await page.route('**/test.supabase.co/rest/v1/rpc/**', route => {
        return route.fulfill({ status: 200, contentType: 'application/json',
            body: JSON.stringify(null) })
    })

    // OpenAI proxy edge function
    await page.route('**/test.supabase.co/functions/v1/openai-proxy', route => {
        return route.fulfill({ status: 200, contentType: 'application/json',
            body: JSON.stringify(FAKE_OPENAI_RESPONSE) })
    })

    // Places proxy edge function
    await page.route('**/test.supabase.co/functions/v1/places-proxy**', route => {
        return route.fulfill({ status: 200, contentType: 'application/json',
            body: JSON.stringify(FAKE_PLACES_RESPONSE) })
    })

    // Nominatim reverse geocode (userContextService fallback)
    await page.route('**/nominatim.openstreetmap.org/**', route => {
        return route.fulfill({ status: 200, contentType: 'application/json',
            body: JSON.stringify({ address: { city: 'Roma' } }) })
    })

    // Google Maps API (script inclusion + geocoding esterno) — se il codice
    // prova a caricare la libreria via <script>, blocchiamo per non bruciare
    // quota Google. La mappa può fallire silente, non è nel nostro DoD.
    await page.route(/googleapis\.com/, route => route.abort())
    await page.route(/gstatic\.com/, route => route.abort())

    // ipapi.co — geolocation IP fallback (userContextService)
    await page.route('**/ipapi.co/**', route => {
        return route.fulfill({ status: 200, contentType: 'application/json',
            body: JSON.stringify({ city: 'Roma', country: 'IT', latitude: 41.9, longitude: 12.5 }) })
    })

    // Mapbox tiles + weather / open-meteo — safety net catch-all esterno.
    await page.route(/api\.mapbox\.com|open-meteo\.com|api\.openweathermap/, route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
    )
}

/**
 * Fixture: page pre-configurata con auth mock + intercepts.
 */
export const test = base.extend<{ mockedPage: Page }>({
    mockedPage: async ({ page }, use) => {
        await setupMockedApp(page)
        await use(page)
    },
})

export { expect } from '@playwright/test'
