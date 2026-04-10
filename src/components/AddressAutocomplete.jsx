import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Loader } from 'lucide-react';

export default function AddressAutocomplete({ value, onChange, onSelect, isElite }) {
    const [query, setQuery] = useState(value || '');
    const [suggestions, setSuggestions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const wrapperRef = useRef(null);

    // Sync internal state if prop changes
    useEffect(() => {
        setQuery(value);
    }, [value]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setShowSuggestions(false);
                // Auto-select top suggestion if they type exactly what it says and click away
                if (suggestions.length > 0 && query && !value) {
                    const exactMatch = suggestions.find(s => s.display_name.toLowerCase() === query.toLowerCase());
                    if (exactMatch) {
                        handleSelect(exactMatch);
                    }
                }
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [suggestions, query, value]);

    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (query && query.length > 3 && showSuggestions) {
                setLoading(true);
                try {
                    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=5`);
                    const data = await response.json();
                    setSuggestions(data);
                } catch (e) {
                    console.error("Address fetch error", e);
                } finally {
                    setLoading(false);
                }
            } else {
                setSuggestions([]);
            }
        }, 1000); // 1s debounce to be searching only when stopped typing

        return () => clearTimeout(delayDebounceFn);
    }, [query, showSuggestions]);

    const handleSelect = (item) => {
        let finalAddress = item.display_name;

        // Costruiamo un indirizzo pulito "Via + Civico + Città"
        // OSM spesso omette il civico se non ha la precisione esatta al metro.
        const addr = item.address || {};
        const road = addr.road || addr.pedestrian || addr.square || addr.path || addr.highway;
        let city = addr.city || addr.town || addr.municipality || addr.village || '';
        if (addr.county && addr.county.toLowerCase().includes('roma')) {
             city = 'Roma'; // Fallback visuale pulito per Roma
        }

        if (road) {
            let number = addr.house_number;
            // Se OSM non ha il civico, proviamo a salvarlo recuperandolo da quello che ha digitato l'utente!
            if (!number && query) {
                 const match = query.match(/\b\d+[a-zA-Z]?\b/);
                 if (match) number = match[0];
            }
            finalAddress = `${road}${number ? ' ' + number : ''}${city ? ', ' + city : ''}`;
        }

        setQuery(finalAddress);
        setShowSuggestions(false);
        onChange(finalAddress);
        if (onSelect) {
            onSelect({
                address: finalAddress,
                lat: parseFloat(item.lat),
                lng: parseFloat(item.lon),
                raw: item
            });
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && suggestions.length > 0) {
            e.preventDefault();
            handleSelect(suggestions[0]);
        }
    };

    return (
        <div className="relative" ref={wrapperRef}>
            <div className="relative">
                <input
                    className={`w-full border rounded-xl px-4 py-3 pl-10 text-sm focus:ring-4 focus:border-transparent transition-all outline-none ${isElite ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400 focus:ring-amber-500/20 focus:border-amber-400' : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 shadow-sm focus:ring-orange-500/10 focus:border-orange-500'}`}
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        onChange(e.target.value);
                        setShowSuggestions(true);
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    onKeyDown={handleKeyDown}
                    placeholder="Via Roma 1, Milano"
                />
                <MapPin size={16} className={`absolute left-3.5 top-3.5 ${isElite ? 'text-slate-400' : 'text-slate-400'}`} />
                {loading && <Loader size={16} className={`absolute right-4 top-3.5 animate-spin ${isElite ? 'text-amber-400' : 'text-orange-500'}`} />}
            </div>

            {showSuggestions && suggestions.length > 0 && (
                <ul className={`absolute z-50 w-full border rounded-xl mt-1.5 shadow-xl max-h-48 overflow-y-auto ${isElite ? 'bg-slate-800 border-slate-700 shadow-black/40' : 'bg-white border-slate-200'}`}>
                    {suggestions.map((item, idx) => (
                        <li
                            key={idx}
                            onClick={() => handleSelect(item)}
                            className={`px-4 py-3 cursor-pointer text-sm border-b last:border-0 flex items-start gap-2.5 transition-colors ${isElite ? 'text-slate-300 border-slate-700/50 hover:bg-slate-700' : 'text-slate-700 border-slate-100 hover:bg-slate-50'}`}
                        >
                            <MapPin size={14} className={`mt-0.5 flex-shrink-0 ${isElite ? 'text-amber-500' : 'text-orange-500'}`} />
                            <span className="leading-snug">{item.display_name}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
