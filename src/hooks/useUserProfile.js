import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useUserProfile() {
    const [profile, setProfile] = useState({
        name: 'Utente',
        firstName: 'Utente',
        lastName: '',
        initials: 'U',
        isDetected: false,
        isAuthenticated: false,
        id: null // Added for DB relations
    });

    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let mounted = true;

        async function fetchSession() {
            try {
                // 1. Check active Supabase session
                const { data: { session }, error } = await supabase.auth.getSession();

                if (session?.user && mounted) {
                    // Authenticated User Flow
                    let dbRole = 'user';

                    // Try to fetch detailed profile from DB
                    try {
                        const { data: dbProfile } = await supabase
                            .from('profiles')
                            .select('role')
                            .eq('id', session.user.id)
                            .maybeSingle();

                        if (dbProfile?.role) {
                            dbRole = dbProfile.role;
                        }
                    } catch (e) {
                        console.warn('Profile sync warning (silent):', e);
                    }

                    const meta = session.user.user_metadata || {};
                    const emailName = session.user.email?.split('@')[0] || 'Utente';

                    const fullName = meta.full_name || meta.name || emailName;
                    const names = fullName.split(' ');
                    const firstName = names[0];
                    const lastName = names.slice(1).join(' ') || '';
                    const initials = (firstName.charAt(0) + (lastName.charAt(0) || '')).toUpperCase();

                    setProfile({
                        name: fullName,
                        firstName,
                        lastName,
                        initials,
                        isDetected: true,
                        isAuthenticated: true,
                        id: session.user.id,
                        email: session.user.email,
                        role: dbRole || meta.role || 'user'
                    });
                    console.log('✅ Profile authenticated via Supabase:', { firstName });
                } else {
                    // 2. Guest/Fallback Flow (Original Logic)
                    if (mounted) detectUserProfile();
                }
            } catch (err) {
                console.warn('Session check failed, falling back to guest mode:', err);
                if (mounted) detectUserProfile();
            } finally {
                if (mounted) setIsLoading(false);
            }
        }

        fetchSession();

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session?.user) {
                fetchSession();
            } else {
                detectUserProfile(); // Revert to guest on logout
            }
        });

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, []);

    const detectUserProfile = () => {
        try {
            // Prova a rilevare il nome dal browser/sistema (Existing Logic)
            const detectedName = getUserNameFromBrowser();

            if (detectedName && detectedName !== 'Unknown') {
                const names = detectedName.split(' ');
                const firstName = names[0] || 'Caro';
                const lastName = names.slice(1).join(' ') || 'Viaggiatore';
                const initials = (firstName.charAt(0) + (lastName.charAt(0) || '')).toUpperCase();

                setProfile({
                    name: detectedName,
                    firstName,
                    lastName,
                    initials,
                    isDetected: true,
                    isAuthenticated: false,
                    id: null
                });
            } else {
                // Default Guest
                setProfile({
                    name: 'Utente',
                    firstName: 'Utente',
                    lastName: '',
                    initials: 'U',
                    isDetected: false,
                    isAuthenticated: false,
                    id: null
                });
            }
        } catch (error) {
            console.warn('Could not detect user profile:', error);
        }
    };

    const getUserNameFromBrowser = () => {
        try {
            const savedName = localStorage.getItem('user_name');
            if (savedName) return savedName;
            return null;
        } catch (error) {
            return null;
        }
    };

    const updateUserName = (newName) => {
        const names = newName.split(' ');
        const firstName = names[0] || 'Caro';
        const lastName = names.slice(1).join(' ') || 'Viaggiatore';
        const initials = (firstName.charAt(0) + (lastName.charAt(0) || '')).toUpperCase();

        const newProfile = {
            ...profile,
            name: newName,
            firstName,
            lastName,
            initials,
            isDetected: true
        };

        setProfile(newProfile);
        localStorage.setItem('user_name', newName); // Local persistence for guest

        // Future: If authenticated, update Supabase 'profiles' table here
    };

    return {
        profile,
        updateUserName,
        detectUserProfile,
        isLoading,
        authUser: profile.isAuthenticated ? { id: profile.id, email: profile.email } : null
    };
}
