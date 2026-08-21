import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import { MapPin, Star, Clock, Users, Shuffle, ArrowLeft, Sparkles, Gift, Dice1, Zap, Calendar, Heart, ArrowRight, Timer, FileText } from "lucide-react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import TopBar from "../components/TopBar";
import BottomNavigation from "../components/BottomNavigation";

// Gate VERITÀ VISIVA (F26) DIFF 5 — rimossi CITY_IMAGES e getAdaptiveImage.
// Erano 25 URL Unsplash indicizzati per citta' e categoria, usati come
// COPERTINA del tour a sorpresa quando la prima tappa non aveva una foto
// Google. Per "Roma" la voce `art`, `view` e `default` erano tutte e tre il
// Colosseo; per una citta' fuori dalla tabella si cadeva su CITY_IMAGES.default.
// Era lo stesso difetto chiuso dal DIFF 4 su TourDetails e DashboardUser,
// sopravvissuto in un file diverso: uno stock presentato come copertina di
// QUESTO tour. Senza foto reale la copertina e' null e TourCover cade nel ramo
// B illustrato (gradient di categoria + glifo).

// Gate J2: getSurpriseExperiences rimossa. Prima serviva 3 "esperienze"
// hardcoded (€75-95, 4.7-4.9★, foto Unsplash) come tour reali cliccabili.
// Il vero SurpriseTour parte dal pulsante "Genera Esperienza Unica" che
// chiama shuffleExperience → motore AI reale.

const surpriseTypes = [
    {
        id: 1,
        title: "Tour Gastronomico",
        icon: Gift,
        color: "from-red-400 to-red-500",
        emoji: "🍕",
        count: 8,
        categoryName: "Gastronomia"
    },
    {
        id: 2,
        title: "Avventura Culturale",
        icon: Sparkles,
        color: "from-purple-400 to-purple-500",
        emoji: "🏛️",
        count: 6,
        categoryName: "Arte"
    },
    {
        id: 3,
        title: "Esperienza Naturale",
        icon: MapPin,
        color: "from-green-400 to-green-500",
        emoji: "🌿",
        count: 10,
        categoryName: "Natura"
    },
    {
        id: 4,
        title: "Sorpresa Totale",
        icon: Dice1,
        color: "from-orange-400 to-orange-500",
        emoji: "🎲",
        count: 15,
        categoryName: null
    }
];

import { useUserContext } from "@/hooks/useUserContext";
import { useAILearning } from "@/hooks/useAILearning";
import { aiRecommendationService } from "@/services/aiRecommendationService";
import { normalizeTour } from "@/services/tourShape";
import { useToast } from "@/hooks/use-toast";

// Gate NARRATORE/POI (Fase 2a) — decisione pura, esportata per i test.
// Stesso pattern di getTourRenderState (TourDetails, Gate E-1): la scelta sta
// in una funzione pura, il componente la applica e basta.
//
// Il motore restituisce { days: [{ stops: [] }], _source: 'no-results' } quando
// non ha tappe da servire — `days.length` vale 1, non 0. Per questo si guardano
// LE TAPPE e non `_source`: il guard regge per qualunque via il tour si svuoti,
// non solo per i tre `_source` di no-results. È il motivo per cui QuickPath
// (:641-648) non si è mai rotto su questo caso, ed è il modello imitato qui.
//
// @returns {'error'|'empty'|'ready'}
export function getSurpriseOutcome(result) {
    if (!result || !Array.isArray(result.days) || result.days.length === 0) return 'error';
    const stops = result.days[0]?.stops;
    if (!Array.isArray(stops) || stops.length === 0) return 'empty';
    return 'ready';
}

export default function SurpriseTourPage() {
    // DVAI-055: estraggo lat/lng dal userContext per il vincolo geografico
    const { city, userId, firstName, lat, lng } = useUserContext();
    const { toast } = useToast();
    const { userDNAPreferences } = useAILearning();

    const navigate = useNavigate();
    const location = useLocation();
    // Gate PULIZIA P4 (DIFF 6) — rimosso lo state `selectedSurprise`: il setter
    // non era chiamato da nessuna parte e l'unico blocco che lo leggeva era il
    // JSX morto qui sotto. Il termine `!selectedSurprise` nella condizione di
    // autoSuggest era costantemente true, quindi toglierlo non cambia il flusso.
    const [isShuffling, setIsShuffling] = useState(false);
    const [selectedFilter, setSelectedFilter] = useState(null);
    // Gate Z.3: id del tipo cliccato. Distinto da selectedFilter perche'
    // "Sorpresa Totale" (id=4) ha filterMap[4]=null: click su Sorpresa Totale
    // -> selectedFilter=null MA selectedSurpriseType=4 (scelta esplicita).
    // Il bottone Genera si attiva quando selectedSurpriseType !== null.
    const [selectedSurpriseType, setSelectedSurpriseType] = useState(null);
    // DVAI-061 B — Flash pulsante "Domani nuove esperienze 🌅" per 3s quando
    // quota esaurita. Feedback dove l'utente sta guardando (il pulsante), non
    // solo il toast in basso (banner blindness + fuori viewport iPhone).
    const [quotaExhaustedFlash, setQuotaExhaustedFlash] = useState(false);
    const quotaFlashTimerRef = useRef(null);

    const triggerQuotaFlash = () => {
        setQuotaExhaustedFlash(true);
        if (quotaFlashTimerRef.current) clearTimeout(quotaFlashTimerRef.current);
        quotaFlashTimerRef.current = setTimeout(() => setQuotaExhaustedFlash(false), 3000);
    };

    useEffect(() => () => {
        if (quotaFlashTimerRef.current) clearTimeout(quotaFlashTimerRef.current);
    }, []);

    // Dynamic filtered list based on ACTIVE CITY
    // Gate J2: currentExperiences + getFilteredExperiences rimossi (lista finta).

    const filterMap = {
        1: "Gastronomia",
        2: "Arte",
        3: "Natura",
        4: null
    };

    // Gate J2: getFilteredExperiences rimossa (era la funzione che ritornava
    // le 3 esperienze finte filtrate).

    // 🚀 INNESCO AUTOMATICO (se si arriva da una Card Inconscia)
    useEffect(() => {
        if (location.state?.autoSuggest && !isShuffling) {
            // Eseguiamo la simulazione grafica per 1.5 secondi prima di triggerare davvero, o triggeriamo subito.
            // Puliamo lo state per non ciclare se torna indietro
            const suggestion = location.state.autoSuggest;
            window.history.replaceState({ ...window.history.state, usr: { ...location.state, autoSuggest: null } }, '');
            
            // Aspettiamo che la pagina si renderizzi e poi inneschiamo
            setTimeout(() => {
                shuffleExperience(suggestion);
            }, 600);
        }
    }, [location.state?.autoSuggest]);

    const shuffleExperience = async (suggestedTheme = null) => {
        console.log('[DVAI-061] shuffleExperience: click received', { suggestedTheme, city, hasGps: Number.isFinite(lat) && Number.isFinite(lng) });

        // DVAI-061 C — Preflight quota lato client. Se già a limite: feedback
        // immediato sul pulsante (B) + toast, ZERO spinner, ZERO delay.
        // Non blocca guest (authenticated=false → exceeded=false).
        try {
            const quotaStatus = await aiRecommendationService.getDailyQuotaStatus();
            console.log('[DVAI-061] shuffleExperience: quota preflight =', quotaStatus);
            if (quotaStatus.exceeded) {
                console.log('[DVAI-061] shuffleExperience: quota exceeded → flash pulsante + toast (no spinner, no delay)');
                triggerQuotaFlash();
                toast({
                    title: 'Hai esplorato tanto oggi',
                    description: 'Le tue esperienze di oggi sono esaurite. Domani ne troverai di nuove, cucite su di te.',
                    type: 'info',
                    duration: 5000,
                });
                return;
            }
        } catch (preflightErr) {
            console.warn('[DVAI-061] shuffleExperience: preflight failed, proseguo con generation', preflightErr?.message);
        }

        // DVAI-061 A — Feedback immediato: parte lo spinner ora, senza il vecchio
        // await 1500ms hardcoded. Se generateItinerary fallisce in <500ms, il
        // toast/flash arriva subito senza far attendere l'utente sotto finto spinner.
        setIsShuffling(true);
        console.log('[DVAI-061] shuffleExperience: generation started');

        try {
            // 1. Prepare User Context using AI History
            const pastInterests = userDNAPreferences.map(p => {
                const parts = [p.inspiration, p.mood, p.category].filter(Boolean);
                return parts.length > 0 ? parts.join(' ') : null;
            }).filter(Boolean).slice(0, 3);
            const pastPace = userDNAPreferences.find(p => p.duration)?.duration || 'Medio';
            const pastGroup = userDNAPreferences.find(p => p.group)?.group || 'Solo';

            const userProfile = {
                bio: "Profilo vettoriale estratto dalle generazioni passate.",
                interests: suggestedTheme ? [suggestedTheme] : selectedFilter ? [selectedFilter] : (pastInterests.length > 0 ? pastInterests : ["Arte", "Cibo", "Scoperte Urbane"]),
                expectedPace: pastPace,
                expectedGroup: pastGroup
            };

            // DVAI-055: rimosso il "20 km" mal collocato dal userPrompt — il vincolo
            // geografico è ora nel system prompt (regola 15) via cityCenter, e il
            // filtro Haversine a valle lo garantisce anche se l'AI non lo rispetta.
            const prompt = `Sei l'intelligenza di Unnivai. Genera un'esperienza a sorpresa esaltante a ${city || 'Roma'}.
            Dati Storici Inconsci Utente: Cerca ritmi di viaggio [${userProfile.expectedPace}] in compagnia di [${userProfile.expectedGroup}].
            Interessi storici calcolati: ${userProfile.interests.join(', ')}.
            Categoria di oggi: ${suggestedTheme ? suggestedTheme : selectedFilter || 'Mix delle sue più profonde passioni storiche'}.
            L'esperienza DEVE essere fuori dai soliti schemi turistici commerciali e sembrare magia pura, calzando i suoi gusti inconsci.
            NON inventare coordinate.`;

            // 2. Call AI Service
            const result = await aiRecommendationService.generateItinerary(
                city || 'Roma',
                {
                    interests: userProfile.interests,
                    duration: 'Mezza Giornata',
                    budget: 'Medio'
                },
                prompt,
                {},
                '',
                // DVAI-055: cityCenter dal userContext. Se lat/lng assenti, no filtro
                // (retrocompat: fallback al comportamento precedente).
                Number.isFinite(lat) && Number.isFinite(lng) ? { latitude: lat, longitude: lng } : null
            );

            // Gate NARRATORE/POI (Fase 2a) — il check storico
            // (`!result.days || result.days.length === 0`) NON scattava mai sul
            // payload onesto del motore: { days: [{ stops: [] }] } ha
            // days.length === 1. Si arrivava a navigare su un tour a zero tappe.
            const outcome = getSurpriseOutcome(result);
            if (outcome === 'error') throw new Error("AI Generation Failed");
            if (outcome === 'empty') {
                const oggetto = result?._oggetto_umano || null;
                console.warn(`[DVAI-061] shuffleExperience: motore 0 tappe → nessuna navigazione (oggetto="${oggetto || 'n/a'}", source=${result?._source || 'unknown'})`);
                // Registro copy riusato da QuickPath.jsx:1071-1082 (stesso caso,
                // stessa voce). Lo spinner lo spegne il `finally` sotto.
                toast({
                    title: oggetto
                        ? `A ${city || 'Roma'} non troviamo ${oggetto}.`
                        : 'Non basta per un tour.',
                    description: oggetto
                        ? 'Cambia richiesta e riprovo.'
                        : `A ${city || 'Roma'} non ci sono abbastanza posti veri per quello che hai chiesto.`,
                    type: 'info',
                    duration: 6000,
                });
                return;
            }

            // 3. Map to Tour Data Format
            const surpriseTour = result.days[0]; // Take 1st day as the experience

            // Generate Route Path (Linear approximation for now, or use mapService if available)
            // Just connecting dots for visual feedback
            const routeCoords = surpriseTour.stops.map(s => `${s.longitude} ${s.latitude}`).join(', ');
            const routeWKT = `LINESTRING(${routeCoords})`;

            // DVAI-051 + F26 DIFF 5: cover reale dal primo POI (Google Places), oppure
            // nessuna copertina. Il "fallback tematico citta'" e' stato rimosso.
            // Mantiene gli stessi campi narrativi del tour insider per renderizzare
            // "💡 Insider", "Quando:", "→ transizione" nella scheda.
            const stop0 = surpriseTour.stops[0] || {};
            const cover = stop0.googlePhoto || null;

            // DVAI-053: normalizer unificato — stessa shape di Per Te e AiItinerary.
            const mappedTour = normalizeTour({
                id: 'surprise-' + Date.now(),
                title: surpriseTour.title || "Avventura a Sorpresa",
                // DVAI-051: serializzazione safe — userProfile.interests può contenere
                // selectedFilter/suggestedTheme che a volte sono React elements (e
                // JSON.stringify cicla su FiberNode → TypeError). Estraiamo solo testo.
                description: `Un'esperienza unica generata per te: ${userProfile.interests.map(i => {
                    if (typeof i === 'string') return i;
                    if (i?.title) return i.title;
                    if (i?.name) return i.name;
                    return 'Sorpresa';
                }).join(', ')}.`,
                city: city || 'Roma',
                duration_minutes: 180,
                price_eur: 0,
                rating: 5.0,
                image: cover, // cover esplicito → vince sul calcolo del normalizer
                isAiGenerated: true,
                tags: ['Sorpresa', selectedFilter || 'Mix'],
                routePath: routeWKT,
                waypoints: surpriseTour.stops.map(s => [parseFloat(s.latitude), parseFloat(s.longitude)]),
                // Passo gli stops grezzi: il normalizer estrae title/description/transition/...
                // e mappa googlePhoto → image, lat/lng/latitude/longitude entrambi.
                stops: surpriseTour.stops,
            }, {
                cityFallback: city || 'Roma',
                // DVAI-055-b: doppio filtro innocuo — generateItinerary ha già filtrato con
                // cityCenter, il normalizer riapplica per uniformità con gli altri path.
                cityCenter: Number.isFinite(lat) && Number.isFinite(lng)
                    ? { latitude: lat, longitude: lng }
                    : null,
            });

            // 4. Navigate to Tour Details
            console.log('[DVAI-061] shuffleExperience: generation success →', mappedTour.id);
            navigate(`/tour-details/${mappedTour.id}`, { state: { tourData: mappedTour, isAiGenerated: true } });

        } catch (error) {
            console.error('[DVAI-061] shuffleExperience: generation failed', error);
            if (error?.code === 'QUOTA_EXCEEDED') {
                // DVAI-050 / DVAI-056: cap anti-abuso — toast in-app (no window.alert).
                // DVAI-061 B: SEMPRE flash pulsante come backup se preflight ha sbagliato
                // (RLS, race con altre schede, whatever). L'utente vede il feedback
                // dove ha cliccato, sempre.
                triggerQuotaFlash();
                toast({
                    title: 'Hai esplorato tanto oggi',
                    description: 'Le tue esperienze di oggi sono esaurite. Domani ne troverai di nuove, cucite su di te.',
                    type: 'info',
                    duration: 5000,
                });
            } else {
                // DVAI-051: NON cadere più su mock numerico. Toast in-app coerente.
                toast({
                    title: "L'AI sta avendo un momento difficile",
                    description: 'Riprova tra qualche secondo.',
                    type: 'warning',
                    duration: 5000,
                });
            }
            setIsShuffling(false);
        } finally {
            setIsShuffling(false);
        }
    };

    const handleFilterClick = (typeId) => {
        setSelectedFilter(filterMap[typeId]);
        // Gate Z.3: traccia scelta esplicita (anche "Sorpresa Totale" id=4 conta).
        setSelectedSurpriseType(typeId);
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-orange-100 to-orange-200 font-quicksand">
            <TopBar />

            <main className="max-w-md mx-auto px-4 py-8 pb-24">
                {/* Back to Home Button */}
                <motion.div
                    className="mb-4"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.6 }}
                >
                    <Link to="/dashboard-user">
                        <motion.button
                            className="flex items-center space-x-2 bg-white/80 backdrop-blur-sm text-orange-600 px-4 py-2 rounded-2xl shadow-lg hover:shadow-xl transition-all group"
                            whileHover={{ scale: 1.05, x: 5 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            <motion.div
                                whileHover={{ x: -3 }}
                                transition={{ type: "spring", stiffness: 400 }}
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </motion.div>
                            <span className="font-medium">Home</span>
                        </motion.button>
                    </Link>
                </motion.div>

                {/* Header */}
                <motion.div
                    className="text-center mb-8"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.1 }}
                >
                    <motion.div
                        className="text-8xl mb-4"
                        animate={{
                            rotate: [0, 10, -10, 0],
                            scale: [1, 1.1, 1]
                        }}
                        transition={{
                            duration: 2,
                            repeat: Infinity,
                            repeatType: "reverse"
                        }}
                    >
                        🎁
                    </motion.div>
                    <h1 className="text-3xl font-bold text-gray-800 mb-2">Tour Sorpresa</h1>
                    <p className="text-gray-600">Scegli una categoria, poi genera la tua esperienza</p>
                </motion.div>

                {/* Gate Z.3: struttura invertita. PRIMA "Scegli la tua categoria"
                    (era sotto), POI il bottone "Genera" (era sopra). La categoria e'
                    un FILTRO reale della generazione (surpriseTour.jsx:218 e :207 la
                    passano al prompt AI + agli interests). L'ordine di prima permetteva
                    di generare senza scelta, chiamando "Mix delle sue piu' profonde
                    passioni storiche" (fallback poetico bandito Blocco 2.7).
                    Bottone disabilitato finche' selectedSurpriseType e' null.
                    "Sorpresa Totale" (id=4, filterMap[4]=null) e' una scelta valida:
                    equivale a "categoria non specificata, sorprendimi tu". */}

                {/* Gate PULIZIA P4 (DIFF 6) — rimosso il blocco "Selected Surprise
                    Experience (Doc View)", 77 righe di JSX irraggiungibile.
                    Misurato: il setter dello state che lo governava non era chiamato da
                    nessuna parte, quindi la guardia non si apriva mai. Dentro c'era il
                    secondo CTA che puntava alla rotta dei dettagli senza id ne' state
                    (stesso difetto P4 di AiItinerary). NON era un duplicato del navigate
                    corretto piu' sopra che aveva perso i parametri: leggeva matchReason /
                    isAdHoc / location, campi che su mappedTour non esistono — sono i resti
                    delle 3 esperienze finte tolte dal Gate J2. La navigazione vera resta
                    una sola, quella con id e state dopo la generazione. */}

                {/* Gate Z.3: Categorie PRIMA del bottone Genera.
                    Prima erano dopo, l'utente poteva generare senza aver scelto. */}
                <motion.div
                    className="mb-8"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.3 }}
                >
                    <h2 className="text-xl font-bold text-gray-800 mb-4">Scegli la tua categoria</h2>
                    <div className="grid grid-cols-2 gap-3">
                        {surpriseTypes.map((type, index) => {
                            // Gate Z.3: activa card usa selectedSurpriseType (id), non
                            // selectedFilter (che e' null per "Sorpresa Totale").
                            const isActive = type.id === selectedSurpriseType;
                            return (
                                <motion.div
                                    key={type.id}
                                    className="group relative"
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: 0.4 + index * 0.1 }}
                                    whileHover={{ scale: 1.03 }}
                                    whileTap={{ scale: 0.97 }}
                                    onClick={() => handleFilterClick(type.id)}
                                >
                                    <div className={`
                                        bg-white p-4 rounded-2xl shadow-md border-2 transition-all cursor-pointer flex flex-col items-center text-center h-full
                                        ${isActive ? 'border-orange-500 ring-2 ring-orange-200' : 'border-transparent hover:border-orange-200'}
                                    `}>
                                        <div className={`text-3xl mb-2 p-3 rounded-full bg-gradient-to-br ${type.color} text-white shadow-sm`}>
                                            {type.emoji}
                                        </div>
                                        <h4 className="font-bold text-sm text-gray-700">{type.title}</h4>
                                        {isActive && (
                                            <motion.div
                                                layoutId="active-indicator"
                                                className="mt-2 w-1.5 h-1.5 bg-orange-500 rounded-full"
                                            />
                                        )}
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                </motion.div>

                {/* Gate Z.3: Bottone Genera dopo la scelta. Disabilitato finche'
                    selectedSurpriseType e' null. "Sorpresa Totale" e' una scelta
                    valida (id=4, filterMap=null) — abilita il bottone.
                    Copy dinamico: "Genera esperienza {categoria}" o "Sorprendimi"
                    per Sorpresa Totale. Prima "Genera Esperienza Unica" era il
                    default che l'utente vedeva prima ancora di scegliere. */}
                <motion.div
                    className="mb-8"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.6, delay: 0.8 }}
                >
                    <motion.button
                        onClick={() => shuffleExperience()}
                        disabled={isShuffling || quotaExhaustedFlash || selectedSurpriseType === null}
                        className={`relative w-full bg-gradient-to-r text-white py-6 px-8 rounded-3xl font-bold shadow-xl hover:shadow-2xl transition-all duration-500 flex items-center justify-center space-x-3 ${
                            selectedSurpriseType === null
                                ? 'from-gray-300 to-gray-400 opacity-70 cursor-not-allowed'
                                : quotaExhaustedFlash
                                    ? 'from-orange-200 to-orange-300 opacity-90 cursor-not-allowed'
                                    : isShuffling
                                        ? 'from-orange-400 to-orange-500 opacity-75 cursor-not-allowed'
                                        : 'from-orange-400 to-orange-500'
                        }`}
                        whileHover={!isShuffling && !quotaExhaustedFlash && selectedSurpriseType !== null ? { scale: 1.02, rotateX: 5 } : {}}
                        whileTap={!isShuffling && !quotaExhaustedFlash && selectedSurpriseType !== null ? { scale: 0.98 } : {}}
                    >
                        <motion.div
                            animate={isShuffling ? { rotate: 360 } : {}}
                            transition={isShuffling ? { duration: 0.5, repeat: Infinity, ease: "linear" } : {}}
                        >
                            {quotaExhaustedFlash ? <span className="text-2xl">🌅</span> : <Sparkles className="w-6 h-6" />}
                        </motion.div>
                        <AnimatePresence mode="wait">
                            <motion.span
                                key={selectedSurpriseType === null ? 'nochoice' : quotaExhaustedFlash ? 'quota' : isShuffling ? 'loading' : 'idle'}
                                className="text-xl"
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -6 }}
                                transition={{ duration: 0.25 }}
                            >
                                {selectedSurpriseType === null
                                    ? 'Scegli una categoria'
                                    : quotaExhaustedFlash
                                        ? 'Domani nuove esperienze'
                                        : isShuffling
                                            ? 'Analizzando i tuoi interessi...'
                                            : (selectedFilter ? `Genera esperienza ${selectedFilter}` : 'Sorprendimi')}
                            </motion.span>
                        </AnimatePresence>
                        {!isShuffling && !quotaExhaustedFlash && selectedSurpriseType !== null && (
                            <motion.div
                                className="text-2xl"
                                whileHover={{ scale: 1.3, rotate: 15 }}
                            >
                                🎲
                            </motion.div>
                        )}
                    </motion.button>
                </motion.div>

                {/* Gate J2: rimossa lista "Ispirazioni del Momento" con 3 esperienze
                    hardcoded. La vera esperienza parte solo dal pulsante Genera
                    (shuffleExperience → motore AI reale con quota 10/day). */}
            </main>

            <BottomNavigation />
        </div>
    );
}
