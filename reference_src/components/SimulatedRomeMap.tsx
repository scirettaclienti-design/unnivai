import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MapPin, Clock, Users, Star, ZoomIn, ZoomOut, RotateCcw, Maximize2, Euro, Calendar, Phone, Share2, Heart, Camera, Navigation } from 'lucide-react';

interface TourPin {
  id: number;
  name: string;
  x: number;
  y: number;
  tours: number;
  category: string;
  color: string;
  description: string;
  price: string;
  duration: string;
  rating: number;
  reviews: number;
  highlights: string[];
  included: string[];
  meetingPoint: string;
  language: string[];
  difficulty: string;
  maxParticipants: number;
  image: string;
  guide: {
    name: string;
    rating: number;
    experience: string;
  };
}

const romeTours: TourPin[] = [
  {
    id: 1,
    name: "Colosseo & Foro Romano",
    x: 70,
    y: 45,
    tours: 8,
    category: "Storia",
    color: "red",
    description: "Immergiti nella grandezza dell'antica Roma attraverso i corridoi dove gladiatori combattevano per la gloria",
    price: "€25",
    duration: "3 ore",
    rating: 4.8,
    reviews: 1247,
    highlights: ["Arena dei gladiatori", "Sotterranei del Colosseo", "Foro Romano", "Palatino", "Casa di Augusto"],
    included: ["Guida esperta", "Biglietti skip-the-line", "Auricolari", "Mappa dettagliata"],
    meetingPoint: "Metro Colosseo, Uscita Via dei Fori Imperiali",
    language: ["Italiano", "Inglese", "Spagnolo"],
    difficulty: "Facile",
    maxParticipants: 25,
    image: "https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=400&h=300&fit=crop",
    guide: {
      name: "Marco Aurelio",
      rating: 4.9,
      experience: "Archeologo con 15 anni di esperienza"
    }
  },
  {
    id: 2,
    name: "Vaticano & San Pietro",
    x: 25,
    y: 35,
    tours: 12,
    category: "Arte",
    color: "purple",
    description: "Scopri i capolavori di Michelangelo nella Cappella Sistina e i tesori dei Musei Vaticani",
    price: "€35",
    duration: "4 ore",
    rating: 4.9,
    reviews: 2156,
    highlights: ["Cappella Sistina", "Basilica San Pietro", "Musei Vaticani", "Pietà di Michelangelo", "Stanze di Raffaello"],
    included: ["Biglietti prioritari", "Guida certificata", "Auricolari wireless", "Accesso esclusivo"],
    meetingPoint: "Via dei Bastioni di Michelangelo, 5",
    language: ["Italiano", "Inglese", "Francese", "Tedesco"],
    difficulty: "Medio",
    maxParticipants: 20,
    image: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=300&fit=crop",
    guide: {
      name: "Giulia Vaticani",
      rating: 5.0,
      experience: "Storica dell'arte vaticana"
    }
  },
  {
    id: 3,
    name: "Trastevere Food Tour",
    x: 30,
    y: 65,
    tours: 6,
    category: "Cibo",
    color: "orange",
    description: "Un viaggio culinario attraverso le osterie storiche e i sapori autentici di Trastevere",
    price: "€45",
    duration: "3.5 ore",
    rating: 4.7,
    reviews: 892,
    highlights: ["5 degustazioni locali", "Carbonara originale", "Gelato artigianale", "Vini del Lazio", "Mercato locale"],
    included: ["Tutte le degustazioni", "Bicchiere di vino", "Ricette tradizionali", "Chef locale"],
    meetingPoint: "Piazza Santa Maria in Trastevere",
    language: ["Italiano", "Inglese"],
    difficulty: "Facile",
    maxParticipants: 15,
    image: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=400&h=300&fit=crop",
    guide: {
      name: "Chef Antonio",
      rating: 4.8,
      experience: "Chef romano da 3 generazioni"
    }
  },
  {
    id: 4,
    name: "Pantheon & Centro",
    x: 55,
    y: 55,
    tours: 10,
    category: "Cultura",
    color: "blue",
    description: "Il cuore pulsante di Roma: dalle antiche meraviglie alle piazze barocche più belle del mondo",
    price: "€20",
    duration: "2.5 ore",
    rating: 4.6,
    reviews: 1543,
    highlights: ["Pantheon romano", "Fontana di Trevi", "Piazza Navona", "Campo de' Fiori", "Piazza di Spagna"],
    included: ["Guida locale", "Mappa interattiva", "Accesso prioritario", "Photo tour"],
    meetingPoint: "Pantheon, Piazza della Rotonda",
    language: ["Italiano", "Inglese", "Spagnolo", "Portoghese"],
    difficulty: "Facile",
    maxParticipants: 30,
    image: "https://images.unsplash.com/photo-1531572753322-ad063cecc140?w=400&h=300&fit=crop",
    guide: {
      name: "Elena Romani",
      rating: 4.7,
      experience: "Guida turistica certificata"
    }
  },
  {
    id: 5,
    name: "Villa Borghese",
    x: 75,
    y: 20,
    tours: 4,
    category: "Natura",
    color: "green",
    description: "Arte e natura si fondono nel più bel parco di Roma con capolavori del Bernini e Caravaggio",
    price: "€18",
    duration: "2 ore",
    rating: 4.5,
    reviews: 567,
    highlights: ["Galleria Borghese", "Giardini segreti", "Tempio di Esculapio", "Villa Giulia", "Bioparco"],
    included: ["Biglietti museo", "Guida naturalistica", "Mappa botanica", "Picnic romano"],
    meetingPoint: "Metro Spagna, Uscita Villa Borghese",
    language: ["Italiano", "Inglese"],
    difficulty: "Facile",
    maxParticipants: 18,
    image: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=300&fit=crop",
    guide: {
      name: "Luca Botanico",
      rating: 4.6,
      experience: "Naturalista e storico dell'arte"
    }
  },
  {
    id: 6,
    name: "Campo de' Fiori",
    x: 45,
    y: 60,
    tours: 7,
    category: "Vita Notturna",
    color: "pink",
    description: "Dal mercato storico ai locali notturni: vivi Roma come un vero romano tra storia e movida",
    price: "€30",
    duration: "4 ore",
    rating: 4.4,
    reviews: 734,
    highlights: ["Mercato mattutino", "Aperitivo romano", "Bar storici", "Vita notturna", "Giordano Bruno"],
    included: ["2 aperitivi", "Snacks locali", "Guida notturna", "Lista locali esclusivi"],
    meetingPoint: "Campo de' Fiori, Statua Giordano Bruno",
    language: ["Italiano", "Inglese", "Francese"],
    difficulty: "Medio",
    maxParticipants: 12,
    image: "https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=400&h=300&fit=crop",
    guide: {
      name: "Francesca Notte",
      rating: 4.5,
      experience: "Esperta di vita notturna romana"
    }
  },
  {
    id: 7,
    name: "Castel Sant'Angelo",
    x: 35,
    y: 40,
    tours: 5,
    category: "Storia",
    color: "amber",
    description: "Dall'antico mausoleo di Adriano alla fortezza papale: 2000 anni di storia con vista mozzafiato",
    price: "€15",
    duration: "1.5 ore",
    rating: 4.3,
    reviews: 456,
    highlights: ["Mausoleo di Adriano", "Passetto del Borgo", "Terrazza panoramica", "Prigioni storiche", "Ponte Sant'Angelo"],
    included: ["Biglietto d'ingresso", "Guida storica", "Accesso terrazza", "Audio guida"],
    meetingPoint: "Ponte Sant'Angelo, Lato Vaticano",
    language: ["Italiano", "Inglese"],
    difficulty: "Medio",
    maxParticipants: 20,
    image: "https://images.unsplash.com/photo-1515542622106-78bda8ba0e5b?w=400&h=300&fit=crop",
    guide: {
      name: "Alessandro Storia",
      rating: 4.4,
      experience: "Storico medievale"
    }
  }
];

export default function SimulatedRomeMap() {
  const [selectedTour, setSelectedTour] = useState<TourPin | null>(null);
  const [hoveredTour, setHoveredTour] = useState<number | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 0.3, 4));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 0.3, 0.3));
  };

  const handleReset = () => {
    setZoomLevel(1);
    setPanX(0);
    setPanY(0);
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const getColorClasses = (color: string) => {
    const colors: Record<string, { bg: string; text: string; pulse: string }> = {
      red: { bg: 'bg-red-600', text: 'text-red-600', pulse: 'bg-red-400' },
      purple: { bg: 'bg-purple-600', text: 'text-purple-600', pulse: 'bg-purple-400' },
      orange: { bg: 'bg-orange-600', text: 'text-orange-600', pulse: 'bg-orange-400' },
      blue: { bg: 'bg-blue-600', text: 'text-blue-600', pulse: 'bg-blue-400' },
      green: { bg: 'bg-green-600', text: 'text-green-600', pulse: 'bg-green-400' },
      pink: { bg: 'bg-pink-600', text: 'text-pink-600', pulse: 'bg-pink-400' },
      amber: { bg: 'bg-amber-600', text: 'text-amber-600', pulse: 'bg-amber-400' }
    };
    return colors[color] || colors.red;
  };

  return (
    <div className={`${isFullscreen ? 'fixed inset-0 z-50 bg-black' : 'w-full h-full'} relative overflow-hidden`}>
      {/* Map Controls */}
      <div className="absolute top-4 right-4 z-20 flex flex-col space-y-2">
        <motion.button
          onClick={toggleFullscreen}
          className="p-2 bg-white/90 backdrop-blur-sm rounded-xl shadow-lg hover:bg-white transition-colors"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Maximize2 className="w-5 h-5 text-gray-700" />
        </motion.button>
        
        <motion.button
          onClick={handleZoomIn}
          className="p-2 bg-white/90 backdrop-blur-sm rounded-xl shadow-lg hover:bg-white transition-colors"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <ZoomIn className="w-5 h-5 text-gray-700" />
        </motion.button>
        
        <motion.button
          onClick={handleZoomOut}
          className="p-2 bg-white/90 backdrop-blur-sm rounded-xl shadow-lg hover:bg-white transition-colors"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <ZoomOut className="w-5 h-5 text-gray-700" />
        </motion.button>
        
        <motion.button
          onClick={handleReset}
          className="p-2 bg-white/90 backdrop-blur-sm rounded-xl shadow-lg hover:bg-white transition-colors"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <RotateCcw className="w-5 h-5 text-gray-700" />
        </motion.button>
      </div>
      
      {/* Close fullscreen button */}
      {isFullscreen && (
        <motion.button
          onClick={toggleFullscreen}
          className="absolute top-4 left-4 z-20 p-3 bg-white/90 backdrop-blur-sm rounded-full shadow-lg hover:bg-white transition-colors"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <X className="w-6 h-6 text-gray-700" />
        </motion.button>
      )}

      {/* Simulated Rome Map Background */}
      <motion.div 
        className="w-full h-full bg-gradient-to-br from-amber-50 via-stone-100 to-blue-50 relative cursor-move"
        style={{ 
          scale: zoomLevel,
          x: panX,
          y: panY,
          transformOrigin: 'center center'
        }}
        drag
        dragConstraints={{ left: -200, right: 200, top: -200, bottom: 200 }}
        onDrag={(event, info) => {
          setPanX(info.offset.x);
          setPanY(info.offset.y);
        }}
      >
        {/* River Tiber */}
        <div className="absolute top-16 left-8 w-96 h-8 bg-blue-400 rounded-full transform rotate-12 shadow-lg opacity-70"></div>
        <div className="absolute top-48 left-4 w-80 h-6 bg-blue-300 rounded-full transform rotate-15 shadow-lg opacity-70"></div>
        

        {/* Monumenti di Roma - Disegnati in modo riconoscibile */}
        
        {/* COLOSSEO - Arena ellittica con archi multipli */}
        <motion.div 
          className="absolute"
          style={{ top: '45%', left: '70%', transform: 'translate(-50%, -50%)' }}
          whileHover={{ scale: 1.1 }}
        >
          <div className="w-20 h-16 bg-gradient-to-b from-amber-600 to-amber-800 shadow-2xl" 
               style={{borderRadius: '50% 50% 40% 40%', position: 'relative'}}>
            {/* Archi del Colosseo */}
            <div className="absolute inset-2 border-2 border-amber-900 opacity-70" style={{borderRadius: '50% 50% 40% 40%'}}></div>
            <div className="absolute inset-4 border border-amber-900 opacity-50" style={{borderRadius: '50% 50% 40% 40%'}}></div>
            {/* Archi dettagliati */}
            <div className="absolute top-2 left-2 w-2 h-2 bg-amber-900 rounded-full opacity-60"></div>
            <div className="absolute top-2 right-2 w-2 h-2 bg-amber-900 rounded-full opacity-60"></div>
            <div className="absolute bottom-2 left-2 w-2 h-2 bg-amber-900 rounded-full opacity-60"></div>
            <div className="absolute bottom-2 right-2 w-2 h-2 bg-amber-900 rounded-full opacity-60"></div>
            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 text-xs font-bold bg-amber-900 text-white px-2 py-1 rounded shadow-lg opacity-0 hover:opacity-100 transition-all z-20">
              🏛️ COLOSSEO
            </div>
          </div>
        </motion.div>

        {/* PANTHEON - Cupola perfetta con pronao */}
        <motion.div 
          className="absolute"
          style={{ top: '55%', left: '55%', transform: 'translate(-50%, -50%)' }}
          whileHover={{ scale: 1.1 }}
        >
          <div className="relative">
            {/* Cupola */}
            <div className="w-14 h-14 bg-gradient-to-b from-orange-500 to-orange-700 rounded-full shadow-xl relative">
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-orange-900 rounded-full"></div>
              <div className="absolute inset-2 border border-orange-800 rounded-full opacity-50"></div>
            </div>
            {/* Pronao con colonne */}
            <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-18 h-4 bg-orange-600 rounded-b-lg shadow-lg">
              <div className="absolute bottom-0 left-1 w-1 h-4 bg-orange-800"></div>
              <div className="absolute bottom-0 left-3 w-1 h-4 bg-orange-800"></div>
              <div className="absolute bottom-0 right-3 w-1 h-4 bg-orange-800"></div>
              <div className="absolute bottom-0 right-1 w-1 h-4 bg-orange-800"></div>
            </div>
            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 text-xs font-bold bg-orange-900 text-white px-2 py-1 rounded shadow-lg opacity-0 hover:opacity-100 transition-all z-20">
              🏛️ PANTHEON
            </div>
          </div>
        </motion.div>

        {/* SAN PIETRO - Basilica con cupola michelangiolesca */}
        <motion.div 
          className="absolute"
          style={{ top: '35%', left: '25%', transform: 'translate(-50%, -50%)' }}
          whileHover={{ scale: 1.1 }}
        >
          <div className="relative">
            {/* Cupola principale */}
            <div className="w-12 h-12 bg-gradient-to-b from-yellow-400 to-yellow-600 rounded-full shadow-xl relative">
              <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-2 h-6 bg-yellow-700"></div>
              <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-yellow-300 rounded-full"></div>
            </div>
            {/* Basilica */}
            <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-16 h-6 bg-yellow-500 shadow-lg" style={{borderRadius: '10% 10% 0% 0%'}}>
              <div className="absolute top-1 left-2 w-1 h-4 bg-yellow-700"></div>
              <div className="absolute top-1 right-2 w-1 h-4 bg-yellow-700"></div>
            </div>
            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 text-xs font-bold bg-yellow-800 text-white px-2 py-1 rounded shadow-lg opacity-0 hover:opacity-100 transition-all z-20">
              ⛪ SAN PIETRO
            </div>
          </div>
        </motion.div>

        {/* CASTEL SANT'ANGELO - Mausoleo cilindrico */}
        <motion.div 
          className="absolute"
          style={{ top: '40%', left: '35%', transform: 'translate(-50%, -50%)' }}
          whileHover={{ scale: 1.1 }}
        >
          <div className="relative">
            <div className="w-16 h-16 bg-gradient-to-b from-red-600 to-red-800 rounded-full shadow-xl relative">
              {/* Torre centrale */}
              <div className="absolute top-1 left-1/2 transform -translate-x-1/2 w-4 h-8 bg-red-700 rounded-t-lg"></div>
              <div className="absolute top-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-yellow-400 rounded-full"></div>
              {/* Mura circolari */}
              <div className="absolute inset-2 border-2 border-red-900 rounded-full opacity-60"></div>
              <div className="absolute inset-4 border border-red-900 rounded-full opacity-40"></div>
            </div>
            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 text-xs font-bold bg-red-900 text-white px-2 py-1 rounded shadow-lg opacity-0 hover:opacity-100 transition-all z-20">
              🏰 CASTEL SANT'ANGELO
            </div>
          </div>
        </motion.div>

        {/* FONTANA DI TREVI - Fontana barocca dettagliata */}
        <motion.div 
          className="absolute"
          style={{ top: '50%', left: '58%', transform: 'translate(-50%, -50%)' }}
          whileHover={{ scale: 1.1 }}
        >
          <div className="relative">
            <div className="w-12 h-8 bg-gradient-to-b from-blue-400 to-blue-600 shadow-xl" style={{borderRadius: '30% 30% 60% 60%'}}>
              {/* Getti d'acqua */}
              <div className="absolute top-1 left-2 w-1 h-3 bg-blue-200 opacity-80"></div>
              <div className="absolute top-1 right-2 w-1 h-3 bg-blue-200 opacity-80"></div>
              <div className="absolute top-1 left-1/2 transform -translate-x-1/2 w-1 h-4 bg-blue-100 opacity-90"></div>
              {/* Palazzo di sfondo */}
              <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-14 h-4 bg-stone-400 rounded-t-lg opacity-70"></div>
            </div>
            <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 text-xs font-bold bg-blue-800 text-white px-2 py-1 rounded shadow-lg opacity-0 hover:opacity-100 transition-all z-20">
              ⛲ FONTANA TREVI
            </div>
          </div>
        </motion.div>

        {/* PIAZZA NAVONA - Piazza con obelisco e fontane */}
        <motion.div 
          className="absolute"
          style={{ top: '52%', left: '50%', transform: 'translate(-50%, -50%)' }}
          whileHover={{ scale: 1.1 }}
        >
          <div className="relative">
            <div className="w-16 h-8 bg-gradient-to-b from-stone-300 to-stone-500 shadow-xl rounded-lg">
              {/* Obelisco centrale */}
              <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-1 h-6 bg-stone-700"></div>
              {/* Fontane laterali */}
              <div className="absolute top-2 left-2 w-2 h-2 bg-blue-400 rounded-full"></div>
              <div className="absolute top-2 right-2 w-2 h-2 bg-blue-400 rounded-full"></div>
            </div>
            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 text-xs font-bold bg-stone-700 text-white px-2 py-1 rounded shadow-lg opacity-0 hover:opacity-100 transition-all z-20">
              🗿 PIAZZA NAVONA
            </div>
          </div>
        </motion.div>

        {/* PIAZZA DI SPAGNA - Scalinata famosa */}
        <motion.div 
          className="absolute"
          style={{ top: '45%', left: '60%', transform: 'translate(-50%, -50%)' }}
          whileHover={{ scale: 1.1 }}
        >
          <div className="relative">
            <div className="w-10 h-12 bg-gradient-to-b from-pink-300 to-pink-500 shadow-xl" style={{borderRadius: '20% 20% 0% 0%'}}>
              {/* Scalinata */}
              <div className="absolute bottom-0 left-0 w-10 h-2 bg-pink-600"></div>
              <div className="absolute bottom-2 left-1 w-8 h-2 bg-pink-600"></div>
              <div className="absolute bottom-4 left-2 w-6 h-2 bg-pink-600"></div>
              {/* Chiesa in cima */}
              <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-6 h-4 bg-pink-400 rounded-t-lg"></div>
            </div>
            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 text-xs font-bold bg-pink-700 text-white px-2 py-1 rounded shadow-lg opacity-0 hover:opacity-100 transition-all z-20">
              🪜 SCALINATA SPAGNA
            </div>
          </div>
        </motion.div>

        {/* TRASTEVERE - Quartiere caratteristico */}
        <motion.div 
          className="absolute"
          style={{ top: '65%', left: '30%', transform: 'translate(-50%, -50%)' }}
          whileHover={{ scale: 1.1 }}
        >
          <div className="relative">
            <div className="w-12 h-8 bg-gradient-to-b from-orange-400 to-orange-600 shadow-xl rounded-lg">
              {/* Case tipiche */}
              <div className="absolute top-1 left-1 w-2 h-5 bg-orange-500"></div>
              <div className="absolute top-0 left-4 w-2 h-6 bg-orange-500"></div>
              <div className="absolute top-1 right-1 w-2 h-5 bg-orange-500"></div>
              {/* Finestre */}
              <div className="absolute top-2 left-1.5 w-1 h-1 bg-yellow-300"></div>
              <div className="absolute top-2 left-4.5 w-1 h-1 bg-yellow-300"></div>
              <div className="absolute top-2 right-1.5 w-1 h-1 bg-yellow-300"></div>
            </div>
            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 text-xs font-bold bg-orange-800 text-white px-2 py-1 rounded shadow-lg opacity-0 hover:opacity-100 transition-all z-20">
              🏘️ TRASTEVERE
            </div>
          </div>
        </motion.div>

        {/* VILLA BORGHESE - Parco con museo */}
        <motion.div 
          className="absolute"
          style={{ top: '20%', left: '75%', transform: 'translate(-50%, -50%)' }}
          whileHover={{ scale: 1.1 }}
        >
          <div className="relative">
            <div className="w-14 h-10 bg-gradient-to-b from-green-400 to-green-600 shadow-xl rounded-2xl">
              {/* Villa centrale */}
              <div className="absolute top-2 left-1/2 transform -translate-x-1/2 w-6 h-4 bg-stone-400 rounded-lg"></div>
              {/* Alberi del parco */}
              <div className="absolute top-1 left-1 w-2 h-2 bg-green-700 rounded-full"></div>
              <div className="absolute top-1 right-1 w-2 h-2 bg-green-700 rounded-full"></div>
              <div className="absolute bottom-1 left-2 w-2 h-2 bg-green-700 rounded-full"></div>
              <div className="absolute bottom-1 right-2 w-2 h-2 bg-green-700 rounded-full"></div>
            </div>
            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 text-xs font-bold bg-green-800 text-white px-2 py-1 rounded shadow-lg opacity-0 hover:opacity-100 transition-all z-20">
              🌳 VILLA BORGHESE
            </div>
          </div>
        </motion.div>

        {/* CAMPO DE' FIORI - Piazza con mercato */}
        <motion.div 
          className="absolute"
          style={{ top: '60%', left: '45%', transform: 'translate(-50%, -50%)' }}
          whileHover={{ scale: 1.1 }}
        >
          <div className="relative">
            <div className="w-10 h-10 bg-gradient-to-b from-yellow-400 to-amber-600 shadow-xl rounded-lg">
              {/* Statua di Giordano Bruno */}
              <div className="absolute top-2 left-1/2 transform -translate-x-1/2 w-2 h-4 bg-gray-700 rounded-t-lg"></div>
              {/* Bancarelle del mercato */}
              <div className="absolute bottom-1 left-1 w-2 h-2 bg-red-500 rounded"></div>
              <div className="absolute bottom-1 right-1 w-2 h-2 bg-blue-500 rounded"></div>
            </div>
            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 text-xs font-bold bg-amber-800 text-white px-2 py-1 rounded shadow-lg opacity-0 hover:opacity-100 transition-all z-20">
              🛒 CAMPO DE' FIORI
            </div>
          </div>
        </motion.div>

        {/* Strade principali di Roma */}
        <div className="absolute top-44 left-0 right-0 h-4 bg-gray-300 shadow-lg opacity-60 rounded-full"></div>
        <div className="absolute top-72 left-0 right-0 h-3 bg-gray-300 shadow-lg opacity-60 rounded-full"></div>
        <div className="absolute top-0 bottom-0 left-40 w-3 bg-gray-300 shadow-lg opacity-60 rounded-full"></div>
        <div className="absolute top-0 bottom-0 right-40 w-4 bg-gray-300 shadow-lg opacity-60 rounded-full"></div>
        
        {/* Zone verdi */}
        <div className="absolute top-8 right-16 w-28 h-28 bg-green-400 rounded-full shadow-xl opacity-70"></div>
        <div className="absolute bottom-16 left-16 w-24 h-24 bg-green-400 rounded-full shadow-xl opacity-70"></div>

        {/* Tour Pins */}
        {romeTours.map((tour) => {
          const colorClasses = getColorClasses(tour.color);
          
          return (
            <motion.div
              key={tour.id}
              className="absolute cursor-pointer"
              style={{
                left: `${tour.x}%`,
                top: `${tour.y}%`,
                transform: 'translate(-50%, -50%)'
              }}
              whileHover={{ scale: 1.2 }}
              whileTap={{ scale: 0.9 }}
              onHoverStart={() => setHoveredTour(tour.id)}
              onHoverEnd={() => setHoveredTour(null)}
              onClick={() => setSelectedTour(tour)}
              initial={{ scale: 0, rotate: 180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ 
                delay: tour.id * 0.15,
                type: "spring",
                stiffness: 260,
                damping: 20 
              }}
            >
              <div className="relative">
                {/* Main Pin */}
                <div className={`w-12 h-12 ${colorClasses.bg} rounded-full shadow-2xl border-3 border-white flex items-center justify-center`}>
                  <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center">
                    <span className={`${colorClasses.text} font-bold text-xs`}>
                      {tour.category.charAt(0)}
                    </span>
                  </div>
                </div>

                {/* Pulsing Animation */}
                <motion.div
                  className={`absolute inset-0 ${colorClasses.pulse} rounded-full opacity-30`}
                  animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0, 0.3] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />

                {/* Tour Count Badge */}
                <div className="absolute -bottom-1 -left-1 bg-yellow-500 text-black text-xs font-black px-1.5 py-0.5 rounded-full shadow-lg border border-white">
                  {tour.tours}
                </div>

                {/* Hover Tooltip */}
                {hoveredTour === tour.id && (
                  <motion.div
                    className="absolute -top-16 left-1/2 transform -translate-x-1/2 bg-black text-white px-3 py-2 rounded-lg text-xs whitespace-nowrap z-50 shadow-xl"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <div className="font-semibold">{tour.name}</div>
                    <div className="text-gray-300">{tour.tours} tour disponibili</div>
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-2 h-2 bg-black transform rotate-45"></div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          );
        })}

        {/* Tutorial Instructions */}
        <motion.div
          className="absolute top-4 left-4 bg-white/95 backdrop-blur-sm p-4 rounded-xl shadow-xl max-w-sm z-40"
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 1 }}
        >
          <h3 className="font-bold text-gray-800 mb-2 flex items-center">
            <span className="w-6 h-6 bg-blue-500 rounded-full text-white text-xs flex items-center justify-center mr-2">💡</span>
            Come usare la mappa
          </h3>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• Clicca sui pin colorati per vedere i tour</li>
            <li>• Ogni colore rappresenta una categoria diversa</li>
            <li>• Il numero mostra quanti tour sono disponibili</li>
            <li>• Passa il mouse sui pin per anteprima</li>
          </ul>
        </motion.div>
      </motion.div>

      {/* Tour Detail Modal */}
      <AnimatePresence>
        {selectedTour && (
          <motion.div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedTour(null)}
          >
            <motion.div
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative"
              initial={{ scale: 0.8, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, y: 50 }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setSelectedTour(null)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Header Image */}
              <div className="relative mb-6">
                <img 
                  src={selectedTour.image} 
                  alt={selectedTour.name}
                  className="w-full h-48 object-cover rounded-xl"
                />
                <div className="absolute top-4 left-4 flex space-x-2">
                  <span className={`px-3 py-1 ${getColorClasses(selectedTour.color).bg} text-white text-xs font-bold rounded-full`}>
                    {selectedTour.category}
                  </span>
                  <span className="px-3 py-1 bg-black/70 text-white text-xs font-bold rounded-full">
                    {selectedTour.difficulty}
                  </span>
                </div>
                <div className="absolute bottom-4 right-4 flex space-x-2">
                  <motion.button whileHover={{ scale: 1.1 }} className="p-2 bg-white rounded-full shadow-lg">
                    <Heart className="w-4 h-4 text-red-500" />
                  </motion.button>
                  <motion.button whileHover={{ scale: 1.1 }} className="p-2 bg-white rounded-full shadow-lg">
                    <Share2 className="w-4 h-4 text-blue-500" />
                  </motion.button>
                  <motion.button whileHover={{ scale: 1.1 }} className="p-2 bg-white rounded-full shadow-lg">
                    <Camera className="w-4 h-4 text-green-500" />
                  </motion.button>
                </div>
              </div>

              {/* Title and Rating */}
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-800 mb-2">
                  {selectedTour.name}
                </h2>
                
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <div className="flex items-center">
                      {[...Array(5)].map((_, i) => (
                        <Star 
                          key={i} 
                          className={`w-4 h-4 ${i < Math.floor(selectedTour.rating) ? 'text-yellow-500 fill-current' : 'text-gray-300'}`} 
                        />
                      ))}
                    </div>
                    <span className="font-semibold text-gray-800">{selectedTour.rating}</span>
                    <span className="text-gray-500">({selectedTour.reviews} recensioni)</span>
                  </div>
                  <div className="text-2xl font-bold text-terracotta-600">
                    {selectedTour.price}
                  </div>
                </div>
                
                <p className="text-gray-600 mb-4">
                  {selectedTour.description}
                </p>
              </div>

              {/* Quick Info */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="flex items-center space-x-2">
                  <Clock className="w-5 h-5 text-blue-500" />
                  <div>
                    <div className="font-semibold text-sm">Durata</div>
                    <div className="text-xs text-gray-600">{selectedTour.duration}</div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Users className="w-5 h-5 text-green-500" />
                  <div>
                    <div className="font-semibold text-sm">Max {selectedTour.maxParticipants}</div>
                    <div className="text-xs text-gray-600">partecipanti</div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Navigation className="w-5 h-5 text-orange-500" />
                  <div>
                    <div className="font-semibold text-sm">Lingue</div>
                    <div className="text-xs text-gray-600">{selectedTour.language.join(', ')}</div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <MapPin className="w-5 h-5 text-red-500" />
                  <div>
                    <div className="font-semibold text-sm">Punto incontro</div>
                    <div className="text-xs text-gray-600">Presso metro</div>
                  </div>
                </div>
              </div>

              {/* Highlights */}
              <div className="mb-6">
                <h3 className="font-bold text-gray-800 mb-3">🎯 Cosa vedrai</h3>
                <div className="grid grid-cols-1 gap-2">
                  {selectedTour.highlights.map((highlight, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-terracotta-500 rounded-full"></div>
                      <span className="text-sm text-gray-700">{highlight}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* What's Included */}
              <div className="mb-6">
                <h3 className="font-bold text-gray-800 mb-3">✅ Incluso nel prezzo</h3>
                <div className="grid grid-cols-1 gap-2">
                  {selectedTour.included.map((item, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm text-gray-700">{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Guide Info */}
              <div className="mb-6 p-4 bg-gray-50 rounded-xl">
                <h3 className="font-bold text-gray-800 mb-3">👤 La tua guida</h3>
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold">{selectedTour.guide.name.split(' ').map(n => n[0]).join('')}</span>
                  </div>
                  <div>
                    <div className="font-bold text-gray-800">{selectedTour.guide.name}</div>
                    <div className="text-sm text-gray-600">{selectedTour.guide.experience}</div>
                    <div className="flex items-center">
                      <Star className="w-4 h-4 text-yellow-500 fill-current" />
                      <span className="text-sm font-semibold ml-1">{selectedTour.guide.rating}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Meeting Point */}
              <div className="mb-6 p-4 bg-blue-50 rounded-xl">
                <h3 className="font-bold text-gray-800 mb-2 flex items-center">
                  <MapPin className="w-5 h-5 text-blue-500 mr-2" />
                  Punto di incontro
                </h3>
                <p className="text-sm text-gray-700">{selectedTour.meetingPoint}</p>
                <button className="mt-2 text-xs text-blue-600 hover:text-blue-800 font-semibold">
                  📍 Apri in Google Maps
                </button>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <motion.button 
                  whileHover={{ scale: 1.02 }} 
                  whileTap={{ scale: 0.98 }}
                  className="w-full bg-terracotta-600 hover:bg-terracotta-700 text-white font-bold py-4 px-6 rounded-xl transition-colors shadow-lg"
                >
                  💳 Prenota Ora - {selectedTour.price}
                </motion.button>
                
                <div className="grid grid-cols-2 gap-3">
                  <motion.button 
                    whileHover={{ scale: 1.02 }} 
                    className="flex items-center justify-center space-x-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 px-4 rounded-xl transition-colors"
                  >
                    <Phone className="w-4 h-4" />
                    <span>Contatta</span>
                  </motion.button>
                  
                  <motion.button 
                    whileHover={{ scale: 1.02 }} 
                    className="flex items-center justify-center space-x-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 px-4 rounded-xl transition-colors"
                  >
                    <Calendar className="w-4 h-4" />
                    <span>Altri date</span>
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}