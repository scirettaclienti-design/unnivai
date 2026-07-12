import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useToast } from '../hooks/use-toast';

/**
 * Gate K — V1LockedGuard
 *
 * Blocca rotte che appartengono a funzioni fuori dal perimetro V1
 * (Guide V2, Business V3) redirigendo su /dashboard-user con toast onesto.
 *
 * Motivazione (locked Ivano): "se un utente ha già un profilo guide/business
 * e prova ad accedere, deve capire cosa succede, non finire su una 404 muta.
 * E in V2 si riaccende togliendo una riga."
 *
 * Uso:
 *   <Route path="/dashboard-guide" element={<V1LockedGuard><DashboardGuide /></V1LockedGuard>} />
 *
 * Quando lanceremo V2/V3, basta rimuovere il wrapping (o togliere
 * questo guard) — le pagine tornano attive senza rifare il router.
 */
export default function V1LockedGuard({ children: _children }) {
    const { toast } = useToast();
    const location = useLocation();

    useEffect(() => {
        toast({
            title: 'Disponibile prossimamente.',
            description: 'Questa funzione arriva in una prossima versione.',
            type: 'info',
            duration: 4000,
        });
    // location.pathname dep: toast riappare se l'utente naviga tra due rotte bloccate
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.pathname]);

    return <Navigate to="/dashboard-user" replace />;
}
