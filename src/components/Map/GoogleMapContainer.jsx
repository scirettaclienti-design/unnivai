import React from 'react';
import { Map } from '@vis.gl/react-google-maps';

const MAP_ID = import.meta.env.VITE_GOOGLE_MAP_ID;

const HIDE_POI_STYLES = [
    {
        featureType: "poi.business",
        elementType: "labels",
        stylers: [{ visibility: "off" }]
    },
    {
        featureType: "poi.medical",
        elementType: "labels",
        stylers: [{ visibility: "off" }]
    },
    {
        featureType: "poi.school",
        elementType: "labels",
        stylers: [{ visibility: "off" }]
    },
    {
        featureType: "poi.attraction",
        stylers: [{ visibility: "on" }]
    },
    {
        featureType: "poi.park",
        stylers: [{ visibility: "on" }]
    }
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
                
                zoomControl={true}
                mapTypeControl={true}
                streetViewControl={true}
                fullscreenControl={true}
                {...props}
            >
                {children}
            </Map>
        </div>
    );
}
