import React, { useEffect, useMemo } from 'react';
import { useMap, AdvancedMarker } from '@vis.gl/react-google-maps';
import GoogleMapContainer from './map/GoogleMapContainer';
import MapMarker from './map/MapMarker';
import TourRoute from './map/TourRoute';
import { MAP_MOODS } from '../lib/schemas';

const MarkersAndRoute = ({ validActivities, routePoints, suggestedTransit, userLocation, onActivityClick, onRouteStats }) => {
    const map = useMap();

    // Il controllo del viewport (fitBounds e flyTo) è stato rimosso da qui e delegato unicamente a MapPage.jsx 
    // per risovere il bug degli zoom inattesi (conflict resolution con mapRef).

    if (!map) return null;

    return (
        <>
            {userLocation && (
                <AdvancedMarker
                    position={{ lat: userLocation.latitude || userLocation.lat, lng: userLocation.longitude || userLocation.lng }}
                    zIndex={9999}
                >
                    <div className="relative flex items-center justify-center pointer-events-none">
                        <div className="absolute w-12 h-12 bg-blue-500/30 rounded-full animate-ping" />
                        <div className="w-5 h-5 bg-white rounded-full shadow-[0_2px_10px_rgba(0,0,0,0.3)] flex items-center justify-center relative z-10">
                            <div className="w-3.5 h-3.5 bg-blue-500 rounded-full shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]" />
                        </div>
                    </div>
                </AdvancedMarker>
            )}
            {validActivities.map((act, index) => (
                <MapMarker 
                    key={act.id || `marker-${index}-${act.latitude || act.lat}-${act.longitude || act.lng}`} 
                    activity={act} 
                    onClick={onActivityClick} 
                />
            ))}
            {routePoints && routePoints.length > 1 && (
                <TourRoute 
                    waypoints={routePoints} 
                    travelModePreference={suggestedTransit}
                    onRouteStats={onRouteStats}
                />
            )}
        </>
    );
};

export default function UnnivaiMap({
    activities = [],
    routePoints = [],
    mapMood = 'default',
    suggestedTransit,
    userLocation,
    onActivityClick,
    onRouteStats,
    ...props
}) {
    // Filter valid markers and map them - Memoized to prevent Maps SDK stutter
    const validActivities = useMemo(() => 
        activities.filter(a => a && (a.latitude || a.lat) && (a.longitude || a.lng)),
    [activities]);
    const finalMapId = MAP_MOODS[mapMood]?.style || MAP_MOODS.default?.style || import.meta.env.VITE_GOOGLE_MAP_ID;

    return (
        <GoogleMapContainer mapId={finalMapId} activities={activities} routePoints={routePoints} {...props}>
            <MarkersAndRoute 
                validActivities={validActivities}
                routePoints={routePoints}
                suggestedTransit={suggestedTransit}
                userLocation={userLocation}
                onActivityClick={onActivityClick}
                onRouteStats={onRouteStats}
            />
        </GoogleMapContainer>
    );
}
