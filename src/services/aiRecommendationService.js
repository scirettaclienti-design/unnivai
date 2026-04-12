// src/services/aiRecommendationService.js
//
// DVAI-001 — Tutte le chiamate OpenAI ora passano per la Supabase Edge Function
// /functions/v1/openai-proxy in modo che la API key non sia mai nel bundle client.
// DVAI-010 — Aggiunta analyzeBusinessDescription() mancante.
// DVAI-020 — Modello aggiornato da gpt-3.5-turbo a gpt-4o-mini.

import { supabase } from '../lib/supabase';

const DOVEVAI_NARRATOR_PROMPT = `Sei la voce di DoveVai. Scrivi curiosità storiche ironiche e colte.
Evita i cliché come 'storia millenaria'. Focus su aneddoti bizzarri.
Max 150 car per la nota, 80 car per il fun fact.`;

// ─── Proxy helper ─────────────────────────────────────────────────────────────
/**
 * Chiama la Supabase Edge Function openai-proxy invece di OpenAI direttamente.
 * La API key rimane sul server; il bundle client non la contiene mai.
 *
 * @param {object} payload - Stesso body che manderesti ad OpenAI + { endpoint }
 * @param {AbortSignal} [signal]
 * @returns {Promise<object>} La risposta JSON di OpenAI
 */
const callOpenAIProxy = async (payload, signal) => {
  const { data: { session } } = await supabase.auth.getSession();

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey     = import.meta.env.VITE_SUPABASE_ANON_KEY;

  const headers = {
    'Content-Type': 'application/json',
    'apikey': anonKey,
  };
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/openai-proxy`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ endpoint: '/chat/completions', ...payload }),
    ...(signal ? { signal } : {}),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new Error(`Proxy ${response.status}: ${errBody?.error ?? response.statusText}`);
  }

  return response.json();
};

// ─── HARDCODED CITY POIs (local fallback — no API needed) ─────────────────────
const CITY_POIS = {
    Roma: [
        { title: 'Colosseo', location: 'Piazza del Colosseo', type: 'cultura', latitude: 41.8902, longitude: 12.4922, price: 16, rating: 4.8 },
        { title: 'Foro Romano', location: 'Via Sacra', type: 'storia', latitude: 41.8925, longitude: 12.4853, price: 12, rating: 4.6 },
        { title: 'Pantheon', location: 'Piazza della Rotonda', type: 'cultura', latitude: 41.8986, longitude: 12.4769, price: 5, rating: 4.9 },
        { title: 'Trastevere', location: 'Trastevere', type: 'food', latitude: 41.8896, longitude: 12.4700, price: 20, rating: 4.7 },
        { title: 'Piazza Navona', location: 'Piazza Navona', type: 'relax', latitude: 41.8992, longitude: 12.4730, price: 0, rating: 4.7 },
        { title: "Campo de' Fiori", location: "Campo de' Fiori", type: 'food', latitude: 41.8956, longitude: 12.4722, price: 0, rating: 4.5 },
    ],
    Milano: [
        { title: 'Duomo di Milano', location: 'Piazza del Duomo', type: 'cultura', latitude: 45.4641, longitude: 9.1919, price: 15, rating: 4.8 },
        { title: 'Galleria Vittorio Emanuele II', location: 'Centro Storico', type: 'shopping', latitude: 45.4654, longitude: 9.1900, price: 0, rating: 4.7 },
        { title: 'Castello Sforzesco', location: 'Parco Sempione', type: 'storia', latitude: 45.4706, longitude: 9.1796, price: 10, rating: 4.5 },
        { title: 'Navigli', location: 'Naviglio Grande', type: 'food', latitude: 45.4506, longitude: 9.1728, price: 0, rating: 4.4 },
        { title: 'Pinacoteca di Brera', location: 'Via Brera', type: 'cultura', latitude: 45.4722, longitude: 9.1869, price: 15, rating: 4.6 },
    ],
    Firenze: [
        { title: 'Duomo di Firenze', location: 'Piazza del Duomo', type: 'cultura', latitude: 43.7731, longitude: 11.2560, price: 18, rating: 4.9 },
        { title: 'Uffizi', location: 'Piazzale degli Uffizi', type: 'cultura', latitude: 43.7677, longitude: 11.2553, price: 20, rating: 4.7 },
        { title: 'Ponte Vecchio', location: 'Arno', type: 'relax', latitude: 43.7680, longitude: 11.2531, price: 0, rating: 4.8 },
        { title: 'Mercato Centrale', location: 'San Lorenzo', type: 'food', latitude: 43.7763, longitude: 11.2536, price: 0, rating: 4.6 },
    ],
    Venezia: [
        { title: 'Piazza San Marco', location: 'San Marco', type: 'cultura', latitude: 45.4341, longitude: 12.3388, price: 0, rating: 4.8 },
        { title: 'Palazzo Ducale', location: 'Riva degli Schiavoni', type: 'storia', latitude: 45.4338, longitude: 12.3407, price: 25, rating: 4.7 },
        { title: 'Rialto', location: 'Ponte di Rialto', type: 'shopping', latitude: 45.4380, longitude: 12.3358, price: 0, rating: 4.6 },
        { title: 'Dorsoduro', location: 'Fondamenta Zattere', type: 'food', latitude: 45.4296, longitude: 12.3265, price: 0, rating: 4.5 },
    ],
    Napoli: [
        { title: 'Spaccanapoli', location: 'Centro Storico', type: 'cultura', latitude: 40.8493, longitude: 14.2530, price: 0, rating: 4.7 },
        { title: 'Pizzeria Da Michele', location: 'Via Cesare Sersale', type: 'food', latitude: 40.8530, longitude: 14.2638, price: 5, rating: 4.9 },
        { title: 'Castel Nuovo', location: 'Piazza Municipio', type: 'storia', latitude: 40.8382, longitude: 14.2532, price: 6, rating: 4.4 },
        { title: 'Quartieri Spagnoli', location: 'Via Toledo', type: 'relax', latitude: 40.8434, longitude: 14.2467, price: 0, rating: 4.5 },
    ],
};

// ─── LOCAL FALLBACK (no API, no "(Fallback)" label) ───────────────────────────
const generateItineraryLocal = (city, prefs, weather) => {
    const pois = CITY_POIS[city] || [];
    if (pois.length === 0) {
        return {
            days: [{
                day: 1,
                title: `Alla scoperta di ${city}`,
                weather: { condition: weather?.condition === 'sunny' ? 'Soleggiato' : weather?.condition === 'rainy' ? 'Pioggia' : 'Variabile', temperature: weather?.temperature ?? 22, icon: weather?.condition === 'sunny' ? '☀️' : weather?.condition === 'rainy' ? '🌧️' : '⛅' },
                suggestedTransit: 'walking',
                mapMood: 'default',
                stops: [{
                    time: '09:00',
                    title: `Centro di ${city}`,
                    description: `Esplora il centro storico di ${city}`,
                    type: 'cultura',
                    location: `Centro di ${city}`,
                    latitude: null,
                    longitude: null,
                    price: 0,
                    rating: 4.5,
                }],
            }],
        };
    }
    const duration = prefs?.duration || 'Mezza Giornata';
    const numStops = duration === '2-3 Giorni' ? 6 : duration === '1 Giorno' ? 5 : 3;
    const selected = pois.slice(0, numStops);

    const TIMES = ['09:00', '10:30', '12:30', '14:00', '15:30', '17:00'];
    const weatherIcon = weather?.condition === 'sunny' ? '☀️'
        : weather?.condition === 'rainy' ? '🌧️' : '⛅';
    const weatherLabel = weather?.condition === 'sunny' ? 'Soleggiato'
        : weather?.condition === 'rainy' ? 'Pioggia' : 'Variabile';

    const stops = selected.map((poi, i) => ({
        time: TIMES[i] || '09:00',
        title: poi.title,
        description: `Visita a ${poi.title}, uno dei luoghi più affascinanti di ${city}.`,
        type: poi.type,
        location: poi.location,
        latitude: poi.latitude,
        longitude: poi.longitude,
        price: poi.price,
        rating: poi.rating,
    }));

    return {
        days: [{
            day: 1,
            title: `Alla scoperta di ${city}`,
            weather: { condition: weatherLabel, temperature: weather?.temperature ?? 22, icon: weatherIcon },
            suggestedTransit: 'walking',
            mapMood: 'default',
            stops,
        }],
    };
};

// ─── DVAI-034: Verifica POI con Google Places Text Search ──────────────────────
/**
 * Verifica un singolo POI contro Google Places Text Search.
 * Ritorna true se il POI esiste con alta confidenza.
 * Usa l'endpoint Places (New) /textsearch via proxy per non esporre la key.
 */
const verifyPOIWithPlaces = async (poi, city) => {
    try {
        const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
        if (!MAPS_KEY) return true; // Nessuna chiave → skip verifica

        const query = encodeURIComponent(`${poi.title} ${city} Italy`);
        const res = await fetch(
            `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${query}&inputtype=textquery&fields=name,geometry,place_id&locationbias=circle:50000@${poi.latitude},${poi.longitude}&key=${MAPS_KEY}`
        );
        if (!res.ok) return true; // Se Places non risponde → mantieni il POI

        const data = await res.json();
        if (data.status !== 'OK' || !data.candidates?.length) {
            console.warn(`[DVAI-034] POI non trovato su Places: "${poi.title}" → rimosso`);
            return false;
        }

        // Controlla che le coordinate Places siano ragionevolmente vicine a quelle AI
        const place = data.candidates[0];
        if (place.geometry?.location) {
            const { lat, lng } = place.geometry.location;
            const distKm = Math.sqrt(
                Math.pow((lat - poi.latitude) * 111, 2) +
                Math.pow((lng - poi.longitude) * 111 * Math.cos(poi.latitude * Math.PI / 180), 2)
            );
            if (distKm > 5) {
                // Coordinate AI distanti > 5 km da Places → correggi coordinate
                console.warn(`[DVAI-034] Coordinate corrette per "${poi.title}": ${lat},${lng}`);
                poi.latitude  = lat;
                poi.longitude = lng;
            }
        }
        return true;
    } catch {
        return true; // In caso di errore rete → mantieni il POI
    }
};

// Ordina tappe per prossimità (nearest-neighbor greedy)
function sortByProximity(stops) {
    if (stops.length <= 2) return stops;
    const result = [stops[0]]; // Parti dalla prima tappa (perla nascosta)
    const remaining = stops.slice(1);
    while (remaining.length > 0) {
        const last = result[result.length - 1];
        let closest = 0;
        let minDist = Infinity;
        for (let i = 0; i < remaining.length; i++) {
            const d = Math.hypot(remaining[i].latitude - last.latitude, remaining[i].longitude - last.longitude);
            if (d < minDist) { minDist = d; closest = i; }
        }
        result.push(remaining.splice(closest, 1)[0]);
    }
    return result;
}

export const aiRecommendationService = {

    // ─── ITINERARY GENERATION ────────────────────────────────────────────────
    async generateItinerary(city, prefs = {}, userPrompt = '', weather = {}) {
        const weatherIcon = weather?.condition === 'sunny' ? '☀️'
            : weather?.condition === 'rainy' ? '🌧️' : '⛅';

        const hour = new Date().getHours();
        const timeContext = hour >= 6 && hour < 11 ? 'mattina presto — le tappe devono includere colazione/bar e posti che aprono la mattina'
            : hour >= 11 && hour < 14 ? 'ora di pranzo — includi un ristorante locale (non turistico) come tappa centrale'
            : hour >= 14 && hour < 18 ? 'pomeriggio — musei, gallerie, panorami, passeggiate'
            : hour >= 18 && hour < 22 ? 'sera — aperitivi, ristoranti, panorami al tramonto, locali con atmosfera'
            : 'notte — locali, jazz bar, piazze illuminate, passeggiate notturne';

        const systemPrompt = `Sei un insider locale italiano — non una guida turistica, non un'enciclopedia. Sei l'amico che vive a ${city} da sempre e sa dove portare la gente per farla innamorare della città.

REGOLE ASSOLUTE:
1. Rispondi SOLO con JSON valido. Zero testo fuori dal JSON. Zero commenti. Zero markdown.
2. Ogni coordinata DEVE essere reale e verificabile su Google Maps per ${city}. Latitudine tra 36-47, Longitudine tra 6-19 (Italia).
3. MAI iniziare con la tappa più ovvia/turistica della città. La prima tappa è una perla nascosta.
4. Il tour ha una NARRATIVA — non è una lista. Ogni tappa porta logicamente alla successiva.
5. Tra una tappa e l'altra, aggiungi nel campo "transition" cosa si vede camminando (es: "5 min a piedi, passerai per vicolo dei Serpenti dove c'è un murales degli anni '70").
6. Per ogni tappa: perché vale la pena andarci ORA (${timeContext}).
7. Le descrizioni sono evocative, dirette, mai da Wikipedia. Max 120 caratteri.
8. CONTESTO GRUPPO: se "coppia" → posti intimi, tramonti, tavoli per due, atmosfera romantica. Se "amici" → locali vivaci, street food, piazze sociali. Se "famiglia" → posti kid-friendly, gelato, parchi. Se "solo" → caffè con vista, librerie, angoli tranquilli.
9. Per città meno conosciute (non Roma/Milano/Firenze/Napoli/Venezia): usa POI verificabili, NON inventare nomi. Se non sei sicuro di un posto, usa la categoria ("un'enoteca storica nel centro") piuttosto che un nome falso.
10. Per tour multi-giorno: il giorno 2 riprende dove finisce il giorno 1. Narrativa continua, non ripartire da zero.

Schema JSON ESATTO:
{
  "days": [{
    "day": 1,
    "title": "Titolo evocativo (non 'Giorno 1 a Roma')",
    "weather": { "condition": "${weather?.condition || 'Soleggiato'}", "temperature": ${weather?.temperature || 22}, "icon": "${weatherIcon}" },
    "suggestedTransit": "walking|bus|metro",
    "mapMood": "romantico|storia|avventura|natura|cibo|shopping|arte|sorpresa|sport",
    "stops": [{
      "time": "HH:MM",
      "title": "Nome REALE del posto (deve esistere su Google Maps)",
      "description": "Descrizione evocativa, diretta, da insider",
      "transition": "Come arrivi alla prossima tappa (distanza, cosa vedi camminando)",
      "insiderTip": "Consiglio da local (es: 'chiedi il tavolo sul terrazzo nascosto')",
      "bestTime": "Perché questo è il momento giusto per questa tappa",
      "suggestedMinutes": 30,
      "type": "cultura|storia|food|shopping|relax|arte|natura",
      "location": "Indirizzo reale o quartiere",
      "latitude": 41.9028,
      "longitude": 12.4964,
      "price": 0,
      "rating": 4.5
    }]
  }]
}`;

        const lines = [
            `Città: ${city}`,
            `Orario attuale: ${hour}:00 — ${timeContext}`,
            `Meteo: ${weather?.condition ?? 'soleggiato'}, ${weather?.temperature ?? 20}°C`,
            prefs?.duration   ? `Durata tour: ${prefs.duration}` : '',
            prefs?.budget     ? `Budget: ${prefs.budget}` : '',
            prefs?.interests?.length
                ? `Interessi: ${Array.isArray(prefs.interests) ? prefs.interests.join(', ') : prefs.interests}` : '',
            prefs?.group      ? `Gruppo: ${prefs.group}` : '',
            prefs?.pace       ? `Ritmo: ${prefs.pace}` : '',
            userPrompt        ? `Richiesta: ${userPrompt}` : '',
        ].filter(Boolean);

        const numDays = prefs?.duration === '2-3 Giorni' ? 2 : 1;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 35_000);

        try {
            // DVAI-001: chiamata tramite proxy, mai diretta ad OpenAI dal client
            const data = await callOpenAIProxy({
                model: 'gpt-4o-mini',  // DVAI-020: aggiornato da gpt-3.5-turbo
                messages: [
                    { role: 'system', content: systemPrompt },
                    {
                        role: 'user',
                        content: `Genera un itinerario di ${numDays} giorno/i con 4-5 tappe per giorno.\n${lines.join('\n')}`,
                    },
                ],
                response_format: { type: 'json_object' },
                temperature: 0.7,
                max_tokens: 2000,
            }, controller.signal);

            clearTimeout(timeoutId);

            const raw = data.choices?.[0]?.message?.content;
            if (!raw) throw new Error('Empty AI response');

            const parsed = JSON.parse(raw);
            const days = Array.isArray(parsed) ? parsed : (parsed.days ?? []);
            if (!Array.isArray(days) || days.length === 0) throw new Error('AI returned no days');

            const VALID_MOODS = new Set(['romantico','storia','avventura','natura','cibo','shopping','arte','sorpresa','sport']);
            const VALID_TRANSIT = new Set(['bus','metro','walking']);
            const sanitized = days.map((day, di) => {
                const rawStops = (day.stops ?? [])
                    .map(s => {
                        const lat = parseFloat(s.latitude);
                        const lng = parseFloat(s.longitude);
                        // Validazione stretta: coordinate reali in Italia, titolo e descrizione presenti
                        if (!s.title || !lat || !lng || isNaN(lat) || isNaN(lng)) return null;
                        if (lat < 36 || lat > 47 || lng < 6 || lng > 19) {
                            console.warn(`[AI] Scartata tappa "${s.title}": coordinate fuori Italia (${lat},${lng})`);
                            return null;
                        }
                        if ((s.description || '').length < 10) {
                            console.warn(`[AI] Scartata tappa "${s.title}": descrizione troppo corta`);
                            return null;
                        }
                        return {
                            ...s,
                            latitude: lat,
                            longitude: lng,
                            price: typeof s.price === 'number' ? s.price : 0,
                            rating: typeof s.rating === 'number' ? Math.min(s.rating, 5) : 4.5,
                            suggestedMinutes: s.suggestedMinutes || 30,
                            transition: s.transition || null,
                            insiderTip: s.insiderTip || null,
                            bestTime: s.bestTime || null,
                        };
                    })
                    .filter(Boolean);

                // Ordina le tappe per prossimità geografica (nearest-neighbor greedy)
                const ordered = sortByProximity(rawStops);

                return {
                    day: day.day ?? di + 1,
                    title: day.title ?? `Giorno ${di + 1} a ${city}`,
                    weather: day.weather ?? {
                        condition: 'Soleggiato',
                        temperature: weather?.temperature ?? 22,
                        icon: weatherIcon,
                    },
                    suggestedTransit: VALID_TRANSIT.has(day.suggestedTransit) ? day.suggestedTransit : 'walking',
                    mapMood: VALID_MOODS.has(day.mapMood) ? day.mapMood : 'default',
                    stops: ordered,
                };
            }).filter(d => d.stops.length > 0);

            if (sanitized.length === 0) throw new Error('All stops invalid after sanitization');

            // DVAI-034: Verifica POI con Google Places (async per ogni stop)
            // Rimuove POI inesistenti e corregge coordinate imprecise.
            // La verifica è best-effort: errori non bloccano l'itinerario.
            const verifiedSanitized = await Promise.all(
                sanitized.map(async (day) => {
                    const verifiedStops = await Promise.all(
                        day.stops.map(async (stop) => {
                            const isValid = await verifyPOIWithPlaces(stop, city);
                            return isValid ? stop : null;
                        })
                    );
                    return {
                        ...day,
                        stops: verifiedStops.filter(Boolean),
                    };
                })
            );

            const finalDays = verifiedSanitized.filter(d => d.stops.length > 0);
            if (finalDays.length === 0) throw new Error('All POIs invalid after Places verification');

            return { days: finalDays };

        } catch (err) {
            clearTimeout(timeoutId);
            if (err.name === 'AbortError') {
                console.warn('[AI] Itinerary request timed out (35 s) → local fallback');
            } else {
                console.warn('[AI] Itinerary generation failed → local fallback:', err.message);
            }
            return generateItineraryLocal(city, prefs, weather);
        }
    },

    // ─── MONUMENT ENRICHMENT ─────────────────────────────────────────────────
    async enrichMonuments(pois, city) {
        try {
            const data = await callOpenAIProxy({
                model: 'gpt-4o-mini',  // DVAI-020
                messages: [
                    { role: 'system', content: DOVEVAI_NARRATOR_PROMPT },
                    { role: 'user', content: `Arricchisci questi POI di ${city || 'questa città'}: ${pois.map(p => p.name || p.title || 'Punto di interesse').join(', ')}` },
                ],
                response_format: { type: 'json_object' },
            });
            const enriched = JSON.parse(data.choices[0].message.content).data;

            return pois.map(p => {
                const targetName = p.name || p.title;
                const item = enriched?.find(d => d.name === targetName || (d.name && targetName && d.name.includes(targetName)));
                return { ...p, historicalNotes: item?.note || p.historicalNotes, funFacts: [item?.fun_fact] };
            });
        } catch (e) {
            console.warn('[AI] enrichMonuments failed:', e.message);
            return pois;
        }
    },

    // ─── GEMINI / AI CHAT GUIDE ──────────────────────────────────────────────
    async chatWithGuide(messages, contextPayload) {
        const fallbackResponse = "Sono una versione limitata offline. Il proxy AI non è raggiungibile.";

        const { city, poiName } = contextPayload;
        const contextStr = poiName ? `${poiName} a ${city}` : `${city}`;

        const systemPrompt = `Sei l'Assistente AI integrato nella mappa 3D premium di DoveVai.
Il tuo compito è fare da guida turistica esperta, ironica e sintetica per l'utente, che sta esplorando in questo momento: ${contextStr}.
Non dare risposte enciclopediche lunghissime (massimo 3-4 frasi o 450 caratteri). Fai emergere verità storiche nascoste, aneddoti divertenti o consigli unici. Se ti chiedono indicazioni stradali complesse, ricordagli gentilmente di seguire la scia arancione sulla mappa.`;

        const openAiMessages = [
            { role: 'system', content: systemPrompt },
            ...messages.filter(m => m.role === 'user' || m.role === 'assistant')
        ];

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 12000);

            const data = await callOpenAIProxy({
                model: 'gpt-4o-mini',  // DVAI-020
                messages: openAiMessages,
                temperature: 0.7,
                max_tokens: 350
            }, controller.signal);

            clearTimeout(timeoutId);

            return data.choices?.[0]?.message?.content || fallbackResponse;
        } catch (e) {
            console.warn('[AI] chatWithGuide failed:', e.message);
            return fallbackResponse;
        }
    },

    // ─── DYNAMIC WEATHER & SOCIAL TIP ─────────────────────────────────────────
    /**
     * DVAI-002 (notifiche): Genera un consiglio AI contestuale all'orario reale.
     * @param {string} city
     * @param {string} userName
     * @param {'morning'|'midday'|'afternoon'|'evening'|'night'} slot - fascia oraria da useUserNotifications
     */
    async generateWeatherSocialTip(city, userName, slot = 'afternoon') {
        // Descrizione human-readable dello slot per il prompt
        const slotLabels = {
            morning:   'mattina (06-10), poca folla, luce bella',
            midday:    'mezzogiorno (11-13), ora di pranzo',
            afternoon: 'pomeriggio (14-17), caldo, ideale per musei e gallerie',
            evening:   'sera (18-21), aperitivo e cena',
            night:     'notte (22-05), tutto chiuso tranne locali notturni',
        };
        const slotActivities = {
            morning:   'passeggiate, mercati del mattino, tour con poca folla, colazione tipica',
            midday:    'ristoranti, trattorie, osterie, street food, pranzo tipico locale',
            afternoon: 'musei, gallerie d\'arte, tour culturali, laboratori artigianali',
            evening:   'aperitivo, ristoranti romantici, esperienze gastronomiche serali, vista panoramica',
            night:     'pianificazione del giorno dopo, itinerari AI per domani mattina',
        };

        try {
            const prompt = `Sei un esperto locale di ${city}. Ora è: ${slotLabels[slot] || slotLabels.afternoon}.
Scrivi UN breve consiglio (max 140 caratteri) per ${userName || 'il viaggiatore'} suggerendo SOLO attività adatte a questo orario: ${slotActivities[slot] || slotActivities.afternoon}.
REGOLA FONDAMENTALE: NON suggerire il sole, passeggiate all'aperto o attività esterne di notte. NON suggerire ristoranti o bar alle 7 del mattino.
Aggiungi #DoveVAI alla fine.

Formato JSON:
{
  "title": "Titolo breve con emoji adatta all'orario (max 50 car)",
  "message": "Consiglio coerente con l'orario con hashtag (max 140 car)"
}`;

            const data = await callOpenAIProxy({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: 'Sei un travel advisor locale amichevole. Rispondi SOLO in JSON valido. Rispetta rigorosamente il contesto orario.' },
                    { role: 'user', content: prompt }
                ],
                response_format: { type: 'json_object' },
                max_tokens: 200,
            });

            if (!data.choices?.[0]) throw new Error('No AI response');
            const parsed = JSON.parse(data.choices[0].message.content);
            if (!parsed.title || !parsed.message) throw new Error('Incomplete AI response');
            return parsed;
        } catch (e) {
            console.warn('[AI] generateWeatherSocialTip failed:', e.message);
            return null; // null → useUserNotifications usa il fallback statico coerente
        }
    },

    // ─── DVAI-010: ANALYZE BUSINESS DESCRIPTION ───────────────────────────────
    /**
     * Analizza la descrizione di un'attività business e restituisce
     * metadati AI per ottimizzare il profilo sulla piattaforma.
     *
     * @param {{ description: string, website?: string, instagram?: string, image_urls?: string[] }} context
     * @returns {Promise<object|null>} ai_metadata o null in caso di errore
     */
    async analyzeBusinessDescription(context) {
        const { description, website, instagram, image_urls } = context ?? {};

        if (!description || description.trim().length < 20) {
            console.warn('[AI] analyzeBusinessDescription: descrizione troppo corta o assente');
            return null;
        }

        const systemPrompt = `Sei un esperto di marketing turistico italiano. Analizza la descrizione di un'attività commerciale
e restituisci un JSON con metadati utili per posizionamento sulla piattaforma DoveVai.
Rispondi SOLO con JSON valido, nessun testo aggiuntivo.`;

        const userPrompt = `Analizza questa attività e restituisci:
{
  "vibe": ["aggettivo1", "aggettivo2", "aggettivo3"],
  "style": ["stile1", "stile2"],
  "pace": "Rilassato|Dinamico|Avventuroso|Contemplativo",
  "story_hook": "Frase accattivante di 15-20 parole che descrive l'esperienza unica",
  "tags": ["tag1", "tag2"],
  "target_audience": "Descrizione del pubblico ideale (max 80 car)",
  "best_hours": "Fascia oraria consigliata (es. 'Mattina 9-12, Sera 18-22')",
  "tour_compatibility": ["tipo_tour1", "tipo_tour2"],
  "highlight": "Punto di forza principale (max 100 car)",
  "category": "food|cultura|shopping|relax|arte|natura|sport"
}

Descrizione: ${description}
${website ? `Sito web: ${website}` : ''}
${instagram ? `Instagram: ${instagram}` : ''}
${image_urls?.length ? `Immagini disponibili: ${image_urls.length}` : ''}`;

        try {
            const data = await callOpenAIProxy({
                model: 'gpt-4o-mini',  // DVAI-020
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                response_format: { type: 'json_object' },
                temperature: 0.4,
                max_tokens: 500,
            });

            const raw = data.choices?.[0]?.message?.content;
            if (!raw) throw new Error('Empty response from AI');

            return JSON.parse(raw);
        } catch (err) {
            console.warn('[AI] analyzeBusinessDescription failed:', err.message);
            return null;
        }
    },
};
