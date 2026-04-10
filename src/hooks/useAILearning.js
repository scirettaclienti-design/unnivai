import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'unnivai_ai_learning_brain';

export function useAILearning() {
    const [learningState, setLearningState] = useState(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) return JSON.parse(saved);
        } catch (e) {
            console.error("Local Storage Error", e);
        }
        return {
            generatedToursCount: 0,
            userDNAPreferences: [], // Array of { mood, inspiration, duration, group, city, date }
            hasUnlockedPremium: false
        };
    });

    // Sincronizza lo state con il localStorage ogni volta che cambia
    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(learningState));
        } catch (e) {
            console.error("Failed to save learning state", e);
        }
    }, [learningState]);

    // Registra le scelte fatte dall'utente dopo una generazione andata a buon fine
    const trackGeneratedTour = useCallback((preferences) => {
        setLearningState(prev => {
            const newPrefs = { ...preferences, date: new Date().toISOString() };
            // Manteniamo massimo le ultime 10 preferenze per non ingombrare il prompt AI
            const updatedDNA = [newPrefs, ...prev.userDNAPreferences].slice(0, 10);
            return {
                ...prev,
                generatedToursCount: prev.generatedToursCount + 1,
                userDNAPreferences: updatedDNA
            };
        });
    }, []);

    // Metodo per sbloccare la modalità infinita (Dopo la Lead Gen o Pagamento)
    const unlockPremium = useCallback(() => {
        setLearningState(prev => ({
            ...prev,
            hasUnlockedPremium: true
        }));
    }, []);

    // Verifica se l'utente ha esaurito i tentativi freemium
    const hasHitPaywall = !learningState.hasUnlockedPremium && learningState.generatedToursCount >= 10;

    return {
        ...learningState,
        trackGeneratedTour,
        unlockPremium,
        hasHitPaywall,
    };
}
