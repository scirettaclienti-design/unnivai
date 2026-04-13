import React, { createContext, useState, useContext, useEffect, useRef, useCallback } from 'react';

const CityContext = createContext();

const STORAGE_KEY = 'user_city';
const GPS_GRANTED_KEY = 'dvai_gps_granted';
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse';

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
    const [city, setCity] = useState(() => {
        try { return localStorage.getItem(STORAGE_KEY) || 'Roma'; }
        catch { return 'Roma'; }
    });
    const [isManual, setIsManual] = useState(false);
    const [gpsResolved, setGpsResolved] = useState(false);
    const [gpsDenied, setGpsDenied] = useState(false);
    const [gpsPromptNeeded, setGpsPromptNeeded] = useState(false);
    const gpsAttempted = useRef(false);

    // Funzione riusabile per tentare il GPS
    const attemptGPS = useCallback(() => {
        if (!navigator.geolocation) {
            setGpsResolved(true);
            setGpsDenied(true);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                if (!latitude || !longitude || isNaN(latitude) || isNaN(longitude)) {
                    setGpsResolved(true);
                    return;
                }
                // Segna come granted per futuri mount
                try { localStorage.setItem(GPS_GRANTED_KEY, '1'); } catch {}
                setGpsPromptNeeded(false);

                const gpsCity = await reverseGeocodeCity(latitude, longitude);
                if (gpsCity && typeof gpsCity === 'string' && gpsCity.trim()) {
                    const clean = gpsCity.trim();
                    setCity(clean);
                    try { localStorage.setItem(STORAGE_KEY, clean); } catch {}
                }
                setGpsResolved(true);
                setGpsDenied(false);
            },
            (err) => {
                setGpsResolved(true);
                setGpsDenied(err.code === 1);
                setGpsPromptNeeded(false);
                try { localStorage.removeItem(GPS_GRANTED_KEY); } catch {}
            },
            { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
        );
    }, []);

    // Al mount: controlla se il permesso è già stato granted in passato
    useEffect(() => {
        if (gpsAttempted.current) return;
        gpsAttempted.current = true;

        if (!navigator.geolocation) {
            setGpsResolved(true);
            setGpsDenied(true);
            return;
        }

        // Check Permissions API (non disponibile ovunque — Safari la supporta parzialmente)
        const checkAndAttempt = async () => {
            try {
                if (navigator.permissions) {
                    const status = await navigator.permissions.query({ name: 'geolocation' });
                    if (status.state === 'granted') {
                        attemptGPS();
                        return;
                    }
                    if (status.state === 'denied') {
                        setGpsResolved(true);
                        setGpsDenied(true);
                        return;
                    }
                }
            } catch {}

            // Permesso non ancora deciso — su iOS serve user gesture
            // Se il permesso era stato dato in una sessione precedente, prova
            const wasGranted = localStorage.getItem(GPS_GRANTED_KEY);
            if (wasGranted) {
                attemptGPS();
            } else {
                // Mostra banner per richiedere il permesso con click
                setGpsPromptNeeded(true);
                setGpsResolved(true); // Non bloccare il rendering
            }
        };

        checkAndAttempt();
    }, [attemptGPS]);

    const updateCity = (newCity) => {
        if (!newCity || typeof newCity !== 'string') return;
        const clean = newCity.trim();
        if (!clean) return;
        setCity(clean);
        setIsManual(true);
        setGpsPromptNeeded(false);
        try { localStorage.setItem(STORAGE_KEY, clean); } catch {}
    };

    const resetToGPS = () => {
        setIsManual(false);
        setGpsDenied(false);
        gpsAttempted.current = false;
        try { localStorage.removeItem(STORAGE_KEY); } catch {}
        attemptGPS();
    };

    // requestGPS: chiamato da un onClick (user gesture) per triggherare il prompt iOS
    const requestGPS = useCallback(() => {
        setGpsPromptNeeded(false);
        attemptGPS();
    }, [attemptGPS]);

    return (
        <CityContext.Provider value={{
            city, setCity: updateCity, isManual, gpsResolved, gpsDenied,
            gpsPromptNeeded, requestGPS, resetToGPS
        }}>
            {children}
        </CityContext.Provider>
    );
}

export function useCity() {
    return useContext(CityContext);
}
