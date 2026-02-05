import React, { useRef, useEffect, useState } from 'react';
import Map, { Marker, NavigationControl, Popup, Source, Layer } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useUserContext } from '@/hooks/useUserContext';
import { MapPin, Landmark, ArrowRight, X, Star, Store, Coffee, Bed } from 'lucide-react';
import { Link } from 'react-router-dom';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

// Default to Rome if no location
const DEFAULT_CENTER = {
    latitude: 41.9028,
    longitude: 12.4964,
    zoom: 13
};

// Mock Contextual Activities for demo purposes
export const MOCK_ACTIVITIES = [
    {
        id: 'a1',
        name: 'Fontanella Pubblica',
        latitude: 41.9035,
        longitude: 12.4975,
        level: 'free',
        category: 'service',
        description: "Acqua potabile fresca, ideale per riempire la borraccia.",
        image: "https://images.unsplash.com/photo-1542459800-9831d102e332?w=300"
    },
    {
        id: 'a2',
        name: 'Souvenir Roma',
        latitude: 41.9045,
        longitude: 12.4955,
        level: 'base',
        category: 'shop',
        description: "Negozio artigianale con prodotti tipici locali.",
        imageUrl: "https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?w=400"
    },
    {
        id: 'a3',
        name: 'Trattoria Romana',
        latitude: 41.9015,
        longitude: 12.4985,
        level: 'pro',
        category: 'food',
        rating: 4.5,
        price: 30,
        description: "Cucina tradizionale romana in un ambiente accogliente.",
        image: "https://images.unsplash.com/photo-1574868233905-25916053805b?w=400"
    },
    {
        id: 'a4',
        name: 'Hotel Imperiale',
        latitude: 41.9010,
        longitude: 12.4940,
        level: 'premium',
        category: 'hotel',
        rating: 5.0,
        price: 250,
        description: "Lusso e comfort nel cuore della città eterna. Esperienza indimenticabile garantita.",
        image: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=500"
    },
];

const DEFAULT_LANDMARKS = [];

export default function UnnivaiMap({
    initialLat,
    initialLng,
    zoom = 13,
    height = "100%",
    width = "100%",
    showUserLocation = true,
    interactive = true,
    routePoints = null,
    activities = null,
    onActivityClick = null,
    hideMarkers = false,
    ...props
}) {
    const { gpsLocation, city } = useUserContext();
    const mapRef = useRef(null);
    // Removed internal selectedLandmark state to delegate to parent

    // Determine center: Props > GPS > Default
    const initialViewState = {
        latitude: initialLat || gpsLocation?.latitude || DEFAULT_CENTER.latitude,
        longitude: initialLng || gpsLocation?.longitude || DEFAULT_CENTER.longitude,
        zoom: zoom
    };

    const [viewState, setViewState] = useState(initialViewState);

    // Prepare Route GeoJSON
    const routeGeoJSON = routePoints && routePoints.length > 1 ? {
        type: 'Feature',
        properties: {},
        geometry: {
            type: 'LineString',
            coordinates: routePoints.map(p => [p.longitude, p.latitude])
        }
    } : null;

    // Update view if GPS changes and no initial props provided
    // Also update view if initialLat/Lng change explicitly (e.g. from external route navigation)
    // AutoFitBounds: Fit map to route and user on load or route change
    useEffect(() => {
        if (routePoints && routePoints.length > 0 && mapRef.current) {
            // Calculate Min/Max Bounds manually
            let minLng = routePoints[0].longitude;
            let maxLng = routePoints[0].longitude;
            let minLat = routePoints[0].latitude;
            let maxLat = routePoints[0].latitude;

            routePoints.forEach(p => {
                if (p.longitude < minLng) minLng = p.longitude;
                if (p.longitude > maxLng) maxLng = p.longitude;
                if (p.latitude < minLat) minLat = p.latitude;
                if (p.latitude > maxLat) maxLat = p.latitude;
            });

            // Include GPS if available
            if (showUserLocation && gpsLocation) {
                if (gpsLocation.longitude < minLng) minLng = gpsLocation.longitude;
                if (gpsLocation.longitude > maxLng) maxLng = gpsLocation.longitude;
                if (gpsLocation.latitude < minLat) minLat = gpsLocation.latitude;
                if (gpsLocation.latitude > maxLat) maxLat = gpsLocation.latitude;
            }

            try {
                mapRef.current.fitBounds(
                    [
                        [minLng, minLat], // Southwest
                        [maxLng, maxLat]  // Northeast
                    ],
                    {
                        padding: { top: 80, bottom: 120, left: 40, right: 40 },
                        duration: 1500,
                        pitch: 30 // Optimize pitch
                    }
                );
            } catch (error) {
                console.error("FitBounds Error:", error);
            }
        } else if (initialLat && initialLng) {
            mapRef.current?.flyTo({
                center: [initialLng, initialLat],
                zoom: zoom || 14,
                duration: 2000
            });
        }
    }, [routePoints, gpsLocation, showUserLocation, initialLat, initialLng, zoom]);

    if (!MAPBOX_TOKEN) {
        return (
            <div className="flex items-center justify-center bg-gray-100 text-gray-500 font-quicksand p-4 text-center rounded-2xl h-full w-full">
                <div>
                    <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>Mapbox Token mancante.</p>
                    <p className="text-xs">Aggiungi VITE_MAPBOX_TOKEN al file .env</p>
                </div>
            </div>
        );
    }

    // Helper for Activity Icons
    const getActivityIcon = (category) => {
        switch (category) {
            case 'food': return Coffee;
            case 'hotel': return Bed;
            case 'shop': return Store;
            default: return MapPin;
        }
    };

    // Hover State
    const [hoveredActivity, setHoveredActivity] = useState(null);

    const activeActivities = activities || MOCK_ACTIVITIES;

    // Common transition class for fading markers
    const markerTransitionClass = `transition-opacity duration-300 ${hideMarkers ? 'opacity-0 pointer-events-none' : 'opacity-100'}`;

    return (
        <div style={{ height, width }} className="rounded-2xl overflow-hidden shadow-inner relative font-quicksand">
            <Map
                ref={mapRef}
                {...viewState}
                onMove={evt => setViewState(evt.viewState)}
                style={{ width: '100%', height: '100%' }}
                mapStyle="mapbox://styles/mapbox/light-v11"
                mapboxAccessToken={MAPBOX_TOKEN}
                interactive={interactive}
                attributionControl={false}
                pitch={60}
                bearing={-10}
                terrain={{ source: 'mapbox-dem', exaggeration: 1.5 }}
                onLoad={(e) => {
                    if (e.target.getLayer('poi-label')) {
                        e.target.setLayoutProperty('poi-label', 'visibility', 'none');
                    }
                }}
            >
                {interactive && <NavigationControl position="bottom-right" showCompass={false} />}

                <Source
                    id="mapbox-dem"
                    type="raster-dem"
                    url="mapbox://mapbox.mapbox-terrain-dem-v1"
                    tileSize={512}
                    maxzoom={14}
                />

                <Layer
                    id="sky"
                    type="sky"
                    paint={{
                        'sky-type': 'atmosphere',
                        'sky-atmosphere-sun': [0.0, 0.0],
                        'sky-atmosphere-sun-intensity': 15
                    }}
                />

                <Layer
                    id="3d-buildings"
                    source="composite"
                    source-layer="building"
                    filter={['==', 'extrude', true]}
                    type="fill-extrusion"
                    minzoom={15.5}
                    paint={{
                        'fill-extrusion-color': '#FFFFFF',
                        'fill-extrusion-height': [
                            'interpolate',
                            ['linear'],
                            ['zoom'],
                            15,
                            0,
                            15.05,
                            ['get', 'height']
                        ],
                        'fill-extrusion-base': [
                            'interpolate',
                            ['linear'],
                            ['zoom'],
                            15,
                            0,
                            15.05,
                            ['get', 'min_height']
                        ],
                        'fill-extrusion-opacity': 0.4
                    }}
                />

                {/* Narrative Route Layer - Dynamic Styling */}
                {routeGeoJSON && (
                    <Source id="route-source" type="geojson" data={routeGeoJSON}>
                        <Layer
                            id="route-halo"
                            type="line"
                            paint={{
                                'line-color': '#FFFFFF',
                                'line-width': 10,
                                'line-opacity': 0.8
                            }}
                            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                        />
                        <Layer
                            id="route-layer"
                            type="line"
                            paint={{
                                'line-color': props.tourMood === 'romantic' ? '#FDBA74' : // Pastel Orange
                                    props.tourMood === 'relax' ? '#6EE7B7' : // Pastel Green
                                        props.tourMood === 'lively' ? '#FDA4AF' : // Pastel Rose
                                            '#93C5FD', // Pastel Blue
                                'line-width': 6,
                                'line-opacity': 0.9,
                                'line-dasharray': [0.1, 1.8] // Dotted/Dashed effect "flowing" look
                            }}
                            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                        />
                    </Source>
                )}

                {/* Contextual Activities - TIERED RENDEING */}
                {activeActivities.map(activity => {
                    const Icon = getActivityIcon(activity.category);
                    const isSelected = props.selectedId === activity.id;

                    const handleMarkerClick = (e) => {
                        e.stopPropagation();
                        e.originalEvent?.stopPropagation();

                        mapRef.current?.flyTo({
                            center: [activity.longitude, activity.latitude],
                            zoom: 17,
                            pitch: (activity.tier === 'premium' || activity.level === 'premium') ? 60 : 45,
                            bearing: 0,
                            duration: 1500,
                            essential: true,
                            easing: (t) => t * (2 - t)
                        });

                        if (onActivityClick) onActivityClick(activity);
                    };

                    const handleMouseEnter = () => setHoveredActivity(activity);
                    const handleMouseLeave = () => setHoveredActivity(null);

                    // TIER 3: PREMIUM (Hero Animated - Vetrina)
                    if (activity.tier === 'premium' || activity.level === 'premium') {
                        return (
                            <Marker
                                key={activity.id}
                                longitude={activity.longitude}
                                latitude={activity.latitude}
                                anchor="bottom"
                                style={{ zIndex: isSelected ? 200 : 150 }} // Always on top
                            >
                                <div
                                    onClick={handleMarkerClick}
                                    onMouseEnter={handleMouseEnter}
                                    onMouseLeave={handleMouseLeave}
                                    className={`relative group cursor-pointer transition-all duration-500 ${isSelected ? 'scale-110' : 'hover:scale-105'} ${markerTransitionClass}`}>
                                    {/* Gold Aura */}
                                    <div className="absolute -inset-6 bg-amber-400/30 rounded-full blur-xl animate-pulse" />

                                    {/* Hero Card Marker */}
                                    <div className="relative flex flex-col items-center">
                                        <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-amber-400 shadow-2xl relative bg-black ring-4 ring-amber-400/20">
                                            <img src={activity.image} alt={activity.name} className="w-full h-full object-cover opacity-90" />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                                            <div className="absolute bottom-1 w-full text-center">
                                                <Star size={10} className="fill-amber-400 text-amber-400 inline-block" />
                                            </div>
                                        </div>
                                        {/* Label always visible */}
                                        <div className="mt-2 bg-black/90 text-amber-400 text-[10px] font-black uppercase px-2 py-0.5 rounded border border-amber-400/50 shadow-lg tracking-widest whitespace-nowrap">
                                            {activity.name}
                                        </div>
                                        {/* Needle */}
                                        <div className="w-0.5 h-6 bg-amber-400 mt-[-2px]"></div>
                                        <div className="w-2 h-2 bg-amber-400 rounded-full shadow-lg"></div>
                                    </div>
                                </div>
                            </Marker>
                        )
                    }

                    // TIER 2: BASE (Partner - Visible Icon)
                    if (activity.tier === 'base' || activity.level === 'base') {
                        return (
                            <Marker
                                key={activity.id}
                                longitude={activity.longitude}
                                latitude={activity.latitude}
                                anchor="bottom"
                                style={{ zIndex: isSelected ? 100 : 50 }}
                            >
                                <div
                                    onClick={handleMarkerClick}
                                    onMouseEnter={handleMouseEnter}
                                    onMouseLeave={handleMouseLeave}
                                    className={`group cursor-pointer relative transition-transform duration-300 ${isSelected ? 'scale-125' : 'hover:scale-110'} ${markerTransitionClass}`}>
                                    {/* Circle Icon Pin */}
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shadow-lg border border-gray-200 bg-white relative z-10 text-gray-700`}>
                                        <Icon className="w-4 h-4" />
                                    </div>
                                    <div className="absolute top-7 left-1/2 -translate-x-1/2 w-0.5 h-3 bg-gray-400"></div>
                                    <div className="absolute top-10 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-gray-400 rounded-full opacity-50 blur-[1px]"></div>
                                </div>
                            </Marker>
                        )
                    }

                    // TIER 1: FREE (Standard Interest Point - Minimal Dot)
                    return (
                        <Marker
                            key={activity.id}
                            longitude={activity.longitude}
                            latitude={activity.latitude}
                            anchor="center"
                            style={{ zIndex: isSelected ? 90 : 10 }}
                        >
                            <div
                                onClick={handleMarkerClick}
                                onMouseEnter={handleMouseEnter}
                                onMouseLeave={handleMouseLeave}
                                className={`group cursor-pointer transition-all duration-300 ${isSelected ? 'scale-150' : 'hover:scale-125'} ${markerTransitionClass}`}>
                                {/* Neutral Dot */}
                                <div className="w-2 h-2 rounded-full bg-gray-400 border border-white shadow-sm group-hover:bg-gray-600 transition-colors"></div>
                            </div>
                        </Marker>
                    );
                })}

                {/* HOVER OVERLAY (Fixed Position to avoid clipping) */}
                {hoveredActivity && !props.selectedId && (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] pointer-events-none animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="bg-white/90 backdrop-blur-md p-2 rounded-2xl shadow-xl border border-white/50 flex items-center gap-3 pr-4 max-w-[280px]">
                            {hoveredActivity.image && (
                                <div className="w-12 h-12 rounded-xl bg-gray-200 overflow-hidden flex-shrink-0">
                                    <img src={hoveredActivity.image} alt={hoveredActivity.name} className="w-full h-full object-cover" />
                                </div>
                            )}
                            <div className="flex flex-col min-w-0">
                                <h3 className="font-bold text-gray-900 text-sm leading-tight truncate">{hoveredActivity.name}</h3>
                                <p className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">
                                    {hoveredActivity.category || 'Luogo'}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Route Waypoints - PREMIUM AESTHETIC */}
                {routePoints && routePoints.map((point, index) => {
                    const isSelected = props.selectedId === `wp-${index}`;
                    const isStart = index === 0;
                    const isEnd = index === routePoints.length - 1;

                    // Dynamic Styling based on position
                    const bgClass = isStart ? 'bg-gradient-to-br from-green-500 to-green-700' :
                        isEnd ? 'bg-gradient-to-br from-red-500 to-red-700' :
                            'bg-gradient-to-br from-gray-800 to-black';

                    const shadowClass = isStart ? 'shadow-green-500/30' :
                        isEnd ? 'shadow-red-500/30' :
                            'shadow-black/30';

                    return (
                        <Marker
                            key={`route-${index}`}
                            longitude={point.longitude}
                            latitude={point.latitude}
                            anchor="bottom"
                            style={{ zIndex: isSelected ? 120 : 60 }}
                            onClick={(e) => {
                                e.originalEvent.stopPropagation();
                                if (onActivityClick) {
                                    onActivityClick({
                                        id: `wp-${index}`,
                                        longitude: point.longitude,
                                        latitude: point.latitude,
                                        name: point.label || `Tappa ${index + 1}`,
                                        description: point.description || "Tappa fondamentale del percorso.",
                                        image: point.image,
                                        isWaypoint: true,
                                        index: index + 1,
                                        total: routePoints.length
                                    });
                                }
                                mapRef.current?.flyTo({
                                    center: [point.longitude, point.latitude],
                                    zoom: 17,
                                    pitch: 60,
                                    duration: 1500
                                });
                            }}
                        >
                            <div className={`relative flex flex-col items-center group cursor-pointer transition-all duration-500 ${isSelected ? 'scale-110 -translate-y-2' : 'hover:scale-105 hover:-translate-y-1'} ${markerTransitionClass}`}>

                                {/* 3D Anchoring Line (stick) */}
                                <div className={`w-0.5 h-4 bg-gray-400/50 absolute -bottom-3 z-0 ${isSelected ? 'h-6' : 'h-4'} transition-all`} />
                                <div className="w-2 h-0.5 bg-black/20 blur-[1px] absolute -bottom-3 rounded-full z-0" />

                                {/* Main Body (The "Card-Pin") */}
                                <div className={`relative z-10 flex flex-col items-center`}>

                                    {/* Number Badge */}
                                    <div className={`w-10 h-10 rounded-2xl rotate-45 flex items-center justify-center shadow-lg ${bgClass} ${shadowClass} border-2 border-white transform transition-transform duration-300`}>
                                        <div className="-rotate-45 text-white font-black text-sm">{index + 1}</div>
                                    </div>

                                    {/* Glass Label - Always visible for Start/End, hover for others unless selected */}
                                    <div className={`absolute top-full mt-2 transition-all duration-300 ${isSelected || isStart || isEnd ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0'}`}>
                                        <div className="bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/50 shadow-xl flex flex-col items-center">
                                            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider leading-none mb-0.5">
                                                {isStart ? 'PARTENZA' : isEnd ? 'ARRIVO' : 'TAPPA'}
                                            </span>
                                            <span className="text-xs font-bold text-gray-800 whitespace-nowrap leading-tight">
                                                {point.label}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Pulse Effect for Active/Start */}
                                    {isStart && (
                                        <div className="absolute inset-0 bg-green-400/30 rounded-full blur-xl animate-pulse -z-10 scale-150" />
                                    )}
                                </div>
                            </div>
                        </Marker>
                    );
                })}

                {/* User Location */}
                {showUserLocation && gpsLocation && (
                    <Marker longitude={gpsLocation.longitude} latitude={gpsLocation.latitude} anchor="bottom">
                        <div className="relative">
                            <span className="flex h-5 w-5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-5 w-5 bg-blue-500 border-2 border-white shadow-xl"></span>
                            </span>
                        </div>
                    </Marker>
                )}

                {/* Iconic Landmarks */}
                {(props.landmarks || DEFAULT_LANDMARKS).map(landmark => {
                    const isSelected = props.selectedId === landmark.id;
                    return (
                        <Marker
                            key={landmark.id}
                            longitude={landmark.longitude}
                            latitude={landmark.latitude}
                            anchor="bottom"
                            onClick={e => {
                                e.originalEvent.stopPropagation();
                                mapRef.current?.flyTo({
                                    center: [landmark.longitude, landmark.latitude],
                                    zoom: 17,
                                    pitch: 60,
                                    bearing: -20,
                                    duration: 2000
                                });
                                // Delegate to parent
                                if (onActivityClick) onActivityClick({ ...landmark, isLandmark: true });
                            }}
                        >
                            <div className={`group cursor-pointer relative transition-transform duration-300 ${isSelected ? 'scale-125' : 'hover:scale-110'} ${markerTransitionClass}`}>
                                {/* Stylized Landmark Marker */}
                                <div className="w-12 h-12 bg-indigo-600 rounded-tr-2xl rounded-bl-2xl rounded-tl-sm rounded-br-sm shadow-xl border-2 border-white flex items-center justify-center transform hover:rotate-6 transition-transform">
                                    <Landmark className="w-6 h-6 text-white" />
                                </div>
                                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-6 h-1.5 bg-black/20 blur-md rounded-full" />

                                {/* Always Visible Label for Landmarks */}
                                <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur px-2 py-0.5 rounded text-[10px] uppercase font-bold text-gray-600 tracking-wider shadow-sm border border-white/50 whitespace-nowrap">
                                    {landmark.name}
                                </div>
                            </div>
                        </Marker>
                    );
                })}
            </Map>
            <div className="absolute inset-0 pointer-events-none border-4 border-white/50 rounded-2xl" />
        </div>
    );
}
