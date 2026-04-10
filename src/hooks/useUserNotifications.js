import { useState, useEffect } from 'react';
import { aiRecommendationService } from '@/services/aiRecommendationService';
import { dataService } from '@/services/dataService';
import { supabase } from '@/lib/supabase';

const isGeneratedId = (id) => typeof id === 'string' && (id.startsWith('morning-') || id.startsWith('weekend-') || id.startsWith('weather-') || id.startsWith('sunny-'));

export function useUserNotifications(userId, city, firstName) {
    const [generatedNotifications, setGeneratedNotifications] = useState([]);
    const [realNotifications, setRealNotifications] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    const [readGenerated, setReadGenerated] = useState(() => {
        try { return JSON.parse(localStorage.getItem('read_generated_notifs') || '[]'); } catch (e) { return []; }
    });
    const [deletedGenerated, setDeletedGenerated] = useState(() => {
        try { return JSON.parse(localStorage.getItem('deleted_generated_notifs') || '[]'); } catch (e) { return []; }
    });

    // Initial load and subscription for Realtime Notifications
    useEffect(() => {
        if (!userId) return;

        const loadRealData = async () => {
            const data = await dataService.getNotifications(userId, city);
            setRealNotifications(data || []);
        };
        loadRealData();

        const channel = dataService.subscribeToNotifications(userId, (newNotif) => {
            // Optional client filter: only show if city_scope matches current city, or if no city_scope
            if (!newNotif.city_scope || newNotif.city_scope === city) {
                setRealNotifications(prev => [newNotif, ...prev]);
            }
        });

        return () => {
            if (channel) supabase.removeChannel(channel);
        };
    }, [userId, city]);

    // Load smart notifications
    useEffect(() => {
        const isGuideMode = localStorage.getItem('unnivai_mode') === 'guide';
        
        // Disable smart notifications on Guide dashboard and for guests without city
        if (city && !isGuideMode) {
            loadSmartNotifications();
            const interval = setInterval(loadSmartNotifications, 10 * 60 * 1000);
            return () => clearInterval(interval);
        }
    }, [userId, city, firstName]);

    const loadSmartNotifications = async () => {
        setIsLoading(true);
        try {
            const enhancedCalls = await generateLocationEnhancedNotifications(city, firstName);
            setGeneratedNotifications(enhancedCalls);
        } catch (error) {
            console.error('Errore Smart Notifications:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const generateLocationEnhancedNotifications = async (city, userName) => {
        const dateStr = new Date().toDateString();
        let enhancedNotifications = [];

        if (city) {
            try {
                // Call the new AI method for a dynamic tip
                const tip = await aiRecommendationService.generateWeatherSocialTip(city, userName);
                
                if (tip) {
                    enhancedNotifications.push({
                        id: `ai-tip-${city}-${dateStr}`,
                        type: 'weather_alert', 
                        priority: 'high',
                        title: tip.title || `Voglia di uscire a ${city}? 🌟`,
                        message: tip.message,
                        timestamp: new Date(),
                        actionText: 'Esplora',
                        actionUrl: '/explore',
                        locationBased: true,
                        category: 'weather'
                    });
                }
            } catch (e) {
                console.warn('Failed to fetch AI tip for notifications', e);
            }
        }

        const finalGenerated = enhancedNotifications
            .filter(n => !deletedGenerated.includes(n.id))
            .map(n => ({
                ...n,
                is_read: readGenerated.includes(n.id)
            }));

        return finalGenerated;
    };

    const notifications = [...realNotifications, ...generatedNotifications].sort((a, b) => {
        const timeA = new Date(a.created_at || a.timestamp || 0).getTime();
        const timeB = new Date(b.created_at || b.timestamp || 0).getTime();
        return timeB - timeA;
    });

    const unreadCount = notifications.filter(n => !n.is_read).length;

    const markAsRead = async (id) => {
        if (!isGeneratedId(id)) {
            await supabase.from('notifications').update({ is_read: true }).eq('id', id);
            setRealNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
        } else {
            const newRead = [...new Set([...readGenerated, id])];
            setReadGenerated(newRead);
            localStorage.setItem('read_generated_notifs', JSON.stringify(newRead));
            setGeneratedNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
        }
    };

    const deleteNotification = async (id) => {
        if (!isGeneratedId(id)) {
            await supabase.from('notifications').delete().eq('id', id);
            setRealNotifications(prev => prev.filter(n => n.id !== id));
        } else {
            const newDeleted = [...new Set([...deletedGenerated, id])];
            setDeletedGenerated(newDeleted);
            localStorage.setItem('deleted_generated_notifs', JSON.stringify(newDeleted));
            setGeneratedNotifications(prev => prev.filter(n => n.id !== id));
        }
    };

    const markAllAsRead = async () => {
        if (userId) {
            await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId);
        }
        setRealNotifications(prev => prev.map(n => ({ ...n, is_read: true })));

        const currentGeneratedIds = generatedNotifications.map(n => n.id);
        const newRead = [...new Set([...readGenerated, ...currentGeneratedIds])];
        setReadGenerated(newRead);
        localStorage.setItem('read_generated_notifs', JSON.stringify(newRead));

        setGeneratedNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    };

    return {
        notifications,
        unreadCount,
        isLoading,
        markAsRead,
        deleteNotification,
        markAllAsRead
    };
}
