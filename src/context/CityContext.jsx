import React, { createContext, useState, useContext, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { userContextService } from '../services/userContextService';

const CityContext = createContext();

const STORAGE_KEY = 'user_city';
const GPS_KEY = 'dvai_gps_data';

export function CityProvider({ children }) {
    // Inizializza da GPS salvato o localStorage.
    // Gate O.2: nessun 'Roma' hardcoded al boot. Se non c'e' scelta memorizzata
    // ne' cache GPS valida, city resta null → il consumer (useUserContext) sa
    // di essere in stato "senza citta'" e mostra skeleton / CTA scegli citta'.
    const [city, setCity] = useState(() => {
        try {
            const gps = JSON.parse(localStorage.getItem(GPS_KEY) || 'null');
            if (gps?.city && gps?.ts && (Date.now() - gps.ts < 3600000)) return gps.city; // <1 ora
            return localStorage.getItem(STORAGE_KEY) || null;
        } catch { return null; }
    });
    // isManual=true al boot se localStorage ha una città salvata e il GPS cached è scaduto/assente.
    // Senza, la priority 1 di getUserContext non vede la scelta manuale dopo un reload.
    const [isManual, setIsManual] = useState(() => {
        try {
            const gps = JSON.parse(localStorage.getItem(GPS_KEY) || 'null');
            const validGps = gps?.city && gps?.ts && (Date.now() - gps.ts < 3600000);
            const stored = localStorage.getItem(STORAGE_KEY);
            return !validGps && !!stored;
        } catch { return false; }
    });
    const { user } = useAuth();
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
        // Persisti la scelta manuale anche sul profilo Supabase (cross-device).
        // Fire-and-forget: il helper ha già il try/catch interno.
        if (user?.id) {
            userContextService.updateSupabaseProfileCity(user.id, clean);
        }
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
