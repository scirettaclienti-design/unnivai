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
    // L2-0: dati Directions completi (tutti i legs, maneuver, path) per le fasi L2.
    // ⚠️ NON è il canale di trasporto verso MapPage: questo ref vive dentro l'hook
    // (catena MapPage → UnnivaiMap → TourRoute → useTourRouting) e NON è raggiungibile
    // dal watchPosition di MapPage. Il trasporto (callback stile onRouteStats → ref
    // di MapPage) è L2-1. Qui il ref è solo la sorgente pronta per quel callback.
    const directionsDataRef = useRef({ steps: [], overviewPath: [] });

    // Initialize Services
    useEffect(() => {
        if (!routesLibrary || !map) return;
        setDirectionsService(new routesLibrary.DirectionsService());

        // DVAI-065 Fix 1a — preserveViewport: true CRITICO.
        // Il default Google `preserveViewport: false` fa sì che ogni chiamata
        // a setDirections() esegua map.fitBounds() sui waypoint AUTOMATICAMENTE.
        // Durante nav, con waypoints che cambiano a ogni tick GPS (perché
        // includevano la posizione utente), questo era il vero writer del
        // "gioco dello zoom": camera zoom-out sul percorso, poi watchPosition
        // moveCamera zoom-in su utente, ripeti. Con preserveViewport la
        // polyline continua a essere disegnata correttamente, ma la camera
        // non viene toccata dal renderer. Un solo owner camera durante nav.
        const style = ROUTE_STYLES.WALKING;
        setDirectionsRendererOutline(new routesLibrary.DirectionsRenderer({
            map, suppressMarkers: true, preserveViewport: true, polylineOptions: style.outer
        }));
        setDirectionsRendererInner(new routesLibrary.DirectionsRenderer({
            map, suppressMarkers: true, preserveViewport: true, polylineOptions: style.inner
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
                response.routes[0]?.legs?.forEach(leg => {
                    totalDistM += leg?.distance?.value || 0;
                    totalDurSec += leg?.duration?.value || 0;
                });

                // Protezione NaN
                if (isNaN(totalDistM)) totalDistM = 0;
                if (isNaN(totalDurSec)) totalDurSec = 0;

                const steps = response.routes[0]?.legs?.[0]?.steps || [];
                setRouteInfo({ distanceM: totalDistM, durationSec: totalDurSec, mode: resolveMode(travelModePreference), steps });
                // L2-1 latest-wins (SCOPE MINIMO): guarda SOLO la data-path L2-1.
                // setDirections/setRouteInfo sopra NON toccati (race preesistente = gate
                // a sé nel backlog, regola #4). `signature` è il valore catturato da QUESTA
                // closure; se è partita una route diversa, lastRequestSignature.current è
                // avanzato → scarto il dato stale.
                if (signature === lastRequestSignature.current) {
                    directionsDataRef.current = extractDirectionsData(response);
                }
            } else {
                console.error('Directions failed:', status);
                setRouteInfo({ error: status, distanceM: 0, durationSec: 0 });
                if (signature === lastRequestSignature.current) {
                    directionsDataRef.current = { steps: [], overviewPath: [] };
                }
            }
        });
    }, [directionsService, directionsRendererOutline, directionsRendererInner, waypoints, routesLibrary, travelModePreference]);

    // L2-0: routeInfo INVARIATO (consumato da TourRoute → onRouteStats). directionsDataRef
    // AGGIUNTO (non ancora consumato — sarà la sorgente del trasporto in L2-1).
    return { routeInfo, directionsDataRef };
}

// ─── L2-0: ESTRAZIONE DATI DIRECTIONS ─────────────────────────────────────────
// Funzione PURA: appiattisce gli step di TUTTI i legs (con legIndex) + overview_path,
// normalizzando ogni LatLng a { lat, lng } numerici (serializzabile, testabile).
// Difensiva ovunque: legs/steps/path assenti → array vuoto, dato mancante → null,
// input malformato → { steps: [], overviewPath: [] }. Nessun throw: non deve MAI
// poter rompere la route (regola #1: nessun valore inventato).
//
// ⚠️ VERITÀ SDK (da @types/google.maps): `path` e `overview_path` sono descritti
// come "approximate (smoothed) path". Sono BUONI per DISEGNO e SNAP-to-path, NON
// per odometria / misure metriche fini. Tenerlo presente in L2-2 (bicolore) e
// L2-3 (off-route). Per le distanze usare semmai step.distance.value (dato Google).
const normLatLng = (ll) => {
    if (!ll) return null;
    const lat = typeof ll.lat === 'function' ? ll.lat() : ll.lat;
    const lng = typeof ll.lng === 'function' ? ll.lng() : ll.lng;
    if (typeof lat !== 'number' || typeof lng !== 'number' || Number.isNaN(lat) || Number.isNaN(lng)) return null;
    return { lat, lng };
};

export function extractDirectionsData(response) {
    const empty = { steps: [], overviewPath: [] };
    try {
        const route = response?.routes?.[0];
        if (!route) return empty;
        const legs = Array.isArray(route.legs) ? route.legs : [];
        const steps = [];
        legs.forEach((leg, legIndex) => {
            const legSteps = Array.isArray(leg?.steps) ? leg.steps : [];
            legSteps.forEach((s) => {
                if (!s) return;
                // path canonico; lat_lngs (deprecato) come fallback difensivo.
                const rawPath = Array.isArray(s.path) ? s.path : (Array.isArray(s.lat_lngs) ? s.lat_lngs : []);
                steps.push({
                    legIndex,
                    maneuver: typeof s.maneuver === 'string' ? s.maneuver : null,
                    instructions: typeof s.instructions === 'string' ? s.instructions : null,
                    distanceM: typeof s.distance?.value === 'number' ? s.distance.value : null,
                    durationSec: typeof s.duration?.value === 'number' ? s.duration.value : null,
                    startLatLng: normLatLng(s.start_location),
                    endLatLng: normLatLng(s.end_location),
                    path: rawPath.map(normLatLng).filter(Boolean),
                });
            });
        });
        const overviewPath = (Array.isArray(route.overview_path) ? route.overview_path : []).map(normLatLng).filter(Boolean);
        return { steps, overviewPath };
    } catch {
        return empty;
    }
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
