import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import BottomNavigation from '../components/BottomNavigation';
import {
    ArrowLeft, Search, Navigation as NavIcon, X, ArrowRight,
    Clock, MapPin, CornerUpRight, CornerUpLeft, ArrowUp,
    Store, Sparkles, Tag
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useUserContext } from '../hooks/useUserContext';
import UnnivaiMap from '../components/UnnivaiMap';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { dataService } from '../services/dataService';
import { supabase } from '../lib/supabase';
import './MapPage.css';

import { DEMO_CITIES, MOCK_ROUTES } from '../data/demoData';

const DEFAULT_CITY = 'Roma';

// ─── SEMANTIC TAG MAPPING ─────────────────────────────────────────────────────
// Tour tags → Business category_tags equivalents (one-to-many)
const TAG_MAPPING = {
    'Cibo': ['Ristorazione', 'Cibo'],
    'Arte': ['Cultura', 'Arte', 'Artigianato'],
    'Cultura': ['Cultura', 'Storia', 'Arte'],
    'Storia': ['Cultura', 'Storia'],
    'Romantico': ['Lusso', 'Ospitalità', 'Relax'],
    'Avventura': ['Avventura', 'Nightlife'],
    'Natura': ['Relax', 'Avventura'],
    'Shopping': ['Shopping', 'Artigianato', 'Lusso'],
};

const tagsMatch = (tourTags = [], businessTags = []) => {
    // If no filter → show all
    if (!tourTags.length || !businessTags.length) return true;
    const expanded = tourTags.flatMap(t => TAG_MAPPING[t] || [t]);
    return businessTags.some(bt => expanded.includes(bt));
};

const haversineM = (lat1, lng1, lat2, lng2) => {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// Fetch businesses near a lat/lng that match tour tags (client-side, no SQL func needed)
const fetchMatchingBusinesses = async (lat, lng, tourTags = [], radiusM = 2500) => {
    if (!lat || !lng) return [];
    try {
        const { data, error } = await supabase
            .from('businesses_profile')
            .select('id, company_name, category_tags, description, address, image_urls, ai_metadata, location')
            .not('location', 'is', null);

        if (error || !data) return [];

        return data
            .map(b => {
                if (!b.location) return null;
                let bLat, bLng;
                if (typeof b.location === 'string' && b.location.includes('POINT')) {
                    const parts = b.location.replace('POINT(', '').replace(')', '').split(' ');
                    bLng = parseFloat(parts[0]);
                    bLat = parseFloat(parts[1]);
                } else if (b.location?.coordinates) {
                    bLng = b.location.coordinates[0];
                    bLat = b.location.coordinates[1];
                } else {
                    return null; // EWKB hex not parseable client-side
                }
                if (isNaN(bLat) || isNaN(bLng)) return null;

                const dist = haversineM(lat, lng, bLat, bLng);
                if (dist > radiusM) return null;

                const bTags = b.category_tags || [];
                if (!tagsMatch(tourTags, bTags)) return null;

                return {
                    id: `biz_${b.id}`,
                    rawId: b.id,
                    name: b.company_name,
                    title: b.company_name,
                    latitude: bLat,
                    longitude: bLng,
                    type: 'business_partner',
                    category_tags: bTags,
                    description: b.description || '',
                    address: b.address || '',
                    image: b.image_urls?.[0] || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=500',
                    ai_metadata: b.ai_metadata,
                    distanceM: Math.round(dist),
                };
            })
            .filter(Boolean)
            .sort((a, b) => a.distanceM - b.distanceM)
            .slice(0, 8);
    } catch (e) {
        console.warn('fetchMatchingBusinesses error', e);
        return [];
    }
};

// ─── SMART IMAGE ─────────────────────────────────────────────────────────────
const getSmartImage = (item) => {
    if (item.image && !item.image.includes('unsplash.com/photo-1552832230')) return item.image;
    if (item.images?.[0]) return item.images[0];
    const key = (item.name || item.title || item.category || '').toLowerCase();
    if (key.includes('piazza') || key.includes('square')) return 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=500';
    if (key.includes('fontana') || key.includes('trevi')) return 'https://images.unsplash.com/photo-1555992336-749746e30129?w=500';
    if (key.includes('chiesa') || key.includes('basilica')) return 'https://images.unsplash.com/photo-1579290076295-a226bc40b543?w=500';
    if (key.includes('colosseo')) return 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=500';
    if (key.includes('museo')) return 'https://images.unsplash.com/photo-1548625361-9877484df6c5?w=500';
    if (key.includes('cibo') || key.includes('food')) return 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=500';
    return 'https://images.unsplash.com/photo-1529154036614-a60975f5c760?w=500';
};

// ─── NAVIGATION HUD ───────────────────────────────────────────────────────────
const NavInstruction = ({ step, onNext, onPrev, stepIndex, totalSteps }) => {
    if (!step) return null;
    const getManeuverIcon = (modifier) => {
        if (!modifier) return <ArrowUp size={32} className="text-orange-500" />;
        if (modifier.includes('right')) return <CornerUpRight size={32} className="text-orange-500" />;
        if (modifier.includes('left')) return <CornerUpLeft size={32} className="text-orange-500" />;
        return <ArrowUp size={32} className="text-orange-500" />;
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
                        {step.maneuver?.instruction || 'Segui il percorso'}
                    </h3>
                    {step.distance > 0 && (
                        <p className="text-sm text-gray-600 font-medium mt-1">
                            Tra {Math.round(step.distance)} metri
                        </p>
                    )}
                </div>
                <div className="flex flex-col gap-1">
                    <button onClick={onNext} disabled={stepIndex >= totalSteps - 1} className="p-2 hover:bg-gray-100 rounded-full disabled:opacity-30">
                        <ArrowRight size={16} />
                    </button>
                    {stepIndex > 0 && (
                        <button onClick={onPrev} className="p-2 hover:bg-gray-100 rounded-full">
                            <ArrowLeft size={16} />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────────
const MapPage = () => {
    const location = useLocation();
    const { city, lat, lng } = useUserContext();
    const queryClient = useQueryClient();
    const mapRef = useRef(null);

    const activeCity = city || DEFAULT_CITY;
    const cityData = DEMO_CITIES[activeCity] || DEMO_CITIES['Roma'];

    // ─── STATE ───────────────────────────────────────────────────────────────
    const [selectedActivity, setSelectedActivity] = useState(null);
    const [selectedPartner, setSelectedPartner] = useState(null);
    const [isNavigating, setIsNavigating] = useState(false);
    const [isMapReady, setIsMapReady] = useState(false);
    const [businessPartners, setBusinessPartners] = useState([]);
    const [loadingPartners, setLoadingPartners] = useState(false);
    const [mapBounds, setMapBounds] = useState(null);
    const [showSearchHere, setShowSearchHere] = useState(false);
    const [navSteps, setNavSteps] = useState([]);
    const [currentStepIndex, setCurrentStepIndex] = useState(0);

    const [activeTourData, setActiveTourData] = useState(() => location.state?.tourData || null);
    const [showRoute, setShowRoute] = useState(() => {
        const s = location.state;
        return !!(s?.tourData || s?.focusedActivity || s?.route);
    });
    const [viewMode, setViewMode] = useState(() => {
        const s = location.state;
        return (s?.tourData || s?.focusedActivity || s?.route) ? 'activities' : 'tours';
    });

    const tourData = activeTourData || location.state?.tourData;

    // ─── ACTIVE ROUTE ────────────────────────────────────────────────────────
    const activeRoute = useMemo(() => {
        try {
            if (tourData?.steps?.length > 0) {
                return tourData.steps.map((s, i) => ({
                    latitude: parseFloat(s.lat || s.latitude),
                    longitude: parseFloat(s.lng || s.longitude),
                    label: s.title || `Tappa ${i + 1}`,
                    title: s.title,
                    image: s.image,
                    type: s.type || 'waypoint',
                    description: s.description,
                    index: i,
                }));
            }
            if (tourData?.waypoints) {
                return tourData.waypoints.map((p, i) => ({
                    latitude: Array.isArray(p) ? p[0] : p.latitude,
                    longitude: Array.isArray(p) ? p[1] : p.longitude,
                    label: `Tappa ${i + 1}`,
                    index: i,
                    type: 'waypoint',
                }));
            }
            if (location.state?.route) return location.state.route;
            return MOCK_ROUTES[activeCity] || MOCK_ROUTES['Roma'];
        } catch { return []; }
    }, [tourData, location.state, activeCity]);

    // ─── CITY FLY-TO ─────────────────────────────────────────────────────────
    useEffect(() => {
        if (!mapRef.current || !isMapReady) return;
        if (activeTourData?.center?.latitude && activeTourData?.center?.longitude) {
            mapRef.current.flyTo({
                center: [activeTourData.center.longitude, activeTourData.center.latitude],
                zoom: 13, duration: 2000, essential: true,
            });
            return;
        }
        if (showRoute || selectedActivity) return;
        const targetLat = (lat && lng) ? lat : cityData?.center?.latitude;
        const targetLng = (lat && lng) ? lng : cityData?.center?.longitude;
        if (targetLat && targetLng) {
            mapRef.current.flyTo({ center: [targetLng, targetLat], zoom: 13, duration: 2000, essential: true });
            setShowSearchHere(false);
        }
    }, [activeCity, lat, lng, cityData, showRoute, activeTourData, selectedActivity, isMapReady]);

    // ─── AUTO-FIT TO TOUR ROUTE ──────────────────────────────────────────────
    useEffect(() => {
        if (!showRoute || !activeRoute?.length || !mapRef.current) return;
        try {
            const lngs = activeRoute.map(p => p.longitude).filter(v => !isNaN(v));
            const lats = activeRoute.map(p => p.latitude).filter(v => !isNaN(v));
            if (lngs.length && lats.length) {
                mapRef.current.fitBounds(
                    [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
                    { padding: { top: 100, bottom: 100, left: 50, right: 50 }, duration: 1500, maxZoom: 15 }
                );
            }
        } catch (e) { console.warn('fitBounds failed', e); }
    }, [activeRoute, showRoute]);

    // ─── GLOBAL TOURS QUERY ──────────────────────────────────────────────────
    const { data: globalTours } = useQuery({
        queryKey: ['global-tours', activeCity],
        queryFn: async () => {
            const tours = await dataService.getToursByCity(activeCity);
            if (!tours) return [];
            return tours.map(t => ({
                id: `${t.id}`,
                name: t.title,
                latitude: t.steps?.[0]?.lat || 0,
                longitude: t.steps?.[0]?.lng || 0,
                price: t.price,
                duration: t.duration,
                category: t.category,
                description: t.description,
                image: t.imageUrl,
                type: 'tour_entry',
            })).filter(t => t.latitude && t.longitude);
        },
        staleTime: 1000 * 60 * 5,
        enabled: !!activeCity,
    });

    // ─── FETCH MATCHING PARTNERS when tour is shown ──────────────────────────
    useEffect(() => {
        if (!showRoute || !tourData) { setBusinessPartners([]); return; }
        const startLat = tourData.steps?.[0]?.lat || tourData.center?.latitude;
        const startLng = tourData.steps?.[0]?.lng || tourData.center?.longitude;
        if (!startLat || !startLng) return;
        const tourTags = tourData.tags || [];
        setLoadingPartners(true);
        fetchMatchingBusinesses(startLat, startLng, tourTags, 2500)
            .then(partners => setBusinessPartners(partners))
            .finally(() => setLoadingPartners(false));
    }, [showRoute, tourData]);

    // ─── MAP DISPLAY ITEMS ───────────────────────────────────────────────────
    const mapDisplayItems = useMemo(() => {
        if (viewMode === 'tours') return globalTours || [];
        return [];
    }, [viewMode, globalTours]);

    // All markers when route active: tour stops + business partners
    const allMapMarkers = useMemo(() => {
        if (showRoute) return [...(activeRoute || []), ...businessPartners];
        return mapDisplayItems;
    }, [showRoute, activeRoute, businessPartners, mapDisplayItems]);

    // Drawer items (bounded)
    const visibleDrawerItems = useMemo(() => {
        if (viewMode !== 'tours' || !globalTours) return [];
        if (!mapBounds) return globalTours.slice(0, 5);
        return globalTours.filter(t =>
            t.longitude >= mapBounds._sw.lng && t.longitude <= mapBounds._ne.lng &&
            t.latitude >= mapBounds._sw.lat && t.latitude <= mapBounds._ne.lat
        );
    }, [viewMode, globalTours, mapBounds]);

    // ─── HANDLERS ────────────────────────────────────────────────────────────
    const handleTourClick = (tour) => {
        setSelectedActivity(tour);
        mapRef.current?.flyTo({ center: [tour.longitude, tour.latitude], zoom: 16 });
    };

    const handleMarkerClick = (item) => {
        if (item.type === 'business_partner') {
            setSelectedPartner(item);
            setSelectedActivity(null);
            mapRef.current?.flyTo({ center: [item.longitude, item.latitude], zoom: 17 });
        } else {
            handleTourClick(item);
            setSelectedPartner(null);
        }
    };

    const handleStartNavigation = () => {
        setIsNavigating(true);
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                ({ coords }) => {
                    if (mapRef.current) {
                        mapRef.current.flyTo({ center: [coords.longitude, coords.latitude], zoom: 18, pitch: 60, essential: true });
                        mapRef.current.startTracking?.();
                    }
                },
                () => {
                    alert('Impossibile rilevare la tua posizione. La navigazione partirà dalla prima tappa.');
                    if (activeRoute?.length && mapRef.current) {
                        mapRef.current.flyTo({ center: [activeRoute[0].longitude, activeRoute[0].latitude], zoom: 17, pitch: 45 });
                    }
                },
                { enableHighAccuracy: true, timeout: 5000 }
            );
        }
    };

    const handleMapMove = useCallback((viewState) => {
        if (!showSearchHere && viewMode === 'tours') setShowSearchHere(true);
        const bounds = mapRef.current?.getBounds();
        if (bounds) setMapBounds(bounds);
    }, [showSearchHere, viewMode]);

    const handleSearchHere = () => {
        setShowSearchHere(false);
        queryClient.invalidateQueries(['global-tours']);
    };

    const handleRouteUpdate = useCallback((steps) => {
        if (steps?.length) { setNavSteps(steps); setCurrentStepIndex(0); }
    }, []);

    const nextStep = () => setCurrentStepIndex(p => Math.min(p + 1, navSteps.length - 1));
    const prevStep = () => setCurrentStepIndex(p => Math.max(p - 1, 0));

    // ─── RENDER ───────────────────────────────────────────────────────────────
    return (
        <div className="relative w-full h-screen overflow-hidden bg-gray-50">

            {/* 1. MAP CONTAINER */}
            <div className="absolute inset-0 z-0">
                {(!activeRoute || activeRoute.length === 0) && showRoute ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-50">
                        <div className="bg-white p-6 rounded-2xl shadow-xl text-center max-w-sm mx-4">
                            <div className="mx-auto w-12 h-12 bg-orange-100 text-orange-500 rounded-full flex items-center justify-center mb-4">
                                <MapPin size={24} />
                            </div>
                            <h3 className="text-lg font-bold text-gray-800 mb-2">Mappa non disponibile</h3>
                            <p className="text-gray-500 text-sm mb-6">Questo tour non ha ancora un percorso geografico definito.</p>
                            <Link to="/dashboard-user">
                                <button className="w-full bg-black text-white py-3 rounded-xl font-bold">Torna alla Home</button>
                            </Link>
                        </div>
                    </div>
                ) : (
                    <>
                        <UnnivaiMap
                            ref={mapRef}
                            height="100%"
                            width="100%"
                            activities={showRoute ? allMapMarkers : mapDisplayItems}
                            routePoints={showRoute ? activeRoute : (viewMode === 'tours' ? mapDisplayItems : [])}
                            onActivityClick={handleMarkerClick}
                            isNavigating={isNavigating}
                            onMapMove={handleMapMove}
                            onNavigationRoute={handleRouteUpdate}
                            selectedId={selectedActivity?.id}
                            activeCity={activeCity}
                            initialCenter={activeTourData?.center || (lat && lng ? { latitude: lat, longitude: lng } : null)}
                            onLoad={() => setIsMapReady(true)}
                        />
                        {/* Partner count badge */}
                        {showRoute && businessPartners.length > 0 && (
                            <div className="absolute top-4 right-16 z-40 bg-orange-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 animate-in fade-in pointer-events-none">
                                <Store size={12} />
                                {businessPartners.length} partner compatibili
                            </div>
                        )}
                        {loadingPartners && (
                            <div className="absolute top-4 right-16 z-40 bg-white/80 backdrop-blur text-gray-600 text-xs font-medium px-3 py-1.5 rounded-full shadow flex items-center gap-1.5 pointer-events-none">
                                <div className="w-3 h-3 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
                                Ricerca partner...
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* 2. TOP CONTROLS */}
            <div className="absolute top-4 left-4 right-4 z-40 flex justify-between pointer-events-none">
                <Link to="/dashboard-user" className="bg-white p-3 rounded-full shadow-xl pointer-events-auto text-gray-800 hover:scale-105 transition-transform">
                    <ArrowLeft size={20} />
                </Link>
                {showSearchHere && (
                    <button onClick={handleSearchHere}
                        className="bg-white text-gray-800 px-4 py-2 rounded-full shadow-xl font-bold text-sm flex items-center gap-2 pointer-events-auto animate-in fade-in slide-in-from-top-4">
                        <Search size={14} /> Cerca in questa zona
                    </button>
                )}
            </div>

            {/* 3. NAV HUD */}
            {isNavigating && navSteps.length > 0 && (
                <NavInstruction
                    step={navSteps[currentStepIndex]}
                    onNext={nextStep}
                    onPrev={prevStep}
                    stepIndex={currentStepIndex}
                    totalSteps={navSteps.length}
                />
            )}

            {/* 4. START TOUR BAR */}
            {showRoute && !isNavigating && !selectedActivity && !selectedPartner && tourData && (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-md animate-in slide-in-from-bottom-10 pointer-events-auto">
                    <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl p-4 border border-white/40 flex items-center justify-between gap-4 ring-1 ring-black/5">
                        <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-gray-900 text-lg leading-tight truncate">{tourData?.title || 'Il tuo Itinerario'}</h3>
                            <p className="text-xs text-gray-500 flex items-center gap-1 mt-1 font-medium">
                                <Clock size={12} className="text-orange-500" /> {tourData?.duration || '2.5 ore'} · {activeRoute.length} Tappe
                                {businessPartners.length > 0 && (
                                    <span className="ml-2 text-orange-500 font-bold flex items-center gap-0.5">
                                        <Store size={10} /> {businessPartners.length} partner
                                    </span>
                                )}
                            </p>
                        </div>
                        <button onClick={handleStartNavigation}
                            className="bg-gradient-to-r from-orange-600 to-orange-500 text-white px-6 py-3 rounded-xl font-bold text-sm shadow-lg shadow-orange-200 hover:shadow-orange-300 active:scale-95 transition-all flex flex-col items-center justify-center leading-none gap-1 min-w-[80px]">
                            <NavIcon size={18} className="animate-pulse" />
                            <span className="text-[10px] uppercase tracking-wider">Avvia</span>
                        </button>
                    </div>
                </div>
            )}

            {/* 5. EXPLORE DRAWER */}
            {viewMode === 'tours' && !selectedActivity && !selectedPartner && (
                <div className="absolute bottom-8 left-0 w-full z-40 px-4 pointer-events-none">
                    <div className="flex overflow-x-auto gap-3 pb-4 snap-x snap-mandatory pointer-events-auto no-scrollbar pr-4">
                        {visibleDrawerItems.map(tour => (
                            <div key={tour.id} onClick={() => handleTourClick(tour)}
                                className="snap-center shrink-0 w-64 h-36 bg-white rounded-2xl shadow-xl overflow-hidden relative cursor-pointer active:scale-95 transition-transform ring-1 ring-black/5">
                                <img src={tour.image} className="w-full h-full object-cover" alt="" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                                <div className="absolute bottom-3 left-3 text-white">
                                    <h3 className="font-bold text-sm leading-tight mb-0.5 line-clamp-1">{tour.name}</h3>
                                    <p className="text-[10px] font-medium opacity-90 uppercase tracking-wide bg-orange-500/90 inline-block px-1.5 py-0.5 rounded-md mt-1">
                                        €{tour.price} · {tour.duration}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 6. TOUR DETAIL CARD */}
            {selectedActivity && (
                <div className="absolute bottom-0 left-0 right-0 z-[50] lg:bottom-8 lg:left-8 lg:w-[400px] animate-in slide-in-from-bottom-5">
                    <div className="bg-white rounded-t-3xl lg:rounded-3xl shadow-2xl overflow-hidden ring-1 ring-black/5">
                        <div className="h-44 relative">
                            <img src={selectedActivity.image} className="w-full h-full object-cover" alt="" />
                            <button onClick={() => setSelectedActivity(null)}
                                className="absolute top-4 right-4 p-2 bg-black/50 rounded-full text-white backdrop-blur-sm">
                                <X size={18} />
                            </button>
                            <div className="absolute top-4 left-4 bg-orange-500 text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider shadow-sm">
                                {selectedActivity.category}
                            </div>
                        </div>
                        <div className="p-5">
                            <h2 className="text-xl font-bold mb-1 text-gray-900">{selectedActivity.name}</h2>
                            <p className="text-gray-500 text-xs mb-3 font-medium flex items-center gap-1">
                                <Clock size={12} /> {selectedActivity.duration || 'Durata flessibile'}
                            </p>
                            <p className="text-gray-600 text-sm mb-4 line-clamp-2 leading-relaxed">{selectedActivity.description}</p>
                            {selectedActivity.type === 'tour_entry' ? (
                                <Link to={`/tour-details/${selectedActivity.id}`}
                                    className="w-full bg-black text-white py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-gray-800 transition-colors">
                                    Vedi Dettagli <ArrowRight size={16} />
                                </Link>
                            ) : (
                                <button onClick={handleStartNavigation}
                                    className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-orange-200">
                                    {isNavigating ? 'Navigazione Attiva' : 'Naviga Qui'} <NavIcon size={16} />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* 7. BUSINESS PARTNER DETAIL CARD */}
            {selectedPartner && (
                <div className="absolute bottom-0 left-0 right-0 z-[50] lg:bottom-8 lg:left-8 lg:w-[400px] animate-in slide-in-from-bottom-5">
                    <div className="bg-white rounded-t-3xl lg:rounded-3xl shadow-2xl overflow-hidden ring-2 ring-orange-200">
                        {/* Hero */}
                        <div className="h-40 relative">
                            <img src={selectedPartner.image} className="w-full h-full object-cover" alt="" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                            <button onClick={() => setSelectedPartner(null)}
                                className="absolute top-3 right-3 p-2 bg-black/50 rounded-full text-white backdrop-blur-sm">
                                <X size={16} />
                            </button>
                            {/* Partner badge */}
                            <div className="absolute top-3 left-3 bg-orange-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-md">
                                <Sparkles size={10} /> Partner DoveVai
                            </div>
                            <div className="absolute bottom-3 left-4">
                                <h2 className="text-white font-bold text-lg leading-tight">{selectedPartner.name}</h2>
                                <p className="text-white/70 text-xs flex items-center gap-1">
                                    <MapPin size={10} /> {selectedPartner.address || `${selectedPartner.distanceM}m dal percorso`}
                                </p>
                            </div>
                        </div>
                        {/* Info */}
                        <div className="p-4">
                            {/* AI vibe + style tags */}
                            {(selectedPartner.ai_metadata?.vibe?.length > 0 || selectedPartner.ai_metadata?.style?.length > 0) && (
                                <div className="flex flex-wrap gap-1.5 mb-3">
                                    {selectedPartner.ai_metadata.vibe?.map((v, i) => (
                                        <span key={i} className="text-[10px] font-semibold bg-orange-50 text-orange-700 border border-orange-200 px-2 py-0.5 rounded-full">{v}</span>
                                    ))}
                                    {selectedPartner.ai_metadata.style?.map((s, i) => (
                                        <span key={i} className="text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full">{s}</span>
                                    ))}
                                </div>
                            )}
                            {/* Category tags */}
                            {selectedPartner.category_tags?.length > 0 && (
                                <div className="flex gap-1.5 mb-3 flex-wrap">
                                    {selectedPartner.category_tags.map((t, i) => (
                                        <span key={i} className="text-[10px] font-bold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full flex items-center gap-1">
                                            <Tag size={8} />{t}
                                        </span>
                                    ))}
                                </div>
                            )}
                            <p className="text-gray-600 text-sm line-clamp-2 leading-relaxed mb-4">
                                {selectedPartner.description || 'Attività partner — fai tappa qui durante il tour!'}
                            </p>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => window.open(`https://maps.google.com/?q=${selectedPartner.latitude},${selectedPartner.longitude}`, '_blank')}
                                    className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500 text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-md shadow-orange-200 active:scale-95 transition-transform">
                                    <NavIcon size={14} /> Vai qui
                                </button>
                                <button onClick={() => setSelectedPartner(null)}
                                    className="px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-sm transition-colors">
                                    Chiudi
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default MapPage;
