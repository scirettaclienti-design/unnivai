import { motion } from "framer-motion";
import { supabase } from "../lib/supabase";
import { ArrowLeft, MapPin, Clock, Star, Play, Heart, Share2, Users, Calendar, MessageCircle, Navigation, CheckCircle, XCircle, Sparkles, Brain } from "lucide-react";
import { Link, useParams, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useState, useEffect } from "react";
import TopBar from "../components/TopBar";
import { getItemImage, imgOnError } from "../utils/imageUtils";

import { useAuth } from "../context/AuthContext";
import BottomNavigation from "../components/BottomNavigation";
import BookingModal from "../components/BookingSystem";

import { Toast } from "../components/ToastNotification";
import { useQuery } from "@tanstack/react-query";
import { dataService, createGuideRequest } from "../services/dataService";
import { mapService } from "../services/mapService";

// --- MOCK DATA (Original Rich Data) ---
const tourDetailsMock = {
    1: {
        id: 1,
        title: "Sapori nascosti di Trastevere",
        guide: "Maria Benedetti",
        guideAvatar: "👩‍🍳",
        guideBio: "Chef appassionata con 15 anni di esperienza. Nata e cresciuta a Trastevere, conosce ogni vicolo.",
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
            "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&h=300&fit=crop"
        ],
        description: "Scopri i sapori autentici del quartiere più caratteristico di Roma, dove ogni pietra racconta una storia.",
        highlights: ["🍝 Pasta fresca fatta a mano", "🍷 Degustazione vini locali", "📸 Foto ricordo", "🧀 Formaggi tipici"],
        itinerary: [
            { time: "19:30", activity: "Incontro in Piazza Santa Maria", emoji: "👋" },
            { time: "19:45", activity: "Visita trattoria storica", emoji: "🍝" },
            { time: "20:15", activity: "Degustazione vini", emoji: "🍷" },
            { time: "21:00", activity: "Dolce finale", emoji: "🍰" }
        ],
        meetingPoint: "Piazza Santa Maria in Trastevere, presso la fontana centrale",
        included: ["Degustazioni", "Foto ricordo", "Guida esperta", "Assicurazione"],
        notIncluded: ["Trasporti", "Cena completa", "Acquisto prodotti"],
        live: true,
        type: 'guide',
        nextStart: "Tra 2 ore",
        // Waypoints for Trastevere Tour
        waypoints: [
            [41.8893, 12.4708], // Piazza Santa Maria in Trastevere
            [41.8880, 12.4690], // Via della Lungaretta
            [41.8860, 12.4720], // Piazza di San Cosimato
            [41.8900, 12.4730]  // Ponte Sisto
        ]
    },
    2: {
        id: 2,
        title: "Palermo tra mercati e street art",
        guide: "Giuseppe Torrisi",
        guideAvatar: "🎨",
        guideBio: "Artista e fotografo palermitano, esperto di arte urbana e culture del Mediterraneo.",
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
            "https://images.unsplash.com/photo-1580500722723-e2dc6e1b7bb8?w=400&h=300&fit=crop"
        ],
        description: "Un viaggio tra i colori e i sapori dei mercati storici palermitani.",
        highlights: ["🎨 Murales nascosti", "🛒 Mercati storici", "🍊 Degustazioni", "📱 Workshop fotografico"],
        itinerary: [
            { time: "16:00", activity: "Mercato di Ballarò", emoji: "🛒" },
            { time: "16:30", activity: "Street art tour", emoji: "🎨" },
            { time: "17:30", activity: "Degustazione arancine", emoji: "🍊" }
        ],
        meetingPoint: "Ingresso principale Mercato di Ballarò",
        included: ["Tour guidato", "Degustazioni", "Workshop", "Mappa artistica"],
        notIncluded: ["Trasporti", "Cena", "Materiale fotografico"],
        live: true,
        type: 'guide',
        nextStart: "In corso"
    },
    "demo1": {
        id: "demo1",
        title: "Tour del Colosseo VIP",
        type: 'guide',
        live: false,
        price: 45,
        rating: 4.9,
        images: ["https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=400&h=300&fit=crop"],
        description: "Accesso esclusivo alle aree riservate del Colosseo.",
        highlights: ["🎟️ Accesso senza code", "🏛️ Aree riservate"],
        itinerary: [{ time: "09:00", activity: "Incontro", emoji: "🤝" }],
        meetingPoint: "Metro Colosseo",
        included: ["Biglietto", "Guida"],
        notIncluded: ["Pranzo"],
        guide: "Marco Aurelio",
        guideAvatar: "🏛️",
        // Waypoints for Colosseo Tour
        waypoints: [
            [41.8902, 12.4922], // Colosseo
            [41.8925, 12.4853], // Fori Imperiali
            [41.8890, 12.4870]  // Arco di Costantino
        ]
    },
    3: {
        id: 3,
        title: "Walking Catania: Barocco & Street Food",
        location: "Catania, Centro Storico",
        guide: "Giuseppe Rossi",
        guideAvatar: "🌋",
        guideBio: "Vulcanologo e amante della cucina. Vi mostrerò la vera anima di Catania.",
        duration: "3 ore",
        price: 35,
        originalPrice: 45,
        rating: 5.0,
        reviews: 120,
        participants: 12,
        maxParticipants: 15,
        images: [
            "https://images.unsplash.com/photo-1516629986345-0d046c31969a?w=400&h=300&fit=crop",
            "https://images.unsplash.com/photo-1548612984-63d1981fb91f?w=400&h=300&fit=crop"
        ],
        description: "Un tour a piedi nel cuore di Catania, tra mercati storici, architettura barocca e sapori unici.",
        highlights: ["🐟 Mercato del Pesce", "🏰 Castello Ursino", "🐘 Elephant Symbol", "🍋 Granita Tasting"],
        itinerary: [
            { time: "10:00", activity: "Piazza Duomo", emoji: "🐘" },
            { time: "10:45", activity: "Pescheria Market", emoji: "🐟" },
            { time: "11:30", activity: "Castello Ursino", emoji: "🏰" },
            { time: "12:30", activity: "Granita a Villa Bellini", emoji: "🍧" }
        ],
        meetingPoint: "Piazza del Duomo, sotto l'Elefante",
        included: ["Guida locale", "Granita & Brioche", "Mappa digitale"],
        notIncluded: ["Pranzo completo", "Souvenir"],
        live: true,
        type: 'guide',
        nextStart: "Domani, 10:00",
        // Distinct waypoints for Catania
        // Distinct waypoints for Catania
        waypoints: [[37.5027, 15.0872], [37.5020, 15.0860], [37.4993, 15.0838], [37.5090, 15.0845]]
    },
    // --- MAP ACTIVITY MOCKS ---
    "a1": {
        id: "a1",
        title: "Fontanella Pubblica",
        type: "service",
        live: false,
        price: "Gratis",
        rating: 5.0,
        description: "Antica fontanella di acqua potabile, nota come 'Nasone'. Acqua fresca e gratuita sempre disponibile.",
        images: ["https://images.unsplash.com/photo-1542459800-9831d102e332?w=500"],
        highlights: ["💧 Acqua Potabile", "🆓 Gratuito", "🏛️ Storico"],
        itinerary: [],
        meetingPoint: "Via dei Fori Imperiali",
        included: ["Acqua a volontà"],
        notIncluded: [],
        guide: "Comune di Roma",
        guideAvatar: "🐺"
    },
    "a2": {
        id: "a2",
        title: "Souvenir Roma",
        type: "shop",
        live: true, // Open now
        price: "Variabile",
        rating: 4.2,
        description: "Negozio artigianale storico con prodotti tipici, ceramiche e ricordi autentici della città.",
        images: ["https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?w=500"],
        highlights: ["🏺 Ceramiche", "🎁 Idee Regalo", "🇮🇹 Made in Italy"],
        itinerary: [],
        meetingPoint: "Via del Corso",
        included: ["Confezione regalo"],
        notIncluded: [],
        guide: "Mario Rossi",
        guideAvatar: "🏪"
    },
    "a3": {
        id: "a3",
        title: "Trattoria Romana",
        type: "food",
        live: true,
        price: 35,
        rating: 4.7,
        description: "Cucina tradizionale romana in un ambiente caldo e accogliente. Specialità: Carbonara e Amatriciana.",
        images: ["https://images.unsplash.com/photo-1574868233905-25916053805b?w=500"],
        highlights: ["🍝 Pasta Fresca", "🍷 Vini Locali", "🔥 Atmosfera"],
        itinerary: [],
        meetingPoint: "Vicolo del Cinque",
        included: ["Coperto", "Pane", "Acqua"],
        notIncluded: ["Vini pregiati"],
        guide: "Chef Luigi",
        guideAvatar: "👨‍🍳"
    },
    "a4": {
        id: "a4",
        title: "Hotel Imperiale",
        type: "hotel",
        live: true,
        price: 250,
        rating: 5.0,
        description: "Lusso e comfort nel cuore della città eterna. Terrazza panoramica e spa esclusiva per gli ospiti.",
        images: ["https://images.unsplash.com/photo-1566073771259-6a8506099945?w=500"],
        highlights: ["🛏️ Suite di Lusso", "🧖‍♀️ SPA", "🍸 Rooftop Bar"],
        itinerary: [],
        meetingPoint: "Via Veneto",
        included: ["Colazione", "Wi-Fi", "Accesso SPA"],
        notIncluded: ["Tassa di soggiorno"],
        guide: "Concierge",
        guideAvatar: "🛎️"
    }
    // ... add others if needed or rely on default fallback
};

// UUID semplice: 8-4-4-4-12 caratteri esadecimali
const isValidGuideId = (id) => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

// --- INTERNAL MODAL COMPONENT ---
const RequestModal = ({ isOpen, onClose, guideName, tourTitle, guideId, tourId, city }) => {
    const { user } = useAuth();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [feedback, setFeedback] = useState(null); // { type: 'success'|'error', message: string }
    useEffect(() => { if (isOpen) setFeedback(null); }, [isOpen]);
    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setFeedback(null);

        if (!user) {
            setFeedback({ type: 'error', message: 'Devi effettuare il login per inviare una richiesta.' });
            return;
        }
        if (isSubmitting) return;

        if (!guideId || !isValidGuideId(guideId)) {
            setFeedback({ type: 'error', message: 'Questo tour non ha una guida associata. Apri il tour da "I Miei Tour" della guida o da Esplora (tour con guida reale).' });
            return;
        }

        const formData = new FormData(e.target);
        const date = formData.get('date');
        const guests = formData.get('guests');
        const rawMessage = formData.get('message');
        const richMessage = `Richiesta per: ${tourTitle}\nData: ${date}\nOspiti: ${guests}\n\n${rawMessage || ''}`;

        const userName = (`${user.user_metadata?.first_name || ''} ${user.user_metadata?.last_name || ''}`).trim() || user.user_metadata?.name || user.email?.split('@')[0] || 'Utente';

        setIsSubmitting(true);
        try {
            const requestPayload = {
               date,
               guests,
               message: richMessage,
               guideId,
               tourId: tourId || null,
            };

            await createGuideRequest(requestPayload);

            setFeedback({ type: 'success', message: `Richiesta inviata a ${guideName}! La guida la vedrà in Richieste Live.` });
            setTimeout(() => { onClose(); setFeedback(null); }, 2000);
        } catch (err) {
            console.error("Error sending request:", err);
            const msg = err?.message || String(err);
            if (msg.includes('column') || msg.includes('does not exist')) {
                setFeedback({ type: 'error', message: 'Errore database: esegui in Supabase (SQL Editor) lo script supabase/migrations/20240223_guide_requests_tour_flow.sql' });
            } else {
                setFeedback({ type: 'error', message: 'Errore invio: ' + msg });
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center pointer-events-none">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm pointer-events-auto"
                onClick={onClose}
            />

            {/* Modal Content */}
            <motion.div
                className="bg-white w-full max-w-md p-6 rounded-t-3xl sm:rounded-2xl shadow-2xl z-10 pointer-events-auto"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
            >
                <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6" />

                <h3 className="text-xl font-bold text-gray-800 mb-2">Contatta {guideName}</h3>
                <p className="text-gray-500 text-sm mb-6">Richiedi disponibilità per "{tourTitle}"</p>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Data Desiderata</label>
                        <input type="date" name="date" required className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-terracotta-400" />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Numero Persone</label>
                        <input type="number" name="guests" min="1" max="20" required defaultValue="2" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-terracotta-400" />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Messaggio (Opzionale)</label>
                        <textarea name="message" rows="2" placeholder="Ciao! Siamo interessati a..." className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-terracotta-400" />
                    </div>

                    {feedback && (
                        <div
                            className={`rounded-xl px-4 py-3 text-sm font-medium ${feedback.type === 'success'
                                ? 'bg-green-50 text-green-800 border border-green-200'
                                : 'bg-red-50 text-red-800 border border-red-200'
                                }`}
                            role="alert"
                        >
                            {feedback.message}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full bg-black text-white py-4 rounded-xl font-bold text-lg hover:bg-gray-800 disabled:opacity-70 disabled:cursor-not-allowed transition-colors shadow-lg mt-2"
                    >
                        {isSubmitting ? 'Invio in corso...' : 'Invia Richiesta'}
                    </button>

                    <button
                        type="button"
                        onClick={onClose}
                        className="w-full text-gray-400 py-2 text-sm font-bold hover:text-gray-600"
                    >
                        Annulla
                    </button>
                </form>
            </motion.div>
        </div>
    );
};

// --- GUIDE PROFILE MODAL ---
const GuideProfileModal = ({ isOpen, onClose, guideName, guideAvatar, bio, rating, reviews }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Content */}
            <motion.div
                className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl relative z-10 overflow-hidden"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
            >
                {/* Header Image Pattern */}
                <div className="h-24 bg-gradient-to-br from-olive-400 to-olive-600 relative overflow-hidden">
                    <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
                </div>

                <div className="px-6 pb-6 -mt-12 text-center">
                    {/* Avatar */}
                    <div className="w-24 h-24 rounded-full bg-white p-1 mx-auto shadow-lg mb-3">
                        <div className="w-full h-full rounded-full bg-gray-100 flex items-center justify-center text-5xl">
                            {guideAvatar}
                        </div>
                    </div>

                    <h2 className="text-2xl font-black text-gray-800 mb-1">{guideName}</h2>
                    <p className="text-xs font-bold text-olive-600 uppercase tracking-widest mb-4">Guida Ufficiale DoveVai</p>

                    {/* Stats */}
                    <div className="flex justify-center space-x-6 mb-6">
                        <div className="text-center">
                            <div className="font-black text-xl text-gray-800">{rating}</div>
                            <div className="text-[10px] text-gray-400 uppercase font-bold">Rating</div>
                        </div>
                        <div className="w-px bg-gray-200"></div>
                        <div className="text-center">
                            <div className="font-black text-xl text-gray-800">{reviews}</div>
                            <div className="text-[10px] text-gray-400 uppercase font-bold">Recensioni</div>
                        </div>
                        <div className="w-px bg-gray-200"></div>
                        <div className="text-center">
                            <div className="font-black text-xl text-gray-800">5+</div>
                            <div className="text-[10px] text-gray-400 uppercase font-bold">Anni Exp</div>
                        </div>
                    </div>

                    <div className="bg-gray-50 rounded-2xl p-4 text-left mb-6">
                        <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">Biografia</h4>
                        <p className="text-sm text-gray-600 leading-relaxed font-medium">
                            {bio || "Appassionato di storia locale e cultura sarda. Amo raccontare le storie nascoste che non troverai nelle guide turistiche tradizionali."}
                        </p>
                    </div>

                    {/* Credentials */}
                    <div className="flex gap-2 mb-6 justify-center">
                        <span className="px-3 py-1 bg-green-100 text-green-700 text-[10px] font-bold rounded-full border border-green-200">Verificato</span>
                        <span className="px-3 py-1 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-full border border-blue-200">Esperto Locale</span>
                    </div>

                    <button
                        onClick={onClose}
                        className="w-full py-3 bg-gray-900 text-white rounded-xl font-bold shadow-lg active:scale-95 transition-transform"
                    >
                        Chiudi Profilo
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

// --- GUIDE CHAT MODAL ---
const GuideChatModal = ({ isOpen, onClose, guideName, guideAvatar }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 pointer-events-none">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity pointer-events-auto"
                onClick={onClose}
            />

            {/* Chat Interface */}
            <motion.div
                className="bg-white w-full max-w-sm h-[80vh] sm:h-[600px] rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl relative z-10 overflow-hidden flex flex-col pointer-events-auto"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
            >
                {/* Header */}
                <div className="bg-white border-b border-gray-100 p-4 flex items-center justify-between shadow-sm sticky top-0 z-20">
                    <div className="flex items-center space-x-3">
                        <div className="relative">
                            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-xl border border-gray-200">
                                {guideAvatar}
                            </div>
                            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-800 text-sm">{guideName}</h3>
                            <p className="text-[10px] text-green-600 font-bold flex items-center gap-1">
                                <span className="w-1 min-h-1 rounded-full bg-green-500 animate-pulse"></span> Online
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 bg-gray-50 hover:bg-gray-100 rounded-full transition-colors">
                        <XCircle size={20} className="text-gray-400" />
                    </button>
                </div>

                {/* Messages Area */}
                <div className="flex-1 bg-gray-50 p-4 overflow-y-auto space-y-4">
                    <div className="flex justify-center my-4">
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider bg-gray-200/50 px-3 py-1 rounded-full">Oggi</span>
                    </div>

                    {/* System Message */}
                    <div className="flex justify-center">
                        <div className="bg-yellow-50 text-yellow-800 text-xs px-4 py-2 rounded-xl border border-yellow-100 shadow-sm max-w-[85%] text-center leading-relaxed">
                            🔒 Questa è una chat sicura e crittografata con la tua guida ufficiale DoveVai.
                        </div>
                    </div>

                    {/* Guide Message */}
                    <div className="flex items-end space-x-2">
                        <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs flex-shrink-0">
                            {guideAvatar}
                        </div>
                        <div className="bg-white p-3 rounded-2xl rounded-bl-sm shadow-sm border border-gray-100 max-w-[80%]">
                            <p className="text-sm text-gray-700 leading-snug">
                                Ciao! Sono {guideName.split(' ')[0]}. 👋 <br />
                                Chiedimi pure qualsiasi cosa sul tour o, se vuoi, qualche consiglio segreto sulla zona!
                            </p>
                            <span className="text-[10px] text-gray-400 mt-1 block text-right">09:42</span>
                        </div>
                    </div>
                </div>

                {/* Input Area */}
                <div className="p-4 bg-white border-t border-gray-100">
                    <div className="flex items-center gap-2 bg-gray-50 rounded-full px-4 py-3 border border-gray-200 focus-within:ring-2 focus-within:ring-terracotta-400 focus-within:border-transparent transition-all">
                        <input
                            type="text"
                            placeholder="Scrivi un messaggio..."
                            className="flex-1 bg-transparent text-sm outline-none placeholder-gray-400 text-gray-700"
                            autoFocus
                        />
                        <button className="text-terracotta-500 font-bold p-1 rounded-full hover:bg-terracotta-50 transition-colors">
                            <span className="sr-only">Invia</span>
                            <Navigation className="w-5 h-5 rotate-90" />
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

// --- PLACE DETAILS VIEW (Simplified "Scheda") ---
const PlaceDetailsView = ({ place, onBack }) => {
    return (
        <div className="min-h-screen bg-gray-50 font-quicksand pb-24">
            {/* Header Image */}
            <div className="relative h-64">
                <img
                    src={place.images[0] || place.imageUrl}
                    alt={place.title}
                    className="w-full h-full object-cover"
                />
                <button
                    onClick={onBack}
                    className="absolute top-4 left-4 p-2 bg-white/90 rounded-full shadow-md text-gray-700 hover:bg-white transition-colors"
                >
                    <ArrowLeft size={20} />
                </button>
                <div className="absolute bottom-4 left-4">
                    <span className="bg-white text-gray-800 text-xs font-bold px-3 py-1 rounded-full shadow-sm uppercase tracking-wide">
                        {place.type === 'food' ? 'Ristorazione' : place.type === 'hotel' ? 'Ospitalità' : place.type === 'shop' ? 'Shopping' : 'Servizio'}
                    </span>
                </div>
            </div>

            <div className="px-5 py-6">
                {/* Title & Rating */}
                <div className="flex justify-between items-start mb-2">
                    <h1 className="text-2xl font-bold text-gray-900 leading-tight flex-1 mr-2">{place.title}</h1>
                    <div className="flex flex-col items-end">
                        <div className="flex items-center bg-green-50 px-2 py-1 rounded-lg border border-green-100">
                            <Star size={14} className="text-green-600 fill-current mr-1" />
                            <span className="font-bold text-green-700 text-sm">{place.rating}</span>
                        </div>
                    </div>
                </div>
                <p className="text-gray-500 text-sm mb-6 flex items-center">
                    <MapPin size={14} className="mr-1" /> {place.meetingPoint || place.location || "Google Maps"}
                </p>

                {/* Info Cards Row */}
                <div className="grid grid-cols-3 gap-3 mb-8">
                    <div className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 text-center">
                        <div className="text-xs text-gray-400 font-bold uppercase mb-1">Prezzo</div>
                        <div className="font-black text-gray-800 text-sm">{typeof place.price === 'number' ? `€${place.price}` : place.price}</div>
                    </div>
                    <div className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 text-center">
                        <div className="text-xs text-gray-400 font-bold uppercase mb-1">Orari</div>
                        <div className="font-black text-green-600 text-sm">Aperto</div>
                    </div>
                    <div className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 text-center">
                        <div className="text-xs text-gray-400 font-bold uppercase mb-1">Distanza</div>
                        <div className="font-black text-gray-800 text-sm">0.2 km</div>
                    </div>
                </div>

                {/* Description */}
                <div className="mb-8">
                    <h3 className="font-bold text-gray-800 mb-2">Descrizione</h3>
                    <p className="text-gray-600 text-sm leading-relaxed">
                        {place.description}
                    </p>
                </div>

                {/* Highlights (Punti di Forza) */}
                <div className="mb-8">
                    <h3 className="font-bold text-gray-800 mb-3">Punti di Forza</h3>
                    <div className="flex flex-wrap gap-2">
                        {place.highlights && place.highlights.map((h, i) => (
                            <span key={i} className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-bold rounded-lg border border-gray-200">
                                {h.replace(/^[^\s]+\s/, '')} {/* Strip leading emoji if present */}
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            {/* Bottom Action Bar */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100 flex gap-3 z-50">
                <button
                    onClick={() => alert(`📞 Chiamata in corso verso ${place.title}...`)}
                    className="flex-1 bg-gray-100 text-gray-800 py-3.5 rounded-xl font-bold text-sm hover:bg-gray-200 transition-colors"
                >
                    Chiama
                </button>
                <button
                    onClick={() => alert(`✅ Azione avviata: ${place.type === 'food' ? 'Prenotazione Tavolo' : place.type === 'hotel' ? 'Verifica Disponibilità' : 'Visita Sito Web'}`)}
                    className="flex-[2] bg-black text-white py-3.5 rounded-xl font-bold text-sm hover:bg-gray-800 transition-colors shadow-lg"
                >
                    {place.type === 'food' ? 'Prenota Tavolo' : place.type === 'hotel' ? 'Vedi Disponibilità' : 'Visita Sito'}
                </button>
            </div>
        </div>
    );
};

export default function TourDetailsPage() {
    const { id } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const isGroupMode = searchParams.get('mode') === 'group';

    // 1. DATA RETRIEVAL (Unified Strategy)
    const [localTour, setLocalTour] = useState(null);

    // Initial Data Load
    // Initial Data Load
    useEffect(() => {
        let incoming = location.state?.tourData;

        // 🛡️ RECOVERY: If no state, check LocalStorage for AI Tours
        // This fixes the "Something went wrong" error when data isn't passed via navigation state
        if (!incoming && id && id.startsWith('ai-quiz-')) {
            try {
                const stored = localStorage.getItem(id);
                if (stored) {
                    incoming = JSON.parse(stored);
                    console.log("♻️ Recovered AI Tour from LocalStorage:", incoming);
                }
            } catch (e) {
                console.error("Failed to recover AI tour", e);
            }
        }

        if (incoming) {
            // Normalize incoming data to match the Rich UI expectations

            // Map MapPage 'category' to TourDetails 'type' if missing
            // Map categories: 'food' -> 'food', 'shop' -> 'shop', 'service' -> 'service'
            // If it's a 'tour_step' or generic, we might want to treat it as 'place' if it has a category like 'food'
            const rawType = incoming.type || incoming.category || 'generic';

            // Ensure we catch the "Place" types correctly
            let finalType = rawType;
            if (['food', 'restaurant', 'bar'].includes(rawType)) finalType = 'food';
            if (['hotel', 'accommodation'].includes(rawType)) finalType = 'hotel';
            if (['shop', 'store', 'craft'].includes(rawType)) finalType = 'shop';
            if (['service', 'facility'].includes(rawType)) finalType = 'service';

            // ANTI-HIJACK: If it's clearly a Tour (has title "Tour" or has waypoints), force type back to guide
            const isTour = (incoming.title && incoming.title.toLowerCase().includes('tour')) ||
                (incoming.waypoints && incoming.waypoints.length > 0) ||
                (incoming.steps && incoming.steps.length > 1);

            if (isTour) {
                finalType = 'guide';
            }

            setLocalTour({
                ...incoming,
                type: finalType,
                // Ensure array for images
                images: incoming.images || (incoming.image_urls && incoming.image_urls.length > 0 ? incoming.image_urls : null) || (incoming.image ? [incoming.image] : []) || (incoming.imageUrl ? [incoming.imageUrl] : []),
                // Defaults for rich fields if missing
                guide: incoming.guide || "DoveVai Guide",
                guide_id: incoming.guide_id || incoming.guideId || incoming.author_id || null,
                guideId: incoming.guide_id || incoming.guideId || incoming.author_id || null,
                guideAvatar: incoming.guideAvatar || "🤖",
                guideBio: incoming.guideBio || "Guida virtuale intelligente selezionata per te.",
                rating: incoming.rating || 4.5,
                reviews: incoming.reviews || 0,
                location: incoming.location || "Destinazione Tour",
                participants: incoming.participants || 0,
                maxParticipants: incoming.maxParticipants || 10,
                language: incoming.language || "Italiano", // Map language
                highlights: incoming.highlights || ["✨ Esperienza autentica", "📍 Tappe esclusive"],
                // ITINERARY MAPPING from Steps
                itinerary: (incoming.steps && incoming.steps.length > 0)
                    ? incoming.steps.map((s, i) => ({
                        time: `Tappa ${i + 1}`,
                        activity: s.title || `Punto ${i + 1}`,
                        emoji: "📍",
                        description: s.description
                    }))
                    : (incoming.itinerary || []),
                meetingPoint: incoming.meetingPoint || incoming.startPoint || "Punto di partenza sulla mappa",
                included: incoming.included || ["Itinerario digitale", "Supporto 24/7"],
                notIncluded: incoming.notIncluded || ["Biglietti musei (se non spec.)"],
                nextStart: incoming.nextStart || "Sempre disponibile"
            });
        }
    }, [location.state, id]);

    // Query for ID-based lookup if no state passed
    // Se l'URL contiene uno slug tipo "dovevai-...-d79f-4fdb-905a-c6381ce7683a", estrai l'UUID per getTourById
    const rawId = id || 1;
    const uuidMatch = typeof rawId === 'string' && rawId.length > 36 && rawId.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    const tourId = uuidMatch ? uuidMatch[0] : rawId;
    const fallbackData = tourDetailsMock[tourId] || tourDetailsMock[1];

    // Sempre fare fetch dal DB quando l'id è un UUID, così abbiamo guide_id anche se si arriva da Home/Esplora con state
    const isLikelyDbId = typeof tourId === 'string' && (tourId.length === 36 || /^[0-9a-f-]{36}$/i.test(tourId));
    const { data: queryTour } = useQuery({
        queryKey: ['tour', tourId],
        queryFn: async () => {
            return dataService.getTourById(tourId) || fallbackData;
        },
        enabled: isLikelyDbId,
        initialData: fallbackData
    });

    // Se abbiamo localTour (da Esplora/Home) ma queryTour ha guide_id, usiamo quello così "Richiedi Guida" funziona
    const hasGuideFromDb = queryTour && (queryTour.guide_id || queryTour.guideId);
    const tour = (localTour && hasGuideFromDb)
        ? { ...localTour, guide_id: queryTour.guide_id ?? queryTour.guideId, guide: queryTour.guide, guideAvatar: queryTour.guideAvatar, guideBio: queryTour.guideBio }
        : (localTour || queryTour || fallbackData);
    const [showRequestModal, setShowRequestModal] = useState(false);
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [showChatModal, setShowChatModal] = useState(false); // New state for Chat Modal
    const [nearbyPartners, setNearbyPartners] = useState([]);

    // Auto-open chat modal when navigating back from MapPage with openChat flag
    useEffect(() => {
        if (location.state?.openChat) {
            setShowChatModal(true);
            // Clear the flag so back/forward navigation doesn't re-trigger
            window.history.replaceState({ ...window.history.state, usr: { ...location.state, openChat: false } }, '');
        }
    }, [location.state?.openChat]);

    // Ensure guide info (nome, avatar, bio) sempre presi dalla guida reale che ha pubblicato il tour
    useEffect(() => {
        if (!tour?.guide_id) return;

        // Se abbiamo già un nome/avatar "reale", non fare nulla
        const genericNames = ['DoveVai Guide', 'Guida locale'];
        const hasRealName = tour.guide && !genericNames.includes(tour.guide);
        const hasRealAvatar = tour.guideAvatar && tour.guideAvatar !== '🤖';
        if (hasRealName && hasRealAvatar) return;

        let cancelled = false;
        const fetchGuideProfile = async () => {
            try {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('first_name, last_name, username, image_urls, bio')
                    .eq('id', tour.guide_id)
                    .single();

                if (cancelled || error || !data) return;

                setLocalTour(prev => {
                    const base = prev || tour;
                    return {
                        ...base,
                        guide: (`${data.first_name || ''} ${data.last_name || ''}`).trim() || data.username || base.guide || 'Guida locale',
                        guideAvatar: (Array.isArray(data.image_urls) ? data.image_urls[0] : data.image_urls) || base.guideAvatar || '👤',
                        guideBio: data.bio || base.guideBio,
                        guide_id: tour.guide_id,
                    };
                });
            } catch (e) {
                console.error('Failed to load guide profile', e);
            }
        };

        fetchGuideProfile();
        return () => { cancelled = true; };
    }, [tour?.guide_id, tour?.guide, tour?.guideAvatar]);

    useEffect(() => {
        if (!tour.id) return;

        // SKIP RPC FOR AI TOURS (They don't exist in DB)
        if (typeof tour.id === 'string' && tour.id.startsWith('ai-quiz-')) {
            console.log("🚫 Skipping Partner RPC for AI Tour");
            return;
        }

        const fetchPartners = async () => {
            // ... existing logic ...
            if (tour.routePath) {
                // Use new Map Service for precise filtering
                const nearby = await mapService.fetchNearbyActivities(tour.routePath, tour.city || tour.location);
                // Map to existing UI structure
                const mapped = nearby.map(n => ({
                    business_id: n.id,
                    company_name: n.name,
                    dist_meters: n.dist_meters,
                    category_tags: [n.category],
                    subscription_tier: n.level,
                    latitude: n.latitude,
                    longitude: n.longitude,
                    category: n.category
                }));
                setNearbyPartners(mapped);
            } else {
                const { data, error } = await supabase.rpc('get_nearby_partners_for_tour', { tour_id: tour.id, radius_meters: 1000 });
                if (data) setNearbyPartners(data);
            }
        };
        fetchPartners();
    }, [tour.id, tour.routePath, tour.city]);

    // --- RENDER PLACE VIEW OR TOUR VIEW ---
    const isPlace = ['hotel', 'food', 'shop', 'service'].includes(tour.type);

    if (isPlace) {
        return <PlaceDetailsView place={tour} onBack={() => navigate(-1)} />;
    }

    // --- STANDARD TOUR LOGIC ---
    // --- SMART CTA LOGIC ---
    // Abbiamo rimosso isAiTour per permettere ai tour generati su misura di godere della stessa bellissima interfaccia Full-Immersive
    const isGuideTour = tour.type !== 'self-guided' && !tour.isAiGenerated;

    // Mock Participants for Group Mode
    const groupParticipants = [
        { id: 1, name: "Sofia", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop" },
        { id: 2, name: "Marco", avatar: "https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=100&h=100&fit=crop" },
        { id: 3, name: "Elena", avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop" },
        { id: 4, name: "Luca", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop" },
        { id: 5, name: "Giulia", avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&h=100&fit=crop" },
    ];

    const navigateToMap = () => {
        // 🛡️ ROBUST WAYPOINT PARSING
        let safeWaypoints = [];
        let mapSteps = [];

        // Log for Debugging
        console.log("Navigating to Map with Tour Data:", tour);

        if (tour.waypoints && Array.isArray(tour.waypoints) && tour.waypoints.length > 0) {
            safeWaypoints = tour.waypoints;
        } else if (tour.steps && Array.isArray(tour.steps) && tour.steps.length > 0) {
            // Fallback: Build waypoints from steps (Handle both lat/lng and latitude/longitude)
            safeWaypoints = tour.steps.map(s => {
                const lat = s.latitude || s.lat;
                const lng = s.longitude || s.lng;
                return [parseFloat(lat), parseFloat(lng)];
            });
            mapSteps = tour.steps;
        }

        // 🛡️ NULL CHECK: If no valid path found, don't crash, just warn.
        if (safeWaypoints.length === 0 || safeWaypoints.some(pt => isNaN(pt[0]) || isNaN(pt[1]))) {
            console.error("❌ Tour has INVALID waypoints or steps!", tour);
            alert("Attenzione: Impossibile generare il percorso sulla mappa per questo tour.");
            return;
        }

        // Construct Tour Markers for Map
        const tourMarkers = safeWaypoints.map((point, index) => {
            const [lat, lng] = Array.isArray(point) ? point : [point.latitude, point.longitude];
            // Try to find step details
            const stepDetail = mapSteps[index] || (tour.steps && tour.steps[index]);

            return {
                id: `${tour.id}-step-${index}`,
                name: stepDetail ? stepDetail.title : `Tappa ${index + 1}`,
                latitude: lat,
                longitude: lng,
                category: 'tour_step',
                type: 'tour_step', // Ensure type is set for icon mapping
                index: index,
                description: stepDetail?.description || `Tappa numero ${index + 1}`,
                // 🔑 Use step-level image (real photo) instead of tour-level image
                image: stepDetail?.image || (tour.images && tour.images[0]) || tour.image || null,
                // Pass city info for Google Places photo resolution on map popup
                city: tour.city || tour.location?.split(',')[0]?.trim() || '',
            };
        });

        // Map Nearby Partners to Markers
        // ... (Partner mapping logic remains same or similar)

        navigate('/map', {
            state: {
                tourData: {
                    id: tour.id,
                    title: tour.title,
                    waypoints: safeWaypoints,
                    steps: tour.steps, // Pass full steps
                    mode: isGroupMode ? 'group_tour' : 'tour',
                    routePath: tour.routePath, // Pass route path
                    center: tour.center, // ⚡ CRITICAL: Pass explicit center for Map Page
                    // Guide contact context — needed for "Contatta Guida" button in MapPage
                    guide_id: tour.guide_id || tour.guideId || null,
                    guide: tour.guide || null,
                    guideAvatar: tour.guideAvatar || null,
                    tourId: tour.id,
                },
                // Pass markers explicitly so MapPage doesn't have to guess
                customActivities: tourMarkers
            }
        });
    };

    const handleSmartAction = () => {
        if (isGroupMode) {
            alert(`Ti sei unito al gruppo di ${groupParticipants[0].name}! \nCi vediamo al punto di incontro.`);
            navigateToMap();
        } else if (isGuideTour) {
            setShowRequestModal(true);
        } else {
            navigateToMap();
        }
    };

    if (!localTour && !queryTour && !tourDetailsMock[tourId]) return <div>Caricamento...</div>;

    const handleFeatureIncoming = () => {
        alert("✨ Funzione in arrivo!\nStiamo finalizzando la chat diretta con le guide.");
    };

    const handleChatClick = () => {
        setShowChatModal(true);
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-ochre-100 to-ochre-200 font-quicksand">
            <TopBar />

            <main className="max-w-md mx-auto pb-24">
                {/* --- HERO SECTION --- */}
                <div className="relative">
                    <motion.img
                                src={getItemImage(tour, tour.city)}
                                onError={imgOnError(tour.city)}
                                alt={tour.title}
                                className="w-full h-80 object-cover"
                                initial={{ scale: 1.2, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ duration: 0.8 }}
                            />

                            {/* Overlay Controls */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent">
                                <div className="absolute top-4 left-4">
                                    <motion.button
                                        onClick={() => navigate(-1)}
                                        className="p-3 rounded-full bg-white/80 backdrop-blur-sm hover:bg-white transition-colors"
                                        whileHover={{ scale: 1.1 }}
                                        whileTap={{ scale: 0.9 }}
                                    >
                                        <ArrowLeft className="w-6 h-6 text-gray-700" />
                                    </motion.button>
                                </div>

                                <div className="absolute top-4 right-4 flex space-x-2">
                                    <motion.button
                                        className="p-3 rounded-full bg-white/80 backdrop-blur-sm hover:bg-white transition-colors"
                                        whileHover={{ scale: 1.1, rotate: 15 }}
                                        whileTap={{ scale: 0.9 }}
                                        onClick={() => {
                                            const heart = document.getElementById('heart-icon');
                                            heart.classList.toggle('text-red-500');
                                            heart.classList.toggle('fill-current');
                                            alert("❤️ Aggiunto ai preferiti!");
                                        }}
                                    >
                                        <Heart id="heart-icon" className="w-6 h-6 text-gray-700" />
                                    </motion.button>
                                    <motion.button
                                        className="p-3 rounded-full bg-white/80 backdrop-blur-sm hover:bg-white transition-colors"
                                        whileHover={{ scale: 1.1, rotate: -15 }}
                                        whileTap={{ scale: 0.9 }}
                                        onClick={() => {
                                            if (navigator.share) {
                                                navigator.share({
                                                    title: tour.title,
                                                    text: `Guarda questo tour a ${tour.city}: ${tour.title}`,
                                                    url: window.location.href,
                                                });
                                            } else {
                                                navigator.clipboard.writeText(window.location.href);
                                                alert("🔗 Link copiato negli appunti!");
                                            }
                                        }}
                                    >
                                        <Share2 className="w-6 h-6 text-gray-700" />
                                    </motion.button>
                                </div>

                                {/* Live/Type Badge */}
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
                                {!tour.live && (
                                    <div className="absolute bottom-4 left-4 bg-white/90 text-terracotta-600 px-4 py-2 rounded-full font-bold text-sm shadow-lg">
                                        {isGroupMode ? '👥 Gruppo Privato' : (isGuideTour ? '👤 Tour Guidato' : '🗺️ Self-Guided')}
                                    </div>
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
                                    <div className="flex-1 mr-4">
                                        <h1 className="text-2xl font-bold text-gray-800 mb-2">{tour.title}</h1>
                                        <p className="text-gray-600 leading-relaxed text-sm">{tour.description}</p>
                                    </div>
                                    {/* Price Button REMOVED as requested */}
                                </div>

                                {/* Real Data Badges */}
                                <div className="flex gap-4 text-xs font-bold text-gray-500 mb-2">
                                    <span className="flex items-center gap-1 bg-white px-3 py-1.5 rounded-full shadow-sm border border-gray-100">
                                        <Users size={14} className="text-gray-400" /> Max {tour.maxParticipants} Pers
                                    </span>
                                    <span className="flex items-center gap-1 bg-white px-3 py-1.5 rounded-full shadow-sm border border-gray-100">
                                        <MessageCircle size={14} className="text-gray-400" /> {tour.language}
                                    </span>
                                </div>
                            </motion.div>
                        </div>

                {/* --- SOCIAL BLOCK (Group Mode Only) --- */}
                {isGroupMode && (
                    <motion.div
                        className="bg-purple-50 border-2 border-purple-200 rounded-3xl p-6 relative overflow-hidden"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.6 }}
                    >
                        <div className="absolute top-0 right-0 w-24 h-24 bg-purple-100 rounded-bl-full -mr-4 -mt-4 opacity-50" />

                        <h3 className="font-bold text-gray-800 mb-4 flex items-center relative z-10">
                            <span className="text-2xl mr-2">💌</span>
                            Invito Speciale
                        </h3>

                        <p className="text-sm text-gray-700 font-medium mb-4 relative z-10">
                            Ti stai unendo a <span className="font-bold text-purple-700">{groupParticipants[0].name}</span> e altri {groupParticipants.length - 1} esploratori per vivere questa storia dal vivo.
                        </p>

                        <div className="flex items-center justify-between relative z-10">
                            <div className="flex space-x-2">
                                {/* Simple Avatar Stack */}
                                <div className="flex -space-x-3">
                                    {groupParticipants.map((p, i) => (
                                        <div key={p.id} className="w-10 h-10 rounded-full border-2 border-white overflow-hidden" style={{ zIndex: 10 - i }}>
                                            <img src={p.avatar} alt={p.name} className="w-full h-full object-cover" />
                                        </div>
                                    ))}
                                    <div className="w-10 h-10 rounded-full border-2 border-white bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-500" style={{ zIndex: 0 }}>
                                        +2
                                    </div>
                                </div>
                            </div>
                            <div className="text-xs font-bold text-purple-600 bg-white px-3 py-1 rounded-full shadow-sm">
                                Confermati
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* --- GUIDE OR AI SUMMARY SECTION --- */}
                {isGuideTour ? (
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
                                    <button
                                        onClick={handleChatClick}
                                        className="flex-1 bg-terracotta-400 text-white px-3 py-2 rounded-xl text-xs font-bold hover:bg-terracotta-500 transition-colors flex justify-center gap-1"
                                    >
                                        <MessageCircle size={14} /> Chat
                                    </button>
                                    <button
                                        onClick={() => setShowProfileModal(true)}
                                        className="flex-1 bg-olive-400 text-white px-3 py-2 rounded-xl text-xs font-bold hover:bg-olive-500 transition-colors flex justify-center gap-1"
                                    >
                                        <Users size={14} /> Profilo
                                    </button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                ) : null}

                {/* GUIDE PROFILE MODAL */}
                <GuideProfileModal
                    isOpen={showProfileModal}
                    onClose={() => setShowProfileModal(false)}
                    guideName={tour.guide}
                    guideAvatar={tour.guideAvatar}
                    bio={tour.guideBio}
                    rating={tour.rating}
                    reviews={tour.reviews}
                />

                {/* GUIDE CHAT MODAL */}
                <GuideChatModal
                    isOpen={showChatModal}
                    onClose={() => setShowChatModal(false)}
                    guideName={tour.guide}
                    guideAvatar={tour.guideAvatar}
                />

                {/* ⬇️ STANDARD SECTIONS ⬇️ */}
                <>
                        {/* Info Grid */}
                        <motion.div
                            className="grid grid-cols-2 gap-4"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8, delay: 0.4 }}
                        >
                            <div className="bg-white/70 rounded-2xl p-4 text-center">
                                <MapPin className="w-6 h-6 text-terracotta-400 mx-auto mb-2" />
                                <div className="text-xs text-gray-500 mb-1">Dove</div>
                                <div className="font-bold text-gray-800 text-sm">{tour.location}</div>
                            </div>
                            <div className="bg-white/70 rounded-2xl p-4 text-center">
                                <Clock className="w-6 h-6 text-terracotta-400 mx-auto mb-2" />
                                <div className="text-xs text-gray-500 mb-1">Durata</div>
                                <div className="font-bold text-gray-800 text-sm">{tour.duration}</div>
                            </div>
                            <div className="bg-white/70 rounded-2xl p-4 text-center">
                                <Users className="w-6 h-6 text-terracotta-400 mx-auto mb-2" />
                                <div className="text-xs text-gray-500 mb-1">Partecipanti</div>
                                <div className="font-bold text-gray-800 text-sm">{tour.participants}/{tour.maxParticipants}</div>
                            </div>
                            <div className="bg-white/70 rounded-2xl p-4 text-center">
                                <Calendar className="w-6 h-6 text-terracotta-400 mx-auto mb-2" />
                                <div className="text-xs text-gray-500 mb-1">Prossimo</div>
                                <div className="font-bold text-gray-800 text-sm">{tour.nextStart}</div>
                            </div>
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
                                    >
                                        <div className="text-xl">✨</div>
                                        <span className="font-medium text-gray-700 text-sm">{highlight.replace(/^[^\s]+\s/, '')}</span>
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
                                {(tour.itinerary || (tour.steps ? tour.steps.map((s,i) => ({ time: `Tappa ${i+1}`, emoji: '📍', activity: s.title || s.label || `Destinazione ${i+1}`})) : [])).map((item, index) => (
                                    <motion.div
                                        key={index}
                                        className="flex items-center space-x-4 p-3 bg-gradient-to-r from-terracotta-50 to-ochre-50 rounded-xl"
                                        initial={{ opacity: 0, x: -30 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ duration: 0.6, delay: 1 + index * 0.1 }}
                                    >
                                        <div className="bg-terracotta-400 text-white px-3 py-1 rounded-lg font-bold text-xs whitespace-nowrap">
                                            {item.time}
                                        </div>
                                        <div className="text-xl">{item.emoji}</div>
                                        <div className="flex-1 font-medium text-gray-700 text-sm">{item.activity}</div>
                                    </motion.div>
                                ))}
                            </div>
                        </motion.div>

                        {/* Nearby Partners Section */}
                        {nearbyPartners.length > 0 && (
                            <motion.div
                                className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-3xl p-6 mb-6"
                                initial={{ opacity: 0, y: 30 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.8 }}
                            >
                                <h3 className="font-bold text-gray-800 mb-4 flex items-center">
                                    <span className="text-2xl mr-2">🤝</span>
                                    Consigliati nei dintorni
                                </h3>
                                <div className="space-y-3">
                                    {nearbyPartners.map((partner) => (
                                        <div key={partner.business_id} className="bg-white p-4 rounded-xl flex items-center justify-between shadow-sm">
                                            <div>
                                                <h4 className="font-bold text-gray-900">{partner.company_name}</h4>
                                                <div className="flex gap-2 text-xs mt-1">
                                                    {partner.category_tags && partner.category_tags.map(tag => (
                                                        <span key={tag} className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md">{tag}</span>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <span className="block font-bold text-blue-600 text-sm">{(partner.dist_meters).toFixed(0)}m</span>
                                                {partner.subscription_tier === 'elite' && <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded uppercase font-bold">Consigliato</span>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </motion.div>
                        )}

                        {/* Meeting Point & Map Preview */}
                        <motion.div
                            className="bg-gradient-to-r from-green-100 to-green-200 rounded-3xl p-6"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.8, delay: 1.2 }}
                        >
                            <h3 className="font-bold text-gray-800 mb-4 flex items-center">
                                <span className="text-2xl mr-2">📍</span>
                                Mappatura
                            </h3>
                            <div className="bg-white/60 rounded-xl p-4">
                                <p className="font-medium text-gray-700 mb-3">{tour.meetingPoint === "Punto di partenza sulla mappa" ? "Percorso completo sulla mappa interattiva" : tour.meetingPoint}</p>
                                <button
                                    onClick={navigateToMap}
                                    className="w-full bg-green-500 text-white px-4 py-2 rounded-xl font-medium hover:bg-green-600 transition-colors flex items-center justify-center space-x-2"
                                >
                                    <Navigation className="w-4 h-4" />
                                    <span>Guarda la Mappa</span>
                                </button>
                            </div>
                        </motion.div>

                        {/* Included/Not Included */}
                        <motion.div
                            className="grid grid-cols-1 md:grid-cols-2 gap-6"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8, delay: 1.4 }}
                        >
                            <div className="bg-white/80 rounded-2xl p-6">
                                <h4 className="font-bold text-gray-800 mb-4 flex items-center text-sm"><CheckCircle size={16} className="mr-2 text-green-500" /> Incluso</h4>
                                <div className="space-y-2">
                                    {tour.included.map((item, i) => (
                                        <div key={i} className="flex items-center space-x-2 text-xs text-gray-700">
                                            <div className="w-1.5 h-1.5 bg-green-400 rounded-full" />
                                            <span>{item}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="bg-white/80 rounded-2xl p-6">
                                <h4 className="font-bold text-gray-800 mb-4 flex items-center text-sm"><XCircle size={16} className="mr-2 text-red-500" /> Non Incluso</h4>
                                <div className="space-y-2">
                                    {tour.notIncluded.map((item, i) => (
                                        <div key={i} className="flex items-center space-x-2 text-xs text-gray-700">
                                            <div className="w-1.5 h-1.5 bg-red-400 rounded-full" />
                                            <span>{item}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </motion.div>

                        {/* --- SMART CTA BUTTONS --- */}
                        <motion.div
                            className="pt-4"
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8, delay: 2 }}
                        >
                            <button
                                onClick={handleSmartAction}
                                className={`w-full py-4 rounded-2xl font-bold text-white shadow-xl hover:shadow-2xl transition-all duration-300 flex items-center justify-center space-x-2 text-lg transform active:scale-95 ${isGroupMode
                                    ? "bg-gradient-to-r from-purple-500 to-indigo-600 shadow-purple-500/30"
                                    : (isGuideTour ? "bg-gray-800 hover:bg-black" : "bg-gradient-to-r from-terracotta-400 to-terracotta-600")
                                    }`}
                            >
                                {isGroupMode ? (
                                    <>
                                        <Users className="w-6 h-6" />
                                        <span>Unisciti al Gruppo</span>
                                    </>
                                ) : (
                                    isGuideTour ? (
                                        <>
                                            <MessageCircle className="w-6 h-6" />
                                            <span>Richiedi Guida</span>
                                        </>
                                    ) : (
                                        <>
                                            <Play className="w-6 h-6 fill-current" />
                                            <span>Avvia Itinerario</span>
                                        </>
                                    )
                                )}
                            </button>
                            <p className="text-center text-xs text-gray-500 mt-2">
                                {isGroupMode
                                    ? "Ti unirai ufficialmente alla lista dei partecipanti."
                                    : (isGuideTour ? "Invierai una richiesta non vincolante alla guida." : "Navigazione GPS inclusa. Clicca per iniziare.")}
                            </p>
                        </motion.div>
                    </>


            </main >

            <BottomNavigation />

            {/* REQUEST MODAL */}
            <RequestModal
                isOpen={showRequestModal}
                onClose={() => setShowRequestModal(false)}
                guideName={tour.guide}
                tourTitle={tour.title}
                guideId={tour.guide_id || tour.guideId}
                tourId={tour.id}
                city={tour.city || tour.location}
            />
        </div >
    );
}

