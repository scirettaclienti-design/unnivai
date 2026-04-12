/**
 * DVAI-032 — Rimossi saveLocationToBackend() e getNearbyData():
 * puntavano a endpoint inesistenti (/api/location/save, /api/location/nearby)
 * causando 404 silenziosi ad ogni mount del componente.
 */
import { useState, useEffect } from 'react';

export function useEnhancedGeolocation(options = {}) {
    const [state, setState] = useState({
        location: null,
        loading: false,
        error: null,
        nearbyData: null,
        savedToDatabase: false
    });

    const getCurrentLocationWithBackend = async () => {
        if (!navigator.geolocation) {
            triggerIpFallback();
            return;
        }

        setState(prev => ({ ...prev, loading: true, error: null }));

        const defaultOptions = {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0,
            ...options
        };

        try {
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, defaultOptions);
            });

            const { latitude, longitude } = position.coords;

            if (latitude && longitude && !isNaN(latitude) && !isNaN(longitude) &&
                Math.abs(latitude) > 0.001 && Math.abs(longitude) > 0.001) {

                const cityData = await reverseGeocode(latitude, longitude);

                setState({
                    location: {
                        latitude,
                        longitude,
                        city: cityData.city,
                        country: cityData.country
                    },
                    loading: false,
                    error: null,
                    nearbyData: [],
                    savedToDatabase: false
                });
            } else {
                throw new Error('Coordinate GPS non valide');
            }
        } catch {
            triggerIpFallback();
        }
    };

    const triggerIpFallback = async () => {
        try {
            const res = await fetch('https://ipapi.co/json/');
            const data = await res.json();
            if (data?.latitude && data?.longitude && data?.city) {
                setState({
                    location: {
                        latitude: data.latitude,
                        longitude: data.longitude,
                        city: data.city,
                        country: data.country_name || 'Italia'
                    },
                    loading: false,
                    error: null,
                    nearbyData: [],
                    savedToDatabase: false
                });
                return;
            }
        } catch {
            // IP fallback non disponibile
        }
        setSimulatedLocation();
    };

    const setSimulatedLocation = () => {
        setState({
            location: {
                latitude: 41.9028,
                longitude: 12.4964,
                city: 'Roma',
                country: 'Italia'
            },
            loading: false,
            error: null,
            nearbyData: [],
            savedToDatabase: false
        });
    };

    const reverseGeocode = async (lat, lon) => {
        try {
            const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
            if (MAPS_KEY) {
                try {
                    const res = await fetch(
                        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&key=${MAPS_KEY}&result_type=locality|administrative_area_level_3`
                    );
                    const data = await res.json();
                    if (data.status === 'OK' && data.results.length > 0) {
                        let city = '';
                        let country = 'Italia';
                        data.results[0].address_components.forEach(c => {
                            if ((c.types.includes('locality') || c.types.includes('administrative_area_level_3')) && !city) {
                                city = c.long_name;
                            }
                            if (c.types.includes('country')) country = c.long_name;
                        });
                        if (city) return { city, country };
                    }
                } catch {
                    // fallback a Nominatim
                }
            }

            const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&accept-language=it&addressdetails=1`
            );
            if (!response.ok) throw new Error('Geocoding failed');
            const data = await response.json();
            const city = data.address?.city || data.address?.town || data.address?.village ||
                data.address?.municipality || data.address?.county || 'Roma';
            return { city, country: data.address?.country || 'Italia' };
        } catch {
            return { city: 'Roma', country: 'Italia' };
        }
    };

    useEffect(() => {
        getCurrentLocationWithBackend();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return {
        ...state,
        getCurrentLocation: getCurrentLocationWithBackend,
        isSupported: !!navigator.geolocation,
        hasPermission: !!state.location && !state.error?.includes('simulata')
    };
}
