import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    // STATE: Solo User e Loading. Niente complessità.
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

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
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
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
                <div className="text-xl font-bold text-gray-700 animate-pulse">Loading Unnivai...</div>
            </div>
        );
    }

    // 🎭 ROLE HELPER (Minimalista)
    // Se c'è metadata, usalo. Altrimenti fallback storage o 'user'.
    const role = user?.user_metadata?.role || localStorage.getItem('unnivai_role') || (user ? 'user' : null);

    const value = {
        user,
        role,
        isAuthenticated: !!user,
        loading: false
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
