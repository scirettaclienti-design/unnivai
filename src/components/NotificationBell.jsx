import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, MapPin, Sun, Heart, Clock, ArrowRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { aiRecommendationService } from '@/services/aiRecommendationService';
import { useUserContext } from '@/hooks/useUserContext';

import { dataService } from '@/services/dataService';
import { supabase } from '@/lib/supabase';
import { useUserNotifications } from '@/hooks/useUserNotifications';

export default function NotificationBell({ theme = 'dark' }) {
    const { userId, city, firstName, isGuest, lat, lng, temperatureC, weatherCondition } = useUserContext();
    const [showPreview, setShowPreview] = useState(false);
    // Blocco 2.1 FASE 1 — Passa il ctx per la notifica-vera (GPS, meteo).
    const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead } = useUserNotifications(
        userId, city, firstName,
        { userLat: lat, userLng: lng, temperatureC, condition: weatherCondition }
    );
    const navigate = useNavigate();

    const handleNotificationClick = (notification) => {
        setShowPreview(false);
        const url = notification.actionUrl || notification.action_url;
        const data = notification.actionData || notification.action_data;

        if (url) {
            if (data?.request_id) {
                navigate(url, { state: { openChatRequestId: data.request_id } });
            } else {
                navigate(url);
            }
        } else {
            navigate('/notifications');
        }
    };

    const getNotificationIcon = (type) => {
        switch (type) {
            case 'tour_recommendation': return <MapPin className="w-4 h-4 text-obsidian-secondary" />;
            case 'weather_alert': return <Sun className="w-4 h-4 text-obsidian-secondary" />;
            case 'social_activity': return <Heart className="w-4 h-4 text-obsidian-secondary" />;
            case 'tour_reminder': return <Clock className="w-4 h-4 text-obsidian-secondary" />;
            default: return <Bell className="w-4 h-4 text-obsidian-secondary" />;
        }
    };

    // Dynamic Colors based on Theme
    const isLight = theme === 'light';
    const containerClasses = isLight
        ? "relative p-3 bg-gray-100 hover:bg-gray-200 rounded-2xl transition-all duration-300 cursor-pointer border border-gray-200"
        : "relative p-3 bg-obsidian-card hover:bg-obsidian-raised rounded-2xl transition-all duration-300 cursor-pointer border border-obsidian-border";

    const iconColor = isLight ? "text-gray-700" : "text-obsidian-primary";

    return (
        <div className="relative"
             onMouseEnter={() => setShowPreview(true)}
             onMouseLeave={() => setShowPreview(false)}>
            <motion.div
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
            >
                <Link to="/notifications">
                    <motion.div
                        className={containerClasses}
                        whileHover={{
                            boxShadow: isLight ? "0 4px 15px rgba(0,0,0,0.1)" : "0 4px 20px rgba(0,0,0,0.5)",
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
                            <Bell className={`w-6 h-6 ${iconColor}`} />
                        </motion.div>

                        {unreadCount > 0 && (
                            <motion.div
                                className="absolute -top-2 -right-2 bg-brand-orange text-obsidian-bg text-xs rounded-full w-6 h-6 flex items-center justify-center font-bold shadow-lg shadow-brand-orange/30"
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
                                className="absolute -top-1 -right-1 w-4 h-4 bg-brand-orange rounded-full shadow-lg"
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
                        className="absolute top-full right-0 mt-3 w-80 sm:w-96 bg-obsidian-card border border-obsidian-border rounded-[24px] shadow-2xl z-50 overflow-hidden text-obsidian-primary font-quicksand"
                        initial={{ opacity: 0, y: -10, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.96 }}
                        transition={{ duration: 0.2 }}
                    >
                        {/* Header */}
                        <div className="p-4 border-b border-obsidian-border bg-obsidian-card">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                    <div className="w-6 h-6 bg-obsidian-raised border border-obsidian-border rounded-full flex items-center justify-center text-obsidian-secondary">
                                        <Bell className="w-3.5 h-3.5 text-obsidian-secondary" />
                                    </div>
                                    <h3 className="font-bold text-base text-obsidian-primary">Notifiche Smart</h3>
                                </div>
                                <Link to="/notifications">
                                    <motion.span
                                        className="bg-obsidian-raised hover:bg-obsidian-border border border-obsidian-border px-3 py-1 rounded-full text-xs font-semibold text-obsidian-secondary hover:text-obsidian-primary cursor-pointer transition-colors"
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                    >
                                        Vedi tutte
                                    </motion.span>
                                </Link>
                            </div>
                        </div>

                        <div className="p-3 space-y-2.5 max-h-80 overflow-y-auto">
                            {notifications.slice(0, 3).map((notification, index) => (
                                <motion.div
                                    key={index}
                                    className="group relative bg-obsidian-raised hover:bg-obsidian-raised/80 rounded-2xl p-3.5 transition-all duration-200 border border-obsidian-border cursor-pointer"
                                    onClick={() => handleNotificationClick(notification)}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                >
                                    <div className="relative flex items-start space-x-3">
                                        <div className="flex-shrink-0 w-9 h-9 bg-obsidian-card border border-obsidian-border rounded-xl flex items-center justify-center">
                                            {getNotificationIcon(notification.type)}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-sm font-bold text-obsidian-primary mb-1 leading-tight">
                                                {notification.title}
                                            </h4>
                                            <p className="text-xs text-obsidian-secondary leading-relaxed line-clamp-2 mb-2 font-medium">
                                                {notification.message}
                                            </p>

                                            {notification.location && (
                                                <div className="flex items-center space-x-1 text-xs text-obsidian-secondary mb-2.5">
                                                    <MapPin className="w-3 h-3 text-obsidian-secondary" />
                                                    <span>{notification.location}</span>
                                                </div>
                                            )}

                                            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-obsidian-card hover:bg-obsidian-border border border-obsidian-border text-obsidian-primary text-xs font-bold transition-colors shadow-sm">
                                                <span>{notification.actionType || 'Vedi'}</span>
                                                <ArrowRight className="w-3.5 h-3.5 text-obsidian-secondary" />
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>

                        {notifications.length > 3 && (
                            <div className="bg-obsidian-card/60 p-3 text-center border-t border-obsidian-border">
                                <Link to="/notifications">
                                    <div className="inline-flex items-center space-x-2 text-obsidian-secondary hover:text-obsidian-primary font-bold text-xs cursor-pointer transition-colors">
                                        <span>Altre {notifications.length - 3} notifiche</span>
                                        <ArrowRight className="w-3.5 h-3.5 text-obsidian-secondary" />
                                    </div>
                                </Link>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
