import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { ArrowLeft, MapPin, Clock, Camera, Utensils, Palette, Eye, ShoppingBag, Coffee, Send, Sparkles, Brain, Loader, Heart, Mountain, Waves, Users, Baby, Zap, Sunset, Navigation, CloudRain, Sun, Thermometer, Wind } from "lucide-react";
import { Link } from "wouter";
import TopBar from "@/components/TopBar";
import BottomNavigation from "@/components/BottomNavigation";

const itineraryData = [
  {
    day: 1,
    title: "Primo giorno - Immersione nel centro storico",
    stops: [
      {
        time: "09:00",
        title: "Cattedrale di Palermo",
        description: "Visita guidata alla maestosa cattedrale normanna",
        icon: Camera,
        type: "cultura"
      },
      {
        time: "11:30",
        title: "Mercato di Ballarò",
        description: "Colazione tradizionale tra i banchi del mercato",
        icon: Utensils,
        type: "food"
      },
      {
        time: "14:00",
        title: "Palazzo dei Normanni",
        description: "Cappella Palatina e appartamenti reali",
        icon: Eye,
        type: "cultura"
      }
    ]
  },
  {
    day: 2,
    title: "Secondo giorno - Arte e sapori",
    stops: [
      {
        time: "10:00",
        title: "Quartiere Kalsa",
        description: "Street art e gallerie d'arte contemporanea",
        icon: Palette,
        type: "arte"
      },
      {
        time: "12:30",
        title: "Cooking class siciliana",
        description: "Impara a preparare arancini e cannoli",
        icon: Utensils,
        type: "food"
      },
      {
        time: "16:00",
        title: "Orto Botanico",
        description: "Passeggiata rilassante tra piante esotiche",
        icon: Eye,
        type: "natura"
      }
    ]
  },
  {
    day: 3,
    title: "Terzo giorno - Tradizione e relax",
    stops: [
      {
        time: "09:30",
        title: "Mercato dell'antiquariato",
        description: "Caccia al tesoro tra oggetti vintage",
        icon: ShoppingBag,
        type: "shopping"
      },
      {
        time: "11:30",
        title: "Caffè storico Antico Caffè Spinnato",
        description: "Granita e brioche con vista sul mare",
        icon: Coffee,
        type: "food"
      },
      {
        time: "15:00",
        title: "Spiaggia di Mondello",
        description: "Relax finale con vista sul Golfo di Palermo",
        icon: Eye,
        type: "relax"
      }
    ]
  }
];

const getTypeColor = (type: string) => {
  switch (type) {
    case 'cultura': return 'bg-blue-100 text-blue-800';
    case 'food': return 'bg-orange-100 text-orange-800';
    case 'arte': return 'bg-purple-100 text-purple-800';
    case 'natura': return 'bg-green-100 text-green-800';
    case 'shopping': return 'bg-pink-100 text-pink-800';
    case 'relax': return 'bg-cyan-100 text-cyan-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

// Function to generate dynamic itinerary based on user input
const generateItinerary = (prompt: string) => {
  // Simulate AI processing with contextual responses
  const keywords = prompt.toLowerCase();
  
  // Base structure that adapts based on keywords
  const baseStops = {
    food: [
      { time: "10:00", title: "Mercato di Ballarò", description: "Colazione tradizionale tra i banchi del mercato", icon: Utensils, type: "food" },
      { time: "12:30", title: "Cooking class siciliana", description: "Impara a preparare arancini e cannoli", icon: Utensils, type: "food" },
      { time: "19:00", title: "Cena in trattoria tipica", description: "Autentica cucina siciliana con vini locali", icon: Utensils, type: "food" }
    ],
    culture: [
      { time: "09:00", title: "Cattedrale di Palermo", description: "Visita guidata alla maestosa cattedrale normanna", icon: Camera, type: "cultura" },
      { time: "14:00", title: "Palazzo dei Normanni", description: "Cappella Palatina e appartamenti reali", icon: Eye, type: "cultura" },
      { time: "16:30", title: "Teatro Massimo", description: "Visita al famoso teatro dell'opera", icon: Camera, type: "cultura" }
    ],
    art: [
      { time: "10:00", title: "Quartiere Kalsa", description: "Street art e gallerie d'arte contemporanea", icon: Palette, type: "arte" },
      { time: "15:00", title: "Palazzo Abatellis", description: "Museo di arte siciliana medievale", icon: Eye, type: "arte" },
      { time: "17:00", title: "Vucciria Art District", description: "Murales e installazioni artistiche", icon: Palette, type: "arte" }
    ],
    relax: [
      { time: "09:30", title: "Giardino Botanico", description: "Passeggiata rilassante tra piante esotiche", icon: Eye, type: "natura" },
      { time: "15:00", title: "Spiaggia di Mondello", description: "Relax finale con vista sul Golfo di Palermo", icon: Eye, type: "relax" },
      { time: "18:00", title: "Aperitivo sul mare", description: "Drink al tramonto con vista panoramica", icon: Coffee, type: "relax" }
    ]
  };
  
  // Generate days based on user preferences
  const days = [];
  const preferredActivities = [];
  
  if (keywords.includes('cibo') || keywords.includes('food') || keywords.includes('cucina') || keywords.includes('mangiare')) {
    preferredActivities.push('food');
  }
  if (keywords.includes('cultura') || keywords.includes('storia') || keywords.includes('monument') || keywords.includes('chiesa')) {
    preferredActivities.push('culture');
  }
  if (keywords.includes('arte') || keywords.includes('art') || keywords.includes('museo') || keywords.includes('gallery')) {
    preferredActivities.push('art');
  }
  if (keywords.includes('relax') || keywords.includes('mare') || keywords.includes('natura') || keywords.includes('tranquillo')) {
    preferredActivities.push('relax');
  }
  
  // Default to balanced itinerary if no specific preferences
  if (preferredActivities.length === 0) {
    preferredActivities.push('culture', 'food', 'relax');
  }
  
  // Generate 3 days mixing preferred activities
  for (let day = 1; day <= 3; day++) {
    const dayTitle = `Giorno ${day} - ${getDayTheme(day, preferredActivities, keywords)}`;
    const stops = [];
    
    // Mix activities based on preferences
    const dayActivities = preferredActivities.slice(0, 3);
    dayActivities.forEach((activity, index) => {
      if (baseStops[activity] && baseStops[activity][day - 1]) {
        stops.push(baseStops[activity][day - 1]);
      }
    });
    
    // Fill remaining slots with diverse activities
    while (stops.length < 3) {
      const allActivities = ['food', 'culture', 'art', 'relax'];
      const randomActivity = allActivities[Math.floor(Math.random() * allActivities.length)];
      const randomStop = baseStops[randomActivity][Math.floor(Math.random() * baseStops[randomActivity].length)];
      if (!stops.some(stop => stop.title === randomStop.title)) {
        stops.push(randomStop);
      }
    }
    
    days.push({ day, title: dayTitle, stops: stops.slice(0, 3) });
  }
  
  return days;
};

const getDayTheme = (day: number, preferences: string[], keywords: string) => {
  if (day === 1) return "Primo approccio alla città";
  if (day === 2) return "Immersione nella cultura locale";
  if (day === 3) return "Scoperte e relax";
  return "Esplorazione libera";
};

export default function AIItineraryPage() {
  const [userPrompt, setUserPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedItinerary, setGeneratedItinerary] = useState<any[]>([]);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [currentLocation, setCurrentLocation] = useState('Palermo');
  const [userPosition, setUserPosition] = useState<{lat: number, lng: number} | null>(null);
  const [weatherInfo, setWeatherInfo] = useState<any>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [locationSuggestions, setLocationSuggestions] = useState<any[]>([]);

  // Simulate getting user location
  const getUserLocation = async () => {
    setIsLoadingLocation(true);
    try {
      // Simulate geolocation API call
      const position = { lat: 38.1157, lng: 13.3613 }; // Palermo coordinates
      setUserPosition(position);
      
      // Simulate weather API call based on location
      const weather = {
        temp: 22,
        condition: 'sunny',
        humidity: 65,
        windSpeed: 15,
        description: 'Soleggiato con temperature miti'
      };
      setWeatherInfo(weather);
      
      // Update location name based on coordinates
      setCurrentLocation('Palermo');
      
      // Generate location-based suggestions
      updateLocationSuggestions(position, weather);
    } catch (error) {
      console.error('Error getting location:', error);
    } finally {
      setIsLoadingLocation(false);
    }
  };

  // Update suggestions based on location and weather
  const updateLocationSuggestions = (position: {lat: number, lng: number}, weather: any) => {
    const baseSuggestions = [
      {
        text: "Voglio esplorare la cucina siciliana autentica",
        emoji: "🍝",
        icon: Utensils,
        color: "from-orange-400 to-red-400",
        keywords: ["cibo", "cucina", "autentica"],
        weatherBonus: weather.condition === 'sunny' ? "Perfetto per visitare i mercati all'aperto!" : ""
      },
      {
        text: "Interessato all'arte e alla cultura locale",
        emoji: "🎨",
        icon: Palette,
        color: "from-purple-400 to-pink-400",
        keywords: ["arte", "cultura", "storia"],
        weatherBonus: weather.condition === 'rainy' ? "Ideale per visitare musei al coperto!" : ""
      },
      {
        text: "Preferisco un viaggio rilassante con natura e mare",
        emoji: "🌊",
        icon: Waves,
        color: "from-blue-400 to-cyan-400",
        keywords: ["relax", "natura", "mare"],
        weatherBonus: weather.temp > 20 ? "Temperature perfette per la spiaggia!" : "Meglio passeggiate costiere!"
      },
      {
        text: "Mix di storia, cibo e vita notturna",
        emoji: "🌃",
        icon: Zap,
        color: "from-indigo-400 to-purple-400",
        keywords: ["storia", "cibo", "notte"],
        weatherBonus: "Perfetto per esplorare il centro storico!"
      },
      {
        text: "Esperienza per famiglia con bambini",
        emoji: "👨‍👩‍👧‍👦",
        icon: Baby,
        color: "from-green-400 to-emerald-400",
        keywords: ["famiglia", "bambini", "sicuro"],
        weatherBonus: weather.condition === 'sunny' ? "Tempo ideale per attività all'aperto con i bambini!" : ""
      }
    ];
    
    setLocationSuggestions(baseSuggestions);
  };

  // Load user location on component mount
  useEffect(() => {
    getUserLocation();
  }, []);

  const handleGenerateItinerary = async () => {
    if (!userPrompt.trim()) return;
    
    setIsGenerating(true);
    
    // Simulate AI processing time
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const itinerary = generateContextualItinerary();
    setGeneratedItinerary(itinerary);
    setHasGenerated(true);
    setIsGenerating(false);
  };

  // Generate itinerary based on location, weather, and preferences
  const generateContextualItinerary = () => {
    const weatherContext = weatherInfo?.condition || 'sunny';
    const temperature = weatherInfo?.temp || 22;
    
    // Adapt itinerary based on weather and location
    if (weatherContext === 'rainy') {
      return generateIndoorItinerary();
    } else if (temperature > 25) {
      return generateWarmWeatherItinerary();
    } else {
      return generateItinerary(userPrompt);
    }
  };

  const generateIndoorItinerary = () => {
    return [
      {
        day: 1,
        title: "Arte e cultura al coperto",
        stops: [
          {
            time: "09:00",
            title: "Palazzo Abatellis - Galleria Regionale",
            description: "Capolavori dell'arte siciliana in un palazzo del XV secolo. Perfetto per una giornata di pioggia.",
            type: "cultura",
            icon: Palette
          },
          {
            time: "11:30",
            title: "Teatro Massimo - Visita guidata",
            description: "Uno dei teatri lirici più famosi d'Europa. Tour interno con audioguida.",
            type: "cultura",
            icon: Eye
          },
          {
            time: "13:00",
            title: "Trattoria Al Ferro di Cavallo",
            description: "Cucina tradizionale siciliana in ambiente accogliente e coperto.",
            type: "food",
            icon: Utensils
          }
        ]
      }
    ];
  };

  const generateWarmWeatherItinerary = () => {
    return [
      {
        day: 1,
        title: "Mare e natura sotto il sole",
        stops: [
          {
            time: "08:00",
            title: "Spiaggia di Mondello",
            description: "La perla di Palermo! Sabbia dorata e acque cristalline. Temperature perfette per il mare.",
            type: "natura",
            icon: Waves
          },
          {
            time: "12:00",
            title: "Pranzo vista mare",
            description: "Pesce fresco con vista sulla baia di Mondello. Brezza marina inclusa!",
            type: "food",
            icon: Utensils
          },
          {
            time: "15:00",
            title: "Passeggiata al Foro Italico",
            description: "Lunghe passeggiate sotto il sole siciliano, con vista sul porto.",
            type: "relax",
            icon: Sunset
          }
        ]
      }
    ];
  };



  return (
    <div className="min-h-screen bg-gradient-to-b from-ochre-100 to-ochre-200 font-quicksand">
      <TopBar />
      
      <main className="max-w-md mx-auto px-4 py-8 pb-24">
        {/* Header with Location & Weather */}
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="flex items-center mb-4">
            <Link href="/">
              <motion.button
                className="p-2 rounded-full bg-white/60 backdrop-blur-sm mr-4 hover:bg-white/80 transition-colors"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <ArrowLeft className="w-5 h-5 text-gray-700" />
              </motion.button>
            </Link>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-gray-800">Il tuo viaggio personalizzato</h1>
            </div>
            <motion.button
              onClick={getUserLocation}
              disabled={isLoadingLocation}
              className="p-2 bg-terracotta-400 text-white rounded-xl hover:bg-terracotta-500 transition-colors"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {isLoadingLocation ? <Loader className="w-5 h-5 animate-spin" /> : <Navigation className="w-5 h-5" />}
            </motion.button>
          </div>
          
          {/* Location & Weather Info */}
          {userPosition && weatherInfo && (
            <motion.div
              className="bg-gradient-to-r from-terracotta-400/10 to-ochre-400/10 rounded-2xl p-4 mb-4"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8 }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <motion.div
                    className="w-12 h-12 bg-terracotta-400 rounded-xl flex items-center justify-center"
                    whileHover={{ rotate: 15 }}
                  >
                    <MapPin className="w-6 h-6 text-white" />
                  </motion.div>
                  <div>
                    <h3 className="font-bold text-gray-800">{currentLocation}</h3>
                    <p className="text-sm text-gray-600">La tua posizione attuale</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-4">
                  <motion.div
                    className="flex items-center space-x-2"
                    whileHover={{ scale: 1.05 }}
                  >
                    {weatherInfo.condition === 'sunny' ? (
                      <Sun className="w-6 h-6 text-yellow-500" />
                    ) : weatherInfo.condition === 'rainy' ? (
                      <CloudRain className="w-6 h-6 text-blue-500" />
                    ) : (
                      <Sun className="w-6 h-6 text-yellow-500" />
                    )}
                    <span className="font-bold text-lg">{weatherInfo.temp}°C</span>
                  </motion.div>
                  
                  <motion.div
                    className="flex items-center space-x-1"
                    whileHover={{ scale: 1.05 }}
                  >
                    <Wind className="w-4 h-4 text-gray-500" />
                    <span className="text-sm text-gray-600">{weatherInfo.windSpeed} km/h</span>
                  </motion.div>
                </div>
              </div>
              
              <p className="text-sm text-gray-600 mt-2">{weatherInfo.description}</p>
            </motion.div>
          )}
        </motion.div>

        {/* AI Prompt Section */}
        {!hasGenerated && (
          <motion.div
            className="mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <motion.div 
              className="bg-gradient-to-br from-white/80 to-white/60 backdrop-blur-sm rounded-3xl p-8 shadow-lg mb-6 border border-white/30"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6 }}
            >
              <div className="flex items-center justify-center mb-6">
                <motion.div
                  className="bg-gradient-to-r from-terracotta-400 to-ochre-400 p-4 rounded-2xl mr-4"
                  whileHover={{ rotate: 15, scale: 1.1 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <Brain className="w-8 h-8 text-white" />
                </motion.div>
                <div className="text-center">
                  <h2 className="text-xl font-bold text-gray-800">Descrivi il tuo viaggio ideale</h2>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: '100px' }}
                    transition={{ duration: 1, delay: 0.3 }}
                    className="h-1 bg-gradient-to-r from-terracotta-400 to-ochre-400 rounded-full mx-auto mt-2"
                  />
                </div>
              </div>
              
              <motion.p 
                className="text-gray-600 text-center mb-6 leading-relaxed"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                Racconta cosa ti piacerebbe fare, vedere e provare. L'AI creerà un itinerario personalizzato per te.
              </motion.p>
              
              <div className="space-y-6">
                <motion.div 
                  className="relative"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.4 }}
                >
                  <textarea
                    value={userPrompt}
                    onChange={(e) => setUserPrompt(e.target.value)}
                    placeholder="Esempio: Vorrei un viaggio di 3 giorni a Palermo con focus su cucina locale, mercati storici e un po' di relax al mare..."
                    className="w-full h-40 px-6 py-4 bg-white/70 backdrop-blur-sm rounded-2xl border-2 border-gray-200 focus:outline-none focus:ring-4 focus:ring-terracotta-200 focus:border-terracotta-400 transition-all resize-none text-gray-700 leading-relaxed"
                    disabled={isGenerating}
                  />
                  <motion.div 
                    className="absolute bottom-4 right-4 flex items-center space-x-2"
                    whileHover={{ scale: 1.1 }}
                  >
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    >
                      <Sparkles className="w-5 h-5 text-terracotta-400" />
                    </motion.div>
                    <span className="text-sm font-medium text-terracotta-600">AI</span>
                  </motion.div>
                </motion.div>
                
                <motion.button
                  onClick={handleGenerateItinerary}
                  disabled={!userPrompt.trim() || isGenerating}
                  className={`w-full py-4 rounded-2xl font-bold text-lg transition-all flex items-center justify-center space-x-3 shadow-lg ${
                    userPrompt.trim() && !isGenerating
                      ? 'bg-gradient-to-r from-terracotta-400 to-terracotta-500 text-white hover:shadow-xl'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                  whileHover={userPrompt.trim() && !isGenerating ? { scale: 1.05, rotateX: 5 } : {}}
                  whileTap={userPrompt.trim() && !isGenerating ? { scale: 0.95 } : {}}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.6 }}
                >
                  {isGenerating ? (
                    <>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      >
                        <Loader className="w-6 h-6" />
                      </motion.div>
                      <span>Generando itinerario magico...</span>
                    </>
                  ) : (
                    <>
                      <motion.div
                        whileHover={{ x: 5 }}
                        transition={{ type: "spring", stiffness: 300 }}
                      >
                        <Send className="w-6 h-6" />
                      </motion.div>
                      <span>Genera itinerario personalizzato</span>
                    </>
                  )}
                </motion.button>
              </div>
            </motion.div>
            
            {/* Interactive Quick Suggestions */}
            <div className="mb-6">
              <h3 className="text-xl font-bold text-gray-800 mb-6 text-center">Suggerimenti basati sulla tua posizione</h3>
              <div className="grid grid-cols-1 gap-4">
                {locationSuggestions.map((suggestion, index) => (
                  <motion.button
                    key={index}
                    onClick={() => setUserPrompt(suggestion.text)}
                    className={`bg-gradient-to-br ${suggestion.color} text-white p-6 rounded-3xl shadow-lg hover:shadow-xl transition-all duration-300 relative overflow-hidden`}
                    initial={{ opacity: 0, scale: 0.8, rotateY: -90 }}
                    animate={{ opacity: 1, scale: 1, rotateY: 0 }}
                    transition={{ duration: 0.8, delay: index * 0.1, type: "spring" }}
                    whileHover={{ scale: 1.05, rotateX: 10 }}
                    whileTap={{ scale: 0.95 }}
                    disabled={isGenerating}
                  >
                    <motion.div
                      className="absolute inset-0 bg-white/10 rounded-3xl"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ duration: 1, delay: index * 0.1 + 0.5 }}
                    />
                    <div className="relative flex items-center space-x-4">
                      <motion.div
                        className="bg-white/20 p-4 rounded-2xl"
                        whileHover={{ rotate: [0, -10, 10, 0], scale: 1.2 }}
                        transition={{ duration: 0.5 }}
                      >
                        <suggestion.icon className="w-8 h-8" />
                      </motion.div>
                      
                      <div className="flex-1 text-left">
                        <motion.div 
                          className="text-6xl mb-2"
                          whileHover={{ scale: 1.3, rotate: 10 }}
                          transition={{ type: "spring", stiffness: 300 }}
                        >
                          {suggestion.emoji}
                        </motion.div>
                        <h4 className="font-bold text-lg leading-tight">{suggestion.text}</h4>
                        
                        {/* Weather Bonus */}
                        {suggestion.weatherBonus && (
                          <motion.div
                            className="bg-white/20 rounded-lg p-2 mt-2 flex items-center space-x-2"
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.6, delay: index * 0.1 + 0.6 }}
                          >
                            {weatherInfo?.condition === 'sunny' ? (
                              <Sun className="w-4 h-4" />
                            ) : (
                              <CloudRain className="w-4 h-4" />
                            )}
                            <p className="text-xs font-medium">{suggestion.weatherBonus}</p>
                          </motion.div>
                        )}
                        
                        <motion.div
                          className="flex flex-wrap gap-2 mt-3"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.6, delay: index * 0.1 + 0.8 }}
                        >
                          {suggestion.keywords.map((keyword, kidx) => (
                            <span 
                              key={kidx}
                              className="bg-white/30 px-2 py-1 rounded-full text-xs font-medium"
                            >
                              {keyword}
                            </span>
                          ))}
                        </motion.div>
                      </div>
                      
                      <motion.div
                        whileHover={{ x: 5 }}
                        transition={{ type: "spring", stiffness: 300 }}
                      >
                        <Sparkles className="w-6 h-6 text-white/80" />
                      </motion.div>
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* Generated Itinerary Header */}
        {hasGenerated && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, type: "spring" }}
            className="mb-8"
          >
            <motion.div className="bg-gradient-to-br from-terracotta-400 to-ochre-400 rounded-3xl p-8 shadow-xl text-white text-center relative overflow-hidden">
              <motion.div
                className="absolute inset-0 bg-white/10 rounded-3xl"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ duration: 1, delay: 0.3 }}
              />
              <div className="relative">
                <motion.div
                  className="text-8xl mb-4"
                  whileHover={{ scale: 1.2, rotate: 10 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  🗺️
                </motion.div>
                <h2 className="text-2xl font-bold mb-2">Il tuo itinerario è pronto!</h2>
                <p className="text-lg opacity-90 mb-4">3 giorni indimenticabili a {currentLocation}</p>
                <motion.button
                  onClick={() => {
                    setHasGenerated(false);
                    setGeneratedItinerary([]);
                    setUserPrompt('');
                  }}
                  className="bg-white/20 text-white px-6 py-3 rounded-2xl font-medium hover:bg-white/30 transition-colors"
                  whileHover={{ scale: 1.05, rotateX: 5 }}
                  whileTap={{ scale: 0.95 }}
                >
                  ✨ Genera nuovo itinerario
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Generated Itinerary Days */}
        {hasGenerated && (
          <div className="space-y-8">
            {generatedItinerary.map((day, dayIndex) => (
              <motion.div
                key={day.day}
                className="bg-gradient-to-br from-white/90 to-white/70 backdrop-blur-sm rounded-3xl p-8 shadow-xl border border-white/30 relative overflow-hidden"
                initial={{ opacity: 0, rotateY: -90 }}
                animate={{ opacity: 1, rotateY: 0 }}
                transition={{ duration: 0.8, delay: dayIndex * 0.3, type: "spring" }}
                whileHover={{ scale: 1.02 }}
              >
                <motion.div
                  className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-terracotta-400 to-ochre-400 rounded-t-3xl"
                  initial={{ width: 0 }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 1, delay: dayIndex * 0.3 + 0.5 }}
                />
                
                <div className="flex items-center mb-8">
                  <motion.div 
                    className="w-16 h-16 bg-gradient-to-br from-terracotta-400 to-ochre-400 text-white rounded-3xl flex items-center justify-center text-2xl font-bold mr-6 shadow-lg"
                    whileHover={{ rotate: 360, scale: 1.1 }}
                    transition={{ duration: 0.6 }}
                  >
                    {day.day}
                  </motion.div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-800 mb-2">{day.title}</h3>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: '120px' }}
                      transition={{ duration: 1, delay: dayIndex * 0.3 + 0.8 }}
                      className="h-1 bg-gradient-to-r from-terracotta-400 to-ochre-400 rounded-full"
                    />
                  </div>
                </div>
                
                <div className="space-y-6">
                  {day.stops.map((stop, stopIndex) => (
                    <motion.div
                      key={stopIndex}
                      className="bg-gradient-to-r from-white/80 to-white/60 p-6 rounded-2xl shadow-lg border border-white/40 hover:shadow-xl transition-all duration-300"
                      initial={{ opacity: 0, scale: 0.8, x: -50 }}
                      animate={{ opacity: 1, scale: 1, x: 0 }}
                      transition={{ duration: 0.8, delay: dayIndex * 0.3 + stopIndex * 0.2 + 0.8, type: "spring" }}
                      whileHover={{ scale: 1.03, rotateY: 5 }}
                    >
                      <div className="flex items-center space-x-6">
                        <motion.div 
                          className="flex-shrink-0"
                          whileHover={{ scale: 1.2, rotate: 15 }}
                          transition={{ type: "spring", stiffness: 300 }}
                        >
                          <div className="w-16 h-16 bg-gradient-to-br from-terracotta-300 to-terracotta-400 rounded-2xl flex items-center justify-center shadow-lg">
                            <stop.icon className="w-8 h-8 text-white" />
                          </div>
                        </motion.div>
                        
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-3">
                            <motion.span 
                              className="bg-terracotta-400 text-white px-4 py-2 rounded-full text-sm font-bold"
                              whileHover={{ scale: 1.1 }}
                            >
                              {stop.time}
                            </motion.span>
                            <motion.span 
                              className={`px-3 py-2 rounded-full text-xs font-bold ${getTypeColor(stop.type)}`}
                              whileHover={{ scale: 1.1 }}
                            >
                              {stop.type}
                            </motion.span>
                          </div>
                          <h4 className="font-bold text-xl text-gray-800 mb-2">{stop.title}</h4>
                          <p className="text-gray-600 leading-relaxed">{stop.description}</p>
                        </div>
                        
                        <motion.div
                          className="text-4xl"
                          whileHover={{ scale: 1.3, rotate: 15 }}
                          transition={{ type: "spring", stiffness: 400 }}
                        >
                          {stop.type === 'cultura' ? '🏛️' : 
                           stop.type === 'food' ? '🍽️' : 
                           stop.type === 'arte' ? '🎨' : 
                           stop.type === 'natura' ? '🌿' : 
                           stop.type === 'shopping' ? '🛍️' : 
                           stop.type === 'relax' ? '🌊' : '✨'}
                        </motion.div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Interactive Action Buttons */}
        {hasGenerated && (
          <motion.div
            className="mt-12 space-y-6"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1.5 }}
          >
            <motion.button 
              className="w-full bg-gradient-to-r from-terracotta-400 to-terracotta-500 text-white py-6 rounded-3xl font-bold text-lg shadow-xl hover:shadow-2xl transition-all duration-300 flex items-center justify-center space-x-4 relative overflow-hidden"
              whileHover={{ scale: 1.05, rotateX: 5 }}
              whileTap={{ scale: 0.95 }}
              initial={{ rotateY: -90 }}
              animate={{ rotateY: 0 }}
              transition={{ duration: 0.8, delay: 1.7 }}
            >
              <motion.div
                className="absolute inset-0 bg-white/10 rounded-3xl"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ duration: 1, delay: 1.9 }}
              />
              <motion.div
                whileHover={{ rotate: 15, scale: 1.2 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <Palette className="w-7 h-7" />
              </motion.div>
              <span>🎨 Personalizza itinerario</span>
            </motion.button>

            <motion.button 
              className="w-full bg-gradient-to-r from-olive-400 to-olive-500 text-white py-6 rounded-3xl font-bold text-lg shadow-xl hover:shadow-2xl transition-all duration-300 flex items-center justify-center space-x-4 relative overflow-hidden"
              whileHover={{ scale: 1.05, rotateX: -5 }}
              whileTap={{ scale: 0.95 }}
              initial={{ rotateY: 90 }}
              animate={{ rotateY: 0 }}
              transition={{ duration: 0.8, delay: 1.9 }}
            >
              <motion.div
                className="absolute inset-0 bg-white/10 rounded-3xl"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ duration: 1, delay: 2.1 }}
              />
              <motion.div
                whileHover={{ y: -3, scale: 1.2 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <Heart className="w-7 h-7" />
              </motion.div>
              <span>💾 Salva e condividi</span>
            </motion.button>

            <motion.button
              onClick={() => {
                setHasGenerated(false);
                setGeneratedItinerary([]);
                setUserPrompt('');
              }}
              className="w-full bg-gradient-to-r from-gray-400 to-gray-500 text-white py-6 rounded-3xl font-bold text-lg shadow-xl hover:shadow-2xl transition-all duration-300 flex items-center justify-center space-x-4 relative overflow-hidden"
              whileHover={{ scale: 1.05, rotateZ: 2 }}
              whileTap={{ scale: 0.95 }}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.8, delay: 2.1, type: "spring" }}
            >
              <motion.div
                className="absolute inset-0 bg-white/10 rounded-3xl"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ duration: 1, delay: 2.3 }}
              />
              <motion.div
                whileHover={{ rotate: 360 }}
                transition={{ duration: 0.6 }}
              >
                <Sparkles className="w-7 h-7" />
              </motion.div>
              <span>✨ Genera nuovo itinerario</span>
            </motion.button>
          </motion.div>
        )}
      </main>

      <BottomNavigation />
    </div>
  );
}