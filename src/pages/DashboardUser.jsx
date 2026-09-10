import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Users, Brain, Zap, MapPin, ThermometerSun, Compass, Clock, Star, ChevronRight, Gamepad2, Gift, X, CloudRain, Sun, Snowflake, CheckCircle, Loader2, Award, Crosshair, WifiOff, MessageSquare, Tag } from 'lucide-react';
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
import { normalizeTour } from '@/services/tourShape';
import { totalTourMinutes, formatEstimate } from '@/lib/tourTiming';
import { resolveCityCenter, CityCenterUnresolvedError } from '@/services/cityCenterService';
import TourCover from '@/components/TourCover';
// 🧠 AI-POWERED EXPERIENCE GENERATOR (REAL POI DISCOVERY)

// Theme-aware fallback images (city-neutral, topic-relevant).
// Gate P.1: 4 temi (walking morto, art rinominato cultura).
// Gate VERITÀ VISIVA (F26) DIFF 4 — THEME_FALLBACK_IMAGES rimosso: era la
// prima maglia della catena di stock che finiva sulla copertina dei tour "Per Te".

const THEME_EMOJIS = {};

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
                    // Gate RAGGIO DIFF 1a — la somma a mano di `suggestedMinutes`
                    // (durata chiesta al modello) e' RIMOSSA. Il totale ora viene
                    // dalla fonte unica: soste stimate dai types + spostamenti
                    // haversine, gia' calcolati a monte in generateHomeTours.
                    const durationMin = totalTourMinutes(tour.stops);

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

                    const emoji = null;
                    const category = isInsider ? 'Insider AI' : "Consigliato dall'AI";
                    // Gate VERITÀ VISIVA (F26) DIFF 4 — rimossa la catena
                    // THEME_FALLBACK_IMAGES -> CITY_IMAGES -> GENERIC.piazza.
                    // Erano tre livelli di stock Unsplash mostrati come copertina di
                    // QUESTO tour: per "Roma" CITY_IMAGES dava il Colosseo. TourCover
                    // (gia' usato a :677) cade da solo nel ramo B illustrato quando
                    // `cover` non e' una foto Places verificata — non serve dargli
                    // un ripiego, serve NON darglielo.

                    return normalizeTour({
                        id: `home-${tour.themeType}-${Date.now()}`,
                        type: isInsider ? 'ai-insider' : 'ai-memory',
                        title: tour.title,
                        location: `${currentCity}, ${isInsider ? 'Tour AI Insider' : 'Esperienza Locale'}`,
                        // Gate O.2: nessun rating/reviews/price tour-level.
                        duration: formatEstimate(durationMin),
                        image: firstStop?.googlePhoto || null,
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

            // Gate VERITÀ VISIVA (F26) DIFF 4 — via anche il secondo `cityFallbackImg`
            // (CITY_IMAGES -> GENERIC.piazza). "Garantisci immagine coerente con la
            // città" era il nome gentile di "metti uno stock che assomigli al posto":
            // il Colosseo su Roma, una piazza generica ovunque. Senza foto vera la
            // copertina e' il gradient di categoria di TourCover.
            return finalTours.slice(0, 5).map((t, i) => ({
                ...t,
                image: t.image || t.imageUrl || null,
                images: (t.images?.length > 0) ? t.images : [t.image || t.imageUrl].filter(Boolean),
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
            <div className="flex flex-col items-center justify-center min-h-screen bg-obsidian-bg gap-4">
                <div className="w-14 h-14 rounded-2xl bg-obsidian-card border border-obsidian-border flex items-center justify-center shadow-lg">
                    <Compass className="w-7 h-7 text-brand-orange" />
                </div>
                <div className="flex gap-1.5">
                    {[0, 1, 2].map(i => (
                        <div key={i} className="w-2 h-2 rounded-full bg-brand-orange" style={{ animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                    ))}
                </div>
                <style>{`@keyframes pulse { 0%,80%,100% { opacity: 0.3; transform: scale(0.8); } 40% { opacity: 1; transform: scale(1.2); } }`}</style>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-obsidian-bg text-obsidian-primary font-quicksand pb-32">

            <TopBar />

            <main className="max-w-md mx-auto px-6 space-y-6 pt-6">

                {/* Offline Banner */}
                {isOffline && (
                    <div className="flex items-center gap-2 bg-obsidian-card border border-obsidian-border rounded-2xl p-3 text-obsidian-secondary text-sm font-medium">
                        <WifiOff className="w-4 h-4 text-obsidian-secondary shrink-0" />
                        <span>Sei offline. Alcune funzioni potrebbero non essere disponibili.</span>
                    </div>
                )}

                <GpsActivationBanner />

                {/* USER PROGRESS / HISTORY MODULE */}
                {tourHistory.length > 0 && (
                    <motion.div 
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                        className="bg-obsidian-card rounded-[2rem] p-6 shadow-xl border border-obsidian-border flex flex-col gap-4 relative overflow-hidden"
                    >
                        <div className="flex items-center justify-between z-10">
                            <div>
                                <h3 className="text-xl font-black text-obsidian-primary flex items-center gap-2">
                                    <Award size={20} className="text-obsidian-secondary"/> Il tuo Diario
                                </h3>
                                <p className="text-sm text-obsidian-secondary font-medium">Tappe e Scoperte</p>
                            </div>
                            <div className="bg-obsidian-raised text-obsidian-primary font-bold px-3 py-1.5 rounded-xl border border-obsidian-border text-xs">
                                {tourHistory.length} Tour
                            </div>
                        </div>

                        <div className="space-y-3 mt-2 z-10 w-full overflow-x-auto pb-2 no-scrollbar flex snap-x">
                            {tourHistory.slice(0, 5).map(tour => {
                                const tourDate = new Date(tour.date).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
                                return (
                                    <div key={tour.id} className="min-w-[240px] shrink-0 bg-obsidian-raised rounded-2xl p-4 border border-obsidian-border snap-center mr-3 shadow-sm">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-xs font-bold text-obsidian-secondary bg-obsidian-card px-2 py-0.5 rounded-md border border-obsidian-border">{tourDate}</span>
                                            <span className="p-1 bg-obsidian-card text-brand-orange rounded-lg border border-obsidian-border"><Star fill="currentColor" size={14}/></span>
                                        </div>
                                        <h4 className="font-bold text-obsidian-primary truncate mb-1">{tour.title}</h4>
                                        <div className="flex items-center gap-3 text-xs text-obsidian-secondary font-medium">
                                            <span className="flex items-center gap-1"><MapPin size={12}/> {tour.distance}</span>
                                            <span className="flex items-center gap-1 bg-obsidian-card text-obsidian-secondary px-1.5 rounded border border-obsidian-border"><Crosshair size={10} className="hidden"/> {tour.completedCount} Tappe</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </motion.div>
                )}

                {/* Custom Tour Block - EXPANDABLE */}
                <motion.div
                    className="bg-obsidian-card rounded-3xl p-5 shadow-lg border border-obsidian-border relative overflow-hidden group cursor-pointer"
                    initial={{ height: 'auto' }}
                    onClick={() => setShowCustomOptions(!showCustomOptions)}
                >
                    <div className="flex items-center justify-between relative z-10">
                        <div>
                            <h3 className="font-bold text-obsidian-primary text-lg leading-tight">Crea il tuo Tour</h3>
                            <p className="text-xs text-obsidian-secondary mt-1 font-medium bg-obsidian-raised border border-obsidian-border px-2 py-0.5 rounded-full w-fit">Su misura per te</p>
                        </div>
                        <div className={`transition-transform duration-300 ${showCustomOptions ? 'rotate-180' : ''}`}>
                            <div className="bg-obsidian-raised border border-obsidian-border p-3 rounded-full group-hover:border-brand-orange transition-colors">
                                <Compass className="w-6 h-6 text-obsidian-secondary group-hover:text-brand-orange transition-colors" />
                            </div>
                        </div>
                    </div>

                    {/* Expanded Options */}
                    <AnimatePresence>
                        {showCustomOptions && (
                            <motion.div
                                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                                animate={{ opacity: 1, height: 'auto', marginTop: 20 }}
                                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                                className="grid grid-cols-2 gap-3"
                            >
                                <div onClick={handleGuideRequest} className="cursor-pointer bg-obsidian-raised hover:bg-obsidian-card border border-obsidian-border p-4 rounded-2xl flex flex-col items-center justify-center text-center transition-colors">
                                    <Users size={22} className="text-obsidian-primary mb-2" />
                                    <span className="text-xs font-bold text-obsidian-primary leading-tight">Con Guida</span>
                                    <span className="text-[10px] text-obsidian-secondary mt-1">Trova un esperto locale</span>
                                </div>
                                <Link to="/surprise-tour" className="bg-obsidian-raised hover:bg-obsidian-card border border-obsidian-border p-4 rounded-2xl flex flex-col items-center justify-center text-center transition-colors">
                                    <Gift size={22} className="text-obsidian-primary mb-2" />
                                    <span className="text-xs font-bold text-obsidian-primary leading-tight">Sorprendimi</span>
                                    <span className="text-[10px] text-obsidian-secondary mt-1">Lasciati sorprendere</span>
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
                <section className="flex flex-col space-y-4">

                    {/* Button 2: AI Itinerary (Azione Dominante — Accento Arancione) */}
                    <Link to="/ai-itinerary" className="block">
                        <motion.div
                            whileHover={{ scale: 1.02, y: -2 }}
                            whileTap={{ scale: 0.95 }}
                            className="relative bg-obsidian-card border border-brand-orange/60 hover:border-brand-orange rounded-3xl p-5 shadow-xl transition-all group overflow-hidden"
                        >
                            <div className="relative z-10 flex items-center justify-between">
                                <div className="flex items-center space-x-4">
                                    <div className="bg-brand-orange text-obsidian-bg p-3 rounded-2xl shadow-md">
                                        <Brain className="w-8 h-8 drop-shadow-sm" />
                                    </div>
                                    <div>
                                        <div className="mb-1">
                                            <span className="bg-brand-orange/15 text-brand-orange border border-brand-orange/30 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wide w-fit block">
                                                Gratis & Su Misura
                                            </span>
                                        </div>
                                        <h3 className="text-xl font-bold font-playfair text-obsidian-primary leading-tight">Crea il tuo Percorso</h3>
                                        <p className="text-obsidian-secondary text-xs font-medium mt-0.5">Intelligenza artificiale per te</p>
                                    </div>
                                </div>
                                <ChevronRight className="w-5 h-5 text-obsidian-secondary group-hover:text-brand-orange group-hover:translate-x-1 transition-transform" />
                            </div>
                        </motion.div>
                    </Link>

                    {/* Button 3: Quick Quiz (Azione Secondaria — Scala Ossidiana) */}
                    <div className="relative">
                        <Link to="/quick-path" className="block">
                            <motion.div
                                whileHover={{ scale: 1.02, y: -2 }}
                                whileTap={{ scale: 0.95 }}
                                className="relative bg-obsidian-card border border-obsidian-border hover:border-obsidian-border/80 rounded-3xl p-5 shadow-lg transition-all group cursor-pointer overflow-hidden"
                            >
                                <div className="relative z-10 flex items-center justify-between">
                                    <div className="flex items-center space-x-4">
                                        <div className="bg-obsidian-raised border border-obsidian-border p-3 rounded-2xl text-obsidian-primary">
                                            <Gamepad2 className="w-8 h-8" />
                                        </div>
                                        <div>
                                            <div className="mb-1">
                                                <span className="bg-obsidian-raised text-obsidian-secondary border border-obsidian-border text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide flex w-fit items-center">
                                                    <Brain className="w-3 h-3 mr-1" />
                                                    AI Powered
                                                </span>
                                            </div>
                                            <h3 className="text-xl font-bold font-playfair text-obsidian-primary leading-tight">Quiz Veloce</h3>
                                            <p className="text-obsidian-secondary text-xs font-medium mt-0.5">Scopri il tuo stile di viaggio</p>
                                        </div>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-obsidian-secondary group-hover:text-obsidian-primary group-hover:translate-x-1 transition-transform" />
                                </div>
                            </motion.div>
                        </Link>
                    </div>

                    {/* Gate W — Card Guide Locali SUBORDINATA visivamente sulla scala */}
                    <Link to="/prossimamente/guide" className="block opacity-75 hover:opacity-100 transition-opacity">
                        <motion.div
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.98 }}
                            className="relative bg-obsidian-card/60 rounded-2xl p-3 border border-obsidian-border flex items-center justify-between group"
                        >
                            <div className="flex items-center gap-3">
                                <div className="bg-obsidian-raised border border-obsidian-border p-2 rounded-xl text-obsidian-secondary">
                                    <Users className="w-5 h-5" />
                                </div>
                                <div>
                                    <div className="mb-0.5">
                                        <span className="inline-flex items-center bg-obsidian-raised text-obsidian-secondary text-[9px] font-bold px-2 py-0.5 rounded-full border border-obsidian-border uppercase tracking-wider">
                                            <span className="mr-1 text-[11px] leading-none">◇</span>
                                            In costruzione
                                        </span>
                                    </div>
                                    <h3 className="text-sm font-bold text-obsidian-primary leading-tight">Guide Locali</h3>
                                    <p className="text-obsidian-secondary text-[11px] leading-snug mt-0.5">Persone del posto — non ancora disponibili</p>
                                </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-obsidian-secondary group-hover:translate-x-0.5 transition-transform" />
                        </motion.div>
                    </Link>

                </section>

                {/* Footer Section - Magazine Style Experiences */}
                <section>
                    <div className="flex items-center justify-between mb-4 px-1">
                        <h3 className="text-xl font-bold text-obsidian-primary font-playfair">
                            {hasPreferences ? 'Per Te' : 'Esperienze Uniche'}
                        </h3>
                        <Link to="/explore" className="text-xs font-bold text-obsidian-secondary hover:text-obsidian-primary uppercase tracking-widest transition-colors">
                            Vedi tutte
                        </Link>
                    </div>

                    <div className="flex overflow-x-auto gap-3 pb-6 -mx-6 px-6 scrollbar-hide snap-x">
                        {experiencesError ? (
                            <div className="flex flex-col items-center justify-center py-8 w-full text-center">
                                <p className="text-obsidian-secondary text-sm mb-3">Non riesco a caricare le esperienze</p>
                                <button onClick={() => refetchExperiences()} className="px-4 py-2 bg-brand-orange text-obsidian-bg rounded-xl text-sm font-bold active:scale-95 transition-transform">Riprova</button>
                            </div>
                        ) : experiencesLoading ? (
                            [0, 1, 2].map(i => (
                                <div key={`skel-${i}`} className="w-[calc((100vw-60px)/2)] max-w-[170px] min-w-[150px] h-[265px] rounded-2xl bg-obsidian-card border border-obsidian-border animate-pulse shrink-0 flex flex-col overflow-hidden">
                                    <div className="h-28 w-full bg-obsidian-raised" />
                                    <div className="p-3 flex-1 flex flex-col justify-between">
                                        <div className="space-y-1.5">
                                            <div className="w-16 h-3 rounded-full bg-obsidian-raised" />
                                            <div className="w-28 h-4 rounded bg-obsidian-raised" />
                                            <div className="w-20 h-3 rounded bg-obsidian-raised" />
                                        </div>
                                        <div className="pt-2 border-t border-obsidian-border flex justify-between">
                                            <div className="w-12 h-2.5 rounded bg-obsidian-raised" />
                                            <div className="w-8 h-2.5 rounded bg-obsidian-raised" />
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (experiences && experiences.length > 0) ? experiences.map((exp) => (
                            <Link
                                to={`/tour-details/${exp.id}`}
                                state={{ tourData: exp }}
                                key={exp.id}
                                className="block w-[calc((100vw-60px)/2)] max-w-[170px] min-w-[150px] shrink-0 snap-start"
                            >
                                <motion.div
                                    className="group flex flex-col h-[265px] rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 border border-obsidian-border bg-obsidian-card"
                                    whileHover={{ y: -3 }}
                                >
                                    {/* Foto Places PULITA (ramo A) o Gradient Categoria (ramo B) con rapporto fisso */}
                                    <div className="relative h-28 w-full overflow-hidden shrink-0 border-b border-obsidian-border bg-obsidian-raised">
                                        <TourCover
                                            cover={exp.image}
                                            category={exp.category || exp.type}
                                            type={exp.type}
                                            title={exp.title}
                                            animateKey={exp.image}
                                            overlay={false}
                                        />
                                    </div>

                                    {/* Blocco Dati su bg-obsidian-card: due card intere a schermo */}
                                    <div className="p-2.5 flex flex-col flex-1 justify-between">
                                        <div>
                                            {/* Badge discreto */}
                                            <div className="mb-1">
                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-obsidian-raised text-obsidian-secondary border border-obsidian-border tracking-tight truncate max-w-full">
                                                    {exp.category}
                                                </span>
                                            </div>

                                            {/* Titolo compatto */}
                                            <h4 className="font-playfair font-bold text-xs text-obsidian-primary leading-snug line-clamp-2 mb-1">
                                                {exp.title}
                                            </h4>

                                            {/* Riga Include o Luogo */}
                                            {exp.featuredPoi && Number.isFinite(exp.featuredPoi.rating) ? (
                                                <div className="flex items-center gap-1 text-[10px] text-obsidian-secondary truncate">
                                                    <Star className="w-3 h-3 text-brand-orange fill-current shrink-0" />
                                                    <span className="truncate">{exp.featuredPoi.name}</span>
                                                    <span className="font-semibold text-obsidian-primary shrink-0">· {exp.featuredPoi.rating.toFixed(1)}</span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-1 text-[10px] text-obsidian-secondary truncate">
                                                    <MapPin className="w-3 h-3 text-obsidian-secondary/60 shrink-0" />
                                                    <span className="truncate">{exp.location || (city ? `Tour a ${city}` : 'Esperienza')}</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Metadati ancorati in basso */}
                                        <div className="mt-auto pt-2 border-t border-obsidian-border flex items-center justify-between text-[10px] text-obsidian-secondary">
                                            <div className="flex items-center gap-1">
                                                <Clock className="w-3 h-3 text-obsidian-secondary shrink-0" />
                                                <span className="truncate">{exp.duration}</span>
                                            </div>
                                            {Number.isFinite(exp.price) && (
                                                <span className="font-bold text-xs text-obsidian-primary shrink-0">€{exp.price}</span>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            </Link>
                        )) : (
                            <div className="flex flex-col items-center justify-center py-10 w-full text-center">
                                <div className="w-12 h-12 rounded-2xl bg-obsidian-raised border border-obsidian-border flex items-center justify-center mx-auto mb-3 text-obsidian-secondary">
                                    <Compass className="w-6 h-6 stroke-[1.5]" />
                                </div>
                                <p className="text-obsidian-primary text-sm mb-1 font-semibold">{city ? `Nessuna guida ha ancora pubblicato un tour a ${city}.` : 'Nessuna guida ha ancora pubblicato un tour qui.'}</p>
                                <p className="text-obsidian-secondary text-xs mb-4">Il motore AI ne costruisce uno adesso, sui luoghi veri della città.</p>
                                <Link
                                    to="/ai-itinerary"
                                    className="px-5 py-2.5 bg-brand-orange text-obsidian-bg rounded-2xl text-xs font-bold hover:bg-brand-orange-hover transition-colors shadow-md shadow-brand-orange/20"
                                >
                                    Crea il tuo percorso
                                </Link>
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
                            className="absolute inset-0 bg-obsidian-bg/80 backdrop-blur-md"
                            onClick={() => setShowRequestModal(false)}
                        />
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="bg-obsidian-card border border-obsidian-border w-full max-w-md rounded-3xl p-6 relative z-10 shadow-2xl overflow-hidden"
                        >
                            <button
                                onClick={() => setShowRequestModal(false)}
                                className="absolute top-4 right-4 p-2 bg-obsidian-raised border border-obsidian-border rounded-full hover:bg-obsidian-card transition-colors z-20 text-obsidian-secondary hover:text-obsidian-primary"
                            >
                                <X size={18} />
                            </button>

                            {requestStatus === 'success' ? (
                                <motion.div
                                    initial={{ scale: 0.8, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    className="pt-6 pb-2 text-center flex flex-col items-center"
                                >
                                    <div className="w-20 h-20 bg-obsidian-raised border border-obsidian-border rounded-full flex items-center justify-center mb-6 relative">
                                        <motion.div
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
                                        >
                                            <CheckCircle className="w-10 h-10 text-brand-orange" />
                                        </motion.div>
                                    </div>
                                    <h3 className="text-2xl font-bold text-obsidian-primary mb-2">Richiesta inviata</h3>
                                    <p className="text-obsidian-secondary text-sm mb-8 leading-relaxed px-4">
                                        È visibile alle guide registrate su DoveVAI. Se una guida la prende in carico, la proposta ti arriva qui.
                                    </p>
                                    <button
                                        onClick={() => {
                                            setShowRequestModal(false);
                                            setRequestText('');
                                            setRequestStatus('idle');
                                        }}
                                        className="w-full bg-obsidian-raised border border-obsidian-border text-obsidian-primary font-bold py-4 rounded-xl hover:bg-obsidian-card transition-all active:scale-95"
                                    >
                                        Chiudi e prosegui
                                    </button>
                                </motion.div>
                            ) : (
                                <>
                                    <div className="text-center mb-6">
                                        <div className="w-16 h-16 bg-obsidian-raised border border-obsidian-border rounded-full flex items-center justify-center mx-auto mb-4 text-brand-orange">
                                            <Compass className="w-8 h-8" />
                                        </div>
                                        <h3 className="text-2xl font-bold text-obsidian-primary">Tour su Misura</h3>
                                        <p className="text-obsidian-secondary text-sm mt-1">Le guide riceveranno la tua richiesta in base alla città scelta.</p>
                                    </div>

                                    <div className="space-y-4">
                                        {/* City Selector */}
                                        <div>
                                            <label className="block text-xs font-bold text-obsidian-secondary uppercase mb-2">Città del Tour</label>
                                            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                                                {['Roma', 'Milano', 'Firenze', 'Venezia', 'Napoli'].map((cityName) => {
                                                    const isSelected = requestCity === cityName;
                                                    return (
                                                        <button
                                                            key={cityName}
                                                            type="button"
                                                            onClick={() => setRequestCity(cityName)}
                                                            disabled={requestStatus === 'submitting'}
                                                            className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all text-center cursor-pointer ${
                                                                isSelected
                                                                    ? 'bg-obsidian-raised border-brand-orange ring-1 ring-brand-orange/40 text-obsidian-primary'
                                                                    : 'bg-obsidian-bg border-obsidian-border text-obsidian-secondary hover:text-obsidian-primary hover:border-obsidian-border/80'
                                                            }`}
                                                        >
                                                            {cityName}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-obsidian-secondary uppercase mb-2">La tua idea</label>
                                            <textarea
                                                value={requestText}
                                                onChange={(e) => setRequestText(e.target.value)}
                                                placeholder="Vorrei visitare i mercati storici e assaggiare lo street food locale..."
                                                className="w-full bg-obsidian-bg border border-obsidian-border rounded-xl p-4 min-h-[120px] focus:outline-none focus:border-brand-orange transition-all resize-none text-obsidian-primary placeholder:text-obsidian-secondary/60 disabled:opacity-50"
                                                autoFocus
                                                disabled={requestStatus === 'submitting'}
                                            />
                                        </div>
                                    </div>

                                    {requestStatus === 'error' && (
                                        <div className="bg-obsidian-raised border border-brand-orange/40 text-brand-orange p-3 rounded-lg text-sm text-center font-bold">
                                            Si è verificato un errore. Riprova.
                                        </div>
                                    )}

                                    <button
                                        onClick={submitGuideRequest}
                                        disabled={requestStatus === 'submitting' || requestText.trim().length === 0}
                                        className="w-full bg-brand-orange text-obsidian-bg font-bold py-4 rounded-xl hover:bg-brand-orange-hover transition-all shadow-lg shadow-brand-orange/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
                        <div className="flex items-start gap-3 p-4 rounded-2xl shadow-2xl border border-obsidian-border bg-obsidian-card/95 backdrop-blur-md">
                            {/* Icon */}
                            <div className="p-2 rounded-xl bg-obsidian-raised border border-obsidian-border text-brand-orange shrink-0 mt-0.5">
                                {toast.type === 'request_declined' ? (
                                    <MessageSquare className="w-5 h-5" />
                                ) : toast.type === 'price_offer' ? (
                                    <Tag className="w-5 h-5" />
                                ) : (
                                    <CheckCircle className="w-5 h-5" />
                                )}
                            </div>
                            {/* Text */}
                            <div className="flex-1 min-w-0">
                                <p className="text-obsidian-primary font-bold text-sm leading-tight">{toast.title}</p>
                                <p className="text-obsidian-secondary text-xs mt-0.5 leading-relaxed">{toast.message}</p>
                            </div>
                            {/* Close */}
                            <button
                                onClick={() => setToast(null)}
                                className="text-obsidian-secondary hover:text-obsidian-primary transition-colors flex-shrink-0 mt-0.5"
                            >
                                <X size={16} />
                            </button>
                        </div>
                        {/* Progress bar */}
                        <motion.div
                            initial={{ scaleX: 1 }}
                            animate={{ scaleX: 0 }}
                            transition={{ duration: 5.5, ease: 'linear' }}
                            className="h-0.5 rounded-full origin-left mt-1 bg-brand-orange"
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            <BottomNavigation />
        </div>
    );
};

export default DashboardUser;
