import { motion } from "framer-motion";
import { ArrowLeft, MapPin, Clock, Euro, Camera, Users, Calendar, Star, Upload, Plus, Trash2 } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import TopBar from "@/components/TopBar";
import BottomNavigation from "@/components/BottomNavigation";

export default function CreateTourPage() {
  const [tourData, setTourData] = useState({
    title: "",
    description: "",
    price: "",
    duration: "",
    maxParticipants: "",
    category: "",
    highlights: [""],
    itinerary: [{ time: "", activity: "" }]
  });

  const addHighlight = () => {
    setTourData(prev => ({
      ...prev,
      highlights: [...prev.highlights, ""]
    }));
  };

  const addItineraryItem = () => {
    setTourData(prev => ({
      ...prev,
      itinerary: [...prev.itinerary, { time: "", activity: "" }]
    }));
  };

  const categories = [
    { id: "food", name: "Cibo & Gusto", emoji: "🍝", color: "from-red-400 to-red-500" },
    { id: "culture", name: "Arte & Cultura", emoji: "🎨", color: "from-purple-400 to-purple-500" },
    { id: "adventure", name: "Avventura", emoji: "🗺️", color: "from-green-400 to-green-500" },
    { id: "nature", name: "Natura", emoji: "🌿", color: "from-emerald-400 to-emerald-500" },
    { id: "history", name: "Storia", emoji: "🏛️", color: "from-amber-400 to-amber-500" },
    { id: "nightlife", name: "Vita Notturna", emoji: "🌃", color: "from-blue-400 to-blue-500" }
  ];

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
          <Link href="/profile">
            <motion.button
              className="p-3 rounded-full bg-white/60 backdrop-blur-sm mr-4 hover:bg-white/80 transition-colors"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <ArrowLeft className="w-6 h-6 text-gray-700" />
            </motion.button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center">
              <span className="text-3xl mr-3">⭐</span>
              Crea il tuo tour
            </h1>
            <p className="text-gray-600 text-sm">Condividi la tua passione con il mondo</p>
          </div>
        </motion.div>

        {/* Form */}
        <div className="space-y-6">
          {/* Basic Info */}
          <motion.div
            className="bg-white/80 rounded-3xl p-6"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
              <span className="text-2xl mr-2">📝</span>
              Informazioni base
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Titolo del tour</label>
                <input
                  type="text"
                  value={tourData.title}
                  onChange={(e) => setTourData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="es: Sapori nascosti di Roma"
                  className="w-full p-4 rounded-2xl border border-gray-200 focus:ring-2 focus:ring-terracotta-400 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Descrizione</label>
                <textarea
                  value={tourData.description}
                  onChange={(e) => setTourData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Racconta cosa rende speciale il tuo tour..."
                  rows={4}
                  className="w-full p-4 rounded-2xl border border-gray-200 focus:ring-2 focus:ring-terracotta-400 focus:border-transparent resize-none"
                />
              </div>
            </div>
          </motion.div>

          {/* Category Selection */}
          <motion.div
            className="bg-white/80 rounded-3xl p-6"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
              <span className="text-2xl mr-2">🎯</span>
              Categoria
            </h2>
            
            <div className="grid grid-cols-2 gap-3">
              {categories.map((category, index) => (
                <motion.button
                  key={category.id}
                  onClick={() => setTourData(prev => ({ ...prev, category: category.id }))}
                  className={`p-4 rounded-2xl text-white font-medium text-center transition-all duration-300 ${
                    tourData.category === category.id 
                      ? `bg-gradient-to-r ${category.color} shadow-lg scale-105` 
                      : 'bg-gray-300 hover:bg-gray-400'
                  }`}
                  initial={{ opacity: 0, rotateY: -90 }}
                  animate={{ opacity: 1, rotateY: 0 }}
                  transition={{ duration: 0.6, delay: 0.6 + index * 0.1 }}
                  whileHover={{ scale: tourData.category === category.id ? 1.05 : 1.02 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <div className="text-2xl mb-1">{category.emoji}</div>
                  <div className="text-sm">{category.name}</div>
                </motion.button>
              ))}
            </div>
          </motion.div>

          {/* Tour Details */}
          <motion.div
            className="bg-white/80 rounded-3xl p-6"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.6 }}
          >
            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
              <span className="text-2xl mr-2">⚙️</span>
              Dettagli
            </h2>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Prezzo (€)</label>
                <div className="relative">
                  <Euro className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="number"
                    value={tourData.price}
                    onChange={(e) => setTourData(prev => ({ ...prev, price: e.target.value }))}
                    placeholder="25"
                    className="w-full pl-10 pr-4 py-3 rounded-2xl border border-gray-200 focus:ring-2 focus:ring-terracotta-400 focus:border-transparent"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Durata</label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={tourData.duration}
                    onChange={(e) => setTourData(prev => ({ ...prev, duration: e.target.value }))}
                    placeholder="2 ore"
                    className="w-full pl-10 pr-4 py-3 rounded-2xl border border-gray-200 focus:ring-2 focus:ring-terracotta-400 focus:border-transparent"
                  />
                </div>
              </div>
              
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Max partecipanti</label>
                <div className="relative">
                  <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="number"
                    value={tourData.maxParticipants}
                    onChange={(e) => setTourData(prev => ({ ...prev, maxParticipants: e.target.value }))}
                    placeholder="12"
                    className="w-full pl-10 pr-4 py-3 rounded-2xl border border-gray-200 focus:ring-2 focus:ring-terracotta-400 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          </motion.div>

          {/* Highlights */}
          <motion.div
            className="bg-white/80 rounded-3xl p-6"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.8 }}
          >
            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
              <span className="text-2xl mr-2">✨</span>
              Punti salienti
            </h2>
            
            <div className="space-y-3">
              {tourData.highlights.map((highlight, index) => (
                <div key={index} className="flex space-x-2">
                  <input
                    type="text"
                    value={highlight}
                    onChange={(e) => {
                      const newHighlights = [...tourData.highlights];
                      newHighlights[index] = e.target.value;
                      setTourData(prev => ({ ...prev, highlights: newHighlights }));
                    }}
                    placeholder="🍝 Pasta fresca fatta a mano"
                    className="flex-1 p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-terracotta-400 focus:border-transparent"
                  />
                  {tourData.highlights.length > 1 && (
                    <motion.button
                      onClick={() => {
                        const newHighlights = tourData.highlights.filter((_, i) => i !== index);
                        setTourData(prev => ({ ...prev, highlights: newHighlights }));
                      }}
                      className="p-3 rounded-xl bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </motion.button>
                  )}
                </div>
              ))}
              
              <motion.button
                onClick={addHighlight}
                className="w-full p-3 rounded-xl border-2 border-dashed border-gray-300 text-gray-500 hover:border-terracotta-400 hover:text-terracotta-400 transition-colors flex items-center justify-center space-x-2"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Plus className="w-4 h-4" />
                <span>Aggiungi punto saliente</span>
              </motion.button>
            </div>
          </motion.div>

          {/* Photos */}
          <motion.div
            className="bg-white/80 rounded-3xl p-6"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 1 }}
          >
            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
              <span className="text-2xl mr-2">📸</span>
              Foto del tour
            </h2>
            
            <motion.div
              className="border-2 border-dashed border-gray-300 rounded-2xl p-8 text-center hover:border-terracotta-400 hover:bg-terracotta-50 transition-all duration-300 cursor-pointer"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Camera className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">Carica le foto del tuo tour</p>
              <p className="text-sm text-gray-500">PNG, JPG fino a 10MB</p>
            </motion.div>
          </motion.div>

          {/* Submit Button */}
          <motion.div
            className="space-y-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.2 }}
          >
            <motion.button
              className="w-full bg-gradient-to-r from-terracotta-400 to-terracotta-500 text-white py-4 rounded-2xl font-bold text-lg shadow-xl hover:shadow-2xl transition-all duration-300 flex items-center justify-center space-x-2"
              whileHover={{ scale: 1.02, rotateX: 5 }}
              whileTap={{ scale: 0.98 }}
            >
              <Star className="w-6 h-6" />
              <span>🚀 Pubblica il tour</span>
            </motion.button>
            
            <motion.button
              className="w-full bg-gray-300 text-gray-700 py-3 rounded-2xl font-medium hover:bg-gray-400 transition-colors"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              💾 Salva come bozza
            </motion.button>
          </motion.div>
        </div>
      </main>

      <BottomNavigation />
    </div>
  );
}