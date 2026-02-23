import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Loader } from 'lucide-react';

export default function AddressAutocomplete({ value, onChange, onSelect }) {
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
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

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
        const address = item.display_name;
        // Construct a cleaner address if possible, or just use display_name
        setQuery(address);
        setShowSuggestions(false);
        onChange(address);
        if (onSelect) {
            onSelect({
                address: address,
                lat: parseFloat(item.lat),
                lng: parseFloat(item.lon),
                raw: item
            });
        }
    };

    return (
        <div className="relative" ref={wrapperRef}>
            <div className="relative">
                <input
                    className="w-full border border-gray-300 rounded-xl p-3 pl-10 focus:ring-2 focus:ring-blue-500 outline-none"
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        onChange(e.target.value);
                        setShowSuggestions(true);
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    placeholder="Via Roma 1, Milano"
                />
                <MapPin size={16} className="absolute left-3 top-3.5 text-gray-400" />
                {loading && <Loader size={16} className="absolute right-3 top-3.5 text-blue-500 animate-spin" />}
            </div>

            {showSuggestions && suggestions.length > 0 && (
                <ul className="absolute z-50 w-full bg-white border border-gray-100 rounded-xl mt-1 shadow-lg max-h-48 overflow-y-auto">
                    {suggestions.map((item, idx) => (
                        <li
                            key={idx}
                            onClick={() => handleSelect(item)}
                            className="px-4 py-3 hover:bg-gray-50 cursor-pointer text-sm text-gray-700 border-b border-gray-50 last:border-0 flex items-start gap-2"
                        >
                            <MapPin size={14} className="mt-1 flex-shrink-0 text-gray-400" />
                            <span>{item.display_name}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
