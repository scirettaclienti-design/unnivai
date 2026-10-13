## Verifiche iniziali

| Controllo | Esito |
|---|---|
| Cartella | `~/unnivai-1b` |
| HEAD | ✅ `ce135b5` (uguale al remoto: `git ls-remote origin main`), albero pulito |
| Suite | ✅ 129 file, **1757 test verdi** (`npm run test:run`) |
| Permessi di corsia | `docs/corsia-e-permessi.json` è `{}`: nessun file concesso a un branch estetica |

## 1. Diagnosi (a 0 $): perché Veloce Catania relax alle 21:45 e alle 23:30 dava "quasi tutto chiuso"

Fonti, tutte già pagate: i grezzi del banco (`2026-10-13-banco-esteso-continuita.json`, `…-composizione.json`), la cache dei posti su Supabase (`places_cache`: tipi, nome e `opening_hours` di ogni posto già cercato) e le funzioni pure del codice di prima (`ce135b5`). Nessuna chiamata a Google, nessuna chiamata AI.

**Lo scheletro, col codice di prima** (finestra "da adesso" per 2 ore, `resolveTourWindow` + `buildDaySkeleton`):

| Ora | Finestra | Momenti nello scheletro |
|---|---|---|
| 18:00 | 18:00–20:00 | `aperitivo` 120' ×1 (e basta: la cena comincia quando la finestra finisce) |
| 19:30 | 19:30–21:30 | `cena` 90' ×1 |
| **21:25** | 21:25–23:25 | `cena` 65' ×1 |
| **21:45** | 21:45–23:45 | **nessuno** (la cena ne ha 45 su 60; il dopocena non è ammesso: né "Vita Notturna" né ritmo Intenso) |
| **23:30** | 23:30–01:30 | **nessuno** |

**La catena, nell'ordine in cui avviene** (`src/services/aiRecommendationService.js`):

1. `moments = candidates.length >= 1 ? flattenSkeleton(skeleton) : []` → con lo scheletro vuoto `moments = []` e `buckets = null`.
2. Le ricerche mirate nascono dai momenti (`shortMomentThemes(moments, …)`): senza momenti `extraThemes = []`. **La ricerca dei bar (`nightlife`) non parte mai**, perché il bar vive nei momenti `aperitivo` e `dopocena`, che a quest'ora non ci sono.
3. Il pool resta quello della sola ricerca del traduttore, cioè **spa e centri benessere** (umore Relax): 33 candidati visti nel grezzo, 45 posti spa/benessere distinti nella cache, **0 aperti per 60 minuti** alle 21:45 e alle 23:30.
4. Il selettore sceglie fra quei posti (flusso senza scheletro), `keepOpenStops` toglie quelli chiusi quando ci si arriva (5 chiusi nel grezzo delle 21:45: L'Universo del Relax, Charme & Relax, I Consulenti del Benessere, Magma Harmony SPA, Rosa del Deserto; `tappeSenzaFiltro: 5`).
5. `orariAgito && tappeAperte < 2 && tappeAperte < tappeSenzaFiltro` → `_source: 'closed-now'`, messaggio «A quest'ora qui è quasi tutto chiuso. Il giro giusto parte domattina.» (`:2854`).

**I bar/locali del pool aperti per tutta la sosta** — quelli che la ricerca `nightlife` avrebbe portato (sono nella cache, da altre generazioni di Catania di oggi), con la sosta d'aperitivo di 45 minuti:

- **21:25** — nel pool salvato: 45 posti spa/benessere, **0 aperti per 60 min**; 26 bar/locali trovati dalla ricerca `nightlife`, **22 aperti per 45 min** (la sosta d'aperitivo): Bar Popolare · Retrò - Cocktail Bar · The Rabbit Hole · Mezzaparola Cocktail Art Pub · Bohème Mixology Bar · Drinkeria cocktail bar · First · Vinicolo_cocktail lab. · Sotto Palazzo | Cocktail e Sapori · Sipario Hidden Bar · Thirsty Corner · Civita - Beats, Bites & Bottles · Big Daddy's · BarnAut · CO2 · Vinicolo Hub · Razmataz | Wine Bar Catania · The Orange Pub · The Broken Barrel Bar · Magma 2.0 Drink & Food · Boston Cocktail Bar · Petit Bonu ‘.
- **21:45** — nel pool salvato: 45 posti spa/benessere, **0 aperti per 60 min**; 26 bar/locali trovati dalla ricerca `nightlife`, **22 aperti per 45 min** (la sosta d'aperitivo): Bar Popolare · Retrò - Cocktail Bar · The Rabbit Hole · Mezzaparola Cocktail Art Pub · Bohème Mixology Bar · Drinkeria cocktail bar · First · Vinicolo_cocktail lab. · Sotto Palazzo | Cocktail e Sapori · Sipario Hidden Bar · Thirsty Corner · Civita - Beats, Bites & Bottles · Big Daddy's · BarnAut · CO2 · Vinicolo Hub · Razmataz | Wine Bar Catania · The Orange Pub · The Broken Barrel Bar · Magma 2.0 Drink & Food · Boston Cocktail Bar · Petit Bonu ‘.
- **23:30** — nel pool salvato: 45 posti spa/benessere, **0 aperti per 60 min**; 26 bar/locali trovati dalla ricerca `nightlife`, **18 aperti per 45 min** (la sosta d'aperitivo): Bar Popolare · Retrò - Cocktail Bar · The Rabbit Hole · Mezzaparola Cocktail Art Pub · Bohème Mixology Bar · Drinkeria cocktail bar · First · Vinicolo_cocktail lab. · Sotto Palazzo | Cocktail e Sapori · Sipario Hidden Bar · Civita - Beats, Bites & Bottles · BarnAut · Vinicolo Hub · Razmataz | Wine Bar Catania · The Orange Pub · Magma 2.0 Drink & Food · Boston Cocktail Bar · Petit Bonu ‘.

Cioè: il messaggio era **falso**. A Catania alle 21:45 c'erano 22 bar aperti per tutta la sosta; il motore non li ha mai cercati. Il punto esatto in cui vengono scartati non è un filtro: è che **non vengono mai cercati** (scheletro vuoto → nessuna ricerca mirata → pool di sole spa → tutte chiuse).

**21:25** è lo stesso difetto in versione "tour da 1 tappa": lo scheletro ha solo la cena (65 minuti), parte la ricerca del cibo, il giro è una cena sola (nel grezzo CONTINUITA': Trattoria del Lago). Nessun bar, nessuna passeggiata.

**D-CATANIA, "a 21:45 il tour parte ancora senza scheletro?"** Sì, lo conferma la tabella sopra (provata con le funzioni pure del codice di prima) e il grezzo: `pool: null`, `source: closed-now`. Dal 21:31 (cena sotto i 60') alle 22:30 e per tutta la notte lo scheletro era vuoto: è la discontinuità che D-CATANIA aveva segnalato (A2) e che non era stata chiusa.

**Altre due cose trovate scrivendo la diagnosi** (e curate nello stesso task):
- Il Percorso Veloce **non passava né ritmo né umore** (D-CATANIA A3): ritmo sempre Attivo, "Relax" solo un titolo.
- A Crea alle 18:00 il "drink" poteva essere un **belvedere** (la tabella ammette `punti panoramici` all'aperitivo): `crea-catania-1800` col codice di prima è Belvedere Di Carminello (30') → 90 minuti di cammino → una trattoria a 6,8 km. Un belvedere nel pool blocca anche la ricerca dei bar.
