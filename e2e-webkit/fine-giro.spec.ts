// FINE-GIRO — prova in WebKit (iPhone 14): un giro ripreso con 2 tappe su 3 raggiunte, «Fine» → il Profilo passa da 0 a 1 giro.
// Il registro (dna_events) è un finto stateful: l'INSERT dell'app finisce lì e la lettura del Profilo lo rilegge.
import { test, expect } from '../e2e/fixtures/mock-app'

const USER_ID = '00000000-0000-4000-8000-000000000001'
const STEP = (id: string, title: string, lat: number, lng: number) => ({
    id, title, lat, lng, moment: 'mattina', types: ['tourist_attraction'], primaryType: 'tourist_attraction', stayMinutes: 20,
    description: 'Una tappa di prova.', scheduledTime: '2026-10-30T09:30:00+01:00',
})
const TOUR = {
    id: 'tour-webkit-fine', title: 'Giro di prova', city: 'Roma',
    steps: [STEP('s1', 'Piazza di prova', 41.9, 12.5), STEP('s2', 'Fontana di prova', 41.901, 12.501), STEP('s3', 'Museo di prova', 41.902, 12.502)],
}

test('«Fine» a metà giro: il Profilo passa da 0 a 1 giro', async ({ mockedPage: page, context }) => {
    const registro: Record<string, unknown>[] = []
    await page.route('**/test.supabase.co/rest/v1/dna_events**', async route => {
        const req = route.request()
        if (req.method() === 'POST') {
            const body = req.postDataJSON()
            for (const r of (Array.isArray(body) ? body : [body])) registro.push({ id: `ev-${registro.length + 1}`, created_at: new Date().toISOString(), ...r })
            return route.fulfill({ status: 201, contentType: 'application/json', body: '[]' })
        }
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(registro) })
    })
    await context.grantPermissions(['geolocation'])
    await context.setGeolocation({ latitude: 41.9, longitude: 12.5 })

    // 1) il Profilo prima: 0 giri
    await page.goto('/profile')
    await expect(page.getByTestId('contatore-giri')).toHaveText('0')

    // 2) un giro in corso con 2 tappe su 3 già raggiunte, ripreso dalla Home
    await page.evaluate(({ tour }) => {
        localStorage.setItem('dvai_nav_giro_v1', JSON.stringify({
            v: 1, chiave: `id:${tour.id}`, tourData: tour, completedSteps: ['s1', 's2'], skippedSteps: [],
            targetStepId: null, singleTarget: false, startedAt: Date.now() - 40 * 60_000, mode: 'walking', savedAt: Date.now(),
        }))
    }, { tour: TOUR })
    await page.goto('/')
    await page.getByRole('button', { name: 'Riprendi' }).first().click()

    // 3) «Fine» dalla scheda aperta
    await page.getByTestId('nav-scheda-maniglia').click()
    await page.getByLabel('Termina navigazione').click()
    await expect(page.getByTestId('fine-giro')).toBeVisible()
    await expect(page.getByTestId('fine-nota')).toHaveText('Sei arrivato a 2 tappe su 3.')
    expect(registro.filter(r => r.kind === 'tour_completed').length).toBeGreaterThan(0)
    expect(registro.find(r => r.kind === 'tour_completed')).toMatchObject({ user_id: USER_ID, tour_id: 'tour-webkit-fine', value: '2/3' })

    // 4) il Profilo dopo: 1 giro
    await page.goto('/profile')
    await expect(page.getByTestId('contatore-giri')).toHaveText('1')
})
