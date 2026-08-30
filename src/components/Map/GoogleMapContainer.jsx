import React from 'react';
import { Map } from '@vis.gl/react-google-maps';

// ─── MAP ID — SORGENTE UNICA ─────────────────────────────────────────────────
// Lo stile della mappa NON vive in questo repo: vive nello stile cloud legato a
// questo Map ID, in Google Cloud Console. Qui c'e' solo l'ID.
//
// L'env e' la sorgente; il literal e' un fallback DICHIARATO, non un ripiego
// silenzioso — se `VITE_GOOGLE_MAP_ID` manca, la mappa parte comunque sullo
// stile storico invece di non montarsi. Prima di questo commit il literal
// stava in DUE punti (qui e `schemas.js` come DEFAULT_MAP_ID) e l'env non
// veniva MAI raggiunto, perche' ogni mood di MAP_MOODS lo precedeva in un `||`.
//
// Il mapId NON si puo' togliere: regge `renderingType="VECTOR"` (mappa
// vettoriale e tilt 3D) e gli `AdvancedMarker` di UnnivaiMap. Toglierlo per
// far vivere uno stile inline spegnerebbe marker e 3D.
export const MAP_ID = import.meta.env.VITE_GOOGLE_MAP_ID || '28861a61c07876f819652d2d';

/*
 * ─── INTENZIONE DI DESIGN MAI APPLICATA, MIGRATA NELLO STILE CLOUD DEL MAP ID ─
 *
 * Qui viveva `DOVEVAI_MAP_STYLES`, 26 regole `google.maps.MapTypeStyle` passate
 * al <Map> come prop `styles`. Non hanno mai disegnato niente: Google IGNORA
 * `styles` quando e' presente un `mapId`, e un mapId c'e' sempre stato.
 * Erano una ricetta scritta e mai cucinata — chi leggeva il file credeva di
 * sapere che aspetto avesse la mappa, e non era vero.
 *
 * Non si butta una ricetta, si sposta: i valori sono qui sotto e vanno
 * riprodotti nello stile cloud in Console, che e' il solo posto dove hanno
 * effetto.
 *
 *   POI — spenti (per dare risalto ai NOSTRI marker):
 *     poi.business        labels    visibility off
 *     poi.medical         labels    visibility off
 *     poi.school          labels    visibility off
 *     poi.government      labels    visibility off
 *     poi.sports_complex  labels    visibility off
 *   POI — accesi:
 *     poi.attraction                visibility on
 *     poi.park                      visibility on
 *
 *   Sfondo (toni caldi, "crema"):
 *     landscape.man_made  geometry.fill   #faf5ef
 *     landscape.natural   geometry.fill   #f5efe6
 *
 *   Strade (pulite, minimaliste):
 *     road.highway        geometry.fill   #f0e4d4
 *     road.highway        geometry.stroke #e6d5c3
 *     road.arterial       geometry.fill   #ffffff
 *     road.local          geometry.fill   #ffffff
 *     road                labels.text.fill #8a7968
 *
 *   Acqua:
 *     water               geometry.fill   #c9dbe8
 *     water               labels.text.fill #7b9baa
 *
 *   Transit (discreto):
 *     transit             labels          visibility simplified
 *     transit.station     labels.icon     saturation -60
 */

export default function GoogleMapContainer({
    // Gate F38 — rimosso il default Roma (41.9028, 12.4964). `defaultCenter`
    // di @vis.gl e' UNCONTROLLED: letto SOLO al mount. Un default qui non era
    // un ripiego innocuo, era una condanna: la mappa ci restava inchiodata e
    // la si poteva muovere solo con flyTo imperativi. Ora il centro e'
    // obbligatorio, e chi monta questo componente deve gia' saperlo
    // (MapPage lo monta solo con centerStatus === 'resolved').
    initialCenter,
    defaultZoom = 13,
    heading = 0,
    tilt = 45,
    mapId,
    children,
    className = "",
    // -- PROPS TO STRIP (prevent re-renders/stutter in Map SDK) --
    activities,
    routePoints,
    userLocation,
    isNavigating,
    mapMood,
    suggestedTransit,
    activeCity,
    selectedId,
    onRouteStats,
    completedSteps,
    transportModeOverride,
    ...props
}) {
    // Fail-closed: senza centro non si monta una mappa su un posto inventato.
    // Il chiamante ha gia' il dovere di risolverlo (Gate F38).
    if (!Number.isFinite(initialCenter?.latitude) || !Number.isFinite(initialCenter?.longitude)) {
        console.warn('[Gate F38] GoogleMapContainer senza initialCenter valido → nessuna mappa');
        return null;
    }
    const defaultCenter = {
        lat: initialCenter.latitude,
        lng: initialCenter.longitude,
    };

    return (
        <div className={`w-full h-full relative isolate ${className}`}>
            <Map
                defaultCenter={defaultCenter}
                defaultZoom={defaultZoom}
                mapId={mapId || MAP_ID}
                
                // Vector Maps configuration for photorealistic 3D
                renderingType="VECTOR"
                gestureHandling="greedy"
                
                // CRITICAL FIX: Use default* props to stop React from forcing the camera, allowing native trackpad 60fps 3D panning.
                defaultHeading={heading}
                defaultTilt={tilt}
                
                zoomControl={window.innerWidth > 768}
                mapTypeControl={false}
                streetViewControl={false}
                fullscreenControl={false}
                {...props}
            >
                {children}
            </Map>
        </div>
    );
}
