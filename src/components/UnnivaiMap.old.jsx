import React, { useRef, useEffect, useState, useMemo } from 'react';
import Map, { Marker, NavigationControl, Source, Layer, GeolocateControl, Popup } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useUserContext } from '@/hooks/useUserContext';
import { MapPin, Coffee, Camera, ShoppingBag, Utensils, Flag, Landmark, X, Footprints, Car, Bike, Navigation, Store, BusFront, ArrowUp, CornerUpRight, CornerUpLeft, ChevronRight, ChevronLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getItemImage, imgOnError } from '../utils/imageUtils';
import { MAP_MOODS } from '@/lib/schemas';
import { SmartMarker } from './Map/SmartMarker';

// ─── NAV HELPERS ─────────────────────────────────────────────────────────────
const toRad = (d) => d * Math.PI / 180;

const computeBearing = (from, to) => {
    const dLon = toRad(to.longitude - from.longitude);
    const lat1 = toRad(from.latitude);
    const lat2 = toRad(to.latitude);
    const y = Math.sin(dLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
};

const haversineMapM = (lat1, lng1, lat2, lng2) => {
    const R = 6371000;
    const a = Math.sin(toRad(lat2 - lat1) / 2) ** 2
        + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(toRad(lng2 - lng1) / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// Minimum distance (metres) from a point to a GeoJSON LineString coords array [[lng,lat],...]
const minDistToPolyline = (lat, lng, coords) => {
    if (!coords?.length) return Infinity;
    return Math.min(...coords.map(([cLng, cLat]) => haversineMapM(lat, lng, cLat, cLng)));
};

// 🛡️ SAFE MODE MAP CONSTANTS
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const FALLBACK_CENTER = { latitude: 41.9028, longitude: 12.4964, zoom: 12, pitch: 45 };

// Layering Constants for Z-Index
const LAYERS = {
  MONUMENT: 10,  // Level 0
  BUSINESS: 50,  // Level 1
  TOUR: 100      // Level 2 (Top)
};

// LUXURY STYLING
const MAP_STYLE = "mapbox://styles/mapbox/standard";
const ROUTE_COLOR_WALK = "#4285F4";    // Google Blue
const ROUTE_COLOR_DRIVE = "#EA4335";   // Google Red
const ROUTE_COLOR_BIKE = "#34A853";    // Google Green
const ROUTE_COLOR_TRANSIT = "#A855F7"; // Purple

// 🧠 SMART IMAGE — uses centralised utility
const getSmartImage = (item, city = '') => getItemImage(item, city);


// --- PREMIUM DETAIL MODAL ---
const PremiumDetailModal = ({ item, onClose }) => {
    if (!item) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center pointer-events-none">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-md pointer-events-auto transition-opacity" onClick={onClose} />

            <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                className="bg-white w-full sm:max-w-md h-[85vh] sm:h-[600px] rounded-t-[2rem] sm:rounded-3xl shadow-2xl relative z-10 overflow-hidden pointer-events-auto flex flex-col font-quicksand"
            >
                {/* Hero Image */}
                <div className="h-64 relative shrink-0">
                    <img
                        src={getSmartImage(item)}
                        onError={imgOnError()}
                        className="w-full h-full object-cover"
                        alt={item.title || item.name || 'Luogo'}
                    />
                    <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-black/40 hover:bg-black/60 text-white rounded-full backdrop-blur-md transition-colors">
                        <X size={20} />
                    </button>
                    <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider text-gray-900 shadow-sm">
                        {item.type}
                    </div>
                    <div className="absolute bottom-0 inset-x-0 h-24 bg-gradient-to-t from-black/80 to-transparent flex items-end p-6">
                        <div>
                            <h2 className="text-2xl font-bold text-white leading-tight mb-1">{item.title}</h2>
                            <div className="flex items-center gap-2 text-white/90 text-sm">
                                <MapPin size={14} /> {item.location || "Posizione esatta"}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-6 bg-white">
                    <div className="flex gap-4 mb-6 border-b border-gray-100 pb-6">
                        <div className="text-center flex-1">
                            <div className="font-bold text-xl text-gray-900">{item.rating || 4.8}</div>
                            <div className="text-[10px] text-gray-400 uppercase tracking-widest">Rating</div>
                        </div>
                        <div className="w-px bg-gray-100"></div>
                        <div className="text-center flex-1">
                            <div className="font-bold text-xl text-gray-900">15m</div>
                            <div className="text-[10px] text-gray-400 uppercase tracking-widest">Durata</div>
                        </div>
                        <div className="w-px bg-gray-100"></div>
                        <div className="text-center flex-1">
                            <div className="font-bold text-xl text-gray-900">€{item.price || 0}</div>
                            <div className="text-[10px] text-gray-400 uppercase tracking-widest">Prezzo</div>
                        </div>
                    </div>

                    <h3 className="font-bold text-gray-900 mb-3 text-lg">L'Esperienza</h3>
                    <p className="text-gray-600 leading-relaxed mb-6">
                        {item.description || "Scopri questa gemma nascosta nel cuore della città. Un luogo ricco di storia e fascino, perfetto per scattare foto indimenticabili o godersi un momento di relax."}
                    </p>

                    {/* Gallery Grid Mock */}
                    <div className="grid grid-cols-2 gap-2 mb-20">
                        <img src="https://images.unsplash.com/photo-1515096788709-a3cfdcca3a6b?w=300" className="rounded-xl h-24 object-cover" />
                        <img src="https://images.unsplash.com/photo-1555813456-9a2cbd328d02?w=300" className="rounded-xl h-24 object-cover" />
                    </div>
                </div>

                {/* Fixed Bottom Action */}
                <div className="absolute bottom-0 inset-x-0 p-4 bg-white border-t border-gray-100">
                    <button className="w-full bg-black text-white py-4 rounded-2xl font-bold text-lg shadow-lg flex items-center justify-center gap-2">
                        <Navigation size={20} /> Avvia Navigazione
                    </button>
                </div>
            </motion.div>
        </div>
    );
}

// ─── NAVIGATION HUD ───────────────────────────────────────────────────────────
const NavigationHUD = ({ step, stepIndex, totalSteps, onNext, onPrev }) => {
    if (!step) return null;

    const modifier = step.maneuver?.modifier || '';
    const instruction = step.maneuver?.instruction || 'Continua dritto';
    const dist = step.distance > 0
        ? step.distance >= 1000
            ? `${(step.distance / 1000).toFixed(1)} km`
            : `${Math.round(step.distance)} m`
        : null;

    const ManeuverIcon = modifier.includes('right') ? CornerUpRight
        : modifier.includes('left') ? CornerUpLeft
            : ArrowUp;

    return (
        <motion.div
            key={stepIndex}
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="absolute top-6 left-4 right-4 z-50 pointer-events-auto font-quicksand"
        >
            <div className="bg-white/80 backdrop-blur-3xl rounded-[24px] shadow-2xl border border-white/80 ring-1 ring-black/5 flex items-center gap-4 px-5 py-4 mx-auto max-w-sm">
                {/* Direction icon */}
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white flex-shrink-0 shadow-lg shadow-purple-200">
                    <ManeuverIcon size={28} strokeWidth={2.5} />
                </div>

                {/* Instruction text */}
                <div className="flex-1 min-w-0">
                    {dist && (
                        <p className="text-[10px] font-bold text-orange-500 uppercase tracking-widest leading-none mb-1">
                            tra {dist}
                        </p>
                    )}
                    <h3 className="font-bold text-gray-900 leading-snug line-clamp-2 text-[15px]">
                        {instruction}
                    </h3>
                    <p className="text-[10px] text-gray-400 mt-0.5 font-medium">
                        {stepIndex + 1} / {totalSteps}
                    </p>
                </div>

                {/* Prev / Next buttons */}
                <div className="flex flex-col gap-1 flex-shrink-0">
                    <button
                        onClick={onPrev}
                        disabled={stepIndex <= 0}
                        className="p-1.5 rounded-full bg-gray-50 hover:bg-gray-100 active:bg-gray-200 disabled:opacity-20 transition-colors"
                    >
                        <ChevronLeft size={14} className="text-gray-600" />
                    </button>
                    <button
                        onClick={onNext}
                        disabled={stepIndex >= totalSteps - 1}
                        className="p-1.5 rounded-full bg-gray-50 hover:bg-gray-100 active:bg-gray-200 disabled:opacity-20 transition-colors"
                    >
                        <ChevronRight size={14} className="text-gray-600" />
                    </button>
                </div>
            </div>
        </motion.div>
    );
};

const UnnivaiMap = React.forwardRef(({ routePoints = [], activities = [], interactive = true, isNavigating = false, initialCenter, tourData, ...props }, ref) => {
    const mapRef = useRef(null);
    const geoControlRef = useRef(null);
    const { gpsLocation } = useUserContext();
    const [renderError, setRenderError] = useState(false);
    const [internalUserPos, setInternalUserPos] = useState(null);
    const [mapLoaded, setMapLoaded] = useState(false);
    const [routeGeoJSON, setRouteGeoJSON] = useState(null);
    const [approachGeoJSON, setApproachGeoJSON] = useState(null);

    // Turn-by-turn navigation state
    const [navSteps, setNavSteps] = useState([]);
    const [currentNavStep, setCurrentNavStep] = useState(0);
    const routeCoordsRef = useRef(null);  // cached approach polyline coords [[lng,lat],...]
    const prevPosRef = useRef(null);       // last known GPS position for bearing calc

    // UI State
    const [popupInfo, setPopupInfo] = useState(null);
    const [detailItem, setDetailItem] = useState(null);
    const [internalTransportMode, setInternalTransportMode] = useState('walking'); // walking, driving, cycling, transit
    const [zoom, setZoom] = useState(initialCenter?.zoom || 13);
    const transportMode = props.transportModeOverride || internalTransportMode;

    const activeUserLocation = internalUserPos || gpsLocation;
    const currentMood = MAP_MOODS[tourData?.mood] || MAP_MOODS.default;

    // ⚓ ANCHOR LOGIC
    const startView = useMemo(() => {
        if (initialCenter && initialCenter.latitude && initialCenter.longitude) {
            return {
                latitude: initialCenter.latitude,
                longitude: initialCenter.longitude,
                zoom: 12,
                pitch: 45
            };
        }
        return FALLBACK_CENTER;
    }, [initialCenter]);

    // 🛡️ SANITIZATION
    const safePoints = useMemo(() => {
        if (!Array.isArray(routePoints)) return [];
        return routePoints
            .filter(p => p && (typeof p === 'object'))
            .map((p, index) => {
                const lat = parseFloat(p.latitude || (Array.isArray(p) ? p[0] : null));
                const lng = parseFloat(p.longitude || (Array.isArray(p) ? p[1] : null));

                if (isNaN(lat) || isNaN(lng) || !isFinite(lat) || !isFinite(lng)) return null;

                // isSponsored business → always render as business_partner (orange marker)
                const resolvedType = p.isSponsored
                    ? 'business_partner'
                    : (p.type || p.category || 'viewpoint').toLowerCase();

                return {
                    ...p,
                    id: p.id || `pt-${index}-${lat}-${lng}`,
                    latitude: lat,
                    longitude: lng,
                    title: p.title || p.name || p.label || "Punto",
                    description: p.description || "",
                    image: getItemImage(p),
                    type: resolvedType,
                    index: index,
                    rating: p.rating,
                    reviews: p.reviews,
                    price: p.price
                };
            })
            .filter(Boolean);
    }, [routePoints]);

    // HELPERS
    const handlePopupClose = () => {
        setPopupInfo(null);
        // Reset View logic can be here or handled by MapPage
        if (mapRef.current && safePoints.length > 0 && !isNavigating) {
            fitToMarkers();
        }
    };

    const fitToMarkers = () => {
        if (!mapRef.current || safePoints.length === 0) return;

        const lngs = safePoints.map(p => p.longitude);
        const lats = safePoints.map(p => p.latitude);
        const minLng = Math.min(...lngs);
        const maxLng = Math.max(...lngs);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);

        mapRef.current.fitBounds(
            [[minLng, minLat], [maxLng, maxLat]],
            {
                padding: { top: 100, bottom: 120, left: 50, right: 50 }, // 15% Padding approx
                maxZoom: 15,
                duration: 1500,
                pitch: 0
            }
        );
    };

    // Expose methods
    React.useImperativeHandle(ref, () => ({
        flyTo: (opts) => mapRef.current?.flyTo(opts),
        startTracking: () => geoControlRef.current?.trigger(),
        getBounds: () => mapRef.current ? mapRef.current.getBounds() : null,
        fitToRoute: fitToMarkers
    }));

    // ⚡ DYNAMIC FLY TO (Listens to viewCenter prop)
    useEffect(() => {
        if (props.viewCenter && props.viewCenter.latitude && props.viewCenter.longitude) {
            if (mapRef.current) {
                mapRef.current.flyTo({
                    center: [props.viewCenter.longitude, props.viewCenter.latitude],
                    zoom: 12,
                    duration: 2000,
                    essential: true
                });
                setPopupInfo(null);
            }
        } else if (props.activeCity) {
            // Fallback to internal lookup if no explicit center provided (for backward compat)
            // We can keep the old logic or remove it. Let's remove to clean up and rely on viewCenter from parent.
        }
    }, [props.viewCenter]);

    // 🚀 1. MAIN TOUR ROUTE (with Transport Mode)
    useEffect(() => {
        if (safePoints.length < 2) { setRouteGeoJSON(null); return; }

        let isMounted = true;
        const fetchTourRoute = async () => {
            try {
                const coordinates = safePoints.map(p => `${p.longitude},${p.latitude}`).join(';');
                
                // Mappatura dei nostri modi sui profili Mapbox
                const profileMap = {
                    walking: 'walking',
                    cycling: 'cycling',
                    driving: 'driving',
                    transit: 'walking' // Fallback su walking per percorsi transit-pedonali
                };

                const activeProfile = profileMap[transportMode] || 'walking';
                const url = `https://api.mapbox.com/directions/v5/mapbox/${activeProfile}/${coordinates}?geometries=geojson&language=it&access_token=${MAPBOX_TOKEN}`;
                const cacheKey = `route_${activeProfile}_${coordinates}`;

                // 1. OFFLINE GUARD & DEFERRED RECALCULATION
                if (!navigator.onLine) {
                    const cached = localStorage.getItem(cacheKey);
                    if (cached) {
                        const parsed = JSON.parse(cached);
                        if (isMounted) {
                            setRouteGeoJSON({ type: 'Feature', geometry: parsed.geometry });
                            if (props.onRouteStats) props.onRouteStats(parsed.stats);
                        }
                    } else {
                        // Fallback: draw straight lines between points (Deferred Recalculation)
                        console.warn("Offline: showing direct line fallback");
                        if (isMounted) setRouteGeoJSON({ type: 'Feature', geometry: { type: 'LineString', coordinates: safePoints.map(p => [p.longitude, p.latitude]) } });
                    }
                    return; // Stop here if offline
                }

                const response = await fetch(url);
                const data = await response.json();
                if (!isMounted) return;

                if (data.routes?.[0]) {
                    const route = data.routes[0];
                    setRouteGeoJSON({ type: 'Feature', geometry: route.geometry });
                    
                    const stats = {
                        durationSec: route.duration,
                        distanceM: route.distance,
                        mode: transportMode,
                        duration: Math.round(route.duration / 60),
                        distance: (route.distance / 1000).toFixed(1)
                    };

                    // Cache route for offline use
                    localStorage.setItem(cacheKey, JSON.stringify({ geometry: route.geometry, stats }));

                    // Comunichiamo i nuovi dati alla UI tramite props.onRouteStats
                    if (props.onRouteStats) props.onRouteStats(stats);
                    if (props.onRouteUpdate) props.onRouteUpdate(stats);
                }
            } catch (e) {
                console.error("Errore ricalcolo rotta:", e);
                if (isMounted) setRouteGeoJSON({ type: 'Feature', geometry: { type: 'LineString', coordinates: safePoints.map(p => [p.longitude, p.latitude]) } });
            }
        };
        fetchTourRoute();
        return () => { isMounted = false; };
    }, [safePoints, transportMode]);

    // 🎬 2a. CAMERA FOLLOW — runs on every GPS update during navigation
    useEffect(() => {
        if (!isNavigating || !activeUserLocation || !mapRef.current) {
            if (!isNavigating) prevPosRef.current = null; // reset bearing on nav end
            return;
        }

        const bearing = prevPosRef.current
            ? computeBearing(prevPosRef.current, activeUserLocation)
            : 0;

        mapRef.current.flyTo({
            center: [activeUserLocation.longitude, activeUserLocation.latitude],
            zoom: 18,
            pitch: 60,
            bearing,
            duration: 700,
            essential: true,
            padding: { top: 0, bottom: 180, left: 0, right: 0 }, // user in lower half
        });

        prevPosRef.current = activeUserLocation;

        // Auto-advance step when within 20 m of next maneuver point
        setCurrentNavStep(prev => {
            const step = navSteps[prev];
            if (!step?.maneuver?.location) return prev;
            const [mLng, mLat] = step.maneuver.location;
            const d = haversineMapM(activeUserLocation.latitude, activeUserLocation.longitude, mLat, mLng);
            return (d < 20 && prev < navSteps.length - 1) ? prev + 1 : prev;
        });
    }, [activeUserLocation, isNavigating, navSteps]);

    // 🚀 2b. APPROACH FETCH — initial + auto-recalc when >30 m off-route
    useEffect(() => {
        if (!isNavigating || !activeUserLocation || safePoints.length === 0) {
            setApproachGeoJSON(null);
            setNavSteps([]);
            setCurrentNavStep(0);
            routeCoordsRef.current = null;
            return;
        }

        // Off-route gate: skip API call if user is still within 30 m of cached route
        if (routeCoordsRef.current) {
            const dist = minDistToPolyline(
                activeUserLocation.latitude, activeUserLocation.longitude,
                routeCoordsRef.current
            );
            if (dist <= 30) return; // still on route, no recalc needed
        }

        let isMounted = true;
        const fetchApproach = async () => {
            try {
                const start = `${activeUserLocation.longitude},${activeUserLocation.latitude}`;
                const end = `${safePoints[0].longitude},${safePoints[0].latitude}`;
                const profile = transportMode === 'driving' ? 'mapbox/driving' : 'mapbox/walking';
                const url = `https://api.mapbox.com/directions/v5/${profile}/${start};${end}?geometries=geojson&steps=true&language=it&access_token=${MAPBOX_TOKEN}`;

                const response = await fetch(url);
                const data = await response.json();
                if (!isMounted) return;

                if (data.routes?.[0]) {
                    const route = data.routes[0];
                    setApproachGeoJSON({ type: 'Feature', geometry: route.geometry });
                    routeCoordsRef.current = route.geometry.coordinates; // cache for gate

                    if (route.legs?.[0]?.steps) {
                        setNavSteps(route.legs[0].steps);
                        setCurrentNavStep(0);
                        props.onNavigationRoute?.(route.legs[0].steps); // backwards compat
                    }
                }
            } catch (e) { console.warn("Approach fetch failed", e); }
        };
        fetchApproach();
        return () => { isMounted = false; };
    }, [isNavigating, activeUserLocation, safePoints, transportMode]);


    // ICONS
    const getIcon = (type, index, icon) => {
        const style = "-rotate-45 text-white";
        try {
            // If the activity row has a custom emoji icon, use it directly
            if (icon) return <span className="text-base leading-none">{icon}</span>;
            if (type === 'business_partner') return <Store size={16} className="text-white" />;
            if (type === 'waypoint') return <span className={`font-bold text-sm ${style}`}>{index + 1}</span>;
            switch (type) {
                case 'monument':                    return <Landmark size={16} className={style} />;
                case 'museum':                      return <Landmark size={16} className={style} />;
                case 'church':                      return <Landmark size={16} className={style} />;
                case 'viewpoint':                   return <Camera size={16} className={style} />;
                case 'food': case 'restaurant': case 'osteria': return <Utensils size={16} className={style} />;
                case 'coffee':                      return <Coffee size={16} className={style} />;
                case 'shopping':                    return <ShoppingBag size={16} className={style} />;
                case 'photo':                       return <Camera size={16} className={style} />;
                case 'tour_entry':                  return <Flag size={16} className={style} />;
                case 'culture':                     return <Landmark size={16} className={style} />;
                default:                            return <MapPin size={16} className={style} />;
            }
        } catch (e) { return <MapPin size={16} className="text-white" />; }
    };

    if (!MAPBOX_TOKEN || renderError) return <div className="p-4 text-center text-red-red-400">Map Unavailable</div>;

    const activeRouteColor = transportMode === 'driving' ? ROUTE_COLOR_DRIVE
        : transportMode === 'cycling' ? ROUTE_COLOR_BIKE
            : transportMode === 'transit' ? ROUTE_COLOR_TRANSIT
                : ROUTE_COLOR_WALK;

    return (
        <div className="w-full h-full rounded-xl overflow-hidden relative shadow-sm bg-white isolate">

            {/* 🗺️ NAVIGATION HUD — turn-by-turn instructions overlay */}
            <AnimatePresence mode="wait">
                {isNavigating && navSteps.length > 0 && (
                    <NavigationHUD
                        key={currentNavStep}
                        step={navSteps[currentNavStep]}
                        stepIndex={currentNavStep}
                        totalSteps={navSteps.length}
                        onNext={() => setCurrentNavStep(p => Math.min(p + 1, navSteps.length - 1))}
                        onPrev={() => setCurrentNavStep(p => Math.max(p - 1, 0))}
                    />
                )}
            </AnimatePresence>

            <Map
                ref={mapRef}
                initialViewState={startView}
                mapStyle={currentMood.style}
                mapboxAccessToken={MAPBOX_TOKEN}
                attributionControl={false}
                terrain={{ source: 'mapbox-dem', exaggeration: 1.5 }}
                pitch={45}
                onMove={(e) => setZoom(e.viewState.zoom)}
                onMoveEnd={(e) => props.onMapMove?.(e.viewState)}
                onError={() => setRenderError(true)}
                onLoad={(e) => { setMapLoaded(true); props.onLoad?.(e); }}
            >
                <div className="absolute top-4 right-4 z-50 flex flex-col gap-2">
                    <NavigationControl showCompass={true} visualizePitch={true} />
                    <GeolocateControl
                        ref={geoControlRef}
                        positionOptions={{ enableHighAccuracy: true }}
                        trackUserLocation={true}
                        showUserHeading={true}
                        showAccuracyCircle={false}
                        onGeolocate={(e) => { 
                            if (e?.coords) {
                                // GPS SMOOTHING: Ignora aggiornamenti > 50m per evitare rotazioni brusche
                                if (isNavigating && e.coords.accuracy > 50) return;
                                setInternalUserPos({ latitude: e.coords.latitude, longitude: e.coords.longitude }); 
                            }
                        }}
                    />
                </div>

                {/* 🚗 TRANSPORT MODE SELECTOR */}
                {!isNavigating && safePoints.length > 0 && !props.transportModeOverride && (
                    <div className="absolute top-4 left-4 z-50 bg-white/90 backdrop-blur-md rounded-full shadow-lg p-1.5 flex gap-1 border border-black/5">
                        <button onClick={() => setInternalTransportMode('walking')} className={`p-2 rounded-full transition-all ${transportMode === 'walking' ? 'bg-blue-500 text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'}`}>
                            <Footprints size={18} />
                        </button>
                        <button onClick={() => setInternalTransportMode('cycling')} className={`p-2 rounded-full transition-all ${transportMode === 'cycling' ? 'bg-green-500 text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'}`}>
                            <Bike size={18} />
                        </button>
                        <button onClick={() => setInternalTransportMode('driving')} className={`p-2 rounded-full transition-all ${transportMode === 'driving' ? 'bg-red-500 text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'}`}>
                            <Car size={18} />
                        </button>
                        <button onClick={() => setInternalTransportMode('transit')} className={`p-2 rounded-full transition-all ${transportMode === 'transit' ? 'bg-purple-500 text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'}`}>
                            <BusFront size={18} />
                        </button>
                    </div>
                )}

                {/* ROUTES — gated behind mapLoaded to avoid "Style is not done loading" crash */}
                {/* Effetto ombra sottostante per il path principale (Glow) */}
                {mapLoaded && routeGeoJSON && <Source id="tour-route-glow" type="geojson" data={routeGeoJSON}><Layer type="line" paint={{ 'line-color': activeRouteColor, 'line-width': 12, 'line-opacity': 0.15, 'line-cap': 'round', 'line-join': 'round', 'line-blur': 8 }} /></Source>}
                {/* Linea solida ma più sottile sopra */}
                {mapLoaded && routeGeoJSON && <Source id="tour-route" type="geojson" data={routeGeoJSON}><Layer type="line" paint={{ 'line-color': activeRouteColor, 'line-width': 4.5, 'line-opacity': 0.9, 'line-cap': 'round', 'line-join': 'round' }} /></Source>}
                
                {/* Approach line più elegante */}
                {mapLoaded && approachGeoJSON && <Source id="approach-route" type="geojson" data={approachGeoJSON}><Layer type="line" paint={{ 'line-color': '#6b7280', 'line-width': 3, 'line-dasharray': [1, 2], 'line-opacity': 0.6, 'line-cap': 'round' }} /></Source>}

                {/* UNIFIED MARKERS RENDER */}
                {activities
                    .filter(p => p && !isNaN(parseFloat(p.latitude || p.lat)))
                    .map((point, index) => {
                        const lat = parseFloat(point.latitude || point.lat);
                        const lng = parseFloat(point.longitude || point.lng);
                        
                        // Determiniamo il livello
                        const isBusiness = point.type === 'business_partner' || point.business_id || point.subscription_tier;
                        const isRouteStep = point.type === 'waypoint' || point.index !== undefined; // if it has index from activeRoute
                        
                        let level = 0; // Monument / POI default
                        if (isRouteStep) level = 2;
                        else if (isBusiness) level = 1;
                        
                        // Monumenti visibili solo con zoom >= 14, i partner (level 1) e le tappe (level 2) SEMPRE visibili
                        if (level === 0 && zoom < 14) return null;

                        const zIndex = level === 2 ? LAYERS.TOUR : (level === 1 ? LAYERS.BUSINESS : LAYERS.MONUMENT);
                        const id = point.id || `pt-${level}-${index}-${lat}-${lng}`;

                        if (level === 2 && props.completedSteps?.includes(id)) {
                            point.completed = true;
                        }

                        return (
                            <SmartMarker
                                key={id}
                                point={{...point, latitude: lat, longitude: lng}}
                                level={level}
                                zIndex={zIndex}
                                onClick={(pointObj) => {
                                    if (level === 1) {
                                        if (props.onPOIClick) props.onPOIClick(pointObj);
                                    } else if (level === 2) {
                                        if (props.onPOIClick) props.onPOIClick(pointObj);
                                        else if (props.onActivityClick) props.onActivityClick(pointObj);
                                    } else {
                                        if (props.onPOIClick) props.onPOIClick(pointObj);
                                    }
                                    
                                    if (level === 0 || level === 2) {
                                        mapRef.current?.flyTo({ center: [lng, lat], zoom: 17, pitch: 50, duration: 1000 });
                                    }
                                }}
                            />
                        );
                    })}

                {/* 🆕 APPLE-STYLE POPUP CARD */}
                {popupInfo && (
                    <Popup
                        anchor="top"
                        longitude={popupInfo.longitude}
                        latitude={popupInfo.latitude}
                        onClose={handlePopupClose}
                        closeButton={false}
                        maxWidth="320px"
                        offset={20}
                        className="apple-map-popup"
                    >
                        <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            className="bg-white rounded-2xl shadow-xl overflow-hidden w-64 font-quicksand"
                        >
                            <div className="relative h-28">
                                <img
                                    src={getSmartImage(popupInfo)}
                                    onError={imgOnError()}
                                    className="w-full h-full object-cover"
                                    alt={popupInfo.title || ''}
                                />
                                <div className="absolute inset-0 bg-black/10" />
                                <button onClick={handlePopupClose} className="absolute top-2 right-2 bg-black/40 text-white p-1 rounded-full backdrop-blur-sm"><X size={12} /></button>
                            </div>
                            <div className="p-3">
                                <h3 className="font-bold text-gray-900 leading-tight mb-1">{popupInfo.title}</h3>
                                <p className="text-xs text-gray-500 line-clamp-1 mb-3">{popupInfo.description || "Nessuna descrizione"}</p>
                                <button
                                    onClick={() => { setDetailItem(popupInfo); setPopupInfo(null); }}
                                    className="w-full bg-gray-100 hover:bg-gray-200 text-gray-900 text-xs font-bold py-2 rounded-lg transition-colors"
                                >
                                    Dettagli
                                </button>
                            </div>
                        </motion.div>
                    </Popup>
                )}
            </Map>

            {/* DETAIL MODAL OVERLAY */}
            <AnimatePresence>
                {detailItem && <PremiumDetailModal item={detailItem} onClose={() => setDetailItem(null)} />}
            </AnimatePresence>
        </div>
    );
});

UnnivaiMap.displayName = 'UnnivaiMap';

export default UnnivaiMap;
