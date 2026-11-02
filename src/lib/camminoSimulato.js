/**
 * APP-NATIVA (account demo per il revisore Apple) — una posizione simulata che cammina lungo il giro dimostrativo.
 *
 * Ha la forma di `navigator.geolocation` (getCurrentPosition / watchPosition / clearWatch): MapPage la passa al
 * centro della mappa e ad `avviaTracciamento` al posto del GPS, e tutto il resto (arrivi, racconti, voce,
 * curiosità, fine giro) gira come in un giro vero. La usa SOLO l'account demo con il giro demo
 * (`giroDemoAttivo`, demoRevisore.js): nessun altro utente, sul web o nell'app, la vede.
 *
 * Ferma alla partenza finché non si tocca «Simula il cammino» (`avvia`); poi avanza a `velocitaMs` lungo `percorso`,
 * si ferma `sostaMs` a ogni tappa (il tempo della scheda d'arrivo) e resta sull'ultima.
 * Dipendenze (orologio, timer) passabili: si prova senza browser.
 */
const R_TERRA_M = 6371000;
const rad = (g) => (g * Math.PI) / 180;

export function distanzaM(a, b) {
    const x = rad(b.lng - a.lng) * Math.cos(rad((a.lat + b.lat) / 2));
    const y = rad(b.lat - a.lat);
    return Math.sqrt(x * x + y * y) * R_TERRA_M;
}

function direzioneGradi(a, b) {
    const y = Math.sin(rad(b.lng - a.lng)) * Math.cos(rad(b.lat));
    const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lng - a.lng));
    return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

const punto = (p) => ({ lat: Number(p.lat ?? p.latitude), lng: Number(p.lng ?? p.longitude) });

export const CAMMINO_DEMO = Object.freeze({ VELOCITA_MS: 2.5, PASSO_MS: 1000, SOSTA_MS: 25000, RAGGIO_SOSTA_M: 12 });

export function creaCamminoSimulato({
    percorso = [],
    tappe = [],
    velocitaMs = CAMMINO_DEMO.VELOCITA_MS,
    passoMs = CAMMINO_DEMO.PASSO_MS,
    sostaMs = CAMMINO_DEMO.SOSTA_MS,
    raggioSostaM = CAMMINO_DEMO.RAGGIO_SOSTA_M,
    now = () => Date.now(),
    timers = {
        setTimeout: (f, ms) => setTimeout(f, ms),
        clearTimeout: (id) => clearTimeout(id),
        setInterval: (f, ms) => setInterval(f, ms),
        clearInterval: (id) => clearInterval(id),
    },
} = {}) {
    const punti = percorso.map(punto).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
    const fermate = tappe.map(punto).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
    if (punti.length < 2) throw new Error('cammino simulato: servono almeno due punti');

    let segmento = 0; // si cammina da punti[segmento] a punti[segmento + 1]
    let fatti = 0; // metri già fatti nel segmento
    let posizione = { ...punti[0] };
    let direzione = direzioneGradi(punti[0], punti[1]);
    let stato = 'fermo'; // fermo | cammina | sosta | finito
    let sostaFinoA = 0;
    let prossimaFermata = 0;
    const osservatori = new Map();
    let prossimoId = 1;
    let orologio = null;
    const ascoltatori = new Set();

    const cambia = (s) => {
        if (s === stato) return;
        stato = s;
        for (const f of [...ascoltatori]) { try { f(stato); } catch { /* niente */ } }
    };

    const comePosizione = () => ({
        coords: {
            latitude: posizione.lat,
            longitude: posizione.lng,
            accuracy: 5,
            altitude: null,
            altitudeAccuracy: null,
            heading: direzione,
            speed: stato === 'cammina' ? velocitaMs : 0,
        },
        timestamp: now(),
        simulata: true,
    });

    const avanza = (metri) => {
        let resto = metri;
        while (resto > 0 && segmento < punti.length - 1) {
            const a = punti[segmento];
            const b = punti[segmento + 1];
            const lungo = distanzaM(a, b);
            const mancano = lungo - fatti;
            if (resto < mancano) {
                fatti += resto;
                resto = 0;
            } else {
                resto -= mancano;
                segmento += 1;
                fatti = 0;
            }
            const da = punti[Math.min(segmento, punti.length - 1)];
            const a2 = punti[Math.min(segmento + 1, punti.length - 1)];
            const lungo2 = distanzaM(da, a2) || 1;
            const t = Math.min(1, fatti / lungo2);
            posizione = { lat: da.lat + (a2.lat - da.lat) * t, lng: da.lng + (a2.lng - da.lng) * t };
            if (lungo2 > 0.5) direzione = direzioneGradi(da, a2);
            // una tappa raggiunta: si resta lì il tempo della scheda d'arrivo
            const f = fermate[prossimaFermata];
            if (f && distanzaM(posizione, f) <= raggioSostaM) {
                prossimaFermata += 1;
                return 'sosta';
            }
        }
        if (segmento >= punti.length - 1) {
            posizione = { ...punti[punti.length - 1] };
            return 'finito';
        }
        return 'cammina';
    };

    const emetti = () => {
        const pos = comePosizione();
        for (const o of [...osservatori.values()]) { try { o(pos); } catch { /* niente */ } }
    };

    const passo = () => {
        if (stato === 'sosta' && now() >= sostaFinoA) cambia('cammina');
        if (stato === 'cammina') {
            const esito = avanza((velocitaMs * passoMs) / 1000);
            if (esito === 'sosta') { sostaFinoA = now() + sostaMs; cambia('sosta'); }
            if (esito === 'finito') cambia('finito');
        }
        emetti();
    };

    const assicuraOrologio = () => {
        if (orologio || osservatori.size === 0) return;
        orologio = timers.setInterval(passo, passoMs);
    };
    const fermaOrologioSeVuoto = () => {
        if (orologio && osservatori.size === 0) { timers.clearInterval(orologio); orologio = null; }
    };

    return {
        simulata: true,
        getCurrentPosition(ok) {
            timers.setTimeout(() => { try { ok?.(comePosizione()); } catch { /* niente */ } }, 0);
        },
        watchPosition(ok) {
            const id = prossimoId++;
            osservatori.set(id, ok);
            timers.setTimeout(() => { if (osservatori.has(id)) { try { ok(comePosizione()); } catch { /* niente */ } } }, 0);
            assicuraOrologio();
            return id;
        },
        clearWatch(id) {
            osservatori.delete(id);
            fermaOrologioSeVuoto();
        },
        /** «Simula il cammino»: parte (o riparte dopo una pausa). */
        avvia() {
            if (stato === 'fermo') cambia('cammina');
        },
        /** «Ferma il cammino»: resta dov'è finché non si riavvia. */
        pausa() {
            if (stato === 'cammina' || stato === 'sosta') cambia('fermo');
        },
        stato: () => stato,
        posizione: () => ({ ...posizione }),
        suCambio(f) { ascoltatori.add(f); return () => ascoltatori.delete(f); },
        chiudi() {
            osservatori.clear();
            fermaOrologioSeVuoto();
            ascoltatori.clear();
        },
    };
}
