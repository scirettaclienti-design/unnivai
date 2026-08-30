// DVAI-022: APIProvider solo per questa pagina (via MapAPIWrapper)
import MapAPIWrapper from '@/components/MapAPIWrapper';
import { motion } from "framer-motion";
import { useState, useEffect, useMemo, useRef } from "react";
import { MapPin, Star, Clock, Users, Search, Calendar, Map, Heart, ArrowLeft, ArrowRight, Filter } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import TopBar from "@/components/TopBar";
import BottomNavigation from "@/components/BottomNavigation";
import UnnivaiMap from "@/components/UnnivaiMap";
import { supabase } from "@/lib/supabase";
import { dataService } from "@/services/dataService";
import { useUserContext } from "@/hooks/useUserContext";
import { resolveCityCenter, CityCenterUnresolvedError } from "@/services/cityCenterService";
const categories = ["Tutti", "Gastronomia", "Cultura", "Natura", "Arte", "Romantico"];

function ExplorePage() {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedDate, setSelectedDate] = useState('');
    const [activeFilter, setActiveFilter] = useState("Tutti");
    const [experiences, setExperiences] = useState([]);
    const [loading, setLoading] = useState(true);

    // Gate CC.2b: rimosso useCity import + fetchRealLocation duplicato (aveva
    // options GPS pre-Gate-X: enableHighAccuracy:true, timeout:5000,
    // maximumAge:0 — proprio la combinazione peggiore che Ivano ha
    // diagnosticato e Gate X.1 ha corretto). Ora usiamo useUserContext
    // (unica sorgente city+GPS + regola Gate AA) e resolveCityCenter per
    // il centro mappa (chokepoint autoritativo, no fallback Roma).
    const { city, lat, lng } = useUserContext();

    // Gate CC.2b: mapCenter da resolveCityCenter (Places-auth, cache 30gg).
    // Rimosso fallback Roma hardcoded (41.9028/12.4964) — bug O.2 residuo
    // che mostrava POI di Roma a utente Napoli. Se city non e' risolto,
    // mapCenter e' null e la mappa si nasconde (Gate AA garantisce che
    // city arrivi via CityModal onboarding).
    const [mapCenter, setMapCenter] = useState(null);
    useEffect(() => {
        let cancelled = false;
        if (!city) { setMapCenter(null); return; }
        resolveCityCenter(city)
            .then(cc => { if (!cancelled) setMapCenter({ lat: cc.latitude, lng: cc.longitude }); })
            .catch(err => {
                if (cancelled) return;
                if (err instanceof CityCenterUnresolvedError) {
                    console.warn(`[Explore] cityCenter irrisolto (${err.reason}) per "${city}"`);
                }
                setMapCenter(null);
            });
        return () => { cancelled = true; };
    }, [city]);

    // Gate CLEANUP estetica — qui vivevano la tabella delle tre citta' di
    // validazione (Milano/Venezia/Amalfi) e i derivati che ne dipendevano:
    // codice di sola verifica, per guardare la mappa su morfologie diverse.
    // Rimosso col resto del ponteggio.
    //
    // Non era solo UI. Il centro mappa derivato cadeva sulla prima citta' della
    // tabella quando `mapCenter` era null, cioe' reintroduceva un centro
    // HARDCODED — la stessa forma del bug O.2 (fallback Roma) che il Gate CC.2b
    // aveva tolto poche righe piu' su. Si torna al contratto di quel gate: se
    // `resolveCityCenter` non risolve, `mapCenter` resta null e la mappa non si
    // monta. Nessuna citta' di ripiego.
    const mapContainerRef = useRef(null);
    useEffect(() => {
        if (!mapContainerRef.current) return;
        const triggerResize = () => {
            window.dispatchEvent(new Event('resize'));
        };
        const observer = new ResizeObserver(triggerResize);
        observer.observe(mapContainerRef.current);
        const t1 = setTimeout(triggerResize, 80);
        const t2 = setTimeout(triggerResize, 350);
        return () => {
            observer.disconnect();
            clearTimeout(t1);
            clearTimeout(t2);
        };
    }, [mapCenter]);

    // Initialize favorites from localStorage
    const [favoriteItems, setFavoriteItems] = useState(() => {
        const saved = localStorage.getItem('unnivai_favorites');
        return saved ? new Set(JSON.parse(saved)) : new Set();
    });

    const [visibleCount, setVisibleCount] = useState(4);

    // 1. Fetch Data when City/Location Changes
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                let rawRows = [];

                // CRITICO-1 fix: include profiles JOIN so guide name/avatar are
                // available without a follow-up query per tour.
                let query = supabase
                    .from('tours')
                    .select(`
                        *,
                        profiles(username, first_name, last_name, image_urls, bio)
                    `)
                    .eq('is_live', true);

                if (city) {
                    query = query.ilike('city', `%${city}%`);
                }

                const { data: dbData, error: dbError } = await query.order('created_at', { ascending: false }).limit(100); // DVAI-024

                if (!dbError && dbData?.length > 0) {
                    rawRows = dbData;
                }
                // Gate D-4: nessun fallback DEMO_CITIES.tours. Se il DB non ha
                // tour per la città, la lista resta vuota e il JSX mostra
                // un empty state onesto ("Non ci sono ancora tour a {city}.").
                // Meglio vuoto che demo mescolato al reale senza badge.

                // Use the canonical mapper so TourUISchema validation runs for
                // every item and guide data from the profiles JOIN is included.
                const formatted = rawRows
                    .map(t => {
                        const ui = dataService.mapTourToUI(t);
                        if (!ui) return null;
                        return {
                            ...ui,
                            // availableDays is Explore-specific (date picker filter).
                            availableDays: [0, 1, 2, 3, 4, 5, 6],
                            // distance is only set by geo-aware queries; keep null here.
                            distance: t.dist_meters
                                ? (t.dist_meters / 1000).toFixed(1) + ' km'
                                : null,
                        };
                    })
                    .filter(Boolean);

                setExperiences(formatted);
            } catch (err) {
                console.error("Fetch error:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();

        // Listen for Real-Time Tour Updates/Deletions
        const toursChannel = supabase
            .channel('public:tours')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'tours' },
                (payload) => {
                    console.log('Real-Time Tour Change Detected:', payload);
                    fetchData(); // Refetch the list to ensure accurate sync
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(toursChannel);
        };
    }, [city]);

    const toggleFavorite = (id) => {
        const newFavorites = new Set(favoriteItems);
        if (newFavorites.has(id)) {
            newFavorites.delete(id);
        } else {
            newFavorites.add(id);
        }
        setFavoriteItems(newFavorites);
        localStorage.setItem('unnivai_favorites', JSON.stringify([...newFavorites]));
    };

    const filteredExperiences = useMemo(() => {
        return experiences.filter(exp => {
            // 1. Enhanced Search Filter (Title, Location, Category)
            const q = searchQuery.toLowerCase();
            const matchesSearch = exp.title.toLowerCase().includes(q) ||
                exp.location.toLowerCase().includes(q) ||
                exp.category.toLowerCase().includes(q);

            // 2. Category Filter
            let matchesCategory = true;
            if (activeFilter !== "Tutti") {
                matchesCategory = exp.category.includes(activeFilter);
            }

            // 3. Date Filter (New Logic)
            let matchesDate = true;
            if (selectedDate) {
                const dayOfWeek = new Date(selectedDate).getDay(); // 0 (Sun) - 6 (Sat)
                if (exp.availableDays && !exp.availableDays.includes(dayOfWeek)) {
                    matchesDate = false;
                }
            }

            return matchesSearch && matchesCategory && matchesDate;
        });
    }, [experiences, searchQuery, activeFilter, selectedDate]);

    // Gate CC.2a — Marker mappa sulle coordinate VERE dei POI degli step.
    // Prima: offset pseudo-random dal centro citta' -> marker piazzati in
    // posizione FINTA. Su un prodotto che vende "luoghi reali su mappa reale"
    // e' il fake piu' grave che ci fosse — il cuore del prodotto mentiva.
    // Regola: se un POI non ha coordinate valide, NON creare il marker. Mai
    // un marker inventato.
    // Un tour ha piu' step: ognuno diventa il proprio marker. Click marker ->
    // apre TourDetails del tour di appartenenza (via id).
    const mapActivities = useMemo(() => {
        const markers = [];
        for (const exp of filteredExperiences) {
            const steps = Array.isArray(exp.steps) ? exp.steps : [];
            for (const step of steps) {
                const lat = step.latitude ?? step.lat;
                const lng = step.longitude ?? step.lng;
                if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
                markers.push({
                    id: `${exp.id}-${step.id || step.title}`,
                    tourId: exp.id,
                    latitude: lat,
                    longitude: lng,
                    name: step.title || step.name,
                    image: step.image || exp.image || exp.imageUrl,
                    category: exp.category || 'culture',
                    tier: 'base',
                });
            }
        }
        return markers;
    }, [filteredExperiences]);

    return (
        <div className="min-h-screen bg-obsidian-bg text-obsidian-primary font-quicksand">
            <TopBar />

            <main className="max-w-md mx-auto px-4 py-8 pb-32">
                {/* Header Section */}
                <motion.div
                    className="mb-6"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                >
                    <Link to="/dashboard-user" className="inline-flex items-center text-obsidian-secondary text-sm mb-4 hover:text-obsidian-primary transition-colors">
                        <ArrowLeft size={16} className="mr-1" /> Torna alla Home
                    </Link>
                    <h1 className="text-3xl font-bold text-obsidian-primary mb-2">Esplora</h1>
                    <p className="text-obsidian-secondary">
                        {city ? `I luoghi e i punti di interesse a ${city}.` : 'I luoghi e i punti di interesse in Italia.'}
                    </p>
                </motion.div>

                {/* Search & Date */}
                <motion.div
                    className="space-y-3 mb-8"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.1 }}
                >
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-obsidian-secondary w-5 h-5" />
                        <input
                            type="text"
                            placeholder="Cerca attività, luoghi, categorie..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-12 pr-4 py-3.5 bg-obsidian-card text-obsidian-primary font-medium placeholder:text-obsidian-secondary/60 rounded-2xl border border-obsidian-border focus:outline-none focus:border-brand-orange transition-colors"
                        />
                    </div>
                    {/* Active Filters Summary */}
                    {(searchQuery || selectedDate) && (
                        <div className="flex gap-2 flex-wrap">
                            {searchQuery && (
                                <span className="bg-obsidian-raised text-obsidian-primary border border-obsidian-border px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1.5">
                                    "{searchQuery}" <button onClick={() => setSearchQuery('')} className="text-obsidian-secondary hover:text-obsidian-primary"><X size={12} /></button>
                                </span>
                            )}
                        </div>
                    )}
                </motion.div>

                {/* Map Preview Section - Click to Expand */}
                {mapCenter && (
                    <div className="mb-4">
                        <div className="flex justify-between items-end mb-2 px-1">
                            <div>
                                <h2 className="font-bold text-lg text-obsidian-primary">Mappa Interattiva</h2>
                            </div>
                            <Link
                                to="/map"
                                state={{ initialCenter: mapCenter }}
                                className="text-xs font-medium text-obsidian-secondary hover:text-obsidian-primary transition-colors"
                            >
                                Apri a schermo intero
                            </Link>
                        </div>

                        <div onClick={() => navigate('/map', { state: { initialCenter: mapCenter } })} className="block">
                            {/* Incastonatura Mappa: cornice card scura con bordo sottile e raggio 3xl per contenere la mappa */}
                            <div className="bg-obsidian-card p-1.5 rounded-3xl border border-obsidian-border shadow-xl group cursor-pointer w-full">
                                <div
                                    ref={mapContainerRef}
                                    className="h-64 rounded-2xl overflow-hidden relative w-full pointer-events-none"
                                    style={{
                                        transform: 'translateZ(0)',
                                        WebkitMaskImage: '-webkit-radial-gradient(white, black)',
                                    }}
                                >
                                    <UnnivaiMap
                                        key={`${mapCenter.lat}-${mapCenter.lng}`}
                                        height="100%"
                                        width="100%"
                                        zoom={13}
                                        defaultZoom={13}
                                        tilt={0}
                                        defaultTilt={0}
                                        interactive={false}
                                        showUserLocation={false}
                                        initialCenter={{ latitude: mapCenter.lat, longitude: mapCenter.lng }}
                                        viewCenter={{ latitude: mapCenter.lat, longitude: mapCenter.lng }}
                                        activeCity={city}
                                        activities={mapActivities}
                                        mapMood="default"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Loading State */}
                {loading && (
                    <div className="text-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-orange mx-auto mb-4"></div>
                        <p className="text-obsidian-secondary text-sm">Ricerca esperienze in corso...</p>
                    </div>
                )}

                {/* Experiences List */}
                {!loading && (
                    <div className="space-y-6">
                        {filteredExperiences.slice(0, visibleCount).map((experience, index) => {
                            const ratedSteps = (Array.isArray(experience.steps) ? experience.steps : [])
                                .map(s => ({
                                    name: s.title || s.name,
                                    rating: Number.isFinite(s.rating) && s.rating > 0 ? s.rating : null,
                                    reviewsCount: Number.isFinite(s.reviewsCount) && s.reviewsCount > 0
                                        ? s.reviewsCount
                                        : (Number.isFinite(s.user_ratings_total) && s.user_ratings_total > 0
                                            ? s.user_ratings_total : null),
                                }))
                                .filter(s => s.rating !== null);
                            const featuredPoi = ratedSteps.length > 0
                                ? ratedSteps.reduce((best, s) => {
                                    const score = s.rating * Math.log(1 + (s.reviewsCount || 0));
                                    const bestScore = best.rating * Math.log(1 + (best.reviewsCount || 0));
                                    return score > bestScore ? s : best;
                                })
                                : null;
                            return (
                            <motion.div
                                key={experience.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.5, delay: 0.1 * index }}
                            >
                                <Link to={`/tour-details/${experience.id}`} state={{ tourData: experience }}>
                                    <div className="group bg-obsidian-card border border-obsidian-border hover:border-obsidian-border-elevated rounded-3xl p-3 shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                                        <div className="relative h-48 rounded-2xl overflow-hidden mb-3">
                                            <div className="absolute inset-0 bg-obsidian-raised animate-pulse" />
                                            <img
                                                src={experience.imageUrl}
                                                alt={experience.title}
                                                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                            />
                                            {experience.distance && (
                                                <div className="absolute top-3 left-3 bg-obsidian-bg/85 backdrop-blur-sm border border-obsidian-border px-2.5 py-1 rounded-full text-xs font-medium text-obsidian-primary flex items-center gap-1 shadow-sm">
                                                    <MapPin size={12} className="text-brand-orange" /> {experience.distance}
                                                </div>
                                            )}
                                        </div>

                                        <div className="px-2 pb-2">
                                            <h3 className="font-bold text-obsidian-primary text-lg leading-tight mb-2 group-hover:text-brand-orange transition-colors">{experience.title}</h3>

                                            {featuredPoi && Number.isFinite(featuredPoi.rating) && (
                                                <div className="flex items-center gap-1.5 text-xs text-obsidian-secondary mb-2">
                                                    <Star className="w-3 h-3 text-brand-orange fill-current shrink-0" />
                                                    <span className="font-medium truncate">Include {featuredPoi.name}</span>
                                                    <span className="font-bold text-obsidian-primary whitespace-nowrap">· {featuredPoi.rating.toFixed(1)}</span>
                                                </div>
                                            )}

                                            <div className="flex items-center gap-4 text-xs text-obsidian-secondary mb-4">
                                                <span className="flex items-center gap-1">
                                                    <Clock size={14} className="text-obsidian-secondary" /> {experience.duration}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <MapPin size={14} className="text-obsidian-secondary" /> {experience.location}
                                                </span>
                                            </div>

                                            <button className="w-full py-3 rounded-xl bg-obsidian-raised border border-obsidian-border text-obsidian-primary font-bold text-sm group-hover:bg-brand-orange group-hover:text-obsidian-bg group-hover:border-brand-orange transition-all duration-200 flex items-center justify-center gap-2">
                                                Vedi Dettagli <ArrowRight size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </Link>
                            </motion.div>
                            );
                        })}
                    </div>
                )}

                {!loading && filteredExperiences.length === 0 && (
                    <div className="text-center pt-2 pb-8">
                        {experiences.length === 0 ? (
                            <>
                                <div className="w-12 h-12 rounded-2xl bg-obsidian-raised border border-obsidian-border flex items-center justify-center mx-auto mb-3 text-obsidian-secondary">
                                    <Map className="w-6 h-6 stroke-[1.5]" />
                                </div>
                                <p className="mb-1 font-semibold text-obsidian-primary">Nessuna guida ha ancora pubblicato un tour a {city || 'questa città'}.</p>
                                <p className="text-xs text-obsidian-secondary mb-4">Il motore AI ne costruisce uno adesso, sui luoghi veri della città.</p>
                                <Link
                                    to="/ai-itinerary"
                                    className="inline-block px-6 py-3 bg-brand-orange text-obsidian-bg rounded-2xl text-xs font-bold hover:bg-brand-orange-hover transition-colors shadow-lg shadow-brand-orange/20"
                                >
                                    Crea il tuo percorso
                                </Link>
                            </>
                        ) : (
                            <>
                                <p className="mb-2 text-obsidian-secondary">Nessuna esperienza trovata con questi filtri.</p>
                                <button onClick={() => { setSearchQuery(''); setSelectedDate(''); setActiveFilter('Tutti'); }} className="text-sm text-brand-orange hover:text-brand-orange-hover font-semibold transition-colors">Resetta filtri</button>
                            </>
                        )}
                    </div>
                )}
            </main>
            <BottomNavigation />
        </div>
    );
}

function X({ size = 16, className = "" }) {
    return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
}

// DVAI-022
export default function ExplorePageWithMap(props) {
    return (
        <MapAPIWrapper>
            <ExplorePage {...props} />
        </MapAPIWrapper>
    );
}
