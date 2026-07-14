import React, { createContext, useState, useContext, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { userContextService } from '../services/userContextService';
// Gate X.2: unica costante GPS condivisa. Un solo comportamento su entrambi
// i path (useEnhancedGeolocation al mount + requestGPS user gesture).
import { GPS_POSITION_OPTIONS } from '../hooks/useEnhancedGeolocation';

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

    // Gate W — Messaggi errore GPS in italiano, action-oriented.
    // Mai il messaggio nativo del browser ("Position update is unavailable"),
    // mai il codice numerico. Codici GeolocationPositionError:
    //   1 = PERMISSION_DENIED, 2 = POSITION_UNAVAILABLE, 3 = TIMEOUT
    const gpsErrorMessage = (code) => {
        if (code === 1) return "Non ho il permesso di usare la tua posizione. Attivalo nelle impostazioni, oppure scegli la citta' dall'header.";
        if (code === 2) return "Non riesco a leggere la tua posizione. Scegli la citta' dall'header.";
        if (code === 3) return "La posizione ci sta mettendo troppo. Scegli la citta' dall'header.";
        return "Non riesco a leggere la tua posizione. Scegli la citta' dall'header.";
    };

    // Chiamato SOLO da un onClick (user gesture — obbligatorio per iOS Safari).
    // Gate X.2: options unificate via GPS_POSITION_OPTIONS
    // (enableHighAccuracy:false + timeout:8s + maximumAge:5min).
    // Un solo comportamento su entrambi i path (mount + user gesture).
    const requestGPS = useCallback((onSuccess, onError) => {
        if (!navigator.geolocation) {
            onError?.("Il tuo browser non supporta la geolocalizzazione. Scegli la citta' dall'header.");
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                // Gate X.3: timeout 6s su Nominatim reverse geocode.
                // Prima nessun timeout -> se il servizio pendeva, il banner
                // GPS rimaneva in "Ricerca posizione..." senza uscita.
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 6000);
                fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=it`, {
                    headers: { 'User-Agent': 'DoveVAI/1.0' },
                    signal: controller.signal,
                })
                    .then(r => { clearTimeout(timeoutId); return r.json(); })
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
                            // Gate O.2: nessun fallback 'Roma'. Se non risolvo il nome citta',
                            // le coordinate sono comunque valide -> setto solo gpsCoords + gpsActive
                            // e comunico onSuccess con city=null.
                            setGpsCoords({ lat: latitude, lon: longitude });
                            setGpsActive(true);
                            onSuccess?.(null, latitude, longitude);
                        }
                    })
                    .catch(() => {
                        clearTimeout(timeoutId);
                        // Geocoding fallito o timeout, ma GPS OK
                        setGpsCoords({ lat: latitude, lon: longitude });
                        setGpsActive(true);
                        onSuccess?.(city, latitude, longitude);
                    });
            },
            (error) => {
                onError?.(gpsErrorMessage(error.code));
            },
            GPS_POSITION_OPTIONS,
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
