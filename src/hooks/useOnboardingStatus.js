import { useEffect, useState } from 'react';
import { localOnboardingDone, resolveOnboardingStatus, primoIngressoNeiMetadati } from '@/lib/onboardingStatus';

// ONB-1 — stato "onboarding" dell'utente: 'checking' | 'done' | 'todo' | 'unknown'.
// Parte da 'done' se la copia locale (legata a questo utente) lo dice, senza
// aspettare la rete; altrimenti chiede al DB. Cambiando utente si riparte.
// ONBOARDING-ACCESSO: con i metadati dell'account (`user.user_metadata`) che dicono «primo ingresso fatto» è 'done'
// subito, su qualunque telefono.
export function useOnboardingStatus(userId, meta = null) {
    const fattoSulServer = primoIngressoNeiMetadati(meta);
    const [resolved, setResolved] = useState({ userId: null, status: 'checking' });

    useEffect(() => {
        if (!userId || fattoSulServer || localOnboardingDone(userId)) return undefined;
        let alive = true;
        resolveOnboardingStatus(userId).then(status => {
            if (alive) setResolved({ userId, status });
        });
        return () => { alive = false; };
    }, [userId, fattoSulServer]);

    if (!userId) return 'checking';
    if (fattoSulServer || localOnboardingDone(userId)) return 'done';
    return resolved.userId === userId ? resolved.status : 'checking';
}
