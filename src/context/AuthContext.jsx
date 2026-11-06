import React, { createContext, useContext, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { SchermataCaricamento } from '../components/marchio/Marchio';
import { verificaLinkEmail } from '../lib/linkEmail';
import { leggiSessioneAlAvvio, chiediMemoriaStabile, SCOPE_ESCI } from '../lib/sessione';

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
                // LINK-DOMINIO: link dell'email con token_hash → verifica prima di leggere la sessione. `loading` resta
                // true finché non ha finito, così /update-password non rimanda a /login prima del tempo.
                const link = await verificaLinkEmail(supabase);
                if (link.esito === 'ok' && link.tipo === 'recovery') setIsPasswordRecovery(true);
                // LOGIN-SESSIONE: rete assente o lettura appesa non sono un «esci»: si resta dentro con la sessione salvata.
                const { session } = await leggiSessioneAlAvvio(supabase);
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

    // LOGIN-SESSIONE: una volta dentro, si chiede al browser di tenere la memoria del sito (non è un obbligo: silenzioso).
    const idUtente = user?.id || null;
    useEffect(() => {
        if (idUtente) chiediMemoriaStabile();
    }, [idUtente]);

    // 🛡️ LOADING SCREEN BLOCCANTE — ONBOARDING-ACCESSO: il marchio sul fondo dell'app (prima: bianca, «Loading Unnivai...»).
    if (loading) return <SchermataCaricamento />;

    // DVAI-008: Il ruolo viene letto ESCLUSIVAMENTE da user_metadata.role.
    // Rimosso il fallback localStorage: un utente non può più modificare il proprio
    // ruolo via DevTools per accedere a dashboard non autorizzate.
    // Le RLS Supabase proteggono i dati; questa modifica protegge anche l'UI.
    const role = user?.user_metadata?.role || (user ? 'user' : null);

    // 3. ACTIONS
    const signOut = async () => {
        setLoading(true);
        // LOGIN-SESSIONE: «Esci» chiude solo questo telefono (prima: scope 'global' = fuori da tutti i telefoni).
        await supabase.auth.signOut({ scope: SCOPE_ESCI });
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
            // Gate SEME (L2): la riga resta, e ora non e' piu' distruttiva. Qui
            // si cancella SOLO la cache locale: la fonte di verita' e'
            // user_preferences.onboarding_seed sul server, che il logout non
            // tocca e che useAILearning rilegge al primo mount autenticato.
            // Prima di L2 questa era l'UNICA copia esistente del seme, quindi il
            // logout lo distruggeva per sempre — la pulizia era comunque giusta
            // (su device condiviso il prossimo utente erediterebbe i gusti del
            // precedente), il difetto stava a monte: non c'era nessun altro
            // posto dove il seme vivesse.
            'unnivai_onboarding_seed_v1',
            // DNA-2: la cache del registro degli eventi (dati dell'utente: va pulita al logout).
            'unnivai_dna_registro_v1',
            // DOPPIO-FIX-2: l'ultimo Per Te (fatto col DNA dell'utente).
            'dvai_per_te_v1',
            // DNA-4: il conto delle rigenerazioni di Per Te dovute al DNA (legato all'utente).
            'dvai_per_te_dna_v1',
            // ONB-1: 'dvai_onboarding_done' NON e' piu' qui. "Onboarding fatto" e' un
            // dato dell'account (user_preferences.onboarding_seed); il flag nel browser
            // e' legato all'id utente (lib/onboardingStatus.js), quindi non puo' far
            // saltare l'onboarding a un altro account e non e' un leak. Cancellarlo
            // al logout non proteggeva nessuno e costringeva a un giro in piu' al rientro.
            'dvai_gps_data',
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
        // Gate AA.2: qui sopra abbiamo appena rimosso 'user_city' e
        // 'dvai_gps_data', cioe' abbiamo rimesso il prossimo utente nello
        // stato "senza citta'". Se il flag "onboarding gia' proposto"
        // sopravvivesse al logout, a quell'utente la citta' non verrebbe mai
        // chiesta nello stesso tab. Va pulito insieme alla citta'.
        try { sessionStorage.removeItem('dvai_city_onboarding_prompted'); } catch { /* storage ko */ }
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
        isPasswordRecovery,
        // ACCESSO-1: a password cambiata il recupero è finito (senza, RootDispatcher
        // riporterebbe l'utente su /update-password).
        fineRecupero: () => setIsPasswordRecovery(false),
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
