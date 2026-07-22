import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { dataService } from '../services/dataService';
import { computeWeights, weightsToAIProfile, tourAffinityScore, applyEvent } from '../services/preferenceEngine';

const STORAGE_KEY = 'unnivai_ai_learning_brain';
const MAX_INTERACTIONS = 30;
const SYNC_DEBOUNCE_MS = 3000;

/**
 * useAILearning — Preference Graph
 *
 * Traccia le interazioni dell'utente e costruisce un profilo di preferenze
 * che viene iniettato nei prompt AI per personalizzare itinerari.
 *
 * Persistenza:
 * - localStorage per accesso immediato (cache locale)
 * - Supabase user_preferences per persistenza cross-device
 * - Arricchimento incrementale: nuove interazioni si aggiungono, non sovrascrivono
 */
export function useAILearning() {
    const { user } = useAuth();
    const userId = user?.id;

    // Gate E-2: rimossi generatedToursCount + hasUnlockedPremium dallo state.
    // Servivano SOLO al paywall gate (hasHitPaywall = count>=10 && !unlocked).
    // Modello di lancio locked: nessun paywall in V1. L'unico limite è la
    // quota giornaliera (DAILY_QUOTA=10, DVAI-050) con messaggio onesto.
    const [learningState, setLearningState] = useState(() => {
        const defaults = {
            userDNAPreferences: [],
            preferenceGraph: {},  // { category: count, mood: count, ... }
            interactions: [],     // ultime 30 interazioni
            totalInteractions: 0,
            lastSyncedAt: null,
        };
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (!saved) return defaults;
            const parsed = JSON.parse(saved);
            // Merge con i default per tollerare versioni vecchie dello schema
            return {
                ...defaults,
                ...parsed,
                userDNAPreferences: Array.isArray(parsed?.userDNAPreferences) ? parsed.userDNAPreferences : [],
                interactions: Array.isArray(parsed?.interactions) ? parsed.interactions : [],
                preferenceGraph: (parsed?.preferenceGraph && typeof parsed.preferenceGraph === 'object') ? parsed.preferenceGraph : {},
                totalInteractions: Number.isFinite(parsed?.totalInteractions) ? parsed.totalInteractions : 0,
            };
        } catch {
            return defaults;
        }
    });

    const syncTimerRef = useRef(null);
    const hasSyncedFromDb = useRef(false);

    // ─── Sync da Supabase al mount (solo una volta) ──────────────────────────
    useEffect(() => {
        if (!userId || hasSyncedFromDb.current) return;
        hasSyncedFromDb.current = true;

        const loadFromDb = async () => {
            const dbPrefs = await dataService.getUserPreferences(userId);
            if (!dbPrefs) return;

            setLearningState(prev => {
                // Merge: DB ha priorità se più recente, ma non perdiamo dati locali
                const dbInteractions = Array.isArray(dbPrefs.interactions) ? dbPrefs.interactions : [];
                const localInteractions = Array.isArray(prev.interactions) ? prev.interactions : [];
                const localDNA = Array.isArray(prev.userDNAPreferences) ? prev.userDNAPreferences : [];
                const localGraph = (prev.preferenceGraph && typeof prev.preferenceGraph === 'object') ? prev.preferenceGraph : {};

                // Unisci interazioni, deduplicando per timestamp
                const allInteractions = [...dbInteractions, ...localInteractions];
                const seen = new Set();
                const merged = allInteractions.filter(i => {
                    const key = `${i.type}-${i.timestamp}-${i.category || ''}`;
                    if (seen.has(key)) return false;
                    seen.add(key);
                    return true;
                }).slice(0, MAX_INTERACTIONS);

                const mergedGraph = { ...(dbPrefs.preference_data || {}), ...localGraph };
                // Somma i conteggi per chiavi comuni
                for (const [key, val] of Object.entries(dbPrefs.preference_data || {})) {
                    if (typeof val === 'number' && typeof localGraph[key] === 'number') {
                        mergedGraph[key] = Math.max(val, localGraph[key]);
                    }
                }

                return {
                    ...prev,
                    preferenceGraph: mergedGraph,
                    interactions: merged,
                    totalInteractions: Math.max(dbPrefs.total_interactions || 0, prev.totalInteractions || 0),
                    // Mantieni DNA locale se più ricco
                    userDNAPreferences: localDNA.length >= dbInteractions.length
                        ? localDNA
                        : merged.filter(i => i.type === 'tour_generated').map(i => i.data).slice(0, 10),
                    lastSyncedAt: new Date().toISOString(),
                };
            });
        };
        loadFromDb();
    }, [userId]);

    // ─── Salva in localStorage ad ogni cambio ─────────────────────────────────
    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(learningState));
        } catch {}
    }, [learningState]);

    // ─── Sync debounced verso Supabase ────────────────────────────────────────
    const syncToDb = useCallback(() => {
        if (!userId) return;
        if (syncTimerRef.current) clearTimeout(syncTimerRef.current);

        syncTimerRef.current = setTimeout(async () => {
            await dataService.upsertUserPreferences(
                userId,
                learningState.preferenceGraph,
                learningState.interactions,
                learningState.totalInteractions,
            );
        }, SYNC_DEBOUNCE_MS);
    }, [userId, learningState.preferenceGraph, learningState.interactions, learningState.totalInteractions]);

    // ─── Traccia un'interazione generica ──────────────────────────────────────
    const trackInteraction = useCallback((type, data = {}) => {
        setLearningState(prev => {
            const interaction = {
                type,
                data,
                timestamp: new Date().toISOString(),
                category: data.category || data.type || null,
                city: data.city || null,
            };

            const updatedInteractions = [interaction, ...prev.interactions].slice(0, MAX_INTERACTIONS);

            // Aggiorna il preference graph (conteggi per categoria/mood/tipo)
            const graph = { ...prev.preferenceGraph };
            if (data.category) graph[`cat:${data.category}`] = (graph[`cat:${data.category}`] || 0) + 1;
            if (data.mood) graph[`mood:${data.mood}`] = (graph[`mood:${data.mood}`] || 0) + 1;
            if (data.type) graph[`type:${data.type}`] = (graph[`type:${data.type}`] || 0) + 1;
            if (data.city) graph[`city:${data.city}`] = (graph[`city:${data.city}`] || 0) + 1;
            if (data.duration) graph[`duration:${data.duration}`] = (graph[`duration:${data.duration}`] || 0) + 1;
            if (data.budget) graph[`budget:${data.budget}`] = (graph[`budget:${data.budget}`] || 0) + 1;

            return {
                ...prev,
                interactions: updatedInteractions,
                preferenceGraph: graph,
                totalInteractions: prev.totalInteractions + 1,
            };
        });

        // Debounced sync to Supabase
        syncToDb();
    }, [syncToDb]);

    // ─── Track tour generation (retrocompatibile) ─────────────────────────────
    // Gate E-2: rimosso incremento generatedToursCount (serviva solo al paywall).
    const trackGeneratedTour = useCallback((preferences) => {
        trackInteraction('tour_generated', preferences);

        setLearningState(prev => {
            const newPrefs = { ...preferences, date: new Date().toISOString() };
            const updatedDNA = [newPrefs, ...prev.userDNAPreferences].slice(0, 10);
            return {
                ...prev,
                userDNAPreferences: updatedDNA,
            };
        });
    }, [trackInteraction]);

    // ─── Track tour/POI view ──────────────────────────────────────────────────
    const trackTourView = useCallback((tour) => {
        trackInteraction('tour_view', {
            tourId: tour.id,
            category: tour.category || tour.type,
            city: tour.city,
            guideId: tour.guide_id || tour.guideId,
        });
    }, [trackInteraction]);

    // ─── Track category selection ─────────────────────────────────────────────
    const trackCategoryClick = useCallback((category, city) => {
        trackInteraction('category_click', { category, city });
    }, [trackInteraction]);

    // ─── Track search ─────────────────────────────────────────────────────────
    const trackSearch = useCallback((query, city) => {
        trackInteraction('search', { query, city });
    }, [trackInteraction]);

    // ─── Pesi normalizzati dal Preference Engine ────────────────────────────────
    const weights = useMemo(() => {
        return computeWeights(learningState.preferenceGraph, []);
    }, [learningState.preferenceGraph]);

    // ─── Build AI context string da pesi strutturati ─────────────────────────
    const getAIContext = useCallback(() => {
        // Fase 1 Gate DNA — SOLO il profilo pulito del preference engine, già
        // filtrato sulla whitelist di gusto CORE_CATEGORIES (via computeWeights /
        // normalizeCategory in preferenceEngine.js). Se non c'è segnale di gusto
        // valido → NIENTE (regola #1: nessun fallback produce contenuto).
        //
        // RIMOSSO il fallback legacy che leggeva le chiavi `cat:` GREZZE del grafo
        // (senza normalizzare): produceva testi tipo "Categorie preferite: guide,
        // Scelto per te, Consigliato dall'AI" — nomi di sezioni UI + una feature
        // spenta (guide) spacciati per gusti dentro il prompt AI.
        return weightsToAIProfile(weights) || '';
    }, [weights]);

    // ─── Score affinità per ranking tour ─────────────────────────────────────
    const getTourAffinity = useCallback((tour) => {
        return tourAffinityScore(tour, weights);
    }, [weights]);

    // Gate E-2: unlockPremium + hasHitPaywall rimossi. Il paywall gate è morto:
    // modello di lancio locked = nessun paywall in V1. Il PaywallModal component
    // resta nel repo per V2/V3 ma non è più raggiungibile da nessun codepath.

    return {
        ...learningState,
        weights, // Pesi normalizzati 0.0-1.0 per categorie
        trackGeneratedTour,
        trackTourView,
        trackCategoryClick,
        trackSearch,
        trackInteraction,
        getAIContext,
        getTourAffinity, // Score affinità tour (0-100)
    };
}
