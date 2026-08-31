import { motion } from "framer-motion";
import { supabase } from "../lib/supabase";
// Gate F26 DIFF 6: `Heart` e `Navigation` tolti — erano usati solo dal cuore
// preferiti e dal bottone Invia della chat finta, entrambi rimossi.
import { ArrowLeft, ArrowRight, MapPin, Clock, Star, Play, Share2, Users, Calendar, MessageCircle, CheckCircle, XCircle, Sparkles, Brain } from "lucide-react";
import { Link, useParams, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useState, useEffect } from "react";
import TopBar from "../components/TopBar";
import TourCover from "../components/TourCover";
import { isPlacesPhoto } from "@/lib/categoryPalette";
import { formatEstimate } from "@/lib/tourTiming";

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
                className="absolute inset-0 bg-obsidian-bg/75 backdrop-blur-sm pointer-events-auto"
                onClick={onClose}
            />

            {/* Modal Content */}
            <motion.div
                className="bg-obsidian-card border border-obsidian-border text-obsidian-primary w-full max-w-md p-6 rounded-t-3xl sm:rounded-2xl shadow-2xl z-10 pointer-events-auto"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
            >
                <div className="w-12 h-1.5 bg-obsidian-border rounded-full mx-auto mb-6" />

                <h3 className="text-xl font-bold text-obsidian-primary mb-2">Contatta {guideName}</h3>
                <p className="text-obsidian-secondary text-sm mb-6">Richiedi disponibilità per "{tourTitle}"</p>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-obsidian-secondary uppercase tracking-wider mb-1.5">Data Desiderata</label>
                        <input type="date" name="date" required className="w-full bg-obsidian-raised border border-obsidian-border rounded-xl px-4 py-3 text-obsidian-primary focus:outline-none focus:border-brand-orange text-sm" />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-obsidian-secondary uppercase tracking-wider mb-1.5">Numero Persone</label>
                        <input type="number" name="guests" min="1" max="20" required defaultValue="2" className="w-full bg-obsidian-raised border border-obsidian-border rounded-xl px-4 py-3 text-obsidian-primary focus:outline-none focus:border-brand-orange text-sm" />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-obsidian-secondary uppercase tracking-wider mb-1.5">Messaggio (Opzionale)</label>
                        <textarea name="message" rows="2" placeholder="Ciao! Siamo interessati a..." className="w-full bg-obsidian-raised border border-obsidian-border rounded-xl px-4 py-3 text-obsidian-primary placeholder-obsidian-secondary/50 focus:outline-none focus:border-brand-orange text-sm" />
                    </div>

                    {feedback && (
                        <div
                            className={`rounded-xl px-4 py-3 text-sm font-medium ${feedback.type === 'success'
                                ? 'bg-obsidian-raised text-obsidian-primary border border-brand-orange/40'
                                : 'bg-obsidian-raised text-obsidian-primary border border-obsidian-secondary/50'
                                }`}
                            role="alert"
                        >
                            {feedback.message}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full bg-brand-orange hover:bg-brand-orange-hover text-obsidian-bg py-3.5 rounded-xl font-bold text-base disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-md shadow-brand-orange/20 mt-2 cursor-pointer"
                    >
                        {isSubmitting ? 'Invio in corso...' : 'Invia Richiesta'}
                    </button>

                    <button
                        type="button"
                        onClick={onClose}
                        className="w-full text-obsidian-secondary hover:text-obsidian-primary py-2 text-sm font-bold transition-colors cursor-pointer"
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
                className="absolute inset-0 bg-obsidian-bg/75 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Content */}
            <motion.div
                className="bg-obsidian-card border border-obsidian-border text-obsidian-primary w-full max-w-sm rounded-[28px] shadow-2xl relative z-10 overflow-hidden"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
            >
                {/* Header Pattern */}
                <div className="h-20 bg-obsidian-raised border-b border-obsidian-border relative overflow-hidden" />

                <div className="px-6 pb-6 -mt-10 text-center">
                    {/* Avatar */}
                    <div className="w-20 h-20 rounded-full bg-obsidian-card border-2 border-obsidian-border p-1 mx-auto shadow-lg mb-3">
                        <div className="w-full h-full rounded-full bg-obsidian-raised flex items-center justify-center text-4xl text-obsidian-primary">
                            {guideAvatar}
                        </div>
                    </div>

                    <h2 className="text-2xl font-bold text-obsidian-primary mb-1">{guideName}</h2>
                    <p className="text-xs font-bold text-obsidian-secondary uppercase tracking-widest mb-4">Guida DoveVai</p>

                    {/* Stats */}
                    <div className="flex justify-center gap-2 mb-6">
                        <div className="bg-obsidian-raised border border-obsidian-border rounded-xl p-2.5 flex-1 text-center">
                            <div className="font-bold text-lg text-obsidian-primary">{rating}</div>
                            <div className="text-[10px] text-obsidian-secondary uppercase font-bold">Rating</div>
                        </div>
                        <div className="bg-obsidian-raised border border-obsidian-border rounded-xl p-2.5 flex-1 text-center">
                            <div className="font-bold text-lg text-obsidian-primary">{reviews}</div>
                            <div className="text-[10px] text-obsidian-secondary uppercase font-bold">Recensioni</div>
                        </div>
                        <div className="bg-obsidian-raised border border-obsidian-border rounded-xl p-2.5 flex-1 text-center">
                            <div className="font-bold text-lg text-obsidian-primary">5+</div>
                            <div className="text-[10px] text-obsidian-secondary uppercase font-bold">Anni Exp</div>
                        </div>
                    </div>

                    <div className="bg-obsidian-raised border border-obsidian-border rounded-2xl p-4 text-left mb-6">
                        <h4 className="text-xs font-bold text-obsidian-secondary uppercase tracking-wider mb-2">Biografia</h4>
                        <p className="text-sm text-obsidian-secondary leading-relaxed font-normal">
                            {bio || "Appassionato di storia locale e cultura sarda. Amo raccontare le storie nascoste che non troverai nelle guide turistiche tradizionali."}
                        </p>
                    </div>

                    {/* Credentials */}
                    <div className="flex gap-2 mb-6 justify-center">
                        <span className="px-3 py-1 bg-obsidian-raised border border-obsidian-border text-obsidian-secondary text-xs font-bold rounded-full">Verificato</span>
                        <span className="px-3 py-1 bg-obsidian-raised border border-obsidian-border text-obsidian-secondary text-xs font-bold rounded-full">Esperto Locale</span>
                    </div>

                    <button
                        onClick={onClose}
                        className="w-full py-3.5 bg-obsidian-raised hover:bg-obsidian-border text-obsidian-primary border border-obsidian-border rounded-xl font-bold transition-colors cursor-pointer"
                    >
                        Chiudi Profilo
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

// --- GUIDE CHAT MODAL ---
// Gate F26 DIFF 6 (27/08) — GuideChatModal RIMOSSO, non disabilitato.
// Era una chat interamente finta, raggiungibile in produzione (il bottone stava
// dietro `isGuideTour`, una condizione sui DATI, non un guard): pallino verde
// "Online" hardcoded, un messaggio della guida con timestamp fisso, un input
// senza onChange ne' submit, e un'affermazione di SICUREZZA falsa su un canale
// che non trasmetteva niente. La chat con le guide e' V2: finche' non esiste,
// non esiste nemmeno il bottone.
// --- PLACE DETAILS VIEW (Simplified "Scheda") ---
const PlaceDetailsView = ({ place, onBack }) => {
    return (
        <div className="min-h-screen bg-obsidian-bg font-quicksand pb-24 text-obsidian-primary">
            {/* Gate VERITÀ VISIVA (F26) DIFF 4 — questa e' una scheda POI, non una
                copertina: qui l'immagine PRETENDE di essere quel posto. Decisione
                Ivano: senza foto ancorata al place_id non si mostra niente.
                Il contenitore resta (porta il bottone indietro e il badge tipo) con
                un fondo neutro che non finge di essere una fotografia — stesso
                trattamento dell'hero tappa a :1220 e della card partner in MapPage. */}
            <div className="relative h-64 bg-obsidian-raised border-b border-obsidian-border overflow-hidden">
                {isPlacesPhoto(place.images?.[0] || place.imageUrl) && (
                    <img
                        src={place.images?.[0] || place.imageUrl}
                        alt={place.title}
                        className="absolute inset-0 w-full h-full object-cover"
                    />
                )}
                <button
                    onClick={onBack}
                    className="absolute top-4 left-4 p-2 bg-obsidian-card/80 backdrop-blur-md border border-obsidian-border rounded-full shadow-md text-obsidian-primary hover:bg-obsidian-raised transition-colors cursor-pointer"
                    aria-label="Indietro"
                >
                    <ArrowLeft size={20} />
                </button>
                <div className="absolute bottom-4 left-4">
                    <span className="bg-obsidian-card/90 backdrop-blur-md border border-obsidian-border text-obsidian-primary text-xs font-bold px-3 py-1 rounded-full shadow-sm uppercase tracking-wide">
                        {place.type === 'food' ? 'Ristorazione' : place.type === 'hotel' ? 'Ospitalità' : place.type === 'shop' ? 'Shopping' : 'Servizio'}
                    </span>
                </div>
            </div>

            <div className="px-5 py-6">
                {/* Title & Rating */}
                <div className="flex justify-between items-start mb-2">
                    <h1 className="text-2xl font-bold text-obsidian-primary leading-tight flex-1 mr-2">{place.title}</h1>
                    {Number.isFinite(place.rating) && place.rating > 0 && (
                        <div className="flex flex-col items-end">
                            <div className="flex items-center bg-obsidian-raised border border-obsidian-border px-2.5 py-1 rounded-lg">
                                <Star size={14} className="text-obsidian-secondary fill-current mr-1" />
                                <span className="font-bold text-obsidian-primary text-sm">{place.rating}</span>
                            </div>
                        </div>
                    )}
                </div>
                {(place.meetingPoint || place.location) && (
                    <p className="text-obsidian-secondary text-sm mb-6 flex items-center">
                        <MapPin size={14} className="mr-1 text-obsidian-secondary" /> {place.meetingPoint || place.location}
                    </p>
                )}

                {/* Gate PULIZIA P5 — rimossa l'intera "Info Cards Row".
                    Tre card, zero dati: "Orari: Aperto" era una costante scritta
                    nel JSX (nessuna lettura di opening_hours), "Distanza: 0.2 km"
                    idem (nessun calcolo), "Prezzo" leggeva un campo che il default
                    a 0 rendeva sempre presente. Il fallback "Google Maps" sotto il
                    titolo e' sparito con la stessa logica: non e' un indirizzo. */}

                {/* Description */}
                {place.description && (
                    <div className="mb-8">
                        <h3 className="font-bold text-obsidian-primary mb-2">Descrizione</h3>
                        <p className="text-obsidian-secondary text-sm leading-relaxed">
                            {place.description}
                        </p>
                    </div>
                )}

                {/* Highlights (Punti di Forza) */}
                {Array.isArray(place.highlights) && place.highlights.length > 0 && (
                    <div className="mb-8">
                        <h3 className="font-bold text-obsidian-primary mb-3">Punti di Forza</h3>
                        <div className="flex flex-wrap gap-2">
                            {place.highlights.map((h, i) => (
                                <span key={i} className="px-3 py-1.5 bg-obsidian-card border border-obsidian-border text-obsidian-secondary text-xs font-bold rounded-lg">
                                    {String(h).replace(/^[^\s]+\s/, '')} {/* Strip leading emoji if present */}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
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
    // Gate F26 DIFF 6 (27/08) — `toast` portato in scope. Era chiamato tre volte
    // in questo componente ma dichiarato SOLO dentro RequestModal: in
    // TourDetailsPage il simbolo non esisteva e ogni chiamata era un
    // ReferenceError, non un messaggio. ESLint lo diceva (`no-undef`) ma qui e'
    // warning, non errore, quindi la CI non lo prendeva.
    // Nessun sistema nuovo: e' lo stesso useToast usato da altri 13 file, con
    // ToastProvider gia' montato in App.jsx:113.
    const { toast } = useToast();
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
                // Gate PULIZIA P5 — rimossi i dieci default hardcoded che stavano
                // qui (guideBio "Guida virtuale intelligente...", rating 4.5,
                // location "Destinazione Tour", participants 0, maxParticipants 10,
                // language "Italiano", highlights ["✨ Esperienza autentica", ...],
                // meetingPoint "Punto di partenza sulla mappa", included
                // ["Itinerario digitale", "Supporto 24/7"], notIncluded, nextStart
                // "Sempre disponibile"). Nessuno di questi aveva una sorgente:
                // erano stringhe scritte qui e mostrate come dati del tour.
                // Ora passa solo cio' che `normalized` contiene davvero, e ogni
                // render a valle e' protetto dall'assenza.
                guide_id: incoming.guide_id || incoming.guideId || incoming.author_id || null,
                guideId: incoming.guide_id || incoming.guideId || incoming.author_id || null,
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
    const [nearbyPartners, setNearbyPartners] = useState([]);
    const [guideRating, setGuideRating] = useState({ avg: 0, count: 0 });
    const [reviews, setReviews] = useState([]);
    const [ctaDisabled, setCtaDisabled] = useState(false);
    const { trackTourView } = useAILearning();

    // Track tour view per il preference graph
    useEffect(() => {
        if (tour?.id && tour?.city) trackTourView(tour);
    }, [tour?.id]);

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
                <div className="min-h-screen bg-obsidian-bg font-quicksand text-obsidian-primary">
                    <TopBar />
                    <main className="max-w-md mx-auto px-4 py-8 pb-24">
                        <div className="animate-pulse space-y-4">
                            <div className="w-full h-56 bg-obsidian-raised border border-obsidian-border rounded-2xl" />
                            <div className="h-6 w-3/4 bg-obsidian-raised border border-obsidian-border rounded" />
                            <div className="h-4 w-1/2 bg-obsidian-raised border border-obsidian-border rounded" />
                            <div className="h-32 w-full bg-obsidian-raised border border-obsidian-border rounded-2xl mt-6" />
                        </div>
                    </main>
                    <BottomNavigation />
                </div>
            );
        }
        return (
            <div className="min-h-screen bg-obsidian-bg font-quicksand text-obsidian-primary">
                <TopBar />
                <main className="max-w-md mx-auto px-4 py-16 pb-24 text-center">
                    <div className="bg-obsidian-card border border-obsidian-border rounded-[28px] p-8 text-center max-w-md mx-auto shadow-2xl">
                        <div className="w-14 h-14 rounded-2xl bg-obsidian-raised border border-obsidian-border flex items-center justify-center text-obsidian-secondary mx-auto mb-4 shadow-sm">
                            <Clock className="w-7 h-7 stroke-[1.75]" />
                        </div>
                        <h1 className="text-2xl font-bold text-obsidian-primary mb-2">Questo tour non esiste più.</h1>
                        <p className="text-obsidian-secondary text-sm mb-8 leading-relaxed font-medium">
                            Forse è stato rimosso, o il link è cambiato. Torna alla home per scoprire cosa c'è oggi.
                        </p>
                        <button
                            onClick={() => navigate('/dashboard-user')}
                            className="px-6 py-3.5 rounded-xl bg-brand-orange hover:bg-brand-orange-hover text-obsidian-bg font-bold transition-colors shadow-md shadow-brand-orange/20 cursor-pointer w-full sm:w-auto"
                        >
                            Torna alla home
                        </button>
                    </div>
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

    return (
        <div className="min-h-screen bg-obsidian-bg font-quicksand pb-24 text-obsidian-primary">
            <TopBar />

            <main className="max-w-md mx-auto pb-24">
                {/* --- HERO SECTION --- */}
                <div className="relative">
                    <div className="relative w-full h-80">
                        <TourCover
                            cover={tour.imageUrl || tour.image || null}
                            category={tour.category || tour.type}
                            type={tour.type}
                            title={tour.title}
                            animateKey={tour.imageUrl || tour.image || tour.id}
                        />
                    </div>

                    {/* Overlay Controls */}
                    <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute top-4 left-4 pointer-events-auto">
                            <motion.button
                                onClick={() => navigate(-1)}
                                className="p-3 rounded-full bg-obsidian-card/80 backdrop-blur-md border border-obsidian-border text-obsidian-primary hover:bg-obsidian-raised transition-colors cursor-pointer"
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                aria-label="Indietro"
                            >
                                <ArrowLeft className="w-5 h-5 text-obsidian-primary" />
                            </motion.button>
                        </div>

                        <div className="absolute top-4 right-4 flex space-x-2 pointer-events-auto">
                            <motion.button
                                className="p-3 rounded-full bg-obsidian-card/80 backdrop-blur-md border border-obsidian-border text-obsidian-primary hover:bg-obsidian-raised transition-colors cursor-pointer"
                                whileHover={{ scale: 1.05, rotate: -15 }}
                                whileTap={{ scale: 0.95 }}
                                aria-label="Condividi"
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
                                <Share2 className="w-5 h-5 text-obsidian-primary" />
                            </motion.button>
                        </div>

                        {/* Live/Type Badge */}
                        {tour.live && (
                            <motion.div
                                className="absolute bottom-4 left-4 bg-obsidian-card/90 backdrop-blur-md border border-obsidian-border text-obsidian-primary px-3.5 py-1.5 rounded-full flex items-center space-x-2 text-xs font-bold shadow-lg pointer-events-auto"
                                animate={{ scale: [1, 1.05, 1] }}
                                transition={{ duration: 2, repeat: Infinity }}
                            >
                                <div className="w-2 h-2 bg-brand-orange rounded-full animate-pulse" />
                                <span>LIVE</span>
                            </motion.div>
                        )}
                        {!tour.live && (
                            <div className="absolute bottom-4 left-4 bg-obsidian-card/90 backdrop-blur-md border border-obsidian-border text-obsidian-primary px-3.5 py-1.5 rounded-full font-bold text-xs shadow-lg pointer-events-auto">
                                {isGuideTour ? 'Tour Guidato' : 'Self-Guided'}
                            </div>
                        )}
                    </div>
                </div>

                <div className="px-4 py-6 space-y-8">
                    {/* Title and Meta */}
                    <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4 }}
                    >
                        <div className="mb-4">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                                {isMockTour && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-obsidian-raised border border-obsidian-border text-obsidian-secondary text-[10px] font-bold uppercase tracking-widest">
                                        Demo
                                    </span>
                                )}
                                {isAiSelfGuided && (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-obsidian-raised border border-obsidian-border text-obsidian-secondary text-[10px] font-bold uppercase tracking-widest">
                                        <Sparkles size={11} className="text-obsidian-secondary" /> Tour AI
                                    </span>
                                )}
                            </div>
                            <h1 className="text-2xl font-bold text-obsidian-primary mb-2 leading-tight tracking-tight">{tour.title}</h1>
                            <p className="text-obsidian-secondary leading-relaxed text-sm">{tour.description}</p>
                            {isMockTour && (
                                <p className="text-obsidian-secondary text-xs mt-2 bg-obsidian-raised border border-obsidian-border rounded-xl px-3 py-2">
                                    Tour di esempio — prenotazione e contatto guida non disponibili. Esplora i tour reali nella sezione Esplora.
                                </p>
                            )}
                        </div>

                        {/* Real Data Badges */}
                        {(Number.isFinite(tour.maxParticipants) || tour.language) && (
                            <div className="flex gap-3 text-xs font-semibold text-obsidian-secondary mb-2 flex-wrap">
                                {Number.isFinite(tour.maxParticipants) && (
                                    <span className="flex items-center gap-1.5 bg-obsidian-card px-3 py-1.5 rounded-full border border-obsidian-border text-obsidian-secondary text-xs">
                                        <Users size={14} className="text-obsidian-secondary" /> Max {tour.maxParticipants} Pers
                                    </span>
                                )}
                                {tour.language && (
                                    <span className="flex items-center gap-1.5 bg-obsidian-card px-3 py-1.5 rounded-full border border-obsidian-border text-obsidian-secondary text-xs">
                                        <MessageCircle size={14} className="text-obsidian-secondary" /> {tour.language}
                                    </span>
                                )}
                            </div>
                        )}
                    </motion.div>

                    {/* --- GUIDE OR AI SUMMARY SECTION --- */}
                    {isGuideTour ? (
                        <motion.div
                            className="bg-obsidian-card border border-obsidian-border rounded-3xl p-6 shadow-sm"
                            initial={{ opacity: 0, x: -15 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.4 }}
                        >
                            <h3 className="font-bold text-obsidian-primary mb-4 flex items-center">
                                <Users size={18} className="mr-2 text-obsidian-secondary inline-block" />
                                La tua guida
                            </h3>
                            <div className="flex items-start space-x-4">
                                <div className="text-4xl shrink-0">
                                    {tour.guideAvatar}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-bold text-lg text-obsidian-primary">{tour.guide}</h4>
                                    <div className="flex items-center space-x-3 mb-3">
                                        <div className="flex items-center">
                                            <Star className="w-4 h-4 text-obsidian-secondary fill-current mr-1" />
                                            <span className="font-bold text-obsidian-primary text-sm">{guideRating.count > 0 ? guideRating.avg : (tour.rating || '—')}</span>
                                            <span className="text-xs text-obsidian-secondary ml-1">({guideRating.count > 0 ? guideRating.count : (tour.reviews || 0)} recensioni)</span>
                                        </div>
                                    </div>
                                    {tour.guideBio && (
                                        <p className="text-obsidian-secondary text-sm leading-relaxed">{tour.guideBio}</p>
                                    )}
                                    <div className="flex space-x-2 mt-4">
                                        <button
                                            onClick={() => setShowProfileModal(true)}
                                            className="flex-1 bg-obsidian-raised hover:bg-obsidian-border text-obsidian-primary border border-obsidian-border px-3 py-2 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
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

                    {/* --- SEZIONE RECENSIONI REALI --- */}
                    {reviews.length > 0 && (
                        <motion.div
                            className="bg-obsidian-card border border-obsidian-border rounded-3xl p-6 shadow-sm"
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4 }}
                        >
                            <h3 className="font-bold text-obsidian-primary mb-4 flex items-center">
                                <Star size={18} className="mr-2 text-obsidian-secondary fill-current inline-block" />
                                Recensioni ({guideRating.count})
                            </h3>

                            {/* Rating summary */}
                            <div className="flex items-center gap-3 mb-5 p-3.5 bg-obsidian-raised border border-obsidian-border rounded-xl">
                                <div className="text-3xl font-black text-obsidian-primary">{guideRating.avg}</div>
                                <div className="flex-1">
                                    <div className="flex gap-0.5 mb-1">
                                        {[1,2,3,4,5].map(s => (
                                            <Star key={s} className={`w-4 h-4 ${s <= Math.round(guideRating.avg) ? 'fill-obsidian-primary text-obsidian-primary' : 'text-obsidian-border'}`} />
                                        ))}
                                    </div>
                                    <p className="text-xs text-obsidian-secondary">{guideRating.count} recensioni verificate</p>
                                </div>
                            </div>

                            {/* Review cards */}
                            <div className="space-y-3">
                                {reviews.map(review => (
                                    <div key={review.id} className="border-b border-obsidian-border pb-3 last:border-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <div className="w-7 h-7 rounded-full bg-obsidian-raised border border-obsidian-border flex items-center justify-center text-xs font-bold text-obsidian-primary">
                                                {(review.profiles?.full_name || 'U').charAt(0)}
                                            </div>
                                            <span className="text-sm font-medium text-obsidian-primary">
                                                {review.profiles?.full_name || 'Utente'}
                                            </span>
                                            <div className="flex gap-0.5 ml-auto">
                                                {[1,2,3,4,5].map(s => (
                                                    <Star key={s} className={`w-3 h-3 ${s <= review.rating ? 'fill-obsidian-primary text-obsidian-primary' : 'text-obsidian-border'}`} />
                                                ))}
                                            </div>
                                        </div>
                                        {review.comment && (
                                            <p className="text-sm text-obsidian-secondary leading-relaxed ml-9">{review.comment}</p>
                                        )}
                                        <p className="text-[10px] text-obsidian-secondary/70 ml-9 mt-1">
                                            {new Date(review.created_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {/* ⬇️ STANDARD SECTIONS ⬇️ */}
                    <>
                        {/* Info Grid — Gate PULIZIA P5: anche il CONTENITORE e' sotto guardia */}
                        {(tour.location || tour.duration ||
                          (Number.isFinite(tour.participants) && Number.isFinite(tour.maxParticipants)) ||
                          tour.nextStart) && (
                        <motion.div
                            className="grid grid-cols-2 gap-3"
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4 }}
                        >
                            {tour.location && (
                                <div className="bg-obsidian-card border border-obsidian-border rounded-2xl p-4 text-center shadow-sm">
                                    <MapPin className="w-5 h-5 text-obsidian-secondary mx-auto mb-2" />
                                    <div className="text-xs text-obsidian-secondary mb-1 font-semibold uppercase tracking-wider">Dove</div>
                                    <div className="font-bold text-obsidian-primary text-sm truncate">{tour.location}</div>
                                </div>
                            )}
                            {tour.duration && (
                                <div className="bg-obsidian-card border border-obsidian-border rounded-2xl p-4 text-center shadow-sm">
                                    <Clock className="w-5 h-5 text-obsidian-secondary mx-auto mb-2" />
                                    <div className="text-xs text-obsidian-secondary mb-1 font-semibold uppercase tracking-wider">Durata</div>
                                    <div className="font-bold text-obsidian-primary text-sm">{tour.duration}</div>
                                </div>
                            )}
                            {Number.isFinite(tour.participants) && Number.isFinite(tour.maxParticipants) && (
                                <div className="bg-obsidian-card border border-obsidian-border rounded-2xl p-4 text-center shadow-sm">
                                    <Users className="w-5 h-5 text-obsidian-secondary mx-auto mb-2" />
                                    <div className="text-xs text-obsidian-secondary mb-1 font-semibold uppercase tracking-wider">Partecipanti</div>
                                    <div className="font-bold text-obsidian-primary text-sm">{tour.participants}/{tour.maxParticipants}</div>
                                </div>
                            )}
                            {tour.nextStart && (
                                <div className="bg-obsidian-card border border-obsidian-border rounded-2xl p-4 text-center shadow-sm">
                                    <Calendar className="w-5 h-5 text-obsidian-secondary mx-auto mb-2" />
                                    <div className="text-xs text-obsidian-secondary mb-1 font-semibold uppercase tracking-wider">Prossimo</div>
                                    <div className="font-bold text-obsidian-primary text-sm">{tour.nextStart}</div>
                                </div>
                            )}
                        </motion.div>
                        )}

                        {/* Highlights — Gate PULIZIA P5 */}
                        {Array.isArray(tour.highlights) && tour.highlights.length > 0 && (
                        <motion.div
                            className="bg-obsidian-card border border-obsidian-border rounded-3xl p-6 shadow-sm"
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.4 }}
                        >
                            <h3 className="font-bold text-obsidian-primary mb-4 flex items-center">
                                <Sparkles size={18} className="mr-2 text-obsidian-secondary" />
                                Cosa ti aspetta
                            </h3>
                            <div className="grid grid-cols-1 gap-2.5">
                                {tour.highlights.map((highlight, index) => (
                                    <motion.div
                                        key={highlight ?? index}
                                        className="bg-obsidian-raised border border-obsidian-border rounded-xl p-3 flex items-center space-x-3"
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ duration: 0.3, delay: index * 0.05 }}
                                    >
                                        <Sparkles size={14} className="text-obsidian-secondary shrink-0" />
                                        <span className="font-medium text-obsidian-primary text-sm">{String(highlight).replace(/^[^\s]+\s/, '')}</span>
                                    </motion.div>
                                ))}
                            </div>
                        </motion.div>
                        )}

                        {/* DVAI-054 — Programma del tour: stesso linguaggio del riepilogo QuickPath */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4 }}
                        >
                            {(() => {
                                const source = (Array.isArray(tour.steps) && tour.steps.length > 0)
                                    ? tour.steps
                                    : (Array.isArray(tour.itinerary) ? tour.itinerary : []);
                                const totalSteps = source.length;
                                if (totalSteps === 0) return null;
                                return (
                                    <div className="mb-8">
                                        <h3 className="font-bold text-base text-obsidian-primary mb-4 flex items-center">
                                            <MapPin size={18} className="mr-2 text-obsidian-secondary inline-block" />
                                            Programma del Tour ({totalSteps} tappe)
                                        </h3>
                                        <div className="space-y-3">
                                            {source.map((step, index) => {
                                                const stepTitle = step.title || step.name || step.activity || `Tappa ${index + 1}`;
                                                const stepImage = step.image || null;
                                                const stepCategory = step.category && step.category !== 'place' ? step.category : null;
                                                const stepMinutes = formatEstimate(step.stayMinutes);
                                                const stepPrice = Number.isFinite(step.price) && step.price > 0 ? step.price : null;
                                                const stepInsider = step.insiderTip || null;
                                                const stepDesc = step.description || null;
                                                const stepRating = Number.isFinite(step.googleRating) && step.googleRating > 0 ? step.googleRating : null;
                                                const stepBestTime = step.bestTime || null;
                                                const stepTransition = step.transition || null;

                                                return (
                                                    <div
                                                        key={step.id ?? index}
                                                        className="flex items-start gap-3 bg-obsidian-card p-3.5 rounded-2xl border border-obsidian-border shadow-sm relative overflow-hidden group"
                                                    >
                                                        {/* Connettore verticale tra tappe */}
                                                        {index !== totalSteps - 1 && (
                                                            <div className="absolute left-[1.4rem] top-8 bottom-[-14px] w-0.5 bg-obsidian-border z-0" />
                                                        )}

                                                        {/* Numero arancione */}
                                                        <div className="w-6 h-6 rounded-full bg-brand-orange text-obsidian-bg flex items-center justify-center text-[11px] font-bold shrink-0 relative z-10 shadow-sm mt-0.5">
                                                            {index + 1}
                                                        </div>

                                                        {/* Testi e contenuti */}
                                                        <div className="flex-1 min-w-0 relative z-10">
                                                            <div className="flex items-start justify-between gap-2">
                                                                <p className="text-sm font-bold text-obsidian-primary leading-tight">
                                                                    {stepTitle}
                                                                </p>
                                                                {stepMinutes && (
                                                                    <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-obsidian-raised border border-obsidian-border text-obsidian-secondary text-[10px] font-semibold">
                                                                        <Clock size={11} className="text-obsidian-secondary" /> {stepMinutes}
                                                                    </span>
                                                                )}
                                                            </div>

                                                            {/* Categoria / Prezzo badge sulla scala neutra */}
                                                            {(stepCategory || stepPrice) && (
                                                                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                                                    {stepCategory && (
                                                                        <span className="px-2 py-0.5 rounded-full bg-obsidian-raised border border-obsidian-border text-obsidian-secondary text-[10px] uppercase tracking-wider font-semibold">
                                                                            {stepCategory}
                                                                        </span>
                                                                    )}
                                                                    {stepPrice && (
                                                                        <span className="px-2 py-0.5 rounded-full bg-obsidian-raised border border-obsidian-border text-obsidian-secondary text-[10px] font-semibold">
                                                                            €{stepPrice}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            )}

                                                            {/* Descrizione sul grigio secondario */}
                                                            {stepDesc && (
                                                                <p className="text-xs text-obsidian-secondary mt-1.5 leading-relaxed font-medium">
                                                                    {stepDesc}
                                                                </p>
                                                            )}

                                                            {/* Momento editoriale insider tip */}
                                                            {stepInsider && (
                                                                <blockquote className="border-l-2 border-brand-orange pl-2.5 py-0.5 mt-2 bg-obsidian-raised/40 rounded-r-lg">
                                                                    <p className="font-serif italic text-xs leading-snug text-obsidian-primary/90">
                                                                        {stepInsider}
                                                                    </p>
                                                                </blockquote>
                                                            )}

                                                            {/* Rating e orario consigliato */}
                                                            {(stepRating || stepBestTime) && (
                                                                <div className="flex items-center gap-3 mt-2 text-[11px] text-obsidian-secondary flex-wrap">
                                                                    {stepRating && (
                                                                        <span className="inline-flex items-center gap-1">
                                                                            <Star size={12} className="text-obsidian-secondary fill-current" />
                                                                            <strong className="text-obsidian-primary font-bold">{stepRating}</strong> Google
                                                                        </span>
                                                                    )}
                                                                    {stepBestTime && (
                                                                        <span className="text-obsidian-secondary">
                                                                            Meglio: <span className="text-obsidian-primary font-medium">{stepBestTime}</span>
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            )}

                                                            {/* Transizione */}
                                                            {stepTransition && index !== totalSteps - 1 && (
                                                                <div className="flex items-start gap-1.5 mt-2 text-[11px] text-obsidian-secondary/80 font-medium">
                                                                    <ArrowRight size={12} className="shrink-0 mt-0.5 text-obsidian-secondary" />
                                                                    <span>{stepTransition}</span>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Thumbnail immagine se presente */}
                                                        {stepImage && (
                                                            <div className="w-14 h-14 rounded-xl overflow-hidden bg-obsidian-raised border border-obsidian-border shrink-0 relative z-10 self-start">
                                                                <img
                                                                    src={stepImage}
                                                                    alt={stepTitle}
                                                                    className="w-full h-full object-cover"
                                                                    loading="lazy"
                                                                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })()}
                        </motion.div>

                        {/* Nearby Partners Section */}
                        {nearbyPartners.length > 0 && (
                            <motion.div
                                className="bg-obsidian-card border border-obsidian-border rounded-3xl p-6 mb-6 shadow-sm"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.4 }}
                            >
                                <h3 className="font-bold text-obsidian-primary mb-4 flex items-center">
                                    <MapPin size={18} className="mr-2 text-obsidian-secondary inline-block" />
                                    Consigliati nei dintorni
                                </h3>
                                <div className="space-y-3">
                                    {nearbyPartners.map((partner) => (
                                        <div key={partner.business_id} className="bg-obsidian-raised border border-obsidian-border p-4 rounded-xl flex items-center justify-between">
                                            <div>
                                                <h4 className="font-bold text-obsidian-primary text-sm">{partner.company_name}</h4>
                                                <div className="flex gap-2 text-xs mt-1">
                                                    {partner.category_tags && partner.category_tags.map(tag => (
                                                        <span key={tag} className="bg-obsidian-card border border-obsidian-border text-obsidian-secondary px-2 py-0.5 rounded text-xs">{tag}</span>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <span className="block font-bold text-obsidian-secondary text-sm">{(partner.dist_meters).toFixed(0)}m</span>
                                                {partner.subscription_tier === 'elite' && <span className="text-[10px] bg-obsidian-card border border-obsidian-border text-obsidian-primary px-2 py-0.5 rounded uppercase font-bold">Consigliato</span>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </motion.div>
                        )}

                        {/* Included/Not Included — Gate PULIZIA P5 */}
                        {((Array.isArray(tour.included) && tour.included.length > 0) ||
                          (Array.isArray(tour.notIncluded) && tour.notIncluded.length > 0)) && (
                        <motion.div
                            className="grid grid-cols-1 md:grid-cols-2 gap-4"
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4 }}
                        >
                            {Array.isArray(tour.included) && tour.included.length > 0 && (
                            <div className="bg-obsidian-card border border-obsidian-border rounded-2xl p-5 shadow-sm">
                                <h4 className="font-bold text-obsidian-primary mb-3 flex items-center text-sm"><CheckCircle size={16} className="mr-2 text-obsidian-secondary" /> Incluso</h4>
                                <div className="space-y-2">
                                    {tour.included.map((item, i) => (
                                        <div key={i} className="flex items-center space-x-2 text-xs text-obsidian-secondary">
                                            <div className="w-1.5 h-1.5 bg-obsidian-secondary rounded-full" />
                                            <span>{item}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            )}
                            {Array.isArray(tour.notIncluded) && tour.notIncluded.length > 0 && (
                            <div className="bg-obsidian-card border border-obsidian-border rounded-2xl p-5 shadow-sm">
                                <h4 className="font-bold text-obsidian-primary mb-3 flex items-center text-sm"><XCircle size={16} className="mr-2 text-obsidian-secondary" /> Non Incluso</h4>
                                <div className="space-y-2">
                                    {tour.notIncluded.map((item, i) => (
                                        <div key={i} className="flex items-center space-x-2 text-xs text-obsidian-secondary">
                                            <div className="w-1.5 h-1.5 bg-obsidian-secondary rounded-full" />
                                            <span>{item}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            )}
                        </motion.div>
                        )}

                        {/* --- SMART CTA BUTTONS (Unico accento arancione della pagina) --- */}
                        <motion.div
                            className="pt-4"
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4 }}
                        >
                            {isMockTour ? (
                                <div className="text-center">
                                    <div className="w-full py-4 rounded-2xl font-bold text-obsidian-secondary bg-obsidian-raised border border-dashed border-obsidian-border flex items-center justify-center space-x-2 text-base cursor-not-allowed">
                                        <span>Tour di esempio</span>
                                    </div>
                                    <p className="text-xs text-obsidian-secondary mt-2">
                                        Questo è un tour demo. Per prenotare, esplora i tour reali delle nostre guide locali nella sezione{' '}
                                        <a href="/explore" className="font-bold text-brand-orange underline">Esplora</a>.
                                    </p>
                                </div>
                            ) : (
                                <>
                                    <button
                                        onClick={handleSmartAction}
                                        className="w-full py-4 rounded-2xl font-bold text-obsidian-bg bg-brand-orange hover:bg-brand-orange-hover shadow-lg shadow-brand-orange/20 transition-all duration-200 flex items-center justify-center space-x-2 text-base transform active:scale-95 cursor-pointer"
                                    >
                                        {isGuideTour ? (
                                            <>
                                                <MessageCircle className="w-5 h-5 text-obsidian-bg" />
                                                <span>Richiedi Guida</span>
                                            </>
                                        ) : (
                                            <>
                                                <Play className="w-5 h-5 fill-current text-obsidian-bg" />
                                                <span>Avvia Itinerario</span>
                                            </>
                                        )}
                                    </button>
                                    <p className="text-center text-xs text-obsidian-secondary mt-2">
                                        {isGuideTour ? "Invierai una richiesta non vincolante alla guida." : "Navigazione GPS inclusa. Clicca per iniziare."}
                                    </p>
                                </>
                            )}
                        </motion.div>
                    </>
                </div>
            </main>

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
        </div>
    );
}
