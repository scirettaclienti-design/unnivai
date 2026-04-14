import React, { createContext, useState, useContext, useCallback } from 'react';

const CityContext = createContext();

const STORAGE_KEY = 'user_city';
const GPS_KEY = 'dvai_gps_data';

export function CityProvider({ children }) {
    // Inizializza da GPS salvato o localStorage
    const [city, setCity] = useState(() => {
        try {
            const gps = JSON.parse(localStorage.getItem(GPS_KEY) || 'null');
            if (gps?.city && gps?.ts && (Date.now() - gps.ts < 3600000)) return gps.city; // <1 ora
            return localStorage.getItem(STORAGE_KEY) || 'Roma';
        } catch { return 'Roma'; }
    });
    const [isManual, setIsManual] = useState(false);
    const [gpsActive, setGpsActive] = useState(() => {
        try {
            const gps = JSON.parse(localStorage.getItem(GPS_KEY) || 'null');
            return !!(gps?.city && gps?.ts && (Date.now() - gps.ts < 3600000));
        } catch { return false; }
    });
    const [gpsCoords, setGpsCoords] = useState(() => {
        try {
            const gps = JSON.parse(localStorage.getItem(GPS_KEY) || 'null');
            if (gps?.lat && gps?.lon) return { lat: gps.lat, lon: gps.lon };
        } catch {} return null;
    });

    // Chiamato SOLO da un onClick (user gesture — obbligatorio per iOS Safari)
    const requestGPS = useCallback((onSuccess, onError) => {
        if (!navigator.geolocation) {
            onError?.('Geolocalizzazione non supportata dal browser');
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                // Reverse geocoding
                fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=it`, {
                    headers: { 'User-Agent': 'DoveVAI/1.0' }
                })
                    .then(r => r.json())
                    .then(data => {
                        const gpsCity = data.address?.city || data.address?.town || data.address?.village || data.address?.municipality;
                        if (gpsCity) {
                            const clean = gpsCity.trim();
                            setCity(clean);
                            setGpsActive(true);
                            setGpsCoords({ lat: latitude, lon: longitude });
                            setIsManual(false);
                            try {
                                localStorage.setItem(STORAGE_KEY, clean);
                                localStorage.setItem(GPS_KEY, JSON.stringify({ lat: latitude, lon: longitude, city: clean, ts: Date.now() }));
                            } catch {}
                            onSuccess?.(clean, latitude, longitude);
                        } else {
                            onSuccess?.('Roma', latitude, longitude); // Città non risolta ma coordinate OK
                        }
                    })
                    .catch(() => {
                        // Geocoding fallito ma GPS OK
                        setGpsCoords({ lat: latitude, lon: longitude });
                        setGpsActive(true);
                        onSuccess?.(city, latitude, longitude);
                    });
            },
            (error) => {
                onError?.(`GPS errore (${error.code}): ${error.message}`);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
        );
    }, [city]);

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
        setGpsActive(false);
        try { localStorage.removeItem(GPS_KEY); localStorage.removeItem(STORAGE_KEY); } catch {}
    };

    return (
        <CityContext.Provider value={{
            city, setCity: updateCity, isManual, gpsActive, gpsCoords,
            requestGPS, resetToGPS
        }}>
            {children}
        </CityContext.Provider>
    );
}

export function useCity() {
    return useContext(CityContext);
}
