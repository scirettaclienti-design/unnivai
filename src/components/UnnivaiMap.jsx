import React, { useRef, useEffect, useState, useMemo } from 'react';
import Map, { Marker, NavigationControl, Source, Layer, GeolocateControl } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useUserContext } from '@/hooks/useUserContext';
import { MapPin, Coffee, Camera, ShoppingBag, Utensils, Flag, Landmark, X } from 'lucide-react';

// 🛡️ SAFE MODE MAP CONSTANTS
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const FALLBACK_CENTER = { latitude: 41.9028, longitude: 12.4964, zoom: 12, pitch: 45 };
const DEFAULT_IMAGE = "https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=500&q=80";

// LUXURY STYLING
const MAP_STYLE = "mapbox://styles/mapbox/standard";
const ROUTE_COLOR = "#FF6B35";

// 🧠 INTERNAL SMART IMAGE
const getSmartImage = (item) => {
    if (item.image && !item.image.includes('unsplash.com/photo-1552832230')) return item.image;
    if (item.imageUrl) return item.imageUrl;

    const key = (item.title || item.name || item.type || item.category || '').toLowerCase();

    if (key.includes('piazza') || key.includes('square')) return "https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=500";
    if (key.includes('fontana') || key.includes('trevi')) return "https://images.unsplash.com/photo-1555992336-749746e30129?w=500";
    if (key.includes('chiesa') || key.includes('basilica') || key.includes('san pietro')) return "https://images.unsplash.com/photo-1579290076295-a226bc40b543?w=500";
    if (key.includes('colosseo') || key.includes('arena')) return "https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=500";
    if (key.includes('museo') || key.includes('vatican')) return "https://images.unsplash.com/photo-1548625361-9877484df6c5?w=500";
    if (key.includes('cibo') || key.includes('food') || key.includes('carbonara') || key.includes('osteria')) return "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=500";
    if (key.includes('nature') || key.includes('parco') || key.includes('villa')) return "https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=500";

    return DEFAULT_IMAGE;
};

const UnnivaiMap = React.forwardRef(({ routePoints = [], activities = [], interactive = true, isNavigating = false, ...props }, ref) => {
    const mapRef = useRef(null);
    const geoControlRef = useRef(null);
    const { gpsLocation } = useUserContext();
    const [renderError, setRenderError] = useState(false);
    const [internalUserPos, setInternalUserPos] = useState(null);
    const [routeGeoJSON, setRouteGeoJSON] = useState(null);
    const [approachGeoJSON, setApproachGeoJSON] = useState(null);

    const activeUserLocation = internalUserPos || gpsLocation;

    // 🛡️ SANITIZATION
    const safePoints = useMemo(() => {
        if (!Array.isArray(routePoints)) return [];
        return routePoints
            .filter(p => p && typeof p === 'object')
            .map((p, index) => {
                const lat = parseFloat(p.latitude);
                const lng = parseFloat(p.longitude);
                if (isNaN(lat) || isNaN(lng)) return null;
                return {
                    ...p,
                    id: p.id || `pt-${index}`,
                    latitude: lat,
                    longitude: lng,
                    title: p.title || p.name || p.label || "Punto",
                    description: p.description || "",
                    image: getSmartImage(p),
                    type: (p.type || p.category || 'viewpoint').toLowerCase(),
                    index: index
                };
            })
            .filter(Boolean);
    }, [routePoints]);

    // Expose methods
    React.useImperativeHandle(ref, () => ({
        flyTo: (opts) => mapRef.current?.flyTo(opts),
        startTracking: () => geoControlRef.current?.trigger(),
        getBounds: () => mapRef.current ? mapRef.current.getBounds() : null
    }));

    // 🚀 1. MAIN TOUR ROUTE
    useEffect(() => {
        if (safePoints.length < 2) { setRouteGeoJSON(null); return; }

        let isMounted = true;
        const fetchTourRoute = async () => {
            try {
                const coordinates = safePoints.map(p => `${p.longitude},${p.latitude}`).join(';');
                // 🇮🇹 ADDED language=it for consistency if needed later
                const url = `https://api.mapbox.com/directions/v5/mapbox/walking/${coordinates}?geometries=geojson&language=it&access_token=${MAPBOX_TOKEN}`;
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
    }, [safePoints]);

    // 🚀 2. APPROACH ROUTE + NAV INSTRUCTIONS (User -> First Stop)
    useEffect(() => {
        if (!isNavigating || !activeUserLocation || safePoints.length === 0) {
            setApproachGeoJSON(null);
            return;
        }

        let isMounted = true;

        const fetchApproachAndFit = async () => {
            try {
                const start = `${activeUserLocation.longitude},${activeUserLocation.latitude}`;
                const end = `${safePoints[0].longitude},${safePoints[0].latitude}`;
                // 📡 FETCH STEPS & INSTRUCTIONS
                const url = `https://api.mapbox.com/directions/v5/mapbox/walking/${start};${end}?geometries=geojson&steps=true&language=it&access_token=${MAPBOX_TOKEN}`;

                const response = await fetch(url);
                const data = await response.json();

                if (!isMounted) return;

                if (data.routes?.[0]) {
                    const route = data.routes[0];
                    setApproachGeoJSON({ type: 'Feature', geometry: route.geometry });

                    // 🗣️ PASS STEPS TO PARENT
                    if (route.legs?.[0]?.steps && props.onNavigationRoute) {
                        props.onNavigationRoute(route.legs[0].steps);
                    }
                }

                if (mapRef.current) {
                    const bounds = [
                        [Math.min(activeUserLocation.longitude, safePoints[0].longitude), Math.min(activeUserLocation.latitude, safePoints[0].latitude)],
                        [Math.max(activeUserLocation.longitude, safePoints[0].longitude), Math.max(activeUserLocation.latitude, safePoints[0].latitude)]
                    ];
                    mapRef.current.fitBounds(bounds, { padding: 100, duration: 1500, pitch: 50 });
                }

            } catch (e) { console.warn("Approach fetch failed", e); }
        };
        fetchApproachAndFit();
        return () => { isMounted = false; };
    }, [isNavigating, activeUserLocation, safePoints]);


    // ICONS (Consistent)
    const getIcon = (type, index) => {
        const style = "-rotate-45 text-white";
        try {
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

    return (
        <div className="w-full h-full rounded-xl overflow-hidden relative shadow-sm bg-white isolate">
            <Map
                ref={mapRef}
                initialViewState={FALLBACK_CENTER}
                mapStyle={MAP_STYLE}
                mapboxAccessToken={MAPBOX_TOKEN}
                attributionControl={false}
                terrain={{ source: 'mapbox-dem', exaggeration: 1.5 }}
                pitch={45}
                onMoveEnd={(e) => props.onMapMove?.(e.viewState)}
                onError={() => setRenderError(true)}
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

                {/* ROUTES */}
                {routeGeoJSON && <Source id="tour-route" type="geojson" data={routeGeoJSON}><Layer type="line" paint={{ 'line-color': ROUTE_COLOR, 'line-width': 5, 'line-opacity': 0.9, 'line-cap': 'round', 'line-join': 'round' }} /></Source>}
                {approachGeoJSON && <Source id="approach-route" type="geojson" data={approachGeoJSON}><Layer type="line" paint={{ 'line-color': '#3b82f6', 'line-width': 4, 'line-dasharray': [2, 1], 'line-opacity': 0.8 }} /></Source>}

                {/* MARKERS */}
                {safePoints.map((point) => (
                    <Marker
                        key={point.id}
                        longitude={point.longitude}
                        latitude={point.latitude}
                        anchor="bottom"
                        onClick={(e) => { e.originalEvent.stopPropagation(); props.onActivityClick?.(point); }}
                    >
                        <div className="cursor-pointer transition-transform hover:scale-110 group relative z-10 hover:z-50 pb-2">
                            <div className={`w-10 h-10 rounded-full rounded-br-none rotate-45 border-2 border-white shadow-xl flex items-center justify-center ${point.type === 'tour_entry' ? 'bg-orange-600' :
                                    ['food', 'coffee', 'osteria'].includes(point.type) ? 'bg-amber-500' :
                                        ['shopping'].includes(point.type) ? 'bg-blue-500' :
                                            'bg-slate-800'
                                }`}>
                                {getIcon(point.type, point.index)}
                            </div>
                        </div>
                    </Marker>
                ))}
            </Map>
        </div>
    );
});

UnnivaiMap.displayName = 'UnnivaiMap';

export default UnnivaiMap;
