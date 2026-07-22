import React, { useEffect } from 'react';
import useTourRouting from '../../hooks/useTourRouting';

export default function TourRoute({ waypoints, travelModePreference, onRouteStats }) {
    // L2-0: l'hook ora ritorna { routeInfo, directionsDataRef }. routeInfo identico;
    // directionsDataRef non consumato qui (sarà trasportato a MapPage in L2-1).
    const { routeInfo } = useTourRouting(waypoints, travelModePreference);

    useEffect(() => {
        if (onRouteStats && (routeInfo.distanceM > 0 || routeInfo.error)) {
            onRouteStats(routeInfo);
        }
    }, [routeInfo, onRouteStats]);

    return null; // This component handles side effects (drawing logic) on the map instance
}
