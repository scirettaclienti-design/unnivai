import React, { createContext, useState, useContext, useEffect, useRef } from 'react';

const CityContext = createContext();

const STORAGE_KEY = 'user_city';
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse';

/**
 * Reverse geocode coordinate GPS → nome città via Nominatim (OSM).
 * Ritorna null se fallisce.
 */
async function reverseGeocodeCity(lat, lon) {
    try {
        const res = await fetch(
            `${NOMINATIM_URL}?lat=${lat}&lon=${lon}&format=json&accept-language=it`,
            { headers: { 'User-Agent': 'DoveVAI/1.0' } }
        );
        if (!res.ok) return null;
        const data = await res.json();
        return data.address?.city
            || data.address?.town
            || data.address?.village
            || data.address?.municipality
            || null;
    } catch {
        return null;
    }
}

export function CityProvider({ children }) {
    // Inizializza da localStorage come fallback, poi il GPS sovrascriverà
    const [city, setCity] = useState(() => {
        try {
            return localStorage.getItem(STORAGE_KEY) || 'Roma';
        } catch {
            return 'Roma';
        }
    });
    const [isManual, setIsManual] = useState(false);
    const [gpsResolved, setGpsResolved] = useState(false);
    const gpsAttempted = useRef(false);

    // Al mount, chiedi SEMPRE la posizione GPS
    useEffect(() => {
        if (gpsAttempted.current) return;
        gpsAttempted.current = true;

        if (!navigator.geolocation) {
            setGpsResolved(true);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                if (!latitude || !longitude || isNaN(latitude) || isNaN(longitude)) {
                    setGpsResolved(true);
                    return;
                }
                const gpsCity = await reverseGeocodeCity(latitude, longitude);
                if (gpsCity && typeof gpsCity === 'string' && gpsCity.trim()) {
                    const clean = gpsCity.trim();
                    setCity(clean);
                    try { localStorage.setItem(STORAGE_KEY, clean); } catch {}
                }
                setGpsResolved(true);
            },
            () => {
                // GPS negato o errore — usa il fallback localStorage/Roma
                setGpsResolved(true);
            },
            { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
        );
    }, []);

    // Selezione manuale dell'utente (TopBar, onboarding)
    const updateCity = (newCity) => {
        if (!newCity || typeof newCity !== 'string') return;
        const clean = newCity.trim();
        if (!clean) return;
        setCity(clean);
        setIsManual(true);
        try { localStorage.setItem(STORAGE_KEY, clean); } catch {}
    };

    const resetToGPS = () => {
        setIsManual(false);
        gpsAttempted.current = false;
        try { localStorage.removeItem(STORAGE_KEY); } catch {}
    };

    return (
        <CityContext.Provider value={{ city, setCity: updateCity, isManual, gpsResolved, resetToGPS }}>
            {children}
        </CityContext.Provider>
    );
}

export function useCity() {
    return useContext(CityContext);
}
