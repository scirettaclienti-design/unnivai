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

    const toast = (msg) => {
        try { window.dispatchEvent(new CustomEvent('dvai:toast', { detail: { message: msg, type: 'info', duration: 4000 } })); } catch {}
    };

    // Funzione riusabile per tentare il GPS
    const attemptGPS = useCallback(() => {
        const hasGeo = !!navigator.geolocation;
        toast(`📍 GPS: ${hasGeo ? 'richiesta in corso...' : 'non disponibile'} (${typeof navigator.geolocation})`);

        if (!hasGeo) {
            setGpsResolved(true);
            setGpsDenied(true);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                toast(`✅ GPS trovato: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);

                if (!latitude || !longitude || isNaN(latitude) || isNaN(longitude)) {
                    setGpsResolved(true);
                    return;
                }
                try { localStorage.setItem(GPS_GRANTED_KEY, '1'); } catch {}
                setGpsPromptNeeded(false);

                const gpsCity = await reverseGeocodeCity(latitude, longitude);
                if (gpsCity && typeof gpsCity === 'string' && gpsCity.trim()) {
                    const clean = gpsCity.trim();
                    toast(`🏙️ Città rilevata: ${clean}`);
                    setCity(clean);
                    try { localStorage.setItem(STORAGE_KEY, clean); } catch {}
                }
                setGpsResolved(true);
                setGpsDenied(false);
            },
            (err) => {
                toast(`❌ GPS errore: code=${err.code} ${err.message}`);
                setGpsResolved(true);
                setGpsDenied(err.code === 1);
                setGpsPromptNeeded(err.code === 1);
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

        const checkAndAttempt = async () => {
            // Safari NON supporta navigator.permissions.query per geolocation
            // Il tentativo causa un TypeError che dobbiamo gestire
            let permState = 'unknown';
            try {
                if (navigator.permissions) {
                    const status = await navigator.permissions.query({ name: 'geolocation' });
                    permState = status.state;
                    toast(`🔐 Permesso GPS: ${permState}`);
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
            } catch (e) {
                toast(`⚠️ Permissions API: ${e.message || 'non supportata'}`);
            }

            // Permesso non ancora deciso — su iOS serve user gesture
            const wasGranted = localStorage.getItem(GPS_GRANTED_KEY);
            if (wasGranted) {
                toast('🔄 GPS: permesso precedente trovato, riprovo...');
                attemptGPS();
            } else {
                toast('👆 GPS: mostra banner — serve click per iOS');
                setGpsPromptNeeded(true);
                setGpsResolved(true);
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
