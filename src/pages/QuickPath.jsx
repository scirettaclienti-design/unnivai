import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { ArrowLeft, Waves, Mountain, Building2, Trees, ArrowRight, RotateCcw, Home, Sunrise, Sun, Sunset, Zap, Clock, Target, User, Heart, Users, UserCheck, MapPin, Calendar, Timer, UsersIcon } from "lucide-react";
import DemoHint from "@/components/DemoHint";
import { Link } from "react-router-dom";
import TopBar from "@/components/TopBar";
import BottomNavigation from "@/components/BottomNavigation";
import { useUserContext } from "@/hooks/useUserContext";
import { DEMO_CITIES, MOCK_ROUTES } from "@/data/demoData";

const mainOptions = [
    {
        id: 'mare',
        title: 'Mare',
        emoji: '🌊',
        icon: Waves,
        color: 'from-blue-400 to-cyan-400'
    },
    {
        id: 'montagna',
        title: 'Montagna',
        emoji: '⛰️',
        icon: Mountain,
        color: 'from-green-400 to-emerald-400'
    },
    {
        id: 'citta',
        title: 'Città',
        emoji: '🏙️',
        icon: Building2,
        color: 'from-purple-400 to-indigo-400'
    },
    {
        id: 'natura',
        title: 'Natura',
        emoji: '🌿',
        icon: Trees,
        color: 'from-emerald-400 to-green-400'
    }
];

// Step 2: Sub-categories based on main selection
const subOptions = {
    mare: [
        {
            id: 'spiaggia-segreta',
            title: 'Spiaggia segreta',
            image: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=300&h=200&fit=crop',
            description: 'Una piccola baia nascosta tra le rocce, accessibile solo a piedi attraverso un sentiero panoramico',
            emoji: '🏖️'
        },
        {
            id: 'passeggiata-porto',
            title: 'Passeggiata sul porto',
            image: 'https://images.unsplash.com/photo-1578321272176-b7bbc0679853?w=300&h=200&fit=crop',
            description: 'Cammina tra i pescatori e scopri la vita marina del porto storico',
            emoji: '⚓'
        },
        {
            id: 'aperitivo-faro',
            title: 'Aperitivo vista faro',
            image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=300&h=200&fit=crop',
            description: 'Goditi un aperitivo al tramonto con vista sul faro e le barche dei pescatori',
            emoji: '🌅'
        }
    ],
    montagna: [
        {
            id: 'panorama-tramonto',
            title: 'Panorama al tramonto',
            image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=300&h=200&fit=crop',
            description: 'Raggiungi un punto panoramico per ammirare il tramonto sulle valli circostanti',
            emoji: '🌄'
        },
        {
            id: 'fontana-nascosta',
            title: 'Fontana nascosta',
            image: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=300&h=200&fit=crop',
            description: 'Scopri una fontana naturale immersa nel bosco, perfetta per una pausa rinfrescante',
            emoji: '💧'
        },
        {
            id: 'rifugio-locale',
            title: 'Rifugio locale',
            image: 'https://images.unsplash.com/photo-1586996292898-71f4036c4e07?w=300&h=200&fit=crop',
            description: 'Visita un rifugio gestito da una famiglia locale che serve prodotti tipici',
            emoji: '🏔️'
        }
    ],
    citta: [
        {
            id: 'mercato-artigiano',
            title: 'Mercato artigiano',
            image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=300&h=200&fit=crop',
            description: 'Esplora un mercato di artigiani locali e scopri prodotti unici fatti a mano',
            emoji: '🎨'
        },
        {
            id: 'street-art-tour',
            title: 'Street art tour',
            image: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=200&fit=crop',
            description: 'Segui un percorso attraverso i murales più belli del quartiere artistico',
            emoji: '🎭'
        },
        {
            id: 'caffe-storico',
            title: 'Caffè storico',
            image: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=300&h=200&fit=crop',
            description: 'Rilassati in un caffè con oltre 100 anni di storia nel cuore della città',
            emoji: '☕'
        }
    ],
    natura: [
        {
            id: 'giardino-botanico',
            title: 'Giardino botanico',
            image: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=300&h=200&fit=crop',
            description: 'Passeggia tra piante rare e scopri la biodiversità locale in un ambiente tranquillo',
            emoji: '🌺'
        },
        {
            id: 'sentiero-fiume',
            title: 'Sentiero del fiume',
            image: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=300&h=200&fit=crop',
            description: 'Segui un sentiero costeggiando un fiume cristallino tra la vegetazione rigogliosa',
            emoji: '🌊'
        },
        {
            id: 'osservatorio-uccelli',
            title: 'Osservatorio uccelli',
            image: 'https://images.unsplash.com/photo-1520637836862-4d197d17c91a?w=300&h=200&fit=crop',
            description: 'Scopri la fauna locale in un punto di osservazione privilegiato per il birdwatching',
            emoji: '🦅'
        }
    ]
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

export default function QuickPathPage() {
    const { city } = useUserContext();
    const activeCity = city || 'Roma';

    // Fallback route for QuickPath
    const quickRoute = MOCK_ROUTES[activeCity] ? MOCK_ROUTES[activeCity].slice(0, 2) : MOCK_ROUTES['Roma'];
    const [currentStep, setCurrentStep] = useState(1);
    const [selectedOption, setSelectedOption] = useState(null);
    const [selectedSubOption, setSelectedSubOption] = useState(null);
    const [selectedTime, setSelectedTime] = useState(null);
    const [selectedDuration, setSelectedDuration] = useState(null);
    const [selectedGroup, setSelectedGroup] = useState(null);

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
        setCurrentStep(6);
    };

    const resetSelection = () => {
        setCurrentStep(1);
        setSelectedOption(null);
        setSelectedSubOption(null);
        setSelectedTime(null);
        setSelectedDuration(null);
        setSelectedGroup(null);
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
                    <Link to="/">
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

                {/* Progress Indicator */}
                <motion.div
                    className="flex items-center justify-center space-x-2 mb-8"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                >
                    {[1, 2, 3, 4, 5].map((step) => (
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
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.6 }}
                        >
                            <div className="text-center mb-8">
                                <h2 className="text-xl font-bold text-gray-800 mb-2">Che tipo di ambiente preferisci?</h2>
                                <p className="text-gray-600 text-sm">Scegli dove ti piacerebbe trascorrere del tempo</p>
                                <DemoHint text="Inizia selezionando un ambiente" className="top-16 right-4" delay={500} />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                {mainOptions.map((option, index) => (
                                    <motion.button
                                        key={option.id}
                                        onClick={() => handleMainSelection(option.id)}
                                        className={`bg-gradient-to-br ${option.color} text-white p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 text-center`}
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ duration: 0.6, delay: index * 0.1 }}
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                    >
                                        <div className="text-3xl mb-2">{option.emoji}</div>
                                        <h3 className="font-bold text-lg">{option.title}</h3>
                                    </motion.button>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {/* Step 2: Specific Activity */}
                    {currentStep === 2 && selectedOption && (
                        <motion.div
                            key="step2"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.6 }}
                        >
                            <div className="text-center mb-8">
                                <h2 className="text-xl font-bold text-gray-800 mb-2">Cosa ti piacerebbe fare?</h2>
                                <p className="text-gray-600 text-sm">Scegli l'attività che più ti incuriosisce</p>
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                {subOptions[selectedOption].map((subOption, index) => (
                                    <motion.button
                                        key={subOption.id}
                                        onClick={() => handleSubSelection(subOption)}
                                        className="bg-gradient-to-br from-white/90 to-white/70 backdrop-blur-sm rounded-3xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 border border-white/20"
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ duration: 0.6, delay: index * 0.1 }}
                                        whileHover={{ scale: 1.05, rotateY: 5 }}
                                        whileTap={{ scale: 0.95 }}
                                    >
                                        <div className="flex flex-col items-center text-center space-y-3">
                                            <motion.div
                                                className="text-6xl"
                                                whileHover={{ scale: 1.2, rotate: 10 }}
                                                transition={{ type: "spring", stiffness: 300 }}
                                            >
                                                {subOption.emoji}
                                            </motion.div>
                                            <h3 className="font-bold text-xl text-gray-800">{subOption.title}</h3>
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: '60px' }}
                                                transition={{ duration: 0.8, delay: index * 0.1 + 0.3 }}
                                                className="h-1 bg-gradient-to-r from-terracotta-400 to-ochre-400 rounded-full"
                                            />
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
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.6 }}
                        >
                            <div className="text-center mb-8">
                                <h2 className="text-xl font-bold text-gray-800 mb-2">In che momento della giornata?</h2>
                                <p className="text-gray-600 text-sm">Ogni momento ha la sua magia</p>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                {timeOptions.map((timeOption, index) => (
                                    <motion.button
                                        key={timeOption.id}
                                        onClick={() => handleTimeSelection(timeOption)}
                                        className={`bg-gradient-to-br ${timeOption.color} text-white p-6 rounded-3xl shadow-lg hover:shadow-xl transition-all duration-300 text-center`}
                                        initial={{ opacity: 0, scale: 0.8, y: 20 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        transition={{ duration: 0.6, delay: index * 0.2, type: "spring" }}
                                        whileHover={{ scale: 1.1, rotateZ: 5 }}
                                        whileTap={{ scale: 0.9 }}
                                    >
                                        <div className="flex flex-col items-center space-y-3">
                                            <motion.div
                                                whileHover={{ rotate: 15, scale: 1.2 }}
                                                transition={{ type: "spring", stiffness: 300 }}
                                            >
                                                <timeOption.icon className="w-10 h-10" />
                                            </motion.div>
                                            <motion.div
                                                className="text-4xl"
                                                whileHover={{ scale: 1.3 }}
                                                transition={{ type: "spring", stiffness: 400 }}
                                            >
                                                {timeOption.emoji}
                                            </motion.div>
                                            <div>
                                                <h3 className="font-bold text-sm">{timeOption.title}</h3>
                                                <p className="text-xs opacity-90">{timeOption.time}</p>
                                            </div>
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
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.6 }}
                        >
                            <div className="text-center mb-8">
                                <h2 className="text-xl font-bold text-gray-800 mb-2">Quanto tempo hai a disposizione?</h2>
                                <p className="text-gray-600 text-sm">Personalizza l'esperienza sulla tua disponibilità</p>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                {durationOptions.map((durationOption, index) => (
                                    <motion.button
                                        key={durationOption.id}
                                        onClick={() => handleDurationSelection(durationOption)}
                                        className={`bg-gradient-to-br ${durationOption.color} text-white p-8 rounded-3xl shadow-lg hover:shadow-xl transition-all duration-300 text-center relative overflow-hidden`}
                                        initial={{ opacity: 0, scale: 0.8, rotateY: -90 }}
                                        animate={{ opacity: 1, scale: 1, rotateY: 0 }}
                                        transition={{ duration: 0.8, delay: index * 0.15, type: "spring" }}
                                        whileHover={{ scale: 1.1, rotateY: 10 }}
                                        whileTap={{ scale: 0.9 }}
                                    >
                                        <motion.div
                                            className="absolute inset-0 bg-white/10 rounded-3xl"
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            transition={{ duration: 1, delay: index * 0.15 + 0.5 }}
                                        />
                                        <div className="relative flex flex-col items-center space-y-4">
                                            <motion.div
                                                whileHover={{ rotate: 360, scale: 1.3 }}
                                                transition={{ duration: 0.6, type: "spring" }}
                                            >
                                                <durationOption.icon className="w-12 h-12" />
                                            </motion.div>
                                            <motion.div
                                                className="text-5xl"
                                                whileHover={{ scale: 1.4, y: -5 }}
                                                transition={{ type: "spring", stiffness: 300 }}
                                            >
                                                {durationOption.emoji}
                                            </motion.div>
                                            <div>
                                                <h3 className="font-bold text-lg">{durationOption.title}</h3>
                                                <motion.div
                                                    initial={{ width: 0 }}
                                                    animate={{ width: '100%' }}
                                                    transition={{ duration: 1, delay: index * 0.15 + 0.8 }}
                                                    className="h-0.5 bg-white/60 rounded-full mt-2"
                                                />
                                            </div>
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
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.6 }}
                        >
                            <div className="text-center mb-8">
                                <h2 className="text-xl font-bold text-gray-800 mb-2">Con chi condividerai l'esperienza?</h2>
                                <p className="text-gray-600 text-sm">Ogni compagnia rende l'esperienza unica</p>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                {groupOptions.map((groupOption, index) => (
                                    <motion.button
                                        key={groupOption.id}
                                        onClick={() => handleGroupSelection(groupOption)}
                                        className={`bg-gradient-to-br ${groupOption.color} text-white p-8 rounded-3xl shadow-lg hover:shadow-xl transition-all duration-300 text-center relative overflow-hidden`}
                                        initial={{ opacity: 0, scale: 0.7, rotate: -180 }}
                                        animate={{ opacity: 1, scale: 1, rotate: 0 }}
                                        transition={{ duration: 0.8, delay: index * 0.2, type: "spring" }}
                                        whileHover={{ scale: 1.08, rotateX: 10 }}
                                        whileTap={{ scale: 0.92 }}
                                    >
                                        <motion.div
                                            className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent rounded-3xl"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{ duration: 1, delay: index * 0.2 + 0.4 }}
                                        />
                                        <div className="relative flex flex-col items-center space-y-4">
                                            <motion.div
                                                className="bg-white/20 p-4 rounded-2xl"
                                                whileHover={{ rotate: [0, -10, 10, 0], scale: 1.2 }}
                                                transition={{ duration: 0.5 }}
                                            >
                                                <groupOption.icon className="w-10 h-10" />
                                            </motion.div>
                                            <motion.div
                                                className="text-6xl"
                                                whileHover={{ scale: 1.3, y: -8 }}
                                                transition={{ type: "spring", stiffness: 400 }}
                                            >
                                                {groupOption.emoji}
                                            </motion.div>
                                            <div>
                                                <h3 className="font-bold text-xl mb-2">{groupOption.title}</h3>
                                                <motion.div
                                                    className="flex justify-center"
                                                    initial={{ scale: 0 }}
                                                    animate={{ scale: 1 }}
                                                    transition={{ duration: 0.6, delay: index * 0.2 + 0.8 }}
                                                >
                                                    <div className="bg-white/30 px-3 py-1 rounded-full">
                                                        <span className="text-sm font-medium">{groupOption.size}</span>
                                                    </div>
                                                </motion.div>
                                            </div>
                                        </div>
                                    </motion.button>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {/* Step 6: Final Personalized Experience */}
                    {currentStep === 6 && (
                        <motion.div
                            key="step6"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.6 }}
                            className="space-y-6"
                        >
                            {/* Header con confetti animati */}
                            <motion.div
                                className="relative bg-gradient-to-r from-terracotta-400 to-ochre-400 text-white rounded-3xl p-8 shadow-xl overflow-hidden"
                                initial={{ opacity: 0, scale: 0.8, rotateX: 15 }}
                                animate={{ opacity: 1, scale: 1, rotateX: 0 }}
                                transition={{ duration: 0.8 }}
                                style={{ perspective: 1000 }}
                            >
                                {/* Confetti decorativi */}
                                <div className="absolute inset-0 overflow-hidden">
                                    {[...Array(8)].map((_, i) => (
                                        <motion.div
                                            key={i}
                                            className="absolute w-2 h-2 bg-white/30 rounded-full"
                                            initial={{ x: Math.random() * 300, y: -10, opacity: 0 }}
                                            animate={{
                                                y: 200,
                                                opacity: [0, 1, 0],
                                                rotate: 360 * 3,
                                                scale: [0, 1, 0]
                                            }}
                                            transition={{
                                                duration: 2,
                                                delay: i * 0.2,
                                                repeat: Infinity,
                                                repeatDelay: 3
                                            }}
                                        />
                                    ))}
                                </div>

                                <div className="relative text-center">
                                    <motion.div
                                        className="text-6xl mb-4"
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
                                        🎉
                                    </motion.div>
                                    <h2 className="text-2xl font-bold mb-2">Perfetto!</h2>
                                    <p className="text-white/90">La tua esperienza personalizzata è pronta</p>
                                </div>
                            </motion.div>

                            {/* Esperienza principale */}
                            {selectedSubOption && (
                                <motion.div
                                    className="bg-gradient-to-br from-white/90 to-white/70 backdrop-blur-sm rounded-3xl p-6 shadow-xl relative overflow-hidden"
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ duration: 0.6, delay: 0.2 }}
                                >
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-terracotta-200/30 to-transparent rounded-full -translate-y-6 translate-x-6" />

                                    <motion.img
                                        src={selectedSubOption.image}
                                        alt={selectedSubOption.title}
                                        className="w-full h-48 rounded-2xl object-cover mb-6 shadow-lg"
                                        whileHover={{ scale: 1.03, rotateY: 5 }}
                                        transition={{ duration: 0.3 }}
                                    />

                                    <div className="text-center mb-6 relative z-10">
                                        <motion.div
                                            className="text-7xl mb-4"
                                            whileHover={{ scale: 1.2, rotate: 15 }}
                                            transition={{ type: "spring", stiffness: 300 }}
                                        >
                                            {selectedSubOption.emoji}
                                        </motion.div>
                                        <h3 className="text-2xl font-bold text-gray-800 mb-2">{selectedSubOption.title}</h3>
                                        <p className="text-gray-600 text-sm leading-relaxed">{selectedSubOption.description}</p>
                                    </div>

                                    {/* Dettagli personalizzati */}
                                    <div className="grid grid-cols-2 gap-4 mb-6">
                                        {selectedTime && (
                                            <motion.div
                                                className={`bg-gradient-to-br ${selectedTime.color} text-white p-4 rounded-2xl text-center relative overflow-hidden`}
                                                initial={{ opacity: 0, x: -20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ duration: 0.6, delay: 0.4 }}
                                                whileHover={{ scale: 1.05 }}
                                            >
                                                <div className="absolute top-0 right-0 w-8 h-8 bg-white/10 rounded-full -translate-y-1 translate-x-1" />
                                                <selectedTime.icon className="w-6 h-6 mx-auto mb-2" />
                                                <p className="font-bold text-sm">{selectedTime.title}</p>
                                                <p className="text-xs opacity-90">{selectedTime.time}</p>
                                            </motion.div>
                                        )}

                                        {selectedDuration && (
                                            <motion.div
                                                className={`bg-gradient-to-br ${selectedDuration.color} text-white p-4 rounded-2xl text-center relative overflow-hidden`}
                                                initial={{ opacity: 0, x: 20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ duration: 0.6, delay: 0.5 }}
                                                whileHover={{ scale: 1.05 }}
                                            >
                                                <div className="absolute top-0 right-0 w-8 h-8 bg-white/10 rounded-full -translate-y-1 translate-x-1" />
                                                <selectedDuration.icon className="w-6 h-6 mx-auto mb-2" />
                                                <p className="font-bold text-sm">{selectedDuration.title}</p>
                                                <p className="text-xs opacity-90">{selectedDuration.duration}</p>
                                            </motion.div>
                                        )}
                                    </div>

                                    {selectedGroup && (
                                        <motion.div
                                            className={`bg-gradient-to-br ${selectedGroup.color} text-white p-6 rounded-2xl text-center relative overflow-hidden mb-6`}
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ duration: 0.6, delay: 0.6 }}
                                            whileHover={{ scale: 1.02 }}
                                        >
                                            <div className="absolute top-0 right-0 w-16 h-16 bg-white/10 rounded-full -translate-y-4 translate-x-4" />
                                            <div className="relative flex items-center justify-center space-x-4">
                                                <selectedGroup.icon className="w-8 h-8" />
                                                <div>
                                                    <p className="font-bold text-lg">{selectedGroup.title}</p>
                                                    <p className="text-sm opacity-90">{selectedGroup.description}</p>
                                                </div>
                                                <motion.span
                                                    className="text-4xl"
                                                    whileHover={{ scale: 1.3, rotate: 15 }}
                                                >
                                                    {selectedGroup.emoji}
                                                </motion.span>
                                            </div>
                                        </motion.div>
                                    )}

                                    {/* Informazioni aggiuntive */}
                                    <motion.div
                                        className="bg-gradient-to-r from-ochre-100 to-terracotta-100 p-4 rounded-2xl mb-6"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ duration: 0.6, delay: 0.7 }}
                                    >
                                        <div className="flex items-start space-x-3">
                                            <motion.div
                                                className="bg-ochre-400 text-white p-2 rounded-xl"
                                                whileHover={{ rotate: 360 }}
                                                transition={{ duration: 0.6 }}
                                            >
                                                <MapPin className="w-5 h-5" />
                                            </motion.div>
                                            <div className="flex-1">
                                                <h4 className="font-bold text-gray-800 mb-1">Punto di ritrovo</h4>
                                                <p className="text-gray-600 text-sm">Ti invieremo la posizione esatta 30 minuti prima dell'inizio</p>
                                            </div>
                                        </div>
                                    </motion.div>

                                    <motion.div
                                        className="bg-gradient-to-r from-terracotta-100 to-ochre-100 p-4 rounded-2xl mb-6"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ duration: 0.6, delay: 0.8 }}
                                    >
                                        <div className="flex items-start space-x-3">
                                            <motion.div
                                                className="bg-terracotta-400 text-white p-2 rounded-xl"
                                                whileHover={{ scale: 1.1 }}
                                            >
                                                <Calendar className="w-5 h-5" />
                                            </motion.div>
                                            <div className="flex-1">
                                                <h4 className="font-bold text-gray-800 mb-1">Disponibilità</h4>
                                                <p className="text-gray-600 text-sm">Disponibile oggi e nei prossimi 7 giorni con prenotazione istantanea</p>
                                            </div>
                                        </div>
                                    </motion.div>

                                    {/* Pulsanti di azione */}
                                    <div className="flex space-x-3 mb-4">
                                        <Link
                                            to="/map"
                                            state={{
                                                route: quickRoute,
                                                focusedActivity: {
                                                    ...selectedSubOption,
                                                    id: selectedSubOption.id || 'qp-result',
                                                    latitude: quickRoute?.[quickRoute.length - 1]?.latitude || 41.9028,
                                                    longitude: quickRoute?.[quickRoute.length - 1]?.longitude || 12.4964,
                                                    category: 'adventure',
                                                    level: 'premium'
                                                }
                                            }}
                                            className="flex-1"
                                        >
                                            <motion.button
                                                className="w-full bg-gradient-to-r from-terracotta-400 to-terracotta-500 text-white py-4 px-6 rounded-2xl font-bold hover:from-terracotta-500 hover:to-terracotta-600 transition-all shadow-lg flex items-center justify-center space-x-2"
                                                whileHover={{ scale: 1.02, boxShadow: "0 8px 25px rgba(0,0,0,0.15)" }}
                                                whileTap={{ scale: 0.98 }}
                                                initial={{ opacity: 0, y: 20 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ duration: 0.6, delay: 0.9 }}
                                            >
                                                <Zap className="w-5 h-5" />
                                                <span>Vai alla Mappa</span>
                                            </motion.button>
                                        </Link>

                                        <Link to="/tour-details">
                                            <motion.button
                                                className="bg-white text-terracotta-500 border-2 border-terracotta-400 py-4 px-6 rounded-2xl font-bold hover:bg-terracotta-50 transition-all shadow-lg flex items-center justify-center"
                                                whileHover={{ scale: 1.05 }}
                                                whileTap={{ scale: 0.95 }}
                                                initial={{ opacity: 0, y: 20 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ duration: 0.6, delay: 1 }}
                                            >
                                                <Timer className="w-5 h-5" />
                                            </motion.button>
                                        </Link>
                                    </div>

                                    {/* Pulsante ricomincia */}
                                    <motion.button
                                        onClick={resetSelection}
                                        className="w-full bg-gray-200 text-gray-700 py-3 px-6 rounded-2xl font-medium hover:bg-gray-300 transition-colors flex items-center justify-center space-x-2"
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ duration: 0.6, delay: 1.1 }}
                                    >
                                        <RotateCcw className="w-4 h-4" />
                                        <span>Ricomincia la selezione</span>
                                    </motion.button>
                                </motion.div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>

            <BottomNavigation />
        </div>
    );
}
