import { useState, useEffect, useRef } from 'react';
import { useMapsLibrary, useMap } from '@vis.gl/react-google-maps';

// Stili polyline per mezzo di trasporto — Brand DoveVAI
const ROUTE_STYLES = {
    WALKING: {
        outer: { strokeColor: '#F97316', strokeWeight: 10, strokeOpacity: 0.2, zIndex: 40 },
        inner: { strokeColor: '#F97316', strokeWeight: 4, strokeOpacity: 0.9, zIndex: 50,
                 icons: [{ icon: { path: 'M 0,-0.5 0,0.5', strokeOpacity: 1, scale: 3 }, offset: '0', repeat: '12px' }] },
    },
    BICYCLING: {
        outer: { strokeColor: '#10B981', strokeWeight: 10, strokeOpacity: 0.2, zIndex: 40 },
        inner: { strokeColor: '#10B981', strokeWeight: 4, strokeOpacity: 0.9, zIndex: 50,
                 icons: [{ icon: { path: 'M 0,-0.5 0,0.5', strokeOpacity: 1, scale: 3 }, offset: '0', repeat: '16px' }] },
    },
    DRIVING: {
        outer: { strokeColor: '#C2703E', strokeWeight: 14, strokeOpacity: 0.25, zIndex: 40 },
        inner: { strokeColor: '#D4A843', strokeWeight: 6, strokeOpacity: 1.0, zIndex: 50 },
    },
    TRANSIT: {
        outer: { strokeColor: '#6366F1', strokeWeight: 12, strokeOpacity: 0.2, zIndex: 40 },
        inner: { strokeColor: '#6366F1', strokeWeight: 5, strokeOpacity: 0.9, zIndex: 50 },
    },
};

export default function useTourRouting(waypoints, travelModePreference) {
    const map = useMap();
    const routesLibrary = useMapsLibrary('routes');

    const [directionsService, setDirectionsService] = useState(null);
    const [directionsRendererOutline, setDirectionsRendererOutline] = useState(null);
    const [directionsRendererInner, setDirectionsRendererInner] = useState(null);
    const [routeInfo, setRouteInfo] = useState({ distanceM: 0, durationSec: 0, mode: 'WALKING' });
    const lastRequestSignature = useRef('');
    const currentModeRef = useRef('WALKING');

    // Initialize Services
    useEffect(() => {
        if (!routesLibrary || !map) return;
        setDirectionsService(new routesLibrary.DirectionsService());

        const style = ROUTE_STYLES.WALKING;
        setDirectionsRendererOutline(new routesLibrary.DirectionsRenderer({
            map, suppressMarkers: true, polylineOptions: style.outer
        }));
        setDirectionsRendererInner(new routesLibrary.DirectionsRenderer({
            map, suppressMarkers: true, polylineOptions: style.inner
        }));
    }, [routesLibrary, map]);

    // Aggiorna stile polyline quando cambia il mezzo
    useEffect(() => {
        if (!directionsRendererOutline || !directionsRendererInner) return;
        const mode = resolveMode(travelModePreference);
        if (mode === currentModeRef.current) return;
        currentModeRef.current = mode;

        const style = ROUTE_STYLES[mode] || ROUTE_STYLES.WALKING;
        directionsRendererOutline.setOptions({ polylineOptions: style.outer });
        directionsRendererInner.setOptions({ polylineOptions: style.inner });
    }, [travelModePreference, directionsRendererOutline, directionsRendererInner]);

    // Calculate Route
    useEffect(() => {
        if (!directionsService || !directionsRendererOutline || !directionsRendererInner || !waypoints) {
            if (directionsRendererOutline) directionsRendererOutline.setDirections(null);
            if (directionsRendererInner) directionsRendererInner.setDirections(null);
            return;
        }

        const validWaypoints = waypoints.filter(wp => {
            const lat = Number(wp.lat || wp.latitude);
            const lng = Number(wp.lng || wp.longitude);
            return !!lat && !!lng && !isNaN(lat) && !isNaN(lng);
        });

        if (validWaypoints.length < 2) {
            directionsRendererOutline.setDirections(null);
            directionsRendererInner.setDirections(null);
            return;
        }

        const signature = validWaypoints.map(wp => `${wp.lat || wp.latitude},${wp.lng || wp.longitude}`).join('|') + `_${travelModePreference}`;
        if (signature === lastRequestSignature.current) return;
        lastRequestSignature.current = signature;

        const origin = { lat: Number(validWaypoints[0].lat || validWaypoints[0].latitude), lng: Number(validWaypoints[0].lng || validWaypoints[0].longitude) };
        const destination = { lat: Number(validWaypoints[validWaypoints.length - 1].lat || validWaypoints[validWaypoints.length - 1].latitude), lng: Number(validWaypoints[validWaypoints.length - 1].lng || validWaypoints[validWaypoints.length - 1].longitude) };

        const stopovers = validWaypoints.slice(1, -1).map(wp => ({
            location: { lat: Number(wp.lat || wp.latitude), lng: Number(wp.lng || wp.longitude) },
            stopover: true
        }));

        const travelMode = resolveTravelMode(routesLibrary, travelModePreference, origin, destination);

        directionsService.route({
            origin, destination, waypoints: stopovers, travelMode, optimizeWaypoints: false
        }, (response, status) => {
            if (status === 'OK' && response) {
                directionsRendererOutline.setDirections(response);
                directionsRendererInner.setDirections(response);

                let totalDistM = 0, totalDurSec = 0;
                response.routes[0].legs.forEach(leg => {
                    totalDistM += leg.distance.value;
                    totalDurSec += leg.duration.value;
                });

                const steps = response.routes[0].legs[0]?.steps || [];
                setRouteInfo({ distanceM: totalDistM, durationSec: totalDurSec, mode: resolveMode(travelModePreference), steps });
            } else {
                console.error('Directions failed:', status);
                setRouteInfo({ error: status });
            }
        });
    }, [directionsService, directionsRendererOutline, directionsRendererInner, waypoints, routesLibrary, travelModePreference]);

    return routeInfo;
}

// Resolve mode string from preference
function resolveMode(pref) {
    if (!pref) return 'WALKING';
    const up = pref.toUpperCase();
    if (up.includes('TRANSIT') || up.includes('BUS') || up.includes('MEZZI') || up.includes('METRO')) return 'TRANSIT';
    if (up.includes('DRIVING') || up.includes('DRIVE') || up.includes('AUTO') || up.includes('CAR')) return 'DRIVING';
    if (up.includes('BICYCLING') || up.includes('BICI') || up.includes('BIKE')) return 'BICYCLING';
    return 'WALKING';
}

// Resolve Google Maps TravelMode enum
function resolveTravelMode(lib, pref, origin, destination) {
    const mode = resolveMode(pref);
    if (mode === 'TRANSIT') return lib.TravelMode.TRANSIT;
    if (mode === 'DRIVING') return lib.TravelMode.DRIVING;
    if (mode === 'BICYCLING') return lib.TravelMode.BICYCLING;

    // Auto-detect based on distance if no explicit preference
    if (!pref) {
        const d = Math.hypot((destination.lat - origin.lat) * 111320, (destination.lng - origin.lng) * 111320 * Math.cos(origin.lat * Math.PI / 180));
        if (d > 3500) return lib.TravelMode.DRIVING;
        if (d > 1500) return lib.TravelMode.TRANSIT;
    }
    return lib.TravelMode.WALKING;
}
