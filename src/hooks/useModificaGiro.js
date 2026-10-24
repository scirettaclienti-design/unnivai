import { useCallback } from 'react';
import { chiaveTappa } from '@/lib/giroEdit';
import { togliDalGiorno, cambiaNelGiorno, tourConGiorno } from '@/services/giroEditAzioni';

/**
 * GIRO-EDIT — «Togli» e «Cambia» per le schede che tengono UN tour intero (Quiz, Sorprendimi, Per Te).
 * @param {object} p
 * @param {object|null} p.tour       il tour mostrato (con `steps`, o `stops`)
 * @param {(t: object) => void} p.aggiorna   mette il tour nuovo al posto di quello mostrato
 * @param {object} [p.dnaWeights]
 * @param {(msg: string) => void} [p.avviso] una riga per l'utente quando una tappa non si puo' togliere
 * @returns {{ onTogli: (stop: object) => void, onCambia: (stop: object, testo: string) => Promise<object> }}
 */
export function useModificaGiro({ tour, aggiorna, dnaWeights = {}, avviso = null }) {
    const stopsDi = () => (Array.isArray(tour?.steps) && tour.steps.length > 0 ? tour.steps : (Array.isArray(tour?.stops) ? tour.stops : []));
    const onTogli = useCallback((stop) => {
        const r = togliDalGiorno({ stops: stopsDi(), chiave: chiaveTappa(stop), city: tour?.city, tourId: tour?.id });
        if (!r.ok) { avviso?.('È l\'ultima tappa del giro: non si può togliere.'); return; }
        aggiorna(tourConGiorno(tour, r));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tour, aggiorna, avviso]);
    const onCambia = useCallback(async (stop, testo) => {
        const r = await cambiaNelGiorno({ stops: stopsDi(), chiave: chiaveTappa(stop), testo, city: tour?.city, dnaWeights, tourId: tour?.id });
        if (r.ok) aggiorna(tourConGiorno(tour, r));
        return r;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tour, aggiorna, dnaWeights]);
    return { onTogli, onCambia };
}
