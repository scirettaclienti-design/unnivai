import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { User, Mail, MapPin, Heart, Star, Edit, ArrowLeft, Home, Share2, Facebook, Twitter, Instagram, Link as LinkIcon, Eye, ChevronRight, Award, Target, Users, Compass, Search, Map, Clock } from "lucide-react";
import { Link } from "wouter";
import TopBar from "@/components/TopBar";
import BottomNavigation from "@/components/BottomNavigation";

const tourHistory = [
  {
    id: 1,
    title: "Tour delle Cantine Chiantigiane",
    location: "Siena, Toscana",
    date: "15 Gen 2024",
    rating: 5,
    image: "https://images.unsplash.com/photo-1558618666-fbd26c85cd64?w=300&h=200&fit=crop",
    duration: "4 ore",
    guide: "Lorenzo Bianchi",
    highlights: ["Degustazione di 6 vini", "Pranzo tipico toscano", "Visita alle cantine storiche"],
    description: "Un'esperienza indimenticabile tra le colline del Chianti, con degustazioni di vini pregiati e una cena tradizionale immersa nei vigneti secolari.",
    photos: [
      "https://images.unsplash.com/photo-1558618666-fbd26c85cd64?w=400&h=300&fit=crop",
      "https://images.unsplash.com/photo-1574471405792-4fa96b2e8c4e?w=400&h=300&fit=crop",
      "https://images.unsplash.com/photo-1590736969955-71cc94901144?w=400&h=300&fit=crop",
      "https://images.unsplash.com/photo-1596142332937-5d4ac6b8a2a6?w=400&h=300&fit=crop",
      "https://images.unsplash.com/photo-1571997478779-2adcbbe9ab2f?w=400&h=300&fit=crop"
    ]
  },
  {
    id: 2,
    title: "Passeggiata nei Borghi Medievali",
    location: "Montepulciano",
    date: "8 Gen 2024",
    rating: 4,
    image: "https://images.unsplash.com/photo-1520637836862-4d197d17c50a?w=300&h=200&fit=crop",
    duration: "3 ore",
    guide: "Giulia Rossi",
    highlights: ["Palazzo Comunale", "Chiesa di San Biagio", "Degustazione Vino Nobile"],
    description: "Camminata tra le vie medievali di uno dei borghi più belli d'Italia, con soste per scoprire l'arte e la storia locale.",
    photos: [
      "https://images.unsplash.com/photo-1520637836862-4d197d17c50a?w=400&h=300&fit=crop",
      "https://images.unsplash.com/photo-1527598515782-6b5c98480c38?w=400&h=300&fit=crop",
      "https://images.unsplash.com/photo-1539650116574-75c0c6d73f6e?w=400&h=300&fit=crop",
      "https://images.unsplash.com/photo-1582650625119-3a31f8fa2699?w=400&h=300&fit=crop"
    ]
  },
  {
    id: 3,
    title: "Lezione di Cucina Tradizionale",
    location: "Firenze",
    date: "22 Dic 2023",
    rating: 5,
    image: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=300&h=200&fit=crop",
    duration: "5 ore",
    guide: "Nonna Maria",
    highlights: ["Pasta fatta a mano", "Ragù della nonna", "Tiramisù originale"],
    description: "Una mattina in cucina con una vera nonna fiorentina per imparare i segreti della cucina toscana autentica.",
    photos: [
      "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=300&fit=crop",
      "https://images.unsplash.com/photo-1551218876-fd59d80e0dd8?w=400&h=300&fit=crop",
      "https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=400&h=300&fit=crop",
      "https://images.unsplash.com/photo-1574471405792-4fa96b2e8c4e?w=400&h=300&fit=crop",
      "https://images.unsplash.com/photo-1571997478779-2adcbbe9ab2f?w=400&h=300&fit=crop",
      "https://images.unsplash.com/photo-1590736969955-71cc94901144?w=400&h=300&fit=crop"
    ]
  }
];

export default function ProfilePage() {
  const [editName, setEditName] = useState("Marco Rossi");
  const [selectedTour, setSelectedTour] = useState<typeof tourHistory[0] | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [showExploreZones, setShowExploreZones] = useState(false);

  const shareTour = (platform: string, tour: typeof tourHistory[0]) => {
    const message = `Ho appena completato un fantastico tour: "${tour.title}" a ${tour.location}! 🌟 Rating: ${tour.rating}/5 ⭐`;
    const url = window.location.href;
    
    switch(platform) {
      case 'facebook':
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(message)}`, '_blank');
        break;
      case 'twitter':
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}&url=${encodeURIComponent(url)}`, '_blank');
        break;
      case 'instagram':
        navigator.clipboard.writeText(message);
        alert('Messaggio copiato! Incollalo su Instagram Stories');
        break;
      case 'copy':
        navigator.clipboard.writeText(`${message} ${url}`);
        alert('Link copiato negli appunti!');
        break;
    }
    setShowShareModal(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-ochre-100 to-ochre-200 font-quicksand">
      <TopBar />
      
      <main className="max-w-md mx-auto px-4 py-8 pb-24">
        {/* Back to Home */}
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

        {/* Profile Header - Simplified */}
        <motion.div 
          className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 shadow-lg mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <div className="flex items-center space-x-4 mb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-terracotta-300 to-terracotta-400 rounded-full flex items-center justify-center">
              <User className="text-white w-8 h-8" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-800">{editName}</h2>
              <p className="text-gray-600 flex items-center text-sm">
                <Mail className="w-3 h-3 mr-1 text-terracotta-400" />
                marco.rossi@email.it
              </p>
              <p className="text-gray-600 flex items-center text-sm">
                <MapPin className="w-3 h-3 mr-1 text-terracotta-400" />
                Roma, Italia
              </p>
            </div>
          </div>
          
          {/* Simplified Stats */}
          <div className="flex justify-around pt-4 border-t border-gray-200">
            <div className="text-center">
              <div className="text-lg font-bold text-terracotta-600">12</div>
              <div className="text-xs text-gray-600">Tour</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-terracotta-600">8</div>
              <div className="text-xs text-gray-600">Guide</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-terracotta-600">4.8</div>
              <div className="text-xs text-gray-600">Rating</div>
            </div>
          </div>
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          className="mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <h3 className="text-lg font-bold text-gray-800 mb-4">Azioni Rapide</h3>
          <div className="grid grid-cols-2 gap-3">
            <motion.button
              onClick={() => setShowResults(!showResults)}
              className="bg-gradient-to-br from-yellow-400 to-yellow-500 text-white p-4 rounded-2xl shadow-lg relative overflow-hidden"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl">🏆</span>
                <Award className="w-5 h-5 opacity-60" />
              </div>
              <h4 className="font-bold text-sm">I Miei Risultati</h4>
            </motion.button>

            <motion.button
              onClick={() => setShowExploreZones(!showExploreZones)}
              className="bg-gradient-to-br from-green-400 to-green-500 text-white p-4 rounded-2xl shadow-lg relative overflow-hidden"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl">🗺️</span>
                <Map className="w-5 h-5 opacity-60" />
              </div>
              <h4 className="font-bold text-sm">Esplora Zone</h4>
            </motion.button>
          </div>
        </motion.div>

        {/* Results Section */}
        <AnimatePresence>
          {showResults && (
            <motion.div
              className="mb-6 bg-white/70 backdrop-blur-sm rounded-2xl p-6 shadow-lg"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
            >
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                <Award className="w-5 h-5 mr-2 text-yellow-500" />
                I Miei Risultati
              </h3>
              
              <div className="space-y-4">
                <div className="bg-gradient-to-r from-yellow-50 to-orange-50 p-4 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-gray-800">Esploratore Veterano</h4>
                      <p className="text-sm text-gray-600">Completati 10+ tour</p>
                    </div>
                    <div className="text-3xl">🏅</div>
                  </div>
                </div>
                
                <div className="bg-gradient-to-r from-blue-50 to-cyan-50 p-4 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-gray-800">Amante della Cultura</h4>
                      <p className="text-sm text-gray-600">5+ tour culturali</p>
                    </div>
                    <div className="text-3xl">🎭</div>
                  </div>
                </div>
                
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-gray-800">Guida Esperta</h4>
                      <p className="text-sm text-gray-600">Rating medio 4.8/5</p>
                    </div>
                    <div className="text-3xl">⭐</div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Explore Zones Section */}
        <AnimatePresence>
          {showExploreZones && (
            <motion.div
              className="mb-6 bg-white/70 backdrop-blur-sm rounded-2xl p-6 shadow-lg"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
            >
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                <Map className="w-5 h-5 mr-2 text-green-500" />
                Esplora Zone
              </h3>
              
              <div className="space-y-3">
                {[
                  { name: "Toscana", tours: 8, image: "https://images.unsplash.com/photo-1539650116574-75c0c6d73f6e?w=100&h=100&fit=crop", emoji: "🍷" },
                  { name: "Sicilia", tours: 5, image: "https://images.unsplash.com/photo-1580500722723-e2dc6e1b7bb8?w=100&h=100&fit=crop", emoji: "🌋" },
                  { name: "Venezia", tours: 3, image: "https://images.unsplash.com/photo-1523906834658-6e24ef2386f9?w=100&h=100&fit=crop", emoji: "🚤" },
                  { name: "Roma", tours: 6, image: "https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=100&h=100&fit=crop", emoji: "🏛️" }
                ].map((zone, index) => (
                  <Link key={zone.name} href="/explore">
                    <motion.div
                      className="flex items-center space-x-4 p-3 bg-gradient-to-r from-white/80 to-white/60 rounded-xl hover:shadow-md transition-all"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      whileHover={{ scale: 1.02 }}
                    >
                      <img
                        src={zone.image}
                        alt={zone.name}
                        className="w-12 h-12 rounded-lg object-cover"
                      />
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-800">{zone.name}</h4>
                        <p className="text-sm text-gray-600">{zone.tours} tour disponibili</p>
                      </div>
                      <div className="text-2xl">{zone.emoji}</div>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </motion.div>
                  </Link>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tour History - "Rivivi" Section */}
        <motion.div 
          className="mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-800 flex items-center">
              <Clock className="w-5 h-5 mr-2 text-terracotta-400" />
              Rivivi i tuoi Tour
            </h3>
            <div className="flex items-center space-x-3 text-sm text-gray-600">
              <span>{tourHistory.length} tour</span>
              <span>•</span>
              <span>{tourHistory.reduce((total, tour) => total + tour.photos.length, 0)} foto</span>
              <Link href="/photos">
                <span className="text-terracotta-500 hover:text-terracotta-600 font-medium cursor-pointer">Vedi tutte</span>
              </Link>
            </div>
          </div>
          
          <div className="space-y-4">
            {tourHistory.map((tour, index) => (
              <motion.div
                key={tour.id}
                className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 shadow-lg"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + index * 0.1 }}
              >
                <div className="space-y-3">
                  {/* Header con titolo e rating */}
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-gray-800 text-sm">{tour.title}</h4>
                    <div className="flex items-center space-x-1">
                      {Array.from({ length: tour.rating }).map((_, i) => (
                        <Star key={i} className="w-3 h-3 text-yellow-400 fill-current" />
                      ))}
                    </div>
                  </div>
                  
                  <p className="text-xs text-gray-600 flex items-center">
                    <MapPin className="w-3 h-3 mr-1 text-terracotta-400" />
                    {tour.location} • {tour.date}
                  </p>
                  
                  {/* Foto del tour - Mini carousel */}
                  <div className="relative">
                    <h5 className="text-xs font-semibold text-gray-700 mb-2 flex items-center">
                      📸 Le tue foto ({tour.photos.length})
                    </h5>
                    <div className="flex space-x-2 overflow-x-auto pb-2 scrollbar-hide">
                      {tour.photos.map((photo, photoIndex) => (
                        <motion.div
                          key={photoIndex}
                          className="flex-shrink-0 relative group cursor-pointer"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setSelectedTour(tour)}
                        >
                          <img
                            src={photo}
                            alt={`${tour.title} foto ${photoIndex + 1}`}
                            className="w-16 h-16 rounded-lg object-cover shadow-md"
                          />
                          <div className="absolute inset-0 bg-black/20 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                            <Eye className="w-4 h-4 text-white" />
                          </div>
                        </motion.div>
                      ))}
                      
                      {/* Link alla pagina Photos */}
                      <Link href="/photos">
                        <motion.div
                          className="flex-shrink-0 w-16 h-16 bg-gradient-to-br from-terracotta-300 to-terracotta-400 rounded-lg flex items-center justify-center cursor-pointer hover:from-terracotta-400 hover:to-terracotta-500 transition-all shadow-md"
                          whileHover={{ scale: 1.05, rotate: 5 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          <span className="text-white text-xl">📸</span>
                        </motion.div>
                      </Link>
                    </div>
                  </div>
                  
                  {/* Buttons */}
                  <div className="flex space-x-2 pt-2">
                    <motion.button
                      onClick={() => setSelectedTour(tour)}
                      className="bg-terracotta-400 text-white px-3 py-1 rounded-lg text-xs font-medium hover:bg-terracotta-500 transition-colors flex items-center space-x-1 flex-1"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Eye className="w-3 h-3" />
                      <span>Dettagli & Foto</span>
                    </motion.button>
                    
                    <motion.button
                      onClick={() => {
                        setSelectedTour(tour);
                        setShowShareModal(true);
                      }}
                      className="bg-gray-400 text-white px-3 py-1 rounded-lg text-xs font-medium hover:bg-gray-500 transition-colors flex items-center space-x-1"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Share2 className="w-3 h-3" />
                      <span>Condividi</span>
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Tour Detail Modal */}
        <AnimatePresence>
          {selectedTour && !showShareModal && (
            <motion.div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedTour(null)}
            >
              <motion.div
                className="bg-white rounded-3xl p-6 max-w-sm w-full max-h-[80vh] overflow-y-auto"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-gray-800">{selectedTour.title}</h3>
                  <button
                    onClick={() => setSelectedTour(null)}
                    className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
                  >
                    ✕
                  </button>
                </div>
                
                <img
                  src={selectedTour.image}
                  alt={selectedTour.title}
                  className="w-full h-48 rounded-2xl object-cover mb-4"
                />
                
                <div className="space-y-4">
                  <div>
                    <h4 className="font-bold text-gray-800 mb-2">Descrizione</h4>
                    <p className="text-sm text-gray-600">{selectedTour.description}</p>
                  </div>
                  
                  <div>
                    <h4 className="font-bold text-gray-800 mb-2">Highlights</h4>
                    <ul className="space-y-1">
                      {selectedTour.highlights.map((highlight, index) => (
                        <li key={index} className="text-sm text-gray-600 flex items-center">
                          <span className="w-2 h-2 bg-terracotta-400 rounded-full mr-2"></span>
                          {highlight}
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-bold text-gray-800 text-sm">Durata</h4>
                      <p className="text-sm text-gray-600">{selectedTour.duration}</p>
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-800 text-sm">Guida</h4>
                      <p className="text-sm text-gray-600">{selectedTour.guide}</p>
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-bold text-gray-800">Gallery Tour ({selectedTour.photos.length} foto)</h4>
                      <Link href="/photos">
                        <motion.button
                          className="text-terracotta-500 hover:text-terracotta-600 text-sm font-medium flex items-center space-x-1"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          <span>Vedi tutte</span>
                          <ChevronRight className="w-3 h-3" />
                        </motion.button>
                      </Link>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      {selectedTour.photos.slice(0, 4).map((photo, index) => (
                        <motion.div
                          key={index}
                          className="relative group cursor-pointer"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <img
                            src={photo}
                            alt={`Tour foto ${index + 1}`}
                            className="w-full h-24 rounded-lg object-cover shadow-md"
                          />
                          <div className="absolute inset-0 bg-black/20 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                            <Eye className="w-5 h-5 text-white" />
                          </div>
                        </motion.div>
                      ))}
                    </div>
                    
                    {selectedTour.photos.length > 4 && (
                      <Link href="/photos">
                        <motion.div
                          className="bg-gradient-to-r from-terracotta-100 to-terracotta-200 p-3 rounded-xl text-center cursor-pointer hover:from-terracotta-200 hover:to-terracotta-300 transition-all"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <p className="text-terracotta-700 font-medium text-sm">
                            Vedi tutte le {selectedTour.photos.length} foto del tour 📸
                          </p>
                        </motion.div>
                      </Link>
                    )}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Share Modal */}
        <AnimatePresence>
          {showShareModal && selectedTour && (
            <motion.div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowShareModal(false)}
            >
              <motion.div
                className="bg-white rounded-3xl p-6 max-w-sm w-full"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-gray-800">Condividi Tour</h3>
                  <button
                    onClick={() => setShowShareModal(false)}
                    className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
                  >
                    ✕
                  </button>
                </div>
                
                <p className="text-sm text-gray-600 mb-6">
                  Condividi "{selectedTour.title}" con i tuoi amici
                </p>
                
                <div className="grid grid-cols-2 gap-3">
                  <motion.button
                    onClick={() => shareTour('facebook', selectedTour)}
                    className="bg-blue-600 text-white p-4 rounded-2xl flex flex-col items-center space-y-2 hover:bg-blue-700 transition-colors"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Facebook className="w-6 h-6" />
                    <span className="text-sm font-medium">Facebook</span>
                  </motion.button>
                  
                  <motion.button
                    onClick={() => shareTour('twitter', selectedTour)}
                    className="bg-black text-white p-4 rounded-2xl flex flex-col items-center space-y-2 hover:bg-gray-800 transition-colors"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Twitter className="w-6 h-6" />
                    <span className="text-sm font-medium">Twitter</span>
                  </motion.button>
                  
                  <motion.button
                    onClick={() => shareTour('instagram', selectedTour)}
                    className="bg-gradient-to-r from-purple-500 to-pink-500 text-white p-4 rounded-2xl flex flex-col items-center space-y-2 hover:from-purple-600 hover:to-pink-600 transition-colors"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Instagram className="w-6 h-6" />
                    <span className="text-sm font-medium">Instagram</span>
                  </motion.button>
                  
                  <motion.button
                    onClick={() => shareTour('copy', selectedTour)}
                    className="bg-gray-500 text-white p-4 rounded-2xl flex flex-col items-center space-y-2 hover:bg-gray-600 transition-colors"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <LinkIcon className="w-6 h-6" />
                    <span className="text-sm font-medium">Copia Link</span>
                  </motion.button>
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