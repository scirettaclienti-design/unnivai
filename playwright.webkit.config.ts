// Prova WebKit (Safari) della fine giro — a mano, fuori dalla CI: npm run test:e2e:webkit
// Stesso bundle di prova della smoke (vite build --mode e2e), preview su :4173.
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
    testDir: './e2e-webkit',
    timeout: 60_000,
    expect: { timeout: 8_000 },
    reporter: 'list',
    use: { baseURL: 'http://localhost:4173', screenshot: 'only-on-failure' },
    projects: [{ name: 'webkit', use: { ...devices['iPhone 14'] } }],
    webServer: {
        command: 'npm run preview -- --port 4173 --strictPort',
        url: 'http://localhost:4173',
        reuseExistingServer: true,
        timeout: 60_000,
    },
})
