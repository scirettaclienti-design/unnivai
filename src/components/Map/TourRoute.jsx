import React, { useEffect } from 'react';
import useTourRouting from '../../hooks/useTourRouting';

export default function TourRoute({ waypoints, travelModePreference, onRouteStats, onDirectionsData }) {
    const { routeInfo, directionsDataRef } = useTourRouting(waypoints, travelModePreference);

    useEffect(() => {
        if (routeInfo.distanceM > 0 || routeInfo.error) {
            if (onRouteStats) onRouteStats(routeInfo);
            // L2-1: forward dei dati Directions completi. directionsDataRef.current è
            // sempre l'ultimo (latest-wins alla sorgente): mai stale a valle.
            if (onDirectionsData) onDirectionsData(directionsDataRef.current);
        }
    }, [routeInfo, onRouteStats, onDirectionsData, directionsDataRef]); // ref stabile: non ri-triggera

    return null; // This component handles side effects (drawing logic) on the map instance
}
