import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { MapPin, Star, Clock, Users, Shuffle, ArrowLeft, Sparkles, Gift, Dice1, Zap, Calendar, Heart, ArrowRight, Timer, FileText } from "lucide-react";
import DemoHint from "../components/DemoHint";
import { Link } from "react-router-dom";
import TopBar from "../components/TopBar";
import BottomNavigation from "../components/BottomNavigation";

const surpriseExperiences = [
    {
        id: 1,
        title: "Avventura Gastronomica a Sorpresa",
        location: "Zona Trastevere, Roma",
        duration: "3-4 ore",
        rating: 4.9,
        participants: "2-8 persone",
        price: 75,
        image: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=300&fit=crop",
        description: "Un tour culinario misterioso tra le strade di Trastevere",
        surprise: "🍝",
        category: "Gastronomia",
        tags: ["Cibo", "Storia"]
    },
    {
        id: 2,
        title: "Mistero Artistico Rinascimentale",
        location: "Centro Storico, Firenze",
        duration: "2-3 ore",
        rating: 4.8,
        participants: "1-6 persone",
        price: 85,
        image: "https://images.unsplash.com/photo-1529260830199-42c24126f198?w=400&h=300&fit=crop",
        description: "Scopri tesori nascosti dell'arte fiorentina",
        surprise: "🎨",
        category: "Arte",
        tags: ["Arte", "Cultura"]
    },
    {
        id: 3,
        title: "Avventura nella Natura Selvaggia",
        location: "Parco Nazionale, Abruzzo",
        duration: "4-6 ore",
        rating: 4.7,
        participants: "3-12 persone",
        price: 95,
        image: "https://images.unsplash.com/photo-1516483638261-f4dbaf036963?w=400&h=300&fit=crop",
        description: "Un'escursione sorprendente tra paesaggi incontaminati",
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
import { aiRecommendationService } from "@/services/aiRecommendationService";

export default function SurpriseTourPage() {
    const { city, userId } = useUserContext();
    const [selectedSurprise, setSelectedSurprise] = useState(null);
    const [isShuffling, setIsShuffling] = useState(false);
    const [selectedFilter, setSelectedFilter] = useState(null);

    // Mock User Interests for "Ad-Hoc" Simulation
    const userInterests = ["Arte", "Cibo"];

    const filterMap = {
        1: "Gastronomia",
        2: "Arte",
        3: "Natura",
        4: null
    };

    const getFilteredExperiences = () => {
        if (!selectedFilter) return surpriseExperiences;
        return surpriseExperiences.filter(exp => exp.category === selectedFilter);
    };

    const shuffleExperience = async () => {
        setIsShuffling(true);

        // Simulate AI "Thinking" and Interest Analysis
        await new Promise(resolve => setTimeout(resolve, 800));

        // 1. Determine constraints (Filter or Interests)
        const activeCategory = selectedFilter;

        // 2. Mock Generation Logic
        let generatedTour;
        const emojiMap = { food: '🍝', culture: '🎨', adventure: '🏔️', nature: '🌿', art: '🎨' };

        // Try to find a match from "Repo" or Generate New
        // In a real app, this calls the AI Service with the specific prompt: "Create tour based on [Interests]"

        // For demo, we select a "Perfect Match" from the list or create a variation
        let candidatePool = surpriseExperiences;
        if (activeCategory) {
            candidatePool = surpriseExperiences.filter(e => e.category === activeCategory);
        } else {
            // "Ad-Hoc" Logic: Prioritize User Interests if no filter
            candidatePool = surpriseExperiences.filter(e => e.tags?.some(tag => userInterests.includes(tag)));
        }

        // Fallback to random if pool is empty
        if (candidatePool.length === 0) candidatePool = surpriseExperiences;

        const forcedMatch = candidatePool[Math.floor(Math.random() * candidatePool.length)];

        const uiSurprise = {
            ...forcedMatch,
            id: forcedMatch.id + Date.now(), // Make it unique "Instance"
            description: activeCategory
                ? forcedMatch.description
                : `Selezionato per te basandosi sulla tua passione per ${userInterests.join(' e ')}.`,
            matchReason: activeCategory ? `Categoria: ${activeCategory}` : "❤️ Compatibilità 98%",
            isAdHoc: !activeCategory // It's "Ad Hoc" if purely interest-based
        };

        // Artificial delay for "Generation" suspense
        setTimeout(() => {
            setSelectedSurprise(uiSurprise);
            setIsShuffling(false);
        }, 800);
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
                    <Link to="/">
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
