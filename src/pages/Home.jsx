import { motion, AnimatePresence } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { Users, Brain, Zap, Sparkles, MapPin, Clock, Star, Gamepad2, Gift, ChevronRight } from "lucide-react";
import { useState } from "react";
import TopBar from "@/components/TopBar";
import BottomNavigation from "@/components/BottomNavigation";
import PersonalizedWelcome from "@/components/PersonalizedWelcome";
import { useUserContext } from "@/hooks/useUserContext";
import { useQuery } from "@tanstack/react-query";
import { dataService } from "@/services/dataService";

const generateCityExperiences = (cityName) => [
    {
        id: 1,
        type: "guide",
        title: `Cucina con Nonna a ${cityName} `,
        location: `${cityName}, Centro`,
        rating: 4.9,
        reviews: 127,
        price: 45,
        duration: "3h",
        image: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=600&h=400&fit=crop&q=80",
        category: "food",
        emoji: "👵🍝",
        description: `Immergiti nella tradizione culinaria di ${cityName} con un'esperienza autentica e indimenticabile. Preparerai piatti tipici con ingredienti freschi locali sotto la guida esperta di una vera "Nonna". Un viaggio nei sapori e nei segreti della cucina casalinga.`,
        highlights: ["Lezione di cucina privata", "Pranzo incluso con vino locale", "Ricettario segreto in omaggio", "Attestato di partecipazione"],
        itinerary: [
            { time: "10:00", activity: "Incontro e spesa al mercato", emoji: "🥦" },
            { time: "11:00", activity: "Inizio lezione di cucina", emoji: "👩‍🍳" },
            { time: "13:00", activity: "Pranzo conviviale", emoji: "🍷" }
        ],
        meetingPoint: "Piazza del Mercato Centrale",
        included: ["Ingredienti", "Grembiule", "Pranzo", "Vino"],
        notIncluded: ["Trasporto all'alloggio"],
        guide: "Nonna Maria",
        guideAvatar: "👵"
    },
    {
        id: 2,
        type: "guide",
        title: `Street Art di ${cityName} `,
        location: `${cityName}, Quartiere Artistico`,
        rating: 4.8,
        reviews: 89,
        price: 25,
        duration: "2h",
        image: "https://images.unsplash.com/photo-1539650116574-75c0c6d73f6e?w=600&h=400&fit=crop&q=80",
        category: "art",
        emoji: "🎨",
        description: `Scopri il lato urbano e creativo di ${cityName}. Un tour a piedi tra murales giganti, graffiti nascosti e storie di artisti che hanno colorato la città. Perfetto per amanti dell'arte e della fotografia.`,
        highlights: ["Murales famosi e nascosti", "Storie degli artisti locali", "Foto shooting urbano", "Aperitivo finale"],
        itinerary: [
            { time: "16:00", activity: "Partenza dal centro sociale", emoji: "🚩" },
            { time: "16:45", activity: "Visita ai Grandi Muri", emoji: "🎨" },
            { time: "17:45", activity: "Aperitivo street", emoji: "🍻" }
        ],
        meetingPoint: "Ingresso Metro Artisti",
        included: ["Guida esperta", "Mappa street art", "Drink"],
        notIncluded: ["Mance"],
        guide: "Alex 'Spray'",
        guideAvatar: "🎨"
    },
    {
        id: 3,
        type: "guide",
        title: `Tramonto Panoramico`,
        location: `${cityName}, Belvedere`,
        rating: 4.9,
        reviews: 215,
        price: 30,
        duration: "1.5h",
        image: "https://images.unsplash.com/photo-1523906834658-6e24ef2386f9?w=600&h=400&fit=crop&q=80",
        category: "romance",
        emoji: "🌅",
        description: `Goditi la vista più bella di ${cityName} al calare del sole. Un'esperienza romantica e rilassante, accompagnata da musica dal vivo e un calice di bollicine, mentre la città si illumina sotto di te.`,
        highlights: ["Vista mozzafiato a 360°", "Musica acustica dal vivo", "Brindisi al tramonto", "Atmosfera esclusiva"],
        itinerary: [
            { time: "18:30", activity: "Ritrovo alla funicolare", emoji: "🚠" },
            { time: "19:00", activity: "Arrivo al Belvedere", emoji: "👀" },
            { time: "19:30", activity: "Brindisi al tramonto", emoji: "🥂" }
        ],
        meetingPoint: "Stazione Funicolare Valle",
        included: ["Biglietto funicolare", "Prosecco", "Snack"],
        notIncluded: ["Cena"],
        guide: "Luca Verdi",
        guideAvatar: "🎻"
    },
    {
        id: 4,
        type: "guide",
        title: `Segreti di ${cityName}`,
        location: `${cityName}, Vicoli Nascosti`,
        rating: 4.7,
        reviews: 64,
        price: 15,
        duration: "1h",
        image: "https://images.unsplash.com/photo-1514890547357-a9ee288728e0?w=600&h=400&fit=crop&q=80",
        category: "walking",
        emoji: "👣",
        description: `Un tour rapido ma intenso alla scoperta delle leggende e dei misteri che si celano dietro i portoni e nei vicoli meno battuti di ${cityName}. Ideale per chi vuole scoprire curiosità inedite.`,
        highlights: ["Leggende urbane", "Cortili segreti", "Architettura nascosta", "Gruppi piccoli"],
        itinerary: [
            { time: "10:00", activity: "Piazza del Mistero", emoji: "👻" },
            { time: "10:30", activity: "Il Vicolo Stretto", emoji: "🧱" },
            { time: "11:00", activity: "Saluti finali", emoji: "👋" }
        ],
        meetingPoint: "Statua del Poeta",
        included: ["Guida narratrice", "Piccolo souvenir"],
        notIncluded: [],
        guide: "Giulia Storica",
        guideAvatar: "📚"
    },
    {
        id: 5,
        type: "guide",
        title: `Aperitivo Locale`,
        location: `${cityName}, Piazza Principale`,
        rating: 4.5,
        reviews: 110,
        price: 20,
        duration: "1.5h",
        image: "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=600&h=400&fit=crop&q=80",
        category: "food",
        emoji: "🍷",
        description: `Vivi il rito dell'aperitivo come un vero locale. Un tour tra i migliori bar della piazza principale, assaggiando cocktail signature e stuzzichini tipici, in un'atmosfera vibrante e festosa.`,
        highlights: ["3 Drink inclusi", "Buffet illimitato", "Socializzazione", "Musica lounge"],
        itinerary: [
            { time: "18:00", activity: "Primo Bar: Spritz time", emoji: "🍹" },
            { time: "18:45", activity: "Secondo Bar: Vini locali", emoji: "🍷" },
            { time: "19:30", activity: "Terzo Bar: Cocktail signature", emoji: "🍸" }
        ],
        meetingPoint: "Fontana Vecchia",
        included: ["3 Consumazioni", "Cibo a buffet"],
        notIncluded: [],
        guide: "Marco Barman",
        guideAvatar: "🕺"
    }
];

export default function Home() {
    const { city } = useUserContext();
    const navigate = useNavigate();
    const [showQuickOptions, setShowQuickOptions] = useState(false);

    // Fetch Experiences (Clean logic)
    const { data: experiences } = useQuery({
        queryKey: ['home-experiences', city],
        queryFn: async () => {
            const currentCity = city || 'Roma';
            const tours = await dataService.getToursByCity(currentCity);
            if (tours && tours.length > 0) return tours.slice(0, 5);
            return generateCityExperiences(currentCity);
        },
        initialData: generateCityExperiences('Roma')
    });

    // Card Variaints
    const cardVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: (i) => ({
            opacity: 1,
            y: 0,
            transition: { delay: i * 0.1, duration: 0.5, ease: "easeOut" }
        })
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-ochre-100 to-ochre-200 font-quicksand pb-32">
            <TopBar />

            <main className="max-w-md mx-auto px-6 pt-6 pb-12 space-y-8">

                {/* 1. Personalized Welcome */}
                <PersonalizedWelcome />

                {/* 2. Core Section - SMART GLASS BUTTONS */}
                <section className="flex flex-col space-y-5">

                    {/* Button 1: Guide Locali */}
                    <Link to="/tour-live" className="block">
                        <motion.div
                            whileHover={{ scale: 1.02, y: -2 }}
                            whileTap={{ scale: 0.95 }}
                            className="relative bg-gradient-to-r from-terracotta-500 to-red-600 rounded-3xl p-1 shadow-xl shadow-terracotta-500/20 overflow-hidden group"
                        >
                            {/* Inner Glass Container */}
                            <div className="relative bg-white/10 backdrop-blur-sm rounded-[20px] p-5 h-full flex items-center justify-between border border-white/20">
                                {/* Subtle Texture Overlay */}
                                <div className="absolute inset-0 opacity-10 bg-[url('https://images.unsplash.com/photo-1551218808-94e220e084d2?w=800&q=80')] bg-cover bg-center mix-blend-overlay" />

                                <div className="relative z-10 flex items-center space-x-4">
                                    <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-md shadow-inner border border-white/30">
                                        <Users className="w-8 h-8 text-white drop-shadow-md" />
                                    </div>
                                    <div>
                                        {/* Speaking Badge */}
                                        <div className="mb-1">
                                            <span className="bg-white/90 text-terracotta-600 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wide shadow-sm flex w-fit items-center">
                                                <span className="w-1.5 h-1.5 bg-red-500 rounded-full mr-1 animate-pulse" />
                                                Live Now
                                            </span>
                                        </div>
                                        <h3 className="text-xl font-bold font-playfair text-white leading-tight">Guide Locali</h3>
                                        <p className="text-terracotta-50 text-xs font-medium mt-0.5 opacity-90">Esplora con esperti del posto</p>
                                    </div>
                                </div>
                                <ChevronRight className="w-5 h-5 text-white/50 group-hover:translate-x-1 transition-transform" />
                            </div>
                        </motion.div>
                    </Link>

                    {/* Button 2: AI Itinerary */}
                    <Link to="/ai-itinerary" className="block">
                        <motion.div
                            whileHover={{ scale: 1.02, y: -2 }}
                            whileTap={{ scale: 0.95 }}
                            className="relative bg-gradient-to-r from-emerald-500 to-teal-600 rounded-3xl p-1 shadow-xl shadow-emerald-500/20 overflow-hidden group"
                        >
                            {/* Inner Glass Container */}
                            <div className="relative bg-white/10 backdrop-blur-sm rounded-[20px] p-5 h-full flex items-center justify-between border border-white/20">
                                {/* Subtle Texture Overlay */}
                                <div className="absolute inset-0 opacity-10 bg-[url('https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=800&q=80')] bg-cover bg-center mix-blend-overlay" />

                                <div className="relative z-10 flex items-center space-x-4">
                                    <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-md shadow-inner border border-white/30">
                                        <Brain className="w-8 h-8 text-white drop-shadow-md" />
                                    </div>
                                    <div>
                                        {/* Speaking Badge */}
                                        <div className="mb-1">
                                            <span className="bg-white/90 text-emerald-600 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wide shadow-sm w-fit block">
                                                Gratis & Su Misura
                                            </span>
                                        </div>
                                        <h3 className="text-xl font-bold font-playfair text-white leading-tight">Crea il tuo Percorso</h3>
                                        <p className="text-emerald-50 text-xs font-medium mt-0.5 opacity-90">Intelligenza artificiale per te</p>
                                    </div>
                                </div>
                                <ChevronRight className="w-5 h-5 text-white/50 group-hover:translate-x-1 transition-transform" />
                            </div>
                        </motion.div>
                    </Link>

                    {/* Button 3: Quick Path */}
                    <div className="relative">
                        <motion.div
                            onClick={() => setShowQuickOptions(!showQuickOptions)}
                            whileHover={{ scale: 1.02, y: -2 }}
                            whileTap={{ scale: 0.95 }}
                            className="relative bg-gradient-to-r from-amber-400 to-orange-500 rounded-3xl p-1 shadow-xl shadow-amber-500/20 overflow-hidden group cursor-pointer"
                        >
                            {/* Inner Glass Container */}
                            <div className="relative bg-white/10 backdrop-blur-sm rounded-[20px] p-5 h-full flex items-center justify-between border border-white/20">
                                {/* Subtle Texture Overlay */}
                                <div className="absolute inset-0 opacity-10 bg-[url('https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800&q=80')] bg-cover bg-center mix-blend-overlay" />

                                <div className="relative z-10 flex items-center space-x-4">
                                    <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-md shadow-inner border border-white/30">
                                        <Zap className="w-8 h-8 text-white drop-shadow-md" />
                                    </div>
                                    <div>
                                        {/* Speaking Badge */}
                                        <div className="mb-1">
                                            <span className="bg-white/90 text-amber-600 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wide shadow-sm flex w-fit items-center">
                                                <Clock className="w-3 h-3 mr-1" />
                                                30 Secondi
                                            </span>
                                        </div>
                                        <h3 className="text-xl font-bold font-playfair text-white leading-tight">Ispirami Ora</h3>
                                        <p className="text-amber-50 text-xs font-medium mt-0.5 opacity-90">Lasciati guidare dal destino</p>
                                    </div>
                                </div>
                                <div className={`transition-transform duration-300 ${showQuickOptions ? 'rotate-90' : ''}`}>
                                    <ChevronRight className="w-5 h-5 text-white/80" />
                                </div>
                            </div>
                        </motion.div>

                        {/* Quick Options Expansion */}
                        <AnimatePresence>
                            {showQuickOptions && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0, marginTop: 0 }}
                                    animate={{ opacity: 1, height: 'auto', marginTop: 12 }}
                                    exit={{ opacity: 0, height: 0, marginTop: 0 }}
                                    className="overflow-hidden"
                                >
                                    <div className="grid grid-cols-2 gap-4">
                                        <button
                                            onClick={() => navigate('/quick-path')}
                                            className="bg-white/80 backdrop-blur-sm p-4 rounded-2xl shadow-sm border border-orange-100 flex flex-col items-center justify-center space-y-2 active:scale-95 transition-transform hover:bg-white"
                                        >
                                            <div className="bg-amber-100 p-2 rounded-full">
                                                <Gamepad2 className="w-6 h-6 text-amber-500" />
                                            </div>
                                            <span className="font-bold text-gray-800 text-xs">Quiz Veloce</span>
                                        </button>
                                        <button
                                            onClick={() => navigate('/surprise-tour')}
                                            className="bg-white/80 backdrop-blur-sm p-4 rounded-2xl shadow-sm border border-pink-100 flex flex-col items-center justify-center space-y-2 active:scale-95 transition-transform hover:bg-white"
                                        >
                                            <div className="bg-pink-100 p-2 rounded-full">
                                                <Gift className="w-6 h-6 text-pink-500" />
                                            </div>
                                            <span className="font-bold text-gray-800 text-xs">Sorprendimi</span>
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                </section>

                {/* 3. Footer Section - Magazine Style */}
                <section>
                    <div className="flex items-center justify-between mb-4 px-1">
                        <h3 className="text-xl font-bold text-gray-800 font-playfair">Esperienze Uniche</h3>
                        <Link to="/explore" className="text-xs font-bold text-gray-500 hover:text-terracotta-500 uppercase tracking-widest transition-colors">
                            Vedi tutte
                        </Link>
                    </div>

                    <div className="flex overflow-x-auto space-x-5 pb-8 -mx-6 px-6 scrollbar-hide">
                        {experiences?.map((exp) => (
                            <Link
                                to={`/tour-details/${exp.id}`}
                                state={{ tourData: exp }}
                                key={exp.id}
                                className="block min-w-[260px]"
                            >
                                <motion.div
                                    className="group relative h-64 rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300"
                                    whileHover={{ y: -5 }}
                                >
                                    <img
                                        src={exp.image || 'https://images.unsplash.com/photo-1516483638261-f4dbaf036963?w=600&h=400&fit=crop&q=80'}
                                        alt={exp.title}
                                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                        onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1516483638261-f4dbaf036963?w=600&h=400&fit=crop&q=80'; }}
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-80" />

                                    <div className="absolute top-3 right-3 bg-white/20 backdrop-blur-md px-2 py-1 rounded-lg text-xs font-bold text-white flex items-center">
                                        <Star className="w-3 h-3 text-yellow-400 fill-current mr-1" />
                                        {exp.rating}
                                    </div>

                                    <div className="absolute bottom-0 left-0 p-5 w-full text-white">
                                        <div className="text-[10px] font-bold text-gray-300 uppercase tracking-wider mb-1">{exp.category}</div>
                                        <h4 className="font-playfair font-bold text-lg leading-tight mb-2 line-clamp-2">{exp.title}</h4>
                                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/20">
                                            <div className="flex items-center text-xs font-medium opacity-90">
                                                <Clock className="w-3 h-3 mr-1" />
                                                {exp.duration}
                                            </div>
                                            <span className="font-bold text-base">€{exp.price}</span>
                                        </div>
                                    </div>
                                </motion.div>
                            </Link>
                        ))}
                    </div>
                </section>

            </main>

            <BottomNavigation />
        </div>
    );
}
