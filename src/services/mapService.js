import { dataService } from './dataService';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

class MapService {
    /**
     * Get route geometry from Mapbox for given steps
     * @param {Array} steps - Array of objects with {lat, lng} properties
     * @returns {Object} GeoJSON LineString geometry and duration/distance
     */
    async getRoute(steps) {
        if (!steps || steps.length < 2) return null;

        // Mapbox expects lng,lat
        const coordinates = steps.map(s => `${s.lng},${s.lat}`).join(';');
        const url = `https://api.mapbox.com/directions/v5/mapbox/walking/${coordinates}?geometries=geojson&access_token=${MAPBOX_TOKEN}`;

        try {
            const response = await fetch(url);
            const data = await response.json();

            if (!data.routes || data.routes.length === 0) {
                console.error('No route found');
                return null;
            }

            const route = data.routes[0];
            return {
                geometry: route.geometry, // GeoJSON LineString
                duration: route.duration,
                distance: route.distance
            };
        } catch (error) {
            console.error('Mapbox API error:', error);
            return null;
        }
    }

    /**
     * Fetch activities near the route path (within 500m)
     * @param {Object} routeGeometry - GeoJSON LineString geometry
     * @param {String} city - City name to optimize initial fetch
     */
    async fetchNearbyActivities(routeGeometry, city) {
        let coordinates = [];

        // Handle GeoJSON vs WKT
        if (routeGeometry && routeGeometry.coordinates) {
            coordinates = routeGeometry.coordinates;
        } else if (typeof routeGeometry === 'string' && routeGeometry.startsWith('LINESTRING')) {
            // Parse WKT: LINESTRING(lng lat, lng lat, ...)
            const raw = routeGeometry.replace('LINESTRING(', '').replace(')', '');
            coordinates = raw.split(',').map(pair => {
                const [lng, lat] = pair.trim().split(/\s+/).map(Number);
                return [lng, lat];
            });
        }

        if (!coordinates || coordinates.length === 0) return [];

        // 1. Get all activities in city
        const allActivities = await dataService.getActivitiesByCity(city);
        if (!allActivities) return [];

        // 2. Filter by distance to route
        const THRESHOLD_METERS = 500;

        return allActivities.map(activity => {
            if (!activity.latitude || !activity.longitude) return null;

            // Check distance to vertices of the route
            let minDist = Infinity;
            for (const [rLng, rLat] of coordinates) {
                const dist = this.getDistanceFromLatLonInMeters(
                    activity.latitude, activity.longitude,
                    rLat, rLng
                );
                if (dist < minDist) minDist = dist;
            }

            if (minDist <= THRESHOLD_METERS) {
                return { ...activity, dist_meters: minDist };
            }
            return null;
        }).filter(item => item !== null).sort((a, b) => a.dist_meters - b.dist_meters);
    }

    /**
     * Get activities filtered by vibe tags matching tour tags
     */
    async getRelevantActivities(tourTags, routeGeometry, city) {
        if (!routeGeometry || !city) return [];

        // 1. Get raw nearby activities (already filtered by distance)
        const nearby = await this.fetchNearbyActivities(routeGeometry, city);
        if (!nearby || nearby.length === 0) return [];
        if (!tourTags || tourTags.length === 0) return nearby; // No filter

        // 2. Score by Tag Overlap
        // We look for any intersection between tourTags and activity.tags
        // or activity.category matching a tour tag
        return nearby.filter(activity => {
            const activityTags = [...(activity.tags || []), activity.category].map(t => t?.toLowerCase());
            const normalizedTourTags = tourTags.map(t => t.toLowerCase());

            // Check for at least one match
            const hasMatch = normalizedTourTags.some(t => activityTags.includes(t));
            return hasMatch;
        });
    }

    getDistanceFromLatLonInMeters(lat1, lon1, lat2, lon2) {
        const R = 6371e3; // metres
        const q1 = lat1 * Math.PI / 180;
        const q2 = lat2 * Math.PI / 180;
        const dq = (lat2 - lat1) * Math.PI / 180;
        const dl = (lon2 - lon1) * Math.PI / 180;

        const a = Math.sin(dq / 2) * Math.sin(dq / 2) +
            Math.cos(q1) * Math.cos(q2) *
            Math.sin(dl / 2) * Math.sin(dl / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c;
    }
}

export const mapService = new MapService();
