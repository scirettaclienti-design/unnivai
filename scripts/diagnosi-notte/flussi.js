// DIAGNOSI-NOTTE — cosa decide ogni flusso a una data ora, con le STESSE funzioni del motore e gli stessi parametri che le pagine
// passano (nessuna logica nuova): finestra (tourWindow), scheletro (daySkeleton), momento dell'ora (dayMoments).
//   Per Te        DashboardUser → generateHomeTours: `isSeraStart` decide il giro della sera, altrimenti i temi e il momento di `momentAtClock`
//   Quiz          QuickPath.jsx          pathType 'quick'  (veloce = true nello scheletro)
//   Sorprendimi   SurpriseTour.jsx       nessun pathType, durata «Mezza Giornata» (veloce = false)
//   Rigenera      AiItinerary.jsx:345    nessun pathType, durata «Mezza Giornata» (come Sorprendimi)
//   Crea Percorso AiItinerary.jsx:217    pathType 'custom', wizard vuoto, testo senza giorno
// «Crea il tuo Tour» è la pagina che porta a Sorprendimi e a Crea Percorso: non ha un motore suo.
import { resolveTourWindow, romeParts } from '@/lib/tourWindow';
import { buildDaySkeleton, addEveningWalk, isSeraStart } from '@/lib/daySkeleton';
import { momentAtClock } from '@/lib/dayMoments';
import { sunTimes } from '@/lib/sunTimes';

export const TROINA = { latitude: 37.7824, longitude: 14.5949 };
// la notte fra martedì 20 e mercoledì 21 ottobre 2026 (ora legale, +02:00)
export const ORE = [
    { etichetta: '23:30', iso: '2026-10-20T23:30:00+02:00' },
    { etichetta: '00:30', iso: '2026-10-21T00:30:00+02:00' },
    { etichetta: '02:00', iso: '2026-10-21T02:00:00+02:00' },
    { etichetta: '04:30', iso: '2026-10-21T04:30:00+02:00' },
    { etichetta: '05:30', iso: '2026-10-21T05:30:00+02:00' },
];

const hhmm = (d) => { const p = romeParts(d); return `${String(p.h).padStart(2, '0')}:${String(p.mi).padStart(2, '0')}`; };

// la regola «dopo il tramonto» del motore (aiRecommendationService: sunForDay + dopoIlTramonto): il tramonto del giorno DELLA FINESTRA
// (`tourWindow.date`), confrontato con l'inizio. Replica dichiarata: la chiusura vera sta dentro `_generateItinerary`, qui sotto la
// prova col motore vero (replay-notte.mjs).
export function dopoIlTramonto(window) {
    const [y, m, d] = window.date.split('-').map(Number);
    const sole = sunTimes({ y, m, d }, TROINA.latitude, TROINA.longitude);
    return { tramonto: sole.sunset, alba: sole.sunrise, dopo: window.start.getTime() >= sole.sunset.getTime() };
}

const SK = { pace: undefined, interests: [], group: '' };

export function cella(flusso, iso) {
    const now = new Date(iso);
    const p = romeParts(now);
    if (flusso === 'perte') {
        const sera = isSeraStart(now);
        const m = momentAtClock(p.h, p.mi);
        return { flusso, sera, rotta: sera ? 'giro della sera (Veloce)' : 'giorno (temi)', momentoOra: m.key };
    }
    const cfg = {
        quiz: { pathType: 'quick', duration: 'Veloce', text: '', veloce: true },
        sorprendimi: { pathType: undefined, duration: 'Mezza Giornata', text: '', veloce: false },
        rigenera: { pathType: undefined, duration: 'Mezza Giornata', text: '', veloce: false },
        crea: { pathType: 'custom', duration: '', text: 'Un giro a Troina', veloce: false },
    }[flusso];
    const window = resolveTourWindow({ text: cfg.text, requestTime: now, pathType: cfg.pathType, duration: cfg.duration });
    const sk = addEveningWalk(buildDaySkeleton({ window, ...SK, veloce: cfg.veloce }), { veloce: cfg.veloce });
    const moments = sk.days.flatMap(d => d.moments);
    const t = dopoIlTramonto(window);
    return {
        flusso,
        finestra: `${window.date} ${hhmm(window.start)}–${hhmm(window.end)}`,
        data: window.date,
        momenti: moments.map(m => m.key + (m.daRiserva ? '(riserva)' : '')),
        primo: moments[0]?.key ?? null,
        categoriePrimo: moments[0]?.categories ?? [],
        dopoTramonto: t.dopo,
        tramonto: hhmm(t.tramonto),
        momentoOra: momentAtClock(p.h, p.mi).key,
    };
}
