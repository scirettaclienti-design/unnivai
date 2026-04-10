import React, { useState, useEffect, useRef } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { Search, MapPin, Loader2 } from 'lucide-react';
import { useCity } from '../../context/CityContext';

export const CitySearchBar = ({ activeCity, onCitySelect }) => {
    const { setCity, resetToGPS } = useCity();
    const [inputValue, setInputValue] = useState('');
    const [predictions, setPredictions] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const inputRef = useRef(null);
    const containerRef = useRef(null);

    const placesLib = useMapsLibrary('places');
    const geocodingLib = useMapsLibrary('geocoding');
    
    // Services
    const autocompleteService = useRef(null);
    const geocoder = useRef(null);
    const sessionToken = useRef(null);

    useEffect(() => {
        if (!placesLib || !geocodingLib) return;
        autocompleteService.current = new placesLib.AutocompleteService();
        geocoder.current = new geocodingLib.Geocoder();
        sessionToken.current = new placesLib.AutocompleteSessionToken();
    }, [placesLib, geocodingLib]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const fetchPredictions = async (input) => {
        if (!autocompleteService.current || !input) {
            setPredictions([]);
            return;
        }

        try {
            const request = {
                input,
                sessionToken: sessionToken.current,
                types: ['(cities)'],
                // language: 'it' can be added if needed
            };
            const response = await autocompleteService.current.getPlacePredictions(request);
            setPredictions(response.predictions);
            setIsOpen(true);
        } catch (error) {
            console.error("Autocomplete error:", error);
            setPredictions([]);
        }
    };

    const handleInputChange = (e) => {
        const val = e.target.value;
        setInputValue(val);
        if (val.length > 2) {
            fetchPredictions(val);
        } else {
            setPredictions([]);
            setIsOpen(false);
        }
    };

    const handleSelectPrediction = async (prediction) => {
        setInputValue(prediction.description);
        setIsOpen(false);
        setIsLoading(true);

        if (!geocoder.current) return;

        try {
            const response = await geocoder.current.geocode({ placeId: prediction.place_id });
            if (response.results && response.results[0]) {
                const result = response.results[0];
                const lat = result.geometry.location.lat();
                const lng = result.geometry.location.lng();
                
                // Extract city name (locality) or just use the main text
                const cityMatch = result.address_components.find(c => c.types.includes('locality'))?.long_name;
                const finalCity = cityMatch || prediction.structured_formatting.main_text;

                // Update Context
                setCity(finalCity);
                
                // Trigger callback
                if (onCitySelect) {
                    onCitySelect({ city: finalCity, lat, lng });
                }
                
                // Refresh token for next search
                sessionToken.current = new placesLib.AutocompleteSessionToken();
            }
        } catch (error) {
            console.error("Geocoding error:", error);
        } finally {
            setIsLoading(false);
            setInputValue('');
        }
    };

    return (
        <div ref={containerRef} className="relative w-full">
            <div 
                className={`w-full bg-white/40 backdrop-blur-2xl rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.12)] p-2 pl-4 border border-white/60 flex items-center justify-between gap-3 group transition-all duration-300 focus-within:shadow-orange-500/20 focus-within:border-orange-300 ${isOpen ? 'rounded-b-none border-b-0' : ''}`}
            >
                <div className="flex flex-col items-start gap-0.5 ml-2 cursor-pointer" onClick={() => {
                    // Quick center on actual activeCity if clicked
                    if (onCitySelect) onCitySelect({ city: activeCity, bounce: true });
                }}>
                    <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest leading-none">Posizione Attuale</span>
                    <span className="text-sm font-bold text-gray-900 leading-tight">{activeCity}</span>
                </div>
                
                <div className="min-w-0 flex-1 px-4 border-l border-gray-200/60 ml-2 relative">
                    <div className="flex items-center gap-2 text-gray-600 transition-colors">
                        <Search size={14} className="flex-shrink-0 text-orange-500" />
                        <input
                            ref={inputRef}
                            type="text"
                            value={inputValue}
                            onChange={handleInputChange}
                            onFocus={() => { if(predictions.length > 0) setIsOpen(true) }}
                            placeholder="Cerca una città..."
                            className="w-full bg-transparent border-none text-xs font-semibold focus:outline-none focus:ring-0 placeholder:text-gray-500 text-gray-900"
                        />
                    </div>
                </div>

                <div 
                    className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-orange-500/30 text-white cursor-pointer"
                    onClick={() => {
                        // Optional fallback GPS trigger
                        if (onCitySelect) onCitySelect({ gps: true });
                    }}
                >
                    {isLoading ? <Loader2 size={16} className="animate-spin" /> : <MapPin size={16} />}
                </div>
            </div>

            {/* Dropdown via CSS conditional absolute positioning */}
            {isOpen && predictions.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-white/90 backdrop-blur-2xl border border-white/60 border-t-0 rounded-b-2xl shadow-2xl z-50 overflow-hidden transform origin-top animate-in slide-in-from-top-2">
                    {predictions.map((p) => (
                        <div 
                            key={p.place_id}
                            onClick={() => handleSelectPrediction(p)}
                            className="px-6 py-3 cursor-pointer hover:bg-orange-50/80 border-b border-gray-100/50 last:border-none flex items-center gap-3 transition-colors"
                        >
                            <MapPin size={14} className="text-orange-400" />
                            <div>
                                <div className="text-sm font-bold text-gray-800">{p.structured_formatting.main_text}</div>
                                <div className="text-xs text-gray-500">{p.structured_formatting.secondary_text}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
