/**
 * APP-NATIVA — la posizione del giro dal plugin nativo `PosizioneGiro` (ios/App/App/PosizioneGiroPlugin.swift),
 * vestita come `navigator.geolocation` (watchPosition / clearWatch), così `avviaTracciamento` (navTracking.js)
 * non cambia: stessi stati attesa | ok | perso | negato, stesso contratto per MapPage.
 *
 * Perché: nella WKWebView `watchPosition` si ferma a schermo bloccato (WebKit non attiva
 * `allowsBackgroundLocationUpdates`). Il plugin avvia Core Location in primo piano con gli aggiornamenti in
 * background e l'indicatore blu, col solo permesso «Durante l'uso».
 *
 * Una sola sessione nativa per tutta l'app: `clearWatch` toglie l'ascoltatore e spegne il nativo solo se nessuno
 * riascolta entro `ritardoFermaMs`. NAV-1 riavvia il watch (silenzio, errore, ritorno in primo piano) con
 * clearWatch + watchPosition: la sessione nativa resta accesa. Conta su iPhone: in background iOS non lascia
 * ripartire gli aggiornamenti di un'app «Durante l'uso», si possono solo tenere vivi quelli avviati in primo piano.
 */
import { Capacitor, registerPlugin } from '@capacitor/core';
import { isAppNativa } from './appNativa';

export const NOME_PLUGIN_POSIZIONE = 'PosizioneGiro';
export const RITARDO_FERMA_MS = 3000;
export const DISTANZA_MINIMA_M = 5;

let pluginPosizione = null;
function plugin() {
    if (!pluginPosizione) pluginPosizione = registerPlugin(NOME_PLUGIN_POSIZIONE);
    return pluginPosizione;
}

/** Il plugin c'è in questa build dell'app? (Un'app costruita prima di APP-NATIVA non lo ha.) */
export function posizioneNativaDisponibile() {
    if (!isAppNativa()) return false;
    try {
        return Capacitor.isPluginAvailable(NOME_PLUGIN_POSIZIONE) === true;
    } catch {
        return false;
    }
}

const numeroONull = (v) => (Number.isFinite(Number(v)) && v !== null ? Number(v) : null);

/** Un evento «posizione» del plugin nella forma di una GeolocationPosition del browser. */
export function posizioneDaNativa(d = {}) {
    return {
        coords: {
            latitude: Number(d.latitude),
            longitude: Number(d.longitude),
            accuracy: numeroONull(d.accuracy) ?? 0,
            altitude: numeroONull(d.altitude),
            altitudeAccuracy: numeroONull(d.altitudeAccuracy),
            heading: numeroONull(d.heading),
            speed: numeroONull(d.speed),
        },
        timestamp: numeroONull(d.timestamp) ?? Date.now(),
        sfondo: d.sfondo === true,
    };
}

/**
 * @param {object} [opz]
 * @param {object} [opz.plugin] il plugin (nei test un finto con avvia/ferma/addListener)
 */
export function creaGeolocationNativa({
    plugin: p = null,
    ritardoFermaMs = RITARDO_FERMA_MS,
    distanzaMinima = DISTANZA_MINIMA_M,
    timers = {
        setTimeout: (f, ms) => setTimeout(f, ms),
        clearTimeout: (id) => clearTimeout(id),
    },
} = {}) {
    const nativo = () => p || plugin();
    const osservatori = new Map();
    let prossimoId = 1;
    let ascolti = null;
    let avviato = false;
    let fermaTimer = null;
    let inSfondo = 0;

    const aTutti = (chiave, valore) => {
        for (const o of [...osservatori.values()]) {
            try { o[chiave]?.(valore); } catch (e) { console.warn('[NAV] posizione nativa non elaborata:', e?.message || e); }
        }
    };
    const assicuraAscolti = () => {
        if (ascolti) return;
        try {
            ascolti = Promise.all([
                nativo().addListener('posizione', (d) => {
                    // per la prova sul simulatore e su iPhone: le posizioni che arrivano al JavaScript con l'app in
                    // secondo piano (una riga ogni 10, nel registro del dispositivo; scripts/ios/prova-simulatore.sh)
                    if (d?.sfondo === true && ++inSfondo % 10 === 1) console.log(`[NAV] posizione nativa in background #${inSfondo}`);
                    aTutti('ok', posizioneDaNativa(d));
                }),
                nativo().addListener('errore', (e) => aTutti('errore', { code: Number(e?.code) === 1 ? 1 : 2, message: e?.message || '' })),
            ]).catch(() => { ascolti = null; });
        } catch {
            ascolti = null;
        }
    };
    const avviaNativo = () => {
        if (avviato) return;
        avviato = true;
        Promise.resolve()
            .then(() => nativo().avvia({ distanzaMinima }))
            .catch((e) => {
                avviato = false;
                aTutti('errore', { code: e?.code === 'NEGATO' ? 1 : 2, message: e?.message || '' });
            });
    };

    return {
        nativa: true,
        watchPosition(ok, errore) {
            if (fermaTimer) { timers.clearTimeout(fermaTimer); fermaTimer = null; }
            const id = prossimoId++;
            osservatori.set(id, { ok, errore });
            assicuraAscolti();
            avviaNativo();
            return id;
        },
        clearWatch(id) {
            osservatori.delete(id);
            if (osservatori.size > 0 || fermaTimer) return;
            fermaTimer = timers.setTimeout(() => {
                fermaTimer = null;
                if (osservatori.size > 0) return;
                avviato = false;
                Promise.resolve().then(() => nativo().ferma()).catch(() => { /* niente */ });
            }, ritardoFermaMs);
        },
        getCurrentPosition(ok, errore) {
            // non serve alla navigazione; per completezza: la prima posizione del watch, poi si smette
            let id = null;
            id = this.watchPosition((pos) => { this.clearWatch(id); ok?.(pos); }, (e) => { this.clearWatch(id); errore?.(e); });
        },
    };
}

let unica = null;
/** La geolocalizzazione nativa dell'app (una sola istanza: la sessione di Core Location è una). */
export function geolocationNativa() {
    if (!unica) unica = creaGeolocationNativa();
    return unica;
}
