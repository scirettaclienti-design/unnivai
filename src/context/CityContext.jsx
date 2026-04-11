import React, { createContext, useState, useContext, useEffect } from 'react';

const CityContext = createContext();

const STORAGE_KEY = 'user_city';

export function CityProvider({ children }) {
    // DVAI-016: inizializza dalla localStorage per persistere tra sessioni
    const [city, setCity] = useState(() => {
        try {
            return localStorage.getItem(STORAGE_KEY) || 'Roma';
        } catch {
            return 'Roma';
        }
    });
    const [isManual, setIsManual] = useState(() => {
        try {
            return !!localStorage.getItem(STORAGE_KEY);
        } catch {
            return false;
        }
    });

    const updateCity = (newCity) => {
        if (!newCity || typeof newCity !== 'string') return;
        const clean = newCity.trim();
        if (!clean) return;
        setCity(clean);
        setIsManual(true);
        try {
            localStorage.setItem(STORAGE_KEY, clean);
        } catch {
            // ignora errori storage (modalità privata o quota exceeded)
        }
    };

    const resetToGPS = () => {
        setIsManual(false);
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch { /* ignora */ }
    };

    return (
        <CityContext.Provider value={{ city, setCity: updateCity, isManual, resetToGPS }}>
            {children}
        </CityContext.Provider>
    );
}

export function useCity() {
    return useContext(CityContext);
}
