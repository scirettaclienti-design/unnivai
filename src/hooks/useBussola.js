import { useEffect, useRef, useState } from 'react';

/**
 * La bussola del telefono (gradi, 0 = nord), o null se non c'e' / non e' permessa. iOS: `webkitCompassHeading` (serve il permesso, che si chiede
 * UNA volta, dentro un tocco: `chiediPermesso()` va chiamata dal gestore di «Avvia»). Android/altri: `deviceorientationabsolute` (alpha).
 * Senza bussola la camera segue la direzione del percorso (cameraNav.direzioneDiMarcia).
 * @param {boolean} attiva ascolta solo durante la navigazione
 */
export function useBussola(attiva) {
    const [bussola, setBussola] = useState(null);
    const permesso = useRef(false);
    const [abilitata, setAbilitata] = useState(() => typeof window !== 'undefined' && typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission !== 'function');

    useEffect(() => {
        if (!attiva || !abilitata || typeof window === 'undefined') return undefined;
        const su = (e) => {
            const h = Number.isFinite(e.webkitCompassHeading) ? e.webkitCompassHeading
                : (e.absolute && Number.isFinite(e.alpha) ? (360 - e.alpha) % 360 : null);
            if (Number.isFinite(h)) setBussola(Math.round(h));
        };
        window.addEventListener('deviceorientationabsolute', su, true);
        window.addEventListener('deviceorientation', su, true);
        return () => { window.removeEventListener('deviceorientationabsolute', su, true); window.removeEventListener('deviceorientation', su, true); };
    }, [attiva, abilitata]);

    /** Da chiamare dentro un tocco (iOS chiede il permesso una volta). Mai bloccante. */
    const chiediPermesso = async () => {
        if (permesso.current || typeof DeviceOrientationEvent === 'undefined') return;
        permesso.current = true;
        try {
            if (typeof DeviceOrientationEvent.requestPermission === 'function') {
                const r = await DeviceOrientationEvent.requestPermission();
                if (r === 'granted') setAbilitata(true);
            }
        } catch { /* niente bussola: la camera segue il percorso */ }
    };
    return { bussola, chiediPermesso };
}
