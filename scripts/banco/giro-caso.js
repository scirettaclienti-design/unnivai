// C10c-replay — un caso del banco esteso: la chiamata della sua pagina e il grezzo che ne esce. Lo usano il giro vero
// (esteso.live.js) e il replay (replay.giro.js): stesso codice, stesso formato del grezzo.
import { aiRecommendationService } from '@/services/aiRecommendationService';
import { resolveCityCenter } from '@/services/cityCenterService';
import { isMealPlace } from '@/services/momentSelection';
import { resolveFoodPrefs, DIETE } from '@/lib/foodPrefs';
import { voiceIssues } from '@/lib/narrationLight';
import { buildPromptFromSelections, buildQuickPrefs } from '@/pages/QuickPath';
import { groupStopsByDayAndMoment } from '@/lib/stopMoments';
import { typeLabelOf } from '@/lib/italianLabels';
import { weightsToAIProfile } from '@/services/preferenceEngine';
import { row, conComposizione } from '../prova-reale/righe.js';
import { istanteSimulato } from './casi-esteso.js';

// ─── I posti visti nelle risposte dei proxy (tipi, tipo principale, orari, recensioni) ───────────────────────────────
export function creaLuoghi() {
    const luoghi = new Map();
    const annota = (p, query) => {
        const id = p?.place_id;
        if (!id) return;
        const l = luoghi.get(id) || { queries: new Set() };
        // Con la ricerca nuova il proxy porta gli orari (opening_hours.periods), il tipo principale e il fuso.
        if (Array.isArray(p.opening_hours?.periods)) l.periods = p.opening_hours.periods;
        // ORARI-FESTIVI — gli orari dei prossimi 7 giorni, per data
        if (p.current_opening_hours && Array.isArray(p.current_opening_hours.periods)) l.current = p.current_opening_hours;
        if (p.primary_type) l.primaryType = p.primary_type;
        if (Number.isFinite(p.utc_offset_minutes)) l.utcOffsetMinutes = p.utc_offset_minutes;
        if (Number.isFinite(p.user_ratings_total)) l.recensioni = p.user_ratings_total;
        if (Number.isFinite(p.price_level)) l.priceLevel = p.price_level;
        if (Array.isArray(p.types)) l.types = p.types;
        if (query) l.queries.add(query.toLowerCase());
        luoghi.set(id, l);
    };
    return { luoghi, annota };
}

/**
 * I posti di una risposta di places-proxy (ricerca o findplace) e quelli della lista della citta'.
 * @returns {string[]} i place_id dei risultati di ricerca (per contare i candidati visti nel caso)
 */
export function annotaRisposta({ annota }, url, corpo) {
    const u = String(url);
    const visti = [];
    if (u.includes('places-proxy')) {
        let params = null;
        try { params = new URL(u, 'http://x').searchParams; } catch { /* url strano */ }
        const k = params?.get('path') || 'altro';
        if (k !== 'place/photo' && k !== 'place/details') {
            for (const p of corpo?.results || []) { annota(p, params?.get('query')); if (p?.place_id) visti.push(p.place_id); }
            for (const p of corpo?.candidates || []) annota(p, params?.get('input'));
        }
    } else if (u.includes('openai-proxy')) {
        // i posti della lista arrivano col loro dato di Google: tipo principale e orari servono ai controlli (pasto, c5)
        for (const v of corpo?.cityKnowledge?.verificati || []) annota(v, null);
    }
    return visti;
}

const GRUPPO_ID = { Solo: 'solo', 'In coppia': 'coppia', 'Con gli amici': 'amici', 'In famiglia': 'famiglia' };

// Una tappa: la riga della prova reale + quello che servono ai controlli.
export const tappa = (luoghi, s, fatti, comp, riempite, dieta, atStimato) => {
    const r = conComposizione({ place_id: s.place_id, ...row(s, fatti, riempite) }, comp, fatti);
    const l = luoghi.get(s.place_id) || { queries: new Set() };
    const frasi = String(r.description || '').split(/(?<=[.!?])\s+/).filter(Boolean).map(f => ({ testo: f, problemi: voiceIssues(f) }));
    const types = l.types || s.types || [];
    const parole = dieta.flatMap(d => [DIETE[d]?.criterio, ...(DIETE[d]?.parole || [])].filter(Boolean));
    const qs = [...l.queries];
    const conDieta = (q) => parole.some(w => q.includes(w));
    return {
        place_id: s.place_id, title: r.title, types, moment: r.moment, at: r.at || atStimato || null, atStimato: !r.at && !!atStimato,
        ...(s.tempoLibero ? { tempoLibero: true } : {}),
        // C8a — la passeggiata fra il drink e la cena
        ...(s.passeggiata ? { passeggiata: true } : {}),
        lat: s.latitude ?? null, lng: s.longitude ?? null, min: r.min, scelta: r.scelta, stay: s.stayMinutes ?? null,
        ripiego: s._tracciato?.ripiego || null, motivo: r.motivo || null, famiglia: r.famiglia,
        incrocio: s._tracciato?.incrocio || null, daPartenza: s._tracciato?.daPartenza || null,
        varieta: s._tracciato?.varieta || null, deviazioneProva: s._tracciato?.deviazioneProva || null,
        description: r.description, verita: r.verita, voce: r.voce, frasi, fatti: (fatti || []).length,
        recensioni: l.recensioni ?? null, priceLevel: l.priceLevel ?? null,
        // C7 — il tipo principale decide cosa e' un pasto (un cocktail bar marcato anche `restaurant` e' un bar)
        pasto: isMealPlace({ types, primaryType: l.primaryType ?? s.primaryType, name: r.title, title: r.title }),
        ...((l.primaryType ?? s.primaryType) ? { primaryType: l.primaryType ?? s.primaryType } : {}),
        // TESTI — il tipo interno della tappa e l'etichetta che la schermata mostra (dal tipo principale; null = nessuna etichetta)
        ...(s.type ? { tipoInterno: s.type } : {}),
        etichetta: s.tempoLibero ? null : typeLabelOf({ ...s, primaryType: s.primaryType ?? l.primaryType }),
        // C6a — il nome originale di Google, se il nome mostrato e' stato ripulito dalle code commerciali
        ...(s._tracciato?.nomeOriginale ? { nomeOriginale: s._tracciato.nomeOriginale } : {}),
        // ORARI — il motore segna se l'orario del posto e' noto (aperto per tutta la sosta) o sconosciuto
        ...(s._orario || s._tracciato?.orario ? { orario: s._orario ?? s._tracciato.orario } : {}),
        // ORARI-FESTIVI — da quale orario viene il verdetto del motore ('orario del giorno' | 'orario della settimana')
        ...(s._orarioFonte || s._tracciato?.orarioFonte ? { orarioFonte: s._orarioFonte ?? s._tracciato.orarioFonte } : {}),
        // C7 — cosa ha voluto il tema (pasto del tema / esperienza), "tipico" (locale o no, e perche'), il momento chiesto dal testo
        ...(s._tracciato?.tema ? { tema: s._tracciato.tema } : {}),
        ...(s._tracciato?.tipico ? { tipico: s._tracciato.tipico } : {}),
        ...(s._tracciato?.esplicito ? { esplicito: s._tracciato.esplicito } : {}),
        dietaCercata: parole.length ? qs.some(conDieta) : null,
        dietaSolo: parole.length ? (qs.length > 0 && qs.every(conDieta)) : null,
    };
};

const meteoApp = { condition: 'sunny', temperature: 20 }; // il valore di ripiego che le pagine passano (weatherCondition || 'sunny', temperatureC || 20)

/** La chiamata della pagina del caso (Crea, Veloce, Sorprendimi), con l'ora simulata. */
export async function genera(caso, E) {
    const now = istanteSimulato(caso, E);
    const cc = await resolveCityCenter(caso.luogo);
    const base = { skipUserQuota: true, simulatedNow: now }; // skipUserQuota: solo il preflight del client (vedi memoria test-acc-preflight)
    const onboarding = caso.onboarding || null;
    const food = resolveFoodPrefs({ userPrompt: caso.richiesta || '', wizardBudget: caso.prefs?.budget, onboarding });
    const rec = { vincoli: food.dieta?.length || food.budget ? { dieta: food.dieta, budget: food.budget, maxPriceLevel: food.maxPriceLevel } : null };
    let r;
    if (caso.modo === 'crea') {
        const prefs = { budget: '', duration: '', interests: [], group: '', pace: '', ...caso.prefs };
        rec.chiamata = { pagina: 'AiItinerary.jsx', pathType: 'custom', prefs, testo: caso.richiesta };
        // C10 — i profili A e B portano il loro DNA (con fiducia piena) e il profilo al selettore, come il banco nazionale
        r = await aiRecommendationService.generateItinerary(caso.luogo, prefs, caso.richiesta, meteoApp, caso.dna ? weightsToAIProfile(caso.dna) : '', cc,
            { dnaWeights: caso.dna || {}, pathType: 'custom', onboardingPrefs: onboarding, ...base });
    } else if (caso.modo === 'veloce') {
        const s = caso.scelta;
        const durata = { Veloce: 'veloce', Medio: 'medio', Lungo: 'lungo' }[caso.durata];
        const prompt = buildPromptFromSelections({ main: s.main, sub: s.sub, duration: durata, group: GRUPPO_ID[caso.gruppo], city: caso.luogo });
        // C8a — ritmo e umore come la pagina: QuickPath passa al motore le preferenze di buildQuickPrefs (stessa funzione della pagina)
        const prefs = buildQuickPrefs({ main: s.main, mainTitle: s.mainTitle, subTitle: s.subTitle, durationTitle: caso.durata, groupTitle: caso.gruppo });
        rec.chiamata = { pagina: 'QuickPath.jsx', pathType: 'quick', prefs, testo: prompt };
        r = await aiRecommendationService.generateItinerary(caso.luogo, prefs, prompt, meteoApp, '', cc,
            { dnaWeights: {}, pathType: 'quick', onboardingPrefs: onboarding, ...base });
    } else if (caso.modo === 'sorprendimi') {
        const prefs = { interests: caso.tema ? [caso.tema] : ['Arte', 'Cibo', 'Scoperte Urbane'], duration: 'Mezza Giornata' };
        const prompt = `Sei l'intelligenza di Unnivai. Genera un'esperienza a sorpresa esaltante a ${caso.luogo}.
            Categoria di oggi: ${caso.tema ? caso.tema : 'Mix delle sue più profonde passioni storiche'}.
            L'esperienza DEVE essere fuori dai soliti schemi turistici commerciali e sembrare magia pura, calzando i suoi gusti inconsci.
            NON inventare coordinate.`;
        rec.chiamata = { pagina: 'SurpriseTour.jsx', pathType: null, prefs, testo: prompt.replace(/\s+/g, ' ') };
        r = await aiRecommendationService.generateItinerary(caso.luogo, prefs, prompt, {}, '', { latitude: cc.latitude, longitude: cc.longitude },
            { dnaWeights: {}, onboardingPrefs: onboarding, ...base });
    }
    return { r, rec, cc, now, food };
}

/** I campi del grezzo di un itinerario (Crea, Veloce, Sorprendimi) dal risultato del motore. */
export function registraItinerario(rec, { r, rec: extra, food }, caso, luoghi) {
    Object.assign(rec, extra);
    rec.richiesta = rec.chiamata?.testo ?? rec.richiesta;
    rec.source = r._source;
    rec.destinazione = r.destination ? { city: r.destination.city, fromText: r.destination.fromText, note: r.destination.note || null } : null;
    rec.tourDate = r.tourWindow?.date ?? null;
    rec.giorno = r.tourWindow ? { date: r.tourWindow.date, start: r.tourWindow.start, reason: r.tourWindow.reason } : null;
    rec.frasiTolte = r._narrationReport?.frasiTolte ?? null;
    rec.pool = r._momentReport?.pool ?? null;
    rec.finestraMinuti = r._momentReport?.finestraMinuti ?? null;
    rec.motori = r._momentReport ? { tolti: r._momentReport.momentiTolti ?? null, facoltativiSenzaPosto: r._momentReport.facoltativiSenzaPosto ?? null, ricercheMirate: r._momentReport.ricercheMirate ?? null } : null;
    rec.sceltaModello = r._momentReport?.sceltaModello ?? null;
    rec.ricerche = { prima: r._momentReport?.ricercheMirate ?? null, dopo: r._momentReport?.ricercheDopo ?? null };
    // ORARI — il messaggio "meglio domattina" al posto del giro e' un ripiego dichiarato
    rec.ripiegoDichiarato = !!(r._singleStop || r._queryDiBaseDopoVuoto || r._source === 'closed-now');
    if (r._source === 'closed-now') rec.chiusoOra = r._messaggio;
    rec.orariMotore = r._orari ?? null;
    // CONTINUITA' — le tappe aggiunte ai buchi e i buchi dichiarati, dal rapporto del motore
    rec.continuita = r._momentReport?.continuita ?? null;
    // C7 — il tema cibo, il tipico, le cucine estere escluse, le zone tolte, le ricerche mirate fatte
    rec.tema = r._momentReport?.tema ?? null;
    // C10 — la lista della città in questo giro (stato, dal server o nuova, verificati, nel pool, ancore, seminate)
    rec.citta = r._citta ?? null;
    // C10b2 — il modello di ogni passaggio di questo giro
    rec.modelli = r._modelli ?? null;
    if (caso.profilo) rec.profilo = caso.profilo;
    // TESTI — le sezioni come la schermata le intitola (groupStopsByDayAndMoment, la stessa funzione di AiItinerary e TourStopsByMoment) con l'ora della sua prima tappa
    const sezioni = (r.days || []).flatMap(d => groupStopsByDayAndMoment(d.stops || []).flatMap(g => g.groups))
        .filter(g => g.moment).map(g => ({ etichetta: g.moment.label, ora: g.items[0]?.timeLabel ?? null }));
    rec.schermo = { giorni: (r.days || []).map(d => ({ titolo: d.title || null, meteo: d.weather ?? null })), sezioni,
        note: [r.destination?.note, r._messaggio, ...(r.days || []).map(d => d.dietNote), ...(r.days || []).map(d => d.scalaNote)].filter(Boolean) };
    const per = new Map((r._narrationReport?.fatti?.perTappa || []).map(x => [x.place_id, x.fatti]));
    const comp = new Map((r._narrationReport?.composizione || []).map(x => [x.place_id, x]));
    const riempite = new Set((r._momentReport?.riempite || []).map(x => x.place_id));
    rec.tours = (r.days || []).map(d => ({ tema: d.title || null, stops: d.stops.map(s => tappa(luoghi, s, per.get(s.place_id), comp, riempite, food.dieta || [], null)) }));
    return rec;
}

/** Il record di partenza di un caso (come il giro vero lo scrive prima di generare). */
export const recordCaso = (caso, E) => ({ id: caso.id, modo: caso.modo, tipo: caso.modo === 'perte' ? 'perte' : 'itinerario', luogo: caso.luogo, ora: caso.ora,
    oggi: caso.giorno ?? E.giornoSimulato, richiesta: caso.richiesta || (caso.modo === 'veloce' ? null : caso.tema || null), onboarding: caso.onboarding || null });
