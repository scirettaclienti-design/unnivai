import { useState, useEffect } from 'react'; // Added useEffect
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useUserContext } from "@/hooks/useUserContext"; // Added Context
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
    Users,
    Search,
    ArrowRight
} from 'lucide-react';
import BottomNavigation from '@/components/BottomNavigation';

export default function NotificationsPage() {
    const { city, temperatureC } = useUserContext(); // Consume context
    const [filter, setFilter] = useState('all');

    // Dynamic Mock Data Generation
    const [notifications, setNotifications] = useState([]);

    useEffect(() => {
        // Mock data now adapts to the cityContext
        const currentCity = city || 'Roma';
        const currentTemp = temperatureC || 20;

        const initialNotifications = [
            {
                id: 1,
                type: 'tour_recommendation',
                title: 'Nuovo Tour Perfetto per Te!',
                message: `Tour gastronomico "Sapori di ${currentCity}" - Basato sui tuoi tour precedenti`,
                location: `${currentCity}, Centro`,
                time: '10 min fa',
                unread: true,
                image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=400&h=300&fit=crop',
                action: 'prenota',
                link: '/tour-details/1',
                price: '€45',
                category: 'tours'
            },
            {
                id: 2,
                type: 'weather_alert',
                title: 'Tempo Perfetto per Esplorare!',
                message: `Sole e ${currentTemp}°C a ${currentCity} - Ideale per il tour "Panorami Cittadini"`,
                location: currentCity,
                time: 'Oggi',
                unread: true,
                image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=300&fit=crop',
                action: 'scopri',
                link: '/tour-details/2',
                category: 'weather'
            },
            {
                id: 5,
                type: 'group_invite',
                title: 'Invito Tour di Gruppo',
                message: `Sofia ti ha invitato al tour "Walking ${currentCity}" del 15 febbraio`,
                location: currentCity,
                time: '4 ore fa',
                unread: false,
                image: 'https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=400&h=300&fit=crop',
                action: 'rispondi',
                link: '/tour-details/3?mode=group',
                category: 'social'
            }
        ];

        setNotifications(initialNotifications);
    }, [city, temperatureC]);

    const getNotificationIcon = (type) => {
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

    const getActionColor = (action) => {
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

    const markAsRead = (id) => {
        setNotifications(prev =>
            prev.map(n => n.id === id ? { ...n, unread: false } : n)
        );
    };

    const markAllAsRead = () => {
        setNotifications(prev => prev.map(n => ({ ...n, unread: false })));
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-ochre-100 to-ochre-200 pb-20 font-quicksand">
            {/* Header */}
            <div className="sticky top-0 z-20">
                <div className="absolute inset-0 bg-white/80 backdrop-blur-xl border-b border-white/40 shadow-sm" />
                <div className="relative">
                    <div className="flex items-center justify-between p-4">
                        <div className="flex items-center space-x-3">
                            <Link to="/dashboard-user">
                                <motion.button
                                    className="p-2 bg-white/50 hover:bg-white rounded-full transition-colors shadow-sm"
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                >
                                    <ArrowLeft className="w-5 h-5 text-gray-700" />
                                </motion.button>
                            </Link>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-800 tracking-tight">Notifiche</h1>
                            </div>
                        </div>
                        <div className="flex items-center space-x-2">
                            {unreadCount > 0 && (
                                <motion.button
                                    onClick={markAllAsRead}
                                    className="text-terracotta-500 hover:text-terracotta-600 text-xs font-bold px-3 py-1.5 bg-terracotta-50 rounded-full"
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                >
                                    Segna lette
                                </motion.button>
                            )}
                            <Link to="/notification-settings">
                                <motion.button
                                    className="p-2 bg-white/50 hover:bg-white rounded-full transition-colors shadow-sm"
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                >
                                    <Settings className="w-5 h-5 text-gray-700" />
                                </motion.button>
                            </Link>
                        </div>
                    </div>

                    {/* Modern Filter Tabs */}
                    <div className="px-4 pb-4">
                        <div className="flex space-x-3 overflow-x-auto scrollbar-hide py-1">
                            {[
                                { key: 'all', label: 'Tutte', icon: Bell },
                                { key: 'tours', label: 'Tour', icon: MapPin },
                                { key: 'social', label: 'Social', icon: Heart },
                                { key: 'weather', label: 'Meteo', icon: Sun }
                            ].map(({ key, label, icon: Icon }) => (
                                <motion.button
                                    key={key}
                                    onClick={() => setFilter(key)}
                                    className={`flex items-center space-x-2 px-4 py-2 rounded-full text-sm font-bold transition-all shadow-sm border ${filter === key
                                        ? 'bg-terracotta-500 border-terracotta-500 text-white shadow-terracotta-500/30'
                                        : 'bg-white/60 border-white/40 text-gray-600 hover:bg-white'
                                        }`}
                                    whileHover={{ scale: 1.05, y: -1 }}
                                    whileTap={{ scale: 0.95 }}
                                >
                                    <Icon className={`w-4 h-4 ${filter === key ? 'text-white' : 'text-gray-500'}`} />
                                    <span>{label}</span>
                                </motion.button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Notifications List */}
            <div className="p-4 space-y-4 max-w-lg mx-auto">
                <AnimatePresence mode="popLayout">
                    {filteredNotifications.map((notification, index) => (
                        <motion.div
                            key={notification.id}
                            className={`relative overflow-hidden backdrop-blur-md rounded-3xl transition-all ${notification.unread
                                ? 'bg-white/80 border-2 border-terracotta-400/30 shadow-xl shadow-terracotta-500/10'
                                : 'bg-white/50 border border-white/40 shadow-sm'
                                }`}
                            initial={{ opacity: 0, y: 20, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, x: -100, scale: 0.95 }}
                            transition={{ delay: index * 0.05, type: "spring", stiffness: 300, damping: 25 }}
                            layout
                            whileHover={{ scale: 1.01 }}
                        >
                            <div className="p-5 flex items-start gap-4">
                                {/* Icon Container */}
                                <div className="flex-shrink-0">
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg ${notification.type === 'tour_recommendation' ? 'bg-orange-100 text-orange-600' :
                                        notification.type === 'weather_alert' ? 'bg-yellow-100 text-yellow-600' :
                                            notification.type === 'group_invite' ? 'bg-purple-100 text-purple-600' :
                                                'bg-gray-100 text-gray-600'
                                        }`}>
                                        {getNotificationIcon(notification.type)}
                                    </div>
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start mb-1">
                                        <h3 className={`font-bold text-gray-800 leading-tight ${notification.unread ? 'text-gray-900' : 'text-gray-700/80'}`}>
                                            {notification.title}
                                        </h3>
                                        {notification.unread && (
                                            <div className="w-2 h-2 bg-terracotta-500 rounded-full mt-1.5 animate-pulse" />
                                        )}
                                    </div>

                                    <p className="text-sm text-gray-600 leading-relaxed mb-3">
                                        {notification.message}
                                    </p>

                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-3 text-xs text-gray-400 font-medium">
                                            <span>{notification.time}</span>
                                            {notification.location && (
                                                <span className="flex items-center text-gray-500">
                                                    <MapPin className="w-3 h-3 mr-0.5" />
                                                    {notification.location}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Action Button Area */}
                                    <div className="mt-4 flex items-center justify-end">
                                        <Link to={notification.link}>
                                            <motion.button
                                                className={`px-5 py-2 rounded-xl text-sm font-bold shadow-md flex items-center space-x-2 ${notification.action === 'prenota' ? 'bg-gradient-to-r from-terracotta-400 to-terracotta-500 text-white' :
                                                    notification.action === 'scopri' ? 'bg-gradient-to-r from-blue-400 to-blue-500 text-white' :
                                                        notification.action === 'rispondi' ? 'bg-gradient-to-r from-purple-400 to-purple-500 text-white' :
                                                            'bg-white text-gray-700 border border-gray-100'
                                                    }`}
                                                whileHover={{ scale: 1.05 }}
                                                whileTap={{ scale: 0.95 }}
                                            >
                                                <span>{notification.action.charAt(0).toUpperCase() + notification.action.slice(1)}</span>
                                                <ArrowRight className="w-3 h-3" />
                                            </motion.button>
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>

                {filteredNotifications.length === 0 && (
                    <div className="text-center py-20 opacity-60">
                        <div className="w-24 h-24 bg-white/40 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Bell className="w-10 h-10 text-gray-400" />
                        </div>
                        <p className="text-gray-600 font-medium">Nessuna notifica qui!</p>
                    </div>
                )}
            </div>

            <BottomNavigation />
        </div>
    );
}
