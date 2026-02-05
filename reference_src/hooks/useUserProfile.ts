import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

interface UserProfile {
  name: string;
  firstName: string;
  lastName: string;
  initials: string;
  isDetected: boolean;
  isAuthenticated: boolean;
}

export function useUserProfile() {
  const [profile, setProfile] = useState<UserProfile>({
    name: 'Utente',
    firstName: 'Utente',
    lastName: '',
    initials: 'U',
    isDetected: false,
    isAuthenticated: false
  });

  // Query per ottenere dati utente autenticato
  const { data: authUser, isLoading, error } = useQuery({
    queryKey: ['/api/auth/me'],
    queryFn: async () => {
      const response = await fetch('/api/auth/me');
      if (!response.ok) {
        throw new Error('Not authenticated');
      }
      return response.json();
    },
    retry: false,
    refetchOnWindowFocus: false
  });

  useEffect(() => {
    if (authUser?.user) {
      // Utente autenticato - usa i dati reali
      const username = authUser.user.username;
      const names = username.split(' ');
      const firstName = names[0] || username;
      const lastName = names.slice(1).join(' ') || '';
      const initials = (firstName.charAt(0) + (lastName.charAt(0) || '')).toUpperCase();
      
      setProfile({
        name: username,
        firstName,
        lastName,
        initials,
        isDetected: true,
        isAuthenticated: true
      });
      
      console.log('✅ Profile aggiornato con dati utente autenticato:', { firstName, username });
    } else if (!isLoading && error) {
      // Non autenticato - prova rilevamento browser come fallback
      detectUserProfile();
    }
  }, [authUser, isLoading, error]);

  const detectUserProfile = () => {
    try {
      // Prova a rilevare il nome dal browser/sistema
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
          isAuthenticated: false
        });
      } else {
        // Usa sempre "Utente" per deployment consistente
        setProfile({
          name: 'Utente',
          firstName: 'Utente',
          lastName: '',
          initials: 'U',
          isDetected: false,
          isAuthenticated: false
        });
      }
    } catch (error) {
      console.warn('Could not detect user profile:', error);
    }
  };

  const getUserNameFromBrowser = (): string | null => {
    try {
      // Prova diversi metodi per rilevare il nome utente
      
      // 1. Credentials API (se disponibile)
      if ('credentials' in navigator) {
        // Questo richiederebbe permessi specifici
      }
      
      // 2. User-Agent parsing per alcuni browser
      const userAgent = navigator.userAgent;
      
      // 3. Controllo localStorage per nomi salvati in precedenza
      const savedName = localStorage.getItem('user_name');
      if (savedName) {
        return savedName;
      }
      
      // 4. Controllo sessione browser (se disponibile)
      
      // 5. Prova a estrarre dalle informazioni del dispositivo
      const platform = navigator.platform;
      
      return null;
    } catch (error) {
      console.warn('Browser name detection failed:', error);
      return null;
    }
  };

  const updateUserName = (newName: string) => {
    const names = newName.split(' ');
    const firstName = names[0] || 'Caro';
    const lastName = names.slice(1).join(' ') || 'Viaggiatore';
    const initials = (firstName.charAt(0) + (lastName.charAt(0) || '')).toUpperCase();
    
    const newProfile = {
      name: newName,
      firstName,
      lastName,
      initials,
      isDetected: true,
      isAuthenticated: profile.isAuthenticated // Mantiene stato autenticazione
    };
    
    setProfile(newProfile);
    localStorage.setItem('user_name', newName);
  };

  return {
    profile,
    updateUserName,
    detectUserProfile,
    isLoading,
    authUser: authUser?.user || null
  };
}