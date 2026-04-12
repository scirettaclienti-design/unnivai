import { useState, useEffect } from "react";
// Add LogOut import
import { MapPin, Mountain, LogOut, X, Search } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import NotificationBell from "./NotificationBell";

import { useUserContext } from "@/hooks/useUserContext";
import { useAuth } from "../context/AuthContext";
import { useCity } from "../context/CityContext";
import { Edit2 } from "lucide-react";

export default function TopBar() {
    // Unified Context Source
    const {
        userId,
        city: currentCity,
        temperatureC,
        firstName,
        isLoading
    } = useUserContext();

    const { signOut } = useAuth(); // Get signOut
    const { setCity } = useCity();
    const navigate = useNavigate();

    const currentTemp = `${temperatureC}°C`;

    const handleLogout = async () => {
        await signOut();
        navigate('/');
    };

    const [isCityModalOpen, setIsCityModalOpen] = useState(false);

    const handleCityChange = () => {
        setIsCityModalOpen(true);
    };

    const handleSaveCity = (newCity) => {
        if (newCity && newCity.trim() !== "") {
            // ⚡ Normalize City Name (Title Case) to ensure key lookups work
            const normalized = newCity.trim().charAt(0).toUpperCase() + newCity.trim().slice(1).toLowerCase();
            setCity(normalized);
        }
        setIsCityModalOpen(false);
    };

    return (
        <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200/50">
            <div className="max-w-md mx-auto px-6 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <motion.div
                            className="w-10 h-10 bg-terracotta-500 rounded-full flex items-center justify-center shadow-lg shadow-terracotta-500/20"
                            whileHover={{ rotate: 180 }}
                            transition={{ duration: 0.3 }}
                        >
                            <Mountain className="text-white w-5 h-5" />
                        </motion.div>
                        <div>
                            <Link to="/profile">
                                <motion.h1
                                    className="text-lg font-bold text-gray-900 leading-none mb-1 font-montserrat"
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                >
                                    Ciao, {isLoading ? '...' : firstName}!
                                </motion.h1>
                            </Link>
                            <div className="text-xs font-medium text-gray-500 flex items-center space-x-2">
                                <span className="flex items-center">
                                    <MapPin className="w-3 h-3 mr-1" />
                                    {currentCity}
                                    <button onClick={handleCityChange} className="ml-2 hover:bg-gray-100 p-1 rounded-full text-indigo-500 transition-colors">
                                        <Edit2 size={10} />
                                    </button>
                                </span>
                                <span className="w-1 h-1 rounded-full bg-gray-300" />
                                <span>{currentTemp}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <NotificationBell
                            userId={userId}
                            currentLocation={currentCity || "Roma"}
                            theme="light"
                        />
                        <button
                            onClick={handleLogout}
                            className="p-2 rounded-full hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                            title="Isci"
                        >
                            <LogOut size={20} />
                        </button>
                    </div>
                </div>
            </div>

            {/* CITY SELECTOR MODAL */}
            <CityModal
                isOpen={isCityModalOpen}
                onClose={() => setIsCityModalOpen(false)}
                initialCity={currentCity || ""}
                onSave={handleSaveCity}
            />
        </header >
    );
}

// --- INTERNAL COMPONENT: CITY MODAL ---
function CityModal({ isOpen, onClose, initialCity, onSave }) {
    const [tempCity, setTempCity] = useState(initialCity);

    // Reset tempCity when modal opens
    useEffect(() => {
        if (isOpen) setTempCity(initialCity);
    }, [isOpen, initialCity]);

    if (!isOpen) return null;

    const popularCities = ["Roma", "Milano", "Venezia", "Firenze", "Napoli"];

    return (
        <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-32 p-4 isolate pointer-events-auto">
            {/* Backdrop */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 backdrop-blur-md"
                onClick={onClose}
            />

            {/* Modal Content */}
            <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 10 }}
                className="bg-white w-full max-w-xs rounded-[1.5rem] p-5 relative z-10 shadow-2xl font-quicksand mx-auto"
            >
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h3 className="text-lg font-bold text-gray-800">Dove ti trovi?</h3>
                        <p className="text-[10px] text-gray-500 font-medium">Cambia la tua posizione attuale</p>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-full transition-colors">
                        <X size={18} className="text-gray-400" />
                    </button>
                </div>

                {/* Input */}
                <div className="relative mb-4">
                    <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 text-terracotta-500 w-4 h-4" />
                    <input
                        type="text"
                        value={tempCity}
                        onChange={(e) => setTempCity(e.target.value)}
                        onFocus={(e) => e.target.select()} // Select-all on focus
                        onKeyDown={(e) => { if (e.key === 'Enter') onSave(tempCity); }}
                        placeholder="Cerca una città..."
                        className="w-full bg-gray-50 border border-gray-200 text-gray-800 font-bold rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta-500/50 transition-all placeholder:font-normal"
                        autoFocus
                    />
                </div>

                {/* Quick Selection */}
                <div className="mb-4">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Suggeriti</p>
                    <div className="flex flex-wrap gap-2">
                        {popularCities.map((c) => (
                            <button
                                key={c}
                                onClick={() => setTempCity(c)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all border ${tempCity === c ? 'bg-terracotta-50 border-terracotta-200 text-terracotta-600' : 'bg-white border-gray-100 text-gray-600 hover:bg-gray-50'}`}
                            >
                                {c}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Actions */}
                <button
                    onClick={() => onSave(tempCity)}
                    className="w-full bg-gradient-to-r from-terracotta-500 to-orange-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-orange-200 active:scale-95 transition-transform text-sm"
                >
                    Conferma Posizione
                </button>
            </motion.div>
        </div>
    );
}
