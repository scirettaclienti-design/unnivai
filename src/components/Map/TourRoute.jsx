import React, { useEffect } from 'react';
import useTourRouting from '../../hooks/useTourRouting';

export default function TourRoute({ waypoints, travelModePreference, onRouteStats }) {
    const routeInfo = useTourRouting(waypoints, travelModePreference);

    useEffect(() => {
        if (onRouteStats && (routeInfo.distanceM > 0 || routeInfo.error)) {
            onRouteStats(routeInfo);
        }
    }, [routeInfo, onRouteStats]);

    return null; // This component handles side effects (drawing logic) on the map instance
}
