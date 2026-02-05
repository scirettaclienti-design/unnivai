import React, { useState, useMemo, useEffect } from 'react';
import BottomNavigation from '../components/BottomNavigation';
import { ArrowLeft, Search, Layers, Navigation as NavIcon, X, Heart, Star, Landmark, ArrowRight, Clock, MapPin } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useUserContext } from '../hooks/useUserContext';
import UnnivaiMap, { MOCK_ACTIVITIES } from '../components/UnnivaiMap';
import { isLocationOnRoute } from '../utils/geoUtils';
import { useQuery } from '@tanstack/react-query';
import { dataService } from '../services/dataService';
import './MapPage.css';

import { DEMO_CITIES, MOCK_ROUTES } from '../data/demoData';

// Fallback for when city is unknown
const DEFAULT_CITY = 'Roma';

const MapPage = () => {
    const location = useLocation();
    const { city } = useUserContext();

    // --- 1. ALL STATE HOOKS ---
    const [selectedActivity, setSelectedActivity] = useState(null);
    const [activeFilter, setActiveFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isSidebarOpen, setSidebarOpen] = useState(false); // Default closed as requested
    const [isTourSelectorOpen, setTourSelectorOpen] = useState(false);

    // Initialize complex state from location
    const [activeTourData, setActiveTourData] = useState(() => location.state?.tourData || null);

    const [showRoute, setShowRoute] = useState(() => {
        const state = location.state;
        return !!(state?.tourData || state?.focusedActivity || state?.route);
    });

    const [viewMode, setViewMode] = useState(() => {
        const state = location.state;
        // If we have specific routing data, go to 'activities' view, otherwise 'tours'
        return (state?.tourData || state?.focusedActivity || state?.route) ? 'activities' : 'tours';
    });

    // --- 2. DERIVED DATA (Non-Hooks) ---
    const activeCity = city || DEFAULT_CITY;
    const cityData = DEMO_CITIES[activeCity] || DEMO_CITIES['Roma'];
    const activeLandmarks = cityData.landmarks || [];
    const cityTours = cityData.tours || [];
    const tourData = activeTourData || location.state?.tourData;
    const focusedActivity = location.state?.focusedActivity;
    const customActivities = location.state?.customActivities;

    // --- 3. MEMOIZED DATA HOOKS ---

    // A. Active Route Calculation
    const activeRoute = useMemo(() => {
        if (tourData?.waypoints) {
            return tourData.waypoints.map((p, i) => {
                let lat, lng;
                if (Array.isArray(p)) { lat = p[0]; lng = p[1]; }
                else { lat = p.latitude; lng = p.longitude; }
                return {
                    latitude: lat,
                    longitude: lng,
                    label: `Tappa ${i + 1}`,
                    index: i
                };
            });
        }
        if (location.state?.route) return location.state.route;
        return MOCK_ROUTES[activeCity] || MOCK_ROUTES['Roma'];
    }, [tourData, location.state, activeCity]);

    // B. Map Center State (Dependent on route/activity)
    const [mapCenter, setMapCenter] = useState(() => ({
        lat: focusedActivity?.latitude || activeRoute?.[0]?.latitude || cityData.center.latitude,
        lng: focusedActivity?.longitude || activeRoute?.[0]?.longitude || cityData.center.longitude
    }));

    // C. Data Fetching
    const { data: realActivities } = useQuery({
        queryKey: ['map-activities', activeCity],
        queryFn: () => dataService.getActivitiesByCity(activeCity),
        staleTime: 1000 * 60 * 10
    });

    // D. Tour Mood Logic
    const tourMood = useMemo(() => {
        if (!tourData) return 'generic';
        const type = tourData.type || 'generic';
        if (type === 'romantic' || tourData.title?.toLowerCase().includes('tramonto')) return 'romantic';
        if (type === 'relax' || type === 'nature') return 'relax';
        if (type === 'nightlife' || type === 'food') return 'lively';
        return 'generic';
    }, [tourData]);

    // E. Filtered Activities Logic (The Big One)
    const filteredActivities = useMemo(() => {
        let sourceActivities = realActivities || MOCK_ACTIVITIES;

        // Inject Test/Custom Activities
        const anchorLat = activeRoute?.[0]?.latitude || 41.9025;
        const anchorLng = activeRoute?.[0]?.longitude || 12.4965;
        const TEST_ACTIVITIES = [
            { id: 'test-free', name: 'Punto Panoramico', latitude: anchorLat + 0.0010, longitude: anchorLng + 0.0010, level: 'free', category: 'service', vibe: 'relax', image: 'https://images.unsplash.com/photo-1534234828563-025c889d1469?w=300' },
            { id: 'test-base', name: 'Bottega Artigiana', latitude: anchorLat - 0.0008, longitude: anchorLng + 0.0015, level: 'base', category: 'shop', vibe: 'culture', image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=300' },
            { id: 'test-premium', name: 'Cena Imperiale', latitude: anchorLat + 0.0005, longitude: anchorLng - 0.0010, level: 'premium', category: 'food', vibe: 'romantic', price: 120, rating: 5.0, image: 'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=500' }
        ];
        sourceActivities = [...sourceActivities, ...TEST_ACTIVITIES];

        if (focusedActivity && !sourceActivities.find(a => a.id === focusedActivity.id)) {
            sourceActivities = [...sourceActivities, { ...focusedActivity, category: focusedActivity.category || 'culture', level: 'premium' }];
        }
        if (customActivities?.length > 0) {
            const newActivities = customActivities.filter(ca => !sourceActivities.find(sa => sa.id === ca.id));
            sourceActivities = [...sourceActivities, ...newActivities];
        }

        return sourceActivities.filter(activity => {
            if (searchQuery && !activity.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
            if (customActivities?.find(ca => ca.id === activity.id)) return true;
            if (focusedActivity?.id === activity.id) return true;
            if (activeFilter !== 'all' && activity.category !== activeFilter) return false;

            // Contextual Filtering
            if (!showRoute) return true;
            if (activity.level === 'premium') return true;

            // Mood check
            const isCompatible = (mood) => {
                if (mood === 'romantic') return !['chaos', 'nightlife'].includes(activity.vibe);
                if (mood === 'relax') return !['chaos', 'nightlife', 'gym'].includes(activity.vibe);
                return true;
            };
            if (!isCompatible(tourMood)) return false;

            // Geo check
            if (!activeRoute || activeRoute.length < 2) return true;
            return isLocationOnRoute(activity, activeRoute, 300);
        });
    }, [showRoute, activeFilter, realActivities, activeRoute, focusedActivity, customActivities, tourMood, searchQuery]);

    // F. Map Display Items (Tours vs Activities)
    const mapDisplayItems = useMemo(() => {
        if (viewMode === 'tours') {
            return cityTours.map((tour, index) => ({
                ...tour,
                latitude: cityData.center.latitude + (Math.sin(index) * 0.015),
                longitude: cityData.center.longitude + (Math.cos(index) * 0.015),
                level: 'premium',
                type: 'tour_entry'
            }));
        }
        return filteredActivities;
    }, [viewMode, cityTours, filteredActivities, cityData]);


    // --- 4. SIDE EFFECTS ---
    useEffect(() => {
        if (focusedActivity) {
            setSelectedActivity(focusedActivity);
            if (!location.state?.route && !tourData) {
                setShowRoute(false);
            }
        }
    }, [focusedActivity, location.state, tourData]);


    // --- 5. HANDLERS ---
    const handleTourClick = (tour) => {
        const demoRoute = MOCK_ROUTES[activeCity] || MOCK_ROUTES['Roma'];

        setActiveTourData({
            ...tour,
            waypoints: demoRoute
        });

        setShowRoute(true);
        setViewMode('activities'); // Switch to 'Detail' view
        setTourSelectorOpen(false); // Close popup if open

        if (demoRoute && demoRoute.length > 0) {
            setMapCenter({
                lat: demoRoute[0].latitude,
                lng: demoRoute[0].longitude
            });
        }
    };

    const handleActivityClick = (activity) => {
        setSelectedActivity(activity);
    };

    const handleMapItemClick = (item) => {
        if (viewMode === 'tours') {
            handleTourClick(item);
        } else {
            handleActivityClick(item);
        }
    };

    const handleTourSelection = (tour) => {
        handleTourClick(tour);
    };

    // --- 6. RENDER GUARDS ---
    const isTourMode = location.state?.mode === 'tour' || tourData;
    // Only show error if we are DEEP in tour mode and failing. 
    // If just exploring, we fallback to city center.
    if (isTourMode && (!activeRoute || activeRoute.length === 0) && viewMode === 'activities') {
        // Fallback gracefully instead of crashing? 
        // For now, keep the error UI but ensure hooks ran first.
        // Actually, let's just log it and fallback to empty route to avoid jarring UI unless critical.
        console.warn("Route not found for tour");
    }


    // --- NAVIGATION HANDLER ---
    const handleStartNavigation = () => {
        // Mock User Location (Roma center for demo if no GPS, but let's try to simulate 'following')
        const userLat = 41.9020;
        const userLng = 12.4960;

        // Update map center to user to simulate "Go to location"
        setMapCenter({ lat: userLat, lng: userLng });

        alert("🚀 Navigazione avviata! \nLa mappa si è centrata sulla tua posizione. Segui la linea arancione.");
        setSelectedActivity(null);
    };

    const sidebarMobileClasses = viewMode === 'tours' ? 'absolute inset-0 z-50 w-full flex' : 'hidden'; // Kept for legacy ref
    // Helper to check compatibility
    const isActivityCompatible = (activity, mood) => true; // Moved inside memo, keeping stub if needed elsewhere

    // --- RENDER ---

    return (
        <div className="relative w-full h-screen overflow-hidden bg-gray-50">

            {/* 1. LAYER: FULL SCREEN MAP (Background) */}
            <div className="absolute inset-0 z-0">
                <UnnivaiMap
                    height="100%"
                    width="100%"
                    activities={mapDisplayItems}
                    routeGeoJSON={null /* Handled internally via props now? Or need to pass? UnnivaiMap uses routePoints */}
                    routePoints={showRoute ? activeRoute : null}
                    landmarks={activeLandmarks}
                    onActivityClick={handleMapItemClick}
                    initialLat={mapCenter.lat}
                    initialLng={mapCenter.lng}
                    selectedId={selectedActivity?.id}
                    tourMood={tourMood}
                    hideMarkers={showRoute && viewMode === 'tours'} // Hide tour pins when showing a specific route? Maybe.
                />
            </div>

            {/* 2. LAYER: FLOATING SIDEBAR (The "Popup" List) */}
            <div className={`
                flex flex-col bg-white/95 backdrop-blur-md border-r border-gray-200 shadow-2xl transition-all duration-500 ease-in-out
                ${isSidebarOpen ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0 pointer-events-none'}
                absolute left-0 top-0 bottom-0 w-full md:w-[450px] z-40
                lg:left-4 lg:top-4 lg:bottom-4 lg:rounded-3xl lg:border lg:border-white/50
            `}>

                {/* Sidebar Header */}
                <div className="p-5 border-b border-gray-100/50 flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Link to="/" className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors">
                                <ArrowLeft size={20} className="text-gray-700" />
                            </Link>
                            <h1 className="text-xl font-bold text-gray-900">
                                {viewMode === 'tours' ? 'Esplora Tour' : activeTourData?.title || 'Dettagli Tour'}
                            </h1>
                        </div>
                        <button
                            onClick={() => setSidebarOpen(false)}
                            className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Search Input */}
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-black transition-colors" size={18} />
                        <input
                            type="text"
                            placeholder={viewMode === 'tours' ? "Cerca la tua avventura..." : "Cerca tappe..."}
                            className="w-full pl-10 pr-10 py-3 bg-gray-50/80 hover:bg-gray-50 focus:bg-white rounded-xl border border-transparent focus:border-gray-200 focus:ring-4 focus:ring-gray-100 outline-none text-sm font-medium transition-all"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                <X size={16} />
                            </button>
                        )}
                    </div>

                    {/* Filter Chips (Only in Tour Mode or if needed) */}
                    {viewMode === 'tours' && (
                        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                            {['all', 'food', 'culture', 'nature', 'shop'].map(filter => (
                                <button
                                    key={filter}
                                    onClick={() => setActiveFilter(filter)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${activeFilter === filter
                                        ? 'bg-black text-white border-black shadow-md transform scale-105'
                                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                                        }`}
                                >
                                    {filter === 'all' ? 'Tutti' : filter.charAt(0).toUpperCase() + filter.slice(1)}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Sidebar List Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                    {/* Back to Tours Button */}
                    {viewMode === 'activities' && !location.state?.tourData && (
                        <button
                            onClick={() => {
                                setViewMode('tours');
                                setShowRoute(false);
                                setSelectedActivity(null);
                                setActiveTourData(null);
                            }}
                            className="w-full flex items-center gap-2 text-gray-500 hover:text-black mb-4 px-2 hover:translate-x-1 transition-all"
                        >
                            <ArrowLeft size={16} />
                            <span className="text-xs font-bold uppercase tracking-wider">Torna alla lista Tour</span>
                        </button>
                    )}

                    {viewMode === 'tours' ? (
                        <div className="space-y-4 pb-20 lg:pb-0">
                            {cityTours
                                .filter(tour => {
                                    if (!searchQuery) return true;
                                    return tour.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                        tour.category.toLowerCase().includes(searchQuery.toLowerCase());
                                })
                                .map(tour => (
                                    <div
                                        key={tour.id}
                                        onClick={() => handleTourClick(tour)}
                                        className="group bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-xl hover:border-orange-200 transition-all cursor-pointer transform hover:-translate-y-1"
                                    >
                                        <div className="h-36 relative overflow-hidden">
                                            <img
                                                src={tour.imageUrl}
                                                alt={tour.title}
                                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                                            />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                                            <div className="absolute top-3 left-3 bg-white/90 backdrop-blur px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider shadow-sm">
                                                {tour.emoji} {tour.category}
                                            </div>
                                            <div className="absolute bottom-3 left-3 text-white">
                                                <div className="flex items-center gap-2 text-xs font-medium mb-0.5">
                                                    <span className="flex items-center gap-1"><Clock size={12} /> {tour.duration}</span>
                                                </div>
                                                <h4 className="font-bold text-lg leading-tight shadow-black drop-shadow-md">{tour.title}</h4>
                                            </div>
                                        </div>
                                        <div className="p-4 flex items-center justify-between">
                                            <div className="flex items-center gap-1 text-xs font-bold text-gray-800">
                                                <span className="text-lg">€{tour.price}</span>
                                                <span className="font-normal text-gray-400">/persona</span>
                                            </div>
                                            <div className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded-lg">
                                                <Star size={12} className="text-amber-400 fill-current" />
                                                <span className="text-xs font-bold">{tour.rating}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                        </div>
                    ) : (
                        // ACTIVITY LIST VIEW
                        <>
                            {filteredActivities.length === 0 ? (
                                <div className="text-center py-10 text-gray-400">
                                    <p>Nessun luogo trovato in questo tour.</p>
                                </div>
                            ) : (
                                filteredActivities.map((activity) => (
                                    <div
                                        key={activity.id}
                                        onClick={() => handleActivityClick(activity)}
                                        className={`group flex gap-4 p-3 rounded-2xl border transition-all cursor-pointer hover:shadow-lg hover:-translate-y-0.5 ${selectedActivity?.id === activity.id
                                            ? 'bg-orange-50 border-orange-200 ring-1 ring-orange-200'
                                            : 'bg-white border-gray-100 hover:border-gray-200'
                                            }`}
                                    >
                                        <div className="w-20 h-20 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0 relative shadow-sm">
                                            <img
                                                src={activity.image || "https://images.unsplash.com/photo-1516483638261-f4dbaf036963?w=200"}
                                                alt={activity.name}
                                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                            />
                                            {activity.index && (
                                                <div className="absolute top-0 left-0 bg-black text-white text-[10px] font-bold px-1.5 py-0.5 rounded-br-lg">
                                                    #{activity.index}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 flex flex-col justify-center min-w-0">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-[10px] uppercase font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full truncate max-w-[100px]">
                                                    {activity.category}
                                                </span>
                                            </div>
                                            <h3 className={`font-bold text-sm leading-tight mb-1 truncate ${selectedActivity?.id === activity.id ? 'text-orange-900' : 'text-gray-900'}`}>
                                                {activity.name}
                                            </h3>
                                            <div className="flex items-center gap-1 text-[10px] text-gray-500">
                                                <NavIcon size={10} />
                                                <span className="truncate">Tocca per localizzare</span>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                            <div className="p-4 border-t border-gray-100 bg-gray-50 text-center text-xs text-gray-400 pb-20 lg:pb-0">
                                {filteredActivities.length} tappe visibili
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* 3. LAYER: FLOATING POPUP (TOUR SELECTOR) - Only visible in 'tours' View when triggered */}
            {isTourSelectorOpen && viewMode === 'tours' && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300"
                        onClick={() => setTourSelectorOpen(false)}
                    />

                    {/* Modal Content */}
                    <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-5 duration-300 flex flex-col">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">Scegli il tuo Tour</h2>
                                <p className="text-sm text-gray-500">Esplora la città con i nostri percorsi</p>
                            </div>
                            <button onClick={() => setTourSelectorOpen(false)} className="p-2 bg-gray-200/50 hover:bg-gray-200 rounded-full text-gray-500 transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="overflow-y-auto p-4 space-y-3 custom-scrollbar">
                            {cityTours.map(tour => (
                                <div
                                    key={tour.id}
                                    className="flex items-center gap-4 p-3 rounded-2xl border border-gray-100 hover:border-orange-200 hover:bg-orange-50/30 transition-all group"
                                >
                                    <div className="w-20 h-20 rounded-xl bg-gray-200 overflow-hidden flex-shrink-0 shadow-sm relative">
                                        <img src={tour.imageUrl} alt={tour.title} className="w-full h-full object-cover" />
                                        <div className="absolute top-1 left-1 bg-white/90 backdrop-blur px-1.5 py-0.5 rounded text-[10px] shadow-sm">
                                            {tour.emoji}
                                        </div>
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-gray-900 leading-tight mb-1">{tour.title}</h3>
                                        <div className="flex items-center gap-3 text-xs text-gray-500 mb-2">
                                            <span className="flex items-center gap-1"><Clock size={12} /> {tour.duration}</span>
                                            <span className="font-bold text-gray-900">€{tour.price}</span>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => handleTourSelection(tour)}
                                        className="bg-black text-white px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap group-hover:bg-orange-600 transition-colors shadow-lg hover:shadow-orange-200"
                                    >
                                        Vai qui
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* 4. LAYER: FLOATING BUTTON (Visible ONLY in 'tours' View) */}
            {viewMode === 'tours' && !isTourSelectorOpen && (
                <div className="absolute top-4 left-4 z-30 animate-in fade-in slide-in-from-left-4 duration-500">
                    <button
                        onClick={() => setTourSelectorOpen(true)}
                        className="bg-white text-black px-6 py-3 rounded-full shadow-xl font-bold flex items-center gap-2 hover:scale-105 active:scale-95 transition-all border border-gray-100"
                    >
                        <Layers size={18} />
                        Lista Tour
                    </button>
                </div>
            )}

            {/* 5. LAYER: MAP CONTROLS (Right Side) */}
            <div className="absolute top-24 right-4 flex flex-col gap-2 z-30 lg:top-4">
                <button
                    className="bg-white p-3 rounded-full shadow-xl text-gray-700 hover:bg-gray-50 transition-transform hover:scale-110 active:scale-95 border border-gray-100"
                    onClick={() => setShowRoute(prev => !prev)}
                >
                    <NavIcon size={20} className={showRoute ? 'text-blue-500 fill-current' : 'text-gray-400'} />
                </button>
            </div>



            {/* NEW: FLOATING DETAIL CARD (Unified Premium Design) */}
            {selectedActivity && (
                <div className="absolute bottom-0 left-0 right-0 z-[50] lg:bottom-8 lg:left-8 lg:right-auto lg:w-[400px] animate-in slide-in-from-bottom-5 fade-in duration-300">
                    <div className="bg-white/85 backdrop-blur-xl rounded-t-[24px] lg:rounded-3xl shadow-[0_-8px_30px_rgba(0,0,0,0.12)] overflow-hidden relative max-h-[85vh] flex flex-col w-full mx-auto border-t border-white/50 ring-1 ring-black/5">
                        {/* Mobile Drag Handle */}
                        <div className="w-12 h-1.5 bg-gray-300/50 rounded-full mx-auto mt-3 absolute left-1/2 -translate-x-1/2 z-20 lg:hidden" />

                        {/* --- UNIFIED HEADER IMAGE --- */}
                        <div className="h-48 w-full relative flex-shrink-0 group cursor-pointer" onClick={() => {
                            /* Maybe full page view? */
                        }}>
                            <img
                                src={selectedActivity.image || selectedActivity.imageUrl || "https://images.unsplash.com/photo-1555992336-fb0d29498b13?w=500"}
                                alt={selectedActivity.name}
                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                            {/* Close Button */}
                            <button
                                onClick={() => setSelectedActivity(null)}
                                className="absolute top-3 right-3 p-2 bg-black/20 hover:bg-black/40 rounded-full text-white backdrop-blur-md transition-all active:scale-95"
                            >
                                <X size={18} />
                            </button>

                            {/* Badge Overlay */}
                            <div className="absolute top-3 left-3 flex flex-col items-start gap-1">
                                {selectedActivity.isWaypoint ? (
                                    <span className="bg-amber-400 text-black text-[10px] font-black px-2 py-1 rounded shadow-lg uppercase tracking-widest border border-amber-300">
                                        Tappa {selectedActivity.index}
                                    </span>
                                ) : selectedActivity.tier === 'premium' ? (
                                    <span className="bg-black/50 backdrop-blur text-amber-400 text-[10px] font-black px-2 py-1 rounded border border-amber-400 uppercase tracking-widest">
                                        Esclusiva
                                    </span>
                                ) : (
                                    <span className="bg-white/90 text-gray-800 text-[10px] font-bold px-2 py-1 rounded shadow-sm uppercase tracking-wide">
                                        {selectedActivity.category || 'Luogo'}
                                    </span>
                                )}
                            </div>

                            {/* Bottom Title Area */}
                            <div className="absolute bottom-4 left-5 right-5 text-white">
                                <h2 className="text-2xl font-bold leading-tight drop-shadow-md line-clamp-2">
                                    {selectedActivity.name}
                                </h2>
                                {selectedActivity.rating && (
                                    <div className="flex items-center gap-1 mt-1">
                                        <Star size={14} className="fill-amber-400 text-amber-400" />
                                        <span className="text-sm font-bold text-amber-400">{selectedActivity.rating}</span>
                                        <span className="text-xs text-white/70 ml-1">({Math.floor(Math.random() * 100)} recensioni)</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* --- CONTENT BODY --- */}
                        <div className="p-5 bg-white flex flex-col gap-4">
                            <div className="flex items-center justify-between text-xs text-gray-500 font-medium border-b border-gray-100 pb-3">
                                <div className="flex items-center gap-1.5">
                                    <div className="p-1.5 bg-green-50 rounded-full text-green-600">
                                        <Clock size={14} />
                                    </div>
                                    Aperto • Chiude alle 22:00
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className="p-1.5 bg-blue-50 rounded-full text-blue-600">
                                        <MapPin size={14} />
                                    </div>
                                    1.2 km da te
                                </div>
                            </div>

                            <p className="text-gray-600 text-sm leading-relaxed font-medium line-clamp-3">
                                {selectedActivity.description || "Scopri i dettagli di questo luogo unico nel tuo itinerario. Un'esperienza imperdibile selezionata per te."}
                            </p>

                            <div className="flex gap-3 mt-2">
                                <button
                                    onClick={handleStartNavigation}
                                    className="flex-1 bg-black text-white py-3.5 rounded-xl font-bold text-sm shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all hover:bg-gray-800 group"
                                >
                                    <NavIcon className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform" />
                                    <span>Vai Qui</span>
                                </button>

                                {!selectedActivity.isWaypoint && (
                                    <Link
                                        to={`/tour-details/${selectedActivity.id}`}
                                        state={{ tourData: selectedActivity }}
                                        className="flex-1"
                                    >
                                        <button className="w-full bg-gray-50 border border-gray-200 text-gray-800 py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-gray-100 transition-colors">
                                            Dettagli
                                        </button>
                                    </Link>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* FLOATING TRIGGER LIST (Mobile Only) */}
            {
                !selectedActivity && showRoute && filteredActivities.length > 0 && (
                    <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-30 w-full flex justify-center pointer-events-none lg:hidden">
                        <button
                            onClick={() => setShowSuggestions(true)}
                            className="pointer-events-auto shadow-2xl flex items-center gap-2 bg-white/90 backdrop-blur-md text-gray-800 px-6 py-3 rounded-full border border-white/50 animate-bounce-subtle hover:scale-105 transition-transform"
                        >
                            <span className="relative flex h-3 w-3 mr-1">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500"></span>
                            </span>
                            <span className="font-bold text-sm tracking-wide">
                                {filteredActivities.length} Tappe sul Percorso
                            </span>
                            <ArrowRight size={16} className="text-gray-400" />
                        </button>
                    </div>
                )
            }

            {/* POP-UP MODAL (Suggestions - Mobile Only) */}
            {
                showSuggestions && !selectedActivity && (
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 lg:hidden">
                        <div
                            className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300"
                            onClick={() => setShowSuggestions(false)}
                        />
                        <div className="relative bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                                <div>
                                    <h2 className="text-lg font-black text-gray-800 tracking-tight">Esplora il Percorso</h2>
                                    <p className="text-xs text-gray-500 font-medium">Esperienze consigliate per te</p>
                                </div>
                                <button onClick={() => setShowSuggestions(false)} className="p-2 bg-gray-200/50 hover:bg-gray-200 rounded-full transition-colors">
                                    <X size={20} className="text-gray-600" />
                                </button>
                            </div>
                            <div className="p-4 max-h-[60vh] overflow-y-auto">
                                <div className="grid grid-cols-1 gap-3">
                                    {filteredActivities.map(activity => (
                                        <div
                                            key={activity.id}
                                            onClick={() => {
                                                setSelectedActivity(activity);
                                                setShowSuggestions(false);
                                            }}
                                            className="flex gap-3 p-3 rounded-2xl border border-gray-100 bg-white hover:border-orange-200 hover:shadow-md transition-all cursor-pointer group"
                                        >
                                            <div className="w-20 h-20 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0 relative">
                                                <img src={activity.image || "https://images.unsplash.com/photo-1516483638261-f4dbaf036963?w=200"} alt={activity.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                            </div>
                                            <div className="flex flex-col justify-center">
                                                <h3 className="font-bold text-gray-800 text-sm leading-tight mb-1">{activity.name}</h3>
                                                <p className="text-xs text-green-600 font-bold flex items-center gap-1">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> Consigliato
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            <div className="lg:hidden">
                <BottomNavigation />
            </div>
        </div>
    );
};

export default MapPage;
