import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import { Users, Brain, Zap, Sparkles, Globe, Compass, ArrowRight, Star, MapPin, Clock, Shuffle, TrendingUp, Calendar, Heart, Camera } from "lucide-react";
import { useState, useEffect } from "react";
import TopBar from "@/components/TopBar";
import FeaturedExperience from "@/components/FeaturedExperience";
import PromotionalBanner from "@/components/PromotionalBanner";
import BottomNavigation from "@/components/BottomNavigation";
import PersonalizedWelcome from "@/components/PersonalizedWelcome";
import { SmartNotificationSystem } from "@/components/SmartNotificationSystem";
import { MVPStats, ValuePropositions } from "@/components/MVPEnhancements";

const dynamicExperiences = [
  {
    id: 1,
    title: "Cucina con Nonna Elena",
    location: "Toscana, Chianti",
    rating: 4.9,
    reviews: 127,
    price: 45,
    duration: "3 ore",
    image: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=300&fit=crop",
    tag: "🔥 Trending",
    tagColor: "from-red-400 to-red-500",
    category: "food",
    emoji: "👵🍝"
  },
  {
    id: 2,
    title: "Street Art di Napoli",
    location: "Napoli, Quartieri Spagnoli",
    rating: 4.8,
    reviews: 89,
    price: 25,
    duration: "2 ore",
    image: "https://images.unsplash.com/photo-1539650116574-75c0c6d73f6e?w=400&h=300&fit=crop",
    tag: "✨ Nuovo",
    tagColor: "from-purple-400 to-purple-500",
    category: "art",
    emoji: "🎨🏛️"
  },
  {
    id: 3,
    title: "Tramonto in Gondola",
    location: "Venezia, Canal Grande",
    rating: 4.7,
    reviews: 203,
    price: 75,
    duration: "90 min",
    image: "https://images.unsplash.com/photo-1523906834658-6e24ef2386f9?w=400&h=300&fit=crop",
    tag: "💫 Speciale",
    tagColor: "from-amber-400 to-amber-500",
    category: "romance",
    emoji: "🚤🌅"
  },
  {
    id: 4,
    title: "Degustazione Vini Siciliani",
    location: "Sicilia, Etna",
    rating: 4.9,
    reviews: 156,
    price: 55,
    duration: "4 ore",
    image: "https://images.unsplash.com/photo-1474722883778-792e7990302f?w=400&h=300&fit=crop",
    tag: "🍷 Premium",
    tagColor: "from-green-400 to-green-500",
    category: "wine",
    emoji: "🍇🌋"
  },
  {
    id: 5,
    title: "Mercati Storici Palermo",
    location: "Palermo, Ballarò",
    rating: 4.6,
    reviews: 94,
    price: 20,
    duration: "2.5 ore",
    image: "https://images.unsplash.com/photo-1580500722723-e2dc6e1b7bb8?w=400&h=300&fit=crop",
    tag: "🎭 Autentico",
    tagColor: "from-blue-400 to-blue-500",
    category: "culture",
    emoji: "🛒🏺"
  }
];

const quickActions = [
  {
    id: 1,
    title: "Tour Sorpresa",
    description: "Lasciati sorprendere",
    icon: Shuffle,
    color: "from-pink-400 to-pink-500",
    emoji: "🎲",
    link: "/surprise-tour"
  },
  {
    id: 2,
    title: "Popolari",
    description: "I più richiesti",
    icon: TrendingUp,
    color: "from-orange-400 to-orange-500",
    emoji: "🔥",
    link: "/trending"
  },
  {
    id: 3,
    title: "Oggi",
    description: "Disponibili ora",
    icon: Calendar,
    color: "from-cyan-400 to-cyan-500",
    emoji: "⚡",
    link: "/tour-live"
  },
  {
    id: 4,
    title: "Mappa Tour",
    description: "Vista interattiva",
    icon: Compass,
    color: "from-blue-400 to-blue-500",
    emoji: "🗺️",
    link: "/interactive-map"
  }
];

export default function Home() {
  const [currentExperience, setCurrentExperience] = useState(0);
  const [isAutoplay, setIsAutoplay] = useState(true);

  useEffect(() => {
    if (!isAutoplay) return;
    
    const interval = setInterval(() => {
      setCurrentExperience(prev => (prev + 1) % dynamicExperiences.length);
    }, 4000);

    return () => clearInterval(interval);
  }, [isAutoplay]);
  return (
    <div className="min-h-screen bg-gradient-to-b from-ochre-100 to-ochre-200 font-quicksand">
      <TopBar />
      
      <main className="max-w-md mx-auto px-4 py-8">
        {/* Personalized Welcome & Tours */}
        <PersonalizedWelcome />
        
        {/* Smart Notification System */}
        <SmartNotificationSystem userLocation="Roma" isDeployment={true} />

        {/* Enhanced 3D Main Action Buttons */}
        <div className="mb-8 space-y-6">
          {/* Tour Live - 3D Button */}
          <Link href="/tour-live">
            <motion.div
              className="group relative"
              initial={{ opacity: 0, y: 30, rotateX: 15 }}
              animate={{ opacity: 1, y: 0, rotateX: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              whileHover={{ 
                scale: 1.03, 
                rotateX: -5, 
                rotateY: 5,
                transition: { duration: 0.3 }
              }}
              whileTap={{ scale: 0.97 }}
              style={{ perspective: 1000 }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-terracotta-500 to-terracotta-600 rounded-2xl blur-xl opacity-30 group-hover:opacity-50 transition-opacity duration-300" />
              <motion.button
                className="relative w-full bg-gradient-to-r from-terracotta-400 to-terracotta-500 text-white p-8 rounded-2xl shadow-2xl hover:shadow-3xl transition-all duration-300 flex items-center justify-between overflow-hidden"
                style={{
                  transformStyle: 'preserve-3d',
                  background: 'linear-gradient(135deg, #e55e5e 0%, #c44444 50%, #a33333 100%)',
                  boxShadow: '0 20px 40px rgba(196, 68, 68, 0.3), inset 0 2px 4px rgba(255,255,255,0.1)'
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                
                <div className="flex items-center space-x-6 relative z-10">
                  <motion.div 
                    className="relative w-16 h-16 bg-white/20 rounded-full flex items-center justify-center"
                    animate={{ rotateY: [0, 360] }}
                    transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-white/30 to-white/10 rounded-full" />
                    <Users className="w-8 h-8 text-white relative z-10" />
                    <motion.div
                      className="absolute inset-0 bg-white/20 rounded-full"
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                  </motion.div>
                  
                  <div className="text-left">
                    <h3 className="font-bold text-xl mb-1">Tour Live</h3>
                    <p className="text-terracotta-100 text-sm flex items-center">
                      <Sparkles className="w-4 h-4 mr-1" />
                      Guide locali autentiche
                    </p>
                  </div>
                </div>
                
                <motion.div 
                  className="text-4xl"
                  animate={{ rotateY: [0, 20, 0] }}
                  transition={{ duration: 3, repeat: Infinity }}
                >
                  🔵
                </motion.div>
                
                <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-white/20 to-transparent rounded-full blur-sm" />
              </motion.button>
            </motion.div>
          </Link>

          {/* AI Itinerary - 3D Button */}
          <Link href="/ai-itinerary">
            <motion.div
              className="group relative"
              initial={{ opacity: 0, y: 30, rotateX: 15 }}
              animate={{ opacity: 1, y: 0, rotateX: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              whileHover={{ 
                scale: 1.03, 
                rotateX: -5, 
                rotateY: -5,
                transition: { duration: 0.3 }
              }}
              whileTap={{ scale: 0.97 }}
              style={{ perspective: 1000 }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-olive-500 to-olive-600 rounded-2xl blur-xl opacity-30 group-hover:opacity-50 transition-opacity duration-300" />
              <motion.button
                className="relative w-full bg-gradient-to-r from-olive-400 to-olive-500 text-white p-8 rounded-2xl shadow-2xl hover:shadow-3xl transition-all duration-300 flex items-center justify-between overflow-hidden"
                style={{
                  transformStyle: 'preserve-3d',
                  background: 'linear-gradient(135deg, #84cc16 0%, #65a30d 50%, #4d7c0f 100%)',
                  boxShadow: '0 20px 40px rgba(101, 163, 13, 0.3), inset 0 2px 4px rgba(255,255,255,0.1)'
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                
                <div className="flex items-center space-x-6 relative z-10">
                  <motion.div 
                    className="relative w-16 h-16 bg-white/20 rounded-full flex items-center justify-center"
                    animate={{ rotateX: [0, 360] }}
                    transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-white/30 to-white/10 rounded-full" />
                    <Brain className="w-8 h-8 text-white relative z-10" />
                    <motion.div
                      className="absolute inset-0 bg-white/20 rounded-full"
                      animate={{ scale: [1, 1.3, 1] }}
                      transition={{ duration: 2.5, repeat: Infinity }}
                    />
                  </motion.div>
                  
                  <div className="text-left">
                    <h3 className="font-bold text-xl mb-1">Itinerario AI</h3>
                    <p className="text-olive-100 text-sm flex items-center">
                      <Globe className="w-4 h-4 mr-1" />
                      Percorso personalizzato
                    </p>
                  </div>
                </div>
                
                <motion.div 
                  className="text-4xl"
                  animate={{ rotateZ: [0, 10, -10, 0] }}
                  transition={{ duration: 4, repeat: Infinity }}
                >
                  🟣
                </motion.div>
                
                <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-white/20 to-transparent rounded-full blur-sm" />
              </motion.button>
            </motion.div>
          </Link>

          {/* Quick Path - 3D Button */}
          <Link href="/quick-path">
            <motion.div
              className="group relative"
              initial={{ opacity: 0, y: 30, rotateX: 15 }}
              animate={{ opacity: 1, y: 0, rotateX: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
              whileHover={{ 
                scale: 1.03, 
                rotateX: -5, 
                rotateY: 3,
                transition: { duration: 0.3 }
              }}
              whileTap={{ scale: 0.97 }}
              style={{ perspective: 1000 }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-yellow-500 to-yellow-600 rounded-2xl blur-xl opacity-30 group-hover:opacity-50 transition-opacity duration-300" />
              <motion.button
                className="relative w-full bg-gradient-to-r from-yellow-400 to-yellow-500 text-white p-8 rounded-2xl shadow-2xl hover:shadow-3xl transition-all duration-300 flex items-center justify-between overflow-hidden"
                style={{
                  transformStyle: 'preserve-3d',
                  background: 'linear-gradient(135deg, #facc15 0%, #eab308 50%, #ca8a04 100%)',
                  boxShadow: '0 20px 40px rgba(234, 179, 8, 0.3), inset 0 2px 4px rgba(255,255,255,0.1)'
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                
                <div className="flex items-center space-x-6 relative z-10">
                  <motion.div 
                    className="relative w-16 h-16 bg-white/20 rounded-full flex items-center justify-center"
                    animate={{ rotateZ: [0, 360] }}
                    transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-white/30 to-white/10 rounded-full" />
                    <Zap className="w-8 h-8 text-white relative z-10" />
                    <motion.div
                      className="absolute inset-0 bg-white/20 rounded-full"
                      animate={{ scale: [1, 1.4, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    />
                  </motion.div>
                  
                  <div className="text-left">
                    <h3 className="font-bold text-xl mb-1">Percorso Veloce</h3>
                    <p className="text-yellow-100 text-sm flex items-center">
                      <Compass className="w-4 h-4 mr-1" />
                      Scoperte rapide
                    </p>
                  </div>
                </div>
                
                <motion.div 
                  className="text-4xl"
                  animate={{ 
                    scale: [1, 1.1, 1],
                    rotateY: [0, 15, 0] 
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  🟡
                </motion.div>
                
                <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-white/20 to-transparent rounded-full blur-sm" />
              </motion.button>
            </motion.div>
          </Link>


        </div>

        {/* Dynamic Featured Experience */}
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-800">Esperienze del Momento</h3>
            <motion.button
              onClick={() => setIsAutoplay(!isAutoplay)}
              className={`p-2 rounded-xl transition-colors ${isAutoplay ? 'bg-terracotta-400 text-white' : 'bg-gray-200 text-gray-600'}`}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              {isAutoplay ? '⏸️' : '▶️'}
            </motion.button>
          </div>
          
          <div className="relative h-80 overflow-hidden rounded-3xl">
            <AnimatePresence mode="wait">
              <Link href="/tour-details">
                <motion.div
                  key={currentExperience}
                  className="absolute inset-0"
                  initial={{ opacity: 0, x: 300, rotateY: 45 }}
                  animate={{ opacity: 1, x: 0, rotateY: 0 }}
                  exit={{ opacity: 0, x: -300, rotateY: -45 }}
                  transition={{ duration: 0.8, type: "spring", stiffness: 100 }}
                  style={{ cursor: 'pointer' }}
                  whileHover={{ scale: 1.02 }}
                >
                <div className="relative h-full bg-gradient-to-br from-white/90 to-white/70 backdrop-blur-sm rounded-3xl overflow-hidden shadow-2xl">
                  <img
                    src={dynamicExperiences[currentExperience].image}
                    alt={dynamicExperiences[currentExperience].title}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                  
                  {/* Tag */}
                  <motion.div
                    className={`absolute top-4 left-4 bg-gradient-to-r ${dynamicExperiences[currentExperience].tagColor} text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg`}
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ duration: 0.6, delay: 0.3 }}
                  >
                    {dynamicExperiences[currentExperience].tag}
                  </motion.div>
                  
                  {/* Emoji Animation */}
                  <motion.div
                    className="absolute top-4 right-4 text-4xl"
                    initial={{ scale: 0, rotate: 180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ duration: 0.8, delay: 0.4, type: "spring" }}
                    whileHover={{ scale: 1.2, rotate: 15 }}
                  >
                    {dynamicExperiences[currentExperience].emoji}
                  </motion.div>
                  
                  {/* Content */}
                  <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                    <motion.div
                      initial={{ y: 30, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ duration: 0.6, delay: 0.5 }}
                    >
                      <h4 className="text-2xl font-bold mb-2">{dynamicExperiences[currentExperience].title}</h4>
                      
                      <div className="flex items-center space-x-4 mb-4">
                        <div className="flex items-center">
                          <MapPin className="w-4 h-4 mr-1" />
                          <span className="text-sm">{dynamicExperiences[currentExperience].location}</span>
                        </div>
                        <div className="flex items-center">
                          <Clock className="w-4 h-4 mr-1" />
                          <span className="text-sm">{dynamicExperiences[currentExperience].duration}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="flex items-center">
                            <Star className="w-4 h-4 text-yellow-400 fill-current mr-1" />
                            <span className="font-medium">{dynamicExperiences[currentExperience].rating}</span>
                            <span className="text-xs opacity-75 ml-1">({dynamicExperiences[currentExperience].reviews})</span>
                          </div>
                        </div>
                        
                        <div className="text-2xl font-bold">
                          {dynamicExperiences[currentExperience].price}€
                        </div>
                      </div>
                    </motion.div>
                  </div>
                </div>
                </motion.div>
              </Link>
            </AnimatePresence>
            
            {/* Progress Indicators */}
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2">
              {dynamicExperiences.map((_, index) => (
                <motion.button
                  key={index}
                  onClick={() => {
                    setCurrentExperience(index);
                    setIsAutoplay(false);
                  }}
                  className={`w-3 h-3 rounded-full transition-all duration-300 ${
                    index === currentExperience ? 'bg-white scale-125' : 'bg-white/50'
                  }`}
                  whileHover={{ scale: 1.3 }}
                  whileTap={{ scale: 0.9 }}
                />
              ))}
            </div>
          </div>
        </motion.div>

        {/* Quick Actions Grid */}
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1 }}
        >
          <h3 className="text-lg font-bold text-gray-800 mb-4">Azioni Rapide</h3>
          <div className="grid grid-cols-2 gap-4">
            {quickActions.map((action, index) => (
              <Link key={action.id} href={action.link}>
                <motion.div
                  className="group relative overflow-hidden"
                  initial={{ opacity: 0, scale: 0.8, rotateY: -45 }}
                  animate={{ opacity: 1, scale: 1, rotateY: 0 }}
                  transition={{ duration: 0.6, delay: 1.2 + index * 0.1 }}
                  whileHover={{ scale: 1.05, rotateY: 5 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <div className={`bg-gradient-to-br ${action.color} text-white p-6 rounded-2xl shadow-lg relative overflow-hidden`}>
                    <div className="absolute top-0 right-0 w-16 h-16 bg-white/10 rounded-full -translate-y-2 translate-x-2" />
                    
                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-3">
                        <motion.div
                          className="text-3xl"
                          whileHover={{ scale: 1.2, rotate: 15 }}
                          transition={{ type: "spring", stiffness: 300 }}
                        >
                          {action.emoji}
                        </motion.div>
                        <action.icon className="w-6 h-6 opacity-60" />
                      </div>
                      
                      <h4 className="font-bold text-lg mb-1">{action.title}</h4>
                      <p className="text-sm opacity-90">{action.description}</p>
                    </div>
                    
                    <motion.div
                      className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      initial={{ x: 10 }}
                      whileHover={{ x: 0 }}
                    >
                      <ArrowRight className="w-5 h-5" />
                    </motion.div>
                  </div>
                </motion.div>
              </Link>
            ))}
          </div>
        </motion.div>


      </main>

      <PromotionalBanner />
      <BottomNavigation />
    </div>
  );
}
