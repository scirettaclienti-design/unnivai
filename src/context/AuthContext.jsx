import React, { createContext, useContext, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    // STATE: Solo User e Loading. Niente complessità.
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

    // Hooks chiamati incondizionatamente PRIMA di qualsiasi early-return
    // (Rules of Hooks). queryClient serve a signOut() per pulire la cache.
    const queryClient = useQueryClient();

    useEffect(() => {
        // 1. CHECK SESSIONE STRICT
        const initAuth = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (session?.user) {
                    setUser(session.user);
                } else {
                    setUser(null);
                }
            } catch (error) {
                console.error("Auth Critical Error:", error);
                setUser(null);
            } finally {
                // SBLOCCO: Qualunque cosa accada, smettiamo di caricare
                setLoading(false);
            }
        };

        initAuth();

        // 2. LISTENER PASSIVO
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'PASSWORD_RECOVERY') {
                setIsPasswordRecovery(true);
            }
            setUser(session?.user || null);
            setLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    // 🛡️ LOADING SCREEN BLOCCANTE (RICHIESTO DA PROMPT)
    if (loading) {
        return (
            <div className="fixed inset-0 bg-white z-[9999] flex flex-col items-center justify-center">
                <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <div className="text-xl font-bold text-gray-700 animate-pulse">Loading DoveVai...</div>
            </div>
        );
    }

    // DVAI-008: Il ruolo viene letto ESCLUSIVAMENTE da user_metadata.role.
    // Rimosso il fallback localStorage: un utente non può più modificare il proprio
    // ruolo via DevTools per accedere a dashboard non autorizzate.
    // Le RLS Supabase proteggono i dati; questa modifica protegge anche l'UI.
    const role = user?.user_metadata?.role || (user ? 'user' : null);

    // 3. ACTIONS
    const signOut = async () => {
        setLoading(true);
        await supabase.auth.signOut();
        // Gate S.3 — cleanup completo di tutte le chiavi user-derived.
        // Audit fatto durante Gate S: se sopravvive al logout, prossimo utente
        // sullo stesso device vede lo stato del precedente (privacy leak).
        // Cache tecniche non-user (POI Discovery, cityCenter, insider tour)
        // NON vengono pulite: sono dati oggettivi condivisi, nessun leak.
        const localKeys = [
            'unnivai_role',
            'unnivai_ai_learning_brain',
            // Gate SEME (L1): bug di privacy preesistente — lo STORAGE_KEY attuale
            // e' 'unnivai_ai_learning_brain_v2', non veniva pulito: su device
            // condiviso il prossimo utente ereditava grafo e gusti del precedente.
            'unnivai_ai_learning_brain_v2',
            // Gate SEME (L1): seme onboarding, user-derived → va pulito al logout.
            'unnivai_onboarding_seed_v1',
            'dvai_gps_data',
            'dvai_onboarding_done',
            'user_tour_history',
            'unnivai_mode',
            'unnivai_favorites',
            'user_city',
            'dvai_notification_settings',
        ];
        localKeys.forEach(k => localStorage.removeItem(k));
        // Prefixed keys: le chiavi user-scoped (Gate S.2) hanno suffix
        // userId, quindi possono essere piu' di una per user diverso.
        // Rimuovi tutte le occorrenze con questi prefissi.
        Object.keys(localStorage)
            .filter(k => k.startsWith('read_generated_notifs') ||
                         k.startsWith('deleted_generated_notifs') ||
                         k.startsWith('unnivai_syswarm_') ||
                         k.startsWith('unnivai_declined_'))
            .forEach(k => localStorage.removeItem(k));
        // Session cache notifiche AI (dvai_smart_notif_${userId}-...)
        Object.keys(sessionStorage)
            .filter(k => k.startsWith('dvai_smart_notif_'))
            .forEach(k => sessionStorage.removeItem(k));
        queryClient.clear(); // Svuota tutta la cache React Query
        setUser(null);
        setIsPasswordRecovery(false);
        setLoading(false);
    };

    const resetPassword = async (email) => {
        return await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/update-password`,
        });
    };

    /**
     * DVAI-007: refreshRole — forza il re-fetch della sessione aggiornata.
     * Utile dopo signup/login quando user_metadata.role potrebbe non essere
     * ancora sincronizzato. Rimuove il fallback localStorage.
     */
    const refreshRole = async () => {
        try {
            const { data } = await supabase.auth.refreshSession();
            if (data?.session?.user) {
                setUser(data.session.user);
            }
        } catch (err) {
            console.error('[AuthContext] refreshRole failed:', err.message);
        }
    };

    const value = {
        user,
        role,
        isAuthenticated: !!user,
        loading: false, // UI is blocked anyway if true
        signOut,
        resetPassword,
        refreshRole,
        isPasswordRecovery
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
