import React, { useRef, useEffect, useState, useMemo } from 'react';
import Map, { Marker, NavigationControl, Source, Layer, GeolocateControl, Popup } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useUserContext } from '@/hooks/useUserContext';
import { MapPin, Coffee, Camera, ShoppingBag, Utensils, Flag, Landmark, X, Footprints, Car, Bike, Share, Navigation, Store } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getItemImage, imgOnError, GENERIC } from '../utils/imageUtils';

// 🛡️ SAFE MODE MAP CONSTANTS
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const FALLBACK_CENTER = { latitude: 41.9028, longitude: 12.4964, zoom: 12, pitch: 45 };


// LUXURY STYLING
const MAP_STYLE = "mapbox://styles/mapbox/standard";
const ROUTE_COLOR_WALK = "#4285F4"; // Google Blue
const ROUTE_COLOR_DRIVE = "#EA4335"; // Google Red
const ROUTE_COLOR_BIKE = "#34A853"; // Google Green

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

const UnnivaiMap = React.forwardRef(({ routePoints = [], activities = [], interactive = true, isNavigating = false, initialCenter, ...props }, ref) => {
    const mapRef = useRef(null);
    const geoControlRef = useRef(null);
    const { gpsLocation } = useUserContext();
    const [renderError, setRenderError] = useState(false);
    const [internalUserPos, setInternalUserPos] = useState(null);
    const [routeGeoJSON, setRouteGeoJSON] = useState(null);
    const [approachGeoJSON, setApproachGeoJSON] = useState(null);

    // UI State
    const [popupInfo, setPopupInfo] = useState(null);
    const [detailItem, setDetailItem] = useState(null);
    const [transportMode, setTransportMode] = useState('walking'); // walking, driving, cycling

    const activeUserLocation = internalUserPos || gpsLocation;

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
                const profile = transportMode === 'driving' ? 'mapbox/driving'
                    : transportMode === 'cycling' ? 'mapbox/cycling'
                        : 'mapbox/walking';

                const url = `https://api.mapbox.com/directions/v5/${profile}/${coordinates}?geometries=geojson&language=it&access_token=${MAPBOX_TOKEN}`;
                const response = await fetch(url);
                const data = await response.json();
                if (!isMounted) return;

                if (data.routes?.[0]) {
                    setRouteGeoJSON({ type: 'Feature', geometry: data.routes[0].geometry });
                }
            } catch (e) {
                if (isMounted) setRouteGeoJSON({ type: 'Feature', geometry: { type: 'LineString', coordinates: safePoints.map(p => [p.longitude, p.latitude]) } });
            }
        };
        fetchTourRoute();
        return () => { isMounted = false; };
    }, [safePoints, transportMode]);

    // 🚀 2. APPROACH ROUTE + NAV INSTRUCTIONS
    useEffect(() => {
        if (!isNavigating || !activeUserLocation || safePoints.length === 0) {
            setApproachGeoJSON(null);
            return;
        }

        if (mapRef.current) {
            // 🎬 3D LIVE TRANSITION
            mapRef.current.flyTo({
                center: [activeUserLocation.longitude, activeUserLocation.latitude],
                zoom: 19,
                pitch: 60,
                bearing: 0,
                duration: 2000,
                essential: true
            });
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

                    if (route.legs?.[0]?.steps && props.onNavigationRoute) {
                        props.onNavigationRoute(route.legs[0].steps);
                    }
                }
            } catch (e) { console.warn("Approach fetch failed", e); }
        };
        fetchApproach();
        return () => { isMounted = false; };
    }, [isNavigating, activeUserLocation, safePoints, transportMode]);


    // ICONS
    const getIcon = (type, index) => {
        const style = "-rotate-45 text-white";
        try {
            if (type === 'business_partner') return <Store size={16} className="text-white" />;
            if (type === 'waypoint') return <span className={`font-bold text-sm ${style}`}>{index + 1}</span>;
            switch (type) {
                case 'food': case 'restaurant': case 'osteria': return <Utensils size={16} className={style} />;
                case 'coffee': return <Coffee size={16} className={style} />;
                case 'shopping': return <ShoppingBag size={16} className={style} />;
                case 'photo': case 'viewpoint': return <Camera size={16} className={style} />;
                case 'tour_entry': return <Flag size={16} className={style} />;
                case 'culture': case 'church': return <Landmark size={16} className={style} />;
                default: return <MapPin size={16} className={style} />;
            }
        } catch (e) { return <MapPin size={16} className="text-white" />; }
    };

    if (!MAPBOX_TOKEN || renderError) return <div className="p-4 text-center text-red-red-400">Map Unavailable</div>;

    const activeRouteColor = transportMode === 'driving' ? ROUTE_COLOR_DRIVE : transportMode === 'cycling' ? ROUTE_COLOR_BIKE : ROUTE_COLOR_WALK;

    return (
        <div className="w-full h-full rounded-xl overflow-hidden relative shadow-sm bg-white isolate">
            <Map
                ref={mapRef}
                initialViewState={startView}
                mapStyle={MAP_STYLE}
                mapboxAccessToken={MAPBOX_TOKEN}
                attributionControl={false}
                terrain={{ source: 'mapbox-dem', exaggeration: 1.5 }}
                pitch={45}
                onMoveEnd={(e) => props.onMapMove?.(e.viewState)}
                onError={() => setRenderError(true)}
                onLoad={(e) => props.onLoad?.(e)}
            >
                <div className="absolute top-4 right-4 z-50 flex flex-col gap-2">
                    <NavigationControl showCompass={true} visualizePitch={true} />
                    <GeolocateControl
                        ref={geoControlRef}
                        positionOptions={{ enableHighAccuracy: true }}
                        trackUserLocation={true}
                        showUserHeading={true}
                        showAccuracyCircle={false}
                        onGeolocate={(e) => { if (e?.coords) setInternalUserPos({ latitude: e.coords.latitude, longitude: e.coords.longitude }); }}
                    />
                </div>

                {/* 🚗 TRANSPORT MODE SELECTOR */}
                {!isNavigating && safePoints.length > 0 && (
                    <div className="absolute top-4 left-4 z-50 bg-white/90 backdrop-blur-md rounded-full shadow-lg p-1.5 flex gap-1 border border-black/5">
                        <button onClick={() => setTransportMode('walking')} className={`p-2 rounded-full transition-all ${transportMode === 'walking' ? 'bg-blue-500 text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'}`}>
                            <Footprints size={18} />
                        </button>
                        <button onClick={() => setTransportMode('cycling')} className={`p-2 rounded-full transition-all ${transportMode === 'cycling' ? 'bg-green-500 text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'}`}>
                            <Bike size={18} />
                        </button>
                        <button onClick={() => setTransportMode('driving')} className={`p-2 rounded-full transition-all ${transportMode === 'driving' ? 'bg-red-500 text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'}`}>
                            <Car size={18} />
                        </button>
                    </div>
                )}

                {/* ROUTES */}
                {routeGeoJSON && <Source id="tour-route" type="geojson" data={routeGeoJSON}><Layer type="line" paint={{ 'line-color': activeRouteColor, 'line-width': 5, 'line-opacity': 0.9, 'line-cap': 'round', 'line-join': 'round' }} /></Source>}
                {approachGeoJSON && <Source id="approach-route" type="geojson" data={approachGeoJSON}><Layer type="line" paint={{ 'line-color': '#3b82f6', 'line-width': 4, 'line-dasharray': [2, 1], 'line-opacity': 0.8 }} /></Source>}

                {/* MARKERS - TIERED LOGIC */}
                {safePoints.map((point) => {
                    const isPartner = point.type === 'business_partner';
                    const isGold = point.tier === 'gold' || point.type === 'tour_entry';
                    const markerScale = isGold ? 1.2 : 1.0;
                    const zIndex = isPartner ? 25 : isGold ? 30 : 20;

                    return (
                        <Marker
                            key={point.id}
                            longitude={point.longitude}
                            latitude={point.latitude}
                            anchor="bottom"
                            onClick={(e) => {
                                e.originalEvent.stopPropagation();
                                if (props.onActivityClick) {
                                    props.onActivityClick(point);
                                } else {
                                    setPopupInfo(point);
                                    mapRef.current?.flyTo({ center: [point.longitude, point.latitude], zoom: 17, pitch: 50, duration: 1000 });
                                }
                            }}
                            style={{ zIndex }}
                        >
                            <div className="cursor-pointer transition-all duration-300 group relative hover:scale-110">
                                {/* Gold Pulse Effect */}
                                {isGold && <div className="absolute -inset-2 bg-yellow-400/30 rounded-full animate-ping pointer-events-none" />}
                                {/* Partner Pulse Effect */}
                                {isPartner && <div className="absolute -inset-2 bg-orange-400/25 rounded-full animate-pulse pointer-events-none" />}

                                {/* SEQUENCE NUMBER BADGE (only for regular waypoints) */}
                                {!isPartner && typeof point.index === 'number' && (
                                    <div className="absolute -top-3 -right-2 bg-blue-600 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold border-2 border-white z-50 shadow-md">
                                        {point.index + 1}
                                    </div>
                                )}

                                <div className={`flex items-center justify-center shadow-2xl border-2 transition-transform duration-300
                                    ${isPartner
                                        ? 'w-11 h-11 rounded-full bg-gradient-to-br from-orange-500 to-amber-400 border-white text-white'
                                        : isGold
                                            ? 'w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400 to-amber-600 border-white text-white rotate-0'
                                            : 'w-10 h-10 bg-slate-900 border-white text-white rotate-45 rounded-br-none hover:bg-black hover:scale-110'
                                    }
                                `}>
                                    <div className={!isGold && !isPartner ? '-rotate-45' : ''}>
                                        {getIcon(point.type, point.index)}
                                    </div>
                                </div>

                                {/* Partner label tooltip */}
                                {isPartner && (
                                    <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] font-bold text-orange-700 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded-full shadow-sm pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                                        {point.title?.substring(0, 16)}
                                    </div>
                                )}
                            </div>
                        </Marker>
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
