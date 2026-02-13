import React, { useState, useMemo, useEffect, useCallback } from 'react';
import BottomNavigation from '../components/BottomNavigation';
import { ArrowLeft, Search, Layers, Navigation as NavIcon, X, Heart, Star, Landmark, ArrowRight, Clock, MapPin, Locate, CornerUpRight, CornerUpLeft, ArrowUp } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useUserContext } from '../hooks/useUserContext';
import UnnivaiMap from '../components/UnnivaiMap';
import { isLocationOnRoute } from '../utils/geoUtils';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { dataService } from '../services/dataService';
import { supabase } from '../lib/supabase';
import './MapPage.css';

import { DEMO_CITIES, MOCK_ROUTES } from '../data/demoData';

const DEFAULT_CITY = 'Roma';

// 🧠 SMART IMAGE LOGIC
const getSmartImage = (item) => {
    if (item.image && !item.image.includes('unsplash.com/photo-1552832230')) return item.image;
    if (item.images?.[0]) return item.images[0];

    const key = (item.name || item.title || item.category || '').toLowerCase();

    if (key.includes('piazza') || key.includes('square')) return "https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=500";
    if (key.includes('fontana') || key.includes('trevi')) return "https://images.unsplash.com/photo-1555992336-749746e30129?w=500";
    if (key.includes('chiesa') || key.includes('basilica') || key.includes('san pietro')) return "https://images.unsplash.com/photo-1579290076295-a226bc40b543?w=500";
    if (key.includes('colosseo') || key.includes('arena')) return "https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=500";
    if (key.includes('museo') || key.includes('vatican')) return "https://images.unsplash.com/photo-1548625361-9877484df6c5?w=500";
    if (key.includes('cibo') || key.includes('food') || key.includes('carbonara')) return "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=500";
    if (key.includes('nature') || key.includes('parco') || key.includes('villa')) return "https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=500";

    return "https://images.unsplash.com/photo-1529154036614-a60975f5c760?w=500";
};

// 🚶 NAVIGATION HUD HELPER
const NavInstruction = ({ step, onNext, onPrev, stepIndex, totalSteps }) => {
    if (!step) return null;

    // Icon Logic
    const getManeuverIcon = (modifier) => {
        if (!modifier) return <ArrowUp size={32} className="text-orange-500" />;
        if (modifier.includes('right')) return <CornerUpRight size={32} className="text-orange-500" />;
        if (modifier.includes('left')) return <CornerUpLeft size={32} className="text-orange-500" />;
        return <ArrowUp size={32} className="text-orange-500" />; // Straight fallback
    };

    return (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[90%] max-w-md z-50 animate-in slide-in-from-top-5">
            <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl p-4 border border-white/40 ring-1 ring-black/5 flex items-center gap-4">
                <div className="bg-orange-100 p-3 rounded-xl flex-shrink-0">
                    {getManeuverIcon(step.maneuver?.modifier)}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-0.5">
                        Passo {stepIndex + 1} di {totalSteps}
                    </p>
                    <h3 className="font-bold text-gray-900 text-lg leading-tight line-clamp-2">
                        {step.maneuver?.instruction || "Segui il percorso"}
                    </h3>
                    {step.distance > 0 && (
                        <p className="text-sm text-gray-600 font-medium mt-1">
                            Tra {Math.round(step.distance)} metri
                        </p>
                    )}
                </div>
                {/* Simple Controls */}
                <div className="flex flex-col gap-1">
                    <button onClick={onNext} disabled={stepIndex >= totalSteps - 1} className="p-2 hover:bg-gray-100 rounded-full disabled:opacity-30"><ArrowRight size={16} /></button>
                    {stepIndex > 0 && <button onClick={onPrev} className="p-2 hover:bg-gray-100 rounded-full"><ArrowLeft size={16} /></button>}
                </div>
            </div>
        </div>
    );
};

const MapPage = () => {
    const location = useLocation();
    const { city } = useUserContext();
    const queryClient = useQueryClient();

    // SAFE DATA ACCESS
    const activeCity = city || DEFAULT_CITY;
    const cityData = DEMO_CITIES[activeCity] || DEMO_CITIES['Roma'];

    // --- STATE ---
    const [selectedActivity, setSelectedActivity] = useState(null);
    const [isNavigating, setIsNavigating] = useState(false);

    // Bounds & "Search Here"
    const [mapBounds, setMapBounds] = useState(null);
    const [showSearchHere, setShowSearchHere] = useState(false);

    // NAV INSTRUCTIONS STATE 🚶
    const [navSteps, setNavSteps] = useState([]);
    const [currentStepIndex, setCurrentStepIndex] = useState(0);

    // Initialize Routing Sate
    const [activeTourData, setActiveTourData] = useState(() => location.state?.tourData || null);
    const [showRoute, setShowRoute] = useState(() => {
        const state = location.state;
        return !!(state?.tourData || state?.focusedActivity || state?.route);
    });

    const [viewMode, setViewMode] = useState(() => {
        const state = location.state;
        return (state?.tourData || state?.focusedActivity || state?.route) ? 'activities' : 'tours';
    });

    const tourData = activeTourData || location.state?.tourData;
    const focusedActivity = location.state?.focusedActivity;

    // --- 2. ACTIVE ROUTE (Turn-by-Turn Points) ---
    const activeRoute = useMemo(() => {
        try {
            if (tourData?.waypoints) {
                return tourData.waypoints.map((p, i) => ({
                    latitude: Array.isArray(p) ? p[0] : p.latitude,
                    longitude: Array.isArray(p) ? p[1] : p.longitude,
                    label: `Tappa ${i + 1}`,
                    index: i,
                    type: 'waypoint'
                }));
            }
            if (location.state?.route) return location.state.route;
            return MOCK_ROUTES[activeCity] || MOCK_ROUTES['Roma'];
        } catch (e) { return []; }
    }, [tourData, location.state, activeCity]);

    // --- 3. DATA FETCHING (Global Tours) ---
    const { data: globalTours, isFetching } = useQuery({
        queryKey: ['global-tours'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('tours')
                .select('id, title, price_eur, duration_text, category, latitude, longitude, images, description');

            if (error) return [];

            return (data || []).filter(t =>
                t.latitude && t.longitude && !isNaN(parseFloat(t.latitude))
            ).map(t => ({
                id: `${t.id}`,
                name: t.title,
                latitude: parseFloat(t.latitude),
                longitude: parseFloat(t.longitude),
                price: t.price_eur,
                duration: t.duration_text,
                category: t.category || 'culture',
                description: t.description || '',
                image: getSmartImage(t),
                type: 'tour_entry'
            }));
        },
        staleTime: 1000 * 60 * 5
    });

    // --- 4. MAP DISPLAY ITEMS  ---
    const mapDisplayItems = useMemo(() => {
        if (viewMode === 'tours') {
            return globalTours || [];
        }
        return [];
    }, [viewMode, globalTours]);

    // FILTER VISIBLE TOURS FOR DRAWER 
    const visibleDrawerItems = useMemo(() => {
        if (viewMode !== 'tours' || !globalTours) return [];
        if (!mapBounds) return globalTours.slice(0, 5);

        return globalTours.filter(t =>
            t.longitude >= mapBounds._sw.lng && t.longitude <= mapBounds._ne.lng &&
            t.latitude >= mapBounds._sw.lat && t.latitude <= mapBounds._ne.lat
        );
    }, [viewMode, globalTours, mapBounds]);

    // --- HANDLERS ---
    const mapRef = React.useRef(null);

    const handleTourClick = (tour) => {
        setSelectedActivity(tour);
        if (mapRef.current) {
            mapRef.current.flyTo({ center: [tour.longitude, tour.latitude], zoom: 16 });
        }
    };

    const handleStartNavigation = () => {
        setIsNavigating(true);
        if (mapRef.current) {
            mapRef.current.flyTo({ zoom: 18, pitch: 60 });
            mapRef.current.startTracking();
        }
    };

    const handleMapMove = useCallback((viewState) => {
        if (!showSearchHere && viewMode === 'tours') {
            setShowSearchHere(true);
        }
        if (mapRef.current) {
            const bounds = mapRef.current.getBounds();
            setMapBounds(bounds);
        }
    }, [showSearchHere, viewMode]);

    const handleSearchHere = () => {
        setShowSearchHere(false);
        queryClient.invalidateQueries(['global-tours']);
    };

    // 🚶 NAVIGATION STEP HANDLERS
    const handleRouteUpdate = useCallback((steps) => {
        if (steps && steps.length > 0) {
            setNavSteps(steps);
            setCurrentStepIndex(0); // Start at beginning
        }
    }, []);

    const nextStep = () => setCurrentStepIndex(prev => Math.min(prev + 1, navSteps.length - 1));
    const prevStep = () => setCurrentStepIndex(prev => Math.max(prev - 1, 0));

    // --- RENDER ---
    return (
        <div className="relative w-full h-screen overflow-hidden bg-gray-50">
            {/* 1. MAP */}
            <div className="absolute inset-0 z-0">
                <UnnivaiMap
                    ref={mapRef}
                    height="100%"
                    width="100%"
                    activities={mapDisplayItems}
                    routePoints={showRoute ? activeRoute : (viewMode === 'tours' ? mapDisplayItems : [])}
                    onActivityClick={handleTourClick}
                    isNavigating={isNavigating}
                    onMapMove={handleMapMove}
                    onNavigationRoute={handleRouteUpdate} // 🆕 RECEIVE STEPSs
                    selectedId={selectedActivity?.id}
                />
            </div>

            {/* 2. TOP CONTROLS */}
            <div className="absolute top-4 left-4 right-4 z-40 flex justify-between pointer-events-none">
                <Link to="/dashboard-user" className="bg-white p-3 rounded-full shadow-xl pointer-events-auto text-gray-800 hover:scale-105 transition-transform">
                    <ArrowLeft size={20} />
                </Link>

                {showSearchHere && (
                    <button
                        onClick={handleSearchHere}
                        className="bg-white text-gray-800 px-4 py-2 rounded-full shadow-xl font-bold text-sm flex items-center gap-2 pointer-events-auto animate-in fade-in slide-in-from-top-4"
                    >
                        <Search size={14} /> Cerca in questa zona
                    </button>
                )}
            </div>

            {/* 🆕 NAVIGATION HUD (Top Center) */}
            {isNavigating && navSteps.length > 0 && (
                <NavInstruction
                    step={navSteps[currentStepIndex]}
                    onNext={nextStep}
                    onPrev={prevStep}
                    stepIndex={currentStepIndex}
                    totalSteps={navSteps.length}
                />
            )}

            {/* 3. NAVIGATION BAR (FIXED BOTTOM - START TOUR) - Hide if Navigating */}
            {showRoute && !isNavigating && !selectedActivity && tourData && (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-md animate-in slide-in-from-bottom-10 pointer-events-auto">
                    <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl p-4 border border-white/40 flex items-center justify-between gap-4 ring-1 ring-black/5">
                        <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-gray-900 text-lg leading-tight truncate">{tourData?.title || 'Il tuo Itinerario'}</h3>
                            <p className="text-xs text-gray-500 flex items-center gap-1 mt-1 font-medium">
                                <Clock size={12} className="text-orange-500" /> {tourData?.duration || '2.5 ore'} • {activeRoute.length} Tappe
                            </p>
                        </div>
                        <button
                            onClick={handleStartNavigation}
                            className="bg-gradient-to-r from-orange-600 to-orange-500 text-white px-6 py-3 rounded-xl font-bold text-sm shadow-lg shadow-orange-200 hover:shadow-orange-300 active:scale-95 transition-all flex flex-col items-center justify-center leading-none gap-1 min-w-[80px]"
                        >
                            <NavIcon size={18} className="animate-pulse" />
                            <span className="text-[10px] uppercase tracking-wider">Avvia</span>
                        </button>
                    </div>
                </div>
            )}

            {/* 4. EXPLORE DRAWER (Bottom List) */}
            {viewMode === 'tours' && !selectedActivity && (
                <div className="absolute bottom-8 left-0 w-full z-40 px-4 pointer-events-none">
                    <div className="flex overflow-x-auto gap-3 pb-4 snap-x snap-mandatory pointer-events-auto no-scrollbar mask-gradient pr-4">
                        {visibleDrawerItems.map(tour => (
                            <div
                                key={tour.id}
                                onClick={() => handleTourClick(tour)}
                                className="snap-center shrink-0 w-64 h-36 bg-white rounded-2xl shadow-xl overflow-hidden relative cursor-pointer active:scale-95 transition-transform ring-1 ring-black/5"
                            >
                                <img src={tour.image} className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                                <div className="absolute bottom-3 left-3 text-white">
                                    <h3 className="font-bold text-sm leading-tight mb-0.5 line-clamp-1">{tour.name}</h3>
                                    <p className="text-[10px] font-medium opacity-90 uppercase tracking-wide bg-orange-500/90 inline-block px-1.5 py-0.5 rounded-md mt-1">
                                        €{tour.price} • {tour.duration}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 5. DETAIL CARD */}
            {selectedActivity && (
                <div className="absolute bottom-0 left-0 right-0 z-[50] lg:bottom-8 lg:left-8 lg:w-[400px] animate-in slide-in-from-bottom-5">
                    <div className="bg-white rounded-t-3xl lg:rounded-3xl shadow-2xl overflow-hidden ring-1 ring-black/5">
                        <div className="h-44 relative group">
                            <img src={selectedActivity.image} className="w-full h-full object-cover" />
                            <button onClick={() => setSelectedActivity(null)} className="absolute top-4 right-4 p-2 bg-black/50 rounded-full text-white backdrop-blur-sm"><X size={18} /></button>
                            <div className="absolute top-4 left-4 bg-orange-500 text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider shadow-sm">{selectedActivity.category}</div>
                        </div>
                        <div className="p-5">
                            <h2 className="text-xl font-bold mb-1 text-gray-900">{selectedActivity.name}</h2>
                            <p className="text-gray-500 text-xs mb-3 font-medium flex items-center gap-1">
                                <Clock size={12} /> {selectedActivity.duration || 'Durata flessibile'}
                            </p>
                            <p className="text-gray-600 text-sm mb-4 line-clamp-2 leading-relaxed">{selectedActivity.description}</p>

                            {selectedActivity.type === 'tour_entry' ? (
                                <Link
                                    to={`/tour-details/${selectedActivity.id}`}
                                    className="w-full bg-black text-white py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-gray-800 transition-colors"
                                >
                                    Vedi Dettagli <ArrowRight size={16} />
                                </Link>
                            ) : (
                                <button onClick={handleStartNavigation} className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-orange-200">
                                    {isNavigating ? 'Navigazione Attiva' : 'Naviga Qui'} <NavIcon size={16} />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Bottom Nav */}
            <div className="lg:hidden">
                <BottomNavigation />
            </div>
        </div>
    );
};

export default MapPage;
