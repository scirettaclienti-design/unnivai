import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, MapPin, Clock, Star, Play, Heart, TrendingUp, Filter, Crown, Flame, Award, Zap, ChevronDown, Share2, Users, Sparkles, Eye, Timer, Calendar, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";
import TopBar from "../components/TopBar";
import BottomNavigation from "../components/BottomNavigation";
import { useQuery } from "@tanstack/react-query";
import { dataService } from "../services/dataService";

const trendingExperiencesMock = [
    {
        id: "trend1",
        title: "Aperitivo al Tramonto sui Tetti",
        description: "L'esperienza più prenotata della settimana. Vista mozzafiato su Piazza Navona.",
        location: "Roma, Piazza Navona",
        price: 35,
        rating: 4.9,
        reviews: 342,
        image: "https://images.unsplash.com/photo-1572116469696-31de0f17cc34?w=400&h=600&fit=crop",
        category: "Food & Drink",
        tags: ["Best Seller", "Sunset", "Esclusivo"],
        trendScore: 98,
        participants: 12,
        maxParticipants: 15,
        host: "Marco Rossi"
    },
    {
        id: "trend2",
        title: "Vespa Tour Cinema",
        description: "Rivivi la Dolce Vita in sella a una Vespa d'epoca. Tour dei set cinematografici.",
        location: "Roma, Centro",
        price: 85,
        rating: 4.95,
        reviews: 156,
        image: "https://images.unsplash.com/photo-1555992336-03a23c7b20ee?w=400&h=600&fit=crop",
        category: "Adventure",
        tags: ["Dolce Vita", "Foto", "Privato"],
        trendScore: 95,
        participants: 2,
        maxParticipants: 4,
        host: "Vespa Club Roma"
    },
    {
        id: "trend3",
        title: "Laboratorio Pasta Fresca",
        description: "Impara a fare la vera carbonara con una nonna romana nel cuore di Trastevere.",
        location: "Roma, Trastevere",
        price: 65,
        rating: 5.0,
        reviews: 203,
        image: "https://images.unsplash.com/photo-1556910103-1c02745a30bf?w=400&h=600&fit=crop",
        category: "Workshop",
        tags: ["Cooking", "Tradizione", "Cena inclusa"],
        trendScore: 92,
        participants: 6,
        maxParticipants: 8,
        host: "Nonna Maria"
    },
    {
        id: "trend4",
        title: "Catacombe Segrete Notturne",
        description: "Un'avventura esclusiva fuori orario nelle catacombe di Priscilla.",
        location: "Roma, Salaria",
        price: 45,
        rating: 4.8,
        reviews: 89,
        image: "https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=400&h=600&fit=crop",
        category: "Culture",
        tags: ["Night", "Mystery", "History"],
        trendScore: 88,
        participants: 15,
        maxParticipants: 20,
        host: "ArcheoRoma"
    },
    {
        id: "trend5",
        title: "Street Art & Wine",
        description: "Tour dei murales di Tor Marancia con degustazione finale in enoteca.",
        location: "Roma, Ostiense",
        price: 30,
        rating: 4.7,
        reviews: 67,
        image: "https://images.unsplash.com/photo-1499916078039-922301b0eb9b?w=400&h=600&fit=crop",
        category: "Art",
        tags: ["Urban", "Wine", "Walking"],
        trendScore: 85,
        participants: 10,
        maxParticipants: 15,
        host: "ArtWalks"
    }
];

const categories = ["Tutti", "Food & Drink", "Adventure", "Culture", "Workshop", "Art"];

const trendingCategories = [
    {
        id: 1,
        name: "Più Viste Oggi",
        icon: Eye,
        color: "from-red-400 to-red-500",
        emoji: "👀",
        count: 24
    },
    {
        id: 2,
        name: "Esperienze Premium",
        icon: Sparkles,
        color: "from-purple-400 to-purple-500",
        emoji: "✨",
        count: 12
    },
    {
        id: 3,
        name: "Più Salvate",
        icon: Heart,
        color: "from-pink-400 to-pink-500",
        emoji: "💖",
        count: 18
    },
    {
        id: 4,
        name: "Nuove Scoperte",
        icon: TrendingUp,
        color: "from-green-400 to-green-500",
        emoji: "🚀",
        count: 15
    }
];


import { useUserContext } from "@/hooks/useUserContext";

export default function TrendingPage() {
    const { city } = useUserContext();
    const [selectedCategory, setSelectedCategory] = useState("Tutti");
    const [sortBy, setSortBy] = useState("score"); // score, price, rating

    // Auto-generate fallback content if no specific mocks exist for the city
    const generateCityMocks = (cityName) => [
        {
            id: `mock-${cityName}-1`,
            title: `I Segreti di ${cityName}`,
            description: `Scopri le meraviglie nascoste di ${cityName} con una guida locale esperta.`,
            location: `${cityName}, Centro Storico`,
            price: 45,
            rating: 4.8,
            reviews: 120,
            image: "https://images.unsplash.com/photo-1516483638261-f4dbaf036963?w=400&h=600&fit=crop",
            category: "Culture",
            tags: ["Trending", "Must See", "History"],
            trendScore: 95,
            participants: 8,
            maxParticipants: 12,
            host: `Guide ${cityName}`
        },
        {
            id: `mock-${cityName}-2`,
            title: `Sapori Autentici di ${cityName}`,
            description: `Un tour gastronomico tra i migliori locali di ${cityName}.`,
            location: `${cityName}, Quartiere Antico`,
            price: 55,
            rating: 4.9,
            reviews: 85,
            image: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=600&fit=crop",
            category: "Food & Drink",
            tags: ["Foodie", "Local", "Tasty"],
            trendScore: 92,
            participants: 6,
            maxParticipants: 10,
            host: `Chef ${cityName}`
        }
    ];

    // Fetch real data with fallback
    const { data: rawData } = useQuery({
        queryKey: ['trending', city], // City dependency
        queryFn: async () => {
            const currentCity = city || 'Roma';
            const tours = await dataService.getToursByCity(currentCity);

            if (tours && tours.length > 0) return tours;

            // Fallback: Filter mocks or generate
            const cityMocks = trendingExperiencesMock.filter(t => t.location.includes(currentCity));
            return cityMocks.length > 0 ? cityMocks : generateCityMocks(currentCity);
        },
        initialData: [], // Start empty to allow effect to update or loading state
    });

    // Process data to match trending structure
    const trendingExperiences = (rawData || []).map(item => ({
        ...item,
        // Ensure properties exist, falling back to mock-like values if needed
        trendScore: item.trendScore || Math.floor(Math.random() * 20) + 80, // Fake score if missing from DB
        host: item.host || item.guide || "Unnivai Guide",
        tags: item.tags || (item.highlights ? item.highlights.slice(0, 3) : ["Popular", "Featured"]),
        image: item.image || item.imageUrl
    }));

    const sortedExperiences = trendingExperiences
        .filter(exp => selectedCategory === "Tutti" || exp.category === selectedCategory)
        .sort((a, b) => {
            if (sortBy === "score") return b.trendScore - a.trendScore;
            if (sortBy === "price") return a.price - b.price;
            if (sortBy === "rating") return b.rating - a.rating;
            return 0;
        });

    return (
        <div className="min-h-screen bg-gradient-to-b from-red-100 to-pink-200 font-quicksand">
            <TopBar />

            <main className="max-w-md mx-auto px-4 py-8 pb-24">
                {/* Back to Home Button */}
                <motion.div
                    className="mb-4"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.6 }}
                >
                    <Link to="/dashboard-user">
                        <motion.button
                            className="flex items-center space-x-2 bg-white/80 backdrop-blur-sm text-red-600 px-4 py-2 rounded-2xl shadow-lg hover:shadow-xl transition-all group"
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
                            scale: [1, 1.1, 1],
                            rotate: [0, 5, -5, 0]
                        }}
                        transition={{
                            duration: 3,
                            repeat: Infinity,
                            repeatType: "reverse"
                        }}
                    >
                        🔥
                    </motion.div>
                    <h1 className="text-3xl font-bold text-gray-800 mb-2">Trending Ora</h1>
                    <p className="text-gray-600">Le esperienze più popolari del momento</p>
                </motion.div>

                {/* Trending Stats */}
                <motion.div
                    className="bg-gradient-to-r from-red-400/20 to-pink-400/20 backdrop-blur-sm rounded-2xl p-4 mb-6"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <motion.div
                                className="bg-red-400 text-white p-2 rounded-xl"
                                whileHover={{ rotate: 360 }}
                                transition={{ duration: 0.6 }}
                            >
                                <TrendingUp className="w-5 h-5" />
                            </motion.div>
                            <div>
                                <p className="text-sm font-medium text-gray-800">Aggiornato ora</p>
                                <p className="text-xs text-gray-600">Basato su visualizzazioni e prenotazioni</p>
                            </div>
                        </div>
                        <motion.div
                            className="text-2xl"
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ duration: 2, repeat: Infinity }}
                        >
                            📊
                        </motion.div>
                    </div>
                </motion.div>

                {/* Sort Options */}
                <motion.div
                    className="mb-6"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.3 }}
                >
                    <div className="flex space-x-2 overflow-x-auto pb-2 scrollbar-hide">
                        {[
                            { key: 'trending', label: 'Trending', emoji: '🔥' },
                            { key: 'rating', label: 'Rating', emoji: '⭐' },
                            { key: 'views', label: 'Più Viste', emoji: '👀' },
                            { key: 'price', label: 'Prezzo', emoji: '💰' }
                        ].map((sort, index) => (
                            <motion.button
                                key={sort.key}
                                onClick={() => setSortBy(sort.key)}
                                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0 flex items-center space-x-2 ${sortBy === sort.key
                                    ? 'bg-red-400 text-white'
                                    : 'bg-white/60 text-gray-700 hover:bg-red-200'
                                    }`}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                            >
                                <span>{sort.emoji}</span>
                                <span>{sort.label}</span>
                            </motion.button>
                        ))}
                    </div>
                </motion.div>

                {/* Trending Categories */}
                <motion.div
                    className="mb-8"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.4 }}
                >
                    <h2 className="text-xl font-bold text-gray-800 mb-4">Categorie Trending</h2>
                    <div className="grid grid-cols-2 gap-3">
                        {trendingCategories.map((category, index) => (
                            <motion.div
                                key={category.id}
                                className="group relative overflow-hidden cursor-pointer"
                                initial={{ opacity: 0, scale: 0.8, rotateY: -30 }}
                                animate={{ opacity: 1, scale: 1, rotateY: 0 }}
                                transition={{ duration: 0.6, delay: 0.5 + index * 0.1 }}
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
                        ))}
                    </div>
                </motion.div>

                {/* Top Trending Experience */}
                {sortedExperiences.length > 0 && (
                    <motion.div
                        className="mb-8"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.6 }}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold text-gray-800">🏆 #1 Trending</h2>
                            <motion.div
                                className="bg-gradient-to-r from-red-400 to-pink-400 text-white px-3 py-1 rounded-full text-sm font-bold"
                                animate={{ scale: [1, 1.05, 1] }}
                                transition={{ duration: 2, repeat: Infinity }}
                            >
                                {sortedExperiences[0].trendingScore}/100
                            </motion.div>
                        </div>

                        <motion.div
                            className="bg-gradient-to-br from-white/90 to-white/70 backdrop-blur-sm rounded-3xl p-6 shadow-xl relative overflow-hidden"
                            whileHover={{ scale: 1.02, rotateX: -2 }}
                            style={{ perspective: 1000 }}
                        >
                            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-red-200/50 to-transparent rounded-full -translate-y-6 translate-x-6" />

                            <div className="relative z-10">
                                <motion.img
                                    src={sortedExperiences[0].image}
                                    alt={sortedExperiences[0].title}
                                    className="w-full h-48 rounded-2xl object-cover mb-4 shadow-lg"
                                    whileHover={{ scale: 1.03, rotateY: 5 }}
                                />

                                <div className="flex items-start justify-between mb-3">
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-800 mb-1">{sortedExperiences[0].title}</h3>
                                        <p className="text-gray-600 text-sm flex items-center">
                                            <MapPin className="w-4 h-4 mr-1 text-red-400" />
                                            {sortedExperiences[0].location}
                                        </p>
                                    </div>
                                    <motion.div
                                        className="text-3xl"
                                        whileHover={{ scale: 1.3, rotate: 15 }}
                                    >
                                        {sortedExperiences[0].trend}
                                    </motion.div>
                                </div>

                                <p className="text-gray-600 text-sm mb-4">{sortedExperiences[0].description}</p>

                                <div className="grid grid-cols-3 gap-3 mb-4">
                                    <div className="bg-red-100 p-3 rounded-xl text-center">
                                        <Eye className="w-5 h-5 text-red-600 mx-auto mb-1" />
                                        <p className="text-xs font-bold text-gray-800">{sortedExperiences[0].views}</p>
                                    </div>
                                    <div className="bg-pink-100 p-3 rounded-xl text-center">
                                        <Heart className="w-5 h-5 text-pink-600 mx-auto mb-1" />
                                        <p className="text-xs font-bold text-gray-800">{sortedExperiences[0].saves}</p>
                                    </div>
                                    <div className="bg-yellow-100 p-3 rounded-xl text-center">
                                        <Star className="w-5 h-5 text-yellow-600 mx-auto mb-1" />
                                        <p className="text-xs font-bold text-gray-800">{sortedExperiences[0].rating}</p>
                                    </div>
                                </div>

                                <div className="flex space-x-3">
                                    <Link to="/tour-live" className="flex-1">
                                        <motion.button
                                            className="w-full bg-gradient-to-r from-red-400 to-red-500 text-white py-4 px-6 rounded-2xl font-bold hover:from-red-500 hover:to-red-600 transition-all shadow-lg flex items-center justify-center space-x-2"
                                            whileHover={{ scale: 1.02, boxShadow: "0 8px 25px rgba(0,0,0,0.15)" }}
                                            whileTap={{ scale: 0.98 }}
                                        >
                                            <Flame className="w-5 h-5" />
                                            <span>Prenota Ora</span>
                                        </motion.button>
                                    </Link>

                                    <Link to="/map" state={{ focusedActivity: sortedExperiences[0] }}>
                                        <motion.button
                                            className="bg-white text-red-500 border-2 border-red-400 py-4 px-6 rounded-2xl font-bold hover:bg-red-50 transition-all shadow-lg flex items-center justify-center"
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.95 }}
                                        >
                                            <MapPin className="w-5 h-5" />
                                        </motion.button>
                                    </Link>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}

                {/* All Trending Experiences */}
                <motion.div
                    className="space-y-4"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.7 }}
                >
                    <h2 className="text-xl font-bold text-gray-800 mb-4">Tutte le Tendenze</h2>
                    {sortedExperiences.slice(1).map((experience, index) => (
                        <motion.div
                            key={experience.id}
                            className="group bg-white/70 backdrop-blur-sm rounded-2xl p-4 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden relative"
                            initial={{ opacity: 0, y: 30, rotateX: 15 }}
                            animate={{ opacity: 1, y: 0, rotateX: 0 }}
                            transition={{ duration: 0.6, delay: 0.8 + index * 0.1 }}
                            whileHover={{ scale: 1.02, rotateX: -2 }}
                            style={{ perspective: 1000 }}
                        >
                            <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-red-200/30 to-transparent rounded-full -translate-y-4 translate-x-4" />

                            <div className="flex space-x-4 relative z-10">
                                <div className="relative">
                                    <img
                                        src={experience.image}
                                        alt={experience.title}
                                        className="w-20 h-20 rounded-xl object-cover shadow-md group-hover:shadow-lg transition-shadow"
                                    />
                                    <motion.div
                                        className="absolute -top-2 -right-2 w-8 h-8 bg-gradient-to-r from-red-400 to-pink-400 rounded-full flex items-center justify-center shadow-lg text-white text-xs font-bold"
                                        whileHover={{ scale: 1.2 }}
                                    >
                                        #{index + 2}
                                    </motion.div>
                                </div>

                                <div className="flex-1">
                                    <div className="flex items-center justify-between mb-1">
                                        <motion.span
                                            className="text-xs font-medium text-red-500 bg-red-100 px-2 py-1 rounded-full"
                                            whileHover={{ scale: 1.05 }}
                                        >
                                            {experience.category}
                                        </motion.span>
                                        <div className="flex items-center space-x-2">
                                            <motion.span
                                                className="text-xs font-bold text-red-600 bg-red-100 px-2 py-1 rounded-full"
                                                whileHover={{ scale: 1.1 }}
                                            >
                                                {experience.trendingScore}
                                            </motion.span>
                                            <motion.span
                                                className="text-lg font-bold text-red-600"
                                                whileHover={{ scale: 1.1 }}
                                            >
                                                €{experience.price}
                                            </motion.span>
                                        </div>
                                    </div>

                                    <h3 className="font-semibold text-gray-800 mb-1 text-sm group-hover:text-red-600 transition-colors">
                                        {experience.title}
                                    </h3>

                                    <p className="text-xs text-gray-600 mb-2 flex items-center">
                                        <MapPin className="w-3 h-3 mr-1 text-red-400" />
                                        {experience.location}
                                    </p>

                                    <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                                        <div className="flex items-center space-x-3">
                                            <span className="flex items-center">
                                                <Clock className="w-3 h-3 mr-1" />
                                                {experience.duration}
                                            </span>
                                            <span className="flex items-center">
                                                <Eye className="w-3 h-3 mr-1" />
                                                {experience.views}
                                            </span>
                                        </div>
                                        <div className="flex items-center">
                                            <Star className="w-3 h-3 mr-1 text-yellow-400 fill-current" />
                                            <span>{experience.rating}</span>
                                        </div>
                                    </div>

                                    <div className="flex space-x-2">
                                        <Link to="/tour-details" className="flex-1">
                                            <motion.button
                                                className="w-full bg-red-400 text-white py-2 px-3 rounded-xl text-xs font-medium hover:bg-red-500 transition-colors flex items-center justify-center space-x-1"
                                                whileHover={{ scale: 1.05 }}
                                                whileTap={{ scale: 0.95 }}
                                            >
                                                <span>Dettagli</span>
                                            </motion.button>
                                        </Link>

                                        <Link to="/map" state={{ focusedActivity: experience }}>
                                            <motion.button
                                                className="bg-green-400 text-white py-2 px-3 rounded-xl text-xs font-medium hover:bg-green-500 transition-colors flex items-center justify-center"
                                                whileHover={{ scale: 1.05 }}
                                                whileTap={{ scale: 0.95 }}
                                            >
                                                <MapPin className="w-3 h-3" />
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
