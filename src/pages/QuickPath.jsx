import { motion, AnimatePresence } from "framer-motion";
import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { aiRecommendationService } from "@/services/aiRecommendationService";
import { dataService } from "@/services/dataService";
import { Brain } from "lucide-react";
import { ArrowLeft, Waves, Mountain, Building2, Trees, ArrowRight, RotateCcw, Home, Sunrise, Sun, Sunset, Zap, Clock, Target, User, Heart, Users, UserCheck, MapPin, Calendar, Timer, UsersIcon } from "lucide-react";
import DemoHint from "@/components/DemoHint";
import { Link } from "react-router-dom";
import TopBar from "@/components/TopBar";
import BottomNavigation from "@/components/BottomNavigation";
import { QuickPathSummary } from "@/components/Map/QuickPathSummary";
import { useUserContext } from "@/hooks/useUserContext";
import { useAILearning } from "@/hooks/useAILearning";
import { DEMO_CITIES, MOCK_ROUTES } from "@/data/demoData";
import PaywallModal from "@/components/PaywallModal";

// ─── Loading Sub-Steps animati ─────────────────────────────────────────────
const LOADING_STEPS = [
    { emoji: '🔍', text: 'Analizzo le tue preferenze...' },
    { emoji: '🏙️', text: 'Cerco i posti migliori...' },
    { emoji: '🗺️', text: 'Disegno il percorso perfetto...' },
    { emoji: '🤝', text: 'Cerco partner locali...' },
    { emoji: '✨', text: 'Ultimi ritocchi...' },
];

const LoadingSubSteps = ({ city }) => {
    const [step, setStep] = useState(0);
    useEffect(() => {
        const interval = setInterval(() => {
            setStep(prev => (prev < LOADING_STEPS.length - 1 ? prev + 1 : prev));
        }, 2200);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="relative w-28 h-28 mb-8">
                <motion.div
                    className="absolute inset-0 border-4 border-t-terracotta-500 border-r-transparent border-b-orange-300 border-l-transparent rounded-full"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                    <motion.span
                        key={step}
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="text-4xl"
                    >
                        {LOADING_STEPS[step].emoji}
                    </motion.span>
                </div>
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-3">Il tuo tour a {city}</h2>
            <AnimatePresence mode="wait">
                <motion.p
                    key={step}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                    className="text-gray-500 text-sm font-medium"
                >
                    {LOADING_STEPS[step].text}
                </motion.p>
            </AnimatePresence>
            {/* Progress dots */}
            <div className="flex gap-1.5 mt-6">
                {LOADING_STEPS.map((_, i) => (
                    <motion.div
                        key={i}
                        className="w-2 h-2 rounded-full"
                        animate={{
                            backgroundColor: i <= step ? '#f97316' : '#e5e7eb',
                            scale: i === step ? 1.3 : 1,
                        }}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                ))}
            </div>
        </div>
    );
};

// Immagine fallback generica (NON Colosseo: piazza italiana generica)
const GENERIC_ITALY_IMAGE = 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=300';
// Solo per Roma: Colosseo/centro
const ROMA_IMAGE = 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=300';

/** Restituisce l'immagine della città corretta; mai Colosseo per altre città */
const getCityFallbackImage = (city) => {
    if (!city || typeof city !== 'string') return GENERIC_ITALY_IMAGE;
    const key = city.trim();
    const byCity = {
        'Roma': ROMA_IMAGE,
        'Milano': 'https://images.unsplash.com/photo-1476493279419-b785d41e38d8?w=300',
        'Napoli': 'https://images.unsplash.com/photo-1563211545-c397120a3b2b?w=300',
        'Firenze': 'https://images.unsplash.com/photo-1543429258-135a96c348d6?w=300',
        'Venezia': 'https://images.unsplash.com/photo-1514890547357-a9ee288728e0?w=300',
        'Torino': 'https://images.unsplash.com/photo-1587982153163-e8e0d0a39e4b?w=300',
        'Palermo': 'https://images.unsplash.com/photo-1528659556196-18e3856b3793?w=300',
        'Bari': 'https://images.unsplash.com/photo-1507501336603-6a2a6f5fc6ff?w=300',
        'Bologna': 'https://images.unsplash.com/photo-1570168008011-b87a8c15a7f6?w=300',
        'Catania': 'https://images.unsplash.com/photo-1669229875416-654db55dc03f?w=300',
        'Perugia': 'https://images.unsplash.com/photo-1626127117105-098555e094c9?w=300',
        'Genova': 'https://images.unsplash.com/photo-1516483638261-f4dbaf036963?w=300',
        'Verona': 'https://images.unsplash.com/photo-1529154036614-a60975f5c760?w=300',
        'Siena': 'https://images.unsplash.com/photo-1520635565-e7a2cedc8d4b?w=300',
    };
    return byCity[key] || GENERIC_ITALY_IMAGE;
};

// Per compatibilità dove serve un fallback "card" (step 2): usa città se disponibile
const FALLBACK_CARD_IMAGE = GENERIC_ITALY_IMAGE;

// 🌍 ADAPTIVE DATA ENGINE
const CITY_CONFIG = {
    'Roma': {
        main: ['citta', 'natura', 'storia', 'cibo'],
        sub: {
            citta: [
                { id: 'rione', title: 'Rioni Storici', image: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=300', description: 'Perditi tra i vicoli di Trastevere o Monti', emoji: '🛵' },
                { id: 'piazze', title: 'Piazze Eterne', image: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=300', description: 'La dolce vita tra Piazza Navona e Spagna', emoji: '⛲' },
                { id: 'shopping', title: 'Via del Corso', image: 'https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?w=300', description: 'Shopping tra vetrine e palazzi storici', emoji: '🛍️' }
            ],
            natura: [
                { id: 'villa', title: 'Ville Nobiliari', image: 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=300', description: 'Relax a Villa Borghese o Doria Pamphilj', emoji: '🌳' },
                { id: 'tevere', title: 'Lungo il Tevere', image: 'https://images.unsplash.com/photo-1565618244030-h200?w=300', description: 'Passeggiata ciclabile sulle sponde del fiume', emoji: '🚴' }
            ],
            storia: [
                { id: 'imperiale', title: 'Roma Imperiale', image: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=300', description: 'Colosseo e Fori Imperiali al tramonto', emoji: '⚔️' },
                { id: 'barocco', title: 'Roma Barocca', image: 'https://images.unsplash.com/photo-1548625361-9877484df6c5?w=300', description: 'Bernini, Borromini e le cupole', emoji: '⛪' }
            ],
            cibo: [
                { id: 'street', title: 'Street Food', image: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=300', description: 'Supplì, Pizza al taglio e Maritozzo', emoji: '🍕' },
                { id: 'carbonara', title: 'Carbonara Tour', image: 'https://images.unsplash.com/photo-1574868233905-25916053805b?w=300', description: 'Alla ricerca della pasta perfetta', emoji: '🍝' }
            ]
        }
    },
    'Milano': {
        main: ['citta', 'moda', 'parchi', 'canali'],
        sub: {
            citta: [
                { id: 'duomo', title: 'Zona Duomo', image: 'https://images.unsplash.com/photo-1547464333-28f0de20b8f9?w=300', description: 'Il cuore pulsante tra madonnina e galleria', emoji: '⛪' },
                { id: 'grattacieli', title: 'Skyline Gae Aulenti', image: 'https://images.unsplash.com/photo-1513581166391-887a96ddeafd?w=300', description: 'La Milano moderna del Bosco Verticale', emoji: '🏙️' }
            ],
            moda: [
                { id: 'quadrilatero', title: 'Quadrilatero', image: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=300', description: 'Fashion district e vetrine di lusso', emoji: '👠' },
                { id: 'vintage', title: 'Vintage Brera', image: 'https://images.unsplash.com/photo-1520006403909-838d6b92c22e?w=300', description: 'Botteghe storiche e design', emoji: '🕶️' }
            ],
            parchi: [
                { id: 'sempione', title: 'Parco Sempione', image: 'https://images.unsplash.com/photo-1579290076295-a226bc40b543?w=300', description: 'Relax vista Castello Sforzesco', emoji: '🏰' }
            ],
            canali: [
                { id: 'navigli', title: 'I Navigli', image: 'https://images.unsplash.com/photo-1513581166391-887a96ddeafd?w=300', description: 'Aperitivo e passeggiata sui canali', emoji: '🥂' }
            ]
        }
    },
    'Napoli': {
        main: ['mare', 'citta', 'vulcano', 'cibo'],
        sub: {
            mare: [
                { id: 'lungomare', title: 'Lungomare', image: 'https://images.unsplash.com/photo-1498394467144-8cb38902d184?w=300', description: 'Castel dell\'Ovo e vista Capri', emoji: '🌊' },
                { id: 'posillipo', title: 'Posillipo', image: 'https://images.unsplash.com/photo-1534720993072-cb99b397d415?w=300', description: 'Panorami mozzafiato dall\'alto', emoji: '📸' }
            ],
            citta: [
                { id: 'spaccanapoli', title: 'Spaccanapoli', image: 'https://images.unsplash.com/photo-1548625361-9877484df6c5?w=300', description: 'Il cuore verace e i presepi', emoji: '🌶️' },
                { id: 'quartieri', title: 'Quartieri Spagnoli', image: 'https://images.unsplash.com/photo-1574868233905-25916053805b?w=300', description: 'Murales, vicoli e vitalità', emoji: '🎭' }
            ],
            vulcano: [
                { id: 'vesuvio', title: 'Vesuvio View', image: 'https://images.unsplash.com/photo-1536417724282-598284687593?w=300', description: 'Punti panoramici sul vulcano', emoji: '🌋' }
            ],
            cibo: [
                { id: 'pizza', title: 'Vera Pizza', image: 'https://images.unsplash.com/photo-1574868233905-25916053805b?w=300', description: 'Le pizzerie storiche', emoji: '🍕' },
                { id: 'dolci', title: 'Sfogliatella', image: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=300', description: 'Pasticceria napoletana', emoji: '🧁' }
            ]
        }
    },
    // Default Fallback
    'default': {
        main: ['citta', 'natura', 'storia', 'relax'],
        sub: {
            citta: [{ id: 'centro', title: 'Centro Storico', image: 'https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?w=300', description: 'Monumenti e piazze principali', emoji: '🏰' }],
            natura: [{ id: 'parco', title: 'Parchi e Verde', image: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=300', description: 'Aree verdi e relax', emoji: '🌳' }],
            storia: [{ id: 'musei', title: 'Cultura e Musei', image: 'https://images.unsplash.com/photo-1548625361-9877484df6c5?w=300', description: 'Arte e storia locale', emoji: '🏛️' }],
            relax: [{ id: 'spa', title: 'Benessere', image: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=300', description: 'Terme e relax', emoji: '🧖' }]
        }
    }
};

// HELPER: Component-ready options generator
const getAdaptiveOptions = (city) => {
    const config = CITY_CONFIG[city] || CITY_CONFIG['default'];

    // Map main keys to full option objects
    const mainOptions = config.main.map(key => {
        switch (key) {
            case 'citta': return { id: 'citta', title: 'Città', emoji: '🏙️', color: 'from-purple-400 to-indigo-400' };
            case 'natura': return { id: 'natura', title: 'Natura', emoji: '🌿', color: 'from-emerald-400 to-green-400' };
            case 'mare': return { id: 'mare', title: 'Mare', emoji: '🌊', color: 'from-blue-400 to-cyan-400' };
            case 'montagna': return { id: 'montagna', title: 'Montagna', emoji: '⛰️', color: 'from-green-400 to-emerald-400' };
            case 'storia': return { id: 'storia', title: 'Storia', emoji: '🏛️', color: 'from-amber-400 to-orange-400' };
            case 'cibo': return { id: 'cibo', title: 'Gusto', emoji: '🍝', color: 'from-red-400 to-orange-400' };
            case 'moda': return { id: 'moda', title: 'Fashion', emoji: '👠', color: 'from-pink-400 to-rose-400' };
            case 'parchi': return { id: 'parchi', title: 'Parchi', emoji: '🌳', color: 'from-green-400 to-teal-400' };
            case 'canali': return { id: 'canali', title: 'Navigli', emoji: '🛶', color: 'from-blue-500 to-indigo-500' };
            case 'vulcano': return { id: 'vulcano', title: 'Vulcano', emoji: '🌋', color: 'from-red-600 to-orange-600' };
            case 'relax': return { id: 'relax', title: 'Relax', emoji: '🧖', color: 'from-teal-300 to-cyan-300' };
            default: return { id: key, title: key, emoji: '✨', color: 'from-gray-400 to-gray-500' };
        }
    });

    // Garantire che ogni sotto-opzione abbia sempre un'immagine (mai box senza foto; fallback = città corretta)
    const cityImg = getCityFallbackImage(city);
    const subWithImages = {};
    Object.keys(config.sub).forEach(key => {
        subWithImages[key] = (config.sub[key] || []).map(item => ({
            ...item,
            image: item?.image && item.image.startsWith('http') ? item.image : cityImg
        }));
    });
    return {
        mainOptions,
        subOptions: subWithImages
    };
};

// Step 3: Time preferences
const timeOptions = [
    {
        id: 'mattina',
        title: 'Mattina',
        emoji: '🌅',
        icon: Sunrise,
        time: '08:00 - 12:00',
        description: 'Perfetto per iniziare la giornata con energia',
        color: 'from-yellow-400 to-orange-400'
    },
    {
        id: 'pomeriggio',
        title: 'Pomeriggio',
        emoji: '☀️',
        icon: Sun,
        time: '14:00 - 18:00',
        description: 'Ideale per esplorare con calma',
        color: 'from-orange-400 to-red-400'
    },
    {
        id: 'sera',
        title: 'Sera',
        emoji: '🌆',
        icon: Sunset,
        time: '18:00 - 22:00',
        description: 'Magico per tramonti e atmosfere romantiche',
        color: 'from-purple-400 to-pink-400'
    }
];

// Step 4: Duration preferences
const durationOptions = [
    {
        id: 'veloce',
        title: 'Veloce',
        emoji: '⚡',
        icon: Zap,
        duration: '1-2 ore',
        description: 'Perfetto per una pausa veloce',
        color: 'from-green-400 to-emerald-400'
    },
    {
        id: 'medio',
        title: 'Medio',
        emoji: '🚶',
        icon: Clock,
        duration: '2-4 ore',
        description: 'Tempo ideale per esplorare con calma',
        color: 'from-blue-400 to-cyan-400'
    },
    {
        id: 'lungo',
        title: 'Lungo',
        emoji: '🎯',
        icon: Target,
        duration: '4-6 ore',
        description: 'Immersione completa nell\'esperienza',
        color: 'from-indigo-400 to-purple-400'
    }
];

// Step 5: Group size preferences
const groupOptions = [
    {
        id: 'solo',
        title: 'Solo',
        emoji: '🧘',
        icon: User,
        size: '1 persona',
        description: 'Momento di tranquillità e riflessione',
        color: 'from-gray-400 to-slate-400'
    },
    {
        id: 'coppia',
        title: 'In coppia',
        emoji: '💕',
        icon: Heart,
        size: '2 persone',
        description: 'Esperienza romantica e intima',
        color: 'from-pink-400 to-rose-400'
    },
    {
        id: 'amici',
        title: 'Con gli amici',
        emoji: '👥',
        icon: Users,
        size: '3-6 persone',
        description: 'Divertimento e condivisione',
        color: 'from-cyan-400 to-blue-400'
    },
    {
        id: 'famiglia',
        title: 'In famiglia',
        emoji: '👨‍👩‍👧‍👦',
        icon: UserCheck,
        size: '4-8 persone',
        description: 'Adatto a tutte le età',
        color: 'from-emerald-400 to-green-400'
    }
];

// ⚠️ FIXED ARCHITECTURE: PARENT-CONTROLLED GENERATION
export default function QuickPathPage() {
    const { city, lat, lng, weatherCondition, temperatureC } = useUserContext();
    const activeCityRaw = city || 'Roma';
    // ⚡ Normalize & Sanitize City
    let activeCity = activeCityRaw.charAt(0).toUpperCase() + activeCityRaw.slice(1).toLowerCase();

    // 🛡️ RECOVERY: If city is coordinates (e.g. "Lat: 41...") or invalid, default to Roma
    if (activeCity.includes('Lat') || activeCity.includes(':') || activeCity.length > 25) {
        console.warn("⚠️ Invalid City detected:", activeCity, "Defaulting to Roma");
        activeCity = 'Roma';
    }
    const navigate = useNavigate();

    // Fallback route for QuickPath
    const quickRoute = MOCK_ROUTES[activeCity] ? MOCK_ROUTES[activeCity].slice(0, 2) : MOCK_ROUTES['Roma'];

    // 🧠 ADAPTIVE OPTIONS
    const { mainOptions, subOptions } = getAdaptiveOptions(activeCity);

    const [currentStep, setCurrentStep] = useState(1);
    const [selectedOption, setSelectedOption] = useState(null);
    const [selectedSubOption, setSelectedSubOption] = useState(null);
    const [selectedTime, setSelectedTime] = useState(null);
    const [selectedDuration, setSelectedDuration] = useState(null);
    const [selectedGroup, setSelectedGroup] = useState(null);

    const { trackGeneratedTour, hasHitPaywall, unlockPremium } = useAILearning();
    const [showPaywall, setShowPaywall] = useState(false);

    // GENERATION STATE (LIFTED UP)
    const [generationStatus, setGenerationStatus] = useState('idle'); // idle, loading, success, error
    const [generationError, setGenerationError] = useState(null);
    const [readyTourData, setReadyTourData] = useState(null);

    // 🧠 MEMOIZE CONTEXT TO PREVENT INFINITE LOOPS
    const weatherContext = useMemo(() => ({
        condition: weatherCondition,
        temperature: temperatureC
    }), [weatherCondition, temperatureC]);

    const handleMainSelection = (optionId) => {
        setSelectedOption(optionId);
        setCurrentStep(2);
    };

    const handleSubSelection = (subOption) => {
        setSelectedSubOption(subOption);
        setCurrentStep(3);
    };

    const handleTimeSelection = (timeOption) => {
        setSelectedTime(timeOption);
        setCurrentStep(4);
    };

    const handleDurationSelection = (durationOption) => {
        setSelectedDuration(durationOption);
        setCurrentStep(5);
    };

    const handleGroupSelection = (groupOption) => {
        setSelectedGroup(groupOption);
        
        // 🔒 Intercettazione Premium Gate
        if (hasHitPaywall) {
            setShowPaywall(true);
            return;
        }

        setCurrentStep(6); // Move to loading step
        // TRIGGER GENERATION IMMEDIATELY ON FINAL SELECTION
        generateItinerary(groupOption);
    };

    const generateItinerary = async (group) => {
        console.log("🚀 STARTING GENERATION IN PARENT COMPONENT");
        setGenerationStatus('loading');

        // Timeout di sicurezza: se dopo 12s non abbiamo risposta, forziamo completamento con itinerario fallback
        let safetyTimeoutId = setTimeout(() => {
            console.warn("⏱️ QuickPath: safety timeout, applying fallback completion");
            const cityCenter = { latitude: 41.9028, longitude: 12.4964 };
            const cityImg = getCityFallbackImage(activeCity);
            setReadyTourData({
                id: 'ai-quiz-fallback-' + Date.now(),
                title: `Esplora ${activeCity}`,
                description: "Esperienza personalizzata.",
                city: activeCity,
                steps: [{ title: 'Centro', description: 'Punto di partenza', lat: cityCenter.latitude, lng: cityCenter.longitude, latitude: cityCenter.latitude, longitude: cityCenter.longitude, image: cityImg, type: 'place' }],
                waypoints: [[cityCenter.latitude, cityCenter.longitude]],
                isAiGenerated: true,
                images: [cityImg],
                imageUrl: cityImg,
                center: cityCenter,
                guide: "Guida Virtuale",
                guideAvatar: "🤖",
                highlights: ["Percorso Veloce"],
                included: [],
                notIncluded: [],
            });
            setGenerationStatus('success');
        }, 12000);

        try {
            // 1. Prepare Data
            const quizAnswers = {
                environment: selectedSubOption?.title || 'Generico',
                activity: selectedSubOption?.description || 'Esplorazione',
                time: selectedTime?.title || 'Giorno',
                duration: selectedDuration?.title || 'Medio',
                group: group?.title || 'Solo'
            };

            // 2. TIMEOUT / MOCK FALLBACK
            console.log("⏳ Waiting 2s...");
            await new Promise(resolve => setTimeout(resolve, 2000));
            console.log("✅ Wait complete");

            // 3. BUILD MOCK DATA WITH CONTEXT
            let stops = [];

            // 📍 CITY COORDS MAP (needed by dynamic fallback)
            const CITY_COORDS_MAP = {
                'Roma': { latitude: 41.9028, longitude: 12.4964 },
                'Milano': { latitude: 45.4642, longitude: 9.1900 },
                'Napoli': { latitude: 40.8518, longitude: 14.2681 },
                'Firenze': { latitude: 43.7696, longitude: 11.2558 },
                'Venezia': { latitude: 45.4408, longitude: 12.3155 },
                'Torino': { latitude: 45.0703, longitude: 7.6869 },
                'Palermo': { latitude: 38.1157, longitude: 13.3615 },
                'Perugia': { latitude: 43.1107, longitude: 12.3908 },
                'Catania': { latitude: 37.5079, longitude: 15.0830 },
                'Bari': { latitude: 41.1177, longitude: 16.8719 },
                'Bologna': { latitude: 44.4949, longitude: 11.3426 },
                'Genova': { latitude: 44.4056, longitude: 8.9463 },
                'Verona': { latitude: 45.4384, longitude: 10.9916 },
                'Siena': { latitude: 43.3186, longitude: 11.3305 },
                'Lecce': { latitude: 40.3516, longitude: 18.1750 },
                'Cagliari': { latitude: 39.2150, longitude: 9.1100 },
            };

            // 🧠 CONTEXT-AWARE ROUTES (city-prefixed to avoid cross-city contamination)
            const SPECIFIC_ROUTES = {
                // --- ROMA ---
                'Roma_parco': [
                    { label: 'Villa Borghese', lat: 41.9135, lng: 12.4912, image: 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=800' },
                    { label: 'Pincio', lat: 41.9109, lng: 12.4795, image: 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=800' }
                ],
                'Roma_centro': [
                    { label: 'Piazza Navona', lat: 41.8992, lng: 12.4731, image: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=800' },
                    { label: 'Pantheon', lat: 41.8986, lng: 12.4769, image: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=800' }
                ],
                'Roma_musei': [
                    { label: 'Musei Vaticani', lat: 41.9067, lng: 12.4547, image: 'https://images.unsplash.com/photo-1548625361-9877484df6c5?w=800' },
                    { label: 'Galleria Borghese', lat: 41.9142, lng: 12.4921, image: 'https://images.unsplash.com/photo-1548625361-9877484df6c5?w=800' }
                ],
                'carbonara': [
                    { label: "Roscioli Salumeria", lat: 41.8936, lng: 12.4727, image: "https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=800", description: "La carbonara leggendaria." },
                    { label: "Da Enzo al 29", lat: 41.8885, lng: 12.4764, image: "https://images.unsplash.com/photo-1574868233905-25916053805b?w=800", description: "Cucina romana verace." }
                ],
                'street': [
                    { label: "Forno Roscioli", lat: 41.8936, lng: 12.4727, image: "https://images.unsplash.com/photo-1517433670267-08bbd4be890f?w=800", description: "Pizza rossa scrocchiarella." },
                    { label: "Supplizio", lat: 41.8988, lng: 12.4674, image: "https://images.unsplash.com/photo-1541529086526-db283c563270?w=800", description: "Il re dei supplì." }
                ],
                'imperiale': [
                    { label: 'Colosseo', lat: 41.8902, lng: 12.4922, image: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=800', description: "L'anfiteatro eterno." },
                    { label: 'Fori Imperiali', lat: 41.8925, lng: 12.4853, image: "https://images.unsplash.com/photo-1515542622106-78bda8ba30c6?w=800", description: "Passeggiata nella storia." }
                ],
                'rione': [
                    { label: 'Trastevere', lat: 41.8883, lng: 12.4690, image: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=800' },
                    { label: 'Monti', lat: 41.8950, lng: 12.4920, image: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=800' }
                ],
                'piazze': [
                    { label: 'Piazza Navona', lat: 41.8992, lng: 12.4731, image: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=800' },
                    { label: 'Piazza di Spagna', lat: 41.9057, lng: 12.4823, image: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=800' }
                ],
                'shopping': [
                    { label: 'Via del Corso', lat: 41.9038, lng: 12.4794, image: 'https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?w=800' },
                    { label: 'Via Condotti', lat: 41.9051, lng: 12.4816, image: 'https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?w=800' }
                ],
                'villa': [
                    { label: 'Villa Borghese', lat: 41.9135, lng: 12.4912, image: 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=800' },
                    { label: 'Pincio', lat: 41.9109, lng: 12.4795, image: 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=800' }
                ],
                'tevere': [
                    { label: 'Isola Tiberina', lat: 41.8899, lng: 12.4789, image: 'https://images.unsplash.com/photo-1565618244030-h200?w=800' },
                    { label: 'Castel Sant\'Angelo', lat: 41.9031, lng: 12.4663, image: 'https://images.unsplash.com/photo-1565618244030-h200?w=800' }
                ],
                'barocco': [
                    { label: 'Fontana di Trevi', lat: 41.9009, lng: 12.4833, image: 'https://images.unsplash.com/photo-1555992336-749746e30129?w=800' },
                    { label: 'San Pietro', lat: 41.9022, lng: 12.4572, image: 'https://images.unsplash.com/photo-1548625361-9877484df6c5?w=800' }
                ],

                // MILANO
                'duomo': [
                    { label: 'Duomo di Milano', lat: 45.4641, lng: 9.1919, image: 'https://images.unsplash.com/photo-1547464333-28f0de20b8f9?w=800' },
                    { label: 'Galleria', lat: 45.4654, lng: 9.1905, image: 'https://images.unsplash.com/photo-1520440229-646911495c4b?w=800' }
                ],
                'grattacieli': [
                    { label: 'Piazza Gae Aulenti', lat: 45.4842, lng: 9.1856, image: 'https://images.unsplash.com/photo-1513581166391-887a96ddeafd?w=800' },
                    { label: 'Bosco Verticale', lat: 45.4858, lng: 9.1905, image: 'https://images.unsplash.com/photo-1513581166391-887a96ddeafd?w=800' }
                ],
                'quadrilatero': [
                    { label: 'Via Montenapoleone', lat: 45.4691, lng: 9.1945, image: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800' },
                    { label: 'Via della Spiga', lat: 45.4703, lng: 9.1963, image: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800' }
                ],
                'vintage': [
                    { label: 'Brera', lat: 45.4716, lng: 9.1878, image: 'https://images.unsplash.com/photo-1520006403909-838d6b92c22e?w=800' },
                    { label: 'Corso Como', lat: 45.4828, lng: 9.1887, image: 'https://images.unsplash.com/photo-1520006403909-838d6b92c22e?w=800' }
                ],
                'sempione': [
                    { label: 'Parco Sempione', lat: 45.4727, lng: 9.1764, image: 'https://images.unsplash.com/photo-1579290076295-a226bc40b543?w=800' },
                    { label: 'Arco della Pace', lat: 45.4764, lng: 9.1725, image: 'https://images.unsplash.com/photo-1579290076295-a226bc40b543?w=800' }
                ],
                'navigli': [
                    { label: 'Darsena', lat: 45.4534, lng: 9.1772, image: 'https://images.unsplash.com/photo-1513581166391-887a96ddeafd?w=800' },
                    { label: 'Naviglio Grande', lat: 45.4513, lng: 9.1726, image: 'https://images.unsplash.com/photo-1513581166391-887a96ddeafd?w=800' }
                ],

                // NAPOLI
                'lungomare': [
                    { label: 'Castel dell\'Ovo', lat: 40.8280, lng: 14.2475, image: 'https://images.unsplash.com/photo-1498394467144-8cb38902d184?w=800' },
                    { label: 'Via Caracciolo', lat: 40.8315, lng: 14.2373, image: 'https://images.unsplash.com/photo-1498394467144-8cb38902d184?w=800' }
                ],
                'posillipo': [
                    { label: 'Parco Virgiliano', lat: 40.7979, lng: 14.1866, image: 'https://images.unsplash.com/photo-1534720993072-cb99b397d415?w=800' },
                    { label: 'Marechiaro', lat: 40.7963, lng: 14.1950, image: 'https://images.unsplash.com/photo-1534720993072-cb99b397d415?w=800' }
                ],
                'spaccanapoli': [
                    { label: 'San Gregorio Armeno', lat: 40.8507, lng: 14.2588, image: 'https://images.unsplash.com/photo-1548625361-9877484df6c5?w=800' },
                    { label: 'Cappella Sansevero', lat: 40.8493, lng: 14.2555, image: 'https://images.unsplash.com/photo-1548625361-9877484df6c5?w=800' }
                ],
                'quartieri': [
                    { label: 'Murales Maradona', lat: 40.8415, lng: 14.2464, image: 'https://images.unsplash.com/photo-1574868233905-25916053805b?w=800' },
                    { label: 'Vico Totò', lat: 40.8420, lng: 14.2470, image: 'https://images.unsplash.com/photo-1574868233905-25916053805b?w=800' }
                ],
                'vesuvio': [
                    { label: 'Gran Cono', lat: 40.8217, lng: 14.4266, image: 'https://images.unsplash.com/photo-1536417724282-598284687593?w=800' },
                    { label: 'Osservatorio', lat: 40.8291, lng: 14.4030, image: 'https://images.unsplash.com/photo-1536417724282-598284687593?w=800' }
                ],
                'pizza': [
                    { label: 'Sorbillo', lat: 40.8510, lng: 14.2560, image: 'https://images.unsplash.com/photo-1574868233905-25916053805b?w=800' },
                    { label: 'Da Michele', lat: 40.8498, lng: 14.2633, image: 'https://images.unsplash.com/photo-1574868233905-25916053805b?w=800' }
                ],
                'dolci': [
                    { label: 'Scaturchio', lat: 40.8490, lng: 14.2570, image: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800' },
                    { label: 'Gambrinus', lat: 40.8368, lng: 14.2492, image: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800' }
                ]
            };

            // 📸 CITY IMAGES MAP
            const CITY_IMAGES = {
                'Roma': 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=800',
                'Milano': 'https://images.unsplash.com/photo-1476493279419-b785d41e38d8?w=800',
                'Firenze': 'https://images.unsplash.com/photo-1543429258-135a96c348d6?w=800',
                'Venezia': 'https://images.unsplash.com/photo-1514890547357-a9ee288728e0?w=800',
                'Napoli': 'https://images.unsplash.com/photo-1563211545-c397120a3b2b?w=800',
                'Perugia': 'https://images.unsplash.com/photo-1563211545-c397120a3b2b?w=800' // Generic
            };

            // 🧠 AI INJECTION: Fetch Matching Businesses
            const MAP_QUIZ_TO_TAGS = {
                'citta': ['Cultura', 'Storia', 'Shopping'],
                'natura': ['Relax', 'Avventura', 'Ospitalità'],
                'storia': ['Storia', 'Cultura'],
                'cibo': ['Ristorazione'],
                'relax': ['Relax', 'Ospitalità'],
                'moda': ['Shopping', 'Lusso'],
                'nightlife': ['Nightlife', 'Ristorazione'],
                // Sub-options
                'carbonara': ['Ristorazione'],
                'pizza': ['Ristorazione'],
                'street': ['Ristorazione'],
                'shopping': ['Shopping'],
                'musei': ['Cultura'],
                'spa': ['Relax', 'Ospitalità'],
                'romantico': ['Romantico', 'Ospitalità']
            };

            const currentState = {
                option: selectedOption?.id,
                subOption: selectedSubOption?.id,
                time: selectedTime?.id,
                duration: selectedDuration?.id,
                group: group?.id,
                // Assuming mood can be derived from subOption if it's a vibe
                mood: selectedSubOption?.id // e.g., 'romantico'
            };

            const uniqueTags = new Set();
            let targetPace = 'normal';

            Object.values(currentState).forEach(val => {
                if (!val) return;
                const lowVal = val.toString().toLowerCase();

                // Map to Tags
                if (MAP_QUIZ_TO_TAGS[lowVal]) {
                    MAP_QUIZ_TO_TAGS[lowVal].forEach(t => uniqueTags.add(t));
                }

                // Add direct vibe keywords as tags (for Vibe Matching)
                if (['romantico', 'relax', 'avventura', 'lusso', 'vintage'].includes(lowVal)) {
                    uniqueTags.add(val); // Keep original casing or Capitalize
                }

                // Map Pattern to Pace
                if (lowVal.includes('relax') || lowVal.includes('lento') || lowVal.includes('tranquillo')) targetPace = 'slow';
                if (lowVal.includes('avventura') || lowVal.includes('sport') || lowVal.includes('nightlife')) targetPace = 'active';
            });

            // If "Romantico" is selected, ensure it's in the uniqueTags for Vibe check
            if (currentState.mood === 'romantico') uniqueTags.add('Romantico'); // Use 'romantico' for comparison, add 'Romantico' as tag

            const activeTags = Array.from(uniqueTags);
            console.log("🧬 AI Matching Profile:", { city: activeCity, tags: activeTags, pace: targetPace });

            // Fetch from Supabase
            const injectedBusinesses = await dataService.getBusinessesByCityAndTags(activeCity, activeTags, targetPace);

            // 🔑 City-prefixed lookup first, then generic (for Roma only)
            const subId = selectedSubOption?.id || '';
            let contextRoute =
                SPECIFIC_ROUTES[`${activeCity}_${subId}`] || // e.g. 'Roma_carbonara'
                (activeCity === 'Roma' ? SPECIFIC_ROUTES[subId] : null) || // Roma fallback for old non-prefixed keys
                null;

            if (!contextRoute) {
                // Try MOCK_ROUTES for known cities
                if (MOCK_ROUTES[activeCity]) {
                    contextRoute = MOCK_ROUTES[activeCity];
                } else {
                    // ⚠️ DYNAMIC FALLBACK: generate city-accurate route
                    console.log(`🗺️ Generating Dynamic Route for: ${activeCity}`);

                    let routeLat, routeLng;
                    const cityCenter = CITY_COORDS_MAP[activeCity];

                    if (cityCenter) {
                        routeLat = cityCenter.latitude;
                        routeLng = cityCenter.longitude;
                    }
                    // Use Context Coords if we are "in" that city (Best for Manual Entry like "Sondrio")
                    else if (activeCity.toLowerCase() === city?.toLowerCase() && lat && lng) {
                        routeLat = lat;
                        routeLng = lng;
                    }

                    // IF we still have no coords, default to Rome but warn.
                    if (!routeLat) {
                        routeLat = 41.9028; routeLng = 12.4964; // Roma
                    }

                    // GENERATE 3 GENERIC POINTS (immagine città corretta, mai Colosseo per altre città)
                    const cityImage800 = getCityFallbackImage(activeCity).replace('w=300', 'w=800');
                    contextRoute = [
                        {
                            label: `Centro Storico di ${activeCity}`,
                            latitude: routeLat,
                            longitude: routeLng,
                            description: `Esplora le meraviglie di ${activeCity}.`,
                            image: cityImage800
                        },
                        {
                            label: `Passeggiata a ${activeCity}`,
                            latitude: routeLat + 0.003,
                            longitude: routeLng + 0.003,
                            description: "Viste panoramiche e atmosfera locale.",
                            image: `https://images.unsplash.com/photo-1516483638261-f4dbaf036963?w=800`
                        },
                        {
                            label: `Sapori di ${activeCity}`,
                            latitude: routeLat - 0.002,
                            longitude: routeLng - 0.002,
                            description: "Scopri la cucina tradizionale.",
                            image: `https://images.unsplash.com/photo-1498579150354-977475b7ea0b?w=800`
                        }
                    ];
                }
            }

            // 💉 INJECT BUSINESSES INTO ROUTE
            if (injectedBusinesses.length > 0 && contextRoute) {
                contextRoute = [...contextRoute];

                // Only inject businesses that have valid GPS coordinates
                const validBusinesses = injectedBusinesses.filter(biz => {
                    const hasCoords = biz._hasCoords || (biz.latitude && biz.longitude);
                    if (!hasCoords) {
                        console.warn(`⚠️ Skipping ${biz.title} — no valid GPS coordinates`);
                    }
                    return hasCoords;
                });

                validBusinesses.forEach((biz, index) => {
                    let insertPos = 1;
                    if (index === 1) insertPos = 3;
                    if (insertPos > contextRoute.length) insertPos = contextRoute.length;
                    console.log(`💉 Injecting ${biz.title} at pos ${insertPos} [${biz.latitude?.toFixed(4)}, ${biz.longitude?.toFixed(4)}]`);
                    contextRoute.splice(insertPos, 0, {
                        ...biz,
                        label: biz.title,
                        isSponsored: true,
                    });
                });
            }

            if (contextRoute) {
                // 📸 CITY IMAGES MAP — covers all major + minor Italian cities
                const CITY_IMAGES_RESOLVER = {
                    'Roma': 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=800',
                    'Milano': 'https://images.unsplash.com/photo-1476493279419-b785d41e38d8?w=800',
                    'Firenze': 'https://images.unsplash.com/photo-1543429258-135a96c348d6?w=800',
                    'Venezia': 'https://images.unsplash.com/photo-1514890547357-a9ee288728e0?w=800',
                    'Napoli': 'https://images.unsplash.com/photo-1563211545-c397120a3b2b?w=800',
                    'Torino': 'https://images.unsplash.com/photo-1587982153163-e8e0d0a39e4b?w=800',
                    'Palermo': 'https://images.unsplash.com/photo-1528659556196-18e3856b3793?w=800',
                    'Bari': 'https://images.unsplash.com/photo-1507501336603-6a2a6f5fc6ff?w=800',
                    'Bologna': 'https://images.unsplash.com/photo-1570168008011-b87a8c15a7f6?w=800',
                    'Genova': 'https://images.unsplash.com/photo-1516483638261-f4dbaf036963?w=800',
                    'Verona': 'https://images.unsplash.com/photo-1529154036614-a60975f5c760?w=800',
                    'Perugia': 'https://images.unsplash.com/photo-1626127117105-098555e094c9?w=800',
                    'Catania': 'https://images.unsplash.com/photo-1669229875416-654db55dc03f?w=800',
                    // Nord Italia
                    'Treviso': 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800',
                    'Padova': 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800',
                    'Vicenza': 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800',
                    'Udine': 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800',
                    'Trieste': 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800',
                    'Trento': 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
                    'Bolzano': 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
                    'Bergamo': 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800',
                    'Brescia': 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800',
                    'Como': 'https://images.unsplash.com/photo-1516483638261-f4dbaf036963?w=800',
                    'Mantova': 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800',
                    'Modena': 'https://images.unsplash.com/photo-1570168008011-b87a8c15a7f6?w=800',
                    'Parma': 'https://images.unsplash.com/photo-1570168008011-b87a8c15a7f6?w=800',
                    'Ravenna': 'https://images.unsplash.com/photo-1570168008011-b87a8c15a7f6?w=800',
                    'Ferrara': 'https://images.unsplash.com/photo-1570168008011-b87a8c15a7f6?w=800',
                    // Centro
                    'Siena': 'https://images.unsplash.com/photo-1520635565-e7a2cedc8d4b?w=800',
                    'Pisa': 'https://images.unsplash.com/photo-1543429258-135a96c348d6?w=800',
                    'Lucca': 'https://images.unsplash.com/photo-1543429258-135a96c348d6?w=800',
                    'Assisi': 'https://images.unsplash.com/photo-1548625361-9877484df6c5?w=800',
                    'Ancona': 'https://images.unsplash.com/photo-1507501336603-6a2a6f5fc6ff?w=800',
                    'Arezzo': 'https://images.unsplash.com/photo-1543429258-135a96c348d6?w=800',
                    // Sud & Isole
                    'Lecce': 'https://images.unsplash.com/photo-1507501336603-6a2a6f5fc6ff?w=800',
                    'Matera': 'https://images.unsplash.com/photo-1529154036614-a60975f5c760?w=800',
                    'Salerno': 'https://images.unsplash.com/photo-1534720993072-cb99b397d415?w=800',
                    'Cagliari': 'https://images.unsplash.com/photo-1507501336603-6a2a6f5fc6ff?w=800',
                    'Agrigento': 'https://images.unsplash.com/photo-1528659556196-18e3856b3793?w=800',
                    'Reggio Calabria': 'https://images.unsplash.com/photo-1563211545-c397120a3b2b?w=800',
                };
                // Generic Italian piazza image — NEVER the Colosseum, used for any unlisted city
                const ITALIAN_GENERIC_IMG = 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800';

                const SPECIFIC_IMAGES_DB = {
                    'Catania_Pescheria': 'https://images.unsplash.com/photo-1555685812-4b943f3e99a9?w=800',
                    'Catania_Duomo': 'https://images.unsplash.com/photo-1669229875416-654db55dc03f?w=800',
                    'Catania_Anfiteatro': 'https://images.unsplash.com/photo-1560364966-235079a0b94b?w=800',
                    'Perugia_Piazza IV Novembre': 'https://images.unsplash.com/photo-1626127117105-098555e094c9?w=800',
                    'Palermo_Teatro Massimo': 'https://images.unsplash.com/photo-1574352662283-c28859bd7084?w=800',
                    'Palermo_Cattedrale': 'https://images.unsplash.com/photo-1528659556196-18e3856b3793?w=800',
                };

                const getSmartImage = (city, stepLabel, existingImage) => {
                    // 0. Already has a real image? Use it (not a broken URL)
                    if (existingImage &&
                        !existingImage.includes('photo-1565618244030-h200') &&
                        existingImage.startsWith('http')) {
                        return existingImage;
                    }
                    const cleanLabel = (stepLabel || '').replace(/Start: |End: /g, '').trim();
                    const key = `${city}_${cleanLabel}`;
                    // 1. Specific DB
                    if (SPECIFIC_IMAGES_DB[key]) return SPECIFIC_IMAGES_DB[key];
                    // 2. Keyword match
                    const lowerLabel = cleanLabel.toLowerCase();
                    if (lowerLabel.includes('duomo') || lowerLabel.includes('cattedrale') || lowerLabel.includes('basilica'))
                        return 'https://images.unsplash.com/photo-1548625361-9877484df6c5?w=800';
                    if (lowerLabel.includes('mercato') || lowerLabel.includes('pescheria'))
                        return 'https://images.unsplash.com/photo-1555685812-4b943f3e99a9?w=800';
                    if (lowerLabel.includes('parco') || lowerLabel.includes('villa') || lowerLabel.includes('giardino'))
                        return 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=800';
                    if (lowerLabel.includes('pizza') || lowerLabel.includes('ristorante') || lowerLabel.includes('trattoria'))
                        return 'https://images.unsplash.com/photo-1574868233905-25916053805b?w=800';
                    if (lowerLabel.includes('museo') || lowerLabel.includes('galleria') || lowerLabel.includes('palazzo'))
                        return 'https://images.unsplash.com/photo-1548625361-9877484df6c5?w=800';
                    if (lowerLabel.includes('porto') || lowerLabel.includes('mare') || lowerLabel.includes('lungomare'))
                        return 'https://images.unsplash.com/photo-1507501336603-6a2a6f5fc6ff?w=800';
                    // 3. City fallback — uses resolver, then NEVER-Colosseum generic
                    return CITY_IMAGES_RESOLVER[city] || ITALIAN_GENERIC_IMG;
                };

                stops = contextRoute.map((p, i) => {
                    // Only use the stop's own image if it's genuinely city-specific (not our Roma fallback)
                    const stopOwnImage = (p.image && !p.image.includes('1552832230')) ? p.image : null;
                    const smartImage = getSmartImage(
                        activeCity,
                        p.label || p.title || '',
                        stopOwnImage // pass null for unknown-city stops → forces keyword/city lookup
                    );

                    return {
                        title: p.label || p.title || `Tappa ${i + 1}`,
                        description: p.description || null,
                        latitude: parseFloat(p.latitude ?? p.lat ?? 0) || null,
                        longitude: parseFloat(p.longitude ?? p.lng ?? 0) || null,
                        type: p.isSponsored ? 'business_partner'
                            : ['carbonara', 'street', 'cibo'].includes(selectedSubOption?.id) ? 'food' : 'viewpoint',
                        image: smartImage,
                        imageUrl: smartImage,
                        isSponsored: p.isSponsored || false,
                        address: p.address || null,
                        website: p.website || null,
                    };
                });
                const defaultCityImage =
                    CITY_IMAGES_RESOLVER[activeCity] ||
                    ITALIAN_GENERIC_IMG;
                const mainImage = stops.length > 0 && stops[0].image ? stops[0].image : defaultCityImage;
                const tourData = {
                    id: 'ai-quiz-' + Date.now(),
                    title: `Esplora ${activeCity}`,
                    description: "Esperienza personalizzata.",
                    city: activeCity,
                    duration_minutes: selectedDuration?.id === 'veloce' ? 90 : 180,
                    price_eur: 0,
                    rating: 5.0,
                    steps: stops.map(s => ({
                        title: s.title,
                        description: s.description,
                        lat: s.latitude,
                        lng: s.longitude,
                        latitude: s.latitude,
                        longitude: s.longitude,
                        image: s.image || 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=800',
                        type: 'place'
                    })),
                    itinerary: stops.map((s, i) => ({
                        time: `Tappa ${i + 1}`,
                        emoji: '📍',
                        activity: s.title || `Destinazione ${i + 1}`,
                    })),
                    waypoints: stops.map(s => [s.latitude, s.longitude]),
                    isAiGenerated: true,
                    tags: ['AI', group?.title, 'QuickPath', ...activeTags],
                    images: [mainImage],
                    imageUrl: mainImage,
                    guide: "Guida Virtuale",
                    guideAvatar: "🤖",
                    guideBio: "Itinerario generato su misura per te dall'intelligenza artificiale.",
                    highlights: ["⚡ Percorso Veloce", "🏙️ " + activeCity, "🎯 Esperienza Custom"],
                    included: ["Navigazione GPS", "Supporto Virtuale"],
                    notIncluded: ["Biglietti", "Trasporti"],
                    center: CITY_COORDS_MAP[activeCity] || ((stops.length > 0) ? { latitude: stops[0].latitude, longitude: stops[0].longitude } : CITY_COORDS_MAP['Roma'])
                };
                clearTimeout(safetyTimeoutId);

                // TRACCIAMENTO INTELLIGENZA AI (SALVA GUSTI)
                try {
                    trackGeneratedTour({
                        mood: selectedSubOption?.title || 'Generico',
                        inspiration: selectedSubOption?.description || 'Esplorazione',
                        time: selectedTime?.title || 'Giorno',
                        duration: selectedDuration?.title || 'Medio',
                        group: group?.title || 'Solo',
                        city: activeCity
                    });
                } catch (e) { console.error("Tracking Error", e); }

                setReadyTourData(tourData);
                setGenerationStatus('success');
                console.log("🔥 SUCCESS: TOUR DATA SET");
            } else {
                // contextRoute mancante: completamento con itinerario fallback (stessa scheda Recap)
                clearTimeout(safetyTimeoutId);
                const cityCenter = { latitude: 41.9028, longitude: 12.4964 };
                const cityImg = getCityFallbackImage(activeCity);
                setReadyTourData({
                    id: 'ai-quiz-fallback-' + Date.now(),
                    title: `Esplora ${activeCity}`,
                    description: "Esperienza personalizzata.",
                    city: activeCity,
                    steps: [{ title: 'Centro', description: 'Punto di partenza', lat: cityCenter.latitude, lng: cityCenter.longitude, latitude: cityCenter.latitude, longitude: cityCenter.longitude, image: cityImg, type: 'place' }],
                    itinerary: [{
                        time: `Tappa 1`,
                        emoji: '📍',
                        activity: 'Centro',
                    }],
                    waypoints: [[cityCenter.latitude, cityCenter.longitude]],
                    isAiGenerated: true,
                    images: [cityImg],
                    imageUrl: cityImg,
                    center: cityCenter,
                    guide: "Guida Virtuale",
                    guideAvatar: "🤖",
                    highlights: ["Percorso Veloce"],
                    included: [],
                    notIncluded: [],
                });
                setGenerationStatus('success');
            }

        } catch (e) {
            clearTimeout(safetyTimeoutId);
            console.warn("⚠️ Generazione con fallback:", e?.message || e);
            const cityCenter = { latitude: 41.9028, longitude: 12.4964 };
            const cityImg = getCityFallbackImage(activeCity);
            setReadyTourData({
                id: 'ai-quiz-fallback-' + Date.now(),
                title: `Esplora ${activeCity}`,
                description: "Esperienza personalizzata.",
                city: activeCity,
                steps: [{ title: 'Centro', description: 'Punto di partenza', lat: cityCenter.latitude, lng: cityCenter.longitude, latitude: cityCenter.latitude, longitude: cityCenter.longitude, image: cityImg, type: 'place' }],
                waypoints: [[cityCenter.latitude, cityCenter.longitude]],
                isAiGenerated: true,
                images: [cityImg],
                imageUrl: cityImg,
                center: cityCenter,
                guide: "Guida Virtuale",
                guideAvatar: "🤖",
                highlights: ["Percorso Veloce"],
                included: [],
                notIncluded: [],
            });
            setGenerationStatus('success');
        }
    };


    const resetSelection = () => {
        setCurrentStep(1);
        setSelectedOption(null);
        setSelectedSubOption(null);
        setSelectedTime(null);
        setSelectedDuration(null);
        setSelectedGroup(null);
        setGenerationStatus('idle');
        setReadyTourData(null);
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-ochre-100 to-ochre-200 font-quicksand">
            <TopBar />

            <main className="max-w-md mx-auto px-4 py-8 pb-24">
                {/* Header */}
                <motion.div
                    className="flex items-center mb-8"
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                >
                    <Link to="/dashboard-user">
                        <motion.button
                            className="p-2 rounded-full bg-white/60 backdrop-blur-sm mr-4 hover:bg-white/80 transition-colors"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            <ArrowLeft className="w-5 h-5 text-gray-700" />
                        </motion.button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">Percorso Veloce</h1>
                        <p className="text-gray-600 text-sm">Scopri qualcosa di speciale in pochi minuti</p>
                    </div>
                </motion.div>

                {/* Progress Indicator: 6 step (ultimo = riepilogo/completamento) */}
                <motion.div
                    className="flex items-center justify-center space-x-2 mb-8"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                >
                    {[1, 2, 3, 4, 5, 6].map((step) => (
                        <div
                            key={step}
                            className={`w-3 h-3 rounded-full transition-all duration-300 ${currentStep >= step ? 'bg-terracotta-400' : 'bg-gray-300'
                                } ${currentStep === step ? 'scale-125' : ''}`}
                        />
                    ))}
                </motion.div>

                <AnimatePresence mode="wait">
                    {/* Step 1: Main Environment */}
                    {currentStep === 1 && (
                        <motion.div
                            key="step1"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 1.05, filter: "blur(10px)" }}
                            transition={{ duration: 0.5 }}
                        >
                            <div className="text-center mb-10">
                                <h2 className="text-3xl font-bold text-gray-900 mb-3 tracking-tight">Il tuo mood oggi?</h2>
                                <p className="text-gray-500 font-medium">L'ambiente perfetto per iniziare</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                {mainOptions.map((option, index) => (
                                    <motion.button
                                        key={option.id}
                                        onClick={() => handleMainSelection(option.id)}
                                        className="relative bg-white p-6 rounded-[2rem] shadow-sm border-2 border-transparent hover:border-gray-100 hover:shadow-xl transition-all duration-300 group overflow-hidden text-left h-48 flex flex-col justify-between"
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.1 }}
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                    >
                                        <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${option.color} opacity-10 rounded-bl-[4rem] group-hover:scale-150 transition-transform duration-500`} />

                                        <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${option.color} flex items-center justify-center text-2xl shadow-lg group-hover:rotate-12 transition-transform`}>
                                            {option.emoji}
                                        </div>

                                        <div>
                                            <h3 className="font-bold text-xl text-gray-900">{option.title}</h3>
                                            <div className="h-1 w-0 group-hover:w-full bg-gray-900 mt-2 transition-all duration-500 rounded-full" />
                                        </div>
                                    </motion.button>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {/* Step 2: Specific Activity */}
                    {currentStep === 2 && selectedOption && (
                        <motion.div
                            key="step2"
                            initial={{ opacity: 0, x: 50 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -50 }}
                            transition={{ duration: 0.5 }}
                        >
                            <div className="text-center mb-8">
                                <h2 className="text-2xl font-bold text-gray-900 mb-2">Cosa ti ispira?</h2>
                                <p className="text-gray-500">Scegli l'esperienza che fa per te</p>
                            </div>

                            <div className="space-y-4">
                                {subOptions[selectedOption]?.map((subOption, index) => (
                                    <motion.button
                                        key={subOption.id}
                                        onClick={() => handleSubSelection(subOption)}
                                        className="w-full bg-white rounded-[2rem] p-4 shadow-sm border border-gray-100 hover:shadow-lg hover:border-terracotta-200 transition-all flex items-center gap-5 group text-left relative overflow-hidden"
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.1 }}
                                        whileHover={{ x: 5 }}
                                    >
                                        <div className="relative w-24 h-24 flex-shrink-0 rounded-2xl overflow-hidden shadow-inner bg-gray-200">
                                            <img
                                                src={subOption.image || getCityFallbackImage(activeCity)}
                                                alt={subOption.title || 'Esperienza'}
                                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                                                onError={(e) => { e.target.onerror = null; e.target.src = getCityFallbackImage(activeCity); }}
                                            />
                                            <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors" />
                                            <div className="absolute bottom-1 right-1 bg-white/90 backdrop-blur rounded-lg px-2 py-1 text-lg shadow-sm">
                                                {subOption.emoji}
                                            </div>
                                        </div>

                                        <div className="flex-1 pr-4">
                                            <h3 className="font-bold text-lg text-gray-900 mb-1 group-hover:text-terracotta-600 transition-colors">{subOption.title}</h3>
                                            <p className="text-xs text-gray-500 leading-relaxed font-medium line-clamp-2">{subOption.description}</p>
                                        </div>

                                        <div className="absolute right-4 opacity-0 group-hover:opacity-100 transition-opacity text-terracotta-500">
                                            <ArrowRight />
                                        </div>
                                    </motion.button>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {/* Step 3: Time Preference */}
                    {currentStep === 3 && (
                        <motion.div
                            key="step3"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 1.1 }}
                            transition={{ duration: 0.5 }}
                        >
                            <div className="text-center mb-10">
                                <h2 className="text-2xl font-bold text-gray-900 mb-2">Quando partiamo?</h2>
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                {timeOptions.map((timeOption, index) => (
                                    <motion.button
                                        key={timeOption.id}
                                        onClick={() => handleTimeSelection(timeOption)}
                                        className="relative bg-white overflow-hidden rounded-[2.5rem] p-6 shadow-sm border border-gray-100 hover:shadow-xl transition-all group"
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.1 }}
                                        whileTap={{ scale: 0.98 }}
                                    >
                                        <div className={`absolute left-0 top-0 bottom-0 w-2 bg-gradient-to-b ${timeOption.color}`} />
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${timeOption.color} bg-opacity-10 flex items-center justify-center text-3xl shadow-sm text-white`}>
                                                    {timeOption.emoji}
                                                </div>
                                                <div className="text-left">
                                                    <h3 className="font-bold text-xl text-gray-900">{timeOption.title}</h3>
                                                    <p className="text-gray-400 text-xs font-bold tracking-wider uppercase mt-1">{timeOption.time}</p>
                                                </div>
                                            </div>
                                            <div className="w-8 h-8 rounded-full border-2 border-gray-100 group-hover:bg-gray-900 group-hover:border-gray-900 transition-colors" />
                                        </div>
                                    </motion.button>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {/* Step 4: Duration */}
                    {currentStep === 4 && (
                        <motion.div
                            key="step4"
                            initial={{ opacity: 0, x: 50 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -50 }}
                            transition={{ duration: 0.5 }}
                        >
                            <div className="text-center mb-10">
                                <h2 className="text-2xl font-bold text-gray-900 mb-2">Quanto tempo hai?</h2>
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                {durationOptions.map((durationOption, index) => (
                                    <motion.button
                                        key={durationOption.id}
                                        onClick={() => handleDurationSelection(durationOption)}
                                        className="bg-white rounded-[2rem] p-4 py-8 shadow-sm border border-gray-200 hover:border-gray-900 hover:shadow-xl transition-all flex flex-col items-center gap-3 group"
                                        initial={{ opacity: 0, scale: 0.8 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ delay: index * 0.1 }}
                                        whileHover={{ y: -5 }}
                                    >
                                        <div className="text-4xl group-hover:scale-125 transition-transform duration-300 filter grayscale group-hover:grayscale-0">
                                            {durationOption.emoji}
                                        </div>
                                        <div className="text-center">
                                            <h3 className="font-bold text-gray-900 text-sm">{durationOption.title}</h3>
                                            <p className="text-[10px] text-gray-400 mt-1">{durationOption.duration}</p>
                                        </div>
                                    </motion.button>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {/* Step 5: Group Size */}
                    {currentStep === 5 && (
                        <motion.div
                            key="step5"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 1.1 }}
                            transition={{ duration: 0.5 }}
                        >
                            <div className="text-center mb-10">
                                <h2 className="text-2xl font-bold text-gray-900 mb-2">Chi c'è con te?</h2>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                {groupOptions.map((groupOption, index) => (
                                    <motion.button
                                        key={groupOption.id}
                                        onClick={() => handleGroupSelection(groupOption)}
                                        className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100 hover:shadow-xl hover:border-terracotta-100 transition-all text-left relative overflow-hidden group"
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.1 }}
                                        whileTap={{ scale: 0.95 }}
                                    >
                                        <div className="absolute top-0 right-0 p-4 opacity-10 font-bold text-6xl group-hover:opacity-20 transition-opacity">
                                            {groupOption.emoji}
                                        </div>
                                        <div className="relative z-10">
                                            <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${groupOption.color} flex items-center justify-center text-white shadow-md mb-4`}>
                                                <groupOption.icon size={20} />
                                            </div>
                                            <h3 className="font-bold text-lg text-gray-900">{groupOption.title}</h3>
                                            <p className="text-xs text-gray-500 mt-1 font-medium">{groupOption.size}</p>
                                        </div>
                                    </motion.button>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {/* Step 6: GENERATION STATE */}
                    {currentStep === 6 && (
                        <motion.div
                            key="step6"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                        >
                            {generationStatus === 'loading' && (
                                <LoadingSubSteps city={activeCity} />
                            )}

                            {generationStatus === 'success' && readyTourData && (
                                <QuickPathSummary
                                    tourData={readyTourData}
                                    choices={{
                                        mood: mainOptions.find(o => o.id === selectedOption)?.title || selectedOption,
                                        inspiration: selectedSubOption?.title,
                                        time: selectedTime?.title,
                                        duration: selectedDuration?.title,
                                        group: selectedGroup?.title
                                    }}
                                    onViewMap={() => {
                                        const tour = { ...readyTourData };
                                        if (tour.steps?.length) {
                                            tour.steps = tour.steps.map(s => ({
                                                ...s,
                                                lat: typeof s.lat === 'number' ? s.lat : parseFloat(s.latitude),
                                                lng: typeof s.lng === 'number' ? s.lng : parseFloat(s.longitude),
                                                latitude: typeof s.latitude === 'number' ? s.latitude : parseFloat(s.lat),
                                                longitude: typeof s.longitude === 'number' ? s.longitude : parseFloat(s.lng),
                                            }));
                                        }
                                        navigate('/map', { state: { tourData: tour, isAiGenerated: true } });
                                    }}
                                    onHome={() => {
                                        resetSelection();
                                        navigate('/dashboard-user');
                                    }}
                                />
                            )}

                            {generationStatus === 'error' && (
                                <div className="text-center py-20">
                                    <h3 className="text-xl font-bold text-red-600">Errore Generazione</h3>
                                    <button onClick={() => window.location.reload()} className="mt-4 px-6 py-2 bg-gray-200 rounded-lg">Riprova</button>
                                </div>
                            )}
                        </motion.div>
                    )}


                </AnimatePresence>
            </main>

            <BottomNavigation />
        </div >
    );
}

