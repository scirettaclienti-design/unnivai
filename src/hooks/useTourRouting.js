import { useState, useEffect, useRef, useMemo } from 'react';
import { useMapsLibrary, useMap } from '@vis.gl/react-google-maps';
import { THEME } from '../styles/themeTokens';

// Stili polyline per mezzo di trasporto — Design System Ossidiana
const ROUTE_STYLES = {
    WALKING: {
        outer: { strokeColor: THEME.raw.routeStroke, strokeWeight: 10, strokeOpacity: 0.2, zIndex: 40 },
        inner: { strokeColor: THEME.raw.routeStroke, strokeWeight: 4, strokeOpacity: 0.9, zIndex: 50,
                 icons: [{ icon: { path: 'M 0,-0.5 0,0.5', strokeOpacity: 1, scale: 3 }, offset: '0', repeat: '12px' }] },
    },
    BICYCLING: {
        outer: { strokeColor: THEME.raw.routeStroke, strokeWeight: 10, strokeOpacity: 0.2, zIndex: 40 },
        inner: { strokeColor: THEME.raw.routeStroke, strokeWeight: 4, strokeOpacity: 0.9, zIndex: 50,
                 icons: [{ icon: { path: 'M 0,-0.5 0,0.5', strokeOpacity: 1, scale: 3 }, offset: '0', repeat: '16px' }] },
    },
    DRIVING: {
        outer: { strokeColor: THEME.raw.routeStroke, strokeWeight: 14, strokeOpacity: 0.25, zIndex: 40 },
        inner: { strokeColor: THEME.raw.routeStroke, strokeWeight: 6, strokeOpacity: 1.0, zIndex: 50 },
    },
    TRANSIT: {
        outer: { strokeColor: THEME.raw.routeStroke, strokeWeight: 12, strokeOpacity: 0.2, zIndex: 40 },
        inner: { strokeColor: THEME.raw.routeStroke, strokeWeight: 5, strokeOpacity: 0.9, zIndex: 50 },
    },
};

/**
 * NAV-2 — IL PERCORSO A TRATTI. Il percorso e' un tratto per ogni coppia di tappe consecutive (un «leg» di Directions):
 *  · `fatto`   — gia' camminato: attenuato;
 *  · `prossimo`— quello verso la prossima tappa: accento arancione, piu' spesso;
 *  · `resto`   — il resto: neutro (come prima).
 * Durante la navigazione il percorso richiesto a Directions e' quello delle tappe RIMASTE (serve alle distanze e alle manovre della barra):
 * non contiene i tratti gia' fatti ne' quello da dove sei partito. Quei tratti si disegnano dalla memoria dei percorsi gia' calcolati
 * (l'anteprima li ha calcolati tutti; quello che manca si chiede, uno, quando serve).
 * `progress` = { tappe: [{ lat, lng }] (il giro intero), nextIdx } (null fuori dalla navigazione: tutto neutro).
 */
export const statoTratto = (i, nextLeg) => {
    if (!Number.isInteger(nextLeg)) return 'resto';
    if (i < nextLeg) return 'fatto';
    if (i === nextLeg) return 'prossimo';
    return 'resto';
};
export const ACCENTO_TRATTO = '#F97316';
export const stileTratto = (stato, base) => {
    if (stato === 'fatto') return { outer: null, inner: { ...base.inner, strokeOpacity: 0.28, strokeWeight: 3, icons: undefined, zIndex: 45 } };
    if (stato === 'prossimo') {
        return {
            outer: { ...base.outer, strokeColor: ACCENTO_TRATTO, strokeOpacity: 0.3, strokeWeight: 12, zIndex: 41 },
            inner: { ...base.inner, strokeColor: ACCENTO_TRATTO, strokeOpacity: 1, strokeWeight: 6, icons: undefined, zIndex: 55 },
        };
    }
    return { outer: base.outer, inner: base.inner };
};
/** La chiave di un tratto: da una tappa a un'altra (le coordinate a 5 decimali, ~1 m). */
export const chiaveTratto = (a, b) => `${Number(a?.lat ?? a?.latitude).toFixed(5)},${Number(a?.lng ?? a?.longitude).toFixed(5)}>${Number(b?.lat ?? b?.latitude).toFixed(5)},${Number(b?.lng ?? b?.longitude).toFixed(5)}`;
/**
 * Cosa disegnare: i tratti fatti (prima), quello verso la prossima tappa, poi il resto del percorso richiesto.
 * @param {{ live: Array<Array>, progress: { tappe: Array, nextIdx: number }|null, cache: Map<string, Array> }} p
 * @returns {Array<{ path: Array, stato: 'fatto'|'prossimo'|'resto' }>}
 */
export function trattiDaDisegnare({ live = [], progress = null, cache = new Map() }) {
    const out = [];
    if (progress && Array.isArray(progress.tappe) && Number.isInteger(progress.nextIdx)) {
        for (let k = 0; k < progress.nextIdx && k + 1 < progress.tappe.length; k++) {
            const path = cache.get(chiaveTratto(progress.tappe[k], progress.tappe[k + 1]));
            if (path?.length > 1) out.push({ path, stato: k + 1 < progress.nextIdx ? 'fatto' : 'prossimo' });
        }
    }
    for (const path of live) if (path?.length > 1) out.push({ path, stato: 'resto' });
    return out;
}

/** La firma di un percorso: i suoi waypoint validi e il mezzo (la stessa che evita di richiedere due volte la stessa rotta). */
export const firmaPercorso = (waypoints, travelModePreference) => (Array.isArray(waypoints) ? waypoints : [])
    .filter(wp => { const lat = Number(wp?.lat || wp?.latitude); const lng = Number(wp?.lng || wp?.longitude); return !!lat && !!lng && !isNaN(lat) && !isNaN(lng); })
    .map(wp => `${wp.lat || wp.latitude},${wp.lng || wp.longitude}`).join('|') + `_${travelModePreference}`;

export default function useTourRouting(waypoints, travelModePreference, progress = null) {
    const map = useMap();
    const routesLibrary = useMapsLibrary('routes');

    const [directionsService, setDirectionsService] = useState(null);
    const [directionsRendererOutline, setDirectionsRendererOutline] = useState(null);
    const [directionsRendererInner, setDirectionsRendererInner] = useState(null);
    const [routeInfo, setRouteInfo] = useState({ distanceM: 0, durationSec: 0, mode: 'WALKING' });
    // NAV-2: i punti di ogni tratto (un tratto per coppia di tappe) per disegnarli col loro stato. Valgono solo per la firma del percorso
    // che li ha prodotti: se i waypoint cambiano o spariscono, i tratti di prima non si disegnano piu' (nessun setState nell'effetto).
    const [risultato, setRisultato] = useState({ firma: '', tratti: [], modo: 'WALKING' });
    const firmaCorrente = useMemo(() => firmaPercorso(waypoints, travelModePreference), [waypoints, travelModePreference]);
    const tratti = useMemo(() => (risultato.firma === firmaCorrente ? risultato.tratti : []), [risultato, firmaCorrente]);
    const modo = risultato.modo;
    // i percorsi gia' calcolati, tappa -> tappa (restano anche quando il percorso richiesto si accorcia); `versione` fa ridisegnare quando se ne aggiunge uno
    const cacheTratti = useRef(new Map());
    const inVolo = useRef(new Set());
    const [versione, setVersione] = useState(0);
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
            map, suppressMarkers: true, preserveViewport: true, polylineOptions: { ...style.outer, visible: false }
        }));
        setDirectionsRendererInner(new routesLibrary.DirectionsRenderer({
            map, suppressMarkers: true, preserveViewport: true, polylineOptions: { ...style.inner, visible: false }
        }));
    }, [routesLibrary, map]);

    // Aggiorna stile polyline quando cambia il mezzo
    useEffect(() => {
        if (!directionsRendererOutline || !directionsRendererInner) return;
        const mode = resolveMode(travelModePreference);
        if (mode === currentModeRef.current) return;
        currentModeRef.current = mode;

        const style = ROUTE_STYLES[mode] || ROUTE_STYLES.WALKING;
        directionsRendererOutline.setOptions({ polylineOptions: { ...style.outer, visible: false } });
        directionsRendererInner.setOptions({ polylineOptions: { ...style.inner, visible: false } });
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

        const signature = firmaPercorso(waypoints, travelModePreference);
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
                (response.routes[0]?.legs || []).forEach((leg, li) => {
                    const a = validWaypoints[li], b = validWaypoints[li + 1];
                    if (a && b) cacheTratti.current.set(chiaveTratto(a, b), (leg?.steps || []).flatMap(st => (Array.isArray(st?.path) ? st.path : [])));
                });
                setRisultato({ firma: signature, modo: resolveMode(travelModePreference), tratti: (response.routes[0]?.legs || []).map(leg => (leg?.steps || []).flatMap(st => (Array.isArray(st?.path) ? st.path : []))) });
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

    // NAV-2 — il tratto verso la prossima tappa, se non l'abbiamo gia' (navigazione ripresa dopo una ricarica: l'anteprima non c'e' stata): se ne chiede UNO
    useEffect(() => {
        if (!directionsService || !routesLibrary || !progress || !Number.isInteger(progress.nextIdx) || progress.nextIdx < 1) return;
        const da = progress.tappe?.[progress.nextIdx - 1], a = progress.tappe?.[progress.nextIdx];
        if (!da || !a) return;
        const chiave = chiaveTratto(da, a);
        if (cacheTratti.current.has(chiave) || inVolo.current.has(chiave)) return;
        inVolo.current.add(chiave);
        const o = { lat: Number(da.lat ?? da.latitude), lng: Number(da.lng ?? da.longitude) };
        const d = { lat: Number(a.lat ?? a.latitude), lng: Number(a.lng ?? a.longitude) };
        directionsService.route({ origin: o, destination: d, travelMode: resolveTravelMode(routesLibrary, travelModePreference, o, d) }, (response, status) => {
            inVolo.current.delete(chiave);
            if (status !== 'OK' || !response?.routes?.[0]) return;
            cacheTratti.current.set(chiave, (response.routes[0].legs?.[0]?.steps || []).flatMap(st => (Array.isArray(st?.path) ? st.path : [])));
            setVersione(v => v + 1);
        });
    }, [directionsService, routesLibrary, progress, travelModePreference]);

    // NAV-2 — il percorso a tratti: fatto attenuato, verso la prossima tappa arancione, il resto neutro
    useEffect(() => {
        const Polyline = typeof window !== 'undefined' ? window.google?.maps?.Polyline : null;
        if (!map || !Polyline) return undefined;
        const lista = trattiDaDisegnare({ live: tratti, progress, cache: cacheTratti.current });
        if (lista.length === 0) return undefined;
        const base = ROUTE_STYLES[modo] || ROUTE_STYLES.WALKING;
        const create = [];
        for (const { path, stato } of lista) {
            const st = stileTratto(stato, base);
            if (st.outer) create.push(new Polyline({ ...st.outer, path, map, clickable: false }));
            create.push(new Polyline({ ...st.inner, path, map, clickable: false }));
        }
        return () => create.forEach(p => p.setMap(null));
    }, [map, tratti, modo, progress, versione]);

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
