
import { motion } from "framer-motion";
import { useState, useEffect, useMemo } from "react";
import { MapPin, Star, Clock, Users, Search, Calendar, Map, Heart, ArrowLeft, ArrowRight, Filter } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import TopBar from "@/components/TopBar";
import BottomNavigation from "@/components/BottomNavigation";
import UnnivaiMap from "@/components/UnnivaiMap";
import { supabase } from "@/lib/supabase";
import { dataService } from "@/services/dataService";
import { useUserContext } from "@/hooks/useUserContext";
import { useCity } from "@/context/CityContext";
import { DEMO_CITIES } from "@/data/demoData";
const categories = ["Tutti", "Gastronomia", "Cultura", "Natura", "Arte", "Romantico"];

export default function ExplorePage() {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedDate, setSelectedDate] = useState('');
    const [activeFilter, setActiveFilter] = useState("Tutti");
    const [experiences, setExperiences] = useState([]);
    const [loading, setLoading] = useState(true);


    // Use Global Context for Location Sync
    const { city, lat, lng } = useUserContext();
    const { isManual } = useCity();

    // Determine Map Center based on Local GPS (priority), Context, or Demo Data
    const [localMapCenter, setLocalMapCenter] = useState(null);

    // Se l'utente ha inserito una città manualmente (es. "Milano"), ignora il GPS locale di default
    const mapCenter = (!isManual && localMapCenter) ? localMapCenter : {
        lat: isManual ? (lat || DEMO_CITIES[city]?.center?.latitude || 41.9028) : (lat || DEMO_CITIES[city]?.center?.latitude || 41.9028),
        lng: isManual ? (lng || DEMO_CITIES[city]?.center?.longitude || 12.4964) : (lng || DEMO_CITIES[city]?.center?.longitude || 12.4964)
    };

    // Auto-Geolocate on Mount (Task 2 Phase 5)
    useEffect(() => {
        const fetchRealLocation = async () => {
            const fallbackIP = async () => {
                try {
                    const res = await fetch('https://ipapi.co/json/');
                    const data = await res.json();
                    if (data?.latitude && data?.longitude) {
                        setLocalMapCenter({ lat: data.latitude, lng: data.longitude });
                    }
                } catch (e) {
                    console.warn('IP-Geolocation fallback fallito', e);
                }
            };

            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (pos) => setLocalMapCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                    (err) => {
                        console.warn('GPS negato o in timeout, fallback su IP:', err);
                        fallbackIP();
                    },
                    { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
                );
            } else {
                fallbackIP();
            }
        };
        fetchRealLocation();
    }, []);

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

                const { data: dbData, error: dbError } = await query.order('created_at', { ascending: false });

                if (!dbError && dbData?.length > 0) {
                    rawRows = dbData;
                } else {
                    // Fallback to demo data, adapted to DB-like field names so
                    // mapTourToUI can normalise them through the same code path.
                    const demoTours = DEMO_CITIES[city]?.tours || [];
                    rawRows = demoTours.map(t => ({
                        ...t,
                        price_eur: t.price,
                        duration_minutes: parseInt(t.duration) * 60,
                        city,
                    }));
                }

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
    }, [city, lat, lng]);

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

    // ⚡ Memoize map activities to prevent infinite React re-renders and Maps Virtual DOM trashing
    // By using pseudo-random deterministic seeds from IDs, we prevent markers from jumping around!
    const mapActivities = useMemo(() => {
        return filteredExperiences.map((e) => {
            // Deterministic pseudo-random offset based on ID to freeze marker positions across re-renders
            const charCodeSum = String(e.id).split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
            const stableOffsetLat = ((charCodeSum % 100) / 100 * 0.02) - 0.01;
            const stableOffsetLng = (((charCodeSum * 3) % 100) / 100 * 0.02) - 0.01;
            
            return {
                ...e,
                id: `${e.id}`,
                latitude: mapCenter.lat + stableOffsetLat,
                longitude: mapCenter.lng + stableOffsetLng,
                name: e.title,
                image: e.image || e.imageUrl,
                category: e.category || 'culture',
                tier: 'base'
            };
        });
    }, [filteredExperiences, mapCenter.lat, mapCenter.lng]);

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
                    <Link to="/dashboard-user" className="inline-flex items-center text-gray-500 text-sm mb-4 hover:text-black transition-colors">
                        <ArrowLeft size={16} className="mr-1" /> Torna alla Home
                    </Link>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Esplora</h1>
                    <p className="text-gray-600">
                        {city ? `Le migliori esperienze a ${city}.` : 'Le migliori esperienze autentiche in Italia.'}
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
                        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input
                            type="text"
                            placeholder="Cerca attività, luoghi, categorie..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-12 pr-4 py-4 bg-white rounded-2xl shadow-sm border border-gray-100 focus:outline-none focus:ring-2 focus:ring-black/5"
                        />
                    </div>
                    {/* Active Filters Summary */}
                    {(searchQuery || selectedDate) && (
                        <div className="flex gap-2 flex-wrap">
                            {searchQuery && (
                                <span className="bg-black text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                                    "{searchQuery}" <button onClick={() => setSearchQuery('')}><X size={12} /></button>
                                </span>
                            )}
                        </div>
                    )}
                </motion.div>

                {/* Map Preview Section - Click to Expand */}
                <motion.div
                    className="mb-8"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                >
                    <div className="flex justify-between items-end mb-3 px-1">
                        <h2 className="font-bold text-lg text-gray-800">Mappa Interattiva</h2>
                        <Link to="/map" className="text-xs font-bold text-terracotta-600 hover:underline">Apri a schermo intero</Link>
                    </div>
                    <div onClick={() => navigate('/map', { state: { initialCenter: mapCenter } })} className="block">
                        <div className="h-64 rounded-3xl overflow-hidden shadow-xl border-4 border-white relative group cursor-pointer">
                            <div className="absolute inset-0 z-0 pointer-events-none">
                                <UnnivaiMap
                                    key={`${mapCenter.lat}-${mapCenter.lng}`}
                                    height="100%"
                                    width="100%"
                                    zoom={12}
                                    interactive={false}
                                    showUserLocation={false}
                                    initialCenter={{ latitude: mapCenter.lat, longitude: mapCenter.lng }}
                                    viewCenter={{ latitude: mapCenter.lat, longitude: mapCenter.lng }} // ⚡ Use viewCenter for flyTo updates
                                    activeCity={city}
                                    activities={mapActivities}
                                    mapMood="default"
                                />
                            </div>
                            <div className="absolute inset-0 bg-black/5 group-hover:bg-black/0 transition-colors pointer-events-none" />
                            <div className="absolute bottom-4 right-4 z-10">
                                <span className="bg-white/90 backdrop-blur text-gray-800 px-4 py-2 rounded-full font-bold shadow-lg text-xs flex items-center gap-2 group-hover:scale-105 transition-transform">
                                    <Map size={14} /> Espandi Mappa
                                </span>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Loading State */}
                {loading && (
                    <div className="text-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
                        <p className="text-gray-500">Ricerca esperienze in corso...</p>
                    </div>
                )}

                {/* Experiences List */}
                {!loading && (
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
                                        <div className="relative h-48 rounded-2xl overflow-hidden mb-3">
                                            <div className="absolute inset-0 bg-gray-200 animate-pulse" />
                                            <img
                                                src={experience.imageUrl}
                                                alt={experience.title}
                                                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                                onError={(e) => e.target.src = 'https://placehold.co/600x400?text=Tour'}
                                            />
                                            <div className="absolute top-3 right-3 bg-white/95 backdrop-blur px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-sm">
                                                <Star size={12} className="text-yellow-400 fill-current" /> {experience.rating}
                                            </div>
                                            {experience.distance && (
                                                <div className="absolute top-3 left-3 bg-black/70 backdrop-blur px-2.5 py-1 rounded-full text-xs font-bold text-white flex items-center gap-1 shadow-sm">
                                                    <MapPin size={12} /> {experience.distance}
                                                </div>
                                            )}
                                        </div>

                                        <div className="px-2 pb-2">
                                            <div className="flex justify-between items-start mb-2">
                                                <h3 className="font-bold text-gray-900 text-lg leading-tight w-2/3">{experience.title}</h3>
                                                <div className="flex flex-col items-end">
                                                    <span className="text-lg font-bold text-gray-900">€{experience.price}</span>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-4 text-xs text-gray-500 mb-4">
                                                <span className="flex items-center gap-1">
                                                    <Clock size={14} className="text-gray-400" /> {experience.duration}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <MapPin size={14} className="text-gray-400" /> {experience.location}
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
                )}

                {!loading && filteredExperiences.length === 0 && (
                    <div className="text-center py-12 opacity-50">
                        <p className="mb-2">Nessuna esperienza trovata.</p>
                        <button onClick={() => { setSearchQuery(''); setSelectedDate(''); setActiveFilter('Tutti'); }} className="text-sm text-blue-500 underline">Resetta filtri</button>
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
