import { useState, useEffect } from 'react';
import { aiRecommendationService } from '@/services/aiRecommendationService';
import { dataService } from '@/services/dataService';
import { supabase } from '@/lib/supabase';

const isGeneratedId = (id) =>
    typeof id === 'string' &&
    (id.startsWith('morning-') || id.startsWith('weekend-') || id.startsWith('weather-') ||
     id.startsWith('sunny-') || id.startsWith('ai-tip-') || id.startsWith('evening-') ||
     id.startsWith('afternoon-') || id.startsWith('night-') || id.startsWith('rain-'));

// ─── TIME SLOT LOGIC ──────────────────────────────────────────────────────────
/**
 * Restituisce il "momento del giorno" in base all'ora locale.
 * Usato per scegliere il tipo di consiglio e l'emoji corretta.
 * Niente sole alle 23, niente ristoranti alle 8 del mattino.
 */
export function getTimeSlot(hour = new Date().getHours()) {
    if (hour >= 6  && hour < 11) return 'morning';    // 06-10
    if (hour >= 11 && hour < 14) return 'midday';     // 11-13
    if (hour >= 14 && hour < 18) return 'afternoon';  // 14-17
    if (hour >= 18 && hour < 22) return 'evening';    // 18-21
    return 'night';                                    // 22-05
}

/**
 * Fallback statico — usato quando l'AI non risponde.
 * Coerente con orario E luogo: nessun "goditi il sole" alle 23.
 */
function getStaticFallback(city, slot, weatherHint = 'clear') {
    const isRain = ['rain', 'drizzle', 'storm', 'cloud'].some(w => weatherHint.toLowerCase().includes(w));

    const fallbacks = {
        morning: isRain
            ? { title: `Buongiorno a ${city} ☁️`, message: `Giornata uggiosa? Perfetta per un museo o un caffè storico a ${city}. Prenota un tour indoor! #DoveVAI`, actionUrl: '/explore', emoji: '☕' }
            : { title: `Buongiorno da ${city}! 🌅`, message: `L'ora migliore per esplorare ${city}: poca folla e luce perfetta. Scopri i tour del mattino! #DoveVAI`, actionUrl: '/explore', emoji: '🌅' },
        midday: isRain
            ? { title: `Pranzo al coperto a ${city} 🍝`, message: `Con la pioggia è l'occasione giusta per scoprire le trattorie storiche di ${city}. Esplora le esperienze food! #DoveVAI`, actionUrl: '/explore', emoji: '🍝' }
            : { title: `Pranzo a ${city}! 🍽️`, message: `È l'ora di scoprire i sapori autentici di ${city}. Trova un ristorante consigliato dalle nostre guide locali! #DoveVAI`, actionUrl: '/explore', emoji: '🍽️' },
        afternoon: isRain
            ? { title: `Pomeriggio indoor a ${city} 🏛️`, message: `Pioggia in vista? I musei e le gallerie d'arte di ${city} ti aspettano. Tour culturali disponibili! #DoveVAI`, actionUrl: '/map', emoji: '🏛️' }
            : { title: `Esplora ${city} nel pomeriggio 🗺️`, message: `Il momento ideale per le visite culturali a ${city}. Scopri i tour disponibili ora! #DoveVAI`, actionUrl: '/map', emoji: '🗺️' },
        evening: isRain
            ? { title: `Cena speciale a ${city} 🌙`, message: `Una serata perfetta per un ristorante accogliente a ${city}. Le nostre guide conoscono i migliori! #DoveVAI`, actionUrl: '/explore', emoji: '🌙' }
            : { title: `Buona serata a ${city}! 🌆`, message: `L'aperitivo al tramonto, la cena vista panorama: le esperienze serali di ${city} ti aspettano! #DoveVAI`, actionUrl: '/explore', emoji: '🌆' },
        night: isRain
            ? { title: `Notte tranquilla a ${city} 🌙`, message: `Pianifica già il tuo tour di domani a ${city}. Le guide più richieste si prenotano in anticipo! #DoveVAI`, actionUrl: '/ai-itinerary', emoji: '🌙' }
            : { title: `Pianifica la tua avventura 📅`, message: `Crea il tuo itinerario personalizzato per domani a ${city} con l'AI DoveVAI. Bastano 30 secondi! #DoveVAI`, actionUrl: '/ai-itinerary', emoji: '📅' },
    };

    return fallbacks[slot] || fallbacks.afternoon;
}

/**
 * Costruisce il prompt AI contestuale, passando ora e contesto meteo.
 * Evita suggerimenti assurdi (sole di notte, ristoranti alle 7).
 */
export function buildTimeAwarePrompt(city, userName, slot, weatherHint = 'soleggiato') {
    const slotDescriptions = {
        morning:   'mattina (6-10)',
        midday:    'mezzogiorno (11-13)',
        afternoon: 'pomeriggio (14-17)',
        evening:   'sera (18-21)',
        night:     'notte (22-05)',
    };

    const slotSuggestions = {
        morning:   'colazione, passeggiate, tour con poca folla, mercati del mattino',
        midday:    'pranzo tipico, ristoranti, osterie, trattorie, street food',
        afternoon: 'musei, gallerie, tour culturali, artigianato locale',
        evening:   'aperitivo, cena, ristoranti, locali con vista, esperienze gastronomiche',
        night:     'pianificazione del giorno dopo, suggerimenti per la mattina, itinerari AI',
    };

    const isRain = ['piog', 'nuv', 'temp', 'vento'].some(w => weatherHint.toLowerCase().includes(w));
    const indoorNote = isRain ? ' IMPORTANTE: suggerisci solo attività al coperto (musei, ristoranti, gallerie, workshop).' : '';

    return `Sei un esperto locale di ${city}. È ${slotDescriptions[slot]}, condizioni meteo: ${weatherHint}.${indoorNote}
Scrivi UN breve consiglio (max 140 caratteri) per ${userName || 'il viaggiatore'} suggerendo SOLO attività adatte a questo orario: ${slotSuggestions[slot]}.
NON suggerire il sole di notte, NON suggerire ristoranti la mattina presto.
Aggiungi un hashtag #DoveVAI alla fine.

Formato JSON:
{
  "title": "Titolo breve con emoji coerente all'orario (max 50 car)",
  "message": "Consiglio contestuale con hashtag (max 140 car)"
}`;
}

export function useUserNotifications(userId, city, firstName) {
    const [generatedNotifications, setGeneratedNotifications] = useState([]);
    const [realNotifications, setRealNotifications] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    const [readGenerated, setReadGenerated] = useState(() => {
        try { return JSON.parse(localStorage.getItem('read_generated_notifs') || '[]'); } catch { return []; }
    });
    const [deletedGenerated, setDeletedGenerated] = useState(() => {
        try { return JSON.parse(localStorage.getItem('deleted_generated_notifs') || '[]'); } catch { return []; }
    });

    // Realtime notifications da Supabase
    useEffect(() => {
        if (!userId) return;

        const loadRealData = async () => {
            try {
                const data = await dataService.getNotifications(userId, city);
                setRealNotifications(data || []);
            } catch (err) {
                console.warn('[Notifications] loadRealData failed:', err.message);
            }
        };
        loadRealData();

        let channel;
        try {
            channel = dataService.subscribeToNotifications(userId, (newNotif) => {
                if (!newNotif.city_scope || newNotif.city_scope === city) {
                    setRealNotifications(prev => [newNotif, ...prev]);
                }
            });
        } catch (err) {
            console.warn('[Notifications] subscribeToNotifications failed:', err.message);
        }

        return () => {
            if (channel) supabase.removeChannel(channel);
        };
    }, [userId, city]);

    // Smart notifications — time-aware
    useEffect(() => {
        const isGuideMode = localStorage.getItem('unnivai_mode') === 'guide';
        if (city && !isGuideMode) {
            loadSmartNotifications();
            // Rigenera ogni 30 min per adattarsi al cambio di fascia oraria
            const interval = setInterval(loadSmartNotifications, 30 * 60 * 1000);
            return () => clearInterval(interval);
        }
    }, [userId, city, firstName]);

    const loadSmartNotifications = async () => {
        setIsLoading(true);
        try {
            const notifications = await generateTimeAwareNotifications(city, firstName);
            setGeneratedNotifications(notifications);
        } catch (error) {
            console.warn('[SmartNotif] Generation failed:', error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const generateTimeAwareNotifications = async (city, userName) => {
        if (!city) return [];

        const now = new Date();
        const hour = now.getHours();
        const slot = getTimeSlot(hour);
        const dateStr = now.toDateString();
        const slotKey = `${slot}-${city}-${dateStr}`;

        // Evita rigenerazioni multiple nella stessa fascia oraria
        const cacheKey = `dvai_smart_notif_${slotKey}`;
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                return parsed.filter(n => !deletedGenerated.includes(n.id))
                             .map(n => ({ ...n, is_read: readGenerated.includes(n.id) }));
            } catch { /* ignora cache corrotta */ }
        }

        const results = [];

        // Non generare notifiche di notte (22-06) — solo silenzio
        if (slot === 'night') {
            // Notifica leggera per pianificazione domani
            const fallback = getStaticFallback(city, slot);
            results.push({
                id: `night-plan-${city}-${dateStr}`,
                type: 'recommendation',
                priority: 'low',
                title: fallback.title,
                message: fallback.message,
                timestamp: now,
                actionText: 'Pianifica',
                actionUrl: fallback.actionUrl,
                locationBased: true,
                category: 'tours',
                timeSlot: slot,
            });
        } else {
            // Tenta la chiamata AI con contesto orario
            try {
                const tip = await aiRecommendationService.generateWeatherSocialTip(city, userName, slot);
                if (tip?.title && tip?.message) {
                    results.push({
                        id: `ai-tip-${slotKey}`,
                        type: slot === 'evening' ? 'tour_recommendation' : 'weather_alert',
                        priority: slot === 'evening' ? 'high' : 'medium',
                        title: tip.title,
                        message: tip.message,
                        timestamp: now,
                        actionText: slot === 'evening' ? 'Prenota ora' : 'Esplora',
                        actionUrl: slot === 'evening' ? '/explore' : (slot === 'morning' ? '/map' : '/explore'),
                        locationBased: true,
                        category: slot === 'evening' ? 'tours' : 'weather',
                        timeSlot: slot,
                    });
                } else {
                    throw new Error('Empty AI response');
                }
            } catch {
                // Fallback statico coerente con l'orario
                const fallback = getStaticFallback(city, slot);
                results.push({
                    id: `static-${slotKey}`,
                    type: 'recommendation',
                    priority: slot === 'evening' ? 'high' : 'medium',
                    title: fallback.title,
                    message: fallback.message,
                    timestamp: now,
                    actionText: 'Scopri',
                    actionUrl: fallback.actionUrl,
                    locationBased: true,
                    category: slot === 'evening' ? 'tours' : 'weather',
                    timeSlot: slot,
                });
            }
        }

        // Cache in sessionStorage per evitare rigenerazioni inutili
        try {
            sessionStorage.setItem(cacheKey, JSON.stringify(results));
        } catch { /* ignora errori storage */ }

        return results
            .filter(n => !deletedGenerated.includes(n.id))
            .map(n => ({ ...n, is_read: readGenerated.includes(n.id) }));
    };

    const notifications = [...realNotifications, ...generatedNotifications].sort((a, b) => {
        const timeA = new Date(a.created_at || a.timestamp || 0).getTime();
        const timeB = new Date(b.created_at || b.timestamp || 0).getTime();
        return timeB - timeA;
    });

    const unreadCount = notifications.filter(n => !n.is_read).length;

    const markAsRead = async (id) => {
        if (!isGeneratedId(id)) {
            try {
                await supabase.from('notifications').update({ is_read: true }).eq('id', id);
            } catch (err) {
                console.warn('[Notifications] markAsRead failed:', err.message);
            }
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
            try {
                await supabase.from('notifications').delete().eq('id', id);
            } catch (err) {
                console.warn('[Notifications] delete failed:', err.message);
            }
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
            try {
                await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId);
            } catch (err) {
                console.warn('[Notifications] markAllAsRead failed:', err.message);
            }
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
        markAllAsRead,
    };
}
