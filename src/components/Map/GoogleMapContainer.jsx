import React from 'react';
import { Map } from '@vis.gl/react-google-maps';

const MAP_ID = import.meta.env.VITE_GOOGLE_MAP_ID;

// DoveVAI Premium Map Style — toni caldi, minimalista, brand-first
const DOVEVAI_MAP_STYLES = [
    // Nascondi POI commerciali Google (dare risalto ai NOSTRI marker)
    { featureType: "poi.business", elementType: "labels", stylers: [{ visibility: "off" }] },
    { featureType: "poi.medical", elementType: "labels", stylers: [{ visibility: "off" }] },
    { featureType: "poi.school", elementType: "labels", stylers: [{ visibility: "off" }] },
    { featureType: "poi.government", elementType: "labels", stylers: [{ visibility: "off" }] },
    { featureType: "poi.sports_complex", elementType: "labels", stylers: [{ visibility: "off" }] },
    // Mantieni attrazioni e parchi
    { featureType: "poi.attraction", stylers: [{ visibility: "on" }] },
    { featureType: "poi.park", stylers: [{ visibility: "on" }] },
    // Sfondo caldo crema (landscape)
    { featureType: "landscape.man_made", elementType: "geometry.fill", stylers: [{ color: "#faf5ef" }] },
    { featureType: "landscape.natural", elementType: "geometry.fill", stylers: [{ color: "#f5efe6" }] },
    // Strade pulite e minimaliste
    { featureType: "road.highway", elementType: "geometry.fill", stylers: [{ color: "#f0e4d4" }] },
    { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#e6d5c3" }] },
    { featureType: "road.arterial", elementType: "geometry.fill", stylers: [{ color: "#ffffff" }] },
    { featureType: "road.local", elementType: "geometry.fill", stylers: [{ color: "#ffffff" }] },
    { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#8a7968" }] },
    // Acqua calma
    { featureType: "water", elementType: "geometry.fill", stylers: [{ color: "#c9dbe8" }] },
    { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#7b9baa" }] },
    // Transit discreto
    { featureType: "transit", elementType: "labels", stylers: [{ visibility: "simplified" }] },
    { featureType: "transit.station", elementType: "labels.icon", stylers: [{ saturation: -60 }] },
];

export default function GoogleMapContainer({
    initialCenter = { latitude: 41.9028, longitude: 12.4964 },
    defaultZoom = 13,
    heading = 0,
    tilt = 45,
    mapId,
    children,
    className = "",
    // -- PROPS TO STRIP (prevent re-renders/stutter in Map SDK) --
    activities,
    routePoints,
    userLocation,
    isNavigating,
    mapMood,
    suggestedTransit,
    activeCity,
    selectedId,
    onRouteStats,
    completedSteps,
    transportModeOverride,
    ...props
}) {
    const defaultCenter = { 
        lat: initialCenter?.latitude ?? 41.9028, 
        lng: initialCenter?.longitude ?? 12.4964 
    };

    return (
        <div className={`w-full h-full relative isolate ${className}`}>
            <Map
                defaultCenter={defaultCenter}
                defaultZoom={defaultZoom}
                mapId={mapId || MAP_ID || '28861a61c07876f819652d2d'}
                
                // Vector Maps configuration for photorealistic 3D
                renderingType="VECTOR"
                gestureHandling="greedy"
                
                // CRITICAL FIX: Use default* props to stop React from forcing the camera, allowing native trackpad 60fps 3D panning.
                defaultHeading={heading}
                defaultTilt={tilt}
                
                zoomControl={window.innerWidth > 768}
                mapTypeControl={false}
                streetViewControl={false}
                fullscreenControl={false}
                styles={DOVEVAI_MAP_STYLES}
                {...props}
            >
                {children}
            </Map>
        </div>
    );
}
