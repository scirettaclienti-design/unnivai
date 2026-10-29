// CURIOSITA-CITTA — prova in WebKit (iPhone 14): giro a Catania camminato per ~1 km, nessuna curiosità (di Roma o altro) a schermo né a voce.
import { test, expect } from '../e2e/fixtures/mock-app'

const STEP = (id: string, title: string, lat: number, lng: number) => ({
    id, title, lat, lng, moment: 'mattina', types: ['tourist_attraction'], primaryType: 'tourist_attraction', stayMinutes: 20,
    description: 'Una tappa di prova.', scheduledTime: '2026-10-30T09:30:00+01:00',
})
const TOUR = {
    id: 'tour-webkit-catania', title: 'Giro di prova', city: 'Catania',
    steps: [STEP('s1', 'Fontana dell\'Elefante', 37.5027, 15.0871), STEP('s2', 'Via Crociferi', 37.505, 15.085), STEP('s3', 'Teatro Massimo Bellini', 37.5038, 15.0903)],
}

test('giro a Catania camminato: nessuna curiosità, né a schermo né a voce', async ({ mockedPage: page, context }) => {
    const voce: string[] = []
    await page.route('**/test.supabase.co/functions/v1/openai-proxy', async route => {
        const b = route.request().postDataJSON()
        if (b?.dv?.purpose === 'voce') voce.push(String(b.dv.testo))
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: '{}' } }] }) })
    })
    await page.addInitScript(() => {
        (window as any).__toast = []
        window.addEventListener('dvai:toast', (e: any) => (window as any).__toast.push(e.detail.message))
    })
    await context.grantPermissions(['geolocation'])
    await context.setGeolocation({ latitude: 37.5027, longitude: 15.0871 })

    await page.goto('/')
    await page.evaluate(({ tour }) => {
        localStorage.setItem('dvai_nav_giro_v1', JSON.stringify({
            v: 1, chiave: `id:${tour.id}`, tourData: tour, completedSteps: [], skippedSteps: [],
            targetStepId: null, singleTarget: false, startedAt: Date.now() - 5 * 60_000, mode: 'walking', savedAt: Date.now(),
        }))
    }, { tour: TOUR })
    await page.goto('/')
    await page.getByRole('button', { name: 'Riprendi' }).first().click()
    await expect(page.getByTestId('nav-scheda-maniglia')).toBeVisible()

    // ~1,2 km a piedi verso nord, un punto ogni ~110 m
    for (let i = 0; i <= 11; i++) {
        await context.setGeolocation({ latitude: 37.5027 + i * 0.001, longitude: 15.0871 })
        await page.waitForTimeout(700)
    }
    await page.waitForTimeout(1500)

    const toast: string[] = await page.evaluate(() => (window as any).__toast)
    expect(toast.filter(m => m.startsWith('🎧'))).toEqual([])
    expect(voce.filter(t => /fontanelle|nasoni|Roma|duemila/i.test(t))).toEqual([])
})
