import { MapPin, Mountain, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import NotificationBell from "./NotificationBell";
import { useUserContext } from "@/hooks/useUserContext";

export default function TopBar() {
    // Unified Context Source
    const {
        city: currentCity,
        temperatureC,
        toursCount: toursAvailable,
        firstName,
        isLoading
    } = useUserContext();

    const currentTemp = `${temperatureC}°C`;

    const handleLocationClick = () => {
        // Future: refresh context manually
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
                                </span>
                                <span className="w-1 h-1 rounded-full bg-gray-300" />
                                <span>{currentTemp}</span>
                            </div>
                        </div>
                    </div>

                    <NotificationBell
                        userId={1}
                        currentLocation={currentCity || "Roma"}
                        theme="light"
                    />
                </div>
            </div>
        </header>
    );
}
