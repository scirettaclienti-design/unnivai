import { useState, useEffect, useRef } from 'react';
import { useMapsLibrary, useMap } from '@vis.gl/react-google-maps';

export default function useTourRouting(waypoints, travelModePreference) {
    const map = useMap();
    const routesLibrary = useMapsLibrary('routes');
    
    const [directionsService, setDirectionsService] = useState(null);
    const [directionsRendererOutline, setDirectionsRendererOutline] = useState(null);
    const [directionsRendererInner, setDirectionsRendererInner] = useState(null);
    const [routeInfo, setRouteInfo] = useState({ distanceM: 0, durationSec: 0, mode: 'WALKING' });

    const lastRequestSignature = useRef('');

    // Initialize Services
    useEffect(() => {
        if (!routesLibrary || !map) return;
        setDirectionsService(new routesLibrary.DirectionsService());
        
        // Outer Glow Layer
        setDirectionsRendererOutline(new routesLibrary.DirectionsRenderer({
            map,
            suppressMarkers: true, // We will use our MapMarker components instead
            polylineOptions: {
                strokeColor: '#F97316', // Orange Glow
                strokeWeight: 14,
                strokeOpacity: 0.3,
                zIndex: 40
            }
        }));
        
        // Inner Sharp Layer
        setDirectionsRendererInner(new routesLibrary.DirectionsRenderer({
            map,
            suppressMarkers: true,
            polylineOptions: {
                strokeColor: '#F97316', // Solid Orange
                strokeWeight: 6,
                strokeOpacity: 1.0,
                zIndex: 50
            }
        }));
    }, [routesLibrary, map]);

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
            if (directionsRendererOutline) directionsRendererOutline.setDirections(null);
            if (directionsRendererInner) directionsRendererInner.setDirections(null);
            return;
        }

        // Generate signature to avoid redundant calls at 60fps
        const signature = validWaypoints.map(wp => `${wp.lat || wp.latitude},${wp.lng || wp.longitude}`).join('|') + `_${travelModePreference}`;
        if (signature === lastRequestSignature.current) {
            return; // Already calculated
        }
        lastRequestSignature.current = signature;

        const origin = { lat: Number(validWaypoints[0].lat || validWaypoints[0].latitude), lng: Number(validWaypoints[0].lng || validWaypoints[0].longitude) };
        const destination = { lat: Number(validWaypoints[validWaypoints.length - 1].lat || validWaypoints[validWaypoints.length - 1].latitude), lng: Number(validWaypoints[validWaypoints.length - 1].lng || validWaypoints[validWaypoints.length - 1].longitude) };
        
        const stopovers = validWaypoints.slice(1, -1).map(wp => ({
            location: { lat: Number(wp.lat || wp.latitude), lng: Number(wp.lng || wp.longitude) },
            stopover: true
        }));

        // Default to WALKING.
        let travelMode = routesLibrary.TravelMode.WALKING;
        
        // Simple haversine estimate between start and end to guess mode
        const R = 6371e3; // metres
        const lat1 = origin.lat * Math.PI/180;
        const lat2 = destination.lat * Math.PI/180;
        const dLat = (destination.lat - origin.lat) * Math.PI/180;
        const dLng = (destination.lng - origin.lng) * Math.PI/180;

        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1) * Math.cos(lat2) *
                Math.sin(dLng/2) * Math.sin(dLng/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const estimatedDistanceM = R * c;

        // Apply preference from AI (TRANSIT, WALKING, DRIVING, usually bus/metro)
        if (travelModePreference) {
            const upPref = travelModePreference.toUpperCase();
            if (upPref.includes('TRANSIT') || upPref.includes('BUS') || upPref.includes('MEZZI') || upPref.includes('METRO')) {
                travelMode = routesLibrary.TravelMode.TRANSIT;
            } else if (upPref.includes('DRIVING') || upPref.includes('DRIVE') || upPref.includes('AUTO') || upPref.includes('CAR')) {
                travelMode = routesLibrary.TravelMode.DRIVING;
            } else if (upPref.includes('WALKING') || upPref.includes('WALK') || upPref.includes('PIEDI')) {
                travelMode = routesLibrary.TravelMode.WALKING;
            } else if (upPref.includes('BICYCLING') || upPref.includes('CYCLING') || upPref.includes('BICI') || upPref.includes('BIKE')) {
                travelMode = routesLibrary.TravelMode.BICYCLING;
            }
        } else if (estimatedDistanceM > 3500) {
            travelMode = routesLibrary.TravelMode.DRIVING;
        } else if (estimatedDistanceM > 1500) {
            travelMode = routesLibrary.TravelMode.TRANSIT;
        }

        const request = {
            origin,
            destination,
            waypoints: stopovers,
            travelMode,
            optimizeWaypoints: false
        };

        directionsService.route(request, (response, status) => {
            if (status === 'OK' && response) {
                directionsRendererOutline.setDirections(response);
                directionsRendererInner.setDirections(response);
                
                // Calculate total distance and duration from the legs
                let totalDistM = 0;
                let totalDurSec = 0;
                
                response.routes[0].legs.forEach(leg => {
                    totalDistM += leg.distance.value;
                    totalDurSec += leg.duration.value;
                });
                
                // Extract step-by-step turn instructions
                const steps = response.routes[0].legs[0]?.steps || [];
                
                // Determine exact string for internal state
                let internalMode = 'WALKING';
                if (travelMode === routesLibrary.TravelMode.TRANSIT) internalMode = 'TRANSIT';
                else if (travelMode === routesLibrary.TravelMode.DRIVING) internalMode = 'DRIVING';
                else if (travelMode === routesLibrary.TravelMode.BICYCLING) internalMode = 'BICYCLING';

                setRouteInfo({
                    distanceM: totalDistM,
                    durationSec: totalDurSec,
                    mode: internalMode,
                    steps: steps
                });
            } else {
                console.error('Directions request failed due to ' + status);
                setRouteInfo({ error: status });
            }
        });

        // Cleanup function for when waypoints change or unmounts
        return () => {
             // Avoid hard setDirections(null) here because react strict mode can cause flicker
        };

    }, [directionsService, directionsRendererOutline, directionsRendererInner, waypoints, routesLibrary, travelModePreference]);

    return routeInfo;
}
