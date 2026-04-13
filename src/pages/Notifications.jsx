import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { useUserContext } from "@/hooks/useUserContext";
import { useUserNotifications } from '@/hooks/useUserNotifications';
import { useAILearning } from '@/hooks/useAILearning';
import { aiRecommendationService } from '@/services/aiRecommendationService';
import { getTimeSlot } from '@/hooks/useUserNotifications';
import { supabase } from '@/lib/supabase';
import { sanitizeMessage } from '@/utils/chatSanitizer';
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
    Shield,
    AlertTriangle,
    MessageCircle,
    Camera,
    Gift,
    Sun,
    CloudRain,
    Users,
    Search,
    ArrowRight,
    Archive,
    Trash2,
    Sparkles,
    Loader
} from 'lucide-react';
import BottomNavigation from '@/components/BottomNavigation';
import ReviewModal from '@/components/ReviewModal';

export default function NotificationsPage() {
    const { userId, city, firstName, temperatureC, weatherCondition } = useUserContext();
    const { toast } = useToast();
    const navigate = useNavigate();
    const [filter, setFilter] = useState('all');
    const [reviewModal, setReviewModal] = useState(null);
    const [isGeneratingTour, setIsGeneratingTour] = useState(false);
    const { getAIContext, trackInteraction } = useAILearning();

    // Genera mini-tour AI in tempo reale dalla notifica
    const handleGenerateAITour = async (notification) => {
        setIsGeneratingTour(true);
        const slot = getTimeSlot();
        const slotHints = {
            morning: 'cultura, monumenti, passeggiate panoramiche',
            midday: 'gastronomia, mercati, street food',
            afternoon: 'musei, gallerie, shopping',
            evening: 'ristoranti, aperitivi, nightlife, panorami serali',
            night: 'locali, jazz bar, passeggiata notturna',
        };

        const aiProfile = getAIContext();
        const prompt = [
            `Mini-tour rapido di 3 tappe per ${slot === 'evening' ? 'questa sera' : 'adesso'} a ${city}.`,
            `Orario: ${slot} — focus su ${slotHints[slot] || 'esperienze locali'}.`,
            notification.title ? `Ispirazione: "${notification.title}"` : '',
            aiProfile ? `[Profilo utente: ${aiProfile}]` : '',
        ].filter(Boolean).join(' ');

        try {
            const result = await aiRecommendationService.generateItinerary(
                city,
                { duration: 'Mezza Giornata', interests: slotHints[slot] },
                prompt,
                { condition: weatherCondition || 'sunny', temperature: temperatureC || 20 }
            );

            const stops = (result.days || result)?.[0]?.stops || [];
            if (stops.length === 0) throw new Error('Nessuna tappa generata');

            const route = stops.map((s, i) => ({
                latitude: s.latitude,
                longitude: s.longitude,
                name: s.title,
                title: s.title,
                description: s.description,
                category: s.type || 'Punto Mappa',
                type: 'waypoint',
                index: i + 1,
            }));

            trackInteraction('notification_ai_tour', { city, slot, stopsCount: route.length });
            setSelectedNotification(null);
            navigate('/map', { state: { route, tourData: { title: `Tour ${slot === 'evening' ? 'Serale' : 'Rapido'} — ${city}`, city } } });
        } catch (err) {
            console.warn('[Notifications] AI tour generation failed:', err.message);
            toast({ title: 'Tour non disponibile', description: 'Riprova tra qualche secondo.', variant: 'warning' });
        } finally {
            setIsGeneratingTour(false);
        }
    };

    const { notifications: rawNotifications, unreadCount, markAsRead, deleteNotification, markAllAsRead } = useUserNotifications(userId, city, firstName);

    const notifications = rawNotifications.map(n => ({
        ...n,
        unread: n.is_read !== true,
        time: n.created_at ? new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (n.timestamp ? new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Ora'),
        action: (n.actionType || n.actionText || 'dettagli').toLowerCase(),
        link: n.actionUrl || n.link || '#',
        category: (n.type === 'tour_recommendation' || n.type === 'location' || n.type === 'recommendation') ? 'tours' :
            (n.type === 'weather' || n.type === 'weather_alert') ? 'weather' :
                (n.type === 'social_activity' || n.type === 'group_invite') ? 'social' :
                    (n.type === 'guide_message' || n.type === 'price_offer' || n.type === 'request_accepted' || n.type === 'request_declined') ? 'messages' : 'altro'
    }));

    const [selectedNotification, setSelectedNotification] = useState(null);
    const [replyText, setReplyText] = useState('');
    const [isReplying, setIsReplying] = useState(false);

    const handleNotificationClick = (notification) => {
        if (notification.unread) {
            markAsRead(notification.id);
        }
        setSelectedNotification(notification);
        setReplyText(''); // Reset reply on open
    };

    const handleReplySubmit = async () => {
        if (!replyText.trim() || !selectedNotification?.actionData?.guide_id) return;

        setIsReplying(true);
        const { sanitizedText, hasViolations } = sanitizeMessage(replyText.trim());

        try {
            const { error } = await supabase.from('notifications').insert({
                user_id: selectedNotification.actionData.guide_id,
                type: 'user_reply',
                title: `💬 Risposta da ${firstName || 'Utente'}`,
                message: sanitizedText,
                action_url: '/dashboard-guide',
                action_data: { request_id: selectedNotification.actionData.request_id },
                is_read: false,
                created_at: new Date().toISOString()
            });

            if (error) throw error;

            // Success
            if (hasViolations) {
                // Keep the modal open to show the sanitization warning, just update text
                setReplyText(sanitizedText);
            } else {
                setReplyText('');
                setSelectedNotification(null);
            }
        } catch (err) {
            console.error('Errore invio risposta:', err.message);
        } finally {
            setIsReplying(false);
        }
    };

    const [isCheckingOut, setIsCheckingOut] = useState(false);

    // DVAI-006: collegato a Stripe Checkout reale, rimosso alert()
    const handleAcceptOffer = async () => {
        if (!selectedNotification?.actionData?.guide_id || !selectedNotification?.actionData?.request_id) return;

        setIsCheckingOut(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Sessione scaduta. Effettua nuovamente il login.');

            const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL;
            const anonKey      = import.meta.env.VITE_SUPABASE_ANON_KEY;

            // Legge l'importo dall'actionData della notifica (impostato dalla guida)
            const totalAmount = selectedNotification.actionData?.price_eur
                ?? selectedNotification.actionData?.total_amount
                ?? 0;

            const res = await fetch(`${supabaseUrl}/functions/v1/create-checkout`, {
                method: 'POST',
                headers: {
                    'Content-Type':  'application/json',
                    'apikey':        anonKey,
                    'Authorization': `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                    requestId:   selectedNotification.actionData.request_id,
                    guideId:     selectedNotification.actionData.guide_id,
                    tourTitle:   selectedNotification.title ?? 'Tour DoveVai',
                    totalAmount,
                }),
            });

            const data = await res.json();

            if (!res.ok || !data.checkoutUrl) {
                throw new Error(data.error ?? 'Impossibile avviare il pagamento');
            }

            setSelectedNotification(null);
            // Redirect a Stripe Checkout (nuova tab per sicurezza)
            window.open(data.checkoutUrl, '_blank', 'noopener,noreferrer');

        } catch (err) {
            console.error('[Notifications] Errore avvio pagamento:', err.message);
            // DVAI-039 compat: usa setError locale (toast verrà integrato in DVAI-039)
            toast({ title: err.message, type: 'error' });
        } finally {
            setIsCheckingOut(false);
        }
    };

    const getNotificationIcon = (type) => {
        switch (type) {
            case 'tour_recommendation': return <MapPin className="w-5 h-5 text-terracotta-500" />;
            case 'weather_alert': return <Sun className="w-5 h-5 text-yellow-500" />;
            case 'weather_change': return <CloudRain className="w-5 h-5 text-blue-500" />;
            case 'social_activity': return <Heart className="w-5 h-5 text-red-500" />;
            case 'tour_reminder': return <Clock className="w-5 h-5 text-green-500" />;
            case 'group_invite': return <Users className="w-5 h-5 text-purple-500" />;
            case 'guide_message': return <MessageCircle className="w-5 h-5 text-blue-500" />;
            case 'price_offer': return <Gift className="w-5 h-5 text-green-500" />;
            case 'request_accepted': return <Check className="w-5 h-5 text-teal-500" />;
            case 'request_declined': return <X className="w-5 h-5 text-red-500" />;
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

    const filteredNotifications = filter === 'archivio'
        ? notifications.filter(n => !n.unread)
        : filter === 'all'
            ? notifications // Show all in 'Tutte', maybe sort unread first (already sorted by time)
            : notifications.filter(n => n.category === filter); // Show read and unread for specific categories


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
                                { key: 'messages', label: 'Messaggi', icon: MessageCircle },
                                { key: 'tours', label: 'Tour', icon: MapPin },
                                { key: 'social', label: 'Social', icon: Heart },
                                { key: 'weather', label: 'Meteo', icon: Sun },
                                { key: 'archivio', label: 'Lette', icon: Archive }
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

                                    <div className="mt-4 flex items-center justify-between">
                                        {/* Action Button Area */}
                                        <div className="flex-1">
                                            <motion.button
                                                onClick={() => handleNotificationClick(notification)}
                                                className={`px-5 py-2 rounded-xl text-sm font-bold shadow-md flex items-center space-x-2 w-max ${notification.action === 'prenota' ? 'bg-gradient-to-r from-terracotta-400 to-terracotta-500 text-white' :
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
                                        </div>

                                        {/* Delete Button with confirmation */}
                                        <motion.button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (notification.type === 'price_offer' || notification.type === 'payment_confirmed') {
                                                    // Conferma per notifiche importanti
                                                    if (!window.confirm('Eliminare questa notifica?')) return;
                                                }
                                                deleteNotification(notification.id);
                                            }}
                                            className="p-2 ml-2 text-gray-400 hover:text-red-500 bg-white hover:bg-red-50 border border-gray-100 hover:border-red-100 rounded-xl transition-colors"
                                            whileHover={{ scale: 1.1 }}
                                            whileTap={{ scale: 0.9 }}
                                            title="Elimina notifica"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </motion.button>
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

            {/* Modal Dettaglio Notifica */}
            <AnimatePresence>
                {selectedNotification && (
                    <motion.div
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setSelectedNotification(null)}
                    >
                        <motion.div
                            className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl"
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="p-6">
                                <div className="flex justify-between items-start mb-4">
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg ${selectedNotification.category === 'messages' ? 'bg-blue-100 text-blue-600' :
                                        selectedNotification.category === 'tours' ? 'bg-orange-100 text-orange-600' :
                                            'bg-gray-100 text-gray-600'
                                        }`}>
                                        {getNotificationIcon(selectedNotification.type)}
                                    </div>
                                    <button
                                        onClick={() => setSelectedNotification(null)}
                                        className="p-2 bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200 transition-colors"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                <h2 className="text-xl font-bold text-gray-900 mb-2">{selectedNotification.title}</h2>
                                <p className="text-gray-600 mb-6 leading-relaxed whitespace-pre-wrap">
                                    {selectedNotification.message}
                                </p>

                                <div className="flex items-center space-x-3 text-sm text-gray-500 mb-6 bg-gray-50 p-3 rounded-xl">
                                    <Clock className="w-4 h-4" />
                                    <span>Ricevuta alle {selectedNotification.time}</span>
                                </div>

                                <div className="flex space-x-3 mt-4">
                                    {selectedNotification.category === 'messages' && selectedNotification.actionData?.guide_id ? (
                                        <div className="w-full">
                                            <textarea
                                                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta-500/50 mb-3 resize-none"
                                                rows="3"
                                                placeholder="Scrivi la tua risposta qui..."
                                                value={replyText}
                                                onChange={(e) => setReplyText(e.target.value)}
                                            ></textarea>
                                            
                                            {(replyText.includes('[Numero Nascosto]') || replyText.includes('[Email Nascosta]')) ? (
                                                <div className="mb-3 flex gap-2 items-start bg-red-50 p-3 rounded-lg border border-red-100 text-red-700 text-xs">
                                                    <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                                                    <p><strong>Dati Sensibili Trovati:</strong> Per tutelare te e la Guida, non è consentito scambiarsi numeri o email fuori piattaforma prima della prenotazione. Cerca di non inserire numeri di telefono o email.</p>
                                                </div>
                                            ) : (
                                                <div className="mb-3 flex items-center gap-1.5 text-[10px] text-gray-400">
                                                    <Shield size={10} /> I dati di contatto personali saranno sbloccati ad avvenuta chiusura della prenotazione.
                                                </div>
                                            )}

                                            <div className="flex gap-2">
                                                <button
                                                    onClick={handleReplySubmit}
                                                    disabled={isReplying || !replyText.trim()}
                                                    className="flex-1 py-3 bg-terracotta-500 hover:bg-terracotta-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-xl font-bold text-center shadow-md transition-colors flex items-center justify-center gap-2"
                                                >
                                                    <span>{isReplying ? 'Invio...' : 'INVIA RISPOSTA'}</span>
                                                    <ArrowRight className="w-4 h-4" />
                                                </button>
                                                {selectedNotification.type === 'payment_confirmed' && selectedNotification.actionData?.guide_id ? (
                                                    <button
                                                        onClick={() => setReviewModal({
                                                            tourId: selectedNotification.actionData?.tour_id || null,
                                                            guideId: selectedNotification.actionData?.guide_id,
                                                            bookingId: selectedNotification.actionData?.reference_id || null,
                                                            guideName: selectedNotification.title?.match(/guida (.+)/i)?.[1] || '',
                                                            tourTitle: selectedNotification.message?.match(/tour (.+?)[\.\!]/i)?.[1] || '',
                                                        })}
                                                        className="flex-none py-3 px-4 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold text-center transition-colors shadow-md flex items-center gap-2"
                                                    >
                                                        <Star className="w-4 h-4" /> RECENSISCI
                                                    </button>
                                                ) : selectedNotification.type === 'price_offer' ? (
                                                    <button
                                                        onClick={handleAcceptOffer}
                                                        disabled={isCheckingOut}
                                                        className="flex-none py-3 px-4 bg-green-500 hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-xl font-bold text-center transition-colors shadow-md flex items-center gap-2"
                                                    >
                                                        {isCheckingOut ? (
                                                            <>
                                                                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                                Avvio...
                                                            </>
                                                        ) : 'ACCETTA E PAGA'}
                                                    </button>
                                                ) : selectedNotification.category === 'tours' ? (
                                                    <button
                                                        onClick={() => handleGenerateAITour(selectedNotification)}
                                                        disabled={isGeneratingTour}
                                                        className="flex-none py-3 px-4 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 disabled:from-gray-300 disabled:to-gray-400 text-white rounded-xl font-bold text-center transition-all shadow-md flex items-center gap-2"
                                                    >
                                                        {isGeneratingTour ? (
                                                            <>
                                                                <Loader className="w-4 h-4 animate-spin" />
                                                                Genero...
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Sparkles className="w-4 h-4" />
                                                                TOUR AI
                                                            </>
                                                        )}
                                                    </button>
                                                ) : selectedNotification.action !== 'dettagli' ? (
                                                    <Link
                                                        to={selectedNotification.link}
                                                        state={selectedNotification.actionData?.request_id ? { openChatRequestId: selectedNotification.actionData.request_id } : {}}
                                                        className="flex-none py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-center transition-colors"
                                                        onClick={() => setSelectedNotification(null)}
                                                    >
                                                        {selectedNotification.action.toUpperCase()}
                                                    </Link>
                                                ) : null}
                                            </div>
                                        </div>
                                    ) : selectedNotification.category === 'tours' ? (
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleGenerateAITour(selectedNotification)}
                                                disabled={isGeneratingTour}
                                                className="flex-1 py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 disabled:from-gray-300 disabled:to-gray-400 text-white rounded-xl font-bold text-center shadow-md transition-all flex items-center justify-center gap-2"
                                            >
                                                {isGeneratingTour ? (
                                                    <><Loader className="w-4 h-4 animate-spin" /> Genero tour...</>
                                                ) : (
                                                    <><Sparkles className="w-4 h-4" /> GENERA TOUR AI</>
                                                )}
                                            </button>
                                            <Link
                                                to={selectedNotification.link}
                                                className="flex-none py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-center transition-colors"
                                                onClick={() => setSelectedNotification(null)}
                                            >
                                                ESPLORA
                                            </Link>
                                        </div>
                                    ) : (
                                        <Link
                                            to={selectedNotification.link}
                                            className="flex-1"
                                            onClick={() => setSelectedNotification(null)}
                                        >
                                            <div className="w-full py-3 bg-terracotta-500 hover:bg-terracotta-600 text-white rounded-xl font-bold text-center shadow-md transition-colors flex items-center justify-center gap-2">
                                                <span>{selectedNotification.action.toUpperCase()}</span>
                                                <ArrowRight className="w-4 h-4" />
                                            </div>
                                        </Link>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <BottomNavigation />

            {reviewModal && (
                <ReviewModal
                    isOpen={!!reviewModal}
                    onClose={() => setReviewModal(null)}
                    tourId={reviewModal.tourId}
                    guideId={reviewModal.guideId}
                    bookingId={reviewModal.bookingId}
                    guideName={reviewModal.guideName}
                    tourTitle={reviewModal.tourTitle}
                />
            )}
        </div>
    );
}
