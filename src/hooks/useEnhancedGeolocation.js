/**
 * DVAI-032 — Rimossi saveLocationToBackend() e getNearbyData():
 * puntavano a endpoint inesistenti (/api/location/save, /api/location/nearby)
 * causando 404 silenziosi ad ogni mount del componente.
 *
 * Gate X — PositionOptions ottimizzate per app tourism-mobile (locked Ivano):
 * L'utente e' in hotel, vicolo, bar. Non chiediamo satellite (indoor fallisce
 * sempre) e accettiamo posizione recente (5 min). La precisione che serve e'
 * "in che citta' sei", non "su quale lato del marciapiede". Costante
 * esportata per unificare l'unico secondo path (CityContext.requestGPS).
 */
import { useState, useEffect } from 'react';

// Gate X.1 + X.2: unica costante condivisa da tutti i path GPS del client.
// Prima erano due configurazioni diverse (useEnhancedGeolocation aveva
// enableHighAccuracy:true + maximumAge:0; CityContext aveva
// enableHighAccuracy:true + maximumAge:300000). Due path che leggono lo
// stesso GPS con opzioni diverse e' un bug in attesa.
export const GPS_POSITION_OPTIONS = Object.freeze({
    enableHighAccuracy: false,          // WiFi/cella OK — satellite non serve per "in che citta' sei"
    timeout: 8000,                      // 8s: piu' del network round-trip, meno di "eternita'"
    maximumAge: 5 * 60 * 1000,          // 5min cache: se hai gia' un fix recente, usalo
});

// Gate Y.3: helper condiviso per il fallback IP. Prima solo il mount automatico
// lo usava; il banner user-gesture (CityContext.requestGPS) no — cioe' il path
// che l'utente USA attivamente non aveva il fallback che l'auto-mount aveva.
// Ora entrambi possono chiamarlo. Timeout 4s (stessa scelta X.3).
//
// @returns {Promise<null | { latitude, longitude, city, country }>}
export async function fetchIpLocation() {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    try {
        const res = await fetch('https://ipapi.co/json/', { signal: controller.signal });
        clearTimeout(timeoutId);
        const data = await res.json();
        if (data?.latitude && data?.longitude && data?.city) {
            return {
                latitude: data.latitude,
                longitude: data.longitude,
                city: data.city,
                country: data.country_name || 'Italia',
            };
        }
        return null;
    } catch {
        clearTimeout(timeoutId);
        return null;
    }
}

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
            ...GPS_POSITION_OPTIONS,
            ...options,
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
        // Gate Y.3: usa l'helper condiviso fetchIpLocation (export sopra).
        const loc = await fetchIpLocation();
        if (loc) {
            setState({
                location: loc,
                loading: false,
                error: null,
                nearbyData: [],
                savedToDatabase: false
            });
            return;
        }
        markLocationUnavailable();
    };

    // Gate O.2: quando GPS + IP fallback falliscono entrambi, location resta null.
    // Il consumer (useUserContext) sa che deve chiedere all'utente manualmente
    // via CityModal, invece di mostrargli Roma come se fosse la sua posizione.
    const markLocationUnavailable = () => {
        setState({
            location: null,
            loading: false,
            error: 'geo_unavailable',
            nearbyData: [],
            savedToDatabase: false
        });
    };

    const reverseGeocode = async (lat, lon) => {
        // Gate X.3: timeout 6s per ogni tentativo. Google Maps geocode direct
        // + fallback Nominatim erano senza timeout — se pendevano, la catena
        // "GPS -> nome citta'" si spezzava senza feedback.
        try {
            const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
            if (MAPS_KEY) {
                const gCtrl = new AbortController();
                const gTid = setTimeout(() => gCtrl.abort(), 6000);
                try {
                    const res = await fetch(
                        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&key=${MAPS_KEY}&result_type=locality|administrative_area_level_3`,
                        { signal: gCtrl.signal }
                    );
                    clearTimeout(gTid);
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
                    clearTimeout(gTid);
                    // fallback a Nominatim
                }
            }

            const nCtrl = new AbortController();
            const nTid = setTimeout(() => nCtrl.abort(), 6000);
            try {
                const response = await fetch(
                    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&accept-language=it&addressdetails=1`,
                    { signal: nCtrl.signal }
                );
                clearTimeout(nTid);
                if (!response.ok) throw new Error('Geocoding failed');
                const data = await response.json();
                // Gate O.2: nessun fallback Roma. Se nessun campo topografico e' presente,
                // ritorno city:null → il consumer sa che il nome citta' non e' risolto.
                const city = data.address?.city || data.address?.town || data.address?.village ||
                    data.address?.municipality || data.address?.county || null;
                return { city, country: data.address?.country || 'Italia' };
            } catch {
                clearTimeout(nTid);
                throw new Error('Nominatim geocoding failed');
            }
        } catch {
            return { city: null, country: 'Italia' };
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
