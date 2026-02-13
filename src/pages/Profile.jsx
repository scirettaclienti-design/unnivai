import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { User, Mail, MapPin, Heart, Star, Edit, ArrowLeft, Home, Share2, Facebook, Twitter, Instagram, Link as LinkIcon, Eye, ChevronRight, Award, Target, Users, Compass, Search, Map, Clock, ArrowRight, X } from "lucide-react";
import { Link } from "react-router-dom";
import TopBar from "../components/TopBar";
import BottomNavigation from "../components/BottomNavigation";
import { useUserContext } from "../hooks/useUserContext";
import { supabase } from "../lib/supabase";

export default function ProfilePage() {
    const { userId, firstName, city } = useUserContext();
    const [editName, setEditName] = useState(firstName || "Viaggiatore");
    const [selectedTour, setSelectedTour] = useState(null);
    const [showShareModal, setShowShareModal] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const [showExploreZones, setShowExploreZones] = useState(false);

    // Dynamic Data State
    const [stats, setStats] = useState({ tours: 0, guides: 0, rating: 5.0 });
    const [tourHistory, setTourHistory] = useState([]);

    // Sync local state when context loads real name
    useEffect(() => {
        if (firstName && firstName !== 'Ospite') {
            setEditName(firstName);
        }
    }, [firstName]);

    useEffect(() => {
        if (!userId) return;

        const fetchProfileData = async () => {
            try {
                // 1. Fetch Stats from Explorers
                const { data: explorer, error: explorerError } = await supabase
                    .from('explorers')
                    .select('tours_completed, km_walked') // Add other fields if available
                    .eq('id', userId)
                    .single();

                if (!explorerError && explorer) {
                    setStats(prev => ({
                        ...prev,
                        tours: explorer.tours_completed || 0,
                        // Guides and Rating could be fetched if tables exist, keeping mocks/defaults for now or could query 'follows' table
                    }));
                }

                // 2. Fetch Memories (Photos joined with Tours)
                const { data: photos, error: photoError } = await supabase
                    .from('user_photos')
                    .select(`
                        id,
                        media_url,
                        created_at,
                        tour_id,
                        tours (
                            id,
                            title,
                            city,
                            rating,
                            duration
                        )
                    `)
                    .eq('user_id', userId)
                    .order('created_at', { ascending: false });

                if (photoError) console.error("Error fetching photos:", photoError);

                if (photos && photos.length > 0) {
                    // Group photos by Tour ID to reconstruct "History"
                    const historyMap = {};

                    photos.forEach(photo => {
                        const tour = photo.tours;
                        if (!tour) return; // Skip orphaned photos

                        if (!historyMap[tour.id]) {
                            historyMap[tour.id] = {
                                id: tour.id,
                                title: tour.title || "Tour Senza Nome",
                                location: tour.city || "Italia",
                                date: new Date(photo.created_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' }),
                                rating: tour.rating || 5, // Fallback rating
                                image: photo.media_url, // Use first found photo as cover
                                duration: tour.duration || "2 ore", // Fallback
                                guide: "Guide Expert", // Mock for now
                                highlights: ["Esperienza Autentica", "Vista Panoramica"], // Mock
                                description: `Hai esplorato ${tour.city || 'questo luogo'} catturando ${photos.filter(p => p.tour_id === tour.id).length} momenti speciali.`,
                                photos: []
                            };
                        }
                        historyMap[tour.id].photos.push(photo.media_url);
                    });

                    setTourHistory(Object.values(historyMap));
                } else {
                    setTourHistory([]); // clear if no photos
                }

            } catch (err) {
                console.error("Profile fetch error:", err);
            }
        };

        fetchProfileData();
    }, [userId]);

    const shareTour = (platform, tour) => {
        const message = `Ho appena completato un fantastico tour: "${tour.title}" a ${tour.location}! 🌟 Rating: ${tour.rating}/5 ⭐`;
        const url = window.location.href;

        switch (platform) {
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
                    <Link to="/dashboard-user">
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
                        <div className="w-16 h-16 bg-gradient-to-br from-terracotta-400 to-terracotta-600 rounded-full flex items-center justify-center shadow-md border-2 border-white">
                            <User className="text-white w-8 h-8" />
                        </div>
                        <div className="flex-1">
                            <h2 className="text-xl font-bold text-gray-800">{editName}</h2>
                            <p className="text-gray-600 flex items-center text-sm mb-1">
                                <Mail className="w-3 h-3 mr-1 text-terracotta-500" />
                                {firstName?.toLowerCase()}@unnivai.it
                            </p>
                            <p className="text-gray-600 flex items-center text-sm">
                                <MapPin className="w-3 h-3 mr-1 text-terracotta-500" />
                                {city || 'Italia'}
                            </p>
                        </div>
                    </div>

                    {/* Simplified Stats */}
                    <div className="flex justify-around pt-4 border-t border-gray-200">
                        <div className="text-center">
                            <div className="text-lg font-bold text-terracotta-600">{stats.tours}</div>
                            <div className="text-xs text-gray-600">Tour</div>
                        </div>
                        <div className="text-center">
                            <div className="text-lg font-bold text-terracotta-600">{stats.guides}</div>
                            <div className="text-xs text-gray-600">Guide</div>
                        </div>
                        <div className="text-center">
                            <div className="text-lg font-bold text-terracotta-600">{stats.rating}</div>
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
                    <div className="grid grid-cols-2 gap-4">
                        <motion.button
                            onClick={() => setShowResults(!showResults)}
                            className={`p-4 rounded-2xl shadow-lg relative overflow-hidden transition-all border ${showResults ? 'bg-yellow-500 text-white border-yellow-400 ring-2 ring-yellow-300' : 'bg-white text-gray-800 border-gray-100'}`}
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-2xl filter drop-shadow">🏆</span>
                                <Award className={`w-5 h-5 ${showResults ? 'text-white' : 'text-yellow-500'}`} />
                            </div>
                            <h4 className={`font-bold text-sm ${showResults ? 'text-white' : 'text-gray-800'}`}>I Miei Risultati</h4>
                            <p className={`text-[10px] mt-1 ${showResults ? 'text-yellow-100' : 'text-gray-500'}`}>Visualizza statistiche</p>
                        </motion.button>

                        <motion.button
                            onClick={() => setShowExploreZones(!showExploreZones)}
                            className={`p-4 rounded-2xl shadow-lg relative overflow-hidden transition-all border ${showExploreZones ? 'bg-green-600 text-white border-green-500 ring-2 ring-green-300' : 'bg-white text-gray-800 border-gray-100'}`}
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-2xl filter drop-shadow">🗺️</span>
                                <Map className={`w-5 h-5 ${showExploreZones ? 'text-white' : 'text-green-600'}`} />
                            </div>
                            <h4 className={`font-bold text-sm ${showExploreZones ? 'text-white' : 'text-gray-800'}`}>Esplora Zone</h4>
                            <p className={`text-[10px] mt-1 ${showExploreZones ? 'text-green-100' : 'text-gray-500'}`}>Scopri nuove mete</p>
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
                                <div className="bg-white p-4 rounded-xl border border-yellow-100 shadow-sm flex items-center justify-between">
                                    <div className="flex items-center space-x-3">
                                        <div className="bg-yellow-100 p-2 rounded-full">
                                            <span className="text-xl">🏅</span>
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-gray-800 text-sm">Esploratore Veterano</h4>
                                            <p className="text-xs text-gray-500">Completati 10+ tour</p>
                                        </div>
                                    </div>
                                    <div className="h-2 w-16 bg-gray-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-yellow-400 w-full" />
                                    </div>
                                </div>

                                <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm flex items-center justify-between">
                                    <div className="flex items-center space-x-3">
                                        <div className="bg-blue-100 p-2 rounded-full">
                                            <span className="text-xl">🎭</span>
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-gray-800 text-sm">Amante della Cultura</h4>
                                            <p className="text-xs text-gray-500">5+ tour culturali</p>
                                        </div>
                                    </div>
                                    <div className="h-2 w-16 bg-gray-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-blue-400 w-3/4" />
                                    </div>
                                </div>

                                <div className="bg-white p-4 rounded-xl border border-green-100 shadow-sm flex items-center justify-between">
                                    <div className="flex items-center space-x-3">
                                        <div className="bg-green-100 p-2 rounded-full">
                                            <span className="text-xl">⭐</span>
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-gray-800 text-sm">Guida Esperta</h4>
                                            <p className="text-xs text-gray-500">Rating medio 4.8/5</p>
                                        </div>
                                    </div>
                                    <div className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded">Top 10%</div>
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
                                    <Link key={zone.name} to="/explore">
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
                            <Link to="/photos">
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
                                    {/* Foto del tour - Mini carousel (Reduced & Styled) */}
                                    <div className="relative mt-2">
                                        <div className="flex items-center justify-between mb-2">
                                            <h5 className="text-xs font-bold text-gray-700 flex items-center">
                                                📸 Ricordi ({tour.photos.length})
                                            </h5>
                                        </div>
                                        <div className="flex gap-2 pb-1 overflow-x-hidden">
                                            {/* Show only first 3 photos for cleaner look */}
                                            {tour.photos.slice(0, 3).map((photo, photoIndex) => (
                                                <motion.div
                                                    key={photoIndex}
                                                    className="flex-shrink-0 relative group cursor-pointer overflow-hidden rounded-xl w-20 h-20 shadow-sm border border-white"
                                                    whileHover={{ scale: 1.05, rotate: photoIndex % 2 === 0 ? 2 : -2 }}
                                                    whileTap={{ scale: 0.95 }}
                                                    onClick={() => setSelectedTour(tour)}
                                                >
                                                    <img
                                                        src={photo}
                                                        alt={`Ricordo ${photoIndex + 1}`}
                                                        className="w-full h-full object-cover"
                                                    />
                                                    <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors" />
                                                </motion.div>
                                            ))}

                                            {/* "See All" Tile */}
                                            <motion.div
                                                className="flex-shrink-0 w-20 h-20 bg-gray-50 rounded-xl flex flex-col items-center justify-center cursor-pointer border-2 border-dashed border-gray-200 hover:border-terracotta-300 hover:bg-terracotta-50 transition-colors"
                                                whileHover={{ scale: 1.05 }}
                                                whileTap={{ scale: 0.95 }}
                                                onClick={() => setSelectedTour(tour)}
                                            >
                                                <span className="text-gray-400 font-bold text-xs">+{tour.photos.length - 3}</span>
                                            </motion.div>
                                        </div>
                                    </div>

                                    {/* Buttons - Redesigned for Premium Cleanliness */}
                                    <div className="flex items-center gap-2 pt-3 mt-2 border-t border-gray-100/50">
                                        <motion.button
                                            onClick={() => setSelectedTour(tour)}
                                            className="flex-1 bg-gray-50 text-gray-700 hover:bg-terracotta-50 hover:text-terracotta-600 border border-gray-200 hover:border-terracotta-200 px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 group"
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                        >
                                            <Eye className="w-3.5 h-3.5 text-gray-400 group-hover:text-terracotta-500 transition-colors" />
                                            <span>Rivivi Ricordo</span>
                                        </motion.button>

                                        <motion.button
                                            onClick={() => {
                                                setSelectedTour(tour);
                                                setShowShareModal(true);
                                            }}
                                            className="p-2.5 rounded-xl border border-transparent hover:bg-gray-50 text-gray-400 hover:text-gray-600 transition-colors"
                                            whileHover={{ scale: 1.1, rotate: 5 }}
                                            whileTap={{ scale: 0.9 }}
                                        >
                                            <Share2 className="w-4 h-4" />
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
                            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.3, ease: "easeInOut" }}
                            onClick={() => setSelectedTour(null)}
                        >
                            <motion.div
                                className="bg-white rounded-3xl w-full max-w-sm max-h-[85vh] overflow-y-auto overflow-x-hidden shadow-2xl relative"
                                initial={{ scale: 0.9, opacity: 0, y: 100 }}
                                animate={{ scale: 1, opacity: 1, y: 0 }}
                                exit={{ scale: 0.95, opacity: 0, y: 50 }}
                                transition={{
                                    type: "spring",
                                    damping: 25,
                                    stiffness: 350,
                                    mass: 0.5
                                }}
                                onClick={(e) => e.stopPropagation()}
                            >
                                {/* Hero Image Header */}
                                <div className="relative h-72">
                                    <img
                                        src={selectedTour.image}
                                        alt={selectedTour.title}
                                        className="w-full h-full object-cover"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                                    {/* Floating Close Button */}
                                    <button
                                        onClick={() => setSelectedTour(null)}
                                        className="absolute top-4 right-4 p-2 rounded-full bg-black/20 backdrop-blur-md text-white border border-white/20 hover:bg-black/40 transition-all"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>

                                    {/* Title & Location Overlay */}
                                    <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                                        <div className="flex items-center space-x-1 text-terracotta-300 text-xs font-bold uppercase tracking-wider mb-2">
                                            <MapPin className="w-3 h-3" />
                                            <span>{selectedTour.location}</span>
                                        </div>
                                        <h3 className="text-2xl font-bold leading-tight mb-2 shadow-sm">{selectedTour.title}</h3>
                                        <div className="flex items-center space-x-2 text-xs text-white/90">
                                            <div className="flex">
                                                {Array.from({ length: 5 }).map((_, i) => (
                                                    <Star
                                                        key={i}
                                                        className={`w-3 h-3 ${i < selectedTour.rating ? 'text-yellow-400 fill-current' : 'text-gray-400'}`}
                                                    />
                                                ))}
                                            </div>
                                            <span>•</span>
                                            <span>{selectedTour.date}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Content Body */}
                                <div className="p-6 space-y-6">
                                    {/* Stats Grid */}
                                    <div className="flex items-center justify-between bg-gray-50 rounded-2xl p-4 border border-gray-100">
                                        <div className="flex items-center space-x-3">
                                            <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
                                                <Clock className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-500 font-medium">Durata</p>
                                                <p className="text-sm font-bold text-gray-800">{selectedTour.duration}</p>
                                            </div>
                                        </div>
                                        <div className="w-px h-8 bg-gray-200" />
                                        <div className="flex items-center space-x-3">
                                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                                                <User className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-500 font-medium">Guida</p>
                                                <p className="text-sm font-bold text-gray-800">{selectedTour.guide}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Description */}
                                    <div>
                                        <h4 className="font-bold text-gray-800 mb-2 flex items-center">
                                            <span className="text-lg mr-2">📝</span> Descrizione
                                        </h4>
                                        <p className="text-sm text-gray-600 leading-relaxed min-h-[60px]">
                                            {selectedTour.description}
                                        </p>
                                    </div>

                                    {/* Highlights Chips */}
                                    <div>
                                        <h4 className="font-bold text-gray-800 mb-3 flex items-center">
                                            <span className="text-lg mr-2">✨</span> Highlights
                                        </h4>
                                        <div className="flex flex-wrap gap-2">
                                            {selectedTour.highlights.map((highlight, index) => (
                                                <span
                                                    key={index}
                                                    className="px-3 py-1.5 bg-terracotta-50 text-terracotta-700 rounded-lg text-xs font-semibold border border-terracotta-100 flex items-center"
                                                >
                                                    <Target className="w-3 h-3 mr-1.5" />
                                                    {highlight}
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Gallery Section */}
                                    {selectedTour?.photos && (
                                        <div className="pt-2">
                                            <div className="flex items-center justify-between mb-4">
                                                <h4 className="font-bold text-gray-800 flex items-center">
                                                    <span className="text-lg mr-2">📸</span>
                                                    Gallery
                                                </h4>
                                                <Link to="/photos" className="text-xs font-bold text-terracotta-500 hover:text-terracotta-600 flex items-center group">
                                                    Vedi tutte
                                                    <ChevronRight className="w-3 h-3 ml-0.5 group-hover:translate-x-0.5 transition-transform" />
                                                </Link>
                                            </div>

                                            <div className="grid grid-cols-2 gap-3 mb-6">
                                                {/* Main Featured Photo */}
                                                {selectedTour.photos[0] && (
                                                    <motion.div
                                                        className="col-span-2 relative h-48 rounded-2xl overflow-hidden shadow-md cursor-pointer group"
                                                        whileHover={{ scale: 1.01 }}
                                                        transition={{ duration: 0.2 }}
                                                    >
                                                        <img
                                                            src={selectedTour.photos[0]}
                                                            alt="Main photo"
                                                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                                        />
                                                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                                        <div className="absolute top-2 right-2 bg-black/40 backdrop-blur-sm px-2 py-1 rounded-lg">
                                                            <p className="text-white text-[10px] font-bold">Featured</p>
                                                        </div>
                                                    </motion.div>
                                                )}

                                                {/* Secondary Photos Grid */}
                                                {selectedTour.photos.slice(1, 4).map((photo, index) => (
                                                    <motion.div
                                                        key={index}
                                                        className="relative h-24 rounded-xl overflow-hidden shadow-sm cursor-pointer group"
                                                        whileHover={{ scale: 1.05 }}
                                                    >
                                                        <img
                                                            src={photo}
                                                            alt={`Gallery ${index}`}
                                                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                                        />
                                                    </motion.div>
                                                ))}

                                                {/* "More" Card */}
                                                {selectedTour.photos.length > 4 && (
                                                    <Link to="/photos">
                                                        <motion.div
                                                            className="relative h-24 bg-gray-50 rounded-xl overflow-hidden shadow-sm flex flex-col items-center justify-center cursor-pointer border border-gray-100 hover:bg-terracotta-50 hover:border-terracotta-200 transition-all group"
                                                            whileHover={{ scale: 1.05 }}
                                                        >
                                                            <span className="font-bold text-terracotta-600 text-lg group-hover:scale-110 transition-transform">+{selectedTour.photos.length - 4}</span>
                                                            <span className="text-[10px] text-gray-400 group-hover:text-terracotta-400">altre foto</span>
                                                        </motion.div>
                                                    </Link>
                                                )}
                                            </div>

                                            <Link to="/photos">
                                                <motion.button
                                                    className="w-full py-3.5 bg-gradient-to-r from-gray-900 to-gray-800 text-white rounded-xl text-sm font-bold shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all flex items-center justify-center gap-2 group"
                                                    whileTap={{ scale: 0.98 }}
                                                >
                                                    Visualizza Album Completo
                                                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                                </motion.button>
                                            </Link>
                                        </div>
                                    )}
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
