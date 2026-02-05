export const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
};

export const isLocationOnRoute = (activity, routePoints, maxDistance = 500) => {
    if (!routePoints || routePoints.length === 0) return true; // No route? Show all (or none, depending on policy)

    // Check distance to any point in the route (simplified "buffer" check)
    // For a real line-string, we'd project to segment, but for walking tours points are usually dense enough.
    return routePoints.some(point => {
        const dist = calculateDistance(activity.latitude, activity.longitude, point.latitude, point.longitude);
        return dist <= maxDistance;
    });
};

export const isRelevantToUser = (activity, userPreferences) => {
    // Placeholder: Filter by category if user has preferred categories
    if (!userPreferences || !userPreferences.interests) return true;
    return userPreferences.interests.includes(activity.category);
};
