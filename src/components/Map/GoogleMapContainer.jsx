import React, { useEffect, useRef, useState } from 'react';
import { Map, GoogleMapsContext, useMap } from '@vis.gl/react-google-maps';
import { MAP_ID, mapIdPer, opzioniNavigazione, mapIdFascia } from '@/lib/mapId';
import { DISSOLVENZA_MS, specchiaCamera } from '@/lib/mappaGiro';

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
export { MAP_ID };

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

const cameraDi = (m) => {
    const c = m?.getCenter?.();
    return c ? { lat: c.lat(), lng: c.lng(), zoom: m.getZoom?.(), tilt: m.getTilt?.(), heading: m.getHeading?.() } : null;
};

/**
 * LA MAPPA DEL GIRO (panoramica e navigazione): sempre Ossidiana (Map ID `VITE_GOOGLE_MAP_ID_NAV`, modalita' buio). Durante la navigazione la
 * mappa prende il colore della fascia oraria (`fascia`: mattina | tramonto | notte; `giorno` resta Ossidiana) con il suo Map ID, SENZA stacco:
 * la mappa della fascia si prepara sotto, compare in dissolvenza (~600 ms) quando ha caricato le tessere, poi la vecchia viene rilasciata.
 * Al massimo una dissolvenza per fascia. Marker, percorso e posizione (`children`) vivono una volta sola: seguono la mappa attiva.
 * `onMapAttiva(map)` dice alla pagina quale mappa comandare (durante la dissolvenza: una che applica la camera a tutte e due).
 */
function MappaGiro({ initialCenter, defaultZoom, heading, tilt, children, className, fascia, onMapAttiva, onDissolvenza, ...props }) {
    const defaultCenter = { lat: initialCenter.latitude, lng: initialCenter.longitude };
    const [strati, setStrati] = useState(() => [{ chiave: 'giro-a', mapId: mapIdFascia(null), visibile: true, camera: null }]);
    const [attivaChiave, setAttivaChiave] = useState('giro-a');
    const fatte = useRef(new Set());
    const fasciaAttuale = useRef(null);
    const mappaA = useMap('giro-a');
    const mappaB = useMap('giro-b');
    const mappe = { 'giro-a': mappaA, 'giro-b': mappaB };
    const attiva = mappe[attivaChiave] || null;
    const nuovaChiave = (k) => (k === 'giro-a' ? 'giro-b' : 'giro-a');

    // La fascia desiderata cambia → si prepara la mappa della fascia (una volta per fascia)
    useEffect(() => {
        const voluta = fascia || null;
        if (voluta === fasciaAttuale.current) return;
        const idVoluto = mapIdFascia(voluta);
        const strato = strati.find(x => x.chiave === attivaChiave);
        if (!idVoluto || !strato || strato.mapId === idVoluto) { fasciaAttuale.current = voluta; return; }
        if (strati.length > 1 || fatte.current.has(voluta)) return; // una dissolvenza alla volta, una per fascia
        fatte.current.add(voluta);
        fasciaAttuale.current = voluta;
        const k = nuovaChiave(attivaChiave);
        const camera = cameraDi(attiva);
        // (in un timer, non nel corpo dell'effetto; non si annulla: la fascia e' gia' segnata come fatta)
        setTimeout(() => setStrati(v => (v.length > 1 ? v : [...v, { chiave: k, mapId: idVoluto, visibile: false, camera }])), 0);
        return undefined;
    }, [fascia, strati, attivaChiave, attiva]);

    // La mappa nuova esiste: appena ha caricato le tessere compare in dissolvenza; poi la vecchia si rilascia
    const nuova = strati.length > 1 ? strati[1] : null;
    const nuovaMappa = nuova ? mappe[nuova.chiave] : null;
    useEffect(() => {
        if (!nuova || !nuovaMappa || nuova.visibile) return undefined;
        let finita = false, timer = null;
        const parti = () => {
            if (finita) return;
            finita = true;
            const t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
            // la stessa vista, e da qui la camera comanda tutte e due
            const c = cameraDi(attiva);
            if (c) nuovaMappa.moveCamera({ center: { lat: c.lat, lng: c.lng }, zoom: c.zoom, tilt: c.tilt, heading: c.heading });
            onMapAttiva?.(specchiaCamera(attiva, nuovaMappa));
            setStrati(v => v.map(x => (x.chiave === nuova.chiave ? { ...x, visibile: true } : x)));
            setTimeout(() => {
                setAttivaChiave(nuova.chiave);
                setStrati(v => v.filter(x => x.chiave === nuova.chiave));
                onMapAttiva?.(nuovaMappa);
                onDissolvenza?.({ fascia: fasciaAttuale.current, ms: Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0) });
            }, DISSOLVENZA_MS + 50);
        };
        const g = window.google?.maps?.event;
        const ascolto = g ? g.addListenerOnce(nuovaMappa, 'idle', parti) : null;
        timer = setTimeout(parti, 4000); // se le tessere tardano, compare comunque
        return () => { clearTimeout(timer); if (!finita) ascolto?.remove?.(); };
    }, [nuova, nuovaMappa, attiva, onMapAttiva, onDissolvenza]);

    // La pagina comanda la mappa attiva (la prima volta, quando esiste)
    useEffect(() => { if (attiva && strati.length === 1) onMapAttiva?.(attiva); }, [attiva, strati.length, onMapAttiva]);

    return (
        <div className={`w-full h-full relative isolate bg-obsidian-bg ${className}`} data-testid="mappa-giro" data-strati={strati.length} data-mapid-attivo={strati.find(x => x.chiave === attivaChiave)?.mapId || ''}>
            {strati.map((s, i) => (
                <div key={s.chiave} data-strato={s.chiave} className="absolute inset-0 bg-obsidian-bg"
                    style={{ opacity: s.visibile ? 1 : 0, transition: `opacity ${DISSOLVENZA_MS}ms ease`, zIndex: i + 1, pointerEvents: s.visibile && i === strati.length - 1 ? 'auto' : 'none' }}>
                    <Map
                        id={s.chiave}
                        defaultCenter={s.camera ? { lat: s.camera.lat, lng: s.camera.lng } : defaultCenter}
                        defaultZoom={s.camera?.zoom ?? defaultZoom}
                        mapId={s.mapId}
                        colorScheme="DARK"
                        renderingType="VECTOR"
                        gestureHandling="greedy"
                        defaultHeading={s.camera?.heading ?? heading}
                        defaultTilt={s.camera?.tilt ?? tilt}
                        zoomControl={window.innerWidth > 768}
                        mapTypeControl={false}
                        streetViewControl={false}
                        fullscreenControl={false}
                        {...props}
                    />
                </div>
            ))}
            {/* marker, percorso e posizione: una volta sola, sulla mappa attiva */}
            {attiva && <GoogleMapsContext.Provider value={{ map: attiva }}>{children}</GoogleMapsContext.Provider>}
        </div>
    );
}

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
    // nav-camera — la mappa del giro (panoramica + navigazione): Ossidiana sempre, colore della fascia in navigazione
    giroAttivo = false,
    fascia = null,
    onMapAttiva = null,
    onDissolvenza = null,
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
    // La mappa del giro: con la variabile, e se il chiamante non impone un suo Map ID
    if (!mapId && giroAttivo && mapIdFascia(null)) {
        return <MappaGiro initialCenter={initialCenter} defaultZoom={defaultZoom} heading={0} tilt={0} className={className}
            fascia={isNavigating ? fascia : null} onMapAttiva={onMapAttiva} onDissolvenza={onDissolvenza} {...props}>{children}</MappaGiro>;
    }
    const defaultCenter = {
        lat: initialCenter.latitude,
        lng: initialCenter.longitude,
    };

    // Altre mappe (Esplora, home): come prima
    const nav = opzioniNavigazione({ giroAttivo, isNavigating, mapId });
    return (
        <div className={`w-full h-full relative isolate ${className}`}>
            <Map
                defaultCenter={defaultCenter}
                defaultZoom={defaultZoom}
                mapId={mapIdPer({ giroAttivo, isNavigating, mapId })}
                {...(nav.colorScheme ? { colorScheme: nav.colorScheme } : {})}
                
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
