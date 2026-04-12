/**
 * DVAI-023 — Marker clustering con @googlemaps/markerclusterer
 * Usa i MapMarker 3D personalizzati per default.
 * Attiva il clustering nativo solo con >50 POI per performance.
 */
import React, { useEffect, useMemo, useRef } from 'react';
import { useMap, AdvancedMarker } from '@vis.gl/react-google-maps';
import { MarkerClusterer } from '@googlemaps/markerclusterer';
import GoogleMapContainer from './Map/GoogleMapContainer';
import MapMarker from './Map/MapMarker';
import TourRoute from './Map/TourRoute';
import { MAP_MOODS } from '../lib/schemas';

const CLUSTER_THRESHOLD = 50;

// ─── Cluster nativo (solo per >50 POI) ───────────────────────────────────────
const NativeClusteredMarkers = ({ validActivities, onActivityClick }) => {
    const map = useMap();
    const clustererRef = useRef(null);

    useEffect(() => {
        if (!map) return;
        clustererRef.current = new MarkerClusterer({ map });
        return () => {
            clustererRef.current?.clearMarkers();
            clustererRef.current = null;
        };
    }, [map]);

    useEffect(() => {
        if (!clustererRef.current || !map) return;
        clustererRef.current.clearMarkers();

        const AME = window.google?.maps?.marker?.AdvancedMarkerElement;
        if (!AME) return;

        const newMarkers = validActivities.map((act) => {
            const lat = act.latitude ?? act.lat;
            const lng = act.longitude ?? act.lng;
            if (!lat || !lng) return null;

            const marker = new AME({
                position: { lat, lng },
                title: act.name || act.title || 'POI',
            });
            marker.addListener('click', () => onActivityClick?.(act));
            return marker;
        }).filter(Boolean);

        clustererRef.current.addMarkers(newMarkers);
    }, [validActivities, map, onActivityClick]);

    return null;
};

// ─── Wrapper principale ───────────────────────────────────────────────────────
const MarkersAndRoute = ({ validActivities, routePoints, suggestedTransit, userLocation, onActivityClick, onRouteStats }) => {
    const map = useMap();
    if (!map) return null;

    const useNativeClustering = validActivities.length > CLUSTER_THRESHOLD;

    return (
        <>
            {/* Marker posizione utente (sempre visibile) */}
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

            {/* Marker: 3D personalizzati (<=50) o clustering nativo (>50) */}
            {useNativeClustering ? (
                <NativeClusteredMarkers
                    validActivities={validActivities}
                    onActivityClick={onActivityClick}
                />
            ) : (
                validActivities.map((act, index) => (
                    <MapMarker
                        key={act.id || `marker-${index}-${act.latitude || act.lat}-${act.longitude || act.lng}`}
                        activity={act}
                        onClick={onActivityClick}
                    />
                ))
            )}

            {/* Percorso del tour */}
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
