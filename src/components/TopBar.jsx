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
        isLoading,
        needsCityChoice,
    } = useUserContext();

    const { signOut } = useAuth(); // Get signOut
    const { setCity } = useCity();
    const navigate = useNavigate();

    // Gate O.2: mostra la temperatura solo se e' un numero reale.
    // Zero valori-ponte (24°C) durante il caricamento.
    const currentTemp = Number.isFinite(temperatureC) ? `${temperatureC}°C` : null;

    const handleLogout = async () => {
        await signOut();
        navigate('/');
    };

    const [isCityModalOpen, setIsCityModalOpen] = useState(false);
    // Gate AA.2: onboarding esplicito. Al primo accesso (senza cache, senza
    // GPS che risolve) la citta' non e' un errore: e' una domanda che il
    // prodotto fa. Il modal si apre da solo perche' il prodotto NON funziona
    // senza citta' — chiederla e' piu' onesto e piu' veloce che aspettare
    // che GPS/IP fallback trovino qualcosa.
    // Trigger UNA SOLA VOLTA per sessione: se l'utente chiude senza scegliere
    // (X in alto a destra), non lo perseguitiamo. Puo' aprire manualmente
    // con Edit2 accanto a "Scegli citta'".
    const [onboardingPrompted, setOnboardingPrompted] = useState(false);
    useEffect(() => {
        if (needsCityChoice && !onboardingPrompted && !isCityModalOpen) {
            setIsCityModalOpen(true);
            setOnboardingPrompted(true);
        }
    }, [needsCityChoice, onboardingPrompted, isCityModalOpen]);

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

    // NOTA: Trasparenza e blur temporaneamente rimossi, da riattivare a conversione completata
    return (
        <header className="sticky top-0 z-50 bg-obsidian-bg border-b border-obsidian-border shadow-md">
            <div className="max-w-md mx-auto px-6 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <motion.div
                            className="w-10 h-10 bg-brand-orange rounded-full flex items-center justify-center shadow-lg shadow-brand-orange/20"
                            whileHover={{ rotate: 180 }}
                            transition={{ duration: 0.3 }}
                        >
                            <Mountain className="text-obsidian-bg w-5 h-5 stroke-[2.5]" />
                        </motion.div>
                        <div>
                            <Link to="/profile">
                                <motion.h1
                                    className="text-lg font-bold text-obsidian-primary leading-none mb-1 font-montserrat"
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                >
                                    Ciao, {isLoading ? '...' : firstName}!
                                </motion.h1>
                            </Link>
                            <div className="text-xs font-medium text-obsidian-secondary flex items-center space-x-2">
                                <span className="flex items-center">
                                    <MapPin className="w-3 h-3 mr-1 text-brand-orange" />
                                    {currentCity || <span className="italic text-obsidian-secondary/70">Scegli citta&apos;</span>}
                                    <button onClick={handleCityChange} className="ml-2 hover:bg-obsidian-card p-1 rounded-full text-brand-orange transition-colors">
                                        <Edit2 size={10} />
                                    </button>
                                </span>
                                {currentTemp && (
                                    <>
                                        <span className="w-1 h-1 rounded-full bg-obsidian-border" />
                                        <span>{currentTemp}</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <NotificationBell
                            userId={userId}
                            currentLocation={currentCity}
                            theme="dark"
                        />
                        <button
                            onClick={handleLogout}
                            className="p-2 rounded-full hover:bg-obsidian-card text-obsidian-secondary hover:text-brand-orange transition-colors"
                            title="Esci"
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
                mode={needsCityChoice && !currentCity ? "onboarding" : "edit"}
            />
        </header>
    );
}

// --- INTERNAL COMPONENT: CITY MODAL ---
function CityModal({ isOpen, onClose, initialCity, onSave, mode = "edit" }) {
    const [tempCity, setTempCity] = useState(initialCity);
    const isOnboarding = mode === "onboarding";

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
                className="fixed inset-0 bg-obsidian-bg/75 backdrop-blur-md"
                onClick={onClose}
            />

            {/* Modal Content */}
            <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 10 }}
                className="bg-obsidian-card border border-obsidian-border text-obsidian-primary w-full max-w-xs rounded-[1.5rem] p-5 relative z-10 shadow-2xl font-quicksand mx-auto"
            >
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h3 className="text-lg font-bold text-obsidian-primary">
                            {isOnboarding ? "Da dove cominciamo?" : "Dove ti trovi?"}
                        </h3>
                        <p className="text-[10px] text-obsidian-secondary font-medium">
                            {isOnboarding
                                ? "Scegli la citta' dove vuoi esplorare oggi."
                                : "Cambia la tua posizione attuale"}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-obsidian-raised rounded-full transition-colors">
                        <X size={18} className="text-obsidian-secondary" />
                    </button>
                </div>

                {/* Input */}
                <div className="relative mb-4">
                    <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-orange w-4 h-4" />
                    <input
                        type="text"
                        value={tempCity}
                        onChange={(e) => setTempCity(e.target.value)}
                        onFocus={(e) => e.target.select()}
                        onKeyDown={(e) => { if (e.key === 'Enter') onSave(tempCity); }}
                        placeholder="Cerca una città..."
                        className="w-full bg-obsidian-bg border border-obsidian-border text-obsidian-primary font-bold rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/50 transition-all placeholder:font-normal placeholder:text-obsidian-secondary/50"
                        autoFocus
                    />
                </div>

                {/* Quick Selection */}
                <div className="mb-4">
                    <p className="text-[10px] font-bold text-obsidian-secondary uppercase tracking-wider mb-2">Suggeriti</p>
                    <div className="flex flex-wrap gap-2">
                        {popularCities.map((c) => (
                            <button
                                key={c}
                                onClick={() => setTempCity(c)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all border ${
                                    tempCity === c
                                        ? 'bg-ivory-bg border-ivory-bg text-ivory-text'
                                        : 'bg-obsidian-raised border-obsidian-border text-obsidian-secondary hover:text-obsidian-primary'
                                }`}
                            >
                                {c}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Actions */}
                <button
                    onClick={() => onSave(tempCity)}
                    className="w-full bg-brand-orange text-obsidian-bg font-bold py-3 rounded-xl shadow-lg active:scale-95 transition-transform text-sm hover:bg-brand-orange-hover"
                >
                    Conferma Posizione
                </button>
            </motion.div>
        </div>
    );
}
