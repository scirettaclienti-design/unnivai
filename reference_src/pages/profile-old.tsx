import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { User, Mail, MapPin, BookOpen, History, Settings, Heart, Star, Edit, Download, X, Check, ArrowRight, Trophy, Calendar, Clock, Sparkles, ArrowLeft, Home, Share2, Facebook, Twitter, Instagram, Link as LinkIcon, Eye, ChevronRight, Award, Target, Users, Compass, Search, Map } from "lucide-react";
import { Link } from "wouter";
import TopBar from "@/components/TopBar";
import BottomNavigation from "@/components/BottomNavigation";

const userStats = [
  {
    id: 1,
    title: "Tour Completati",
    value: 12,
    icon: Trophy,
    color: "from-yellow-400 to-yellow-500",
    emoji: "🏆"
  },
  {
    id: 2,
    title: "Guide Salvate",
    value: 8,
    icon: Heart,
    color: "from-red-400 to-red-500",
    emoji: "❤️"
  },
  {
    id: 3,
    title: "Ore di Esplorazione",
    value: 36,
    icon: Clock,
    color: "from-blue-400 to-blue-500",
    emoji: "⏱️"
  },
  {
    id: 4,
    title: "Prossimi Tour",
    value: 3,
    icon: Calendar,
    color: "from-green-400 to-green-500",
    emoji: "📅"
  }
];

const savedGuides = [
  {
    id: 1,
    title: "Guida ai Borghi Toscani",
    location: "Toscana",
    image: "https://images.unsplash.com/photo-1520637736862-4d197d17c50a?w=300&h=200&fit=crop",
    savedDate: "2 giorni fa"
  },
  {
    id: 2,
    title: "Cucina Tradizionale Siciliana",
    location: "Sicilia",
    image: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=300&h=200&fit=crop",
    savedDate: "1 settimana fa"
  },
  {
    id: 3,
    title: "Arte Rinascimentale a Firenze",
    location: "Firenze",
    image: "https://images.unsplash.com/photo-1529260830199-42c24126f198?w=300&h=200&fit=crop",
    savedDate: "2 settimane fa"
  }
];

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
      "https://images.unsplash.com/photo-1590736969955-71cc94901144?w=400&h=300&fit=crop"
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
      "https://images.unsplash.com/photo-1527598515782-6b5c98480c38?w=400&h=300&fit=crop"
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
      "https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=400&h=300&fit=crop"
    ]
  }
];

export default function ProfilePage() {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("Marco Rossi");
  const [editEmail, setEditEmail] = useState("marco.rossi@email.it");
  const [savedGuidesList, setSavedGuidesList] = useState(savedGuides.map(guide => ({ ...guide, isSaved: true })));
  const [selectedTour, setSelectedTour] = useState<typeof tourHistory[0] | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [showExploreZones, setShowExploreZones] = useState(false);

  const handleSaveProfile = () => {
    // Dummy save logic
    console.log('Saving profile:', { name: editName, email: editEmail });
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditName("Marco Rossi");
    setEditEmail("marco.rossi@email.it");
    setIsEditing(false);
  };

  const toggleSaveGuide = (guideId: number) => {
    setSavedGuidesList(prev => 
      prev.map(guide => 
        guide.id === guideId ? { ...guide, isSaved: !guide.isSaved } : guide
      )
    );
  };

  const downloadPDF = () => {
    console.log('Downloading tour history as PDF...');
    alert('Scaricamento PDF in corso...');
  };

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
        {/* Back to Home Button */}
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

        {/* Profile Header */}
        <motion.div 
          className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 shadow-lg mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          {!isEditing ? (
            <>
              <div className="flex items-center space-x-4 mb-4">
                <div className="w-16 h-16 bg-gradient-to-br from-terracotta-300 to-terracotta-400 rounded-full flex items-center justify-center">
                  <User className="text-white w-8 h-8" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-gray-800">{editName}</h2>
                  <p className="text-gray-600 flex items-center text-sm">
                    <Mail className="w-3 h-3 mr-1 text-terracotta-400" />
                    {editEmail}
                  </p>
                  <p className="text-gray-600 flex items-center text-sm">
                    <MapPin className="w-3 h-3 mr-1 text-terracotta-400" />
                    Roma, Italia
                  </p>
                </div>
                <button className="p-2 rounded-full bg-ochre-200 hover:bg-ochre-300 transition-colors">
                  <Settings className="w-5 h-5 text-ochre-600" />
                </button>
              </div>
              
              <button
                onClick={() => setIsEditing(true)}
                className="w-full bg-terracotta-400 text-white py-2 px-4 rounded-xl hover:bg-terracotta-500 transition-colors flex items-center justify-center space-x-2"
              >
                <Edit className="w-4 h-4" />
                <span>Edit Profile</span>
              </button>
            </>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center space-x-4 mb-4">
                <div className="w-16 h-16 bg-gradient-to-br from-terracotta-300 to-terracotta-400 rounded-full flex items-center justify-center">
                  <User className="text-white w-8 h-8" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-800 mb-2">Modifica Profilo</h3>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 bg-white/70 backdrop-blur-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-terracotta-400 focus:border-transparent transition-all"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-white/70 backdrop-blur-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-terracotta-400 focus:border-transparent transition-all"
                />
              </div>
              
              <div className="flex space-x-3">
                <button
                  onClick={handleSaveProfile}
                  className="flex-1 bg-terracotta-400 text-white py-2 px-4 rounded-xl hover:bg-terracotta-500 transition-colors flex items-center justify-center space-x-2"
                >
                  <Check className="w-4 h-4" />
                  <span>Salva</span>
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-xl hover:bg-gray-400 transition-colors flex items-center justify-center space-x-2"
                >
                  <X className="w-4 h-4" />
                  <span>Annulla</span>
                </button>
              </div>
            </div>
          )}
          
          {!isEditing && (
            <div className="flex justify-around mt-6 pt-4 border-t border-gray-200">
              <div className="text-center">
                <div className="text-lg font-bold text-terracotta-600">12</div>
                <div className="text-xs text-gray-600">Tour Completati</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-terracotta-600">8</div>
                <div className="text-xs text-gray-600">Guide Salvate</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-terracotta-600">4.8</div>
                <div className="text-xs text-gray-600">Valutazione Media</div>
              </div>
            </div>
          )}
          
          <div className="flex justify-around mt-6 pt-4 border-t border-gray-200">
            <div className="text-center">
              <div className="text-lg font-bold text-terracotta-600">12</div>
              <div className="text-xs text-gray-600">Tour Completati</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-terracotta-600">8</div>
              <div className="text-xs text-gray-600">Guide Salvate</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-terracotta-600">4.8</div>
              <div className="text-xs text-gray-600">Valutazione Media</div>
            </div>
          </div>
        </motion.div>

        {/* Saved Guides Section */}
        <motion.div 
          className="mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-800 flex items-center">
              <Heart className="w-5 h-5 mr-2 text-terracotta-400" />
              Le mie guide salvate
            </h3>
            <Link href="/explore">
              <motion.button 
                className="text-terracotta-400 text-sm font-medium bg-terracotta-50 px-3 py-1 rounded-full hover:bg-terracotta-100 transition-colors"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Vedi tutte
              </motion.button>
            </Link>
          </div>
          
          <div className="space-y-3">
            {savedGuidesList.map((guide, index) => (
              <motion.div
                key={guide.id}
                className={`group bg-gradient-to-r from-white/80 to-white/60 backdrop-blur-sm rounded-xl p-4 shadow-md hover:shadow-xl transition-all duration-300 relative overflow-hidden ${
                  !guide.isSaved ? 'opacity-50' : ''
                }`}
                initial={{ opacity: 0, x: -30, rotateY: -15 }}
                animate={{ opacity: 1, x: 0, rotateY: 0 }}
                transition={{ duration: 0.6, delay: 0.3 + index * 0.1 }}
                whileHover={{ scale: 1.02, rotateY: 2 }}
                style={{ perspective: 1000 }}
              >
                <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-terracotta-200/20 to-transparent rounded-full -translate-y-2 translate-x-2" />
                
                <div className="flex space-x-3 relative z-10">
                  <div className="relative">
                    <img
                      src={guide.image}
                      alt={guide.title}
                      className="w-16 h-16 rounded-lg object-cover shadow-sm group-hover:shadow-md transition-shadow"
                    />
                    <motion.div
                      className="absolute -top-1 -right-1 w-6 h-6 bg-terracotta-400 text-white rounded-full flex items-center justify-center text-xs font-bold shadow-lg"
                      whileHover={{ scale: 1.2, rotate: 15 }}
                    >
                      ❤️
                    </motion.div>
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-semibold text-gray-800 text-sm group-hover:text-terracotta-600 transition-colors">
                        {guide.title}
                      </h4>
                      <motion.button
                        onClick={() => toggleSaveGuide(guide.id)}
                        className="p-1 rounded-full hover:bg-terracotta-100 transition-colors"
                        whileHover={{ scale: 1.2, rotate: 15 }}
                        whileTap={{ scale: 0.8 }}
                      >
                        <Heart 
                          className={`w-4 h-4 transition-colors ${
                            guide.isSaved 
                              ? 'text-red-500 fill-current' 
                              : 'text-gray-400 hover:text-red-500'
                          }`}
                        />
                      </motion.button>
                    </div>
                    
                    <p className="text-xs text-gray-600 mb-2 flex items-center">
                      <MapPin className="w-3 h-3 mr-1 text-terracotta-400" />
                      {guide.location}
                    </p>
                    
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-500">Salvato {guide.savedDate}</p>
                      <div className="flex space-x-1">
                        <Link href="/tour-details">
                          <motion.button
                            className="bg-terracotta-400 text-white px-3 py-1 rounded-lg text-xs font-medium hover:bg-terracotta-500 transition-colors flex items-center space-x-1"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            <BookOpen className="w-3 h-3" />
                            <span>Apri</span>
                          </motion.button>
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
                
                <motion.div
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-terracotta-400 to-terracotta-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  initial={{ scaleX: 0 }}
                  whileHover={{ scaleX: 1 }}
                  transition={{ duration: 0.3 }}
                />
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          className="mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <h3 className="text-lg font-bold text-gray-800 mb-4">Azioni Rapide</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: BookOpen, title: "Nuova Guida", href: "/create-tour", color: "from-blue-400 to-blue-500", emoji: "📖" },
              { icon: Trophy, title: "I Miei Risultati", href: "/profile", color: "from-yellow-400 to-yellow-500", emoji: "🏆" },
              { icon: MapPin, title: "Esplora Zone", href: "/explore", color: "from-green-400 to-green-500", emoji: "🗺️" },
              { icon: Calendar, title: "Tour Live", href: "/tour-live", color: "from-purple-400 to-purple-500", emoji: "📅" }
            ].map((action, index) => (
              <Link key={action.title} href={action.href}>
                <motion.div
                  className="group relative overflow-hidden"
                  initial={{ opacity: 0, scale: 0.8, rotateY: -30 }}
                  animate={{ opacity: 1, scale: 1, rotateY: 0 }}
                  transition={{ duration: 0.6, delay: 0.5 + index * 0.1 }}
                  whileHover={{ scale: 1.05, rotateY: 5 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <div className={`bg-gradient-to-br ${action.color} text-white p-4 rounded-2xl shadow-lg relative overflow-hidden`}>
                    <div className="absolute top-0 right-0 w-12 h-12 bg-white/10 rounded-full -translate-y-1 translate-x-1" />
                    
                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-2">
                        <motion.div
                          className="text-2xl"
                          whileHover={{ scale: 1.2, rotate: 15 }}
                          transition={{ type: "spring", stiffness: 300 }}
                        >
                          {action.emoji}
                        </motion.div>
                        <action.icon className="w-5 h-5 opacity-60" />
                      </div>
                      
                      <h4 className="font-bold text-sm">{action.title}</h4>
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

        {/* Tour History Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-800 flex items-center">
              <History className="w-5 h-5 mr-2 text-terracotta-400" />
              Storico tour
            </h3>
            <div className="flex items-center space-x-2">
              <motion.button 
                onClick={downloadPDF}
                className="bg-terracotta-400 text-white px-3 py-1 rounded-lg text-xs font-medium hover:bg-terracotta-500 transition-colors flex items-center space-x-1 shadow-lg"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Download className="w-3 h-3" />
                <span>Scarica PDF</span>
              </motion.button>
              <motion.button 
                className="text-terracotta-400 text-sm font-medium bg-terracotta-50 px-3 py-1 rounded-full hover:bg-terracotta-100 transition-colors"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Vedi tutto
              </motion.button>
            </div>
          </div>
          
          <div className="space-y-3">
            {tourHistory.map((tour, index) => (
              <motion.div
                key={tour.id}
                className="group bg-gradient-to-r from-white/80 to-white/60 backdrop-blur-sm rounded-xl p-4 shadow-md hover:shadow-xl transition-all duration-300 relative overflow-hidden"
                initial={{ opacity: 0, x: -30, rotateY: -15 }}
                animate={{ opacity: 1, x: 0, rotateY: 0 }}
                transition={{ duration: 0.6, delay: 0.9 + index * 0.1 }}
                whileHover={{ scale: 1.02, rotateY: 2 }}
                style={{ perspective: 1000 }}
              >
                <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-ochre-200/20 to-transparent rounded-full -translate-y-2 translate-x-2" />
                
                <div className="flex space-x-3 relative z-10">
                  <div className="relative">
                    <img
                      src={tour.image}
                      alt={tour.title}
                      className="w-16 h-16 rounded-lg object-cover shadow-sm group-hover:shadow-md transition-shadow"
                    />
                    <motion.div
                      className="absolute -top-1 -right-1 w-6 h-6 bg-ochre-400 text-white rounded-full flex items-center justify-center text-xs font-bold shadow-lg"
                      whileHover={{ scale: 1.2, rotate: 15 }}
                    >
                      ⭐
                    </motion.div>
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-semibold text-gray-800 text-sm group-hover:text-terracotta-600 transition-colors">
                        {tour.title}
                      </h4>
                      <div className="flex items-center space-x-1">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`w-3 h-3 ${
                              i < tour.rating ? 'text-ochre-400 fill-current' : 'text-gray-300'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    
                    <p className="text-xs text-gray-600 mb-2 flex items-center">
                      <MapPin className="w-3 h-3 mr-1 text-terracotta-400" />
                      {tour.location}
                    </p>
                    
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-500">{tour.date}</p>
                      <Link href="/tour-details">
                        <motion.button
                          className="bg-ochre-400 text-white px-3 py-1 rounded-lg text-xs font-medium hover:bg-ochre-500 transition-colors flex items-center space-x-1"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          <span>Rivivi</span>
                          <ArrowRight className="w-3 h-3" />
                        </motion.button>
                      </Link>
                    </div>
                  </div>
                </div>
                
                <motion.div
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-ochre-400 to-ochre-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  initial={{ scaleX: 0 }}
                  whileHover={{ scaleX: 1 }}
                  transition={{ duration: 0.3 }}
                />
              </motion.div>
            ))}
          </div>
        </motion.div>
      </main>

      <BottomNavigation />
    </div>
  );
}