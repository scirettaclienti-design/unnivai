/**
 * NAV-1 — all'apertura dell'app (fuori dalla mappa) un giro salvato si propone una volta:
 * «Riprendi» porta alla mappa col tour e riprende la navigazione dalla tappa giusta;
 * «Chiudi il giro» lo cancella. Sulla mappa ci pensa MapPage (stesso dialogo).
 * Un giro iniziato da più di 12 ore non si propone (navSession.leggiGiro).
 */
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { leggiGiro, chiudiGiro, puntoDelGiro } from '../lib/navSession';
import GiroRipresaDialog from './Map/GiroRipresaDialog';

export default function GiroInCorso() {
    const { user } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [giro, setGiro] = useState(null);
    const [visto, setVisto] = useState(false);
    const suMappa = location.pathname === '/map';

    useEffect(() => {
        if (visto || !user || suMappa) return;
        const g = leggiGiro();
        if (g && puntoDelGiro(g).m > 0) setGiro(g);
        setVisto(true);
    }, [user, suMappa, visto]);

    if (!giro || suMappa) return null;
    return (
        <GiroRipresaDialog
            {...puntoDelGiro(giro)}
            onRiprendi={() => {
                const g = giro;
                setGiro(null);
                navigate('/map', { state: { tourData: g.tourData, riprendiGiro: true } });
            }}
            onChiudi={() => { chiudiGiro(); setGiro(null); }}
        />
    );
}
