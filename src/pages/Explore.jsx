import { motion } from "framer-motion";
import { useState } from "react";
import { MapPin, Star, Clock, Users, Search, Calendar, Map, Heart, ArrowLeft, ArrowRight, Filter } from "lucide-react";
import { Link } from "react-router-dom";
import TopBar from "@/components/TopBar";
import BottomNavigation from "@/components/BottomNavigation";
import UnnivaiMap from "@/components/UnnivaiMap";

const sampleExperiences = [
    {
        id: 1,
        title: "Tour delle Cantine Chiantigiane",
        location: "Siena, Toscana",
        duration: "4 ore",
        rating: 4.8,
        participants: 12,
        price: 85,
        image: "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=600&h=400&fit=crop&q=80",
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
        image: "https://images.unsplash.com/photo-1523906834658-6e24ef2386f9?w=600&h=400&fit=crop&q=80",
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
        image: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=600&h=400&fit=crop&q=80",
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
        image: "https://images.unsplash.com/photo-1516483638261-f4dbaf036963?w=600&h=400&fit=crop&q=80",
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
        image: "https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=600&h=400&fit=crop&q=80",
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
        image: "https://images.unsplash.com/photo-1514890547357-a9ee288728e0?w=600&h=400&fit=crop&q=80",
        category: "Romantico"
    },
    {
        id: 7,
        title: "Laboratorio di Ceramica Umbra",
        location: "Deruta, Umbria",
        duration: "2 ore",
        rating: 4.8,
        participants: 6,
        price: 55,
        image: "https://images.unsplash.com/photo-1610701596007-11502861dcfa?w=600&h=400&fit=crop&q=80",
        category: "Arte e Cultura"
    },
    {
        id: 8,
        title: "Escursione sull'Etna",
        location: "Catania, Sicilia",
        duration: "6 ore",
        rating: 4.9,
        participants: 12,
        price: 90,
        image: "https://images.unsplash.com/photo-1533038590840-1cde6e668a91?w=600&h=400&fit=crop&q=80",
        category: "Natura e Avventura"
    },
    {
        id: 9,
        title: "Street Food Tour Palermo",
        location: "Palermo, Sicilia",
        duration: "3 ore",
        rating: 4.7,
        participants: 15,
        price: 40,
        image: "https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?w=600&h=400&fit=crop&q=80",
        category: "Vino e Gastronomia"
    },
    {
        id: 10,
        title: "I Sassi di Matera al Tramonto",
        location: "Matera, Basilicata",
        duration: "2.5 ore",
        rating: 4.9,
        participants: 20,
        price: 35,
        image: "https://images.unsplash.com/photo-1504198266287-1659872e6597?w=600&h=400&fit=crop&q=80",
        category: "Storia e Cultura"
    }
];

const categories = ["Tutti", "Gastronomia", "Cultura", "Natura", "Arte", "Romantico"];

export default function ExplorePage() {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedDate, setSelectedDate] = useState('');
    const [activeFilter, setActiveFilter] = useState("Tutti");

    // Initialize favorites from localStorage
    const [favoriteItems, setFavoriteItems] = useState(() => {
        const saved = localStorage.getItem('unnivai_favorites');
        return saved ? new Set(JSON.parse(saved)) : new Set();
    });

    const [visibleCount, setVisibleCount] = useState(4); // Start with 4 items visible

    const toggleFavorite = (id) => {
        const newFavorites = new Set(favoriteItems);
        if (newFavorites.has(id)) {
            newFavorites.delete(id);
        } else {
            newFavorites.add(id);
        }
        setFavoriteItems(newFavorites);
        // Persist to localStorage
        localStorage.setItem('unnivai_favorites', JSON.stringify([...newFavorites]));
    };

    const filteredExperiences = sampleExperiences.filter(exp => {
        // Search Filter
        const matchesSearch = exp.title.toLowerCase().includes(searchQuery.toLowerCase());

        // Category Filter
        let matchesCategory = true;
        if (activeFilter !== "Tutti") {
            matchesCategory = exp.category.includes(activeFilter);
        }

        return matchesSearch && matchesCategory;
    });

    return (
        <div className="min-h-screen bg-gradient-to-b from-ochre-50 to-ochre-100 font-quicksand">
            <TopBar />

            <main className="max-w-md mx-auto px-4 py-8 pb-32">
                {/* Header Section */}
                <motion.div
                    className="mb-6"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                >
                    <Link to="/" className="inline-flex items-center text-gray-500 text-sm mb-4 hover:text-black transition-colors">
                        <ArrowLeft size={16} className="mr-1" /> Torna alla Home
                    </Link>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Esplora</h1>
                    <p className="text-gray-600">Le migliori esperienze autentiche in Italia.</p>
                </motion.div>

                {/* Search & Date */}
                <motion.div
                    className="space-y-3 mb-8"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.1 }}
                >
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input
                            type="text"
                            placeholder="Cerca attività, luoghi..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-12 pr-4 py-4 bg-white rounded-2xl shadow-sm border border-gray-100 focus:outline-none focus:ring-2 focus:ring-black/5"
                        />
                    </div>
                    <div className="relative">
                        <Calendar className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-white/50 rounded-xl border border-transparent focus:bg-white focus:outline-none focus:ring-2 focus:ring-black/5 text-sm text-gray-600"
                        />
                    </div>
                </motion.div>

                {/* Map Preview Section - Click to Expand */}
                <motion.div
                    className="mb-8"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                >
                    <div className="flex justify-between items-end mb-3 px-1">
                        <h2 className="font-bold text-lg text-gray-800">Mappa Interattiva</h2>
                        <Link to="/map" className="text-xs font-bold text-terracotta-600 hover:underline">Apri a schermo intero</Link>
                    </div>

                    {/* The entire card is now a link to the full map */}
                    <Link to="/map">
                        <div className="h-64 rounded-3xl overflow-hidden shadow-xl border-4 border-white relative group cursor-pointer transform transition-transform hover:scale-[1.02]">
                            <div className="absolute inset-0 z-0 pointer-events-none">
                                <UnnivaiMap
                                    height="100%"
                                    width="100%"
                                    zoom={11} // Slightly zoomed out to show more context
                                    interactive={false} // Disable interaction so the click goes to the parent Link
                                    showUserLocation={false}
                                    initialLat={41.9028}
                                    initialLng={12.4964}
                                    activities={sampleExperiences.map((e, idx) => ({
                                        id: `${e.id}`,
                                        latitude: 41.9028 + (idx * 0.02) - 0.05,
                                        longitude: 12.4964 + (idx * 0.02) - 0.05,
                                        name: e.title,
                                        category: 'culture',
                                        level: 'base'
                                    }))}
                                />
                            </div>

                            {/* Overlay Gradient for better text visibility if needed, or just interactions */}
                            <div className="absolute inset-0 bg-black/5 group-hover:bg-black/0 transition-colors pointer-events-none" />

                            {/* Floating CTA Button */}
                            <div className="absolute bottom-4 right-4 z-10">
                                <span
                                    className="bg-white/90 backdrop-blur text-gray-800 px-4 py-2 rounded-full font-bold shadow-lg text-xs flex items-center gap-2 group-hover:scale-105 transition-transform"
                                >
                                    <Map size={14} /> Espandi Mappa
                                </span>
                            </div>
                        </div>
                    </Link>
                </motion.div>

                {/* Filter Pills */}
                <motion.div
                    className="mb-6 overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.6, delay: 0.3 }}
                >
                    <div className="flex space-x-2">
                        {categories.map((cat) => (
                            <button
                                key={cat}
                                onClick={() => setActiveFilter(cat)}
                                className={`px-5 py-2.5 rounded-full text-sm font-bold whitespace-nowrap transition-all ${activeFilter === cat
                                    ? 'bg-black text-white shadow-lg transform scale-105'
                                    : 'bg-white text-gray-600 border border-gray-100'
                                    }`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </motion.div>

                {/* Experiences List */}
                <div className="space-y-6">
                    {filteredExperiences.slice(0, visibleCount).map((experience, index) => (
                        <motion.div
                            key={experience.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.1 * index }}
                        >
                            <Link to={`/tour-details/${experience.id}`} state={{ tourData: experience }}>
                                <div className="group bg-white rounded-3xl p-3 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                                    {/* Image Container */}
                                    <div className="relative h-48 rounded-2xl overflow-hidden mb-3">
                                        <div className="absolute inset-0 bg-gray-200 animate-pulse" /> {/* Placeholder */}
                                        <img
                                            src={experience.image}
                                            alt={experience.title}
                                            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                        />

                                        {/* Badges */}
                                        <div className="absolute top-3 right-3 bg-white/95 backdrop-blur px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-sm">
                                            <Star size={12} className="text-yellow-400 fill-current" /> {experience.rating}
                                        </div>

                                        <button
                                            onClick={(e) => { e.preventDefault(); toggleFavorite(experience.id); }}
                                            className="absolute top-3 left-3 p-2.5 bg-black/20 backdrop-blur-md rounded-full text-white hover:bg-white hover:text-red-500 transition-all shadow-sm"
                                        >
                                            <Heart size={16} className={favoriteItems.has(experience.id) ? "fill-red-500 text-red-500" : ""} />
                                        </button>

                                        <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur px-3 py-1 rounded-lg text-white text-[10px] font-bold uppercase tracking-wide">
                                            {experience.category}
                                        </div>
                                    </div>

                                    {/* Content */}
                                    <div className="px-2 pb-2">
                                        <div className="flex justify-between items-start mb-2">
                                            <h3 className="font-bold text-gray-900 text-lg leading-tight w-2/3">{experience.title}</h3>
                                            <div className="flex flex-col items-end">
                                                <span className="text-lg font-bold text-gray-900">€{experience.price}</span>
                                                <span className="text-[10px] text-gray-400 line-through">€{Math.round(experience.price * 1.2)}</span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4 text-xs text-gray-500 mb-4">
                                            <span className="flex items-center gap-1">
                                                <Clock size={14} className="text-gray-400" /> {experience.duration}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <MapPin size={14} className="text-gray-400" /> {experience.location.split(',')[0]}
                                            </span>
                                        </div>

                                        <button className="w-full py-3 rounded-xl bg-gray-50 text-gray-900 font-bold text-sm group-hover:bg-black group-hover:text-white transition-colors flex items-center justify-center gap-2">
                                            Vedi Dettagli <ArrowRight size={16} />
                                        </button>
                                    </div>
                                </div>
                            </Link>
                        </motion.div>
                    ))}
                </div>

                {filteredExperiences.length === 0 && (
                    <div className="text-center py-12 opacity-50">
                        <p>{activeFilter === "Preferiti" ? "Non hai ancora aggiunto preferiti." : "Nessuna esperienza trovata."}</p>
                    </div>
                )}

                {/* Load More Button */}
                {visibleCount < filteredExperiences.length && (
                    <div className="mt-8 text-center">
                        <button
                            onClick={() => setVisibleCount(prev => prev + 4)}
                            className="bg-white border border-gray-200 text-gray-800 px-8 py-3 rounded-full font-bold shadow-sm hover:bg-gray-50 hover:shadow-md transition-all active:scale-95"
                        >
                            Carica altro
                        </button>
                    </div>
                )}
            </main>

            <BottomNavigation />
        </div>
    );
}
