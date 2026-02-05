import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { MapPin, Star, Clock, Users, Shuffle, ArrowLeft, Sparkles, Gift, Dice1, Zap, Calendar, Heart, ArrowRight, Timer } from "lucide-react";
import { Link } from "wouter";
import TopBar from "@/components/TopBar";
import BottomNavigation from "@/components/BottomNavigation";

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
    category: "Gastronomia"
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
    category: "Arte"
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
    category: "Natura"
  }
];

const surpriseTypes = [
  {
    id: 1,
    title: "Tour Gastronomico",
    icon: Gift,
    color: "from-red-400 to-red-500",
    emoji: "🍕",
    count: 8
  },
  {
    id: 2,
    title: "Avventura Culturale",
    icon: Sparkles,
    color: "from-purple-400 to-purple-500",
    emoji: "🏛️",
    count: 6
  },
  {
    id: 3,
    title: "Esperienza Naturale",
    icon: MapPin,
    color: "from-green-400 to-green-500",
    emoji: "🌿",
    count: 10
  },
  {
    id: 4,
    title: "Sorpresa Totale",
    icon: Dice1,
    color: "from-orange-400 to-orange-500",
    emoji: "🎲",
    count: 15
  }
];

export default function SurpriseTourPage() {
  const [selectedSurprise, setSelectedSurprise] = useState<any>(null);
  const [isShuffling, setIsShuffling] = useState(false);

  const shuffleExperience = () => {
    setIsShuffling(true);
    setTimeout(() => {
      const randomExperience = surpriseExperiences[Math.floor(Math.random() * surpriseExperiences.length)];
      setSelectedSurprise(randomExperience);
      setIsShuffling(false);
    }, 1500);
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
          <Link href="/">
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
              <motion.div
                className="text-lg"
                whileHover={{ rotate: 15, scale: 1.1 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                🏠
              </motion.div>
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
          <p className="text-gray-600">Lasciati guidare dall'avventura e scopri l'inaspettato</p>
        </motion.div>

        {/* Shuffle Button */}
        <motion.div 
          className="mb-8"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <motion.button
            onClick={shuffleExperience}
            disabled={isShuffling}
            className={`w-full bg-gradient-to-r from-orange-400 to-orange-500 text-white py-6 px-8 rounded-3xl font-bold shadow-xl hover:shadow-2xl transition-all flex items-center justify-center space-x-3 ${
              isShuffling ? 'opacity-75 cursor-not-allowed' : ''
            }`}
            whileHover={!isShuffling ? { scale: 1.02, rotateX: 5 } : {}}
            whileTap={!isShuffling ? { scale: 0.98 } : {}}
          >
            <motion.div
              animate={isShuffling ? { rotate: 360 } : {}}
              transition={isShuffling ? { duration: 0.5, repeat: Infinity, ease: "linear" } : {}}
            >
              <Shuffle className="w-6 h-6" />
            </motion.div>
            <span className="text-xl">
              {isShuffling ? "Creando la tua sorpresa..." : "Sorprendimi!"}
            </span>
            <motion.div
              className="text-2xl"
              whileHover={{ scale: 1.3, rotate: 15 }}
            >
              🎲
            </motion.div>
          </motion.button>
        </motion.div>

        {/* Selected Surprise Experience */}
        <AnimatePresence>
          {selectedSurprise && (
            <motion.div
              key={selectedSurprise.id}
              className="bg-white/80 backdrop-blur-sm rounded-3xl p-6 shadow-xl mb-8 relative overflow-hidden"
              initial={{ opacity: 0, y: 50, rotateX: 30 }}
              animate={{ opacity: 1, y: 0, rotateX: 0 }}
              exit={{ opacity: 0, y: -50, rotateX: -30 }}
              transition={{ duration: 0.8, type: "spring" }}
              style={{ perspective: 1000 }}
            >
              {/* Decorative elements */}
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-orange-200/50 to-transparent rounded-full -translate-y-6 translate-x-6" />
              <div className="absolute bottom-0 left-0 w-16 h-16 bg-gradient-to-tr from-orange-300/30 to-transparent rounded-full translate-y-4 -translate-x-4" />
              
              <div className="relative z-10">
                <motion.div
                  className="text-center mb-6"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  <motion.div
                    className="text-6xl mb-3"
                    whileHover={{ scale: 1.2, rotate: 15 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    {selectedSurprise.surprise}
                  </motion.div>
                  <h3 className="text-2xl font-bold text-gray-800 mb-2">{selectedSurprise.title}</h3>
                  <p className="text-gray-600 text-sm">{selectedSurprise.description}</p>
                </motion.div>

                <motion.img
                  src={selectedSurprise.image}
                  alt={selectedSurprise.title}
                  className="w-full h-48 rounded-2xl object-cover mb-6 shadow-lg"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4 }}
                  whileHover={{ scale: 1.03, rotateY: 5 }}
                />

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <motion.div
                    className="bg-gradient-to-r from-orange-100 to-orange-200 p-4 rounded-2xl text-center"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 }}
                  >
                    <MapPin className="w-6 h-6 text-orange-600 mx-auto mb-2" />
                    <p className="text-sm font-medium text-gray-800">{selectedSurprise.location}</p>
                  </motion.div>
                  
                  <motion.div
                    className="bg-gradient-to-r from-orange-100 to-orange-200 p-4 rounded-2xl text-center"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.6 }}
                  >
                    <Clock className="w-6 h-6 text-orange-600 mx-auto mb-2" />
                    <p className="text-sm font-medium text-gray-800">{selectedSurprise.duration}</p>
                  </motion.div>
                </div>

                <div className="flex space-x-3">
                  <Link href="/tour-live" className="flex-1">
                    <motion.button
                      className="w-full bg-gradient-to-r from-green-400 to-green-500 text-white py-4 px-6 rounded-2xl font-bold hover:from-green-500 hover:to-green-600 transition-all shadow-lg flex items-center justify-center space-x-2"
                      whileHover={{ scale: 1.02, boxShadow: "0 8px 25px rgba(0,0,0,0.15)" }}
                      whileTap={{ scale: 0.98 }}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.7 }}
                    >
                      <Zap className="w-5 h-5" />
                      <span>Inizia l'Avventura</span>
                    </motion.button>
                  </Link>
                  
                  <Link href="/tour-details">
                    <motion.button
                      className="bg-white text-orange-500 border-2 border-orange-400 py-4 px-6 rounded-2xl font-bold hover:bg-orange-50 transition-all shadow-lg flex items-center justify-center"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.8 }}
                    >
                      <Timer className="w-5 h-5" />
                    </motion.button>
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
          <h2 className="text-xl font-bold text-gray-800 mb-4">Tipi di Sorprese</h2>
          <div className="grid grid-cols-2 gap-3">
            {surpriseTypes.map((type, index) => (
              <motion.div
                key={type.id}
                className="group relative overflow-hidden"
                initial={{ opacity: 0, scale: 0.8, rotateY: -30 }}
                animate={{ opacity: 1, scale: 1, rotateY: 0 }}
                transition={{ duration: 0.6, delay: 0.4 + index * 0.1 }}
                whileHover={{ scale: 1.05, rotateY: 5 }}
                whileTap={{ scale: 0.95 }}
              >
                <div className={`bg-gradient-to-br ${type.color} text-white p-4 rounded-2xl shadow-lg relative overflow-hidden cursor-pointer`}>
                  <div className="absolute top-0 right-0 w-12 h-12 bg-white/10 rounded-full -translate-y-1 translate-x-1" />
                  
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-2">
                      <motion.div
                        className="text-2xl"
                        whileHover={{ scale: 1.2, rotate: 15 }}
                        transition={{ type: "spring", stiffness: 300 }}
                      >
                        {type.emoji}
                      </motion.div>
                      <div className="bg-white/20 rounded-full px-2 py-1">
                        <span className="text-xs font-bold">{type.count}</span>
                      </div>
                    </div>
                    
                    <h4 className="font-bold text-sm mb-1">{type.title}</h4>
                    <type.icon className="w-4 h-4 opacity-60" />
                  </div>
                  
                  <motion.div
                    className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    initial={{ x: 10 }}
                    whileHover={{ x: 0 }}
                  >
                    <ArrowRight className="w-4 h-4" />
                  </motion.div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* All Surprise Experiences */}
        <motion.div 
          className="space-y-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
        >
          <h2 className="text-xl font-bold text-gray-800 mb-4">Tutte le Sorprese</h2>
          {surpriseExperiences.map((experience, index) => (
            <motion.div
              key={experience.id}
              className="group bg-white/70 backdrop-blur-sm rounded-2xl p-4 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden relative"
              initial={{ opacity: 0, y: 30, rotateX: 15 }}
              animate={{ opacity: 1, y: 0, rotateX: 0 }}
              transition={{ duration: 0.6, delay: 0.6 + index * 0.1 }}
              whileHover={{ scale: 1.02, rotateX: -2 }}
              style={{ perspective: 1000 }}
            >
              <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-orange-200/30 to-transparent rounded-full -translate-y-4 translate-x-4" />
              
              <div className="flex space-x-4 relative z-10">
                <div className="relative">
                  <img
                    src={experience.image}
                    alt={experience.title}
                    className="w-20 h-20 rounded-xl object-cover shadow-md group-hover:shadow-lg transition-shadow"
                  />
                  <motion.div
                    className="absolute -top-2 -right-2 w-8 h-8 bg-gradient-to-r from-orange-400 to-orange-500 rounded-full flex items-center justify-center shadow-lg text-white text-lg"
                    whileHover={{ scale: 1.2, rotate: 15 }}
                  >
                    {experience.surprise}
                  </motion.div>
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <motion.span 
                      className="text-xs font-medium text-orange-500 bg-orange-100 px-2 py-1 rounded-full"
                      whileHover={{ scale: 1.05 }}
                    >
                      {experience.category}
                    </motion.span>
                    <motion.span 
                      className="text-lg font-bold text-orange-600"
                      whileHover={{ scale: 1.1 }}
                    >
                      €{experience.price}
                    </motion.span>
                  </div>
                  
                  <h3 className="font-semibold text-gray-800 mb-1 text-sm group-hover:text-orange-600 transition-colors">
                    {experience.title}
                  </h3>
                  
                  <p className="text-xs text-gray-600 mb-2 flex items-center">
                    <MapPin className="w-3 h-3 mr-1 text-orange-400" />
                    {experience.location}
                  </p>
                  
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                    <div className="flex items-center space-x-3">
                      <span className="flex items-center">
                        <Clock className="w-3 h-3 mr-1" />
                        {experience.duration}
                      </span>
                      <span className="flex items-center">
                        <Users className="w-3 h-3 mr-1" />
                        {experience.participants}
                      </span>
                    </div>
                    <div className="flex items-center">
                      <Star className="w-3 h-3 mr-1 text-yellow-400 fill-current" />
                      <span>{experience.rating}</span>
                    </div>
                  </div>
                  
                  <div className="flex space-x-2">
                    <Link href="/tour-details" className="flex-1">
                      <motion.button
                        className="w-full bg-orange-400 text-white py-2 px-3 rounded-xl text-xs font-medium hover:bg-orange-500 transition-colors flex items-center justify-center space-x-1"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <span>Scopri</span>
                      </motion.button>
                    </Link>
                    
                    <Link href="/tour-live">
                      <motion.button
                        className="bg-green-400 text-white py-2 px-3 rounded-xl text-xs font-medium hover:bg-green-500 transition-colors flex items-center justify-center"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <ArrowRight className="w-3 h-3" />
                      </motion.button>
                    </Link>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </main>
      
      <BottomNavigation />
    </div>
  );
}