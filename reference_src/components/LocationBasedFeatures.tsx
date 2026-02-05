import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  MapPin, 
  Users, 
  Building2, 
  Navigation, 
  Wifi, 
  WifiOff,
  User,
  Star,
  Clock,
  Phone
} from "lucide-react";
import { useEnhancedGeolocation } from "@/hooks/useEnhancedGeolocation";
import { Button } from "@/components/ui/button";

interface LocationBasedFeaturesProps {
  userType?: 'customer' | 'business' | 'guide';
  showNearbyData?: boolean;
}

const LocationBasedFeatures = ({ userType = 'customer', showNearbyData = true }: LocationBasedFeaturesProps) => {
  const { 
    location, 
    loading, 
    error, 
    nearbyData, 
    savedToDatabase,
    getCurrentLocation,
    hasPermission 
  } = useEnhancedGeolocation();

  const [showDetails, setShowDetails] = useState(false);

  const getLocationStatusColor = () => {
    if (loading) return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    if (error && error.includes('simulata')) return 'bg-orange-100 text-orange-700 border-orange-200';
    if (hasPermission) return 'bg-green-100 text-green-700 border-green-200';
    return 'bg-red-100 text-red-700 border-red-200';
  };

  const getLocationStatusIcon = () => {
    if (loading) return <Wifi className="w-4 h-4 animate-spin" />;
    if (error && error.includes('simulata')) return <MapPin className="w-4 h-4" />;
    if (hasPermission) return <Navigation className="w-4 h-4" />;
    return <WifiOff className="w-4 h-4" />;
  };

  const renderNearbyItem = (item: any, index: number) => {
    const isCustomer = item.userType === 'customer' || !item.userType;
    const isBusiness = item.userType === 'business';
    const isGuide = item.userType === 'guide';

    return (
      <motion.div
        key={item.userId}
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, delay: index * 0.1 }}
        className="flex items-center space-x-3 p-3 bg-white rounded-xl border border-gray-200 hover:shadow-lg transition-shadow"
      >
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
          isCustomer ? 'bg-blue-100 text-blue-600' :
          isBusiness ? 'bg-green-100 text-green-600' : 
          'bg-purple-100 text-purple-600'
        }`}>
          {isCustomer && <User className="w-5 h-5" />}
          {isBusiness && <Building2 className="w-5 h-5" />}
          {isGuide && <MapPin className="w-5 h-5" />}
        </div>
        
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-800 truncate">{item.username}</p>
          <div className="flex items-center space-x-3 text-sm text-gray-600">
            <span className="flex items-center">
              <MapPin className="w-3 h-3 mr-1" />
              {item.city}
            </span>
            {item.distance && (
              <span className="text-xs bg-gray-100 px-2 py-1 rounded-full">
                {Math.round(item.distance)}m
              </span>
            )}
          </div>
        </div>
        
        <div className="text-right">
          <span className={`inline-block w-2 h-2 rounded-full ${
            isCustomer ? 'bg-blue-400' :
            isBusiness ? 'bg-green-400' : 
            'bg-purple-400'
          }`}></span>
          <p className="text-xs text-gray-500 mt-1 capitalize">
            {item.userType || 'customer'}
          </p>
        </div>
      </motion.div>
    );
  };

  const getNearbyTitle = () => {
    switch (userType) {
      case 'business':
        return '🧳 Clienti nelle Vicinanze';
      case 'guide':
        return '🗺️ Richieste Tour Vicinanze';
      case 'customer':
      default:
        return '🏢 Servizi nelle Vicinanze';
    }
  };

  const getNearbyDescription = () => {
    switch (userType) {
      case 'business':
        return 'Clienti che potrebbero essere interessati ai tuoi servizi';
      case 'guide':
        return 'Turisti che cercano guide nella tua zona';
      case 'customer':
      default:
        return 'Business e guide che offrono esperienze nella tua zona';
    }
  };

  return (
    <div className="bg-white rounded-3xl shadow-lg p-6 space-y-6">
      {/* Location Status Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800">🌍 Geolocalizzazione</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowDetails(!showDetails)}
          className="text-xs"
        >
          {showDetails ? 'Nascondi' : 'Dettagli'}
        </Button>
      </div>

      {/* Location Status */}
      <motion.div
        className={`flex items-center space-x-3 p-4 rounded-2xl border ${getLocationStatusColor()}`}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        {getLocationStatusIcon()}
        <div className="flex-1">
          <p className="font-semibold">
            {loading ? 'Rilevamento posizione...' :
             hasPermission ? `📍 ${location?.city}, ${location?.country}` :
             error ? 'Posizione non disponibile' : 'Posizione sconosciuta'
            }
          </p>
          {error && (
            <p className="text-sm opacity-80 mt-1">{error}</p>
          )}
          {location && !error && (
            <p className="text-sm opacity-80 mt-1">
              Precisione GPS attiva
              {savedToDatabase && <span className="ml-2">• Salvata nel database ✓</span>}
            </p>
          )}
        </div>
        {!loading && !hasPermission && (
          <Button
            size="sm"
            onClick={getCurrentLocation}
            className="text-xs"
          >
            Rileva
          </Button>
        )}
      </motion.div>

      {/* Details Section */}
      <AnimatePresence>
        {showDetails && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-4"
          >
            {location && (
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-2xl">
                <div>
                  <p className="text-sm text-gray-600">Latitudine</p>
                  <p className="font-mono text-sm">{location.latitude.toFixed(6)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Longitudine</p>
                  <p className="font-mono text-sm">{location.longitude.toFixed(6)}</p>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Nearby Data Section */}
      {showNearbyData && nearbyData && nearbyData.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="space-y-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-gray-800">{getNearbyTitle()}</h3>
              <p className="text-sm text-gray-600">{getNearbyDescription()}</p>
            </div>
            <span className="bg-blue-100 text-blue-700 text-xs px-3 py-1 rounded-full font-semibold">
              {nearbyData.length} trovati
            </span>
          </div>

          <div className="space-y-3 max-h-64 overflow-y-auto">
            {nearbyData.slice(0, 5).map((item, index) => renderNearbyItem(item, index))}
          </div>

          {nearbyData.length > 5 && (
            <div className="text-center">
              <Button variant="outline" size="sm" className="text-xs">
                Mostra tutti ({nearbyData.length})
              </Button>
            </div>
          )}
        </motion.div>
      )}

      {/* Empty State for Nearby Data */}
      {showNearbyData && nearbyData && nearbyData.length === 0 && hasPermission && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-8 space-y-3"
        >
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
            <Users className="w-8 h-8 text-gray-400" />
          </div>
          <p className="text-gray-600">Nessuno nelle vicinanze al momento</p>
          <p className="text-sm text-gray-500">
            Prova ad espandere il raggio di ricerca o riprova più tardi
          </p>
        </motion.div>
      )}

      {/* No Permission State */}
      {showNearbyData && !hasPermission && !loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-6 space-y-3 bg-gray-50 rounded-2xl"
        >
          <WifiOff className="w-12 h-12 text-gray-400 mx-auto" />
          <p className="text-gray-600">Abilita la geolocalizzazione</p>
          <p className="text-sm text-gray-500">
            per vedere {userType === 'business' ? 'clienti' : userType === 'guide' ? 'richieste' : 'servizi'} nelle vicinanze
          </p>
          <Button
            onClick={getCurrentLocation}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Navigation className="w-4 h-4 mr-2" />
            Attiva Posizione
          </Button>
        </motion.div>
      )}
    </div>
  );
};

export default LocationBasedFeatures;