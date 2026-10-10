# Lavoro in parallelo — le due corsie

Due agenti lavorano sullo stesso repository. Ognuno ha la sua corsia.

## Corsia F — Claude Code (funzionale)

- **Solo Claude Code scrive su `main`.** Nessun altro fa commit, merge o push su `main`.
- Tocca tutto il codice: servizi, logica, hook, test, database, configurazioni.
- Prima di toccare un file, controlla "File in uso" nel backlog.
- Le modifiche estetiche pronte su un branch `estetica/<nome>` le porta su `main`
  Claude Code, dopo averle lette, con un proprio commit (cherry-pick o copia).

## Corsia E — Antigravity (estetica)

- Lavora **solo** su branch `estetica/<nome>` (un nome breve per ogni lavoro,
  es. `estetica/check-olio`).
- **A inizio sessione** riallinea il branch a `origin/main`:
  ```bash
  git fetch origin
  git switch -c estetica/<nome> origin/main     # lavoro nuovo
  # oppure, su un branch gia' esistente e senza lavoro da tenere:
  git switch estetica/<nome> && git reset --hard origin/main
  ```
- **Mai merge**: non fa merge di `main` nel suo branch, non fa merge del suo
  branch in `main`, non apre pull request verso `main` da unire da solo.
- Puo' cambiare **solo** i percorsi dell'elenco qui sotto. Ogni altro file
  cambiato fa fallire la CI del branch (`scripts/check-lane.mjs`, passo
  "Corsia estetica" del job "Lint & Test").
- L'anteprima del suo lavoro la crea Vercel per ogni push sul branch (vedi in fondo).

### Percorsi ammessi nella corsia estetica

Stesso elenco di `ALLOWED_PATHS` in `scripts/check-lane.mjs` (un test controlla
che coincidano). `**/` = qualunque sottocartella, `*` = qualunque nome.

<!-- ELENCO-AMMESSI:INIZIO -->
```
src/index.css
src/components/**/*.css
src/pages/*.css
src/styles/themeTokens.js
src/assets/**/*.{svg,png,jpg,jpeg,webp,avif,gif,ico}
public/**/*.{svg,png,jpg,jpeg,webp,avif,gif,ico}
src/components/PromotionalBanner.jsx
src/components/MVPEnhancements.jsx
src/components/Map/AIAskButton.jsx
src/components/Map/GeminiAskButton.jsx
src/components/Map/VehicleSelectionDrawer.jsx
```
<!-- ELENCO-AMMESSI:FINE -->

Cosa c'e' dentro, oggi:
- **Stile**: `src/index.css`, `src/components/Navigation.css`, i 12 file
  `src/pages/*.css` (Home, AiItinerary, MapPage, Trending, QuickPath, Photos,
  Explore, TourDetails, SurpriseTour, TourLive, Notifications, Profile), e i
  colori di `src/styles/themeTokens.js` (solo valori: non rinominare le chiavi,
  le legge `src/hooks/useTourRouting.js`).
- **Icone e immagini**: `src/assets/`, `public/` (solo file immagine).
- **Componenti puramente grafici**: ricevono props e disegnano; nessun import da
  servizi, logica, hook, contesti; nessuna rete, nessuna navigazione.

### Vietati (elenco non esaustivo: vale l'elenco sopra)

`src/services`, `src/lib`, `src/hooks`, `src/context`, store, `src/data`,
`src/utils`, `src/config`, `supabase/`, `api/`, `scripts/`, i test
(`src/__tests__`, `src/test`, `e2e/`), `package.json`, `package-lock.json`, le
configurazioni (`tailwind.config.js`, `vite.config.js`, `vitest.config.js`,
`eslint.config.js`, `postcss.config.js`, `playwright.config.ts`, `vercel.json`,
`.github/`, `.env*`), le pagine e i componenti `.jsx` fuori dall'elenco, questo
documento e `CLAUDE.md`.

Serve un componente che oggi non e' nell'elenco? Lo chiede a Claude Code, che
lo controlla e, se e' puramente grafico, lo aggiunge qui e in `check-lane.mjs`.

## Anteprime Vercel

- Ogni push su un branch diverso da `main` crea un deploy di **anteprima**
  (Preview); la **produzione** parte solo da `main`.
- Il deploy parte solo dopo che la CI del commit e' verde
  (`vercel-ignored-build-step.sh`, vedi `docs/vercel-ci-gate.md`): un branch
  `estetica/*` fuori corsia non ha CI verde e quindi niente anteprima.
- Il link dell'anteprima:
  - su GitHub, nella pagina del commit o del branch: il segno di spunta accanto
    al commit → "Vercel" → "Details";
  - nella dashboard Vercel → progetto → Deployments, filtrando per branch;
  - l'indirizzo fisso del branch ha la forma
    `https://<progetto>-git-<branch-con-trattini>-<team>.vercel.app`
    (es. `estetica/check-olio` → `...-git-estetica-check-olio-...`).
