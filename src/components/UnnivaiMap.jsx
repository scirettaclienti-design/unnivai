/**
 * DVAI-023 — Marker clustering con @googlemaps/markerclusterer
 * Raggruppa i marker a zoom bassi per migliorare le performance con >50 POI.
 */
import React, { useEffect, useMemo, useRef } from 'react';
import { useMap, AdvancedMarker } from '@vis.gl/react-google-maps';
import { MarkerClusterer } from '@googlemaps/markerclusterer';
import GoogleMapContainer from './Map/GoogleMapContainer';
import MapMarker from './Map/MapMarker';
import TourRoute from './Map/TourRoute';
import { MAP_MOODS } from '../lib/schemas';

// ─── Cluster-aware markers ────────────────────────────────────────────────────
const ClusteredMarkers = ({ validActivities, onActivityClick }) => {
    const map = useMap();
    const clustererRef = useRef(null);
    const markersRef   = useRef({});

    // Inizializza o distruggi il clusterer al cambio della map
    useEffect(() => {
        if (!map) return;

        clustererRef.current = new MarkerClusterer({ map });

        return () => {
            if (clustererRef.current) {
                clustererRef.current.clearMarkers();
                clustererRef.current = null;
            }
        };
    }, [map]);

    // Aggiorna i marker quando cambiano le attività
    useEffect(() => {
        if (!clustererRef.current || !map) return;

        // Rimuovi tutti i marker precedenti
        clustererRef.current.clearMarkers();

        // Guard: aspetta che AdvancedMarkerElement sia disponibile
        const AME = window.google?.maps?.marker?.AdvancedMarkerElement;
        if (!AME) {
            // Fallback: riprova dopo il caricamento della libreria marker
            const retryTimeout = setTimeout(() => {
                if (window.google?.maps?.marker?.AdvancedMarkerElement) {
                    clustererRef.current?.clearMarkers();
                }
            }, 1000);
            return () => clearTimeout(retryTimeout);
        }

        // Crea nuovi marker Google Maps nativi (compatibili con MarkerClusterer)
        const newMarkers = validActivities.map((act) => {
            const lat = act.latitude  ?? act.lat;
            const lng = act.longitude ?? act.lng;
            if (!lat || !lng) return null;

            const marker = new AME({
                position: { lat, lng },
                title:    act.name || act.title || 'POI',
            });

            marker.addListener('click', () => onActivityClick?.(act));
            markersRef.current[act.id] = marker;
            return marker;
        }).filter(Boolean);

        clustererRef.current.addMarkers(newMarkers);
    }, [validActivities, map, onActivityClick]);

    // Questo componente gestisce i marker tramite ref — nessun JSX da renderizzare
    return null;
};

// ─── Wrapper principale ───────────────────────────────────────────────────────
const MarkersAndRoute = ({ validActivities, routePoints, suggestedTransit, userLocation, onActivityClick, onRouteStats }) => {
    const map = useMap();
    if (!map) return null;

    return (
        <>
            {/* Marker posizione utente (sempre visibile, non clusterizzato) */}
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

            {/* DVAI-023: marker clusterizzati per performance con >50 POI */}
            <ClusteredMarkers
                validActivities={validActivities}
                onActivityClick={onActivityClick}
            />

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
