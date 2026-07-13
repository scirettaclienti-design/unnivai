import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import { MapPin, Star, Clock, Users, Shuffle, ArrowLeft, Sparkles, Gift, Dice1, Zap, Calendar, Heart, ArrowRight, Timer, FileText } from "lucide-react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import TopBar from "../components/TopBar";
import BottomNavigation from "../components/BottomNavigation";

// 🧠 ADAPTIVE IMAGE LOGIC
const CITY_IMAGES = {
    'Roma': {
        food: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=500", // Carbonara/Roman Food
        art: "https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=500", // Colosseum/Art
        nature: "https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=500", // Villa Borghese
        view: "https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=500",
        default: "https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=800"
    },
    'Firenze': {
        food: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=500",
        art: "https://images.unsplash.com/photo-1543429388-662bd3d76722?w=500", // Florence Duomo/Art
        nature: "https://images.unsplash.com/photo-1533621985392-563d8109d3b8?w=500", // Tuscany Hills
        view: "https://images.unsplash.com/photo-1534237191398-90407a51c969?w=500",
        default: "https://images.unsplash.com/photo-1543429388-662bd3d76722?w=800"
    },
    'Milano': {
        food: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=500",
        art: "https://images.unsplash.com/photo-1547464333-28f0de20b8f9?w=500", // Duomo
        nature: "https://images.unsplash.com/photo-1579290076295-a226bc40b543?w=500", // Parco Sempioneish
        view: "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=500",
        default: "https://images.unsplash.com/photo-1513581166391-887a96ddeafd?w=800"
    },
    'Napoli': {
        food: "https://images.unsplash.com/photo-1574868233905-25916053805b?w=500", // Pizza
        art: "https://images.unsplash.com/photo-1548625361-9877484df6c5?w=500",
        nature: "https://images.unsplash.com/photo-1536417724282-598284687593?w=500", // Vesuvio
        view: "https://images.unsplash.com/photo-1498394467144-8cb38902d184?w=500",
        default: "https://images.unsplash.com/photo-1534720993072-cb99b397d415?w=800"
    },
    // Fallback generic
    'default': {
        food: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=500",
        art: "https://images.unsplash.com/photo-1548625361-9877484df6c5?w=500",
        nature: "https://images.unsplash.com/photo-1501854140884-074bf222b866?w=500",
        view: "https://images.unsplash.com/photo-1506929562872-bb421503ef21?w=500",
        default: "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=800"
    }
};

const getAdaptiveImage = (city, category) => {
    const cityData = CITY_IMAGES[city] || CITY_IMAGES['default'];
    // Normalize category
    const catKey = (category || '').toLowerCase();

    if (catKey.includes('cibo') || catKey.includes('gastronomia') || catKey.includes('food')) return cityData.food;
    if (catKey.includes('arte') || catKey.includes('cultura') || catKey.includes('storia')) return cityData.art;
    if (catKey.includes('natura') || catKey.includes('parco') || catKey.includes('sport')) return cityData.nature;
    if (catKey.includes('vista') || catKey.includes('panorama')) return cityData.view;

    return cityData.default;
};

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

export default function SurpriseTourPage() {
    // DVAI-055: estraggo lat/lng dal userContext per il vincolo geografico
    const { city, userId, firstName, lat, lng } = useUserContext();
    const { toast } = useToast();
    const { userDNAPreferences } = useAILearning();

    const navigate = useNavigate();
    const location = useLocation();
    const [selectedSurprise, setSelectedSurprise] = useState(null);
    const [isShuffling, setIsShuffling] = useState(false);
    const [selectedFilter, setSelectedFilter] = useState(null);
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
        if (location.state?.autoSuggest && !isShuffling && !selectedSurprise) {
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

            if (!result || !result.days || result.days.length === 0) throw new Error("AI Generation Failed");

            // 3. Map to Tour Data Format
            const surpriseTour = result.days[0]; // Take 1st day as the experience

            // Generate Route Path (Linear approximation for now, or use mapService if available)
            // Just connecting dots for visual feedback
            const routeCoords = surpriseTour.stops.map(s => `${s.longitude} ${s.latitude}`).join(', ');
            const routeWKT = `LINESTRING(${routeCoords})`;

            // DVAI-051: cover reale dal primo POI (Google Places) o fallback tematico città.
            // Mantiene gli stessi campi narrativi del tour insider per renderizzare
            // "💡 Insider", "Quando:", "→ transizione" nella scheda.
            const stop0 = surpriseTour.stops[0] || {};
            const firstCat = stop0.type || (selectedFilter || '').toLowerCase() || 'default';
            const cover = stop0.googlePhoto || getAdaptiveImage(city || 'Roma', firstCat);

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
                    <p className="text-gray-600">Lasciati guidare dal destino o dalle tue passioni</p>
                </motion.div>

                {/* Shuffle/Generate Button - THE MAIN ACTION */}
                <motion.div
                    className="mb-8"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                >
                    <motion.button
                        onClick={() => shuffleExperience()}
                        disabled={isShuffling || quotaExhaustedFlash}
                        // DVAI-061 B — Il pulsante cambia stato/colore/testo in TRE modalità:
                        //  1. quotaExhaustedFlash → soft peach + "Domani nuove esperienze 🌅" per 3s
                        //  2. isShuffling         → arancione opacità 0.75 + spinner + "Analizzando..."
                        //  3. default             → arancione pieno + "Genera Esperienza Unica"
                        className={`relative w-full bg-gradient-to-r text-white py-6 px-8 rounded-3xl font-bold shadow-xl hover:shadow-2xl transition-all duration-500 flex items-center justify-center space-x-3 ${
                            quotaExhaustedFlash
                                ? 'from-orange-200 to-orange-300 opacity-90 cursor-not-allowed'
                                : isShuffling
                                    ? 'from-orange-400 to-orange-500 opacity-75 cursor-not-allowed'
                                    : 'from-orange-400 to-orange-500'
                        }`}
                        whileHover={!isShuffling && !quotaExhaustedFlash ? { scale: 1.02, rotateX: 5 } : {}}
                        whileTap={!isShuffling && !quotaExhaustedFlash ? { scale: 0.98 } : {}}
                    >
                        <motion.div
                            animate={isShuffling ? { rotate: 360 } : {}}
                            transition={isShuffling ? { duration: 0.5, repeat: Infinity, ease: "linear" } : {}}
                        >
                            {quotaExhaustedFlash ? <span className="text-2xl">🌅</span> : <Sparkles className="w-6 h-6" />}
                        </motion.div>
                        <AnimatePresence mode="wait">
                            <motion.span
                                key={quotaExhaustedFlash ? 'quota' : isShuffling ? 'loading' : 'idle'}
                                className="text-xl"
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -6 }}
                                transition={{ duration: 0.25 }}
                            >
                                {quotaExhaustedFlash
                                    ? 'Domani nuove esperienze'
                                    : isShuffling
                                        ? 'Analizzando i tuoi interessi...'
                                        : (selectedFilter ? `Genera Sorpresa ${selectedFilter}` : 'Genera Esperienza Unica')}
                            </motion.span>
                        </AnimatePresence>
                        {!isShuffling && !quotaExhaustedFlash && (
                            <motion.div
                                className="text-2xl"
                                whileHover={{ scale: 1.3, rotate: 15 }}
                            >
                                🎲
                            </motion.div>
                        )}
                    </motion.button>
                </motion.div>

                {/* Selected Surprise Experience (Doc View) */}
                <AnimatePresence mode="wait">
                    {selectedSurprise && (
                        <motion.div
                            key={selectedSurprise.id}
                            className="bg-white rounded-3xl p-0 shadow-2xl mb-12 relative overflow-hidden border border-gray-100"
                            initial={{ opacity: 0, y: 50, scale: 0.9 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -20, scale: 0.9 }}
                            transition={{ duration: 0.5, type: "spring" }}
                        >
                            {/* "Doc" Header */}
                            <div className="bg-gray-50 border-b border-gray-100 p-4 flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                    <FileText className="w-4 h-4 text-orange-500" />
                                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Itinerario Generato</span>
                                </div>
                                {selectedSurprise.isAdHoc && (
                                    <span className="bg-gradient-to-r from-orange-500 to-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center shadow-sm">
                                        <Heart className="w-3 h-3 mr-1 fill-current" />
                                        PER TE
                                    </span>
                                )}
                            </div>

                            <div className="relative">
                                <img
                                    src={selectedSurprise.image}
                                    alt={selectedSurprise.title}
                                    className="w-full h-56 object-cover"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                                <div className="absolute bottom-0 left-0 p-6 text-white w-full">
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.2 }}
                                        className="inline-block bg-orange-500/90 backdrop-blur-md px-3 py-1 rounded-lg text-xs font-bold mb-2 shadow-lg"
                                    >
                                        {selectedSurprise.matchReason}
                                    </motion.div>
                                    <h3 className="text-2xl font-bold leading-tight font-playfair">{selectedSurprise.title}</h3>
                                </div>
                            </div>

                            <div className="p-6">
                                <p className="text-gray-600 mb-6 leading-relaxed">
                                    {selectedSurprise.description}
                                </p>

                                <div className="flex items-center justify-between mb-6 text-sm text-gray-500">
                                    <div className="flex items-center">
                                        <Clock className="w-4 h-4 mr-2 text-orange-400" />
                                        {selectedSurprise.duration}
                                    </div>
                                    <div className="flex items-center">
                                        <MapPin className="w-4 h-4 mr-2 text-orange-400" />
                                        {selectedSurprise.location}
                                    </div>
                                </div>

                                <div className="flex space-x-3">
                                    <Link to="/map" className="flex-1">
                                        <button className="w-full bg-gray-100 text-gray-800 py-3 rounded-xl font-bold hover:bg-gray-200 transition-colors">
                                            Vedi Mappa
                                        </button>
                                    </Link>
                                    <Link to="/tour-details" className="flex-[2]">
                                        <button className="w-full bg-orange-500 text-white py-3 rounded-xl font-bold hover:bg-orange-600 transition-colors shadow-lg shadow-orange-200">
                                            Accetta Avventura
                                        </button>
                                    </Link>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Surprise Categories */}
                <motion.div
                    className="mb-8"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.3 }}
                >
                    <h2 className="text-xl font-bold text-gray-800 mb-4">Scegli la tua Categoria</h2>
                    <div className="grid grid-cols-2 gap-3">
                        {surpriseTypes.map((type, index) => {
                            const isActive = filterMap[type.id] === selectedFilter;
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

                {/* Gate J2: rimossa lista "Ispirazioni del Momento" con 3 esperienze
                    hardcoded ("Avventura Gastronomica" €75 4.9★, "Mistero Artistico"
                    €85 4.8★, "Natura Incontaminata" €95 4.7★) — foto Unsplash + prezzi
                    e rating inventati mostrati come tour reali. La vera esperienza
                    parte solo dal pulsante grande "Genera Esperienza Unica" sopra
                    (shuffleExperience → motore AI reale con quota 10/day).
                    I chip categoria sopra restano come pre-selezione del tema. */}
            </main>

            <BottomNavigation />
        </div>
    );
}
