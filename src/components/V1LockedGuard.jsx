import React from 'react';
import { Navigate } from 'react-router-dom';

/**
 * Gate K → Gate W — V1LockedGuard
 *
 * Rotte fuori V1 (Guide V2 / Business V3) non fanno piu' redirect a
 * /dashboard-user con toast. Ora redirigono alla schermata Prossimamente
 * dedicata (contenuto: che cosa sara', a chi serve, quando arriva, cosa
 * fare ora). Un "Prossimamente" fatto bene e' una promessa, non un buco.
 *
 * Motivazione (locked Ivano 14/07): "l'utente NON vuole che la sezione
 * sparisca: vuole capire che e' un servizio in arrivo, secondo l'iter
 * V1 (viaggiatore+AI) -> V2 (guide) -> V3 (attivita')".
 *
 * Uso:
 *   <Route path="/dashboard-guide" element={<V1LockedGuard kind="guide"><DashboardGuide /></V1LockedGuard>} />
 *   <Route path="/dashboard-business" element={<V1LockedGuard kind="attivita"><DashboardBusiness /></V1LockedGuard>} />
 *
 * Quando V2/V3 saranno pronte, basta rimuovere il wrapping (o il guard).
 * Le pagine wrappate tornano attive senza rifare il router.
 */
export default function V1LockedGuard({ kind = 'guide', children: _children }) {
    return <Navigate to={`/prossimamente/${kind}`} replace />;
}
