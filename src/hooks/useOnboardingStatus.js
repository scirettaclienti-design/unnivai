import { useEffect, useState } from 'react';
import { localOnboardingDone, resolveOnboardingStatus } from '@/lib/onboardingStatus';

// ONB-1 — stato "onboarding" dell'utente: 'checking' | 'done' | 'todo' | 'unknown'.
// Parte da 'done' se la copia locale (legata a questo utente) lo dice, senza
// aspettare la rete; altrimenti chiede al DB. Cambiando utente si riparte.
export function useOnboardingStatus(userId) {
    const [resolved, setResolved] = useState({ userId: null, status: 'checking' });

    useEffect(() => {
        if (!userId || localOnboardingDone(userId)) return undefined;
        let alive = true;
        resolveOnboardingStatus(userId).then(status => {
            if (alive) setResolved({ userId, status });
        });
        return () => { alive = false; };
    }, [userId]);

    if (!userId) return 'checking';
    if (localOnboardingDone(userId)) return 'done';
    return resolved.userId === userId ? resolved.status : 'checking';
}
