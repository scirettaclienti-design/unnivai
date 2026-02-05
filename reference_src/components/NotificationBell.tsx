import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, MapPin, Sun, Heart, Clock, ArrowRight } from 'lucide-react';
import { Link } from 'wouter';
import { aiRecommendationService, type NotificationData } from '@/services/aiRecommendationService';
import { locationTourService } from '@/services/locationTourService';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useUserProfile } from '@/hooks/useUserProfile';

interface NotificationBellProps {
  userId?: number;
  currentLocation?: string;
}

export default function NotificationBell({ userId, currentLocation = 'Roma' }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { location } = useGeolocation();
  const { profile } = useUserProfile();

  // Load smart notifications based on real location and user profile
  useEffect(() => {
    if (userId && (location || currentLocation) && profile) {
      loadSmartNotifications();
      // Refresh notifications every 10 minutes for real-time updates
      const interval = setInterval(loadSmartNotifications, 10 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [userId, location, currentLocation, profile]);

  // Generate enhanced notifications with location-specific data
  const generateLocationEnhancedNotifications = async (
    baseNotifications: NotificationData[],
    locationData: any,
    city: string,
    userName: string
  ): Promise<NotificationData[]> => {
    const currentHour = new Date().getHours();
    const isWeekend = [0, 6].includes(new Date().getDay());
    
    const enhancedNotifications: NotificationData[] = [...baseNotifications];
    
    // Add location-specific time-based notifications
    if (currentHour >= 9 && currentHour <= 11) {
      enhancedNotifications.unshift({
        id: `morning-${city}-${Date.now()}`,
        type: 'location',
        priority: 'high',
        title: `Buongiorno ${userName}! 🌅`,
        message: `Perfetto momento per esplorare ${city}. Ho trovato 3 tour mattutini ideali per te.`,
        timestamp: new Date(),
        actionText: 'Scopri i tour',
        actionUrl: '/tour-live',
        locationBased: true,
        weatherAdaptive: true
      });
    }
    
    // Weekend special notifications
    if (isWeekend && currentHour >= 10 && currentHour <= 16) {
      enhancedNotifications.unshift({
        id: `weekend-${city}-${Date.now()}`,
        type: 'special',
        priority: 'high',
        title: `Weekend a ${city}! 🎉`,
        message: `Esperienze esclusive del weekend disponibili. Tour con 20% di sconto.`,
        timestamp: new Date(),
        actionText: 'Offerte weekend',
        actionUrl: '/surprise-tour',
        locationBased: true,
        isPromotion: true
      });
    }
    
    // Quick tours available nearby
    if (locationData.quickTours && locationData.quickTours.length > 0) {
      const quickTour = locationData.quickTours[0];
      enhancedNotifications.push({
        id: `quick-tour-${quickTour.id}`,
        type: 'recommendation',
        priority: 'medium',
        title: `${quickTour.title} - Inizia ora!`,
        message: `Tour di ${quickTour.duration} a solo €${quickTour.price}. Parti dal ${quickTour.startPoint}`,
        timestamp: new Date(),
        actionText: 'Inizia tour',
        actionUrl: '/tour-live',
        locationBased: true,
        tourData: quickTour
      });
    }
    
    // Weather-based recommendations
    const weather = await aiRecommendationService.getCurrentWeather(city);
    if (weather.condition === 'rainy') {
      enhancedNotifications.unshift({
        id: `weather-${city}-${Date.now()}`,
        type: 'weather',
        priority: 'medium',
        title: `Pioggia a ${city} ☔`,
        message: `Ho selezionato tour al coperto perfetti per oggi. Musei e luoghi storici ti aspettano!`,
        timestamp: new Date(),
        actionText: 'Tour al coperto',
        actionUrl: '/explore',
        locationBased: true,
        weatherAdaptive: true
      });
    } else if (weather.condition === 'sunny') {
      enhancedNotifications.push({
        id: `sunny-${city}-${Date.now()}`,
        type: 'weather',
        priority: 'low',
        title: `Sole splendente! ☀️`,
        message: `Giornata perfetta per tour all'aperto a ${city}. Parchi e passeggiate panoramiche disponibili.`,
        timestamp: new Date(),
        actionText: 'Tour all\'aperto',
        actionUrl: '/explore',
        locationBased: true,
        weatherAdaptive: true
      });
    }
    
    // Local tips as notifications
    if (locationData.localTips && locationData.localTips.length > 0) {
      const randomTip = locationData.localTips[Math.floor(Math.random() * locationData.localTips.length)];
      enhancedNotifications.push({
        id: `tip-${city}-${Date.now()}`,
        type: 'tip',
        priority: 'low',
        title: `Consiglio da locale 💡`,
        message: randomTip,
        timestamp: new Date(),
        actionText: 'Altri consigli',
        actionUrl: '/profile',
        locationBased: true,
        isLocalTip: true
      });
    }
    
    return enhancedNotifications.slice(0, 5); // Limit to 5 most relevant notifications
  };

  const loadSmartNotifications = async () => {
    if (!userId) return;
    
    setIsLoading(true);
    try {
      // Use real location and user profile for personalized notifications
      const actualLocation = location?.city || currentLocation;
      const preferences = await aiRecommendationService.analyzeUserBehavior(userId);
      
      // Generate location-based notifications
      const locationRecommendations = await locationTourService.generateLocationBasedTours(
        actualLocation,
        profile.firstName,
        location ? { lat: location.latitude, lng: location.longitude } : undefined
      );
      
      // Generate smart notifications with real data
      const smartNotifications = await aiRecommendationService.generateSmartNotifications(
        userId, 
        preferences, 
        actualLocation
      );
      
      // Enhance notifications with location-specific data
      const enhancedNotifications = await generateLocationEnhancedNotifications(
        smartNotifications,
        locationRecommendations,
        actualLocation,
        profile.firstName
      );
      
      setNotifications(enhancedNotifications);
    } catch (error) {
      console.error('Error loading smart notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const unreadCount = notifications.length;

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'tour_recommendation': return <MapPin className="w-4 h-4 text-terracotta-500" />;
      case 'weather_alert': return <Sun className="w-4 h-4 text-yellow-500" />;
      case 'social_activity': return <Heart className="w-4 h-4 text-red-500" />;
      case 'tour_reminder': return <Clock className="w-4 h-4 text-green-500" />;
      default: return <Bell className="w-4 h-4 text-gray-500" />;
    }
  };

  const getActionColor = (actionType: string) => {
    switch (actionType) {
      case 'prenota': return 'bg-terracotta-500 hover:bg-terracotta-600';
      case 'scopri': return 'bg-blue-500 hover:bg-blue-600';
      case 'vedi': return 'bg-purple-500 hover:bg-purple-600';
      default: return 'bg-gray-500 hover:bg-gray-600';
    }
  };

  return (
    <div className="relative">
      <motion.div
        onHoverStart={() => setShowPreview(true)}
        onHoverEnd={() => setShowPreview(false)}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
      >
        <Link href="/notifications">
          <motion.div 
            className="relative p-3 bg-white/20 hover:bg-white/30 rounded-2xl transition-all duration-300 cursor-pointer backdrop-blur-sm border border-white/30"
            whileHover={{ 
              boxShadow: "0 8px 25px rgba(255,255,255,0.2)",
              rotate: [0, -10, 10, 0]
            }}
            transition={{ duration: 0.6 }}
          >
            <motion.div
              animate={unreadCount > 0 ? { 
                rotate: [0, 10, -10, 0],
                scale: [1, 1.1, 1]
              } : {}}
              transition={{ 
                duration: 2, 
                repeat: unreadCount > 0 ? Infinity : 0,
                ease: "easeInOut"
              }}
            >
              <Bell className="w-6 h-6 text-white" />
            </motion.div>
            
            {unreadCount > 0 && (
              <motion.div
                className="absolute -top-2 -right-2 bg-gradient-to-r from-red-500 to-red-600 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-bold shadow-lg"
                initial={{ scale: 0, rotate: 180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ 
                  type: "spring", 
                  stiffness: 500, 
                  damping: 20,
                  delay: 0.2
                }}
                whileHover={{ scale: 1.2 }}
              >
                <motion.span
                  animate={{ 
                    scale: [1, 1.1, 1]
                  }}
                  transition={{ 
                    duration: 1, 
                    repeat: Infinity
                  }}
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </motion.span>
              </motion.div>
            )}
            
            {isLoading && (
              <motion.div
                className="absolute -top-1 -right-1 w-4 h-4 bg-gradient-to-r from-blue-400 to-blue-500 rounded-full shadow-lg"
                animate={{ 
                  scale: [1, 1.3, 1],
                  opacity: [0.7, 1, 0.7],
                  rotate: [0, 360]
                }}
                transition={{ 
                  duration: 2, 
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />
            )}
          </motion.div>
        </Link>
      </motion.div>

      {/* Enhanced Notification Preview */}
      <AnimatePresence>
        {showPreview && notifications.length > 0 && (
          <motion.div
            className="absolute top-full right-0 mt-3 w-96 bg-gradient-to-br from-white/95 to-white/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/30 z-50 overflow-hidden"
            initial={{ opacity: 0, y: -20, scale: 0.9, rotateX: -15 }}
            animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
            exit={{ opacity: 0, y: -20, scale: 0.9, rotateX: -15 }}
            transition={{ 
              type: "spring", 
              stiffness: 300, 
              damping: 30,
              duration: 0.4 
            }}
          >
            {/* Header with gradient */}
            <div className="bg-gradient-to-r from-terracotta-500 to-terracotta-600 p-4 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <motion.div
                    className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center"
                    animate={{ rotate: [0, 10, -10, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <Bell className="w-3 h-3" />
                  </motion.div>
                  <h3 className="font-bold text-lg">Notifiche Smart</h3>
                </div>
                <Link href="/notifications">
                  <motion.span 
                    className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded-full text-sm font-medium cursor-pointer transition-colors"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Vedi tutte
                  </motion.span>
                </Link>
              </div>
            </div>
            
            <div className="p-4 space-y-4 max-h-80 overflow-y-auto">
              {notifications.slice(0, 3).map((notification, index) => (
                <motion.div
                  key={index}
                  className="group relative bg-gradient-to-r from-white/80 to-white/60 rounded-2xl p-4 hover:shadow-lg transition-all duration-300 border border-white/50"
                  initial={{ opacity: 0, x: -30, scale: 0.9 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  transition={{ 
                    delay: index * 0.15,
                    type: "spring",
                    stiffness: 200 
                  }}
                  whileHover={{ 
                    scale: 1.02,
                    boxShadow: "0 8px 25px rgba(0,0,0,0.1)"
                  }}
                >
                  {/* Animated border */}
                  <motion.div
                    className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100"
                    style={{
                      background: `linear-gradient(45deg, 
                        transparent, 
                        rgba(210, 137, 108, 0.1), 
                        transparent
                      )`,
                    }}
                    animate={{
                      background: [
                        'linear-gradient(45deg, transparent, rgba(210, 137, 108, 0.1), transparent)',
                        'linear-gradient(225deg, transparent, rgba(210, 137, 108, 0.1), transparent)',
                        'linear-gradient(45deg, transparent, rgba(210, 137, 108, 0.1), transparent)'
                      ]
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />

                  <div className="relative flex items-start space-x-3">
                    <motion.div 
                      className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-terracotta-400 to-terracotta-600 rounded-xl flex items-center justify-center shadow-md"
                      whileHover={{ rotate: 360 }}
                      transition={{ duration: 0.6 }}
                    >
                      {getNotificationIcon(notification.type)}
                    </motion.div>
                    
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-bold text-gray-800 mb-1 group-hover:text-terracotta-700 transition-colors">
                        {notification.title}
                      </h4>
                      <p className="text-xs text-gray-600 leading-relaxed line-clamp-2 mb-2">
                        {notification.message}
                      </p>
                      
                      {notification.location && (
                        <div className="flex items-center space-x-1 text-xs text-gray-500 mb-3">
                          <motion.div
                            animate={{ y: [0, -2, 0] }}
                            transition={{ duration: 1.5, repeat: Infinity }}
                          >
                            <MapPin className="w-3 h-3" />
                          </motion.div>
                          <span>{notification.location}</span>
                        </div>
                      )}
                      
                      <motion.button
                        className={`px-4 py-2 rounded-xl text-white text-xs font-semibold ${getActionColor(notification.actionType)} relative overflow-hidden shadow-md`}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        transition={{ type: "spring", stiffness: 400 }}
                      >
                        <motion.div
                          className="absolute inset-0 bg-white/20"
                          initial={{ x: '-100%' }}
                          whileHover={{ x: '100%' }}
                          transition={{ duration: 0.5 }}
                        />
                        <span className="relative z-10 flex items-center space-x-1">
                          <span>{notification.actionType}</span>
                          <motion.span
                            animate={{ x: [0, 2, 0] }}
                            transition={{ duration: 1, repeat: Infinity }}
                          >
                            →
                          </motion.span>
                        </span>
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
            
            {notifications.length > 3 && (
              <motion.div 
                className="bg-gradient-to-r from-gray-50 to-gray-100 p-4 text-center border-t border-gray-200"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
              >
                <Link href="/notifications">
                  <motion.div
                    className="inline-flex items-center space-x-2 text-terracotta-600 hover:text-terracotta-700 font-semibold text-sm cursor-pointer"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <span>Altre {notifications.length - 3} notifiche</span>
                    <motion.div
                      animate={{ x: [0, 3, 0] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    >
                      <ArrowRight className="w-4 h-4" />
                    </motion.div>
                  </motion.div>
                </Link>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}