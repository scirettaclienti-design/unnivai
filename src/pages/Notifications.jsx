import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { totalTourMinutes } from '@/lib/tourTiming';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { useUserContext } from "@/hooks/useUserContext";
import { useUserNotifications } from '@/hooks/useUserNotifications';
import { useAILearning } from '@/hooks/useAILearning';
import { aiRecommendationService } from '@/services/aiRecommendationService';
import { getTimeSlot } from '@/hooks/useUserNotifications';
import { resolveCityCenter } from '@/services/cityCenterService';
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

// DVAI-056 — rifinitura estetica notifica meteo.
// Rimuove emoji dal titolo per lasciare la gerarchia pulita (time·città → titolo → descrizione → CTA).
const stripEmojis = (str = '') => str.replace(/\p{Extended_Pictographic}/gu, '').replace(/\s+/g, ' ').trim();

// Icona meteo coerente con la condizione meteo corrente.
const getWeatherIconByCondition = (condition = '') => {
    const c = condition.toLowerCase();
    if (['rain', 'drizzle', 'storm', 'cloud', 'piog', 'nuv'].some(k => c.includes(k))) return CloudRain;
    return Sun;
};

export default function NotificationsPage() {
    const { userId, city, firstName, temperatureC, weatherCondition, lat, lng, source } = useUserContext();
    const { toast } = useToast();
    const navigate = useNavigate();
    const [filter, setFilter] = useState('all');
    const [reviewModal, setReviewModal] = useState(null);
    const { trackInteraction } = useAILearning();

    // Blocco 2.1 FASE 2 — Precompute lazy del tour promesso dalla notifica.
    // Stato: 'idle' | 'loading' | 'ready' | 'error'
    // Gate T.1: rimosso 'cap_exceeded' — non c'e' piu' cap syswarm dopo N.2
    // (place/details Basic Data e' gratis).
    const [prewarm, setPrewarm] = useState({ status: 'idle', tourData: null });

    // Blocco 2.1 FASE 1 — Passa il ctx per la notifica-vera (GPS, meteo).
    const { notifications: rawNotifications, unreadCount, markAsRead, deleteNotification, markAllAsRead } = useUserNotifications(
        userId, city, firstName,
        // VOCE 1 — `source` dice se lat/lng vengono dal GPS o dalla citta'.
        // Senza, la notifica non puo' sapere se "da te" e' vero.
        { userLat: lat, userLng: lng, source, temperatureC, condition: weatherCondition }
    );

    const notifications = rawNotifications.map(n => ({
        ...n,
        unread: n.is_read !== true,
        time: n.created_at ? new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (n.timestamp ? new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Ora'),
        action: (n.actionType || n.actionText || 'dettagli').toLowerCase(),
        link: n.actionUrl || n.link || '#',
        // Gate R.1: category = 'tours' se la notifica ha chosenPois (=> tour
        // costruibile via precompute). Il type descrive il meteo/motivo, i
        // chosenPois descrivono la REALTA' del tour. Prima solo type ===
        // 'tour_recommendation' triggerava il branch precompute; le notifiche
        // slot morning/midday/afternoon (type = 'weather_alert') pur avendo
        // chosenPois cadevano nel branch <Link> statico verso /explore.
        // Ora il criterio e' avere POI, non avere un type specifico.
        category: (Array.isArray(n.chosenPois) && n.chosenPois.length > 0) ? 'tours' :
            (n.type === 'weather' || n.type === 'weather_alert') ? 'weather' :
                (n.type === 'social_activity' || n.type === 'group_invite') ? 'social' :
                    (n.type === 'guide_message' || n.type === 'price_offer' || n.type === 'request_accepted' || n.type === 'request_declined') ? 'messages' : 'altro'
    }));

    const [selectedNotification, setSelectedNotification] = useState(null);
    const [replyText, setReplyText] = useState('');
    const [isReplying, setIsReplying] = useState(false);

    // Blocco 2.1 FASE 2 — Precompute lazy: quando l'utente apre il modal di una
    // notifica "tours" con chosenPois, generiamo il tour in background.
    // L'utente legge il testo per 3-4 secondi: in quel tempo il tour è pronto.
    // Regola locked (Ivano): "il tour promesso deve contenere i POI citati".
    useEffect(() => {
        let cancelled = false;
        if (!selectedNotification || selectedNotification.category !== 'tours' || !Array.isArray(selectedNotification.chosenPois) || selectedNotification.chosenPois.length === 0) {
            setPrewarm({ status: 'idle', tourData: null });
            return;
        }
        setPrewarm({ status: 'loading', tourData: null });
        // Gate V: guard esterno con timeout 8s. Anche se i timeout su
        // fetchPlaceDetails (5s ciascuno, gate V) coprono il caso normale,
        // questo Promise.race garantisce che il modal ESCA dallo stato
        // 'loading' entro 8s in ogni caso — anche se il codice introduce
        // in futuro una nuova promise senza timeout. Regola locked (Ivano):
        // "ogni stato di loading ha un timeout e una via d'uscita".
        const PREWARM_TIMEOUT_MS = 8000;
        (async () => {
            try {
                const generateTask = (async () => {
                    const cityCenter = await resolveCityCenter(city);
                    // Gate N.2: precompute deterministico dai chosenPois.
                    return aiRecommendationService.generateSystemPrewarmTour(
                        city,
                        selectedNotification.chosenPois,
                        { condition: weatherCondition || 'sunny', temperature: temperatureC || 20 },
                        cityCenter,
                    );
                })();
                const timeoutTask = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('PREWARM_TIMEOUT')), PREWARM_TIMEOUT_MS)
                );
                const result = await Promise.race([generateTask, timeoutTask]);
                if (cancelled) return;
                if (result?.tourData) {
                    setPrewarm({ status: 'ready', tourData: result.tourData });
                    // Gate Y.1: RIMOSSO trackInteraction da qui. Un processo automatico
                    // (precompute) NON e' un'interazione utente. Regola locked (Ivano):
                    // "il tracking registra cio' che l'utente FA, non cio' che il sistema
                    // fa per lui". Inoltre: trackInteraction e' ricreato da useCallback
                    // ogni volta che learningState cambia (deps [syncToDb]). Averla nelle
                    // deps di questa useEffect provocava LOOP di re-mount infinito
                    // (setPrewarm ready -> track -> setLearningState -> syncToDb nuovo ->
                    // trackInteraction nuovo -> useEffect ri-scatta -> loop). Spinner
                    // infinito visto da Ivano su seconda apertura notifica.
                } else {
                    setPrewarm({ status: 'error', tourData: null });
                }
            } catch (err) {
                if (cancelled) return;
                const reason = err.message === 'PREWARM_TIMEOUT' ? `timeout (${PREWARM_TIMEOUT_MS}ms)` : err.message;
                console.warn('[SysPrewarm] modal precompute error:', reason);
                setPrewarm({ status: 'error', tourData: null });
            }
        })();
        return () => { cancelled = true; };
    // Gate Y.1: trackInteraction RIMOSSA dalle deps (causa loop, vedi commento sopra).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedNotification?.id, city, weatherCondition, temperatureC]);

    // Gate K — Un solo CTA "Vedi il giro" per le notifiche category='tours'.
    // Se il precompute è ready → naviga a TourDetails col tour precomputato.
    // Gate Y.1: il tracking sta QUI (click utente reale) invece che dentro
    // l'useEffect del precompute (che era un processo automatico).
    const handleVediGiro = () => {
        if (prewarm.status !== 'ready' || !prewarm.tourData) return;
        const day = prewarm.tourData.days?.[0];
        if (!day || !Array.isArray(day.stops) || day.stops.length === 0) return;
        // Gate Y.1: track un vero gesto utente.
        trackInteraction('notification_cta_click', { city, slot: getTimeSlot() });
        const tourId = 'notif-tour-' + Date.now();
        const tourData = {
            id: tourId,
            title: day.title || `Il tuo giro a ${city}`,
            city,
            // Gate RAGGIO DIFF 1a — somma a mano di `suggestedMinutes` rimossa.
            // Le stime arrivano gia' calcolate da generateSystemPrewarmTour, che
            // le produce dopo l'ordinamento definitivo.
            duration_minutes: totalTourMinutes(day.stops),
            // Gate O.2: nessun rating/price finto su un tour precomputed da notifica.
            stops: day.stops,
            isAiGenerated: true,
            highlights: day.stops.slice(0, 3).map(s => s.title),
        };
        setSelectedNotification(null);
        navigate(`/tour-details/${tourId}`, { state: { tourData, isAiGenerated: true } });
    };

    const handleNotificationClick = (notification) => {
        if (notification.unread) {
            markAsRead(notification.id);
        }
        setSelectedNotification(notification);
        setReplyText(''); // Reset reply on open
    };

    const handleReplySubmit = async () => {
        // Gate L: defense-in-depth. Il bottone è già disabled, ma se un giorno
        // viene sbloccato, il toast copre il caso.
        if (!replyText.trim()) {
            toast({ title: 'Scrivi la tua risposta prima di inviare.', type: 'info', duration: 3000 });
            return;
        }
        if (!selectedNotification?.actionData?.guide_id) return; // guard tecnica

        setIsReplying(true);
        const { sanitizedText, hasViolations } = sanitizeMessage(replyText.trim());

        try {
            const { error } = await supabase.from('notifications').insert({
                user_id: selectedNotification.actionData.guide_id,
                type: 'user_reply',
                title: `Risposta da ${firstName || 'Utente'}`,
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
        const cls = "w-5 h-5 text-obsidian-secondary";
        switch (type) {
            case 'tour_recommendation': return <MapPin className={cls} />;
            case 'weather_alert': return <Sun className={cls} />;
            case 'weather_change': return <CloudRain className={cls} />;
            case 'social_activity': return <Heart className={cls} />;
            case 'tour_reminder': return <Clock className={cls} />;
            case 'group_invite': return <Users className={cls} />;
            case 'guide_message': return <MessageCircle className={cls} />;
            case 'price_offer': return <Gift className={cls} />;
            case 'request_accepted': return <Check className={cls} />;
            case 'request_declined': return <X className={cls} />;
            default: return <Bell className={cls} />;
        }
    };

    const filteredNotifications = filter === 'archivio'
        ? notifications.filter(n => !n.unread)
        : filter === 'all'
            ? notifications // Show all in 'Tutte', maybe sort unread first (already sorted by time)
            : notifications.filter(n => n.category === filter); // Show read and unread for specific categories


    return (
        <div className="min-h-screen bg-obsidian-bg pb-24 font-quicksand">
            {/* Header Allineato al Telaio Ossidiana */}
            <div className="sticky top-0 z-20 bg-obsidian-bg border-b border-obsidian-border">
                <div className="relative">
                    <div className="flex items-center justify-between p-4">
                        <div className="flex items-center space-x-3">
                            <Link to="/dashboard-user">
                                <motion.button
                                    className="p-2 bg-obsidian-raised hover:bg-obsidian-card rounded-full transition-colors border border-obsidian-border"
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                >
                                    <ArrowLeft className="w-5 h-5 text-obsidian-primary" />
                                </motion.button>
                            </Link>
                            <div className="flex items-center gap-2.5">
                                <h1 className="text-2xl font-bold text-obsidian-primary tracking-tight">Notifiche</h1>
                                {unreadCount > 0 && (
                                    <span className="px-2 py-0.5 text-xs font-bold bg-brand-orange text-obsidian-bg rounded-full">
                                        {unreadCount}
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center space-x-2">
                            {unreadCount > 0 && (
                                <motion.button
                                    onClick={markAllAsRead}
                                    className="text-brand-orange hover:text-brand-orange-hover text-xs font-bold px-3 py-1.5 bg-obsidian-raised border border-obsidian-border rounded-full"
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                >
                                    Segna lette
                                </motion.button>
                            )}
                            <Link to="/notification-settings">
                                <motion.button
                                    className="p-2 bg-obsidian-raised hover:bg-obsidian-card rounded-full transition-colors border border-obsidian-border"
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                >
                                    <Settings className="w-5 h-5 text-obsidian-primary" />
                                </motion.button>
                            </Link>
                        </div>
                    </div>

                    {/* Modern Filter Tabs */}
                    <div className="px-4 pb-4">
                        <div className="flex space-x-2 overflow-x-auto scrollbar-hide py-1">
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
                                    className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all border shrink-0 ${filter === key
                                        ? 'bg-brand-orange border-brand-orange text-obsidian-bg shadow-md shadow-brand-orange/20'
                                        : 'bg-obsidian-card border-obsidian-border text-obsidian-secondary hover:text-obsidian-primary hover:bg-obsidian-raised'
                                        }`}
                                    whileHover={{ scale: 1.03 }}
                                    whileTap={{ scale: 0.97 }}
                                >
                                    <Icon className={`w-3.5 h-3.5 ${filter === key ? 'text-obsidian-bg' : 'text-obsidian-secondary'}`} />
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
                            onClick={() => handleNotificationClick(notification)}
                            className={`relative overflow-hidden rounded-3xl transition-all cursor-pointer ${notification.unread
                                ? 'bg-obsidian-card border border-obsidian-border shadow-lg'
                                : 'bg-obsidian-card/60 border border-obsidian-border/50 shadow-sm'
                                }`}
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, x: -50 }}
                            transition={{ delay: index * 0.04, duration: 0.25 }}
                            layout
                        >
                            <div className="p-4 flex items-start gap-3.5">
                                {/* Icon Container */}
                                <div className="flex-shrink-0">
                                    <div className="w-11 h-11 rounded-2xl bg-obsidian-raised border border-obsidian-border flex items-center justify-center text-obsidian-secondary shadow-sm">
                                        {getNotificationIcon(notification.type)}
                                    </div>
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start mb-1">
                                        <h3 className={`font-bold text-sm leading-snug ${notification.unread ? 'text-obsidian-primary' : 'text-obsidian-secondary'}`}>
                                            {notification.title}
                                        </h3>
                                        {notification.unread && (
                                            <div className="w-2 h-2 bg-brand-orange rounded-full mt-1.5 ml-2 shrink-0" />
                                        )}
                                    </div>

                                    <p className="text-xs text-obsidian-secondary leading-relaxed mb-3 line-clamp-2">
                                        {notification.message}
                                    </p>

                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-3 text-[11px] text-obsidian-secondary/70 font-medium">
                                            <span>{notification.time}</span>
                                            {notification.location && (
                                                <span className="flex items-center text-obsidian-secondary">
                                                    <MapPin className="w-3 h-3 mr-0.5" />
                                                    {notification.location}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="mt-3.5 flex items-center justify-between">
                                        {/* Action Button Area */}
                                        <div className="flex-1">
                                            {(() => {
                                                const chosen = Array.isArray(notification.chosenPois) ? notification.chosenPois : [];
                                                let label;
                                                if (chosen.length > 0 && chosen[0]?.name) {
                                                    const rawName = chosen[0].name;
                                                    const displayName = rawName.length > 22 ? rawName.slice(0, 21).trimEnd() + '…' : rawName;
                                                    const verb = chosen.length > 1 ? 'Parti da' : 'Vai a';
                                                    label = `${verb} ${displayName}`;
                                                } else {
                                                    label = notification.action.charAt(0).toUpperCase() + notification.action.slice(1);
                                                }
                                                return (
                                                    <motion.button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleNotificationClick(notification);
                                                        }}
                                                        className="px-4 py-2 rounded-xl text-xs font-bold bg-brand-orange text-obsidian-bg hover:bg-brand-orange-hover transition-colors shadow-md shadow-brand-orange/20 flex items-center space-x-1.5 w-max"
                                                        whileHover={{ scale: 1.02 }}
                                                        whileTap={{ scale: 0.98 }}
                                                    >
                                                        <span>{label}</span>
                                                        <ArrowRight className="w-3 h-3 text-obsidian-bg" />
                                                    </motion.button>
                                                );
                                            })()}
                                        </div>

                                        {/* Delete Button with confirmation */}
                                        <motion.button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (notification.type === 'price_offer' || notification.type === 'payment_confirmed') {
                                                    if (!window.confirm('Eliminare questa notifica?')) return;
                                                }
                                                deleteNotification(notification.id);
                                            }}
                                            className="p-2 ml-2 text-obsidian-secondary/70 hover:text-obsidian-primary bg-obsidian-bg border border-obsidian-secondary/40 hover:border-obsidian-secondary rounded-xl transition-all shadow-inner"
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.95 }}
                                            title="Elimina notifica"
                                        >
                                            <Trash2 className="w-3.5 h-3.5 stroke-[2.2]" />
                                        </motion.button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>

                {filteredNotifications.length === 0 && (
                    <div className="text-center py-20">
                        <div className="w-14 h-14 bg-obsidian-raised border border-obsidian-border rounded-2xl flex items-center justify-center mx-auto mb-3 text-obsidian-secondary">
                            <Bell className="w-6 h-6 stroke-[1.5]" />
                        </div>
                        <p className="font-semibold text-obsidian-primary text-sm mb-1">Nessuna notifica qui</p>
                        <p className="text-xs text-obsidian-secondary">I tuoi aggiornamenti, itinerari e messaggi appariranno qui.</p>
                    </div>
                )}
            </div>

            {/* Modal Dettaglio Notifica */}
            <AnimatePresence>
                {selectedNotification && (
                    <motion.div
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setSelectedNotification(null)}
                    >
                        <motion.div
                            className="bg-obsidian-card border border-obsidian-border text-obsidian-primary rounded-[28px] w-full max-w-sm overflow-hidden shadow-2xl"
                            initial={{ scale: 0.95, y: 15 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.95, y: 15 }}
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="p-6">
                                {(() => {
                                    // DVAI-056 — rifinitura estetica per notifica meteo/tour.
                                    // Nuova gerarchia: header meteo → time·città (piccolo) → titolo → descrizione → CTA scura.
                                    const isWeatherLike = selectedNotification.category === 'tours' || selectedNotification.category === 'weather';
                                    if (!isWeatherLike) return null;
                                    const WeatherIcon = getWeatherIconByCondition(weatherCondition);
                                    const cleanTitle = stripEmojis(selectedNotification.title);
                                    return (
                                        <>
                                            {/* Header: icona meteo + temperatura + città a sinistra, X a destra. Discreto. */}
                                            <div className="flex justify-between items-center mb-4">
                                                <div className="flex items-center gap-2 text-obsidian-secondary">
                                                    <WeatherIcon className="w-5 h-5 text-brand-orange" />
                                                    {typeof temperatureC === 'number' && (
                                                        <span className="text-sm font-semibold text-obsidian-primary">{Math.round(temperatureC)}°</span>
                                                    )}
                                                    {city && (
                                                        <span className="text-sm text-obsidian-secondary">· {city}</span>
                                                    )}
                                                </div>
                                                <button
                                                    onClick={() => setSelectedNotification(null)}
                                                    className="p-2 bg-obsidian-raised rounded-full text-obsidian-secondary hover:text-obsidian-primary border border-obsidian-border transition-colors"
                                                    aria-label="Chiudi"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>

                                            {/* Micro-caption: time·città (piccolo) */}
                                            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-obsidian-secondary font-medium mb-2">
                                                <Clock className="w-3 h-3" />
                                                <span>{selectedNotification.time}</span>
                                                {selectedNotification.location && (
                                                    <>
                                                        <span>·</span>
                                                        <span>{selectedNotification.location}</span>
                                                    </>
                                                )}
                                            </div>

                                            {/* Titolo pulito (senza emoji) */}
                                            <h2 className="text-xl font-bold text-obsidian-primary mb-2 leading-tight">{cleanTitle}</h2>

                                            {/* Descrizione */}
                                            <p className="text-obsidian-secondary text-sm mb-6 leading-relaxed whitespace-pre-wrap">
                                                {selectedNotification.message}
                                            </p>
                                        </>
                                    );
                                })()}

                                {/* Fallback: layout originale per notifiche non meteo/tour */}
                                {!(selectedNotification.category === 'tours' || selectedNotification.category === 'weather') && (
                                    <>
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="w-12 h-12 rounded-2xl bg-obsidian-raised border border-obsidian-border flex items-center justify-center text-obsidian-secondary shadow-lg">
                                                {getNotificationIcon(selectedNotification.type)}
                                            </div>
                                            <button
                                                onClick={() => setSelectedNotification(null)}
                                                className="p-2 bg-obsidian-raised rounded-full text-obsidian-secondary hover:text-obsidian-primary border border-obsidian-border transition-colors"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>

                                        <h2 className="text-xl font-bold text-obsidian-primary mb-2">{selectedNotification.title}</h2>
                                        <p className="text-obsidian-secondary text-sm mb-6 leading-relaxed whitespace-pre-wrap">
                                            {selectedNotification.message}
                                        </p>

                                        <div className="flex items-center space-x-3 text-xs text-obsidian-secondary mb-6 bg-obsidian-raised p-3 rounded-xl border border-obsidian-border">
                                            <Clock className="w-4 h-4" />
                                            <span>Ricevuta alle {selectedNotification.time}</span>
                                        </div>
                                    </>
                                )}

                                <div className="flex space-x-3 mt-4">
                                    {selectedNotification.category === 'messages' && selectedNotification.actionData?.guide_id ? (
                                        <div className="w-full">
                                            <textarea
                                                className="w-full bg-obsidian-bg border border-obsidian-border text-obsidian-primary placeholder:text-obsidian-secondary/50 rounded-xl p-3 text-xs focus:outline-none focus:border-brand-orange mb-3 resize-none"
                                                rows="3"
                                                placeholder="Scrivi la tua risposta qui..."
                                                value={replyText}
                                                onChange={(e) => setReplyText(e.target.value)}
                                            ></textarea>
                                            
                                            {(replyText.includes('[Numero Nascosto]') || replyText.includes('[Email Nascosta]')) ? (
                                                <div className="mb-3 flex gap-2 items-start bg-obsidian-raised p-3 rounded-xl border border-brand-orange/30 text-obsidian-primary text-xs">
                                                    <AlertTriangle size={14} className="flex-shrink-0 mt-0.5 text-brand-orange" />
                                                    <p><strong>Dati Sensibili Trovati:</strong> Per tutelare te e la Guida, non è consentito scambiarsi numeri o email fuori piattaforma prima della prenotazione.</p>
                                                </div>
                                            ) : (
                                                <div className="mb-3 flex items-center gap-1.5 text-[10px] text-obsidian-secondary">
                                                    <Shield size={10} /> I dati di contatto personali saranno sbloccati ad avvenuta chiusura della prenotazione.
                                                </div>
                                            )}

                                            <div className="flex gap-2">
                                                <button
                                                    onClick={handleReplySubmit}
                                                    disabled={isReplying || !replyText.trim()}
                                                    className="flex-1 py-3 bg-brand-orange hover:bg-brand-orange-hover disabled:bg-obsidian-raised disabled:text-obsidian-secondary/40 text-obsidian-bg rounded-xl font-bold text-center shadow-md transition-colors flex items-center justify-center gap-2 text-xs"
                                                >
                                                    <span>{isReplying ? 'Invio...' : 'INVIA RISPOSTA'}</span>
                                                    <ArrowRight className="w-4 h-4 text-obsidian-bg" />
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
                                                        className="flex-none py-3 px-4 bg-brand-orange hover:bg-brand-orange-hover text-obsidian-bg rounded-xl font-bold text-center transition-colors shadow-md flex items-center gap-2 text-xs"
                                                    >
                                                        <Star className="w-4 h-4" /> RECENSISCI
                                                    </button>
                                                ) : selectedNotification.type === 'price_offer' ? (
                                                    <button
                                                        onClick={handleAcceptOffer}
                                                        disabled={isCheckingOut}
                                                        className="flex-none py-3 px-4 bg-brand-orange hover:bg-brand-orange-hover disabled:bg-obsidian-raised disabled:text-obsidian-secondary/40 text-obsidian-bg rounded-xl font-bold text-center transition-colors shadow-md flex items-center gap-2 text-xs"
                                                    >
                                                        {isCheckingOut ? (
                                                            <>
                                                                <span className="w-4 h-4 border-2 border-obsidian-bg border-t-transparent rounded-full animate-spin" />
                                                                Avvio...
                                                            </>
                                                        ) : 'ACCETTA E PAGA'}
                                                    </button>
                                                ) : selectedNotification.action !== 'dettagli' ? (
                                                    <Link
                                                        to={selectedNotification.link}
                                                        state={selectedNotification.actionData?.request_id ? { openChatRequestId: selectedNotification.actionData.request_id } : {}}
                                                        className="flex-none py-3 px-4 bg-obsidian-raised hover:bg-obsidian-card border border-obsidian-border text-obsidian-primary rounded-xl font-bold text-center transition-colors text-xs"
                                                        onClick={() => setSelectedNotification(null)}
                                                    >
                                                        {selectedNotification.action.toUpperCase()}
                                                    </Link>
                                                ) : null}
                                            </div>
                                        </div>
                                    ) : selectedNotification.category === 'tours' ? (
                                        (() => {
                                            const stops = prewarm.tourData?.days?.[0]?.stops || [];
                                            const firstStop = stops[0];
                                            const rawName = firstStop?.title || firstStop?.name || '';
                                            const displayName = rawName.length > 22 ? rawName.slice(0, 21).trimEnd() + '…' : rawName;
                                            const verb = stops.length > 1 ? 'Parti da' : 'Vai a';
                                            return (
                                                <button
                                                    onClick={handleVediGiro}
                                                    disabled={prewarm.status !== 'ready'}
                                                    className={`w-full py-3 rounded-xl font-bold text-center shadow-lg transition-all flex items-center justify-center gap-1.5 text-xs whitespace-nowrap ${
                                                        prewarm.status === 'ready'
                                                            ? 'bg-brand-orange text-obsidian-bg hover:bg-brand-orange-hover cursor-pointer shadow-brand-orange/20'
                                                            : 'bg-obsidian-raised text-obsidian-secondary/50 border border-obsidian-border cursor-not-allowed'
                                                    }`}
                                                >
                                                    {prewarm.status === 'loading' ? (
                                                        <><Loader className="w-4 h-4 animate-spin text-obsidian-bg" /> Sto preparando il giro…</>
                                                    ) : prewarm.status === 'ready' && displayName ? (
                                                        <>{verb} {displayName} <ArrowRight className="w-4 h-4 text-obsidian-bg" /></>
                                                    ) : (
                                                        <>Non riesco a preparare il giro</>
                                                    )}
                                                </button>
                                            );
                                        })()
                                    ) : (
                                        <Link
                                            to={selectedNotification.link}
                                            className="flex-1"
                                            onClick={() => setSelectedNotification(null)}
                                        >
                                            <div className="w-full py-3 bg-brand-orange hover:bg-brand-orange-hover text-obsidian-bg rounded-xl font-bold text-center shadow-md transition-colors flex items-center justify-center gap-2 text-xs">
                                                <span>{selectedNotification.action.toUpperCase()}</span>
                                                <ArrowRight className="w-4 h-4 text-obsidian-bg" />
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
