import { MapPin, Mountain, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import NotificationBell from "./NotificationBell";
import { useEnhancedGeolocation } from "@/hooks/useEnhancedGeolocation";
import { useUserProfile } from "@/hooks/useUserProfile";

export default function TopBar() {
  const { location, loading, error, getCurrentLocation } = useEnhancedGeolocation();
  const { profile, isLoading: profileLoading } = useUserProfile();
  
  const currentCity = location?.city || 'Catania';
  const currentTemp = '24°C';
  const toursAvailable = 3;

  const handleLocationClick = () => {
    if (error) {
      getCurrentLocation();
    }
  };

  return (
    <header className="bg-gradient-to-r from-terracotta-400 to-terracotta-500 shadow-lg sticky top-0 z-50">
      <div className="max-w-md mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <motion.div 
              className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center"
              whileHover={{ rotate: 180 }}
              transition={{ duration: 0.3 }}
            >
              <Mountain className="text-white w-5 h-5" />
            </motion.div>
            <div>
              <Link href="/profile">
                <motion.h1 
                  className="text-lg font-bold text-white hover:text-ochre-100 transition-colors cursor-pointer"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Ciao, {profileLoading ? 'Caricando...' : profile.firstName}!
                </motion.h1>
              </Link>
              <div className="text-sm text-white/80 flex items-center space-x-2">
                <MapPin className="text-white/70 w-3 h-3" />
                <span data-testid="text-location">{currentCity}</span>
                <span>•</span>
                <span data-testid="text-temperature">{currentTemp}</span>
                <span>•</span>
                <span>🎯 {toursAvailable} tour disponibili</span>
              </div>
            </div>
          </div>
          
          <NotificationBell 
            userId={1} 
            currentLocation={location?.city || "Roma"} 
          />
        </div>
      </div>
    </header>
  );
}