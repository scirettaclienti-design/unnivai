import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { dataService } from '../services/dataService';

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

    const [learningState, setLearningState] = useState(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) return JSON.parse(saved);
        } catch {}
        return {
            generatedToursCount: 0,
            userDNAPreferences: [],
            hasUnlockedPremium: false,
            preferenceGraph: {},  // { category: count, mood: count, ... }
            interactions: [],     // ultime 30 interazioni
            totalInteractions: 0,
            lastSyncedAt: null,
        };
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
                const localInteractions = prev.interactions || [];

                // Unisci interazioni, deduplicando per timestamp
                const allInteractions = [...dbInteractions, ...localInteractions];
                const seen = new Set();
                const merged = allInteractions.filter(i => {
                    const key = `${i.type}-${i.timestamp}-${i.category || ''}`;
                    if (seen.has(key)) return false;
                    seen.add(key);
                    return true;
                }).slice(0, MAX_INTERACTIONS);

                const mergedGraph = { ...(dbPrefs.preference_data || {}), ...prev.preferenceGraph };
                // Somma i conteggi per chiavi comuni
                for (const [key, val] of Object.entries(dbPrefs.preference_data || {})) {
                    if (typeof val === 'number' && typeof prev.preferenceGraph[key] === 'number') {
                        mergedGraph[key] = Math.max(val, prev.preferenceGraph[key]);
                    }
                }

                return {
                    ...prev,
                    preferenceGraph: mergedGraph,
                    interactions: merged,
                    totalInteractions: Math.max(dbPrefs.total_interactions || 0, prev.totalInteractions),
                    // Mantieni DNA locale se più ricco
                    userDNAPreferences: prev.userDNAPreferences.length >= dbInteractions.length
                        ? prev.userDNAPreferences
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
    const trackGeneratedTour = useCallback((preferences) => {
        trackInteraction('tour_generated', preferences);

        setLearningState(prev => {
            const newPrefs = { ...preferences, date: new Date().toISOString() };
            const updatedDNA = [newPrefs, ...prev.userDNAPreferences].slice(0, 10);
            return {
                ...prev,
                generatedToursCount: prev.generatedToursCount + 1,
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

    // ─── Build AI context string from preference graph ────────────────────────
    const getAIContext = useCallback(() => {
        const graph = learningState.preferenceGraph;
        if (!graph || Object.keys(graph).length === 0) return '';

        // Estrai top preferenze per tipo
        const topCategories = Object.entries(graph)
            .filter(([k]) => k.startsWith('cat:'))
            .sort(([, a], [, b]) => b - a)
            .slice(0, 3)
            .map(([k]) => k.replace('cat:', ''));

        const topMoods = Object.entries(graph)
            .filter(([k]) => k.startsWith('mood:'))
            .sort(([, a], [, b]) => b - a)
            .slice(0, 3)
            .map(([k]) => k.replace('mood:', ''));

        const topCities = Object.entries(graph)
            .filter(([k]) => k.startsWith('city:'))
            .sort(([, a], [, b]) => b - a)
            .slice(0, 3)
            .map(([k]) => k.replace('city:', ''));

        const prefDuration = Object.entries(graph)
            .filter(([k]) => k.startsWith('duration:'))
            .sort(([, a], [, b]) => b - a)[0];

        const parts = [
            topCategories.length ? `Categorie preferite: ${topCategories.join(', ')}.` : '',
            topMoods.length ? `Mood preferiti: ${topMoods.join(', ')}.` : '',
            topCities.length ? `Città esplorate: ${topCities.join(', ')}.` : '',
            prefDuration ? `Durata preferita: ${prefDuration[0].replace('duration:', '')}.` : '',
            learningState.totalInteractions > 5 ? `Utente esperto (${learningState.totalInteractions} interazioni).` : '',
        ].filter(Boolean);

        return parts.length > 0 ? parts.join(' ') : '';
    }, [learningState.preferenceGraph, learningState.totalInteractions]);

    const unlockPremium = useCallback(() => {
        setLearningState(prev => ({ ...prev, hasUnlockedPremium: true }));
    }, []);

    const hasHitPaywall = !learningState.hasUnlockedPremium && learningState.generatedToursCount >= 10;

    return {
        ...learningState,
        trackGeneratedTour,
        trackTourView,
        trackCategoryClick,
        trackSearch,
        trackInteraction,
        getAIContext,
        unlockPremium,
        hasHitPaywall,
    };
}
