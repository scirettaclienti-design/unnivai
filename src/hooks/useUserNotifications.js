import { useState, useEffect } from 'react';
import { aiRecommendationService } from '@/services/aiRecommendationService';
import { dataService } from '@/services/dataService';
import { supabase } from '@/lib/supabase';
import { resolveCityCenter } from '@/services/cityCenterService';
// Gate Q — Fabbrica spostata in modulo dedicato con marker anti-tampering
// (signature hash + salt privato). Nessuno fuori dalla fabbrica puo'
// produrre un record che passi isValidAiNotification.
import { makeAiNotification, isValidAiNotification } from '@/lib/aiNotificationFactory';

const isGeneratedId = (id) =>
    typeof id === 'string' &&
    (id.startsWith('morning-') || id.startsWith('weekend-') || id.startsWith('weather-') ||
     id.startsWith('sunny-') || id.startsWith('ai-tip-') || id.startsWith('evening-') ||
     id.startsWith('afternoon-') || id.startsWith('rain-'));

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

// Gate Q.1: getStaticFallback rimosso. Era un dizionario di 10 template
// hardcoded (5 slot × rain/no-rain) usato SOLO per il branch night. Il push
// notturno marcava a mano `engineVersion: NOTIFICATION_ENGINE_VERSION`
// bypassando makeAiNotification — la notifica "Bastano 30 secondi! #DoveVAI"
// del 13/07 usciva da qui. Slot night ora → silenzio.
// Regola locked: se non c'e' un motivo verificabile, non si genera niente.

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

export function useUserNotifications(userId, city, firstName, ctx = {}) {
    // Blocco 2.1 FASE 1 — ctx = { userLat, userLng, temperatureC, condition }.
    // Passato al generateWeatherSocialTip per costruire la notifica-vera:
    // - userLat/userLng = GPS reale (se GPS negato → null → notifica senza distanza)
    // - temperatureC + condition = classificatore weatherClass per la ricetta
    const [generatedNotifications, setGeneratedNotifications] = useState([]);
    const [realNotifications, setRealNotifications] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    // Gate S.2: chiavi user-scoped col suffix userId per evitare leak fra
    // utenti sullo stesso device (B che vede letto/eliminato di A).
    // Guest → suffix 'guest' (non ci sono azioni multi-account guest).
    const scopedKey = (base) => `${base}_${userId || 'guest'}`;
    const [readGenerated, setReadGenerated] = useState(() => {
        try { return JSON.parse(localStorage.getItem(scopedKey('read_generated_notifs')) || '[]'); } catch { return []; }
    });
    const [deletedGenerated, setDeletedGenerated] = useState(() => {
        try { return JSON.parse(localStorage.getItem(scopedKey('deleted_generated_notifs')) || '[]'); } catch { return []; }
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
    // Dep su ctx.userLat/lng/temp/condition: se cambiano (GPS reso disponibile,
    // meteo aggiornato) rigenera in modo che la notifica usi i dati nuovi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId, city, firstName, ctx.userLat, ctx.userLng, ctx.temperatureC, ctx.condition]);

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

        // Gate S.2: cache key con userId (guest → 'guest'). Utenti diversi
        // sullo stesso device hanno cache separate. Prima: dvai_smart_notif_
        // era senza userId e B leggeva la notifica di A (bug privacy).
        const cacheKey = `dvai_smart_notif_${userId || 'guest'}-${slotKey}`;
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                // Gate Q: filtro signature per-elemento (isValidAiNotification).
                // Gate S.1: filtro TTL 5 minuti al RENDER. Una notifica-vera nasce
                // su dati istantanei (ora, distanza dall'utente): fuori dalla
                // finestra dei 5 min il messaggio mente. Meglio silenzio +
                // rigenerazione che una notifica scaduta cliccabile.
                const FIVE_MIN_MS = 5 * 60 * 1000;
                const nowMs = Date.now();
                const valid = parsed
                    .filter(n => isValidAiNotification(n))
                    .filter(n => n?.timestamp && (nowMs - new Date(n.timestamp).getTime() < FIVE_MIN_MS));
                if (valid.length > 0) {
                    return valid.filter(n => !deletedGenerated.includes(n.id))
                                .map(n => ({ ...n, is_read: readGenerated.includes(n.id) }));
                }
                // Cache scaduta (TTL o signature) → rimuovi e rigenera sotto.
                sessionStorage.removeItem(cacheKey);
            } catch { /* ignora cache corrotta */ }
        }

        const results = [];

        // Gate Q.1: slot night (22-05) → silenzio. Nessuna notifica-ponte
        // "pianifica il domani". Coerente con Fase 1 e regola locked
        // "meglio silenzio che notifica inventata". Il vecchio branch
        // usava getStaticFallback (ora eliminato) e marcava engineVersion
        // a mano bypassando la fabbrica.
        if (slot !== 'night') {
            // Blocco 2.1 FASE 1 — Notifica-vera: pipeline recipe → Places → AI vincolata.
            // Se null (recipe mancante, 0 candidati Places, AI skip, AI cita
            // nomi non-in-lista) → NESSUNA notifica per questa fascia.
            let cityCenter = null;
            try {
                cityCenter = await resolveCityCenter(city);
            } catch (e) {
                console.info(`[SmartNotif] ${city}: cityCenter unresolvable (${e?.reason || e?.message}) → skip`);
            }

            if (cityCenter) {
                const tip = await aiRecommendationService.generateWeatherSocialTip(city, userName, slot, {
                    userLat: ctx.userLat,
                    userLng: ctx.userLng,
                    temperatureC: ctx.temperatureC,
                    condition: ctx.condition,
                    cityCenter,
                });
                if (tip?.title && tip?.message) {
                    // Gate Q: la fabbrica produce il record con signature opaca.
                    // Chi cerca di aggirare scrivendo `engineVersion:` a mano
                    // fallisce isValidAiNotification al retrieval.
                    results.push(makeAiNotification({
                        id: `ai-tip-${slotKey}`,
                        slot,
                        tip,
                        timestamp: now,
                        chosenPois: tip.chosenPois || [],
                    }));
                }
                // else: null → nessuna notifica pubblicata. Silenzio onesto.
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

    // Gate Z.1 — CHOKEPOINT UNICO di validita' notifica.
    // Prima: unreadCount contava lo state React (che poteva contenere notifiche
    // scadute), la lista in Notifications.jsx mostrava un altro subset ->
    // badge=1, lista=0 (bug fantasma di Ivano). Root cause: TTL 5min viveva
    // dentro generateTimeAwareNotifications, applicato solo al momento della
    // lettura cache, ma il risultato veniva congelato in useState. Il tempo
    // scorre, lo state no. Il badge contava il congelato.
    //
    // Fix: isNotificationLive(n) applicato in UN posto solo, prima di derivare
    // qualsiasi cosa. Se una notifica non e' mostrabile, non e' contata.
    // Regola locked (Ivano 14/07): "il conteggio e la lista leggono la STESSA
    // funzione. Se una notifica non si puo' mostrare, non si conta".
    const FIVE_MIN_MS = 5 * 60 * 1000;
    const nowMs = Date.now();
    const isNotificationLive = (n) => {
        if (!n) return false;
        // Notifiche generate client-side: hanno timestamp (Date/ISO), no created_at.
        // TTL 5 min (Gate S.1) — fuori dalla finestra i dati istantanei mentono.
        if (n.timestamp && !n.created_at) {
            const ts = new Date(n.timestamp).getTime();
            return Number.isFinite(ts) && (nowMs - ts < FIVE_MIN_MS);
        }
        // Notifiche DB (realNotifications): hanno created_at. No TTL — sono
        // notifiche persistenti che l'utente ha ricevuto e restano finche'
        // non le elimina/legge.
        return true;
    };

    const notifications = [...realNotifications, ...generatedNotifications]
        .filter(isNotificationLive)
        .sort((a, b) => {
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
            localStorage.setItem(scopedKey('read_generated_notifs'), JSON.stringify(newRead));
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
            localStorage.setItem(scopedKey('deleted_generated_notifs'), JSON.stringify(newDeleted));
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
        localStorage.setItem(scopedKey('read_generated_notifs'), JSON.stringify(newRead));
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
