// Gate F — Smoke E2E: 6 percorsi critici. Se uno fallisce, CI rosso, Vercel
// non deploya (via Ignored Build Step). È la rete che prende regressioni di
// RENDER e di FLUSSO — quelle che Vitest non vede (crash null, gate silenti).
//
// Strategia dei selettori: verifica STRUTTURA (presenza di guscio pagina) +
// ASSENZA di ErrorBoundary + zero errori JS. Evito assertion su contenuto
// specifico (fragile su copy/traduzioni/refactor).

import { test, expect, FAKE_TOUR } from './fixtures/mock-app'
import type { Page } from '@playwright/test'

const ERROR_BOUNDARY_TEXT = /Qualcosa è andato storto|Something went wrong/i

async function trackConsoleErrors(page: Page) {
    const errors: string[] = []
    page.on('pageerror', err => errors.push(`pageerror: ${err.message}`))
    page.on('console', msg => {
        if (msg.type() === 'error') {
            const t = msg.text()
            // Rumore accettabile: rete abortita (googleapis intenzionalmente bloccato),
            // realtime websocket, refresh token che non parte in ambiente mock.
            const noise = /(net::ERR_|websocket|WebSocket|Failed to fetch|net::ERR_CONNECTION|realtime|channel|Mapbox|mapbox|Google|places|refresh_token|401)/i
            if (!noise.test(t)) errors.push(`console: ${t}`)
        }
    })
    return errors
}

async function assertNoErrorBoundary(page: Page) {
    await expect(page.locator('body')).not.toHaveText(ERROR_BOUNDARY_TEXT, { timeout: 8_000 })
}

test.describe('Smoke E2E — percorsi critici DoveVAI', () => {

    test('1) HOME — Dashboard si apre, no crash, no ErrorBoundary', async ({ mockedPage: page }) => {
        const errors = await trackConsoleErrors(page)
        await page.goto('/dashboard-user')
        await page.waitForLoadState('domcontentloaded')

        await assertNoErrorBoundary(page)
        // La pagina ha un <main> con contenuto (non body vuoto).
        await expect(page.locator('main').first()).toBeVisible({ timeout: 10_000 })
        expect(errors, `Errori JS non gestiti:\n${errors.join('\n')}`).toHaveLength(0)
    })

    test('2a) SCHEDA TOUR — un tour reale si apre, no ErrorBoundary', async ({ mockedPage: page }) => {
        const errors = await trackConsoleErrors(page)
        await page.goto(`/tour-details/${FAKE_TOUR.id}`)
        await page.waitForLoadState('domcontentloaded')

        await assertNoErrorBoundary(page)
        // Almeno il titolo del tour fake appare.
        await expect(page.getByText(FAKE_TOUR.title).first()).toBeVisible({ timeout: 10_000 })
        expect(errors, `Errori JS non gestiti:\n${errors.join('\n')}`).toHaveLength(0)
    })

    test('2b) SCHEDA TOUR — id inesistente → "Questo tour non esiste più", NO crash', async ({ mockedPage: page }) => {
        const errors = await trackConsoleErrors(page)
        // Sovrascrivi la fake tours: il DB torna vuoto per questo id.
        // Discrimina single vs list per emulare Postgrest: `.single()`/`.maybeSingle()`
        // restituisce oggetto o null; una list restituisce array.
        await page.route('**/test.supabase.co/rest/v1/tours*', route => {
            const accept = route.request().headers()['accept'] || ''
            const isSingle = accept.includes('vnd.pgrst.object')
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(isSingle ? null : []),
            })
        })
        await page.goto('/tour-details/deadbeef-dead-4dea-8dea-deadbeefdead')
        await page.waitForLoadState('domcontentloaded')

        await assertNoErrorBoundary(page)
        await expect(page.getByText(/Questo tour non esiste più/i)).toBeVisible({ timeout: 10_000 })
        expect(errors, `Errori JS non gestiti:\n${errors.join('\n')}`).toHaveLength(0)
    })

    test('3) QUICKPATH — wizard si apre e non si blocca (paywall killed)', async ({ mockedPage: page }) => {
        const errors = await trackConsoleErrors(page)
        await page.goto('/quick-path')
        await page.waitForLoadState('domcontentloaded')

        await assertNoErrorBoundary(page)
        await expect(page.locator('main').first()).toBeVisible({ timeout: 10_000 })
        // Devono esserci pulsanti cliccabili (le mood options).
        const clickables = page.locator('button, [role="button"]')
        await expect(clickables.first()).toBeVisible({ timeout: 10_000 })
        expect(errors, `Errori JS non gestiti:\n${errors.join('\n')}`).toHaveLength(0)
    })

    test('4) AI ITINERARY — free-text accetta input', async ({ mockedPage: page }) => {
        const errors = await trackConsoleErrors(page)
        await page.goto('/ai-itinerary')
        await page.waitForLoadState('domcontentloaded')

        await assertNoErrorBoundary(page)
        // Almeno un textarea o input di testo esiste ed è reattivo.
        const textInput = page.locator('textarea, input[type="text"]').first()
        await expect(textInput).toBeVisible({ timeout: 10_000 })
        await textInput.fill('spiagge di Siracusa')
        await expect(textInput).toHaveValue(/spiagge/i)
        expect(errors, `Errori JS non gestiti:\n${errors.join('\n')}`).toHaveLength(0)
    })

    test('5) MAPPA — si apre e non crasha', async ({ mockedPage: page }) => {
        const errors = await trackConsoleErrors(page)
        await page.goto('/map')
        await page.waitForLoadState('domcontentloaded')

        await assertNoErrorBoundary(page)
        // Il body ha contenuto (non deve essere vuoto o solo bianco).
        await expect(page.locator('main, [role="main"], .min-h-screen').first()).toBeVisible({ timeout: 10_000 })
        expect(errors, `Errori JS non gestiti:\n${errors.join('\n')}`).toHaveLength(0)
    })
})
