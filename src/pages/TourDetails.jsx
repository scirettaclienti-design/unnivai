import { motion } from "framer-motion";
import { supabase } from "../lib/supabase";
import { ArrowLeft, ArrowRight, MapPin, Clock, Star, Play, Heart, Share2, Users, Calendar, MessageCircle, Navigation, CheckCircle, XCircle, Sparkles, Brain } from "lucide-react";
import { Link, useParams, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useState, useEffect } from "react";
import TopBar from "../components/TopBar";
import { getItemImage, imgOnError } from "../utils/imageUtils";

import { useAuth } from "../context/AuthContext";
import BottomNavigation from "../components/BottomNavigation";
import BookingModal from "../components/BookingSystem";

import { Toast } from "../components/ToastNotification";
import { useToast } from "../hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { dataService, createGuideRequest } from "../services/dataService";
import { normalizeTour } from "../services/tourShape";
import { useAILearning } from "../hooks/useAILearning";


// UUID semplice: 8-4-4-4-12 caratteri esadecimali
const isValidGuideId = (id) => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

// Gate E-1 — Funzione pura per decidere quale UI mostrare quando tour non c'è.
// Estratta per essere testabile senza montare il componente (che dipende da
// AuthProvider, QueryClient, Router, useAILearning, dataService, ecc.).
//
// Ritorna:
//   'ready'     — c'è un tour, renderizza la scheda normale
//   'skeleton'  — id valido (UUID) + fetch in corso, non-crash friendly
//   'not-found' — id inesistente o fetch finita senza risultato
//
// Chiamata dal componente principale con:
//   getTourRenderState({
//     hasTour:        !!tour,
//     isLikelyDbId,   // UUID nell'URL
//     isQueryLoading, // useQuery in fetch
//     isQueryError,   // useQuery ha fallito
//   })
export function getTourRenderState({ hasTour, isLikelyDbId, isQueryLoading, isQueryError }) {
    if (hasTour) return 'ready';
    if (isLikelyDbId && isQueryLoading && !isQueryError) return 'skeleton';
    return 'not-found';
}

// --- INTERNAL MODAL COMPONENT ---
const RequestModal = ({ isOpen, onClose, guideName, tourTitle, guideId, tourId, city }) => {
    const { user } = useAuth();
    const { toast } = useToast();
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

            {/* Gate J2: rimossi bottoni "Chiama" e "Prenota Tavolo/Vedi Disponibilità/
                Visita Sito". Facevano toast falsi (📞 Chiamata in corso...) senza
                mai chiamare/prenotare davvero. Meglio nessun bottone che uno
                bugiardo (regola locked Ivano). Se il place ha un phone_number o
                booking_url reale (POIDetailDrawer li supporta già con window.open),
                l'azione va lì, non qui. */}
        </div>
    );
};

export default function TourDetailsPage() {
    const { id } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    // Gate K: isGroupMode + `?mode=group` deep link RIMOSSI. Il Group Mode non
    // esiste in V1. Ogni tour è un tour normale (self-guided o Guide-led).

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

            // DVAI-053: passo l'incoming al normalizer unificato. steps, itinerary,
            // image/images, guide vengono coerentemente settati dal normalizer
            // qualunque sia la sorgente (Per Te, SurpriseTour, AiItinerary, QuickPath, DB).
            // DVAI-055-b: `enforceRadius: !!incoming.isAiGenerated` — filtro raggio
            // solo sui tour AI. I tour DB di guida (V2) NON vengono filtrati: una
            // guida vera può disegnare "Roma → Ostia Antica" (~25 km) legittimamente.
            const normalized = normalizeTour(incoming, {
                cityFallback: incoming.city || 'Roma',
                enforceRadius: !!incoming.isAiGenerated,
                cityCenter: incoming.isAiGenerated && Number.isFinite(incoming.center?.latitude)
                    ? { latitude: incoming.center.latitude, longitude: incoming.center.longitude }
                    : null,
            });
            setLocalTour({
                ...normalized,
                type: finalType,
                // Solo i default specifici di TourDetails che non sono nel normalizer.
                guide_id: incoming.guide_id || incoming.guideId || incoming.author_id || null,
                guideId: incoming.guide_id || incoming.guideId || incoming.author_id || null,
                guideBio: normalized.guideBio || "Guida virtuale intelligente selezionata per te.",
                rating: normalized.rating ?? 4.5,
                reviews: normalized.reviews ?? 0,
                location: normalized.location || "Destinazione Tour",
                participants: normalized.participants ?? 0,
                maxParticipants: normalized.maxParticipants ?? 10,
                language: normalized.language || "Italiano",
                highlights: normalized.highlights || ["✨ Esperienza autentica", "📍 Tappe esclusive"],
                meetingPoint: normalized.meetingPoint || normalized.startPoint || "Punto di partenza sulla mappa",
                included: normalized.included || ["Itinerario digitale", "Supporto 24/7"],
                notIncluded: normalized.notIncluded || ["Biglietti musei (se non spec.)"],
                nextStart: normalized.nextStart || "Sempre disponibile",
            });
        }
    }, [location.state, id]);

    // Query for ID-based lookup if no state passed.
    // Se l'URL contiene uno slug tipo "dovevai-...-d79f-4fdb-905a-c6381ce7683a", estrai l'UUID per getTourById.
    // Gate D-1: nessun fallback mock. Se il DB non trova → null → schermata not-found onesta.
    const rawId = id || 1;
    const uuidMatch = typeof rawId === 'string' && rawId.length > 36 && rawId.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    const tourId = uuidMatch ? uuidMatch[0] : rawId;

    // Sempre fare fetch dal DB quando l'id è un UUID, così abbiamo guide_id anche se si arriva da Home/Esplora con state
    const isLikelyDbId = typeof tourId === 'string' && (tourId.length === 36 || /^[0-9a-f-]{36}$/i.test(tourId));
    const { data: queryTour, isLoading: isQueryLoading, isError: isQueryError } = useQuery({
        queryKey: ['tour', tourId],
        queryFn: async () => {
            const t = await dataService.getTourById(tourId);
            return t || null;
        },
        enabled: isLikelyDbId,
    });

    // Se abbiamo localTour (da Esplora/Home) ma queryTour ha guide_id, usiamo quello così "Richiedi Guida" funziona
    const hasGuideFromDb = queryTour && (queryTour.guide_id || queryTour.guideId);
    const rawTour = (localTour && hasGuideFromDb)
        ? { ...localTour, guide_id: queryTour.guide_id ?? queryTour.guideId, guide: queryTour.guide, guideAvatar: queryTour.guideAvatar, guideBio: queryTour.guideBio }
        : (localTour || queryTour || null);
    // DVAI-053: il `tour` consumato dal render passa SEMPRE per il normalizer.
    // Garantisce che le 2 sorgenti reali (location.state, queryTour DB) espongano
    // la stessa shape: steps[], itinerary[], image/imageUrl/images[].
    // DVAI-055-b: idem gated — filtro raggio solo su AI. Guide DB intatti.
    const tour = rawTour ? normalizeTour(rawTour, {
        cityFallback: rawTour.city || 'Roma',
        enforceRadius: !!rawTour.isAiGenerated,
        cityCenter: rawTour.isAiGenerated && Number.isFinite(rawTour.center?.latitude)
            ? { latitude: rawTour.center.latitude, longitude: rawTour.center.longitude }
            : null,
    }) : rawTour;
    const [showRequestModal, setShowRequestModal] = useState(false);
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [showChatModal, setShowChatModal] = useState(false);
    const [nearbyPartners, setNearbyPartners] = useState([]);
    const [guideRating, setGuideRating] = useState({ avg: 0, count: 0 });
    const [reviews, setReviews] = useState([]);
    const [ctaDisabled, setCtaDisabled] = useState(false);
    const { trackTourView } = useAILearning();

    // Track tour view per il preference graph
    useEffect(() => {
        if (tour?.id && tour?.city) trackTourView(tour);
    }, [tour?.id]);

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

    // Fetch rating + recensioni reali dalla tabella reviews
    useEffect(() => {
        const guideId = tour?.guide_id || tour?.guideId;
        if (!guideId || !isValidGuideId(guideId)) return;
        dataService.getGuideRatingAvg(guideId).then(setGuideRating);
        dataService.getReviewsByGuide(guideId).then(r => setReviews(r?.slice(0, 5) || []));
    }, [tour?.guide_id, tour?.guideId]);

    useEffect(() => {
        // Gate E-1: optional chaining su tour.* — senza fallbackData (killed in
        // Gate D-1) tour può essere null durante il primo render (fetch in corso
        // o id inesistente). Prima di Gate D-1, tourDetailsMock lo teneva sempre
        // truthy. Ora tour può essere null → l'effect deve tollerarlo.
        if (!tour?.id) return;

        // SKIP RPC FOR AI TOURS (They don't exist in DB)
        if (typeof tour.id === 'string' && tour.id.startsWith('ai-quiz-')) {
            console.log("🚫 Skipping Partner RPC for AI Tour");
            return;
        }

        const fetchPartners = async () => {
            // DVAI-029: mapService rimosso — usa sempre RPC Supabase
            const { data } = await supabase.rpc('get_nearby_partners_for_tour', { tour_id: tour.id, radius_meters: 1000 });
            if (data) setNearbyPartners(data);
        };
        fetchPartners();
    }, [tour?.id, tour?.routePath, tour?.city]);

    // Gate E-1: early return per tour=null (bug reintrodotto da Gate D-1 che ha
    // ucciso il fallbackData). Sta QUI, dopo l'ultimo useEffect e prima delle
    // espressioni body (isPlace/hasRealSteps/isMockTour/...) che leggono
    // tour.type/tour.steps/tour.id senza optional chaining.
    // Logica in getTourRenderState (funzione pura testabile).
    const renderState = getTourRenderState({
        hasTour: !!tour,
        isLikelyDbId,
        isQueryLoading: isQueryLoading,
        isQueryError: isQueryError,
    });
    if (renderState !== 'ready') {
        if (renderState === 'skeleton') {
            return (
                <div className="min-h-screen bg-gradient-to-b from-ochre-100 to-ochre-200 font-quicksand">
                    <TopBar />
                    <main className="max-w-md mx-auto px-4 py-8 pb-24">
                        <div className="animate-pulse space-y-4">
                            <div className="w-full h-56 bg-black/5 rounded-2xl" />
                            <div className="h-6 w-3/4 bg-black/5 rounded" />
                            <div className="h-4 w-1/2 bg-black/5 rounded" />
                            <div className="h-32 w-full bg-black/5 rounded-2xl mt-6" />
                        </div>
                    </main>
                    <BottomNavigation />
                </div>
            );
        }
        return (
            <div className="min-h-screen bg-gradient-to-b from-ochre-100 to-ochre-200 font-quicksand">
                <TopBar />
                <main className="max-w-md mx-auto px-4 py-16 pb-24 text-center">
                    <div className="text-6xl mb-4">🕰️</div>
                    <h1 className="text-2xl font-bold text-ochre-900 mb-2">Questo tour non esiste più.</h1>
                    <p className="text-ochre-700 mb-8">Forse è stato rimosso, o il link è cambiato. Torna alla home per scoprire cosa c'è oggi.</p>
                    <button
                        onClick={() => navigate('/dashboard-user')}
                        className="px-6 py-3 rounded-2xl bg-ochre-900 text-white font-semibold"
                    >
                        Torna alla home
                    </button>
                </main>
                <BottomNavigation />
            </div>
        );
    }

    // --- RENDER PLACE VIEW OR TOUR VIEW ---
    const isPlace = ['hotel', 'food', 'shop', 'service'].includes(tour.type);

    if (isPlace) {
        return <PlaceDetailsView place={tour} onBack={() => navigate(-1)} />;
    }

    // --- STANDARD TOUR LOGIC ---
    // --- SMART CTA LOGIC ---
    // Gate II.3 (16/07): isMockTour ora dipende SOLO dal flag esplicito
    // `tour.isDemoTour === true`. Prima il guard era una regola implicita
    // (id non-UUID + no steps + non-AI) che scattava sui tour REALI quando
    // applyRadiusFilter svuotava gli steps di un tema (es. "Verde relax" a
    // Troina): tour reale → badge "Tour di esempio" bugiardo.
    // Nuova regola locked (Ivano 16/07): un tour reale con un campo vuoto
    // NON e' un tour di esempio. Serve un flag ESPLICITO messo da chi crea
    // il tour intenzionalmente come demo (es. onboarding preview).
    // Zero call site oggi setta isDemoTour → nessun tour Home mostra piu'
    // il badge "Tour di esempio". Se in futuro serve un demo, va marcato
    // esplicitamente.
    const hasRealSteps = Array.isArray(tour.steps) && tour.steps.length > 0;
    const isAiSelfGuided = !!tour.isAiGenerated && hasRealSteps;
    const isMockTour = tour.isDemoTour === true;

    const isGuideTour = tour.type !== 'self-guided' && !tour.isAiGenerated;

    // Gate K: groupParticipants + intero Group Mode RIMOSSI. Era pressione
    // sociale fabbricata: 5 persone inesistenti (Sofia/Marco/Elena/Luca/Giulia)
    // con avatar Unsplash + badge "Confermati" + "altri 4 esploratori" mostrati
    // a un utente che il tour lo fa da solo. Group Mode non esiste in V1.
    // Se un giorno esisterà, sarà con persone vere dal DB.

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
            toast({ title: 'Attenzione: Impossibile generare il percorso sulla mappa per questo tour.', type: 'warning' });
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
                    mode: 'tour', // Gate K: Group Mode rimosso, mode è sempre 'tour'
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
        if (ctaDisabled) return;
        setCtaDisabled(true);
        setTimeout(() => setCtaDisabled(false), 2000); // debounce 2s

        // Gate K: rimosso il ramo isGroupMode (toast "Ti sei unito al gruppo
        // di Sofia!" era una finta unione a un gruppo inesistente).
        if (isGuideTour) {
            setShowRequestModal(true);
        } else {
            navigateToMap();
        }
    };

    // Gate E-1: schermata di errore spostata via da qui (era sotto handleCTAClick
    // ma dopo gli accessi non-optional a tour.type/tour.steps/tour.id che
    // crashavano con tour=null). Ora è subito dopo l'ultimo useEffect e prima
    // di qualsiasi espressione body che legga tour.*. Vedi ~riga 620.

    const handleFeatureIncoming = () => {
        toast({ title: '✨ Funzione in arrivo! Stiamo finalizzando la chat diretta con le guide.', type: 'info' });
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
                    {/* Placeholder blur gradient while image loads */}
                    <div className="absolute inset-0 h-80 bg-gradient-to-br from-orange-200 via-orange-100 to-amber-100" />
                    <motion.img
                                loading="eager"
                                src={getItemImage(tour, tour.city)}
                                onError={imgOnError(tour.city)}
                                alt={tour.title}
                                className="relative w-full h-80 object-cover"
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
                                            toast({ title: '❤️ Aggiunto ai preferiti!', type: 'success' });
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
                                                toast({ title: '🔗 Link copiato negli appunti!', type: 'success' });
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
                                        {isGuideTour ? '👤 Tour Guidato' : '🗺️ Self-Guided'}
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
                                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                                            {/* DVAI-012: Badge Demo per tour senza guida reale e SENZA contenuto AI */}
                                            {isMockTour && (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-amber-700 text-[10px] font-black uppercase tracking-widest">
                                                    🎭 Demo
                                                </span>
                                            )}
                                            {/* DVAI-049: Tour AI self-guided con narrativa: badge informativo, non warning */}
                                            {isAiSelfGuided && (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-100 border border-indigo-300 text-indigo-700 text-[10px] font-black uppercase tracking-widest">
                                                    🤖 Tour AI
                                                </span>
                                            )}
                                        </div>
                                        <h1 className="text-2xl font-bold text-gray-800 mb-2">{tour.title}</h1>
                                        <p className="text-gray-600 leading-relaxed text-sm">{tour.description}</p>
                                        {isMockTour && (
                                            <p className="text-amber-600 text-xs mt-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                                                ℹ️ Tour di esempio — prenotazione e contatto guida non disponibili. Esplora i tour reali nella sezione Esplora.
                                            </p>
                                        )}
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

                {/* Gate K: SOCIAL BLOCK Group Mode RIMOSSO — pressione sociale
                    fabbricata ("Ti stai unendo a Sofia e altri 4 esploratori"
                    + 5 avatar Unsplash + "Confermati" fake). Fuori. */}

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
                                        <span className="font-medium">{guideRating.count > 0 ? guideRating.avg : (tour.rating || '—')}</span>
                                        <span className="text-xs text-gray-500 ml-1">({guideRating.count > 0 ? guideRating.count : (tour.reviews || 0)} recensioni)</span>
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
                    rating={guideRating.count > 0 ? guideRating.avg : (tour.rating || 4.5)}
                    reviews={guideRating.count > 0 ? guideRating.count : (tour.reviews || 0)}
                />

                {/* GUIDE CHAT MODAL */}
                <GuideChatModal
                    isOpen={showChatModal}
                    onClose={() => setShowChatModal(false)}
                    guideName={tour.guide}
                    guideAvatar={tour.guideAvatar}
                />

                {/* --- SEZIONE RECENSIONI REALI --- */}
                {reviews.length > 0 && (
                    <motion.div
                        className="bg-white/80 rounded-3xl p-6"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.3 }}
                    >
                        <h3 className="font-bold text-gray-800 mb-4 flex items-center">
                            <span className="text-2xl mr-2">⭐</span>
                            Recensioni ({guideRating.count})
                        </h3>

                        {/* Rating summary */}
                        <div className="flex items-center gap-3 mb-5 p-3 bg-orange-50 rounded-xl">
                            <div className="text-3xl font-black text-orange-600">{guideRating.avg}</div>
                            <div className="flex-1">
                                <div className="flex gap-0.5 mb-1">
                                    {[1,2,3,4,5].map(s => (
                                        <Star key={s} className={`w-4 h-4 ${s <= Math.round(guideRating.avg) ? 'fill-orange-400 text-orange-400' : 'text-gray-300'}`} />
                                    ))}
                                </div>
                                <p className="text-xs text-gray-500">{guideRating.count} recensioni verificate</p>
                            </div>
                        </div>

                        {/* Review cards */}
                        <div className="space-y-3">
                            {reviews.map(review => (
                                <div key={review.id} className="border-b border-gray-100 pb-3 last:border-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center text-xs font-bold text-orange-600">
                                            {(review.profiles?.full_name || 'U').charAt(0)}
                                        </div>
                                        <span className="text-sm font-medium text-gray-800">
                                            {review.profiles?.full_name || 'Utente'}
                                        </span>
                                        <div className="flex gap-0.5 ml-auto">
                                            {[1,2,3,4,5].map(s => (
                                                <Star key={s} className={`w-3 h-3 ${s <= review.rating ? 'fill-orange-400 text-orange-400' : 'text-gray-200'}`} />
                                            ))}
                                        </div>
                                    </div>
                                    {review.comment && (
                                        <p className="text-sm text-gray-600 leading-relaxed ml-9">{review.comment}</p>
                                    )}
                                    <p className="text-[10px] text-gray-400 ml-9 mt-1">
                                        {new Date(review.created_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}

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
                                        key={highlight ?? index}
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

                        {/* DVAI-054 — Programma del tour: rendering editoriale per ogni tappa.
                            Fonte primaria: tour.steps (shape canonica DVAI-053).
                            Fallback: tour.itinerary quando steps è assente/vuoto. Mai lettura parallela.
                            Regole anti-campo-vuoto: ogni blocco condizionato al proprio campo.
                            DVAI-059 — CTA "Apri sulla mappa" per-tappa rimosso: era il primo dei 3
                            CTA mappa duplicati nella scheda. L'unica CTA mappa vive ora in
                            "Avvia Itinerario" (SMART CTA BUTTONS in fondo). */}
                        <motion.div
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8, delay: 0.8 }}
                        >
                            {(() => {
                                const source = (Array.isArray(tour.steps) && tour.steps.length > 0)
                                    ? tour.steps
                                    : (Array.isArray(tour.itinerary) ? tour.itinerary : []);
                                const totalSteps = source.length;
                                if (totalSteps === 0) return null;
                                return source.map((step, index) => {
                                    const next = source[index + 1] || null;
                                    const stepTitle = step.title || step.activity || `Tappa ${index + 1}`;
                                    const stepImage = step.image || null;
                                    const stepCategory = step.category && step.category !== 'place' ? step.category : null;
                                    const stepMinutes = Number.isFinite(step.suggestedMinutes) && step.suggestedMinutes > 0 ? step.suggestedMinutes : null;
                                    const stepPrice = Number.isFinite(step.price) && step.price > 0 ? step.price : null;
                                    const stepInsider = step.insiderTip || null;
                                    const stepDesc = step.description || null;
                                    const stepRating = Number.isFinite(step.googleRating) && step.googleRating > 0 ? step.googleRating : null;
                                    const stepBestTime = step.bestTime || null;
                                    const stepTransition = step.transition || null;
                                    const nextTitle = next ? (next.title || next.activity || null) : null;
                                    const nextImage = next ? (next.image || null) : null;

                                    return (
                                        <article key={step.id ?? index} className="mb-14 last:mb-0">
                                            {/* 1. HERO FOTOGRAFICO */}
                                            <div className="relative aspect-[4/5] overflow-hidden rounded-2xl mb-5">
                                                {stepImage ? (
                                                    <img
                                                        src={stepImage}
                                                        alt={stepTitle}
                                                        className="absolute inset-0 w-full h-full object-cover"
                                                        loading="lazy"
                                                        onError={(e) => {
                                                            // Fallback: nascondo l'img rotta, il placeholder geometrico sotto resta visibile
                                                            e.currentTarget.style.display = 'none';
                                                        }}
                                                    />
                                                ) : null}
                                                {/* Placeholder geometrico sempre presente sotto — visibile se img manca o rompe */}
                                                <div className={`absolute inset-0 bg-gradient-to-br from-stone-200 via-stone-300 to-stone-400 ${stepImage ? '-z-10' : ''}`}>
                                                    <svg className="absolute inset-0 w-full h-full opacity-15" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                                                        <defs>
                                                            <pattern id={`grid-${index}`} width="24" height="24" patternUnits="userSpaceOnUse">
                                                                <path d="M 24 0 L 0 0 0 24" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-stone-700" />
                                                            </pattern>
                                                        </defs>
                                                        <rect width="100%" height="100%" fill={`url(#grid-${index})`} />
                                                    </svg>
                                                </div>
                                                {/* overlay scuro dal basso */}
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
                                                {/* meta in overlay */}
                                                <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                                                    <div className="text-[11px] uppercase tracking-[0.18em] opacity-80 mb-2">
                                                        Tappa {index + 1} di {totalSteps}
                                                    </div>
                                                    <h2 className="text-[22px] font-medium leading-tight mb-3">{stepTitle}</h2>
                                                    {(stepCategory || stepMinutes || stepPrice) && (
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            {stepCategory && (
                                                                <span className="px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-sm text-[11px] uppercase tracking-wider">
                                                                    {stepCategory}
                                                                </span>
                                                            )}
                                                            {stepMinutes && (
                                                                <span className="px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-sm text-[11px]">
                                                                    {stepMinutes} min
                                                                </span>
                                                            )}
                                                            {stepPrice && (
                                                                <span className="px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-sm text-[11px]">
                                                                    €{stepPrice}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* 2. PERCHÉ QUI (insider) — momento editoriale, unico elemento serif italic */}
                                            {stepInsider && (
                                                <blockquote className="border-l-[3px] border-stone-900 pl-4 py-1 mb-5">
                                                    <p className="font-serif italic text-[17px] leading-snug text-stone-800">
                                                        {stepInsider}
                                                    </p>
                                                </blockquote>
                                            )}

                                            {/* 3. DESCRIZIONE */}
                                            {stepDesc && (
                                                <p className="text-[15px] leading-relaxed text-stone-600 mb-5">
                                                    {stepDesc}
                                                </p>
                                            )}

                                            {/* 4. RIGA META: rating Google + prezzo */}
                                            {(stepRating || stepPrice) && (
                                                <div className="flex items-center gap-5 text-[13px] text-stone-500 mb-5">
                                                    {stepRating && (
                                                        <span>
                                                            <strong className="text-stone-800">{stepRating}</strong>
                                                            <span className="ml-1 text-stone-500">Google</span>
                                                        </span>
                                                    )}
                                                    {stepPrice && (
                                                        <span>
                                                            <strong className="text-stone-800">€{stepPrice}</strong>
                                                        </span>
                                                    )}
                                                </div>
                                            )}

                                            {/* 5. MEGLIO VISITARE */}
                                            {stepBestTime && (
                                                <div className="mb-5">
                                                    <div className="text-[11px] uppercase tracking-[0.16em] text-stone-500 mb-1">
                                                        Meglio visitare
                                                    </div>
                                                    <p className="text-[14px] text-stone-700">{stepBestTime}</p>
                                                </div>
                                            )}

                                            {/* 6. TRANSIZIONE — icona movimento + testo narrativo. Solo se c'è una prossima tappa */}
                                            {stepTransition && next && (
                                                <div className="flex items-start gap-3 mb-5 text-stone-600">
                                                    <ArrowRight className="w-4 h-4 mt-1 flex-shrink-0" strokeWidth={1.5} />
                                                    <p className="text-[14px] leading-relaxed">{stepTransition}</p>
                                                </div>
                                            )}

                                            {/* 7. PREVIEW PROSSIMA TAPPA */}
                                            {next && (
                                                <div className="flex items-center gap-3 p-3 bg-stone-50 rounded-xl mb-5">
                                                    {nextImage ? (
                                                        <img
                                                            src={nextImage}
                                                            alt=""
                                                            className="w-14 h-14 object-cover rounded-lg flex-shrink-0"
                                                            loading="lazy"
                                                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                                        />
                                                    ) : (
                                                        <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-stone-200 to-stone-400 flex-shrink-0" />
                                                    )}
                                                    <div className="min-w-0">
                                                        <div className="text-[11px] uppercase tracking-[0.14em] text-stone-500">Poi</div>
                                                        <div className="text-[14px] text-stone-800 truncate">
                                                            {nextTitle || `Tappa ${index + 2}`}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* DVAI-059 — Rimosso "Apri sulla mappa" per-tappa (era CTA mappa duplicato).
                                                L'unica CTA mappa nella scheda è "Avvia Itinerario" in fondo. */}
                                        </article>
                                    );
                                });
                            })()}
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

                        {/* DVAI-059 — Rimosso intero box "Mappatura" con "Guarda la Mappa" (2° CTA mappa duplicato).
                            L'unica CTA mappa vive in "Avvia Itinerario" (SMART CTA in fondo). */}

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
                            {/* DVAI-012: Tour mock → CTA disabilitato con messaggio chiaro */}
                            {isMockTour ? (
                                <div className="text-center">
                                    <div className="w-full py-4 rounded-2xl font-bold text-gray-400 bg-gray-100 border-2 border-dashed border-gray-200 flex items-center justify-center space-x-2 text-base cursor-not-allowed">
                                        <span>🎭</span>
                                        <span>Tour di esempio</span>
                                    </div>
                                    <p className="text-xs text-amber-600 mt-2">
                                        Questo è un tour demo. Per prenotare, esplora i tour reali delle nostre guide locali nella sezione{' '}
                                        <a href="/explore" className="font-bold underline">Esplora</a>.
                                    </p>
                                </div>
                            ) : (
                                <>
                                    <button
                                        onClick={handleSmartAction}
                                        className={`w-full py-4 rounded-2xl font-bold text-white shadow-xl hover:shadow-2xl transition-all duration-300 flex items-center justify-center space-x-2 text-lg transform active:scale-95 ${
                                            isGuideTour ? "bg-gray-800 hover:bg-black" : "bg-gradient-to-r from-terracotta-400 to-terracotta-600"
                                        }`}
                                    >
                                        {/* Gate K: CTA "Unisciti al Gruppo" RIMOSSA (Group Mode fake). */}
                                        {isGuideTour ? (
                                            <>
                                                <MessageCircle className="w-6 h-6" />
                                                <span>Richiedi Guida</span>
                                            </>
                                        ) : (
                                            <>
                                                <Play className="w-6 h-6 fill-current" />
                                                <span>Avvia Itinerario</span>
                                            </>
                                        )}
                                    </button>
                                    <p className="text-center text-xs text-gray-500 mt-2">
                                        {isGuideTour ? "Invierai una richiesta non vincolante alla guida." : "Navigazione GPS inclusa. Clicca per iniziare."}
                                    </p>
                                </>
                            )}
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

