import React, { createContext, useState, useContext, useEffect } from 'react';

const CityContext = createContext();

export function CityProvider({ children }) {
    const [city, setCity] = useState('Roma');
    const [isManual, setIsManual] = useState(false);

    const updateCity = (newCity) => {
        setCity(newCity);
        setIsManual(true);
    };

    const resetToGPS = () => {
        setIsManual(false);
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
