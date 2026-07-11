// Gate F — Smoke E2E config.
//
// Chromium only (target minimo). Preview server (bundle prod) invece del
// dev server: testiamo lo stesso bundle che finisce su Vercel.
//
// Budget locked (Ivano): suite deve stare sotto i 4 minuti in CI.

import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
    testDir: './e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    // 4 workers max — chromium è memory-hungry; CI runner Ubuntu ha 2 core.
    workers: process.env.CI ? 2 : undefined,
    timeout: 30_000,
    expect: { timeout: 5_000 },
    reporter: process.env.CI
        ? [['github'], ['list']]
        : 'list',
    use: {
        baseURL: 'http://localhost:4173',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'off',
        // I test iniettano session mock + intercettano rete: nessuna chiamata
        // reale a Supabase/OpenAI/Google/Nominatim durante l'esecuzione.
    },
    projects: [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    ],
    // Preview del bundle prod (build già fatto in CI dallo step build).
    // Locale: se il preview già gira su :4173, riusa.
    webServer: {
        command: 'npm run preview -- --port 4173 --strictPort',
        url: 'http://localhost:4173',
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
        stdout: 'ignore',
        stderr: 'pipe',
    },
})
