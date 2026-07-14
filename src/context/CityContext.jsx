import React, { createContext, useState, useContext, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { userContextService } from '../services/userContextService';
// Gate X.2 + Y.3: costante GPS + helper IP fallback condivisi.
// Un solo comportamento su entrambi i path (mount + user gesture).
import { GPS_POSITION_OPTIONS, fetchIpLocation } from '../hooks/useEnhancedGeolocation';

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

    // Helper interno: dato lat/lng + nome citta' precomputato (o null),
    // aggiorna stato + persiste in localStorage + chiama onSuccess.
    // Estratto per riuso: percorso GPS + reverse geocode e percorso IP
    // fallback finiscono qui, un solo posto che aggiorna lo stato.
    const applyLocationAndNotify = (lat, lng, cityName, onSuccess) => {
        const clean = cityName ? cityName.trim() : null;
        if (clean) setCity(clean);
        setGpsActive(true);
        setGpsCoords({ lat, lon: lng });
        if (clean) setIsManual(false);
        try {
            if (clean) localStorage.setItem(STORAGE_KEY, clean);
            localStorage.setItem(GPS_KEY, JSON.stringify({ lat, lon: lng, city: clean, ts: Date.now() }));
        } catch { /* localStorage pieno */ }
        onSuccess?.(clean, lat, lng);
    };

    // Chiamato SOLO da un onClick (user gesture — obbligatorio per iOS Safari).
    // Gate X.2: options unificate via GPS_POSITION_OPTIONS.
    // Gate Y.3: se getCurrentPosition fallisce (code 2/3), prova fetchIpLocation
    // come fa gia' il mount automatico. Se anche IP fallisce -> onError onesto.
    // Un solo comportamento su entrambi i path (mount + user gesture).
    const requestGPS = useCallback((onSuccess, onError) => {
        if (!navigator.geolocation) {
            // No GPS API -> prova subito IP.
            fetchIpLocation().then(loc => {
                if (loc) applyLocationAndNotify(loc.latitude, loc.longitude, loc.city, onSuccess);
                else onError?.("Il tuo browser non supporta la geolocalizzazione. Scegli la citta' dall'header.");
            });
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                // Gate X.3: timeout 6s su Nominatim reverse geocode.
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 6000);
                fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=it`, {
                    headers: { 'User-Agent': 'DoveVAI/1.0' },
                    signal: controller.signal,
                })
                    .then(r => { clearTimeout(timeoutId); return r.json(); })
                    .then(data => {
                        const gpsCity = data.address?.city || data.address?.town || data.address?.village || data.address?.municipality;
                        // Gate O.2: se il geocode non risolve nome citta', passa null (no 'Roma' fake).
                        applyLocationAndNotify(latitude, longitude, gpsCity || null, onSuccess);
                    })
                    .catch(() => {
                        clearTimeout(timeoutId);
                        // Geocoding fallito o timeout, ma GPS OK: teniamo le coord,
                        // manteniamo la city corrente (che l'utente potrebbe aver scelto a mano).
                        setGpsCoords({ lat: latitude, lon: longitude });
                        setGpsActive(true);
                        onSuccess?.(city, latitude, longitude);
                    });
            },
            async (error) => {
                // Gate Y.3: prima di dichiarare "posizione non disponibile",
                // proviamo il fallback IP. Code 1 (permesso negato) NON fa
                // retry: l'utente ha detto no, non insistiamo.
                if (error.code === 1) {
                    onError?.(gpsErrorMessage(1));
                    return;
                }
                const loc = await fetchIpLocation();
                if (loc) {
                    applyLocationAndNotify(loc.latitude, loc.longitude, loc.city, onSuccess);
                    return;
                }
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
