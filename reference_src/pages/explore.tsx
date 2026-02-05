import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { MapPin, Star, Clock, Users, Search, Calendar, Map, X, Eye, Filter, Heart, ArrowRight, Globe, TrendingUp, Sparkles, ArrowLeft, Home } from "lucide-react";
import { Link } from "wouter";
import TopBar from "@/components/TopBar";
import BottomNavigation from "@/components/BottomNavigation";
import InteractiveTourMap from "@/components/InteractiveTourMap";

const sampleExperiences = [
  {
    id: 1,
    title: "Tour delle Cantine Chiantigiane",
    location: "Siena, Toscana",
    duration: "4 ore",
    rating: 4.8,
    participants: 12,
    price: 85,
    image: "https://images.unsplash.com/photo-1558618666-fbd26c85cd64?w=300&h=200&fit=crop",
    category: "Vino e Gastronomia"
  },
  {
    id: 2,
    title: "Passeggiata nei Borghi Medievali",
    location: "Montepulciano, Toscana",
    duration: "3 ore",
    rating: 4.9,
    participants: 8,
    price: 45,
    image: "https://images.unsplash.com/photo-1520637836862-4d197d17c50a?w=300&h=200&fit=crop",
    category: "Storia e Cultura"
  },
  {
    id: 3,
    title: "Lezione di Cucina Tradizionale",
    location: "Firenze, Toscana",
    duration: "5 ore",
    rating: 4.7,
    participants: 15,
    price: 120,
    image: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=300&h=200&fit=crop",
    category: "Cucina Locale"
  },
  {
    id: 4,
    title: "Trekking nelle Cinque Terre",
    location: "La Spezia, Liguria",
    duration: "6 ore",
    rating: 4.6,
    participants: 20,
    price: 75,
    image: "https://images.unsplash.com/photo-1516483638261-f4dbaf036963?w=300&h=200&fit=crop",
    category: "Natura e Avventura"
  },
  {
    id: 5,
    title: "Visita Guidata ai Musei Vaticani",
    location: "Roma, Lazio",
    duration: "3 ore",
    rating: 4.5,
    participants: 25,
    price: 65,
    image: "https://images.unsplash.com/photo-1529260830199-42c24126f198?w=300&h=200&fit=crop",
    category: "Arte e Cultura"
  },
  {
    id: 6,
    title: "Giro in Gondola al Tramonto",
    location: "Venezia, Veneto",
    duration: "1 ora",
    rating: 4.9,
    participants: 2,
    price: 150,
    image: "https://images.unsplash.com/photo-1514890547357-a9ee288728e0?w=300&h=200&fit=crop",
    category: "Romantico"
  }
];

// Map locations with corresponding experiences
const mapLocations = [
  { 
    id: 1, 
    name: "Firenze", 
    x: 45, 
    y: 35, 
    experiences: [3], 
    region: "Toscana",
    description: "Culla del Rinascimento"
  },
  { 
    id: 2, 
    name: "Siena", 
    x: 42, 
    y: 42, 
    experiences: [1], 
    region: "Toscana",
    description: "Città del Palio"
  },
  { 
    id: 3, 
    name: "Roma", 
    x: 48, 
    y: 65, 
    experiences: [5], 
    region: "Lazio",
    description: "Città Eterna"
  },
  { 
    id: 4, 
    name: "Venezia", 
    x: 52, 
    y: 25, 
    experiences: [6], 
    region: "Veneto",
    description: "Città sull'acqua"
  },
  { 
    id: 5, 
    name: "Cinque Terre", 
    x: 35, 
    y: 30, 
    experiences: [4], 
    region: "Liguria",
    description: "Borghi sul mare"
  },
  { 
    id: 6, 
    name: "Montepulciano", 
    x: 46, 
    y: 45, 
    experiences: [2], 
    region: "Toscana",
    description: "Borgo medievale"
  }
];

const trendingCategories = [
  {
    id: 1,
    name: "Trending Ora",
    icon: TrendingUp,
    color: "from-red-400 to-red-500",
    emoji: "🔥",
    count: 12
  },
  {
    id: 2,
    name: "Esperienze Premium",
    icon: Sparkles,
    color: "from-purple-400 to-purple-500",
    emoji: "✨",
    count: 8
  },
  {
    id: 3,
    name: "Vicino a Te",
    icon: MapPin,
    color: "from-green-400 to-green-500",
    emoji: "📍",
    count: 15
  },
  {
    id: 4,
    name: "Esperienze Autentiche",
    icon: Globe,
    color: "from-blue-400 to-blue-500",
    emoji: "🌍",
    count: 20
  }
];

export default function ExplorePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [activeFilter, setActiveFilter] = useState(0);
  const [showMap, setShowMap] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<any>(null);
  const [hoveredLocation, setHoveredLocation] = useState<any>(null);
  const [favoriteItems, setFavoriteItems] = useState(new Set());

  const toggleFavorite = (id: number) => {
    const newFavorites = new Set(favoriteItems);
    if (newFavorites.has(id)) {
      newFavorites.delete(id);
    } else {
      newFavorites.add(id);
    }
    setFavoriteItems(newFavorites);
  };

  const getExperiencesByLocation = (locationId: number) => {
    const location = mapLocations.find(loc => loc.id === locationId);
    if (!location) return [];
    return sampleExperiences.filter(exp => location.experiences.includes(exp.id));
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-ochre-100 to-ochre-200 font-quicksand">
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
              className="flex items-center space-x-2 bg-white/80 backdrop-blur-sm text-terracotta-600 px-4 py-2 rounded-2xl shadow-lg hover:shadow-xl transition-all group"
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
          className="text-center mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Esplora il meglio nei dintorni</h1>
          <p className="text-gray-600">Scopri esperienze autentiche selezionate per te</p>
        </motion.div>

        {/* Search Bar */}
        <motion.div 
          className="mb-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Cerca esperienze..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white/70 backdrop-blur-sm rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-terracotta-400 focus:border-transparent transition-all"
            />
          </div>
        </motion.div>

        {/* Date Filter */}
        <motion.div 
          className="mb-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
        >
          <label className="block text-sm font-medium text-gray-700 mb-2">Filtra per data</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white/70 backdrop-blur-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-terracotta-400 focus:border-transparent transition-all text-sm"
            />
          </div>
        </motion.div>

        {/* Trending Categories */}
        <motion.div 
          className="mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <h3 className="text-lg font-bold text-gray-800 mb-4">Categorie Popolari</h3>
          <div className="grid grid-cols-2 gap-3">
            {trendingCategories.map((category, index) => (
              <Link key={category.id} href="/tour-details">
                <motion.div
                  className="group relative overflow-hidden"
                  initial={{ opacity: 0, scale: 0.8, rotateY: -30 }}
                  animate={{ opacity: 1, scale: 1, rotateY: 0 }}
                  transition={{ duration: 0.6, delay: 0.3 + index * 0.1 }}
                  whileHover={{ scale: 1.05, rotateY: 5 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <div className={`bg-gradient-to-br ${category.color} text-white p-4 rounded-2xl shadow-lg relative overflow-hidden`}>
                    <div className="absolute top-0 right-0 w-12 h-12 bg-white/10 rounded-full -translate-y-1 translate-x-1" />
                    
                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-2">
                        <motion.div
                          className="text-2xl"
                          whileHover={{ scale: 1.2, rotate: 15 }}
                          transition={{ type: "spring", stiffness: 300 }}
                        >
                          {category.emoji}
                        </motion.div>
                        <div className="bg-white/20 rounded-full px-2 py-1">
                          <span className="text-xs font-bold">{category.count}</span>
                        </div>
                      </div>
                      
                      <h4 className="font-bold text-sm mb-1">{category.name}</h4>
                      <category.icon className="w-4 h-4 opacity-60" />
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
              </Link>
            ))}
          </div>
        </motion.div>

        {/* Filter Pills */}
        <motion.div 
          className="mb-6"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.7 }}
        >
          <div className="flex space-x-2 overflow-x-auto pb-2 scrollbar-hide">
            {["Tutti", "Gastronomia", "Cultura", "Natura", "Arte"].map((filter, index) => (
              <motion.button
                key={filter}
                onClick={() => setActiveFilter(index)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
                  index === activeFilter 
                    ? 'bg-terracotta-400 text-white' 
                    : 'bg-white/60 text-gray-700 hover:bg-terracotta-200'
                }`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {filter}
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* Experiences Grid */}
        <div className="space-y-4">
          {sampleExperiences.map((experience, index) => (
            <motion.div
              key={experience.id}
              className="group bg-white/70 backdrop-blur-sm rounded-2xl p-4 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden relative"
              initial={{ opacity: 0, y: 30, rotateX: 15 }}
              animate={{ opacity: 1, y: 0, rotateX: 0 }}
              transition={{ duration: 0.6, delay: 0.8 + index * 0.1 }}
              whileHover={{ scale: 1.02, rotateX: -2 }}
              style={{ perspective: 1000 }}
            >
              <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-terracotta-200/30 to-transparent rounded-full -translate-y-4 translate-x-4" />
              
              <div className="flex space-x-4 relative z-10">
                <div className="relative">
                  <img
                    src={experience.image}
                    alt={experience.title}
                    className="w-20 h-20 rounded-xl object-cover shadow-md group-hover:shadow-lg transition-shadow"
                  />
                  <motion.button
                    onClick={() => toggleFavorite(experience.id)}
                    className={`absolute -top-2 -right-2 w-8 h-8 rounded-full flex items-center justify-center shadow-lg transition-colors ${
                      favoriteItems.has(experience.id) ? 'bg-red-400 text-white' : 'bg-white text-gray-400'
                    }`}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <Heart className={`w-4 h-4 ${favoriteItems.has(experience.id) ? 'fill-current' : ''}`} />
                  </motion.button>
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <motion.span 
                      className="text-xs font-medium text-terracotta-500 bg-terracotta-100 px-2 py-1 rounded-full"
                      whileHover={{ scale: 1.05 }}
                    >
                      {experience.category}
                    </motion.span>
                    <motion.span 
                      className="text-lg font-bold text-terracotta-600"
                      whileHover={{ scale: 1.1 }}
                    >
                      €{experience.price}
                    </motion.span>
                  </div>
                  
                  <h3 className="font-semibold text-gray-800 mb-1 text-sm group-hover:text-terracotta-600 transition-colors">
                    {experience.title}
                  </h3>
                  
                  <p className="text-xs text-gray-600 mb-2 flex items-center">
                    <MapPin className="w-3 h-3 mr-1 text-terracotta-400" />
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
                      <Star className="w-3 h-3 mr-1 text-ochre-400 fill-current" />
                      <span>{experience.rating}</span>
                    </div>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex space-x-2">
                    <Link href="/tour-details" className="flex-1">
                      <motion.button
                        className="w-full bg-terracotta-400 text-white py-2 px-3 rounded-xl text-xs font-medium hover:bg-terracotta-500 transition-colors flex items-center justify-center space-x-1"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <Eye className="w-3 h-3" />
                        <span>Dettagli</span>
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
              
              <motion.div
                className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-terracotta-400 to-terracotta-500 opacity-0 group-hover:opacity-100 transition-opacity"
                initial={{ scaleX: 0 }}
                whileHover={{ scaleX: 1 }}
                transition={{ duration: 0.3 }}
              />
            </motion.div>
          ))}
        </div>

        {/* Load More Button */}
        <motion.div
          className="text-center mt-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.8 }}
        >
          <button className="bg-terracotta-400 text-white px-6 py-3 rounded-full font-medium hover:bg-terracotta-500 transition-colors">
            Carica altre esperienze
          </button>
        </motion.div>

        {/* Map Section */}
        <motion.div
          className="mt-8 bg-white/70 backdrop-blur-sm rounded-2xl p-6 shadow-lg"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.9 }}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <Map className="w-5 h-5 text-terracotta-400 mr-2" />
              <h3 className="text-lg font-bold text-gray-800">Mappa dei tour</h3>
            </div>
            <Link href="/interactive-map">
              <motion.button
                className="bg-terracotta-400 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-terracotta-500 transition-colors flex items-center space-x-2"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <span>Mappa Completa</span>
                <ArrowRight className="w-4 h-4" />
              </motion.button>
            </Link>
          </div>
          
          <div className="rounded-xl overflow-hidden h-96">
            <InteractiveTourMap />
          </div>
        </motion.div>

        {/* Selected Location Details */}
        {selectedLocation && (
          <motion.div
            className="mt-6 bg-white/70 backdrop-blur-sm rounded-2xl p-6 shadow-lg"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <MapPin className="w-5 h-5 text-terracotta-400 mr-2" />
                <h3 className="text-lg font-bold text-gray-800">{selectedLocation.name}</h3>
              </div>
              <button
                onClick={() => setSelectedLocation(null)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            
            <div className="mb-4">
              <p className="text-sm text-gray-600">{selectedLocation.region}</p>
              <p className="text-sm text-gray-500 mt-1">{selectedLocation.description}</p>
            </div>

            <div className="space-y-4">
              <h4 className="font-semibold text-gray-800">Esperienze disponibili</h4>
              {getExperiencesByLocation(selectedLocation.id).map((experience) => (
                <div key={experience.id} className="flex items-center space-x-3 p-3 bg-white/50 rounded-xl">
                  <img
                    src={experience.image}
                    alt={experience.title}
                    className="w-12 h-12 rounded-lg object-cover"
                  />
                  <div className="flex-1">
                    <h5 className="font-medium text-gray-800 text-sm">{experience.title}</h5>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-gray-500">{experience.duration}</span>
                      <span className="text-sm font-bold text-terracotta-600">€{experience.price}</span>
                    </div>
                  </div>
                  <button className="bg-terracotta-400 text-white px-3 py-1 rounded-lg text-xs font-medium hover:bg-terracotta-500 transition-colors">
                    <Eye className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </main>

      <BottomNavigation />
    </div>
  );
}