import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Users, Brain, Zap, MapPin, ThermometerSun, Compass, Clock, Star, ChevronRight, Gamepad2, Gift, X, CloudRain, Sun, Snowflake, CheckCircle, Loader2, Award, Crosshair } from 'lucide-react';
import { aiRecommendationService } from '@/services/aiRecommendationService';
import { useUserContext } from '../hooks/useUserContext';
import GpsActivationBanner from '../components/GpsActivationBanner';
import BottomNavigation from '../components/BottomNavigation';
import TopBar from "@/components/TopBar";
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from "@tanstack/react-query";
import { dataService, createGuideRequest } from "@/services/dataService";
import { useAILearning } from '../hooks/useAILearning';
import { placesDiscoveryService } from '@/services/placesDiscoveryService';
import { getItemImage, GENERIC, CITY_IMAGES } from '@/utils/imageUtils';
import { normalizeTour } from '@/services/tourShape';
import { resolveCityCenter, CityCenterUnresolvedError } from '@/services/cityCenterService';
import TourCover from '@/components/TourCover';
// 🧠 AI-POWERED EXPERIENCE GENERATOR (REAL POI DISCOVERY)

// Theme-aware fallback images (city-neutral, topic-relevant).
// Gate P.1: 4 temi (walking morto, art rinominato cultura).
const THEME_FALLBACK_IMAGES = {
    food: GENERIC.food,
    cultura: GENERIC.church,
    romance: GENERIC.sea,
    nature: GENERIC.park,
};

const THEME_EMOJIS = {
    food: '🍽️',
    cultura: '🎨',
    romance: '🌅',
    nature: '🌿',
};

// Gate II (16/07): THEME_CONFIGS + getPoiTypeImage RIMOSSI.
// Erano dead code post-refactor: THEME_CONFIGS conteneva titoli statici
// ("Vista mare a X") ora sostituiti dai titoli generati dal narratore
// ("I vicoli segreti di X"). getPoiTypeImage era un fallback locale ora
// coperto da tourShape STEP_FALLBACK_IMAGE + THEME_FALLBACK_IMAGES sopra.

// Gate II (16/07): buildSmartExperiencesAsync RIMOSSO.
// Prima produceva 4 tour tematici SENZA passare dal narratore
// (description restava '' → fallback "Luogo di interesse a X" → isMockTour
// scattava sui tour reali). Ora aiRecommendationService.generateHomeTours
// produce N tour narrati in UNA sola call OpenAI (costo invariato).
// Vedi queryFn 'home-experiences' sotto per il nuovo flusso.
//
// La pipeline vecchia (discoverAllThemes + mapping steps senza description)
// e' stata rimossa integralmente. Se serve rollback, git log su
// DashboardUser.jsx pre-commit Gate II.

// Gate D-2: buildSmartExperiencesFallback rimosso. Prima serviva 3 tour finti
// con rating "4.8", coord Roma hardcoded, guida "🤖 Intelligenza DoveVai"
// come placeholderData react-query — spacciati per reali. Ora la UI ha
// skeleton (isPending) + empty state onesto + errore, non tour inventati.

/**
 * Riordina tour/esperienze in base al preference graph dell'utente.
 * Tour con categorie che matchano le preferenze vengono promossi in cima.
 */
const rankByPreferences = (tours, graph) => {
    if (!graph || Object.keys(graph).length === 0) return tours;

    return [...tours].sort((a, b) => {
        const scoreA = getAffinityScore(a, graph);
        const scoreB = getAffinityScore(b, graph);
        return scoreB - scoreA; // Score più alto → più in alto
    });
};

const getAffinityScore = (tour, graph) => {
    let score = 0;
    const cat = (tour.category || tour.type || '').toLowerCase();
    const city = (tour.city || '').toLowerCase();
    const tags = tour.category_tags || [];

    // Match per categoria/tipo
    for (const [key, val] of Object.entries(graph)) {
        if (key.startsWith('cat:') && cat.includes(key.replace('cat:', '').toLowerCase())) score += val * 2;
        if (key.startsWith('type:') && cat.includes(key.replace('type:', '').toLowerCase())) score += val;
        if (key.startsWith('city:') && city.includes(key.replace('city:', '').toLowerCase())) score += val;
    }

    // Match per tag
    for (const tag of tags) {
        const tagLow = tag.toLowerCase();
        if (graph[`cat:${tagLow}`]) score += graph[`cat:${tagLow}`];
    }

    // Boost per tour reali (non AI-generated)
    if (!tour.isAiGenerated) score += 3;

    return score;
};

const DashboardUser = () => {
    // Gate O.1: lat/lng non più letti qui. Il centro POI viene da resolveCityCenter
    // (Places-auth), non dal GPS. GPS/meteo restano disponibili via useUserContext
    // per altri consumer (TopBar, distanze client-side future).
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
            localStorage.setItem('unnivai_mode', 'user');

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
    const [requestCity, setRequestCity] = useState(''); // City chosen for the tour request (Gate O.2: vuoto iniziale, popolato in handleGuideRequest)

    const handleGuideRequest = () => {
        setRequestStatus('idle');
        // Gate O.2: pre-set alla citta' attuale se risolta, altrimenti campo vuoto
        // → l'utente compila. Zero 'Roma' fake che finisce dentro una richiesta guida.
        setRequestCity(city || '');
        setShowRequestModal(true);
    };

    const submitGuideRequest = async () => {
        // Gate L: defense-in-depth. Il bottone è disabled quando testo vuoto,
        // ma se un giorno il disabled viene rimosso, il toast copre il caso.
        if (!requestText.trim()) {
            if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
            setToast({ title: 'Scrivi qualcosa prima di inviare la richiesta.', type: 'info' });
            toastTimerRef.current = setTimeout(() => setToast(null), 3000);
            return;
        }

        setRequestStatus('submitting');
        try {
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) throw new Error('Devi effettuare il login per inviare una richiesta.');

            // Use the centralized service that handles RLS and formatting correctly
            await createGuideRequest({
                date: 'Oggi', 
                guests: 2,
                message: requestText,
                guideId: null, // "A pioggia"
                tourId: null,
                city: requestCity
            });

            console.log('[submitGuideRequest] Success! Request submitted via service');
            setRequestStatus('success');
        } catch (e) {
            console.error('[submitGuideRequest] Exception:', e);
            setRequestStatus('error');
        }
    };

    const { userDNAPreferences, preferenceGraph, totalInteractions, getAIContext, getTourAffinity, hasSeed } = useAILearning();
    // Gate SEME (L1): il ranking DNA (:216 tour reali, :359 riordino) si attiva
    // con >=3 interazioni reali OPPURE con un seme onboarding non vuoto — cosi'
    // gli interessi scelti contano dal primo ingresso (R1). hasSeed e' disponibile
    // sincrono al primo render (letto da localStorage nell'initializer del hook),
    // quindi la query 'home-experiences' parte gia' col valore giusto. La queryKey
    // NON cambia struttura: hasPreferences ne era gia' membro.
    const hasPreferences = totalInteractions >= 3 || hasSeed;
    const [isOffline, setIsOffline] = useState(!navigator.onLine);

    useEffect(() => {
        const goOffline = () => setIsOffline(true);
        const goOnline = () => setIsOffline(false);
        window.addEventListener('offline', goOffline);
        window.addEventListener('online', goOnline);
        return () => { window.removeEventListener('offline', goOffline); window.removeEventListener('online', goOnline); };
    }, []);

    // Fetch Experiences — personalizzate con il preference graph.
    //
    // Gate O.1: queryKey è [city, ...] senza lat/lng. Il primo render dei
    // POI dipende SOLO dal centro città (resolveCityCenter — Places auth),
    // non dal GPS utente. Quando il GPS arriva la queryKey non cambia →
    // niente refetch → costo Places dimezzato.
    //
    // Gate O.2: `enabled: !!city`. Se la citta' non e' ancora risolta,
    // la query NON parte → skeleton in UI. Zero fallback 'Roma' che
    // trapelano allo user come contenuto-ponte finto.
    const { data: experiences, isError: experiencesError, isPending: experiencesLoading, refetch: refetchExperiences } = useQuery({
        queryKey: ['home-experiences', city, totalInteractions, hasPreferences],
        enabled: !!city,
        queryFn: async () => {
            const currentCity = city;
            let finalTours = [];

            try {
                const tours = await dataService.getToursByCity(currentCity);
                if (tours && tours.length > 0) {
                    if (hasPreferences) {
                        // Ranking con Preference Engine: score affinità 0-100
                        finalTours = [...tours].sort((a, b) => getTourAffinity(b) - getTourAffinity(a));
                    } else {
                        // Utente nuovo: ordina per rating (migliori prima)
                        finalTours = [...tours].sort((a, b) => (parseFloat(b.rating) || 0) - (parseFloat(a.rating) || 0));
                    }
                }
            } catch (e) {
                console.warn("Failed to fetch tours, using fallback", e);
            }

            // Se non ci sono tour nel DB, genera con AI discovery + narrativa insider.
            if (finalTours.length === 0) {
                // Gate O.1: risolvo cityCenter una volta, autoritativo. Se la città
                // non esiste su Places (typo o proxy giù), fail-CLOSED: nessun tour
                // finto. La useQuery esce con [] → empty state onesto in UI.
                let cityCenter;
                try {
                    cityCenter = await resolveCityCenter(currentCity);
                } catch (err) {
                    if (err instanceof CityCenterUnresolvedError) {
                        console.warn(`[Per Te] cityCenter irrisolto (${err.reason}) per "${currentCity}" — empty state`);
                        return [];
                    }
                    throw err;
                }

                // Gate II — 1 call OpenAI unificata per TUTTI i tour Home.
                // Prima: Promise.all([buildSmartExperiencesAsync (4 tematici SENZA
                // narratore), generateItinerary (insider narrato)]). Bug: 4/5 tour
                // avevano description="" → placeholder "Luogo di interesse".
                // Ora: discoverAllThemes → pool per tema → generateHomeTours
                // narra TUTTI i tour in 1 chiamata (costo invariato).

                // Pool candidati per tema (Places-first, cache condivisa Gate DD).
                let themedPools = {};
                try {
                    themedPools = await placesDiscoveryService.discoverAllThemes(
                        currentCity, cityCenter.latitude, cityCenter.longitude
                    );
                } catch (e) {
                    console.warn('[Per Te] discoverAllThemes fallita:', e.message);
                }

                // Pool insider: unione top-15 by qualityScore da tutti i temi.
                // Il narratore sceglie la "perla" mescolando categorie.
                const allPoisSeen = new Map();
                for (const pois of Object.values(themedPools)) {
                    if (!Array.isArray(pois)) continue;
                    for (const p of pois) {
                        const pid = p.place_id || p.googlePlaceId || p.title;
                        if (pid && !allPoisSeen.has(pid)) allPoisSeen.set(pid, p);
                    }
                }
                const insiderPool = [...allPoisSeen.values()]
                    .sort((a, b) =>
                        ((b.rating || 0) * Math.log(1 + (b.user_ratings_total || 0))) -
                        ((a.rating || 0) * Math.log(1 + (a.user_ratings_total || 0)))
                    )
                    .slice(0, 15);

                // Call unificata: 1 sola call OpenAI, N tour narrati.
                let homeToursResult = { tours: [] };
                try {
                    homeToursResult = await aiRecommendationService.generateHomeTours({
                        city: currentCity,
                        cityCenter,
                        themedCandidates: {
                            insider: insiderPool,
                            ...themedPools, // food, cultura, romance, nature
                        },
                        prefs: { duration: '1 Giorno', group: 'solo', pace: 'rilassato' },
                        aiProfile: getAIContext?.() || '',
                    });
                } catch (err) {
                    console.warn('[Per Te] generateHomeTours errore:', err.message);
                }

                // Mapping output → shape UI. Ogni tour del narratore diventa una
                // card, insider in cima (badge dedicato). Regola II.2 applicata a
                // monte in generateHomeTours: stops con description vuota gia'
                // scartati, tour con 0 stops gia' esclusi.
                finalTours = homeToursResult.tours.map((tour) => {
                    const isInsider = tour.themeType === 'insider';
                    const firstStop = tour.stops[0];
                    const durationMin = tour.stops.reduce((acc, s) => acc + (s.suggestedMinutes || 30), 0);

                    // featuredPoi (Gate O.4): POI di punta = qualityScore max tra
                    // stops con rating reale. Solo tra step Google-verified.
                    const rated = tour.stops.filter(s => Number.isFinite(s.rating) && s.rating > 0);
                    const featuredPoi = rated.length > 0
                        ? (() => {
                            const best = rated.reduce((a, b) => {
                                const scoreA = a.rating * Math.log(1 + (a.reviewsCount || 0));
                                const scoreB = b.rating * Math.log(1 + (b.reviewsCount || 0));
                                return scoreB > scoreA ? b : a;
                            });
                            return { name: best.title, rating: best.rating, reviewsCount: best.reviewsCount };
                        })()
                        : null;

                    const emoji = isInsider ? '🧭' : (THEME_EMOJIS[tour.themeType] || '📍');
                    const category = isInsider ? '✨ Insider AI' : "Consigliato dall'AI";
                    const themeFallbackImg = THEME_FALLBACK_IMAGES[tour.themeType] || CITY_IMAGES[currentCity] || GENERIC.piazza;

                    return normalizeTour({
                        id: `home-${tour.themeType}-${Date.now()}`,
                        type: isInsider ? 'ai-insider' : 'ai-memory',
                        title: tour.title,
                        location: `${currentCity}, ${isInsider ? 'Tour AI Insider' : 'Esperienza Locale'}`,
                        // Gate O.2: nessun rating/reviews/price tour-level.
                        duration: `${durationMin} min`,
                        image: firstStop?.googlePhoto || themeFallbackImg,
                        category,
                        emoji,
                        isAiGenerated: true,
                        isInsiderNarrative: isInsider,
                        highlights: tour.stops.slice(0, 3).map(s => s.title),
                        included: ['Tour-storia con narrativa', 'Suggerimenti insider per ogni tappa', 'Quando andare per il momento giusto'],
                        notIncluded: ['Guida fisica', 'Biglietti musei'],
                        guideBio: `Itinerario narrato dall'AI su luoghi reali di ${currentCity}.`,
                        center: { latitude: cityCenter.latitude, longitude: cityCenter.longitude },
                        stops: tour.stops,
                        suggestedTransit: tour.suggestedTransit || 'walking',
                        mapMood: tour.mapMood || 'default',
                        featuredPoi,
                    }, {
                        cityFallback: currentCity,
                        cityCenter: { latitude: cityCenter.latitude, longitude: cityCenter.longitude },
                    });
                });

                // Insider sempre in cima (badge "✨ Insider AI"). Se il narratore
                // non ha prodotto insider, l'ordine resta come tornato dall'AI.
                const insiderIdx = finalTours.findIndex(t => t.isInsiderNarrative);
                if (insiderIdx > 0) {
                    const [insiderTour] = finalTours.splice(insiderIdx, 1);
                    finalTours.unshift(insiderTour);
                }

                // Ordinamento DNA preferences (esclude insider dalla parte
                // riordinabile — resta primo per costruzione).
                if (hasPreferences) {
                    const head = finalTours[0]?.isInsiderNarrative ? [finalTours[0]] : [];
                    const tail = (head.length ? finalTours.slice(1) : finalTours)
                        .sort((a, b) => getTourAffinity(b) - getTourAffinity(a));
                    finalTours = [...head, ...tail];
                }
            }

            // Arricchisci categoria + garantisci immagine coerente con la città
            const cityFallbackImg = CITY_IMAGES[currentCity] || GENERIC.piazza;
            return finalTours.slice(0, 5).map((t, i) => ({
                ...t,
                image: t.image || t.imageUrl || cityFallbackImg,
                images: (t.images?.length > 0) ? t.images : [t.image || t.imageUrl || cityFallbackImg],
                category: hasPreferences && i === 0
                    ? 'Scelto per te'
                    : (t.category || (hasPreferences ? 'Basato sui tuoi gusti' : 'Popolare a ' + currentCity)),
            }));
        },
        // Gate D-2: placeholderData rimosso. Prima serviva 3 tour finti con
        // rating "4.8" e coordinate Roma spacciati per reali. Ora la UI mostra
        // uno skeleton (isPending) mentre carica, empty state se non c'è nulla,
        // errore se la fetch fallisce.
        // Invalida cache e refetch quando la città cambia
        staleTime: 120_000, // 2 min — permette refetch rapido al cambio città
    });

    const [tourHistory, setTourHistory] = useState([]);
    useEffect(() => {
        try {
            const saved = localStorage.getItem('user_tour_history');
            if (saved) {
                setTourHistory(JSON.parse(saved));
            }
        } catch (e) {
            console.warn('Could not load tour history', e);
        }
    }, []);

    // Timeout safety: se isLoading dura > 8s, mostra comunque il contenuto
    const [loadingTimeout, setLoadingTimeout] = useState(false);
    useEffect(() => {
        if (isLoading) {
            const t = setTimeout(() => setLoadingTimeout(true), 8000);
            return () => clearTimeout(t);
        }
        setLoadingTimeout(false);
    }, [isLoading]);

    if (isLoading && !loadingTimeout) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-orange-50 to-white gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-200">
                    <span className="text-2xl">🗺️</span>
                </div>
                <div className="flex gap-1">
                    {[0, 1, 2].map(i => (
                        <div key={i} className="w-2 h-2 rounded-full bg-orange-400" style={{ animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                    ))}
                </div>
                <style>{`@keyframes pulse { 0%,80%,100% { opacity: 0.3; transform: scale(0.8); } 40% { opacity: 1; transform: scale(1.2); } }`}</style>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-ochre-100 to-ochre-200 font-quicksand pb-32">

            <TopBar />

            <main className="max-w-md mx-auto px-6 space-y-6 pt-6">

                {/* Offline Banner */}
                {isOffline && (
                    <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-2xl p-3 text-red-700 text-sm font-medium">
                        <span>📡</span> Sei offline. Alcune funzioni potrebbero non essere disponibili.
                    </div>
                )}

                <GpsActivationBanner />

                {/* USER PROGRESS / HISTORY MODULE */}
                {tourHistory.length > 0 && (
                    <motion.div 
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                        className="bg-white rounded-[2rem] p-6 shadow-xl border border-gray-100 flex flex-col gap-4 relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-400/10 rounded-full blur-3xl -z-0"></div>
                        <div className="flex items-center justify-between z-10">
                            <div>
                                <h3 className="text-xl font-black text-gray-900 drop-shadow-sm flex items-center gap-2">
                                    <Award size={20} className="text-yellow-500"/> Il tuo Diario
                                </h3>
                                <p className="text-sm text-gray-500 font-medium">Tappe e Scoperte</p>
                            </div>
                            <div className="bg-yellow-50 text-yellow-700 font-black px-3 py-1.5 rounded-xl border border-yellow-200">
                                {tourHistory.length} Tour
                            </div>
                        </div>

                        <div className="space-y-3 mt-2 z-10 w-full overflow-x-auto pb-2 no-scrollbar flex snap-x">
                            {tourHistory.slice(0, 5).map(tour => {
                                const tourDate = new Date(tour.date).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
                                return (
                                    <div key={tour.id} className="min-w-[240px] shrink-0 bg-gray-50 rounded-2xl p-4 border border-gray-100 snap-center mr-3 shadow-sm">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-xs font-bold text-gray-400 bg-white px-2 py-0.5 rounded-md border border-gray-100">{tourDate}</span>
                                            <span className="p-1 bg-yellow-100 text-yellow-600 rounded-lg"><Star fill="currentColor" size={14}/></span>
                                        </div>
                                        <h4 className="font-bold text-gray-900 truncate mb-1">{tour.title}</h4>
                                        <div className="flex items-center gap-3 text-xs text-gray-500 font-medium">
                                            <span className="flex items-center gap-1"><MapPin size={12}/> {tour.distance}</span>
                                            <span className="flex items-center gap-1 bg-orange-50 text-orange-600 px-1.5 rounded"><Crosshair size={10} className="hidden"/> {tour.completedCount} Tappe</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </motion.div>
                )}

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

                {/* Core Section - SMART GLASS BUTTONS
                    Gate W: Ordine cambiato. Prima venivano prima le funzioni VERE
                    (AI Itinerary, Quiz), poi la card Guide Locali SUBORDINATA
                    visivamente (padding ridotto, opacita', badge "in costruzione"
                    invece di "LIVE NOW"). La gerarchia visiva dice la verita' quanto
                    il testo: una card di funzione non attiva non pesa come una attiva.
                */}
                <section className="flex flex-col space-y-5">

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

                    {/* Gate W — Card Guide Locali SUBORDINATA visivamente.
                        Prima: card grande con badge "LIVE NOW" rosso pulsante che prometteva
                        una funzione inesistente. Ora: card piu' piccola (p-3 vs p-5), opacita'
                        ridotta (75%), colori smorzati (bg gray-100 vs gradient terracotta),
                        badge "◇ FASE 2 · IN COSTRUZIONE" (statico, no rosso). Posizionata SOTTO
                        AI Itinerary e Quiz Veloce — le funzioni che esistono davvero.
                        Click -> /prossimamente/guide (schermata onesta), non /explore. */}
                    <Link to="/prossimamente/guide" className="block opacity-75 hover:opacity-100 transition-opacity">
                        <motion.div
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.98 }}
                            className="relative bg-gray-100 rounded-2xl p-3 border border-gray-200 flex items-center justify-between group"
                        >
                            <div className="flex items-center gap-3">
                                <div className="bg-white p-2 rounded-xl border border-gray-200">
                                    <Users className="w-5 h-5 text-gray-500" />
                                </div>
                                <div>
                                    <div className="mb-0.5">
                                        {/* Gate Y.4: badge senza gergo "Fase N" (interno). */}
                                        <span className="inline-flex items-center bg-terracotta-50 text-terracotta-700 text-[9px] font-bold px-2 py-0.5 rounded-full border border-terracotta-200 uppercase tracking-wider">
                                            <span className="mr-1 text-[11px] leading-none">◇</span>
                                            In costruzione
                                        </span>
                                    </div>
                                    <h3 className="text-sm font-bold text-gray-800 leading-tight">Guide Locali</h3>
                                    <p className="text-gray-500 text-[11px] leading-snug mt-0.5">Persone del posto — non ancora disponibili</p>
                                </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-0.5 transition-transform" />
                        </motion.div>
                    </Link>

                </section>

                {/* Footer Section - Magazine Style Experiences */}
                <section>
                    <div className="flex items-center justify-between mb-4 px-1">
                        <h3 className="text-xl font-bold text-gray-800 font-playfair">
                            {hasPreferences ? 'Per Te' : 'Esperienze Uniche'}
                        </h3>
                        <Link to="/explore" className="text-xs font-bold text-gray-500 hover:text-terracotta-500 uppercase tracking-widest transition-colors">
                            Vedi tutte
                        </Link>
                    </div>

                    <div className="flex overflow-x-auto space-x-5 pb-8 -mx-6 px-6 scrollbar-hide">
                        {experiencesError ? (
                            <div className="flex flex-col items-center justify-center py-8 w-full text-center">
                                <p className="text-gray-500 text-sm mb-3">Non riesco a caricare le esperienze</p>
                                <button onClick={() => refetchExperiences()} className="px-4 py-2 bg-orange-500 text-white rounded-xl text-sm font-bold active:scale-95 transition-transform">Riprova</button>
                            </div>
                        ) : experiencesLoading ? (
                            // Gate D-2: skeleton onesto al posto dei tour finti. Card grigie,
                            // non cliccabili, nessun testo/rating che potrebbe sembrare reale.
                            [0, 1, 2].map(i => (
                                <div key={`skel-${i}`} className="min-w-[260px] h-64 rounded-2xl bg-black/5 animate-pulse" />
                            ))
                        ) : (experiences && experiences.length > 0) ? experiences.map((exp) => (
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
                                    {/* DVAI-058 — Copertina unificata (ramo A foto Places brand-uniformi / ramo B illustrato per categoria) */}
                                    <TourCover
                                        cover={exp.image}
                                        category={exp.category || exp.type}
                                        type={exp.type}
                                        title={exp.title}
                                        animateKey={exp.image}
                                    >
                                        {/* Gate O.4: nessun rating a livello TOUR. Il rating e' un fatto
                                            del singolo POI (Google Places), non del tour aggregato. Il
                                            badge featuredPoi qui sotto mostra ★rating + nome del POI di
                                            punta (qualityScore max), verificabile su Maps. */}
                                        <div className="absolute bottom-0 left-0 p-5 w-full text-white">
                                            <div className="text-[10px] font-bold text-gray-300 uppercase tracking-wider mb-1">{exp.category}</div>
                                            <h4 className="font-playfair font-bold text-lg leading-tight mb-2 line-clamp-2">{exp.title}</h4>
                                            {exp.featuredPoi && Number.isFinite(exp.featuredPoi.rating) && (
                                                <div className="flex items-center gap-1.5 text-xs mb-2 opacity-95">
                                                    <Star className="w-3 h-3 text-yellow-400 fill-current shrink-0" />
                                                    <span className="font-medium truncate">Include {exp.featuredPoi.name}</span>
                                                    <span className="font-bold whitespace-nowrap">· {exp.featuredPoi.rating.toFixed(1)}</span>
                                                </div>
                                            )}
                                            <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/20">
                                                <div className="flex items-center text-xs font-medium opacity-90">
                                                    <Clock className="w-3 h-3 mr-1" />
                                                    {exp.duration}
                                                </div>
                                                {/* Gate O.2: prezzo solo se e' un numero reale dal DB tours.price_eur. */}
                                                {Number.isFinite(exp.price) && (
                                                    <span className="font-bold text-base">€{exp.price}</span>
                                                )}
                                            </div>
                                        </div>
                                    </TourCover>
                                </motion.div>
                            </Link>
                        )) : (
                            // Gate D-2: empty state onesto al posto dei 3 tour finti.
                            <div className="flex flex-col items-center justify-center py-10 w-full text-center">
                                <div className="text-4xl mb-3">🌱</div>
                                <p className="text-gray-700 text-sm mb-1 font-semibold">{city ? `Non ci sono ancora tour a ${city}.` : 'Non ci sono ancora tour qui.'}</p>
                                <p className="text-gray-500 text-xs">Ne stiamo aggiungendo nuovi ogni settimana. Torna presto.</p>
                            </div>
                        )}
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
                                        Fantastico! Le guide locali su <strong>{requestCity || city}</strong> hanno appena ricevuto la tua ispirazione.<br /><br />Ti contatteranno presto con una proposta personalizzata.
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
