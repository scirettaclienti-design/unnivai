# Inventario emoji usate come icona

Elenco delle emoji che in `src/` fanno da icona nell'interfaccia, con l'icona `lucide-react` (0.562.0) proposta per sostituirle. Data: 10/10/2026. **Nessuna emoji è stata sostituita**: questo file è solo un inventario.

Criterio usato: è "icona" un'emoji mostrata a schermo come segno grafico, cioè isolata (box, avatar, marker), davanti o dopo un'etichetta breve (chip, bottone, tab, badge, intestazione, voce di elenco, riquadro di avviso), oppure presa da una mappa dati che finisce a schermo. Le emoji dentro frasi (toast, notifiche, banner di testo) stanno nella sezione "Emoji dentro testi".

Totale: **149 righe-icona** (una riga per emoji, quindi una riga di codice con più emoji compare più volte), **76 emoji distinte**, **21 file**. Ogni nome di icona proposto è stato controllato su `node_modules/lucide-react/dist/esm/icons/<kebab-name>.js` e sugli export di `lucide-react`.

## Tabella per file

### src/pages/QuickPath.jsx (26)

Sotto-opzioni per città (`CITY_CONFIG`), mostrate nel riquadro di anteprima a `QuickPath.jsx:897` (`{subOption.emoji}`).

| Riga | Emoji | Cosa rappresenta | Icona proposta (lucide-react) |
|---|---|---|---|
| src/pages/QuickPath.jsx:274 | 🛵 | Roma, "Rioni Storici" | Scooter |
| src/pages/QuickPath.jsx:275 | ⛲ | Roma, "Piazze Eterne" | Droplets |
| src/pages/QuickPath.jsx:276 | 🛍️ | Roma, "Via del Corso" (shopping) | ShoppingBag |
| src/pages/QuickPath.jsx:279 | 🌳 | Roma, "Ville Nobiliari" | TreeDeciduous |
| src/pages/QuickPath.jsx:280 | 🚴 | Roma, "Lungo il Tevere" (ciclabile) | Bike |
| src/pages/QuickPath.jsx:283 | ⚔️ | Roma, "Roma Imperiale" | Swords |
| src/pages/QuickPath.jsx:284 | ⛪ | Roma, "Roma Barocca" | Church |
| src/pages/QuickPath.jsx:287 | 🍕 | Roma, "Street Food" | Pizza |
| src/pages/QuickPath.jsx:288 | 🍝 | Roma, "Carbonara Tour" | UtensilsCrossed |
| src/pages/QuickPath.jsx:296 | ⛪ | Milano, "Zona Duomo" | Church |
| src/pages/QuickPath.jsx:297 | 🏙️ | Milano, "Skyline Gae Aulenti" | Building2 |
| src/pages/QuickPath.jsx:300 | 👠 | Milano, "Quadrilatero" (moda) | Gem |
| src/pages/QuickPath.jsx:301 | 🕶️ | Milano, "Vintage Brera" | Glasses |
| src/pages/QuickPath.jsx:304 | 🏰 | Milano, "Parco Sempione" (Castello) | Castle |
| src/pages/QuickPath.jsx:307 | 🥂 | Milano, "I Navigli" (aperitivo) | Wine |
| src/pages/QuickPath.jsx:315 | 🌊 | Napoli, "Lungomare" | Waves |
| src/pages/QuickPath.jsx:316 | 📸 | Napoli, "Posillipo" (panorami) | Camera |
| src/pages/QuickPath.jsx:319 | 🌶️ | Napoli, "Spaccanapoli" | Flame |
| src/pages/QuickPath.jsx:320 | 🎭 | Napoli, "Quartieri Spagnoli" | Drama |
| src/pages/QuickPath.jsx:323 | 🌋 | Napoli, "Vesuvio View" | Mountain |
| src/pages/QuickPath.jsx:326 | 🍕 | Napoli, "Vera Pizza" | Pizza |
| src/pages/QuickPath.jsx:327 | 🧁 | Napoli, "Sfogliatella" (pasticceria) | CakeSlice |
| src/pages/QuickPath.jsx:335 | 🏰 | Default, "Centro Storico" | Castle |
| src/pages/QuickPath.jsx:336 | 🌳 | Default, "Parchi e Verde" | TreeDeciduous |
| src/pages/QuickPath.jsx:337 | 🏛️ | Default, "Cultura e Musei" | Landmark |
| src/pages/QuickPath.jsx:338 | 🧖 | Default, "Benessere" | Bath |

### src/pages/DashboardBusiness.jsx (26)

| Riga | Emoji | Cosa rappresenta | Icona proposta (lucide-react) |
|---|---|---|---|
| src/pages/DashboardBusiness.jsx:517 | ⚠️ | Avviso: indirizzo non selezionato dal menu | TriangleAlert |
| src/pages/DashboardBusiness.jsx:529 | ⚠️ | Avviso: coordinate mappa mancanti | TriangleAlert |
| src/pages/DashboardBusiness.jsx:690 | 🍕 | `AI_QUIZ_LABELS` "Cibo & Sapori" (emoji estratta a :865) | Pizza |
| src/pages/DashboardBusiness.jsx:690 | 🌿 | `AI_QUIZ_LABELS` "Natura" | Leaf |
| src/pages/DashboardBusiness.jsx:690 | 🏛️ | `AI_QUIZ_LABELS` "Storia" | Landmark |
| src/pages/DashboardBusiness.jsx:691 | 🧖 | `AI_QUIZ_LABELS` "Relax" | Bath |
| src/pages/DashboardBusiness.jsx:691 | 👗 | `AI_QUIZ_LABELS` "Moda" | Shirt |
| src/pages/DashboardBusiness.jsx:691 | 🌙 | `AI_QUIZ_LABELS` "Nightlife" | Moon |
| src/pages/DashboardBusiness.jsx:692 | 🏙️ | `AI_QUIZ_LABELS` "Città" | Building2 |
| src/pages/DashboardBusiness.jsx:692 | ❤️ | `AI_QUIZ_LABELS` "Romantico" | Heart |
| src/pages/DashboardBusiness.jsx:692 | 🍝 | `AI_QUIZ_LABELS` "Carbonara Tour" | UtensilsCrossed |
| src/pages/DashboardBusiness.jsx:693 | 🛍️ | `AI_QUIZ_LABELS` "Shopping" | ShoppingBag |
| src/pages/DashboardBusiness.jsx:693 | 🥪 | `AI_QUIZ_LABELS` "Street Food" | Sandwich |
| src/pages/DashboardBusiness.jsx:774 | 🧭 | Tab "Tour Guida" | Compass |
| src/pages/DashboardBusiness.jsx:775 | 🤖 | Tab "Tour AI" | Bot |
| src/pages/DashboardBusiness.jsx:802 | 📍 | Intestazione "Come funziona sulle Mappe" | MapPin |
| src/pages/DashboardBusiness.jsx:806 | 👑 | Voce "Vantaggio Elite" (mappe) | Crown |
| src/pages/DashboardBusiness.jsx:807 | ⭐ | Voce "Piano Base" (mappe) | Star |
| src/pages/DashboardBusiness.jsx:822 | ⚠️ | Avviso: compila indirizzo e categoria | TriangleAlert |
| src/pages/DashboardBusiness.jsx:827 | 🧠 | Intestazione "Caratteristiche rilevate dall'IA" | Brain |
| src/pages/DashboardBusiness.jsx:851 | 🤖 | Intestazione "Come ti trova l'IA" | Bot |
| src/pages/DashboardBusiness.jsx:855 | 👑 | Voce "Vantaggio Elite" (IA) | Crown |
| src/pages/DashboardBusiness.jsx:856 | ⭐ | Voce "Piano Base" (IA) | Star |
| src/pages/DashboardBusiness.jsx:861 | 🗺️ | Intestazione "Ti troveranno i turisti..." | Map |
| src/pages/DashboardBusiness.jsx:874 | 💡 | Suggerimento "Scegli le Categorie..." | Lightbulb |
| src/pages/DashboardBusiness.jsx:879 | 🔀 | Intestazione "Come le tue Categorie si legano..." | Shuffle |

### src/pages/Landing.jsx (21)

| Riga | Emoji | Cosa rappresenta | Icona proposta (lucide-react) |
|---|---|---|---|
| src/pages/Landing.jsx:61 | 🏛️ | Pin demo "Colosseo" sulla mappa finta | Landmark |
| src/pages/Landing.jsx:62 | 🍝 | Pin demo "Trattoria" | UtensilsCrossed |
| src/pages/Landing.jsx:63 | 🎨 | Pin demo "Galleria" | Palette |
| src/pages/Landing.jsx:64 | 🌅 | Pin demo "Belvedere" | Sunset |
| src/pages/Landing.jsx:65 | ☕ | Pin demo "Bar" | Coffee |
| src/pages/Landing.jsx:123 | 🏛️ | Riquadro "Esperienze trovate" | Landmark |
| src/pages/Landing.jsx:146 | ☕ | Tappa demo "colazione" (resa a :193) | Coffee |
| src/pages/Landing.jsx:147 | 🏛️ | Tappa demo "cultura" | Landmark |
| src/pages/Landing.jsx:148 | 🍝 | Tappa demo "pranzo" | UtensilsCrossed |
| src/pages/Landing.jsx:149 | 🎨 | Tappa demo "arte" | Palette |
| src/pages/Landing.jsx:150 | 🌅 | Tappa demo "panorama" | Sunset |
| src/pages/Landing.jsx:410 | 🗺️ | Chip "Mappa reale" | Map |
| src/pages/Landing.jsx:410 | 📍 | Chip "Coordinate vere" | MapPin |
| src/pages/Landing.jsx:410 | 🌍 | Chip "Ogni città italiana" | Globe |
| src/pages/Landing.jsx:411 | 🧠 | Chip "AI personalizzata" | Brain |
| src/pages/Landing.jsx:411 | ⏱️ | Chip "In pochi secondi" | Timer |
| src/pages/Landing.jsx:411 | 🎯 | Chip "Sui tuoi interessi" | Target |
| src/pages/Landing.jsx:412 | 🗺️ | Chip "Marker sui punti veri" | Map |
| src/pages/Landing.jsx:412 | 📖 | Chip "Fatti verificabili" | BookOpen |
| src/pages/Landing.jsx:412 | 🕒 | Chip "Orari veri" | Clock |
| src/pages/Landing.jsx:440 | 🎉 | Bottone "Inizia Gratis ora" (ha già `ArrowRight`) | PartyPopper |

### src/lib/categoryPalette.js (18)

Righe 8-35: `getCategoryStyles()`, emoji nel pallino dei marker mappa (`MapMarker.jsx:60`, ramo non-tappa). Righe 68-168: `COVER_GRADIENTS`, emoji mostrata in grande come segnaposto senza foto in `POIDetailDrawer.jsx:122` (`palette.icon`); ogni voce ha già un `IconComponent` lucide accanto, riusato qui sotto come proposta.

| Riga | Emoji | Cosa rappresenta | Icona proposta (lucide-react) |
|---|---|---|---|
| src/lib/categoryPalette.js:8 | 📍 | Marker tappa/waypoint (mostrato solo se il marker non ha numero) | MapPin |
| src/lib/categoryPalette.js:11 | ⭐ | Marker business partner | Star |
| src/lib/categoryPalette.js:17 | 🍝 | Marker categoria cibo/ristorazione | UtensilsCrossed |
| src/lib/categoryPalette.js:20 | 🛍️ | Marker categoria shopping | ShoppingBag |
| src/lib/categoryPalette.js:23 | ☕ | Marker categoria bar/caffè | Coffee |
| src/lib/categoryPalette.js:26 | 🏛️ | Marker categoria storia/museo | Landmark |
| src/lib/categoryPalette.js:29 | 🎨 | Marker categoria arte | Palette |
| src/lib/categoryPalette.js:32 | 🌲 | Marker categoria natura/parco | Trees |
| src/lib/categoryPalette.js:35 | 📌 | Marker categoria sconosciuta (fallback, anche per drawer via :188) | Pin |
| src/lib/categoryPalette.js:68 | 👣 | Copertina "walking/vicoli/avventura" | Footprints |
| src/lib/categoryPalette.js:80 | 🍝 | Copertina cibo | UtensilsCrossed |
| src/lib/categoryPalette.js:92 | 🛍️ | Copertina shopping | ShoppingBag |
| src/lib/categoryPalette.js:106 | 🏛️ | Copertina storia/cultura | Landmark |
| src/lib/categoryPalette.js:118 | 🎨 | Copertina arte | Palette |
| src/lib/categoryPalette.js:130 | ☕ | Copertina bar/relax | Coffee |
| src/lib/categoryPalette.js:144 | 🌅 | Copertina tramonto/romance/nightlife | Sunset |
| src/lib/categoryPalette.js:156 | 🌲 | Copertina natura | Trees |
| src/lib/categoryPalette.js:168 | ✨ | Copertina generica/sorpresa | Sparkles |

### src/pages/TourLive.jsx (12)

Pagina raggiungibile da `/tour-live` (`App.jsx:150`).

| Riga | Emoji | Cosa rappresenta | Icona proposta (lucide-react) |
|---|---|---|---|
| src/pages/TourLive.jsx:121 | 🎯 | Icona animata dell'intestazione | Target |
| src/pages/TourLive.jsx:158 | 🔴 | Intestazione "LIVE ORA" | Radio |
| src/pages/TourLive.jsx:168 | 📺 | Icona animata del riquadro live | Tv |
| src/pages/TourLive.jsx:266 | 🍝 | Categoria tour `food` | UtensilsCrossed |
| src/pages/TourLive.jsx:267 | 🎨 | Categoria tour `culture` | Palette |
| src/pages/TourLive.jsx:268 | 🗺️ | Categoria tour `adventure` | Map |
| src/pages/TourLive.jsx:268 | ✨ | Categoria tour di riserva | Sparkles |
| src/pages/TourLive.jsx:302 | 💬 | Conteggio recensioni | MessageCircle |
| src/pages/TourLive.jsx:395 | 🔴 | Bottone "Scopri" (ha già `Play`) | Radio |
| src/pages/TourLive.jsx:404 | 📅 | Bottone "Prenota" (ha già `Calendar`) | Calendar |
| src/pages/TourLive.jsx:448 | 🚀 | Bottone "Esplora tutto" (ha già `Zap`) | Rocket |
| src/pages/TourLive.jsx:467 | 🎁 | Bottone "Sorprendimi" (ha già `Gift`) | Gift |

### src/services/aiRecommendationService.js (6)

Icona meteo del giorno, resa in `AiItinerary.jsx:615` (`{day.weather.icon}`).

| Riga | Emoji | Cosa rappresenta | Icona proposta (lucide-react) |
|---|---|---|---|
| src/services/aiRecommendationService.js:2445 | ☀️ | Meteo soleggiato (`generateItinerary`) | Sun |
| src/services/aiRecommendationService.js:2446 | 🌧️ | Meteo piovoso (`generateItinerary`) | CloudRain |
| src/services/aiRecommendationService.js:2446 | ⛅ | Meteo variabile/di riserva (`generateItinerary`) | CloudSun |
| src/services/aiRecommendationService.js:3526 | 🌧️ | Meteo piovoso (`generateSystemPrewarmTour`) | CloudRain |
| src/services/aiRecommendationService.js:3526 | ☀️ | Meteo soleggiato (`generateSystemPrewarmTour`) | Sun |
| src/services/aiRecommendationService.js:3526 | ⛅ | Meteo variabile (`generateSystemPrewarmTour`) | CloudSun |

### src/pages/AiItinerary.jsx (5)

Emoji delle domande di preferenza, rese a `AiItinerary.jsx:449` davanti al titolo.

| Riga | Emoji | Cosa rappresenta | Icona proposta (lucide-react) |
|---|---|---|---|
| src/pages/AiItinerary.jsx:30 | 💰 | Domanda "Budget" | Wallet |
| src/pages/AiItinerary.jsx:31 | ⏱️ | Domanda "Durata" | Timer |
| src/pages/AiItinerary.jsx:32 | 🎯 | Domanda "Interessi" | Target |
| src/pages/AiItinerary.jsx:33 | 👥 | Domanda "Gruppo" | Users |
| src/pages/AiItinerary.jsx:34 | 🚀 | Domanda "Ritmo" | Rocket |

### src/components/ToastNotification.jsx (5)

Icona del toast (`getEmoji()`, resa a :66). Le righe 38-39 mancavano nell'elenco grezzo (ℹ️ è U+2139, fuori dal filtro usato).

| Riga | Emoji | Cosa rappresenta | Icona proposta (lucide-react) |
|---|---|---|---|
| src/components/ToastNotification.jsx:35 | ✅ | Toast di successo | CircleCheck |
| src/components/ToastNotification.jsx:36 | ❌ | Toast di errore | CircleX |
| src/components/ToastNotification.jsx:37 | ⚠️ | Toast di avviso | TriangleAlert |
| src/components/ToastNotification.jsx:38 | ℹ️ | Toast informativo | Info |
| src/components/ToastNotification.jsx:39 | ℹ️ | Toast di riserva (default) | Info |

### src/pages/Trending.jsx (5)

Passate a `ComingSoonOverlay` (icona grande a :95, elenco funzioni a :112).

| Riga | Emoji | Cosa rappresenta | Icona proposta (lucide-react) |
|---|---|---|---|
| src/pages/Trending.jsx:10 | 🔥 | Icona principale "Trending Ora" | Flame |
| src/pages/Trending.jsx:17 | 📊 | Funzione "Classifiche live" | ChartColumn |
| src/pages/Trending.jsx:18 | 🏆 | Funzione "Top esperienze" | Trophy |
| src/pages/Trending.jsx:19 | 🌍 | Funzione "Per città" | Globe |
| src/pages/Trending.jsx:20 | ⚡ | Funzione "Ultimi posti" | Zap |

### src/pages/guide/TourBuilder.jsx (5)

| Riga | Emoji | Cosa rappresenta | Icona proposta (lucide-react) |
|---|---|---|---|
| src/pages/guide/TourBuilder.jsx:645 | 📍 | Riquadro "Clicca sulla mappa per aggiungere una tappa" | MapPin |
| src/pages/guide/TourBuilder.jsx:726 | ✏️ | Bottone "Modifica Info" | Pencil |
| src/pages/guide/TourBuilder.jsx:732 | 🗺 | Bottone "Modifica Mappa" | Map |
| src/pages/guide/TourBuilder.jsx:739 | 💾 | Bottone "Salva Modifiche" | Save |
| src/pages/guide/TourBuilder.jsx:739 | 🚀 | Bottone "Pubblica Ora" | Rocket |

### src/components/MVPEnhancements.jsx (4)

Componente **non importato da nessun file** (codice morto): le icone non arrivano oggi a schermo.

| Riga | Emoji | Cosa rappresenta | Icona proposta (lucide-react) |
|---|---|---|---|
| src/components/MVPEnhancements.jsx:50 | 🎯 | Card "Mercato TAM" | Target |
| src/components/MVPEnhancements.jsx:55 | 🤖 | Card "Tecnologia AI Avanzata" | Bot |
| src/components/MVPEnhancements.jsx:60 | 🌍 | Card "Network Locale Unico" | Globe |
| src/components/MVPEnhancements.jsx:65 | 🚀 | Card "Modello B2B2C Scalabile" | Rocket |

### src/pages/SurpriseTour.jsx (4)

Tipi di sorpresa, resi a `SurpriseTour.jsx:623`.

| Riga | Emoji | Cosa rappresenta | Icona proposta (lucide-react) |
|---|---|---|---|
| src/pages/SurpriseTour.jsx:18 | 🍕 | "Tour Gastronomico" | Pizza |
| src/pages/SurpriseTour.jsx:25 | 🏛️ | "Avventura Culturale" | Landmark |
| src/pages/SurpriseTour.jsx:32 | 🌿 | "Esperienza Naturale" | Leaf |
| src/pages/SurpriseTour.jsx:39 | 🎲 | "Sorpresa Totale" | Dices |

### src/pages/BecomeGuide.jsx (2)

| Riga | Emoji | Cosa rappresenta | Icona proposta (lucide-react) |
|---|---|---|---|
| src/pages/BecomeGuide.jsx:272 | 🚀 | Intestazione "Perché DoveVai?" | Rocket |
| src/pages/BecomeGuide.jsx:282 | ⚠️ | Riquadro errore di invio | TriangleAlert |

### src/pages/DashboardGuide.jsx (2)

| Riga | Emoji | Cosa rappresenta | Icona proposta (lucide-react) |
|---|---|---|---|
| src/pages/DashboardGuide.jsx:515 | 🎓 | Badge "GUIDA PRO" | GraduationCap |
| src/pages/DashboardGuide.jsx:515 | 🏠 | Badge "LOCAL HOST" | House |

### src/services/tourShape.js (2)

Avatar di riserva della guida, reso come testo in `TourDetails.jsx:890` e `TourLive.jsx:282`.

| Riga | Emoji | Cosa rappresenta | Icona proposta (lucide-react) |
|---|---|---|---|
| src/services/tourShape.js:497 | 🤖 | Avatar di riserva, tour generato da AI | Bot |
| src/services/tourShape.js:497 | 👋 | Avatar di riserva, tour di una guida | Hand |

### src/App.jsx (1)

| Riga | Emoji | Cosa rappresenta | Icona proposta (lucide-react) |
|---|---|---|---|
| src/App.jsx:67 | 🗺️ | Logo nella schermata di caricamento (fallback di Suspense) | Map |

### src/components/ComingSoonOverlay.jsx (1)

| Riga | Emoji | Cosa rappresenta | Icona proposta (lucide-react) |
|---|---|---|---|
| src/components/ComingSoonOverlay.jsx:13 | 📸 | Icona di default della prop `icon` (oggi l'unico chiamante, Trending, la sovrascrive) | Camera |

### src/pages/GuidePlaceholder.jsx (1)

| Riga | Emoji | Cosa rappresenta | Icona proposta (lucide-react) |
|---|---|---|---|
| src/pages/GuidePlaceholder.jsx:29 | 🚧 | Pagina "in costruzione" | Construction |

### src/pages/MapPage.jsx (1)

| Riga | Emoji | Cosa rappresenta | Icona proposta (lucide-react) |
|---|---|---|---|
| src/pages/MapPage.jsx:1747 | 📍 | Bottone "Attiva posizione" | MapPin |

### src/pages/NotFound.jsx (1)

| Riga | Emoji | Cosa rappresenta | Icona proposta (lucide-react) |
|---|---|---|---|
| src/pages/NotFound.jsx:19 | 🗺️ | Illustrazione della pagina 404 | Map |

### src/pages/TourDetails.jsx (1)

| Riga | Emoji | Cosa rappresenta | Icona proposta (lucide-react) |
|---|---|---|---|
| src/pages/TourDetails.jsx:541 | 👤 | Avatar di riserva della guida (reso a :890) | User |

## Simboli non-emoji con funzione di icona

Non sono emoji (sono simboli Unicode testuali) e non entrano nei conteggi sopra, ma fanno da icona e andrebbero trattati allo stesso modo.

| Riga | Simbolo | Cosa rappresenta | Icona proposta (lucide-react) |
|---|---|---|---|
| src/components/Map/MapMarker.jsx:60 | ✓ | Marker di tappa completata | Check |
| src/pages/Landing.jsx:177 | ✓ | Badge "Pronto" | Check |
| src/pages/AiItinerary.jsx:827 | ✕ | Bottone di chiusura del dettaglio tappa | X |
| src/pages/DashboardBusiness.jsx:886 | → | Freccia nell'elenco categoria → mood | ArrowRight |
| src/pages/Landing.jsx:622 | → | Bottone "Inizia Gratis" | ArrowRight |
| src/pages/Login.jsx:257 | → | Bottone "Accedi" | ArrowRight |
| src/pages/Login.jsx:350 | → | Bottone "Torna al Login" | ArrowRight |
| src/pages/AiItinerary.jsx:703 | → | Link "Dettagli" | ArrowRight |

## Mappa di sintesi emoji → icona

Una sola icona per emoji, così la sostituzione resta uniforme in tutta l'app.

| Emoji | Icona proposta | Emoji | Icona proposta |
|---|---|---|---|
| 🗺️ / 🗺 | Map | 🔥 | Flame |
| ✅ | CircleCheck | 📊 | ChartColumn |
| ❌ | CircleX | 🏆 | Trophy |
| ⚠️ | TriangleAlert | ⚡ | Zap |
| ℹ️ | Info | 🛵 | Scooter |
| 🎯 | Target | ⛲ | Droplets |
| 🤖 | Bot | 🌳 | TreeDeciduous |
| 🌍 | Globe | 🚴 | Bike |
| 🚀 | Rocket | ⚔️ | Swords |
| 📸 | Camera | ⛪ | Church |
| 📍 | MapPin | 🏙️ | Building2 |
| ⭐ | Star | 👠 | Gem |
| 🍝 | UtensilsCrossed | 🕶️ | Glasses |
| 🛍️ | ShoppingBag | 🏰 | Castle |
| ☕ | Coffee | 🥂 | Wine |
| 🏛️ | Landmark | 🌊 | Waves |
| 🎨 | Palette | 🌶️ | Flame |
| 🌲 | Trees | 🎭 | Drama |
| 📌 | Pin | 🌋 | Mountain |
| 👣 | Footprints | 🧁 | CakeSlice |
| 🌅 | Sunset | 🧖 | Bath |
| ✨ | Sparkles | 💰 | Wallet |
| 🧠 | Brain | 👥 | Users |
| ⏱️ | Timer | 👗 | Shirt |
| 📖 | BookOpen | 🌙 | Moon |
| 🕒 | Clock | ❤️ | Heart |
| 🎉 | PartyPopper | 🥪 | Sandwich |
| 🔴 | Radio | 🧭 | Compass |
| 📺 | Tv | 👑 | Crown |
| 💬 | MessageCircle | 🔀 | Shuffle |
| 📅 | Calendar | 💡 | Lightbulb |
| 🎁 | Gift | 🎓 | GraduationCap |
| 🍕 | Pizza | 🏠 | House |
| 🌿 | Leaf | ✏️ | Pencil |
| 🎲 | Dices | 💾 | Save |
| ☀️ | Sun | 👤 | User |
| 🌧️ | CloudRain | 👋 | Hand |
| ⛅ | CloudSun | 🚧 | Construction |

## Esclusi

L'elenco grezzo aveva 264 righe; con le 2 righe ℹ️ di `ToastNotification.jsx` che mancavano sono 266. Di queste 127 + 2 sono righe-icona (sopra, 149 voci perché alcune righe hanno più emoji) e 8 sono simboli non-emoji. Le altre 129 sono escluse:

| Motivo | Righe |
|---|---|
| Log (`console.*`) | 0 (già tolti dall'elenco grezzo) |
| Prompt inviati al modello AI | 57: `narrationLight.js:323-325`; `aiRecommendationService.js` 501-577, 1085-1336, 1579-1668, 3785-3819; più `aiRecommendationService.js:3080-3081` (`weatherIcon` passato a `buildUnifiedHomeToursPrompt`, che non lo usa) |
| Commenti (anche blocchi JSX `{/* */}` e `//` in coda a una riga) | 24, quasi tutti frecce `→` |
| Testo decorativo (vedi elenco sotto) | 29 |
| Dato che non arriva a schermo | 16: `QuickPath.jsx:358-369` (emoji delle opzioni principali, la UI usa già l'icona lucide `icon`); `dataService.js:194` e `tourShape.js:478` (`itinerary[].emoji`, nessun componente lo legge); `poiService.js:39` (`backgroundMonuments` in `MapPage.jsx:647` viene salvato ma mai reso); `TourDetails.jsx:522` (solo un confronto con '🤖') |
| Pannello di debug (`?debugnav=1`) | 3: `NavDebugPanel.jsx:95`, `NavDebugPanel.jsx:98`, `MapPage.jsx:1255` |

### Emoji dentro testi

Emoji dentro frasi, quasi tutte in toast e notifiche (che hanno già una loro icona). Non le considero icone.

- src/components/ComingSoonOverlay.jsx:133 — toast "Ti avviseremo... 🔔"
- src/components/PromotionalBanner.jsx:6, :7, :8, :9 — banner scorrevole (🎉 🌟 🍇 📱); componente non importato
- src/components/ChatModalUser.jsx:59 — titolo notifica "💬 Risposta da …"
- src/pages/SurpriseTour.jsx:655 — testo del bottone "Domani nuove esperienze 🌅"
- src/pages/MapPage.jsx:457, :1070, :1305, :1338, :1339, :1390, :1391, :1740 — toast (📍 🧭 🎧 🎉 ✨)
- src/pages/DashboardBusiness.jsx:155, :306 — toast (✨ 🚀)
- src/pages/DashboardGuide.jsx:217 — toast (🎓 🏠); :284, :310, :331, :391 — titoli di notifica (🎉 💬 💶 💬)
- src/pages/guide/TourBuilder.jsx:299 — toast (✨ 🚀)
- src/pages/TourDetails.jsx:803 — toast "🔗 Link copiato…"
- src/services/dataService.js:1023 — `✨ ${hook}` messo davanti alla descrizione di una tappa
- src/services/aiRecommendationService.js:3624, :3625, :3626, :3627 — titoli della notifica smart ("Stamattina 🌇", "A pranzo 🍝", "Nel pomeriggio 🗺️", "Stasera 🌆")

## Cosa ho dato per vero senza verificarlo

- **Che le pagine siano raggiungibili.** Ho controllato solo gli import (MVPEnhancements e PromotionalBanner non sono importati da nessun file). Non ho aperto l'app per vedere ogni emoji a schermo.
- **`aiRecommendationService.js:3526`** (`generateSystemPrewarmTour`): presumo che il tour pre-generato finisca in una vista che legge `day.weather.icon` come `AiItinerary.jsx:615`. Non ho seguito il percorso fino in fondo.
- **`categoryPalette.js:8` (📍)**: arriva a schermo solo se un'attività ha `type` waypoint/tour_step ma niente `index`/`sequenceNumber`. Altrimenti il marker mostra il numero. Non so se il caso capiti davvero.
- **Avatar di riserva (`tourShape.js:497`, `TourDetails.jsx:541`)**: `TourDetails.jsx:890` scrive `{tour.guideAvatar}` come testo. Se il valore è un URL di `image_urls`, a schermo finisce l'URL invece della foto. Fuori tema, ma va visto quando si sostituiscono questi avatar.
- **Doppioni con un'icona lucide già presente**: `TourLive.jsx:395/404/448/467`, `Landing.jsx:440` e `QuickPath.jsx:358-369` hanno già un'icona lucide accanto all'emoji o in parallelo. Probabilmente qui basta togliere l'emoji. A `DashboardBusiness.jsx:866` la stessa etichetta `AI_QUIZ_LABELS` viene mostrata intera (con l'emoji) subito dopo l'emoji estratta a :865.
- **Scelte di icona deboli**, perché lucide non ha un equivalente diretto: ⛲ → Droplets (manca `Fountain`), 🌋 → Mountain (manca `Volcano`), 🌶️ → Flame (manca `Pepper`), 👠 → Gem, 🔀 → Shuffle, 🔴 "LIVE" → Radio.
- **Una sola icona per emoji anche dove il significato cambia**: 🚀 vale "Pubblica", "Ritmo", "Perché DoveVai?" ed "Esplora tutto". Rocket va bene per uniformità, ma per "Pubblica Ora" potrebbe servire meglio Send.
- **Confine icona/testo**: i riquadri di avviso con ⚠️/💡/📍 in testa a una frase (es. `DashboardBusiness.jsx:822`, `TourBuilder.jsx:645`) li ho contati come icone. Toast e notifiche con l'emoji in testa (es. `MapPage.jsx:1338`) li ho contati come testo. Anche il bottone `SurpriseTour.jsx:655`, con l'emoji in coda, l'ho messo tra i testi.
