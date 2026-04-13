import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { MapPin, Star, Clock, Users, Shuffle, ArrowLeft, Sparkles, Gift, Dice1, Zap, Calendar, Heart, ArrowRight, Timer, FileText } from "lucide-react";
import DemoHint from "../components/DemoHint";
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

// 🌟 DYNAMIC EXPERIENCES GENERATOR
const getSurpriseExperiences = (city = 'Roma') => [
    {
        id: 1,
        title: `Avventura Gastronomica a ${city}`,
        location: `Centro Storico, ${city}`,
        duration: "3-4 ore",
        rating: 4.9,
        participants: "2-8 persone",
        price: 75,
        image: getAdaptiveImage(city, 'Gastronomia'),
        description: `Un tour culinario misterioso tra le delizie di ${city}`,
        surprise: "🍝",
        category: "Gastronomia",
        tags: ["Cibo", "Storia"]
    },
    {
        id: 2,
        title: `Mistero Artistico di ${city}`,
        location: `Zona Arte, ${city}`,
        duration: "2-3 ore",
        rating: 4.8,
        participants: "1-6 persone",
        price: 85,
        image: getAdaptiveImage(city, 'Arte'),
        description: `Scopri i tesori nascosti dell'arte di ${city}`,
        surprise: "🎨",
        category: "Arte",
        tags: ["Arte", "Cultura"]
    },
    {
        id: 3,
        title: `Natura Incontaminata a ${city}`,
        location: `Dintorni di ${city}`,
        duration: "4-6 ore",
        rating: 4.7,
        participants: "3-12 persone",
        price: 95,
        image: getAdaptiveImage(city, 'Natura'),
        description: `Un'escursione sorprendente nei paesaggi verdi vicino a ${city}`,
        surprise: "🏔️",
        category: "Natura",
        tags: ["Natura", "Sport"]
    }
];

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

export default function SurpriseTourPage() {
    const { city, userId, firstName } = useUserContext(); // Assuming bio/age might be in context or fetched
    const { userDNAPreferences } = useAILearning();

    const navigate = useNavigate();
    const location = useLocation();
    const [selectedSurprise, setSelectedSurprise] = useState(null);
    const [isShuffling, setIsShuffling] = useState(false);
    const [selectedFilter, setSelectedFilter] = useState(null);

    // Dynamic filtered list based on ACTIVE CITY
    const currentExperiences = getSurpriseExperiences(city || 'Roma');

    const filterMap = {
        1: "Gastronomia",
        2: "Arte",
        3: "Natura",
        4: null
    };

    const getFilteredExperiences = () => {
        if (!selectedFilter) return currentExperiences;
        return currentExperiences.filter(exp => exp.category === selectedFilter);
    };

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
        setIsShuffling(true);

        // Simulate initial delay for effect
        await new Promise(resolve => setTimeout(resolve, 1500));

        try {
            // 1. Prepare User Context using AI History
            const pastInterests = userDNAPreferences.map(p => `${p.inspiration} (${p.mood})`).filter(Boolean).slice(0, 3);
            const pastPace = userDNAPreferences.find(p => p.duration)?.duration || 'Medio';
            const pastGroup = userDNAPreferences.find(p => p.group)?.group || 'Solo';

            const userProfile = {
                bio: "Profilo vettoriale estratto dalle generazioni passate.",
                interests: suggestedTheme ? [suggestedTheme] : selectedFilter ? [selectedFilter] : (pastInterests.length > 0 ? pastInterests : ["Arte", "Cibo", "Scoperte Urbane"]),
                expectedPace: pastPace,
                expectedGroup: pastGroup
            };

            const prompt = `Sei l'intelligenza di Unnivai. Genera un'esperienza a sorpresa esaltante a ${city || 'Roma'}. 
            Dati Storici Inconsci Utente: Cerca ritmi di viaggio [${userProfile.expectedPace}] in compagnia di [${userProfile.expectedGroup}].
            Interessi storici calcolati: ${userProfile.interests.join(', ')}.
            Categoria di oggi: ${suggestedTheme ? suggestedTheme : selectedFilter || 'Mix delle sue più profonde passioni storiche'}.
            L'esperienza DEVE essere fuori dai soliti schemi turistici commerciali e sembrare magia pura, calzando i suoi gusti inconsci.
            
            IMPORTANTE: Genera SOLO luoghi REALI ed ESISTENTI entro un raggio di 20km da ${city || 'Roma'}.
            Se non sei sicuro della posizione esatta, scarta il luogo. 
            NON inventare coordinate.`;

            // 2. Call AI Service
            // We use a special flag or just the standard generation
            const result = await aiRecommendationService.generateItinerary(city || 'Roma', {
                interests: userProfile.interests,
                duration: 'Mezza Giornata',
                budget: 'Medio'
            }, prompt);

            if (!result || !result.days || result.days.length === 0) throw new Error("AI Generation Failed");

            // 3. Map to Tour Data Format
            const surpriseTour = result.days[0]; // Take 1st day as the experience

            // Generate Route Path (Linear approximation for now, or use mapService if available)
            // Just connecting dots for visual feedback
            const routeCoords = surpriseTour.stops.map(s => `${s.longitude} ${s.latitude}`).join(', ');
            const routeWKT = `LINESTRING(${routeCoords})`;

            const mappedTour = {
                id: 'surprise-' + Date.now(),
                title: surpriseTour.title || "Avventura a Sorpresa",
                description: `Un'esperienza unica generata per te: ${userProfile.interests.join(', ')}.`,
                city: city || 'Roma',
                duration_minutes: 180,
                price_eur: 0,
                rating: 5.0,
                steps: surpriseTour.stops.map(s => ({
                    title: s.title,
                    description: s.description,
                    lat: s.latitude,
                    lng: s.longitude,
                    type: s.type || 'place',
                    image: getAdaptiveImage(city || 'Roma', s.type || s.category)
                })),
                waypoints: surpriseTour.stops.map(s => [parseFloat(s.latitude), parseFloat(s.longitude)]),
                routePath: routeWKT, // 🆕 Add Immediate Route Path
                isAiGenerated: true,
                tags: ['Sorpresa', selectedFilter || 'Mix']
            };

            // 4. Navigate to Tour Details
            navigate(`/tour-details/${mappedTour.id}`, { state: { tourData: mappedTour, isAiGenerated: true } });

        } catch (error) {
            console.error("Surprise Logic Error:", error);
            // Fallback: Just select a random one from local list (Legacy Logic)
            const fallback = currentExperiences[Math.floor(Math.random() * currentExperiences.length)];
            const mappedFallback = {
                ...fallback,
                steps: [], // Simple object, no steps in this mock
                isAiGenerated: false
            };
            navigate(`/tour-details/${fallback.id}`, { state: { tourData: mappedFallback } });
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
                        onClick={shuffleExperience}
                        disabled={isShuffling}
                        className={`relative w-full bg-gradient-to-r from-orange-400 to-orange-500 text-white py-6 px-8 rounded-3xl font-bold shadow-xl hover:shadow-2xl transition-all flex items-center justify-center space-x-3 ${isShuffling ? 'opacity-75 cursor-not-allowed' : ''
                            }`}
                        whileHover={!isShuffling ? { scale: 1.02, rotateX: 5 } : {}}
                        whileTap={!isShuffling ? { scale: 0.98 } : {}}
                    >
                        <motion.div
                            animate={isShuffling ? { rotate: 360 } : {}}
                            transition={isShuffling ? { duration: 0.5, repeat: Infinity, ease: "linear" } : {}}
                        >
                            <Sparkles className="w-6 h-6" />
                        </motion.div>
                        <span className="text-xl">
                            {isShuffling ? "Analizzando i tuoi interessi..." : (selectedFilter ? `Genera Sorpresa ${selectedFilter}` : "Genera Esperienza Unica")}
                        </span>
                        {!isShuffling && (
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

                {/* All Surprise Experiences (Filtered List) */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold text-gray-800">
                            {selectedFilter ? `Esperienze ${selectedFilter}` : "Ispirazioni del Momento"}
                        </h2>
                        {selectedFilter && (
                            <button
                                onClick={() => setSelectedFilter(null)}
                                className="text-xs font-bold text-orange-500 uppercase tracking-wider"
                            >
                                Mostra Tutto
                            </button>
                        )}
                    </div>

                    <AnimatePresence mode="popLayout">
                        {getFilteredExperiences().map((experience, index) => (
                            <motion.div
                                layout
                                key={experience.id}
                                className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow flex space-x-4 cursor-pointer"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                transition={{ duration: 0.4 }}
                            >
                                <img
                                    src={experience.image}
                                    alt={experience.title}
                                    className="w-20 h-20 rounded-xl object-cover shadow-sm bg-gray-100"
                                />
                                <div className="flex-1 min-w-0 py-1">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <span className="text-[10px] font-bold text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full uppercase tracking-wide">
                                                {experience.category}
                                            </span>
                                            <h3 className="font-bold text-gray-800 leading-tight mt-1 truncate pr-2">
                                                {experience.title}
                                            </h3>
                                        </div>
                                        <span className="text-sm font-bold text-gray-900">€{experience.price}</span>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{experience.description}</p>
                                    <div className="flex items-center mt-2 text-xs text-gray-400">
                                        <Clock className="w-3 h-3 mr-1" /> {experience.duration}
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>

                    {getFilteredExperiences().length === 0 && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-center py-12"
                        >
                            <p className="text-gray-500">Nessuna esperienza trovata per questa categoria.</p>
                        </motion.div>
                    )}
                </div>
            </main>

            <BottomNavigation />
        </div>
    );
}
