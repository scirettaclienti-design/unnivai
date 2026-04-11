import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    // STATE: Solo User e Loading. Niente complessità.
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

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
        localStorage.removeItem('unnivai_role');
        setUser(null);
        setIsPasswordRecovery(false); // Reset recovery state on logout
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
