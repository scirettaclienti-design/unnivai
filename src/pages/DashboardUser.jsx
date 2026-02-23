import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Users, Brain, Zap, MapPin, ThermometerSun, Compass, Clock, Star, ChevronRight, Gamepad2, Gift, X, CloudRain, Sun, Snowflake, CheckCircle, Loader2 } from 'lucide-react';
import { aiRecommendationService } from '@/services/aiRecommendationService';
import { useUserContext } from '../hooks/useUserContext';
import BottomNavigation from '../components/BottomNavigation';
import TopBar from "@/components/TopBar";
import { motion, AnimatePresence } from 'framer-motion';
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
        emoji: "👵🍝"
    },
    {
        id: 2,
        type: "guide",
        title: `Street Art - ${cityName}`,
        location: `${cityName}, Quartiere Artistico`,
        rating: 4.8,
        reviews: 89,
        price: 25,
        duration: "2h",
        image: "https://images.unsplash.com/photo-1539650116574-75c0c6d73f6e?w=600&h=400&fit=crop&q=80",
        category: "art",
        emoji: "🎨"
    },
    {
        id: 3,
        type: "guide",
        title: `Tramonto su ${cityName}`,
        location: `${cityName}, Belvedere`,
        rating: 4.9,
        reviews: 215,
        price: 30,
        duration: "1.5h",
        image: "https://images.unsplash.com/photo-1523906834658-6e24ef2386f9?w=600&h=400&fit=crop&q=80",
        category: "romance",
        emoji: "🌅"
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
        emoji: "👣"
    },
    {
        id: 5,
        type: "guide",
        title: `Aperitivo a ${cityName}`,
        location: `${cityName}, Piazza Principale`,
        rating: 4.5,
        reviews: 110,
        price: 20,
        duration: "1.5h",
        image: "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=600&h=400&fit=crop&q=80",
        category: "food",
        emoji: "🍷"
    }
];

const DashboardUser = () => {
    const { firstName, city, temperatureC, weatherCondition, isLoading } = useUserContext();
    const navigate = useNavigate();
    const [showCustomOptions, setShowCustomOptions] = useState(false);
    const [showNotificationPreview, setShowNotificationPreview] = useState(false);
    const [toast, setToast] = useState(null); // { title, message, type }
    const toastTimerRef = useRef(null);

    // Realtime subscription for notifications (guide actions)
    useEffect(() => {
        let channel;
        const setupSubscription = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            channel = supabase
                .channel(`user_notifications_${user.id}`)
                .on('postgres_changes', {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${user.id}`
                }, (payload) => {
                    const n = payload.new;
                    // Show in-app toast
                    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
                    setToast({ title: n.title, message: n.message, type: n.type });
                    toastTimerRef.current = setTimeout(() => setToast(null), 5500);
                })
                .subscribe();
        };
        setupSubscription();
        return () => { if (channel) supabase.removeChannel(channel); };
    }, []);

    const [showRequestModal, setShowRequestModal] = useState(false);
    const [requestText, setRequestText] = useState('');
    const [requestStatus, setRequestStatus] = useState('idle'); // idle, submitting, success, error
    const [requestCity, setRequestCity] = useState('Roma'); // City chosen for the tour request

    const handleGuideRequest = () => {
        setRequestStatus('idle');
        setRequestCity(city || 'Roma'); // pre-set to user's current city
        setShowRequestModal(true);
    };

    const submitGuideRequest = async () => {
        if (!requestText.trim()) return;

        setRequestStatus('submitting');
        try {
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) throw new Error('Devi effettuare il login per inviare una richiesta.');

            // Create request with .select() to detect silent RLS failures
            const { data: insertedData, error } = await supabase
                .from('guide_requests')
                .insert({
                    user_id: user.id,
                    user_name: firstName || 'Ospite',
                    city: requestCity,
                    status: 'open',
                    category: 'custom',
                    duration: 3,
                    request_text: requestText,
                    created_at: new Date().toISOString()
                })
                .select();

            if (error) {
                console.error('[submitGuideRequest] DB Error:', error);
                throw error;
            }

            if (!insertedData || insertedData.length === 0) {
                console.error('[submitGuideRequest] Silent RLS block: insert returned empty');
                throw new Error('Permesso negato dal database. Verifica di essere loggato come utente.');
            }

            console.log('[submitGuideRequest] Success! Request inserted:', insertedData[0]);
            setRequestStatus('success');
        } catch (e) {
            console.error('[submitGuideRequest] Exception:', e);
            setRequestStatus('error');
        }
    };

    // Fetch Experiences
    const { data: experiences } = useQuery({
        queryKey: ['home-experiences', city],
        queryFn: async () => {
            const currentCity = city || 'Roma';
            try {
                const tours = await dataService.getToursByCity(currentCity);
                if (tours && tours.length > 0) return tours.slice(0, 5);
            } catch (e) {
                console.warn("Failed to fetch tours, using fallback", e);
            }
            return generateCityExperiences(currentCity);
        },
        initialData: generateCityExperiences('Roma')
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-ochre-100 to-ochre-200 font-quicksand pb-32">

            <TopBar />

            <main className="max-w-md mx-auto px-6 space-y-6 pt-6">



                {/* Custom Tour Block - EXPANDABLE */}
                <motion.div
                    className="bg-white rounded-3xl p-5 shadow-lg border border-gray-50 relative overflow-hidden group cursor-pointer"
                    initial={{ height: 'auto' }}
                    onClick={() => setShowCustomOptions(!showCustomOptions)}
                >
                    <div className="flex items-center justify-between relative z-10">
                        <div>
                            <h3 className="font-bold text-gray-800 text-lg leading-tight">Crea il tuo Tour</h3>
                            <p className="text-xs text-gray-500 mt-1 font-medium bg-gray-100 px-2 py-0.5 rounded-full w-fit">Su misura per te</p>
                        </div>
                        <div className={`transition-transform duration-300 ${showCustomOptions ? 'rotate-180' : ''}`}>
                            <div className="bg-orange-50 p-3 rounded-full group-hover:bg-orange-100 transition-colors">
                                <Compass className="w-7 h-7 text-orange-500" />
                            </div>
                        </div>
                    </div>

                    {/* Decorative background */}
                    <div className="absolute right-0 top-0 w-32 h-full bg-gradient-to-l from-orange-50/50 to-transparent skew-x-12 pointer-events-none" />

                    {/* Expanded Options */}
                    <AnimatePresence>
                        {showCustomOptions && (
                            <motion.div
                                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                                animate={{ opacity: 1, height: 'auto', marginTop: 20 }}
                                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                                className="grid grid-cols-2 gap-3"
                            >
                                <div onClick={handleGuideRequest} className="cursor-pointer bg-orange-50 hover:bg-orange-100 p-4 rounded-2xl flex flex-col items-center justify-center text-center transition-colors">
                                    <Users size={24} className="text-orange-600 mb-2" />
                                    <span className="text-xs font-bold text-gray-800 leading-tight">Con Guida</span>
                                    <span className="text-[10px] text-gray-500 mt-1">Trova un esperto locale</span>
                                </div>
                                <Link to="/surprise-tour" className="bg-pink-50 hover:bg-pink-100 p-4 rounded-2xl flex flex-col items-center justify-center text-center transition-colors">
                                    <Gift size={24} className="text-pink-600 mb-2" />
                                    <span className="text-xs font-bold text-gray-800 leading-tight">Sorprendimi</span>
                                    <span className="text-[10px] text-gray-500 mt-1">Lasciati sorprendere</span>
                                </Link>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>

                {/* Core Section - SMART GLASS BUTTONS */}
                <section className="flex flex-col space-y-5">

                    {/* Button 1: Guide Locali */}
                    <Link to="/explore" className="block">
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

                    {/* Button 3: Quick Quiz (Previously 'Ispirami Ora') */}
                    <div className="relative">
                        <Link to="/quick-path" className="block">
                            <motion.div
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
                                            <Gamepad2 className="w-8 h-8 text-white drop-shadow-md" />
                                        </div>
                                        <div>
                                            {/* Speaking Badge */}
                                            <div className="mb-1">
                                                <span className="bg-white/90 text-amber-600 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wide shadow-sm flex w-fit items-center">
                                                    <Brain className="w-3 h-3 mr-1" />
                                                    AI Powered
                                                </span>
                                            </div>
                                            <h3 className="text-xl font-bold font-playfair text-white leading-tight">Quiz Veloce</h3>
                                            <p className="text-amber-50 text-xs font-medium mt-0.5 opacity-90">Scopri il tuo stile di viaggio</p>
                                        </div>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-white/50 group-hover:translate-x-1 transition-transform" />
                                </div>
                            </motion.div>
                        </Link>
                    </div>

                </section>

                {/* Footer Section - Magazine Style Experiences */}
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

            {/* Custom Request Modal */}
            <AnimatePresence>
                {showRequestModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                            onClick={() => setShowRequestModal(false)}
                        />
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="bg-white w-full max-w-md rounded-3xl p-6 relative z-10 shadow-2xl overflow-hidden"
                        >
                            <button
                                onClick={() => setShowRequestModal(false)}
                                className="absolute top-4 right-4 p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors z-20"
                            >
                                <X size={20} className="text-gray-500" />
                            </button>

                            {requestStatus === 'success' ? (
                                <motion.div
                                    initial={{ scale: 0.8, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    className="pt-6 pb-2 text-center flex flex-col items-center"
                                >
                                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6 relative">
                                        <motion.div
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
                                        >
                                            <CheckCircle className="w-10 h-10 text-green-500" />
                                        </motion.div>
                                    </div>
                                    <h3 className="text-2xl font-bold text-gray-800 mb-2">Richiesta Inviata!</h3>
                                    <p className="text-gray-500 text-sm mb-8 leading-relaxed px-4">
                                        Fantastico! Le guide locali su <strong>{city || 'Roma'}</strong> hanno appena ricevuto la tua ispirazione.<br /><br />Ti contatteranno presto con una proposta personalizzata.
                                    </p>
                                    <button
                                        onClick={() => {
                                            setShowRequestModal(false);
                                            setRequestText('');
                                            setRequestStatus('idle');
                                        }}
                                        className="w-full bg-gray-900 text-white font-bold py-4 rounded-xl hover:bg-black transition-all shadow-lg active:scale-95"
                                    >
                                        Chiudi e prosegui
                                    </button>
                                </motion.div>
                            ) : (
                                <>
                                    <div className="text-center mb-6">
                                        <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <Compass className="w-8 h-8 text-orange-600" />
                                        </div>
                                        <h3 className="text-2xl font-bold text-gray-800">Tour su Misura</h3>
                                        <p className="text-gray-500 text-sm mt-1">Le guide riceveranno la tua richiesta in base alla città scelta.</p>
                                    </div>

                                    <div className="space-y-4">
                                        {/* City Selector */}
                                        <div>
                                            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Città del Tour</label>
                                            <select
                                                value={requestCity}
                                                onChange={(e) => setRequestCity(e.target.value)}
                                                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-700 font-semibold focus:outline-none focus:ring-2 focus:ring-orange-400 transition-all"
                                                disabled={requestStatus === 'submitting'}
                                            >
                                                <option value="Roma">📍 Roma</option>
                                                <option value="Milano">📍 Milano</option>
                                                <option value="Firenze">📍 Firenze</option>
                                                <option value="Venezia">📍 Venezia</option>
                                                <option value="Napoli">📍 Napoli</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">La tua idea</label>
                                            <textarea
                                                value={requestText}
                                                onChange={(e) => setRequestText(e.target.value)}
                                                placeholder="Vorrei visitare i mercati storici e assaggiare lo street food locale..."
                                                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 min-h-[120px] focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all resize-none text-gray-700 disabled:opacity-50"
                                                autoFocus
                                                disabled={requestStatus === 'submitting'}
                                            />
                                        </div>
                                    </div>

                                    {requestStatus === 'error' && (
                                        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm text-center font-bold">
                                            Si è verificato un errore. Riprova.
                                        </div>
                                    )}

                                    <button
                                        onClick={submitGuideRequest}
                                        disabled={requestStatus === 'submitting' || requestText.trim().length === 0}
                                        className="w-full bg-orange-600 text-white font-bold py-4 rounded-xl hover:bg-orange-700 transition-all shadow-lg shadow-orange-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                        {requestStatus === 'submitting' ? (
                                            <>
                                                <Loader2 className="w-5 h-5 animate-spin" /> Invio in corso...
                                            </>
                                        ) : (
                                            `Invia alle Guide di ${requestCity}`
                                        )}
                                    </button>
                                </>
                            )}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* ===== IN-APP TOAST NOTIFICATION ===== */}
            <AnimatePresence>
                {toast && (
                    <motion.div
                        initial={{ y: -80, opacity: 0, scale: 0.95 }}
                        animate={{ y: 0, opacity: 1, scale: 1 }}
                        exit={{ y: -80, opacity: 0, scale: 0.95 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                        className="fixed top-4 left-4 right-4 z-[100] max-w-md mx-auto"
                    >
                        <div className={`flex items-start gap-3 p-4 rounded-2xl shadow-2xl border backdrop-blur-md ${toast.type === 'request_declined'
                                ? 'bg-gray-900/95 border-gray-700'
                                : toast.type === 'price_offer'
                                    ? 'bg-orange-600/95 border-orange-500'
                                    : 'bg-green-600/95 border-green-500'
                            }`}>
                            {/* Icon */}
                            <div className="text-2xl flex-shrink-0 mt-0.5">
                                {toast.type === 'request_declined' ? '💬' : toast.type === 'price_offer' ? '💶' : '🎉'}
                            </div>
                            {/* Text */}
                            <div className="flex-1 min-w-0">
                                <p className="text-white font-bold text-sm leading-tight">{toast.title}</p>
                                <p className="text-white/80 text-xs mt-0.5 leading-relaxed">{toast.message}</p>
                            </div>
                            {/* Close */}
                            <button
                                onClick={() => setToast(null)}
                                className="text-white/60 hover:text-white transition-colors flex-shrink-0 mt-0.5"
                            >
                                <X size={16} />
                            </button>
                        </div>
                        {/* Progress bar */}
                        <motion.div
                            initial={{ scaleX: 1 }}
                            animate={{ scaleX: 0 }}
                            transition={{ duration: 5.5, ease: 'linear' }}
                            className={`h-0.5 rounded-full origin-left mt-1 ${toast.type === 'request_declined' ? 'bg-gray-500' :
                                    toast.type === 'price_offer' ? 'bg-orange-300' : 'bg-green-300'
                                }`}
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            <BottomNavigation />
        </div>
    );
};

export default DashboardUser;
