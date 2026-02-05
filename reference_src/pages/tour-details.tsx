import { motion } from "framer-motion";
import { ArrowLeft, MapPin, Clock, User, Star, Play, Heart, Share2, Camera, Users, Calendar, MessageCircle, Zap, Navigation, Gift, Shield } from "lucide-react";
import { Link, useParams } from "wouter";
import { useState } from "react";
import TopBar from "@/components/TopBar";
import BottomNavigation from "@/components/BottomNavigation";
import BookingModal from "@/components/BookingSystem";
import { Toast } from "@/components/ToastNotification";

const tourDetails = {
  1: {
    id: 1,
    title: "Sapori nascosti di Trastevere",
    guide: "Maria Benedetti",
    guideAvatar: "👩‍🍳",
    guideBio: "Chef appassionata con 15 anni di esperienza. Nata e cresciuta a Trastevere, conosce ogni vicolo e ogni sapore autentico del quartiere.",
    location: "Roma, Trastevere",
    duration: "90 min",
    price: 18,
    originalPrice: 25,
    rating: 4.8,
    reviews: 47,
    participants: 8,
    maxParticipants: 12,
    images: [
      "https://images.unsplash.com/photo-1555992336-03a23c7b20ee?w=400&h=300&fit=crop",
      "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&h=300&fit=crop",
      "https://images.unsplash.com/photo-1482049016688-2d3e1b311543?w=400&h=300&fit=crop"
    ],
    description: "Scopri i sapori autentici del quartiere più caratteristico di Roma, dove ogni pietra racconta una storia e ogni piatto è una tradizione.",
    highlights: ["🍝 Pasta fresca fatta a mano", "🍷 Degustazione vini locali", "📸 Foto ricordo", "🧀 Formaggi tipici", "🫒 Olio extravergine"],
    itinerary: [
      { time: "19:30", activity: "Incontro in Piazza Santa Maria", emoji: "👋" },
      { time: "19:45", activity: "Visita trattoria storica", emoji: "🍝" },
      { time: "20:15", activity: "Degustazione vini", emoji: "🍷" },
      { time: "20:45", activity: "Mercato notturno", emoji: "🛒" },
      { time: "21:00", activity: "Dolce finale", emoji: "🍰" }
    ],
    meetingPoint: "Piazza Santa Maria in Trastevere, presso la fontana centrale",
    included: ["Degustazioni", "Foto ricordo", "Guida esperta", "Assicurazione"],
    notIncluded: ["Trasporti", "Cena completa", "Acquisto prodotti"],
    live: true,
    nextStart: "Tra 2 ore"
  },
  2: {
    id: 2,
    title: "Palermo tra mercati e street art",
    guide: "Giuseppe Torrisi",
    guideAvatar: "🎨",
    guideBio: "Artista e fotografo palermitano, esperto di arte urbana e culture del Mediterraneo. Collabora con gallerie internazionali.",
    location: "Palermo, Centro storico",
    duration: "2 ore",
    price: 22,
    originalPrice: 30,
    rating: 4.9,
    reviews: 63,
    participants: 15,
    maxParticipants: 20,
    images: [
      "https://images.unsplash.com/photo-1526392060635-9d6019884377?w=400&h=300&fit=crop",
      "https://images.unsplash.com/photo-1580500722723-e2dc6e1b7bb8?w=400&h=300&fit=crop",
      "https://images.unsplash.com/photo-1574928162543-c0d0c56e4a6d?w=400&h=300&fit=crop"
    ],
    description: "Un viaggio tra i colori e i sapori dei mercati storici palermitani, dove l'arte urbana si mescola con le tradizioni millenarie.",
    highlights: ["🎨 Murales nascosti", "🛒 Mercati storici", "🍊 Degustazioni", "📱 Workshop fotografico", "🏛️ Architettura araba"],
    itinerary: [
      { time: "16:00", activity: "Mercato di Ballarò", emoji: "🛒" },
      { time: "16:30", activity: "Street art tour", emoji: "🎨" },
      { time: "17:00", activity: "Palazzo dei Normanni", emoji: "🏛️" },
      { time: "17:30", activity: "Degustazione arancine", emoji: "🍊" },
      { time: "18:00", activity: "Workshop fotografico", emoji: "📱" }
    ],
    meetingPoint: "Ingresso principale Mercato di Ballarò",
    included: ["Tour guidato", "Degustazioni", "Workshop", "Mappa artistica"],
    notIncluded: ["Trasporti", "Cena", "Materiale fotografico"],
    live: true,
    nextStart: "In corso"
  },
  "demo1": {
    id: "demo1",
    title: "Tour del Colosseo VIP",
    guide: "Marco Aurelio",
    guideAvatar: "🏛️",
    guideBio: "Archeologo romano specializzato nell'Impero Romano. Vive accanto al Colosseo da sempre.",
    location: "Roma, Colosseo",
    duration: "2 ore",
    price: 45,
    originalPrice: 60,
    rating: 4.9,
    reviews: 234,
    participants: 12,
    maxParticipants: 15,
    images: [
      "https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=400&h=300&fit=crop",
      "https://images.unsplash.com/photo-1598969477032-32a4d4ec5ea6?w=400&h=300&fit=crop",
      "https://images.unsplash.com/photo-1555704171-9a5e4ad7b9a3?w=400&h=300&fit=crop"
    ],
    description: "Accesso esclusivo alle aree riservate del Colosseo con guide archeologiche specializzate.",
    highlights: ["🎟️ Accesso senza code", "🏛️ Aree riservate", "📚 Storia approfondita", "📸 Punti fotografici esclusivi", "🎧 Audio guida premium"],
    itinerary: [
      { time: "09:00", activity: "Incontro all'ingresso principale", emoji: "🤝" },
      { time: "09:15", activity: "Accesso prioritario", emoji: "⚡" },
      { time: "09:30", activity: "Piano dell'arena", emoji: "🏟️" },
      { time: "10:15", activity: "Sotterranei del Colosseo", emoji: "🔍" },
      { time: "10:45", activity: "Panorama dal secondo piano", emoji: "📸" }
    ],
    meetingPoint: "Metro Colosseo, Uscita Via dei Fori Imperiali",
    included: ["Biglietto d'ingresso", "Guida archeologa", "Audio guide", "Mappa del sito"],
    notIncluded: ["Trasporti", "Pranzo", "Foto professionali"],
    live: false,
    nextStart: "Ogni giorno alle 9:00"
  },
  "demo2": {
    id: "demo2",
    title: "Aperitivo tra Locali",
    guide: "Sofia Romani",
    guideAvatar: "🍸",
    guideBio: "Sommelier e bartender romana. Conosce tutti i locali nascosti di Trastevere e i segreti dell'aperitivo perfetto.",
    location: "Roma, Trastevere",
    duration: "3 ore",
    price: 35,
    originalPrice: 50,
    rating: 4.8,
    reviews: 189,
    participants: 8,
    maxParticipants: 12,
    images: [
      "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=300&fit=crop",
      "https://images.unsplash.com/photo-1572116469696-31de0f17cc34?w=400&h=300&fit=crop",
      "https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=400&h=300&fit=crop"
    ],
    description: "Scopri i segreti dell'aperitivo romano tra i locali più autentici di Trastevere.",
    highlights: ["🍸 3 locali selezionati", "🍕 Cicchetti romani", "🍷 Vini locali", "📱 Consigli social", "🗺️ Mappa dei locali"],
    itinerary: [
      { time: "18:30", activity: "Incontro a Piazza Trilussa", emoji: "🤝" },
      { time: "18:45", activity: "Primo locale storico", emoji: "🍸" },
      { time: "19:30", activity: "Wine bar nascosto", emoji: "🍷" },
      { time: "20:15", activity: "Terrazza panoramica", emoji: "🌅" },
      { time: "21:00", activity: "Ultimo brindisi", emoji: "🥂" }
    ],
    meetingPoint: "Piazza Trilussa, presso la fontana centrale",
    included: ["3 aperitivi", "Cicchetti", "Guida locale", "Mappa digitale"],
    notIncluded: ["Cena", "Trasporti", "Ulteriori drink"],
    live: false,
    nextStart: "Ogni giorno alle 18:30"
  },
  3: {
    id: 3,
    title: "Venezia segreta: calli e bacari",
    guide: "Andrea Morosini",
    guideAvatar: "🚤",
    guideBio: "Veneziano di quinta generazione, navigatore esperto e sommelier. Conosce ogni canale e ogni cicchetto della città.",
    location: "Venezia, Cannaregio",
    duration: "2.5 ore",
    price: 25,
    originalPrice: 35,
    rating: 4.7,
    reviews: 38,
    participants: 6,
    maxParticipants: 10,
    images: [
      "https://images.unsplash.com/photo-1514890547357-a9ee288728e0?w=400&h=300&fit=crop",
      "https://images.unsplash.com/photo-1523906834658-6e24ef2386f9?w=400&h=300&fit=crop",
      "https://images.unsplash.com/photo-1551738808-2d825ac7edc3?w=400&h=300&fit=crop"
    ],
    description: "Esplora la Venezia autentica lontano dalle folle turistiche, tra calli nascoste e bacari storici dove il tempo si è fermato.",
    highlights: ["🍷 Spritz originali", "🦐 Cicchetti autentici", "🗺️ Calli segrete", "⛵ Giro in gondola", "🌅 Tramonto sui canali"],
    itinerary: [
      { time: "20:00", activity: "Cannaregio nascosto", emoji: "🗺️" },
      { time: "20:20", activity: "Primo bacaro", emoji: "🍷" },
      { time: "20:50", activity: "Calli segrete", emoji: "🚶" },
      { time: "21:20", activity: "Secondo bacaro", emoji: "🦐" },
      { time: "21:50", activity: "Tramonto sui canali", emoji: "🌅" }
    ],
    meetingPoint: "Ponte delle Guglie, Cannaregio",
    included: ["3 spritz", "Cicchetti", "Guida locale", "Mappa segreta"],
    notIncluded: ["Cena completa", "Gondola privata", "Extra bevande"],
    live: false,
    nextStart: "Domani"
  }
};

export default function TourDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const tour = tourDetails[parseInt(id || "1") as keyof typeof tourDetails];
  const [showBooking, setShowBooking] = useState(false);
  const [toast, setToast] = useState<{message: string; type: 'success' | 'error' | 'warning' | 'info'; show: boolean}>({
    message: '',
    type: 'success',
    show: false
  });

  const handleBookingConfirm = (bookingData: any) => {
    setShowBooking(false);
    setToast({
      message: 'Prenotazione confermata! Riceverai una email di conferma.',
      type: 'success',
      show: true
    });
  };

  if (!tour) {
    return <div>Tour non trovato</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-ochre-100 to-ochre-200 font-quicksand">
      <TopBar />
      
      <main className="max-w-md mx-auto pb-24">
        {/* Hero Section */}
        <div className="relative">
          <motion.img
            src={tour.images[0]}
            alt={tour.title}
            className="w-full h-80 object-cover"
            initial={{ scale: 1.2, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.8 }}
          />
          
          {/* Overlay Controls */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent">
            <div className="absolute top-4 left-4">
              <Link href="/tour-live">
                <motion.button
                  className="p-3 rounded-full bg-white/80 backdrop-blur-sm hover:bg-white transition-colors"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <ArrowLeft className="w-6 h-6 text-gray-700" />
                </motion.button>
              </Link>
            </div>
            
            <div className="absolute top-4 right-4 flex space-x-2">
              <motion.button
                className="p-3 rounded-full bg-white/80 backdrop-blur-sm hover:bg-white transition-colors"
                whileHover={{ scale: 1.1, rotate: 15 }}
                whileTap={{ scale: 0.9 }}
              >
                <Heart className="w-6 h-6 text-red-400" />
              </motion.button>
              <motion.button
                className="p-3 rounded-full bg-white/80 backdrop-blur-sm hover:bg-white transition-colors"
                whileHover={{ scale: 1.1, rotate: -15 }}
                whileTap={{ scale: 0.9 }}
              >
                <Share2 className="w-6 h-6 text-gray-700" />
              </motion.button>
            </div>
            
            {/* Live Badge */}
            {tour.live && (
              <motion.div
                className="absolute bottom-4 left-4 bg-red-500 text-white px-4 py-2 rounded-full flex items-center space-x-2"
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                <span className="font-bold">🔴 LIVE</span>
              </motion.div>
            )}
          </div>
        </div>

        <div className="px-4 py-6 space-y-8">
          {/* Title and Price */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="flex justify-between items-start mb-4">
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-gray-800 mb-2">{tour.title}</h1>
                <p className="text-gray-600 leading-relaxed">{tour.description}</p>
              </div>
              <motion.div
                className="ml-4 bg-gradient-to-r from-terracotta-400 to-terracotta-500 text-white px-6 py-4 rounded-2xl text-center shadow-lg"
                whileHover={{ scale: 1.05, rotateY: 5 }}
              >
                <div className="text-2xl font-bold">{tour.price}€</div>
                {tour.originalPrice && (
                  <div className="text-sm line-through opacity-70">{tour.originalPrice}€</div>
                )}
              </motion.div>
            </div>
          </motion.div>

          {/* Guide Section */}
          <motion.div
            className="bg-gradient-to-r from-white/80 to-white/60 backdrop-blur-sm rounded-3xl p-6"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <h3 className="font-bold text-gray-800 mb-4 flex items-center">
              <span className="text-2xl mr-2">👥</span>
              La tua guida
            </h3>
            <div className="flex items-start space-x-4">
              <motion.div
                className="text-4xl"
                whileHover={{ scale: 1.2, rotate: 10 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                {tour.guideAvatar}
              </motion.div>
              <div className="flex-1">
                <h4 className="font-bold text-lg text-gray-800">{tour.guide}</h4>
                <div className="flex items-center space-x-3 mb-3">
                  <div className="flex items-center">
                    <Star className="w-4 h-4 text-yellow-400 fill-current mr-1" />
                    <span className="font-medium">{tour.rating}</span>
                    <span className="text-xs text-gray-500 ml-1">({tour.reviews} recensioni)</span>
                  </div>
                </div>
                <p className="text-gray-600 text-sm leading-relaxed">{tour.guideBio}</p>
                <div className="flex space-x-2 mt-4">
                  <Link href={`/profile`} className="flex-1">
                    <motion.button
                      className="w-full bg-terracotta-400 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-terracotta-500 transition-colors flex items-center justify-center space-x-1"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>💬 Messaggio</span>
                    </motion.button>
                  </Link>
                  <Link href={`/profile`} className="flex-1">
                    <motion.button
                      className="w-full bg-olive-400 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-olive-500 transition-colors flex items-center justify-center space-x-1"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <User className="w-4 h-4" />
                      <span>👤 Profilo</span>
                    </motion.button>
                  </Link>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Tour Details Grid */}
          <motion.div
            className="grid grid-cols-2 gap-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            <motion.div
              className="bg-white/70 rounded-2xl p-4 text-center"
              whileHover={{ scale: 1.05, rotateX: 5 }}
            >
              <MapPin className="w-8 h-8 text-terracotta-400 mx-auto mb-2" />
              <div className="text-xs text-gray-500 mb-1">Dove</div>
              <div className="font-bold text-gray-800">{tour.location}</div>
            </motion.div>
            
            <motion.div
              className="bg-white/70 rounded-2xl p-4 text-center"
              whileHover={{ scale: 1.05, rotateX: 5 }}
            >
              <Clock className="w-8 h-8 text-terracotta-400 mx-auto mb-2" />
              <div className="text-xs text-gray-500 mb-1">Durata</div>
              <div className="font-bold text-gray-800">{tour.duration}</div>
            </motion.div>
            
            <motion.div
              className="bg-white/70 rounded-2xl p-4 text-center"
              whileHover={{ scale: 1.05, rotateX: 5 }}
            >
              <Users className="w-8 h-8 text-terracotta-400 mx-auto mb-2" />
              <div className="text-xs text-gray-500 mb-1">Partecipanti</div>
              <div className="font-bold text-gray-800">{tour.participants}/{tour.maxParticipants}</div>
            </motion.div>
            
            <motion.div
              className="bg-white/70 rounded-2xl p-4 text-center"
              whileHover={{ scale: 1.05, rotateX: 5 }}
            >
              <Calendar className="w-8 h-8 text-terracotta-400 mx-auto mb-2" />
              <div className="text-xs text-gray-500 mb-1">Prossimo</div>
              <div className="font-bold text-gray-800">{tour.nextStart}</div>
            </motion.div>
          </motion.div>

          {/* Highlights */}
          <motion.div
            className="bg-gradient-to-r from-ochre-100 to-terracotta-100 rounded-3xl p-6"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.6 }}
          >
            <h3 className="font-bold text-gray-800 mb-4 flex items-center">
              <span className="text-2xl mr-2">✨</span>
              Cosa ti aspetta
            </h3>
            <div className="grid grid-cols-1 gap-3">
              {tour.highlights.map((highlight, index) => (
                <motion.div
                  key={index}
                  className="bg-white/60 rounded-xl p-3 flex items-center space-x-3"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.6, delay: 0.8 + index * 0.1 }}
                  whileHover={{ scale: 1.02, x: 5 }}
                >
                  <div className="text-2xl">{highlight.split(' ')[0]}</div>
                  <span className="font-medium text-gray-700">{highlight.substring(2)}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Itinerary */}
          <motion.div
            className="bg-white/80 rounded-3xl p-6"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.8 }}
          >
            <h3 className="font-bold text-gray-800 mb-6 flex items-center">
              <span className="text-2xl mr-2">🗓️</span>
              Programma del tour
            </h3>
            <div className="space-y-4">
              {tour.itinerary.map((item, index) => (
                <motion.div
                  key={index}
                  className="flex items-center space-x-4 p-3 bg-gradient-to-r from-terracotta-50 to-ochre-50 rounded-xl"
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.6, delay: 1 + index * 0.1 }}
                  whileHover={{ scale: 1.02, x: 5 }}
                >
                  <div className="bg-terracotta-400 text-white px-3 py-1 rounded-lg font-bold text-sm">
                    {item.time}
                  </div>
                  <div className="text-2xl">{item.emoji}</div>
                  <div className="flex-1 font-medium text-gray-700">{item.activity}</div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Meeting Point */}
          <motion.div
            className="bg-gradient-to-r from-green-100 to-green-200 rounded-3xl p-6"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 1.2 }}
          >
            <h3 className="font-bold text-gray-800 mb-4 flex items-center">
              <span className="text-2xl mr-2">📍</span>
              Punto di incontro
            </h3>
            <div className="bg-white/60 rounded-xl p-4">
              <p className="font-medium text-gray-700">{tour.meetingPoint}</p>
              <Link href="/explore">
                <motion.button
                  className="mt-3 bg-green-500 text-white px-4 py-2 rounded-xl font-medium hover:bg-green-600 transition-colors flex items-center space-x-2"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Navigation className="w-4 h-4" />
                  <span>🗺️ Apri mappa</span>
                </motion.button>
              </Link>
            </div>
          </motion.div>

          {/* What's Included */}
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 gap-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1.4 }}
          >
            <div className="bg-white/80 rounded-2xl p-6">
              <h4 className="font-bold text-gray-800 mb-4 flex items-center">
                <span className="text-xl mr-2">✅</span>
                Incluso
              </h4>
              <div className="space-y-2">
                {tour.included.map((item, index) => (
                  <motion.div
                    key={index}
                    className="flex items-center space-x-2"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.6, delay: 1.6 + index * 0.1 }}
                  >
                    <div className="w-2 h-2 bg-green-400 rounded-full" />
                    <span className="text-gray-700">{item}</span>
                  </motion.div>
                ))}
              </div>
            </div>
            
            <div className="bg-white/80 rounded-2xl p-6">
              <h4 className="font-bold text-gray-800 mb-4 flex items-center">
                <span className="text-xl mr-2">❌</span>
                Non incluso
              </h4>
              <div className="space-y-2">
                {tour.notIncluded.map((item, index) => (
                  <motion.div
                    key={index}
                    className="flex items-center space-x-2"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.6, delay: 1.8 + index * 0.1 }}
                  >
                    <div className="w-2 h-2 bg-red-400 rounded-full" />
                    <span className="text-gray-700">{item}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Action Buttons */}
          <motion.div
            className="flex space-x-4"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 2 }}
          >
            {tour.live ? (
              <Link href="/tour-live" className="flex-1">
                <motion.button
                  className="w-full bg-gradient-to-r from-red-400 to-red-500 text-white py-4 rounded-2xl font-bold text-lg shadow-xl hover:shadow-2xl transition-all duration-300 flex items-center justify-center space-x-2"
                  whileHover={{ scale: 1.05, rotateX: 5 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Play className="w-6 h-6" />
                  <span>🔴 Entra LIVE Ora</span>
                </motion.button>
              </Link>
            ) : (
              <motion.button
                onClick={() => setShowBooking(true)}
                className="flex-1 bg-gradient-to-r from-terracotta-400 to-terracotta-500 text-white py-4 rounded-2xl font-bold text-lg shadow-xl hover:shadow-2xl transition-all duration-300 flex items-center justify-center space-x-2"
                whileHover={{ scale: 1.05, rotateX: 5 }}
                whileTap={{ scale: 0.95 }}
              >
                <Calendar className="w-6 h-6" />
                <span>📅 Prenota Ora</span>
              </motion.button>
            )}
          </motion.div>

          {/* Related Tours */}
          <motion.div
            className="bg-gradient-to-r from-purple-100 to-pink-100 rounded-3xl p-6"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 2.2 }}
          >
            <h3 className="font-bold text-gray-800 mb-4 flex items-center">
              <span className="text-2xl mr-2">🌟</span>
              Potrebbero interessarti anche
            </h3>
            <div className="flex space-x-4 overflow-x-auto">
              {[1, 2, 3].filter(id => id !== tour.id).slice(0, 2).map((relatedId) => (
                <Link key={relatedId} href={`/tour-details/${relatedId}`}>
                  <motion.div
                    className="bg-white/60 rounded-xl p-4 min-w-[200px] cursor-pointer"
                    whileHover={{ scale: 1.05, y: -5 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <img
                      src={tourDetails[relatedId as keyof typeof tourDetails].images[0]}
                      alt=""
                      className="w-full h-24 object-cover rounded-lg mb-3"
                    />
                    <h4 className="font-bold text-sm text-gray-800 mb-1">
                      {tourDetails[relatedId as keyof typeof tourDetails].title}
                    </h4>
                    <div className="text-terracotta-500 font-bold">
                      {tourDetails[relatedId as keyof typeof tourDetails].price}€
                    </div>
                  </motion.div>
                </Link>
              ))}
            </div>
          </motion.div>
        </div>
      </main>

      <BottomNavigation />
      
      {/* Booking Modal */}
      {showBooking && (
        <BookingModal
          tourId={tour.id.toString()}
          tourTitle={tour.title}
          price={tour.price}
          onClose={() => setShowBooking(false)}
          onConfirm={handleBookingConfirm}
        />
      )}
      
      {/* Toast Notifications */}
      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.show}
        onClose={() => setToast({...toast, show: false})}
      />
    </div>
  );
}