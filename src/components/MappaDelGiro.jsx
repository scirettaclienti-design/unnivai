/**
 * PROFILO-SEZIONI — la mappa vera di un giro finito, nella scheda di «Rivivi». Si carica solo quando la scheda si apre (una mappa per
 * apertura, mai in elenco): stile Ossidiana, tappe numerate, il filo fra le tappe. Se Google non risponde resta il tracciato disegnato.
 */
import { useEffect } from 'react';
import { AdvancedMarker, APILoadingStatus, Map, useApiLoadingStatus, useMap } from '@vis.gl/react-google-maps';
import MapAPIWrapper from './MapAPIWrapper';
import { TracciatoGiro } from './TracciatoGiro';
import { mapIdPer, opzioniNavigazione } from '@/lib/mapId';
import { TESTI_PROFILO as T } from '@/lib/testiAccount';

const puntoDi = (s) => ({ lat: Number(s.lat ?? s.latitude), lng: Number(s.lng ?? s.longitude) });

/** I confini delle tappe, con un margine: una tappa sola resta inquadrata da vicino. */
export function confiniDelGiro(punti) {
    const lats = punti.map(p => p.lat), lngs = punti.map(p => p.lng);
    const margine = 0.0015;
    return { north: Math.max(...lats) + margine, south: Math.min(...lats) - margine, east: Math.max(...lngs) + margine, west: Math.min(...lngs) - margine, padding: 28 };
}

function Filo({ punti }) {
    const mappa = useMap();
    useEffect(() => {
        if (!mappa || punti.length < 2 || !window.google?.maps?.Polyline) return undefined;
        const linea = new window.google.maps.Polyline({ path: punti, map: mappa, strokeColor: '#F97316', strokeOpacity: 0.95, strokeWeight: 4 });
        return () => linea.setMap(null);
    }, [mappa, punti]);
    return null;
}

function Interna({ tappe, punti }) {
    const stato = useApiLoadingStatus();
    if (stato === APILoadingStatus.FAILED || stato === APILoadingStatus.AUTH_FAILURE) return <TracciatoGiro tappe={tappe} />;
    const nav = opzioniNavigazione({ giroAttivo: true });
    return (
        <div className="h-64 w-full" role="img" aria-label={T.MAPPA_ARIA} data-testid="rivivi-mappa">
            <Map
                mapId={mapIdPer({ giroAttivo: true })}
                {...(nav.colorScheme ? { colorScheme: nav.colorScheme } : {})}
                defaultBounds={confiniDelGiro(punti)}
                gestureHandling="cooperative"
                disableDefaultUI
                clickableIcons={false}
            >
                {punti.map((p, i) => (
                    <AdvancedMarker key={i} position={p}>
                        <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold bg-obsidian-card border-2 border-brand-orange text-obsidian-primary">{i + 1}</span>
                    </AdvancedMarker>
                ))}
                <Filo punti={punti} />
            </Map>
        </div>
    );
}

export default function MappaDelGiro({ tappe = [] }) {
    const punti = tappe.map(puntoDi).filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng));
    if (punti.length === 0) return null;
    return <MapAPIWrapper><Interna tappe={tappe} punti={punti} /></MapAPIWrapper>;
}
