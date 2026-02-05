import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { ArrowLeft, MapPin, Clock, Camera, Utensils, Palette, Eye, ShoppingBag, Coffee, Send, Sparkles, Brain, Loader, Heart, Mountain, Waves, Users, Baby, Zap, Sunset, Navigation, CloudRain, Sun, Thermometer, Wind, Star, Calendar, Home, Shuffle, Target, TrendingUp } from "lucide-react";
import { Link } from "wouter";
import TopBar from "@/components/TopBar";
import BottomNavigation from "@/components/BottomNavigation";

interface Stop {
  time: string;
  title: string;
  description: string;
  icon: typeof Camera;
  type: string;
  location?: string;
  rating?: number;
  price?: number;
  photos?: string[];
}

interface ItineraryDay {
  day: number;
  title: string;
  stops: Stop[];
  weather?: {
    condition: string;
    temperature: number;
    icon: string;
  };
}

interface Preference {
  id: string;
  title: string;
  options: string[];
  emoji: string;
  selected: string | string[];
}

const preferences: Preference[] = [
  { id: 'budget', title: 'Budget', options: ['Economico', 'Medio', 'Lusso'], emoji: '💰', selected: '' },
  { id: 'duration', title: 'Durata', options: ['Mezza Giornata', '1 Giorno', '2-3 Giorni'], emoji: '⏱️', selected: '' },
  { id: 'interests', title: 'Interessi', options: ['Arte', 'Cibo', 'Storia', 'Natura', 'Shopping', 'Vita Notturna'], emoji: '🎯', selected: [] },
  { id: 'group', title: 'Gruppo', options: ['Solo', 'Coppia', 'Famiglia', 'Amici'], emoji: '👥', selected: '' },
  { id: 'pace', title: 'Ritmo', options: ['Rilassato', 'Attivo', 'Intenso'], emoji: '🚀', selected: '' }
];

const sampleItinerary: ItineraryDay[] = [
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
  const [generatedItinerary, setGeneratedItinerary] = useState<ItineraryDay[] | null>(null);
  const [selectedStop, setSelectedStop] = useState<Stop | null>(null);
  const [currentDay, setCurrentDay] = useState(1);

  const updatePreference = (prefId: string, value: string | string[]) => {
    setUserPreferences(prev => 
      prev.map(pref => 
        pref.id === prefId 
          ? { ...pref, selected: value }
          : pref
      )
    );
  };

  const generateItinerary = () => {
    setIsGenerating(true);
    
    // Simula chiamata AI con loading realistico
    setTimeout(() => {
      setGeneratedItinerary(sampleItinerary);
      setIsGenerating(false);
      setCurrentStep(2);
    }, 3000);
  };

  const regenerateDay = (dayNumber: number) => {
    if (!generatedItinerary) return;
    
    setIsGenerating(true);
    setTimeout(() => {
      // Simula rigenerazione di un singolo giorno
      const newItinerary = [...generatedItinerary];
      // Qui potresti modificare il giorno specifico
      setGeneratedItinerary(newItinerary);
      setIsGenerating(false);
    }, 2000);
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
          <Link href="/">
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

        {/* Header */}
        <motion.div
          className="text-center mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <motion.div
            className="text-6xl mb-4"
            animate={{ rotateY: [0, 360] }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
          >
            🤖
          </motion.div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">AI Itinerary Planner</h1>
          <p className="text-gray-600">La tua guida intelligente per viaggi perfetti</p>
        </motion.div>

        {/* Step Indicator */}
        <div className="flex items-center justify-center mb-8">
          {['Preferenze', 'Generazione', 'Itinerario'].map((step, index) => (
            <div key={step} className="flex items-center">
              <motion.div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  index <= currentStep 
                    ? 'bg-terracotta-400 text-white' 
                    : 'bg-gray-300 text-gray-600'
                }`}
                whileHover={{ scale: 1.1 }}
              >
                {index + 1}
              </motion.div>
              {index < 2 && (
                <div className={`w-12 h-0.5 mx-2 transition-all ${
                  index < currentStep ? 'bg-terracotta-400' : 'bg-gray-300'
                }`} />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Preferences */}
        {currentStep === 0 && (
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.6 }}
          >
            <div className="space-y-6">
              {/* Campo di testo personalizzato per l'AI */}
              <motion.div
                className="bg-gradient-to-br from-terracotta-100 to-ochre-100 rounded-2xl p-6 shadow-lg border-2 border-terracotta-200"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
              >
                <div className="flex items-center space-x-3 mb-4">
                  <motion.div
                    className="text-3xl"
                    animate={{ rotate: [0, 10, -10, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    ✨
                  </motion.div>
                  <div>
                    <h3 className="font-bold text-lg text-terracotta-700 mb-1">Racconta la tua idea di viaggio</h3>
                    <p className="text-sm text-terracotta-600">Descrivi cosa desideri per creare un itinerario su misura</p>
                  </div>
                </div>
                
                <div className="relative">
                  <textarea
                    value={userPrompt}
                    onChange={(e) => setUserPrompt(e.target.value)}
                    placeholder="Esempio: Voglio un tour romantico con cena vista mare, oppure esperienze autentiche con artisti locali..."
                    className="w-full h-24 p-4 border-2 border-terracotta-200 rounded-xl focus:border-terracotta-400 focus:outline-none resize-none bg-white/90 text-gray-700 placeholder-gray-500"
                    style={{ fontFamily: 'Inter, sans-serif' }}
                  />
                  <motion.div
                    className="absolute bottom-3 right-3 text-terracotta-400"
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <Brain className="w-5 h-5" />
                  </motion.div>
                </div>
                
                {userPrompt && (
                  <motion.div
                    className="mt-3 flex items-center space-x-2 text-sm text-terracotta-600"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Perfetto! L'AI analizzerà la tua richiesta</span>
                  </motion.div>
                )}
              </motion.div>
              
              <motion.div
                className="text-center text-sm text-gray-600 flex items-center justify-center space-x-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                <span>✨</span>
                <span>Oppure usa le preselezioni rapide qui sotto</span>
                <span>✨</span>
              </motion.div>
              {userPreferences.map((pref, index) => (
                <motion.div
                  key={pref.id}
                  className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 shadow-lg"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                    <span className="text-2xl mr-3">{pref.emoji}</span>
                    {pref.title}
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-3">
                    {pref.options.map((option) => (
                      <motion.button
                        key={option}
                        onClick={() => {
                          if (pref.id === 'interests') {
                            const current = pref.selected as string[];
                            const newSelection = current.includes(option)
                              ? current.filter(item => item !== option)
                              : [...current, option];
                            updatePreference(pref.id, newSelection);
                          } else {
                            updatePreference(pref.id, option);
                          }
                        }}
                        className={`p-3 rounded-xl text-sm font-medium transition-all ${
                          (pref.id === 'interests' 
                            ? (pref.selected as string[]).includes(option)
                            : pref.selected === option)
                            ? 'bg-terracotta-400 text-white shadow-lg scale-105'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        {option}
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>

            <motion.button
              onClick={() => setCurrentStep(1)}
              className={`w-full mt-8 py-4 px-6 rounded-2xl font-bold shadow-lg hover:shadow-xl transition-all flex items-center justify-center space-x-2 ${
                userPrompt.trim() || userPreferences.some(pref => 
                  pref.selected && (Array.isArray(pref.selected) ? pref.selected.length > 0 : true)
                )
                  ? 'bg-gradient-to-r from-terracotta-400 to-terracotta-500 text-white'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              disabled={!userPrompt.trim() && !userPreferences.some(pref => 
                pref.selected && (Array.isArray(pref.selected) ? pref.selected.length > 0 : true)
              )}
            >
              <Brain className="w-5 h-5" />
              <span>
                {userPrompt.trim() 
                  ? 'Genera Itinerario Personalizzato' 
                  : 'Genera Itinerario AI'}
              </span>
            </motion.button>
          </motion.div>
        )}

        {/* Step 2: Generation */}
        {currentStep === 1 && (
          <motion.div
            className="text-center"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
          >
            <motion.div
              className="w-24 h-24 mx-auto mb-8 bg-gradient-to-r from-terracotta-400 to-terracotta-500 rounded-full flex items-center justify-center"
              animate={{ rotateY: [0, 360] }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            >
              <Brain className="w-12 h-12 text-white" />
            </motion.div>
            
            <h2 className="text-xl font-bold text-gray-800 mb-4">L'AI sta creando il tuo itinerario perfetto</h2>
            
            <div className="space-y-3 mb-8">
              {[
                "Analizzando le tue preferenze...",
                "Selezionando luoghi autentici...",
                "Ottimizzando i percorsi...",
                "Aggiungendo tocchi locali..."
              ].map((text, index) => (
                <motion.div
                  key={text}
                  className="flex items-center space-x-3 bg-white/70 backdrop-blur-sm rounded-xl p-4"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.8 }}
                >
                  <motion.div
                    className="w-4 h-4 bg-terracotta-400 rounded-full"
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 1, repeat: Infinity, delay: index * 0.2 }}
                  />
                  <span className="text-gray-700">{text}</span>
                </motion.div>
              ))}
            </div>

            <motion.button
              onClick={generateItinerary}
              className="bg-gray-300 text-gray-700 py-3 px-6 rounded-xl opacity-50 cursor-not-allowed"
              disabled
            >
              Generazione in corso...
            </motion.button>
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
                  className={`flex-shrink-0 px-4 py-2 rounded-xl font-medium transition-all ${
                    currentDay === day.day
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
                    <div className="space-y-4">
                      {day.stops.map((stop, index) => (
                        <motion.div
                          key={index}
                          className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 shadow-lg relative"
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.1 }}
                          whileHover={{ scale: 1.02 }}
                        >
                          {/* Timeline connector */}
                          {index < day.stops.length - 1 && (
                            <div className="absolute left-12 top-16 w-0.5 h-12 bg-gradient-to-b from-terracotta-400 to-terracotta-300 z-10" />
                          )}
                          
                          <div className="flex space-x-4">
                            <div className="flex-shrink-0">
                              <div className="w-12 h-12 bg-gradient-to-br from-terracotta-300 to-terracotta-400 rounded-full flex items-center justify-center relative z-20">
                                <stop.icon className="w-6 h-6 text-white" />
                              </div>
                              <div className="text-center mt-2">
                                <span className="text-xs font-bold text-terracotta-600">{stop.time}</span>
                              </div>
                            </div>
                            
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="font-bold text-gray-800">{stop.title}</h4>
                                {stop.rating && (
                                  <div className="flex items-center space-x-1">
                                    <Star className="w-4 h-4 text-yellow-400 fill-current" />
                                    <span className="text-sm font-medium text-gray-700">{stop.rating}</span>
                                  </div>
                                )}
                              </div>
                              
                              <p className="text-sm text-gray-600 mb-3">{stop.description}</p>
                              
                              {stop.location && (
                                <p className="text-xs text-gray-500 flex items-center mb-2">
                                  <MapPin className="w-3 h-3 mr-1" />
                                  {stop.location}
                                </p>
                              )}
                              
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-4">
                                  {stop.price !== undefined && (
                                    <span className="text-sm font-medium text-terracotta-600">
                                      {stop.price === 0 ? 'Gratuito' : `€${stop.price}`}
                                    </span>
                                  )}
                                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                    stop.type === 'cultura' ? 'bg-purple-100 text-purple-700' :
                                    stop.type === 'food' ? 'bg-red-100 text-red-700' :
                                    stop.type === 'shopping' ? 'bg-green-100 text-green-700' :
                                    stop.type === 'relax' ? 'bg-blue-100 text-blue-700' :
                                    'bg-gray-100 text-gray-700'
                                  }`}>
                                    {stop.type}
                                  </span>
                                </div>
                                
                                <motion.button
                                  onClick={() => setSelectedStop(stop)}
                                  className="text-terracotta-600 hover:text-terracotta-700 text-sm font-medium"
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                >
                                  Dettagli →
                                </motion.button>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      ))}
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
              
              <Link href="/tour-live" className="flex-1">
                <motion.button
                  className="w-full bg-gradient-to-r from-terracotta-400 to-terracotta-500 text-white py-3 px-4 rounded-xl font-medium shadow-lg hover:shadow-xl transition-all flex items-center justify-center space-x-2"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Navigation className="w-4 h-4" />
                  <span>Inizia Tour</span>
                </motion.button>
              </Link>
            </div>
          </motion.div>
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

                  <Link href="/tour-details">
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
      </main>
      
      <BottomNavigation />
    </div>
  );
}