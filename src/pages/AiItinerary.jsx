import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { ArrowLeft, ArrowRight, MapPin, Clock, Camera, Utensils, Palette, Eye, ShoppingBag, Coffee, Send, Sparkles, Brain, Loader, Heart, Mountain, Waves, Users, Baby, Zap, Sunset, Navigation, CloudRain, Sun, Thermometer, Wind, Star, Calendar, Home, Shuffle, Target, TrendingUp } from "lucide-react";
import DemoHint from "../components/DemoHint";
import { Link } from "react-router-dom";
import TopBar from "../components/TopBar";
import BottomNavigation from "../components/BottomNavigation";
import { useUserContext } from "../hooks/useUserContext";
import { DEMO_CITIES } from "../data/demoData";
import { aiRecommendationService } from "../services/aiRecommendationService";
import { useAILearning } from "../hooks/useAILearning"; // DVAI-045
import { useToast } from "../hooks/use-toast";

const preferences = [
    { id: 'budget', title: 'Budget', options: ['Economico', 'Medio', 'Lusso'], emoji: '💰', selected: '' },
    { id: 'duration', title: 'Durata', options: ['Mezza Giornata', '1 Giorno', '2-3 Giorni'], emoji: '⏱️', selected: '' },
    { id: 'interests', title: 'Interessi', options: ['Arte', 'Cibo', 'Storia', 'Natura', 'Shopping', 'Vita Notturna'], emoji: '🎯', selected: [] },
    { id: 'group', title: 'Gruppo', options: ['Solo', 'Coppia', 'Famiglia', 'Amici'], emoji: '👥', selected: '' },
    { id: 'pace', title: 'Ritmo', options: ['Rilassato', 'Attivo', 'Intenso'], emoji: '🚀', selected: '' }
];

const sampleItinerary = [
    {
        day: 1,
        title: "Primo giorno - Immersione culturale",
        weather: { condition: "Soleggiato", temperature: 24, icon: "☀️" },
        stops: [
            {
                time: "09:00",
                title: "Duomo di Milano",
                description: "Visita alla magnifica cattedrale gotica con terrazza panoramica",
                icon: Camera,
                type: "cultura",
                location: "Piazza del Duomo",
                rating: 4.8,
                price: 15,
                photos: ["https://images.unsplash.com/photo-1513581166391-887a96ddeafd?w=400&h=300&fit=crop"]
            },
            {
                time: "11:30",
                title: "Galleria Vittorio Emanuele II",
                description: "Shopping e caffè nel salotto elegante di Milano",
                icon: ShoppingBag,
                type: "shopping",
                location: "Centro Storico",
                rating: 4.6,
                price: 0,
                photos: ["https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=300&fit=crop"]
            },
            {
                time: "13:00",
                title: "Pranzo da Savini",
                description: "Cucina milanese tradizionale in ambiente storico",
                icon: Utensils,
                type: "food",
                location: "Galleria Vittorio Emanuele II",
                rating: 4.7,
                price: 45,
                photos: ["https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=300&fit=crop"]
            },
            {
                time: "15:30",
                title: "Teatro alla Scala",
                description: "Visita guidata al tempio mondiale dell'opera",
                icon: Eye,
                type: "cultura",
                location: "Via Filodrammatici",
                rating: 4.9,
                price: 12,
                photos: ["https://images.unsplash.com/photo-1580809361436-42a7ec204889?w=400&h=300&fit=crop"]
            },
            {
                time: "18:00",
                title: "Aperitivo in Brera",
                description: "Quartiere artistico con locali di tendenza",
                icon: Coffee,
                type: "relax",
                location: "Brera",
                rating: 4.5,
                price: 25,
                photos: ["https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=400&h=300&fit=crop"]
            }
        ]
    },
    {
        day: 2,
        title: "Secondo giorno - Arte e design",
        weather: { condition: "Parzialmente nuvoloso", temperature: 22, icon: "⛅" },
        stops: [
            {
                time: "10:00",
                title: "Castello Sforzesco",
                description: "Fortezza medievale con musei e giardini",
                icon: Camera,
                type: "storia",
                location: "Parco Sempione",
                rating: 4.4,
                price: 10,
                photos: ["https://images.unsplash.com/photo-1520637836862-4d197d17c50a?w=400&h=300&fit=crop"]
            },
            {
                time: "12:30",
                title: "Navigli District",
                description: "Canali storici con mercatini e ristoranti",
                icon: Eye,
                type: "cultura",
                location: "Navigli",
                rating: 4.3,
                price: 0,
                photos: ["https://images.unsplash.com/photo-1539650116574-75c0c6d73f6e?w=400&h=300&fit=crop"]
            },
            {
                time: "14:00",
                title: "Pranzo sui Navigli",
                description: "Risotto milanese vista canale",
                icon: Utensils,
                type: "food",
                location: "Naviglio Grande",
                rating: 4.2,
                price: 35,
                photos: ["https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=400&h=300&fit=crop"]
            }
        ]
    }
];

export default function AIItineraryPage() {
    const [currentStep, setCurrentStep] = useState(0);
    const [userPreferences, setUserPreferences] = useState(preferences);
    const [userPrompt, setUserPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedItinerary, setGeneratedItinerary] = useState(null);
    const [selectedStop, setSelectedStop] = useState(null);
    const [currentDay, setCurrentDay] = useState(1);

    const updatePreference = (prefId, value) => {
        setUserPreferences(prev =>
            prev.map(pref =>
                pref.id === prefId
                    ? { ...pref, selected: value }
                    : pref
            )
        );
    };

    const { city, temperatureC, weatherCondition } = useUserContext();
    const activeCity = city || 'Roma';
    const cityData = DEMO_CITIES[activeCity] || DEMO_CITIES['Roma'];

    // DVAI-045: leggi le preferenze apprese dall'AI
    const { userDNAPreferences, trackGeneratedTour } = useAILearning();
    const { toast } = useToast();

    const generateItinerary = async () => {
        setIsGenerating(true);
        setGeneratedItinerary(null);

        const prefsObject = userPreferences.reduce((acc, pref) => {
            acc[pref.id] = pref.selected;
            return acc;
        }, {});

        // DVAI-045: costruisci contesto DNA dalle ultime 5 preferenze apprese
        let dnaContext = '';
        if (userDNAPreferences && userDNAPreferences.length > 0) {
            const last5 = userDNAPreferences.slice(0, 5);
            const moodsSeen = [...new Set(last5.map(p => p.mood).filter(Boolean))];
            const citiesSeen = [...new Set(last5.map(p => p.city).filter(Boolean))];
            const durationsSeen = [...new Set(last5.map(p => p.duration).filter(Boolean))];
            dnaContext = [
                moodsSeen.length   ? `Humor preferiti: ${moodsSeen.join(', ')}.`    : '',
                citiesSeen.length  ? `Città visitate: ${citiesSeen.join(', ')}.`      : '',
                durationsSeen.length ? `Durate preferite: ${durationsSeen.join(', ')}.` : '',
            ].filter(Boolean).join(' ');
        }

        const enrichedPrompt = [
            userPrompt,
            dnaContext ? `[Profilo AI: ${dnaContext}]` : '',
        ].filter(Boolean).join(' ');

        try {
            const result = await aiRecommendationService.generateItinerary(activeCity, prefsObject, enrichedPrompt, {
                condition: weatherCondition || 'sunny',
                temperature: temperatureC || 20
            });

            const itineraryDays = result.days || result;
            if (!itineraryDays || !Array.isArray(itineraryDays) || itineraryDays.length === 0) {
                throw new Error("No itinerary generated");
            }

            setGeneratedItinerary(itineraryDays);
            setCurrentStep(2);

            // DVAI-045: traccia le preferenze usate per l'apprendimento futuro
            trackGeneratedTour({ ...prefsObject, city: activeCity, date: new Date().toISOString() });

        } catch (error) {
            console.error("AI Generation Error", error);
            toast({
                title: 'Generazione AI non disponibile',
                description: 'Ti mostriamo un itinerario suggerito. Riprova più tardi per un percorso personalizzato.',
                variant: 'warning',
            });
            const fallbackItinerary = [{
                day: 1,
                title: "Giorno 1 - Alla scoperta della città",
                weather: { condition: "Soleggiato", temperature: 25, icon: "☀️" },
                stops: [
                    {
                        time: "09:00",
                        title: "Centro Storico",
                        description: "Inizio del tour dal cuore pulsante della città.",
                        icon: "MapPin",
                        type: "culture",
                        location: activeCity,
                        latitude: cityData.center.latitude,
                        longitude: cityData.center.longitude,
                        price: 0,
                        rating: 4.5
                    },
                    {
                        time: "13:00",
                        title: "Pranzo Tipico",
                        description: "Pausa pranzo in un ristorante tradizionale.",
                        icon: "Utensils",
                        type: "food",
                        location: activeCity,
                        latitude: cityData.center.latitude + 0.002,
                        longitude: cityData.center.longitude + 0.002,
                        price: 30,
                        rating: 4.8
                    }
                ]
            }];
            setGeneratedItinerary(fallbackItinerary);
            setCurrentStep(2);
        } finally {
            setIsGenerating(false);
        }
    };

    // DVAI-028: Rigenerazione giorno reale via AI (era setTimeout mock)
    const regenerateDay = async (dayNumber) => {
        if (!generatedItinerary) return;
        setIsGenerating(true);

        const prefsObject = userPreferences.reduce((acc, pref) => {
            acc[pref.id] = pref.selected;
            return acc;
        }, {});

        try {
            const result = await aiRecommendationService.generateItinerary(
                activeCity,
                { ...prefsObject, duration: 'Mezza Giornata' },
                `Rigenera solo il giorno ${dayNumber} con varianti diverse rispetto al precedente.`,
                { condition: weatherCondition || 'sunny', temperature: temperatureC || 20 }
            );
            const newDay = result.days?.[0];
            if (newDay) {
                setGeneratedItinerary(prev =>
                    prev.map(d => d.day === dayNumber ? { ...newDay, day: dayNumber } : d)
                );
            }
        } catch (err) {
            console.warn('[AI] regenerateDay failed:', err.message);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-ochre-100 to-ochre-200 font-quicksand">
            <TopBar />

            <main className="max-w-md mx-auto px-4 py-8 pb-24">
                {/* Back Button */}
                <motion.div
                    className="mb-6"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.6 }}
                >
                    <Link to="/dashboard-user">
                        <motion.button
                            className="flex items-center space-x-2 bg-white/80 backdrop-blur-sm text-terracotta-600 px-4 py-2 rounded-2xl shadow-lg hover:shadow-xl transition-all group"
                            whileHover={{ scale: 1.05, x: 5 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            <ArrowLeft className="w-5 h-5" />
                            <span className="font-medium">Home</span>
                            <span className="text-lg">🏠</span>
                        </motion.button>
                    </Link>
                </motion.div>

                {/* Header - Digital Concierge Avatar */}
                <motion.div
                    className="text-center mb-10"
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                >
                    <div className="relative w-24 h-24 mx-auto mb-6">
                        {/* Pulsing Halo */}
                        <motion.div
                            className="absolute inset-0 bg-gradient-to-tr from-orange-300 to-purple-400 rounded-full blur-xl opacity-60"
                            animate={{ scale: [1, 1.2, 1], rotate: [0, 90, 0] }}
                            transition={{ duration: 4, repeat: Infinity }}
                        />
                        {/* Avatar Container */}
                        <div className="relative w-full h-full bg-gradient-to-br from-white to-gray-100 rounded-full shadow-2xl flex items-center justify-center border-4 border-white/50 backdrop-blur-md z-10">
                            <Brain className="w-12 h-12 text-terracotta-500" />
                            <motion.div
                                className="absolute top-1 right-1 bg-green-400 w-4 h-4 rounded-full border-2 border-white shadow-sm"
                                animate={{ scale: [1, 1.2, 1] }}
                                transition={{ duration: 2, repeat: Infinity }}
                            />
                        </div>
                    </div>

                    <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-terracotta-600 to-orange-500 mb-2">
                        Il Tuo Travel Designer AI
                    </h1>
                    <p className="text-gray-600 font-medium">Raccontami il tuo sogno, io lo trasformo in viaggio.</p>
                </motion.div>

                {/* Step Indicator */}
                <div className="flex items-center justify-center mb-10">
                    {['Sogni', 'Magia', 'Realtà'].map((step, index) => (
                        <div key={step} className="flex items-center">
                            <motion.div
                                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-md ${index <= currentStep
                                    ? 'bg-gradient-to-r from-terracotta-400 to-orange-500 text-white scale-110'
                                    : 'bg-white text-gray-400 border border-gray-200'
                                    }`}
                            >
                                {index + 1}
                            </motion.div>
                            {index < 2 && (
                                <div className={`w-12 h-1 mx-2 rounded-full transition-all ${index < currentStep ? 'bg-terracotta-300' : 'bg-gray-200'
                                    }`} />
                            )}
                        </div>
                    ))}
                </div>

                {/* Step 1: Preferences */}
                {currentStep === 0 && (
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.5 }}
                    >
                        <div className="space-y-8">
                            {/* Pro Input Card */}
                            <motion.div
                                className="bg-white/60 backdrop-blur-xl rounded-3xl p-1 shadow-2xl shadow-terracotta-500/10 border border-white/80"
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                            >
                                <div className="bg-gradient-to-b from-white/50 to-white/20 rounded-[22px] p-6">
                                    <div className="flex items-center space-x-3 mb-4">
                                        <Sparkles className="w-5 h-5 text-orange-400" />
                                        <h3 className="font-bold text-gray-800">La tua visione</h3>
                                    </div>

                                    <div className="relative group">
                                        <textarea
                                            value={userPrompt}
                                            onChange={(e) => setUserPrompt(e.target.value)}
                                            placeholder="Es: 'Voglio perdermi tra i vicoli di Trastevere, mangiare la carbonara migliore e finire la serata in un jazz club nascosto...'"
                                            className="w-full h-32 bg-white/50 rounded-xl p-4 text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-terracotta-300/50 transition-all resize-none shadow-inner border border-transparent focus:bg-white"
                                            style={{ fontFamily: 'Inter, sans-serif' }}
                                        />
                                        <div className="absolute bottom-3 right-3 flex items-center space-x-2">
                                            <span className="text-xs text-gray-400 font-medium">{userPrompt.length > 0 ? 'Perfetto!' : 'Sii creativo...'}</span>
                                            <div className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
                                        </div>
                                    </div>
                                </div>
                            </motion.div>

                            {/* Filters "Pills" Style */}
                            <div className="space-y-6">
                                {userPreferences.map((pref, index) => (
                                    <motion.div
                                        key={pref.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.1 + 0.2 }}
                                    >
                                        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 ml-2 flex items-center gap-2">
                                            <span>{pref.emoji}</span> {pref.title}
                                        </h3>

                                        <div className="flex flex-wrap gap-3">
                                            {pref.options.map((option) => {
                                                const isSelected = pref.id === 'interests'
                                                    ? pref.selected.includes(option)
                                                    : pref.selected === option;

                                                return (
                                                    <motion.button
                                                        key={option}
                                                        onClick={() => {
                                                            if (pref.id === 'interests') {
                                                                const current = pref.selected;
                                                                const newSelection = current.includes(option)
                                                                    ? current.filter(item => item !== option)
                                                                    : [...current, option];
                                                                updatePreference(pref.id, newSelection);
                                                            } else {
                                                                updatePreference(pref.id, option);
                                                            }
                                                        }}
                                                        className={`px-5 py-2.5 rounded-full text-sm font-bold transition-all border ${isSelected
                                                            ? 'bg-gradient-to-r from-terracotta-500 to-orange-500 text-white border-transparent shadow-lg shadow-orange-500/30'
                                                            : 'bg-white text-gray-600 border-gray-200 hover:border-orange-300 hover:bg-orange-50'
                                                            }`}
                                                        whileHover={{ scale: 1.05, y: -2 }}
                                                        whileTap={{ scale: 0.95 }}
                                                    >
                                                        {option}
                                                    </motion.button>
                                                );
                                            })}
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </div>

                        <motion.div className="mt-12 mb-8">
                            <motion.button
                                onClick={() => {
                                    setCurrentStep(1);
                                    generateItinerary();
                                }}
                                className={`w-full py-5 rounded-2xl font-bold text-lg shadow-xl transition-all flex items-center justify-center space-x-3 relative overflow-hidden group ${userPrompt.trim() || userPreferences.some(pref =>
                                    pref.selected && (Array.isArray(pref.selected) ? pref.selected.length > 0 : true)
                                )
                                    ? 'bg-gray-900 text-white cursor-pointer'
                                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                    }`}
                                whileHover={userPrompt.trim() ? { scale: 1.02 } : {}}
                                whileTap={userPrompt.trim() ? { scale: 0.98 } : {}}
                                disabled={!userPrompt.trim() && !userPreferences.some(pref =>
                                    pref.selected && (Array.isArray(pref.selected) ? pref.selected.length > 0 : true)
                                )}
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-orange-500 via-pink-500 to-terracotta-500 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                <div className="relative flex items-center space-x-2 z-10">
                                    <Brain className="w-6 h-6" />
                                    <span>Genera Viaggio</span>
                                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                </div>
                            </motion.button>
                        </motion.div>
                    </motion.div>
                )}

                {/* Step 2: Sophisticated Loading */}
                {currentStep === 1 && (
                    <motion.div
                        className="text-center py-20"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                    >
                        <div className="relative w-32 h-32 mx-auto mb-12">
                            {/* Orbit Rings */}
                            {[0, 1, 2].map(i => (
                                <motion.div
                                    key={i}
                                    className="absolute inset-0 border-2 border-orange-300/30 rounded-full"
                                    animate={{
                                        rotate: i % 2 === 0 ? 360 : -360,
                                        scale: [1, 1.1, 1]
                                    }}
                                    transition={{
                                        rotate: { duration: 10 + i * 5, repeat: Infinity, ease: "linear" },
                                        scale: { duration: 3, repeat: Infinity, ease: "easeInOut" }
                                    }}
                                    style={{ borderTopColor: 'rgba(249, 115, 22, 0.8)' }}
                                />
                            ))}

                            {/* Core */}
                            <div className="absolute inset-0 flex items-center justify-center">
                                <motion.div
                                    className="bg-gradient-to-tr from-orange-500 to-pink-500 p-4 rounded-xl shadow-lg shadow-orange-500/50"
                                    animate={{ y: [0, -10, 0] }}
                                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                                >
                                    <Brain className="w-8 h-8 text-white" />
                                </motion.div>
                            </div>
                        </div>

                        <h2 className="text-2xl font-bold text-gray-800 mb-2">Creazione Itinerario...</h2>
                        <p className="text-gray-500 mb-10">L'IA sta consultando le guide locali e analizzando il meteo.</p>

                        <div className="max-w-xs mx-auto space-y-3">
                            {[
                                { text: "Analisi preferenze", color: "bg-blue-400" },
                                { text: "Selezione gemme nascoste", color: "bg-purple-400" },
                                { text: "Ottimizzazione percorso", color: "bg-green-400" }
                            ].map((item) => (
                                <motion.div
                                    key={item.text}
                                    className="flex items-center space-x-3 bg-white/50 rounded-lg p-3"
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.8 }}
                                >
                                    <motion.div
                                        className={`w-2 h-2 rounded-full ${item.color}`}
                                        animate={{ scale: [1, 1.5, 1] }}
                                        transition={{ repeat: Infinity, duration: 1 }}
                                    />
                                    <span className="text-sm font-medium text-gray-600">{item.text}</span>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                )}

                {/* Step 3: Generated Itinerary */}
                {currentStep === 2 && generatedItinerary && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                    >
                        {/* Day Navigator */}
                        <div className="flex space-x-2 mb-6 overflow-x-auto pb-2">
                            {generatedItinerary.map((day) => (
                                <motion.button
                                    key={day.day}
                                    onClick={() => setCurrentDay(day.day)}
                                    className={`flex-shrink-0 px-4 py-2 rounded-xl font-medium transition-all ${currentDay === day.day
                                        ? 'bg-terracotta-400 text-white shadow-lg'
                                        : 'bg-white/70 text-gray-700 hover:bg-white/90'
                                        }`}
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                >
                                    Giorno {day.day}
                                </motion.button>
                            ))}
                        </div>

                        {/* Current Day Details */}
                        <AnimatePresence mode="wait">
                            {generatedItinerary
                                .filter(day => day.day === currentDay)
                                .map(day => (
                                    <motion.div
                                        key={day.day}
                                        initial={{ opacity: 0, x: 50 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -50 }}
                                        transition={{ duration: 0.4 }}
                                    >
                                        {/* Day Header */}
                                        <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 shadow-lg mb-6">
                                            <div className="flex items-center justify-between mb-4">
                                                <div>
                                                    <h2 className="text-xl font-bold text-gray-800">{day.title}</h2>
                                                    <p className="text-gray-600 text-sm">
                                                        {day.stops.length} tappe programmate
                                                    </p>
                                                </div>
                                                <motion.button
                                                    onClick={() => regenerateDay(day.day)}
                                                    className="p-2 bg-terracotta-100 text-terracotta-600 rounded-xl hover:bg-terracotta-200 transition-colors"
                                                    whileHover={{ scale: 1.1, rotate: 180 }}
                                                    whileTap={{ scale: 0.9 }}
                                                >
                                                    <Shuffle className="w-5 h-5" />
                                                </motion.button>
                                            </div>

                                            {day.weather && (
                                                <div className="flex items-center space-x-3 bg-gradient-to-r from-blue-50 to-cyan-50 p-3 rounded-xl">
                                                    <span className="text-2xl">{day.weather.icon}</span>
                                                    <div>
                                                        <p className="font-medium text-gray-800">{day.weather.condition}</p>
                                                        <p className="text-sm text-gray-600">{day.weather.temperature}°C</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Stops Timeline */}
                                        <div className="space-y-3">
                                            {day.stops.map((stop, index) => {
                                                const IconComponent = (typeof stop.icon === 'string'
                                                    ? { Camera, ShoppingBag, Utensils, Eye, Coffee, MapPin }[stop.icon] || MapPin
                                                    : stop.icon) || MapPin;

                                                const typeColors = {
                                                    cultura: 'bg-purple-100 text-purple-700',
                                                    culture: 'bg-purple-100 text-purple-700',
                                                    food: 'bg-red-100 text-red-700',
                                                    shopping: 'bg-green-100 text-green-700',
                                                    relax: 'bg-blue-100 text-blue-700',
                                                    storia: 'bg-amber-100 text-amber-800',
                                                    natura: 'bg-emerald-100 text-emerald-700',
                                                };

                                                return (
                                                    <motion.div
                                                        key={stop.title ?? index}
                                                        className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
                                                        initial={{ opacity: 0, y: 20 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        transition={{ delay: index * 0.08 }}
                                                        whileHover={{ scale: 1.01 }}
                                                    >
                                                        <div className="flex">
                                                            {/* Left color bar + Icon */}
                                                            <div className="flex flex-col items-center justify-start bg-gradient-to-b from-terracotta-400 to-terracotta-500 px-3 py-4 min-w-[64px]">
                                                                <span className="text-white font-bold text-xs mb-2 whitespace-nowrap">{stop.time || '--:--'}</span>
                                                                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                                                                    <IconComponent className="w-5 h-5 text-white" />
                                                                </div>
                                                            </div>

                                                            {/* Content */}
                                                            <div className="flex-1 p-4">
                                                                <div className="flex items-start justify-between gap-2 mb-1">
                                                                    <h4 className="font-bold text-gray-900 text-sm leading-tight">{stop.title}</h4>
                                                                    {stop.rating && (
                                                                        <div className="flex items-center gap-0.5 flex-shrink-0 bg-yellow-50 px-2 py-0.5 rounded-full">
                                                                            <Star className="w-3 h-3 text-yellow-500 fill-current" />
                                                                            <span className="text-xs font-bold text-gray-700">{stop.rating}</span>
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                <p className="text-xs text-gray-500 mb-2 line-clamp-2">{stop.description}</p>

                                                                <div className="flex items-center justify-between">
                                                                    <div className="flex items-center gap-2">
                                                                        {stop.price !== undefined && (
                                                                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${stop.price === 0 ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'
                                                                                }`}>
                                                                                {stop.price === 0 ? 'Gratuito' : `€${stop.price}`}
                                                                            </span>
                                                                        )}
                                                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeColors[stop.type] || 'bg-gray-100 text-gray-600'}`}>
                                                                            {stop.type}
                                                                        </span>
                                                                    </div>

                                                                    <motion.button
                                                                        onClick={() => setSelectedStop(stop)}
                                                                        className="text-terracotta-500 hover:text-terracotta-700 text-xs font-bold"
                                                                        whileHover={{ scale: 1.05 }}
                                                                        whileTap={{ scale: 0.95 }}
                                                                    >
                                                                        Dettagli →
                                                                    </motion.button>
                                                                </div>

                                                                {stop.location && (
                                                                    <p className="text-[11px] text-gray-400 flex items-center mt-1.5">
                                                                        <MapPin className="w-3 h-3 mr-1 flex-shrink-0" />
                                                                        {stop.location}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </motion.div>
                                                );
                                            })}
                                        </div>
                                    </motion.div>
                                ))}
                        </AnimatePresence>

                        {/* Action Buttons */}
                        <div className="flex space-x-3 mt-8">
                            <motion.button
                                onClick={() => {
                                    setCurrentStep(0);
                                    setGeneratedItinerary(null);
                                }}
                                className="flex-1 bg-gray-300 text-gray-700 py-3 px-4 rounded-xl font-medium hover:bg-gray-400 transition-colors flex items-center justify-center space-x-2"
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                            >
                                <Shuffle className="w-4 h-4" />
                                <span>Ricomincia</span>
                            </motion.button>

                            <Link
                                to="/map"
                                state={{
                                    route: generatedItinerary.find(d => d.day === currentDay)?.stops.map((s, i) => ({
                                        latitude: s.latitude,
                                        longitude: s.longitude,
                                        label: s.title,
                                        title: s.title, // Keep title for fallback
                                        name: s.title,  // Required for MapPage activity card
                                        description: s.description,
                                        category: s.type || 'Punto Mappa',
                                        image: s.photos?.[0] || 'https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&q=80&w=400',
                                        index: i + 1,
                                        type: 'waypoint'
                                    })) || [],
                                    tourData: {
                                        title: generatedItinerary.find(d => d.day === currentDay)?.title || "Itinerario AI",
                                        type: 'ai-generated',
                                        // Estraiamo le singole parole chiave dal prompt per fare match con i Tag del Partner!
                                        tags: [
                                            "AI", 
                                            ...(userPrompt ? userPrompt.split(/\s+/).map(w => w.replace(/[^\w\s]/gi, '')) : []), 
                                            ...(userPreferences.find(p => p.id === 'interests')?.selected || [])
                                        ],
                                        steps: generatedItinerary.find(d => d.day === currentDay)?.stops.map((s, i) => ({
                                            lat: s.latitude,
                                            lng: s.longitude,
                                            title: s.title,
                                            description: s.description,
                                            image: s.photos?.[0] || null,
                                            type: s.type
                                        })) || []
                                    }
                                }}
                                className="flex-1"
                            >
                                <motion.button
                                    className="w-full bg-gradient-to-r from-terracotta-400 to-terracotta-500 text-white py-3 px-4 rounded-xl font-medium shadow-lg hover:shadow-xl transition-all flex items-center justify-center space-x-2"
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    <Navigation className="w-4 h-4" />
                                    <span>Vedi su Mappa</span>
                                </motion.button>
                            </Link>
                        </div>
                    </motion.div >
                )}

                {/* Stop Detail Modal */}
                <AnimatePresence>
                    {selectedStop && (
                        <motion.div
                            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setSelectedStop(null)}
                        >
                            <motion.div
                                className="bg-white rounded-3xl p-6 max-w-sm w-full max-h-[80vh] overflow-y-auto"
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.8, opacity: 0 }}
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-xl font-bold text-gray-800">{selectedStop.title}</h3>
                                    <button
                                        onClick={() => setSelectedStop(null)}
                                        className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
                                    >
                                        ✕
                                    </button>
                                </div>

                                {selectedStop.photos && selectedStop.photos.length > 0 && (
                                    <img
                                        src={selectedStop.photos[0]}
                                        alt={selectedStop.title}
                                        className="w-full h-48 rounded-2xl object-cover mb-4"
                                    />
                                )}

                                <div className="space-y-4">
                                    <p className="text-gray-600">{selectedStop.description}</p>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <h4 className="font-bold text-gray-800 text-sm">Orario</h4>
                                            <p className="text-sm text-gray-600">{selectedStop.time}</p>
                                        </div>
                                        {selectedStop.location && (
                                            <div>
                                                <h4 className="font-bold text-gray-800 text-sm">Posizione</h4>
                                                <p className="text-sm text-gray-600">{selectedStop.location}</p>
                                            </div>
                                        )}
                                        {selectedStop.price !== undefined && (
                                            <div>
                                                <h4 className="font-bold text-gray-800 text-sm">Prezzo</h4>
                                                <p className="text-sm text-gray-600">
                                                    {selectedStop.price === 0 ? 'Gratuito' : `€${selectedStop.price}`}
                                                </p>
                                            </div>
                                        )}
                                        {selectedStop.rating && (
                                            <div>
                                                <h4 className="font-bold text-gray-800 text-sm">Rating</h4>
                                                <div className="flex items-center space-x-1">
                                                    <Star className="w-4 h-4 text-yellow-400 fill-current" />
                                                    <span className="text-sm text-gray-600">{selectedStop.rating}/5</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <Link to="/tour-details">
                                        <motion.button
                                            className="w-full bg-terracotta-400 text-white py-3 px-4 rounded-xl font-medium hover:bg-terracotta-500 transition-colors"
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                        >
                                            Prenota Esperienza
                                        </motion.button>
                                    </Link>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main >

            <BottomNavigation />
        </div >
    );
}
