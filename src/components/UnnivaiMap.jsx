/**
 * DVAI-023 — Marker clustering con @googlemaps/markerclusterer
 * Usa i MapMarker 3D personalizzati per default.
 * Attiva il clustering nativo solo con >50 POI per performance.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMap, AdvancedMarker } from '@vis.gl/react-google-maps';
import { MarkerClusterer } from '@googlemaps/markerclusterer';
import GoogleMapContainer from './Map/GoogleMapContainer';
import MapMarker from './Map/MapMarker';
import TourRoute from './Map/TourRoute';
import { separaSegnaposti } from '../lib/segnaposti';

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
const MarkersAndRoute = ({ validActivities, routePoints, suggestedTransit, userLocation, onActivityClick, onRouteStats, onDirectionsData, progress, userHeading, panoramica }) => {
    const map = useMap();
    // nav-camera: i segnaposti numerati non si sovrappongono (si ricalcola quando cambia lo zoom)
    const [zoom, setZoom] = useState(null);
    useEffect(() => {
        if (!map) return undefined;
        const leggi = () => setZoom(map.getZoom?.() ?? null);
        const l = map.addListener?.('zoom_changed', leggi);
        const primo = window.google?.maps?.event?.addListenerOnce?.(map, 'idle', leggi); // lo zoom di partenza, appena la mappa e' ferma
        return () => { l?.remove?.(); primo?.remove?.(); };
    }, [map]);
    const spostamenti = useMemo(() => separaSegnaposti(
        validActivities.map((a, i) => ({ a, i })).filter(({ a }) => a.index !== undefined).map(({ a, i }) => ({ id: a.id || `marker-${i}`, lat: Number(a.latitude ?? a.lat), lng: Number(a.longitude ?? a.lng) })), zoom,
    ), [validActivities, zoom]);
    if (!map) return null;

    const useNativeClustering = validActivities.length > CLUSTER_THRESHOLD;

    return (
        <>
            {/* Marker posizione utente (sempre visibile): punto bianco con centro arancione e, se si cammina, il cono di direzione (NAV-3) */}
            {userLocation && (
                <AdvancedMarker
                    position={{ lat: userLocation.latitude || userLocation.lat, lng: userLocation.longitude || userLocation.lng }}
                    zIndex={9999}
                >
                    <div className="relative flex items-center justify-center pointer-events-none" data-testid="utente-marker">
                        {Number.isFinite(userHeading) && (
                            <svg data-testid="utente-cono" width="84" height="84" viewBox="-42 -42 84 84" className="absolute" style={{ transform: `rotate(${userHeading}deg)` }} aria-hidden="true">
                                <defs><radialGradient id="cono" cx="0" cy="0" r="40" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#F97316" stopOpacity="0.55" /><stop offset="1" stopColor="#F97316" stopOpacity="0" /></radialGradient></defs>
                                <path d="M0,0 L-17,-38 A42,42 0 0 1 17,-38 Z" fill="url(#cono)" />
                            </svg>
                        )}
                        <div className="absolute w-12 h-12 bg-brand-orange/25 rounded-full animate-ping" />
                        <div className="w-5 h-5 bg-white rounded-full shadow-[0_2px_10px_rgba(0,0,0,0.3)] flex items-center justify-center relative z-10">
                            <div className="w-3.5 h-3.5 bg-brand-orange rounded-full" />
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
                        offsetPx={spostamenti.get(act.id || `marker-${index}`) || null}
                    />
                ))
            )}

            {/* Percorso del tour */}
            {routePoints && routePoints.length > 1 && (
                <TourRoute
                    waypoints={routePoints}
                    travelModePreference={suggestedTransit}
                    onRouteStats={onRouteStats}
                    onDirectionsData={onDirectionsData}
                    progress={progress}
                    panoramica={panoramica}
                />
            )}
        </>
    );
};

export default function UnnivaiMap({
    activities = [],
    routePoints = [],
    // `mapMood` non e' piu' destrutturato: sceglieva il Map ID via MAP_MOODS, ma
    // tutti gli undici mood puntavano allo stesso ID. Continua ad arrivare dai
    // chiamanti (MapPage, Explore, DashboardUser) dentro `...props` e viene
    // scartato da GoogleMapContainer, che gia' lo elencava fra le PROPS TO STRIP.
    suggestedTransit,
    userLocation,
    onActivityClick,
    onRouteStats,
    onDirectionsData,
    progress = null,
    userHeading = null,
    ...props
}) {
    // nav-camera: nella mappa del giro, fuori dalla navigazione (panoramica) il tracciato e' arancione
    const panoramica = !!props.giroAttivo && !props.isNavigating;
    const validActivities = useMemo(() =>
        activities.filter(a => a && (a.latitude || a.lat) && (a.longitude || a.lng)),
    [activities]);

    // Nessun `mapId` passato: la sorgente unica e' MAP_ID in GoogleMapContainer.
    return (
        <GoogleMapContainer activities={activities} routePoints={routePoints} {...props}>
            <MarkersAndRoute
                validActivities={validActivities}
                routePoints={routePoints}
                suggestedTransit={suggestedTransit}
                userLocation={userLocation}
                onActivityClick={onActivityClick}
                onRouteStats={onRouteStats}
                onDirectionsData={onDirectionsData}
                progress={progress}
                userHeading={userHeading}
                panoramica={panoramica}
            />
        </GoogleMapContainer>
    );
}
