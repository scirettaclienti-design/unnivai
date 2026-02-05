import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'wouter';
import { 
  ArrowLeft, 
  Bell, 
  MapPin, 
  Clock, 
  Heart, 
  Star,
  Settings,
  Check,
  X,
  MessageCircle,
  Camera,
  Gift,
  Sun,
  CloudRain,
  Users
} from 'lucide-react';

export default function NotificationsPage() {
  const [filter, setFilter] = useState<'all' | 'tours' | 'social' | 'weather'>('all');
  const [notifications, setNotifications] = useState([
    {
      id: 1,
      type: 'tour_recommendation',
      title: 'Nuovo Tour Perfetto per Te!',
      message: 'Tour gastronomico "Sapori di Trastevere" - Basato sui tuoi tour precedenti',
      location: 'Roma, Trastevere',
      time: '10 min fa',
      unread: true,
      image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=400&h=300&fit=crop',
      action: 'prenota',
      price: '€45',
      category: 'tours'
    },
    {
      id: 2,
      type: 'weather_alert',
      title: 'Tempo Perfetto per Esplorare!',
      message: 'Sole e 22°C a Firenze - Ideale per il tour "Panorami Rinascimentali"',
      location: 'Firenze',
      time: '25 min fa',
      unread: true,
      image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=300&fit=crop',
      action: 'scopri',
      category: 'weather'
    },
    {
      id: 3,
      type: 'social_activity',
      title: 'Nuovi Like alle Tue Foto',
      message: 'Marco e altri 12 utenti hanno messo like alle foto del tuo tour a Venezia',
      location: 'Venezia',
      time: '1 ora fa',
      unread: false,
      image: 'https://images.unsplash.com/photo-1523906834658-6e24ef2386f9?w=400&h=300&fit=crop',
      action: 'vedi',
      category: 'social'
    },
    {
      id: 4,
      type: 'tour_reminder',
      title: 'Tour Prenotato Domani',
      message: '"Segreti di Palermo" inizia alle 10:00 - Punto d\'incontro: Piazza Pretoria',
      location: 'Palermo',
      time: '2 ore fa',
      unread: false,
      image: 'https://images.unsplash.com/photo-1555950257-6ba4ac832388?w=400&h=300&fit=crop',
      action: 'dettagli',
      category: 'tours'
    },
    {
      id: 5,
      type: 'group_invite',
      title: 'Invito Tour di Gruppo',
      message: 'Sofia ti ha invitato al tour "Enogastronomia Toscana" del 15 febbraio',
      location: 'Siena',
      time: '4 ore fa',
      unread: false,
      image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=300&fit=crop',
      action: 'rispondi',
      category: 'social'
    },
    {
      id: 6,
      type: 'weather_change',
      title: 'Cambio Meteo - Consiglio Indoor',
      message: 'Pioggia prevista oggi a Milano. Che ne dici del tour "Musei Nascosti"?',
      location: 'Milano',
      time: '6 ore fa',
      unread: false,
      image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=300&fit=crop',
      action: 'esplora',
      category: 'weather'
    }
  ]);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'tour_recommendation': return <MapPin className="w-5 h-5 text-terracotta-500" />;
      case 'weather_alert': return <Sun className="w-5 h-5 text-yellow-500" />;
      case 'weather_change': return <CloudRain className="w-5 h-5 text-blue-500" />;
      case 'social_activity': return <Heart className="w-5 h-5 text-red-500" />;
      case 'tour_reminder': return <Clock className="w-5 h-5 text-green-500" />;
      case 'group_invite': return <Users className="w-5 h-5 text-purple-500" />;
      default: return <Bell className="w-5 h-5 text-gray-500" />;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'prenota': return 'bg-terracotta-500 hover:bg-terracotta-600';
      case 'scopri': return 'bg-blue-500 hover:bg-blue-600';
      case 'vedi': return 'bg-purple-500 hover:bg-purple-600';
      case 'dettagli': return 'bg-green-500 hover:bg-green-600';
      case 'rispondi': return 'bg-indigo-500 hover:bg-indigo-600';
      case 'esplora': return 'bg-orange-500 hover:bg-orange-600';
      default: return 'bg-gray-500 hover:bg-gray-600';
    }
  };

  const filteredNotifications = filter === 'all' 
    ? notifications 
    : notifications.filter(n => n.category === filter);

  const unreadCount = notifications.filter(n => n.unread).length;

  const markAsRead = (id: number) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, unread: false } : n)
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, unread: false })));
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-ochre-100 to-ochre-200 pb-20">
      {/* Header */}
      <div className="bg-white/90 backdrop-blur-md border-b border-gray-200 sticky top-0 z-10">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center space-x-3">
            <Link href="/">
              <motion.button
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <ArrowLeft className="w-5 h-5" />
              </motion.button>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-800">Notifiche</h1>
              {unreadCount > 0 && (
                <p className="text-sm text-gray-600">{unreadCount} non lette</p>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {unreadCount > 0 && (
              <motion.button
                onClick={markAllAsRead}
                className="text-terracotta-500 hover:text-terracotta-600 text-sm font-medium"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Segna tutte lette
              </motion.button>
            )}
            <Link href="/notification-settings">
              <motion.button
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Settings className="w-5 h-5" />
              </motion.button>
            </Link>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="px-4 pb-3">
          <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
            {[
              { key: 'all', label: 'Tutte', icon: Bell },
              { key: 'tours', label: 'Tour', icon: MapPin },
              { key: 'social', label: 'Social', icon: Heart },
              { key: 'weather', label: 'Meteo', icon: Sun }
            ].map(({ key, label, icon: Icon }) => (
              <motion.button
                key={key}
                onClick={() => setFilter(key as any)}
                className={`flex-1 flex items-center justify-center space-x-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                  filter === key
                    ? 'bg-white text-terracotta-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Icon className="w-4 h-4" />
                <span>{label}</span>
              </motion.button>
            ))}
          </div>
        </div>
      </div>

      {/* Notifications List */}
      <div className="p-4 space-y-3">
        <AnimatePresence mode="popLayout">
          {filteredNotifications.map((notification, index) => (
            <motion.div
              key={notification.id}
              className={`relative overflow-hidden ${
                notification.unread 
                  ? 'bg-gradient-to-r from-white via-terracotta-50/30 to-white' 
                  : 'bg-white/90'
              } backdrop-blur-md rounded-3xl shadow-xl border border-white/20`}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: -100, scale: 0.95 }}
              transition={{ 
                delay: index * 0.1,
                type: "spring",
                stiffness: 200,
                damping: 20
              }}
              layout
              whileHover={{ 
                scale: 1.02,
                boxShadow: "0 20px 40px rgba(0,0,0,0.1)"
              }}
            >
              {/* Glowing border for unread */}
              {notification.unread && (
                <motion.div
                  className="absolute inset-0 rounded-3xl"
                  style={{
                    background: `linear-gradient(45deg, 
                      rgba(210, 137, 108, 0.3), 
                      rgba(210, 137, 108, 0.1), 
                      rgba(210, 137, 108, 0.3)
                    )`,
                    backgroundSize: '200% 200%'
                  }}
                  animate={{
                    backgroundPosition: ['0% 50%', '100% 50%', '0% 50%']
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "linear"
                  }}
                />
              )}

              <div className="relative p-6">
                <div className="flex items-start space-x-4">
                  {/* Enhanced Icon with glow effect */}
                  <motion.div 
                    className={`flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg ${
                      notification.unread 
                        ? 'bg-gradient-to-br from-terracotta-400 to-terracotta-600' 
                        : 'bg-gradient-to-br from-gray-400 to-gray-600'
                    }`}
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    {getNotificationIcon(notification.type)}
                    {notification.unread && (
                      <motion.div
                        className="absolute inset-0 rounded-2xl bg-terracotta-400"
                        animate={{
                          boxShadow: [
                            '0 0 10px rgba(210, 137, 108, 0.3)',
                            '0 0 20px rgba(210, 137, 108, 0.6)',
                            '0 0 10px rgba(210, 137, 108, 0.3)'
                          ]
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: "easeInOut"
                        }}
                      />
                    )}
                  </motion.div>

                  {/* Content with better typography */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-2">
                      <motion.h3 
                        className={`text-lg font-bold leading-tight ${
                          notification.unread ? 'text-gray-900' : 'text-gray-700'
                        }`}
                        initial={{ opacity: 0.8 }}
                        whileHover={{ opacity: 1 }}
                      >
                        {notification.title}
                      </motion.h3>
                      <div className="flex items-center space-x-3 ml-4">
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full whitespace-nowrap">
                          {notification.time}
                        </span>
                        {notification.unread && (
                          <motion.button
                            onClick={() => markAsRead(notification.id)}
                            className="w-8 h-8 bg-terracotta-500 hover:bg-terracotta-600 text-white rounded-full flex items-center justify-center"
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            transition={{ type: "spring", stiffness: 400 }}
                          >
                            <Check className="w-4 h-4" />
                          </motion.button>
                        )}
                      </div>
                    </div>
                    
                    <p className="text-sm text-gray-600 leading-relaxed mb-3 line-clamp-2">
                      {notification.message}
                    </p>
                    
                    <div className="flex items-center space-x-2 text-xs text-gray-500 mb-4">
                      <div className="flex items-center space-x-1 bg-gray-100 px-2 py-1 rounded-full">
                        <MapPin className="w-3 h-3" />
                        <span>{notification.location}</span>
                      </div>
                      {notification.price && (
                        <div className="bg-terracotta-100 text-terracotta-700 px-2 py-1 rounded-full font-semibold">
                          {notification.price}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Enhanced Image with overlay */}
                  {notification.image && (
                    <motion.div 
                      className="flex-shrink-0 relative group"
                      whileHover={{ scale: 1.05 }}
                      transition={{ type: "spring", stiffness: 300 }}
                    >
                      <img
                        src={notification.image}
                        alt="Notification"
                        className="w-20 h-20 rounded-2xl object-cover shadow-lg"
                      />
                      <div className="absolute inset-0 bg-black/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                        <motion.div
                          className="w-6 h-6 bg-white/30 rounded-full flex items-center justify-center"
                          whileHover={{ scale: 1.2 }}
                        >
                          <span className="text-white text-sm">👁️</span>
                        </motion.div>
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* Enhanced Action Button */}
                <div className="flex justify-end mt-4">
                  <motion.button
                    className={`px-6 py-3 rounded-2xl text-white text-sm font-semibold ${getActionColor(notification.action)} shadow-lg relative overflow-hidden`}
                    whileHover={{ 
                      scale: 1.05, 
                      boxShadow: "0 10px 25px rgba(0,0,0,0.2)" 
                    }}
                    whileTap={{ scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    <motion.div
                      className="absolute inset-0 bg-white/20"
                      initial={{ x: '-100%' }}
                      whileHover={{ x: '100%' }}
                      transition={{ duration: 0.6 }}
                    />
                    <span className="relative z-10 flex items-center space-x-2">
                      <span>{notification.action.charAt(0).toUpperCase() + notification.action.slice(1)}</span>
                      <motion.div
                        animate={{ x: [0, 3, 0] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      >
                        →
                      </motion.div>
                    </span>
                  </motion.button>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {filteredNotifications.length === 0 && (
          <motion.div
            className="text-center py-16"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <motion.div
              className="relative mb-6"
              animate={{ 
                rotate: [0, 10, -10, 0],
                scale: [1, 1.1, 1]
              }}
              transition={{ 
                duration: 4, 
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              <div className="w-20 h-20 bg-gradient-to-br from-gray-200 to-gray-300 rounded-3xl flex items-center justify-center mx-auto shadow-lg">
                <Bell className="w-10 h-10 text-gray-400" />
              </div>
              <motion.div
                className="absolute -top-2 -right-2 w-6 h-6 bg-gradient-to-r from-terracotta-200 to-terracotta-300 rounded-full"
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.5, 1, 0.5]
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity
                }}
              />
            </motion.div>
            
            <motion.h3 
              className="text-xl font-bold text-gray-700 mb-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              Tutto tranquillo!
            </motion.h3>
            
            <motion.p 
              className="text-gray-500 max-w-xs mx-auto leading-relaxed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
            >
              {filter === 'all' 
                ? 'Non hai notifiche al momento. Ti aggiorneremo quando ci saranno novità interessanti!'
                : `Nessuna notifica per ${filter === 'tours' ? 'tour' : filter === 'social' ? 'attività social' : 'meteo'} al momento.`
              }
            </motion.p>
            
            <motion.div
              className="mt-8"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.9 }}
            >
              <Link href="/">
                <motion.button
                  className="bg-gradient-to-r from-terracotta-500 to-terracotta-600 hover:from-terracotta-600 hover:to-terracotta-700 text-white px-6 py-3 rounded-2xl font-semibold shadow-lg"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Esplora Tour
                </motion.button>
              </Link>
            </motion.div>
          </motion.div>
        )}
      </div>
    </div>
  );
}