import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef, useEffect } from "react";
import { ArrowLeft, ArrowRight, MapPin, Clock, Camera, Utensils, Palette, Eye, ShoppingBag, Coffee, Send, Sparkles, Brain, Loader, Heart, Mountain, Waves, Users, Baby, Zap, Sunset, Navigation, CloudRain, Sun, Thermometer, Wind, Star, Calendar, Home, Shuffle, Target, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
import TopBar from "../components/TopBar";
import BottomNavigation from "../components/BottomNavigation";
import { useUserContext } from "../hooks/useUserContext";
import { aiRecommendationService } from "../services/aiRecommendationService";
import { normalizeTour } from "../services/tourShape";
// Gate RAGGIO DIFF 1b — offset cumulativo e formattazione delle stime.
// Nessun numero secco e nessuna stringa costruita a mano in questa pagina:
// la forma testuale di un tempo vive tutta in tourTiming.js.
import { computeCumulativeOffsets, formatOffsetLabel, formatEstimate } from "@/lib/tourTiming";
import { useAILearning } from "../hooks/useAILearning"; // DVAI-045
import { useToast } from "../hooks/use-toast";
// Gate 2 FASE 3 — resolveCityCenter come sorgente unica del centro città.
// Sostituisce il vecchio pattern `{ latitude: lat, longitude: lng }` che usava
// il GPS UTENTE (buco #3 diagnosi Gate 1: il raggio inseguiva l'utente invece
// della città). QuickPath e AiItinerary condividono la stessa risoluzione.
import { resolveCityCenter, CityCenterUnresolvedError } from "../services/cityCenterService";

const preferences = [
    { id: 'budget', title: 'Budget', options: ['Economico', 'Medio', 'Lusso'], emoji: '💰', selected: '' },
    { id: 'duration', title: 'Durata', options: ['Mezza Giornata', '1 Giorno', '2-3 Giorni'], emoji: '⏱️', selected: '' },
    { id: 'interests', title: 'Interessi', options: ['Arte', 'Cibo', 'Storia', 'Natura', 'Shopping', 'Vita Notturna'], emoji: '🎯', selected: [] },
    { id: 'group', title: 'Gruppo', options: ['Solo', 'Coppia', 'Famiglia', 'Amici'], emoji: '👥', selected: '' },
    { id: 'pace', title: 'Ritmo', options: ['Rilassato', 'Attivo', 'Intenso'], emoji: '🚀', selected: '' }
];

// Gate NARRATORE/POI (Fase 2a) — decisione pura, esportata per i test.
// Stesso pattern di getTourRenderState (TourDetails, Gate E-1).
//
// `if (newDay)` era vero anche per { stops: [] }: the payload onesto del motore
// ha sempre un oggetto giorno dentro `days`, quello che manca sono le tappe.
// Si sostituisce SOLO se il nuovo giorno ha tappe vere — altrimenti resta il
// giorno precedente, che è contenuto vero.
//
// @returns {boolean} true = sostituisci il giorno visualizzato
export function shouldReplaceDay(newDay) {
    return Array.isArray(newDay?.stops) && newDay.stops.length > 0;
}

export default function AIItineraryPage() {
    const [currentStep, setCurrentStep] = useState(0);
    const [userPreferences, setUserPreferences] = useState(preferences);
    const [userPrompt, setUserPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedItinerary, setGeneratedItinerary] = useState(null);
    const abortRef = useRef(null);
    const [selectedStop, setSelectedStop] = useState(null);
    const [currentDay, setCurrentDay] = useState(1);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            window.__setAiItineraryPreview = ({ step, itinerary, selectedStop: stop }) => {
                if (step !== undefined) setCurrentStep(step);
                if (itinerary !== undefined) setGeneratedItinerary(itinerary);
                if (stop !== undefined) setSelectedStop(stop);
            };
        }
    }, []);

    const updatePreference = (prefId, value) => {
        setUserPreferences(prev =>
            prev.map(pref =>
                pref.id === prefId
                    ? { ...pref, selected: value }
                    : pref
            )
        );
    };

    // Gate 2 FASE 3 — lat/lng dell'utente restano disponibili nel contesto per
    // usi non-cityCenter (es. UI location badge). Il centro del filtro raggio
    // NON viene più derivato da questi valori (buco #3 chiuso).
    const { city, temperatureC, weatherCondition } = useUserContext();
    const activeCity = city || 'Roma';
    // Gate F38 — rimossa `const cityData = DEMO_CITIES[activeCity] || DEMO_CITIES['Roma']`.
    // Era una variabile morta (dichiarata e mai letta) il cui unico effetto era
    // tenere in vita l'import di DEMO_CITIES. La riga in sé è il difetto: quel
    // `|| DEMO_CITIES['Roma']` non distingue "città sconosciuta" da "città Roma",
    // e DEMO_CITIES contiene 18 città su tutte quelle italiane.

    // DVAI-045: leggi le preferenze apprese dall'AI
    const { userDNAPreferences, trackGeneratedTour, trackInteraction, getAIContext } = useAILearning();
    const { toast } = useToast();

    // Gate 2 FASE 3 — cityCenter risolto autoritativamente da resolveCityCenter
    // e mantenuto in state per essere disponibile ai code path sincroni (JSX del
    // link "Vedi su Mappa" che passa cityCenter a normalizeTour). Si aggiorna
    // quando activeCity cambia. Null finché la risoluzione non completa; se
    // fallisce, resta null e normalizeTour non applica il raggio (retrocompat
    // safety: il tour è già stato generato con il centro giusto nel flusso async).
    const [resolvedCityCenter, setResolvedCityCenter] = useState(null);
    useEffect(() => {
        let cancelled = false;
        resolveCityCenter(activeCity)
            .then(c => { if (!cancelled) setResolvedCityCenter(c); })
            .catch(err => { console.warn('[AiItinerary] resolveCityCenter (link path):', err?.reason || err?.message); });
        return () => { cancelled = true; };
    }, [activeCity]);

    // Cleanup: aborta chiamata AI se utente lascia la pagina
    useEffect(() => () => { abortRef.current?.abort(); }, []);

    const generateItinerary = async () => {
        // Aborta eventuale chiamata precedente ancora in corso
        abortRef.current?.abort();
        abortRef.current = new AbortController();

        setIsGenerating(true);
        setGeneratedItinerary(null);

        const prefsObject = userPreferences.reduce((acc, pref) => {
            acc[pref.id] = pref.selected;
            return acc;
        }, {});

        // Preference Graph: contesto AI dal grafo preferenze + DNA legacy
        const graphContext = getAIContext();
        let dnaContext = '';
        if (!graphContext && userDNAPreferences && userDNAPreferences.length > 0) {
            // Fallback al vecchio sistema DNA se il graph è vuoto
            const last5 = userDNAPreferences.slice(0, 5);
            const moodsSeen = [...new Set(last5.map(p => p.mood).filter(Boolean))];
            const citiesSeen = [...new Set(last5.map(p => p.city).filter(Boolean))];
            const durationsSeen = [...new Set(last5.map(p => p.duration).filter(Boolean))];
            dnaContext = [
                moodsSeen.length   ? `Humor preferiti: ${moodsSeen.join(', ')}.`    : '',
                citiesSeen.length  ? `Città visitate: ${citiesSeen.join(', ')}.`      : '',
                durationsSeen.length ? `Durate preferite: ${durationsSeen.join(', ')}.` : '',
            ].filter(Boolean).join(' ');
        }

        const aiProfile = graphContext || dnaContext;

        // Gate INTENT F65 (28/08) — qui si costruiva un `enrichedPrompt` che
        // appiccicava il profilo DENTRO la frase dell'utente:
        //     [userPrompt, `[Profilo utente: ${aiProfile}]`].join(' ')
        // e lo passava come terzo argomento a generateItinerary.
        //
        // Quel terzo argomento arriva a `translateIntentToQueries`, che lo
        // inserisce nel campo `Frase dell'utente: "..."` del prompt. Risultato:
        // al traduttore veniva detto che l'utente aveva scritto
        //     "parchi e ville [Profilo utente: ... Evita se possibile: natura ...]"
        // cioe' gli si chiedeva di evitare la natura dentro una richiesta di
        // parchi. MISURATO chiamando il modello col prompt reale:
        //     "parchi e ville" pulito           -> categoria=natura   (corretto)
        //     "parchi e ville" + profilo food   -> categoria=cultura  (deviato)
        // Il traduttore non sbagliava: gli arrivava un input falso.
        //
        // Il profilo NON viene tolto, viene rimesso al suo posto: viaggia gia'
        // sul parametro `aiProfile` qui sotto, che il selettore riceve con la sua
        // etichetta (`buildSelectorSystemPrompt`: "• profilo implicito"). Anzi,
        // fino a oggi il selettore lo riceveva DUE VOLTE — dentro la richiesta
        // utente e come profilo. Ora una volta sola, e nel campo giusto.
        //
        // Il profilo continua a influenzare QUALE POI si sceglie. Smette di
        // influenzare COSA si e' chiesto.

        try {
            // Gate 2 FASE 3 — cityCenter dalla città target, mai dal GPS utente.
            // Se resolveCityCenter fallisce (proxy giù o città non trovata su
            // Google), il flusso si interrompe con toast tecnico — nessun tour
            // finto. Chiude il buco #3 diagnosi Gate 1.
            let cityCenter;
            try {
                cityCenter = await resolveCityCenter(activeCity);
            } catch (ccErr) {
                if (ccErr instanceof CityCenterUnresolvedError) {
                    console.warn('[AiItinerary] resolveCityCenter failed:', ccErr.reason, ccErr.message);
                    toast({
                        title: 'Non riesco a raggiungere i posti.',
                        description: 'Riprova tra un attimo.',
                        type: 'warning',
                        duration: 5000,
                    });
                    setGeneratedItinerary(null);
                    setCurrentStep(0);
                    return;
                }
                throw ccErr;
            }

            const result = await aiRecommendationService.generateItinerary(
                activeCity,
                prefsObject,
                userPrompt, // F65: la frase dell'utente, PULITA. Il profilo va sotto.
                { condition: weatherCondition || 'sunny', temperature: temperatureC || 20 },
                aiProfile, // Tour DNA iniettato nel system prompt
                cityCenter, // Gate 2 FASE 3 — centro amministrativo città (mai GPS utente)
            );

            // Gate B — Path A no-results: il motore ha risolto oggetto_umano dal
            // traduttore d'intento. Toast onesto con "A ${city} non troviamo ${oggetto}".
            if (result?._source === 'no-results' || result?._source === 'no-results-error' || result?._source === 'no-results-safety') {
                const oggetto = result?._oggetto_umano || 'quello che hai chiesto';
                console.warn(`[AiItinerary] path A no-results (source=${result._source}, oggetto="${oggetto}")`);
                toast({
                    title: `A ${activeCity} non troviamo ${oggetto}.`,
                    description: 'Cambia richiesta e riprovo.',
                    type: 'info',
                    duration: 6000,
                });
                setGeneratedItinerary(null);
                setCurrentStep(0);
                return;
            }

            const itineraryDays = result.days || result;
            if (!itineraryDays || !Array.isArray(itineraryDays) || itineraryDays.length === 0) {
                throw new Error("No itinerary generated");
            }

            // Gate D-5: rimosso il check _isFallback. Il motore non produce
            // più tour statici da CITY_POIS: ogni errore rilancia e il catch
            // sotto mostra il messaggio onesto ("L'AI sta avendo un momento
            // difficile"). Nessun fallback silente qui.
            setGeneratedItinerary(itineraryDays);
            setCurrentStep(2);

            // DVAI-045: traccia le preferenze usate per l'apprendimento futuro
            trackGeneratedTour({ ...prefsObject, city: activeCity, date: new Date().toISOString() });

        } catch (error) {
            console.error("AI Generation Error", error);
            // DVAI-050 — cap anti-abuso 10/giorno: messaggio gentile, non paywall
            if (error?.code === 'QUOTA_EXCEEDED') {
                // DVAI-056: copy locked — voce DoveVAI, non punitiva. Type info + 5s.
                toast({
                    title: 'Hai esplorato tanto oggi',
                    description: 'Le tue esperienze di oggi sono esaurite. Domani ne troverai di nuove, cucite su di te.',
                    type: 'info',
                    duration: 5000,
                });
            } else {
                toast({
                    title: "L'AI sta avendo un momento difficile",
                    description: 'Riprova tra qualche secondo — il tuo itinerario personalizzato è quasi pronto.',
                    type: 'warning',
                    duration: 5000,
                });
            }
            // Non mostriamo un fallback statico — l'utente può riprovare
            setGeneratedItinerary(null);
            setCurrentStep(0); // Torna alla schermata di input con il pulsante visibile
        } finally {
            setIsGenerating(false);
        }
    };

    // DVAI-028: Rigenerazione giorno reale via AI (era setTimeout mock)
    const regenerateDay = async (dayNumber) => {
        if (!generatedItinerary) return;
        setIsGenerating(true);

        const prefsObject = userPreferences.reduce((acc, pref) => {
            acc[pref.id] = pref.selected;
            return acc;
        }, {});

        try {
            // Gate 2 FASE 3 — cityCenter dalla città target, mai dal GPS utente.
            // Silent fail su regenerate (l'utente ha già un tour valido, non lo
            // sostituiamo con nulla). Se resolve fallisce, il regenerate viene
            // saltato con warn — comportamento voluto per non rompere il tour esistente.
            let cityCenter;
            try {
                cityCenter = await resolveCityCenter(activeCity);
            } catch (ccErr) {
                console.warn('[AI] regenerateDay: resolveCityCenter failed, skip:', ccErr?.reason || ccErr?.message);
                return;
            }
            const result = await aiRecommendationService.generateItinerary(
                activeCity,
                { ...prefsObject, duration: 'Mezza Giornata' },
                `Rigenera solo il giorno ${dayNumber} con varianti diverse rispetto al precedente.`,
                { condition: weatherCondition || 'sunny', temperature: temperatureC || 20 },
                '',
                cityCenter, // Gate 2 FASE 3 — centro amministrativo città (mai GPS utente)
            );
            // Gate NARRATORE/POI (Fase 2a) — `if (newDay)` non bastava:
            // { stops: [] } è truthy, quindi il payload onesto del motore
            // sostituiva il giorno visualizzato con uno vuoto, in silenzio.
            // Meglio il vecchio contenuto vero che il vuoto.
            const newDay = result.days?.[0];
            if (!shouldReplaceDay(newDay)) {
                console.warn(`[AI] regenerateDay: 0 tappe → giorno ${dayNumber} invariato (source=${result?._source || 'unknown'})`);
                toast({
                    title: `Il giorno ${dayNumber} resta com'era.`,
                    description: `A ${activeCity} la rigenerazione non ha prodotto tappe nuove.`,
                    type: 'info',
                    duration: 5000,
                });
                return;
            }
            setGeneratedItinerary(prev =>
                prev.map(d => d.day === dayNumber ? { ...newDay, day: dayNumber } : d)
            );
        } catch (err) {
            console.warn('[AI] regenerateDay failed:', err.message);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="min-h-screen bg-obsidian-bg font-quicksand text-obsidian-primary flex flex-col justify-between">
            <TopBar />

            <main className="max-w-md mx-auto px-4 py-6 pb-24 w-full">
                {/* Back Button */}
                <div className="mb-4">
                    <Link
                        to="/dashboard-user"
                        className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-obsidian-card border border-obsidian-border text-obsidian-secondary hover:text-obsidian-primary transition-colors text-xs font-bold"
                    >
                        <ArrowLeft size={14} />
                        <span>Home</span>
                    </Link>
                </div>

                {/* Header - Travel Designer AI */}
                <div className="text-center mb-6">
                    <div className="w-16 h-16 rounded-2xl bg-obsidian-card border border-obsidian-border flex items-center justify-center text-brand-orange mx-auto mb-3 shadow-md">
                        <Brain className="w-8 h-8 text-brand-orange" />
                    </div>
                    <h1 className="text-2xl font-bold text-obsidian-primary mb-1">
                        Il Tuo Travel Designer AI
                    </h1>
                    <p className="text-obsidian-secondary text-sm font-medium">Raccontami il tuo sogno, io lo trasformo in viaggio.</p>
                </div>

                {/* Step Indicator */}
                <div className="flex items-center justify-center mb-8">
                    {['Sogni', 'Magia', 'Realtà'].map((step, index) => (
                        <div key={step} className="flex items-center">
                            <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-sm ${
                                    index <= currentStep
                                        ? 'bg-brand-orange text-obsidian-bg'
                                        : 'bg-obsidian-card text-obsidian-secondary border border-obsidian-border'
                                }`}
                            >
                                {index + 1}
                            </div>
                            {index < 2 && (
                                <div className={`w-10 h-0.5 mx-2 rounded-full transition-all ${
                                    index < currentStep ? 'bg-brand-orange' : 'bg-obsidian-border'
                                }`} />
                            )}
                        </div>
                    ))}
                </div>

                {/* Step 1: Preferences */}
                {currentStep === 0 && (
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.5 }}
                    >
                        <div className="space-y-6">
                            {/* Pro Input Card */}
                            <div className="bg-obsidian-card rounded-2xl p-4 border border-obsidian-border shadow-sm">
                                <div className="flex items-center space-x-2 mb-3">
                                    <Sparkles className="w-4 h-4 text-brand-orange" />
                                    <h3 className="font-bold text-obsidian-primary text-sm">La tua visione</h3>
                                </div>

                                <div className="relative">
                                    <textarea
                                        value={userPrompt}
                                        onChange={(e) => setUserPrompt(e.target.value)}
                                        placeholder="Es: 'Voglio perdermi tra i vicoli di Trastevere, mangiare la carbonara migliore e finire la serata in un jazz club nascosto...'"
                                        className="w-full h-28 bg-obsidian-raised rounded-xl p-3.5 text-obsidian-primary placeholder-obsidian-secondary/50 focus:outline-none focus:border-brand-orange focus:ring-1 focus:ring-brand-orange transition-all resize-none border border-obsidian-border text-sm"
                                    />
                                    <div className="flex items-center justify-end space-x-1.5 mt-1.5 px-1">
                                        <span className="text-[11px] text-obsidian-secondary font-medium">
                                            {userPrompt.length > 0 ? 'Perfetto!' : 'Sii creativo...'}
                                        </span>
                                        <div className="w-1.5 h-1.5 rounded-full bg-brand-orange animate-pulse" />
                                    </div>
                                </div>
                            </div>

                            {/* Filters "Pills" Style */}
                            <div className="space-y-5">
                                {userPreferences.map((pref) => (
                                    <div key={pref.id}>
                                        <h3 className="text-xs font-bold text-obsidian-secondary uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                                            <span>{pref.emoji}</span> {pref.title}
                                        </h3>

                                        <div className="flex flex-wrap gap-2.5">
                                            {pref.options.map((option) => {
                                                const isSelected = pref.id === 'interests'
                                                    ? pref.selected.includes(option)
                                                    : pref.selected === option;

                                                return (
                                                    <button
                                                        key={option}
                                                        type="button"
                                                        onClick={() => {
                                                            if (pref.id === 'interests') {
                                                                const current = pref.selected;
                                                                const newSelection = current.includes(option)
                                                                    ? current.filter(item => item !== option)
                                                                    : [...current, option];
                                                                updatePreference(pref.id, newSelection);
                                                            } else {
                                                                updatePreference(pref.id, option);
                                                            }
                                                        }}
                                                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                                                            isSelected
                                                                ? 'bg-obsidian-raised border-brand-orange ring-1 ring-brand-orange/40 text-obsidian-primary'
                                                                : 'bg-obsidian-card border-obsidian-border text-obsidian-secondary hover:text-obsidian-primary hover:bg-obsidian-raised'
                                                        }`}
                                                    >
                                                        {option}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* CTA Genera Viaggio — Unica CTA arancione */}
                        <div className="mt-8 mb-6">
                            <button
                                type="button"
                                onClick={() => {
                                    setCurrentStep(1);
                                    generateItinerary();
                                }}
                                disabled={!userPrompt.trim() && !userPreferences.some(pref =>
                                    pref.selected && (Array.isArray(pref.selected) ? pref.selected.length > 0 : true)
                                )}
                                className={`w-full py-4 px-6 rounded-2xl font-bold transition-colors flex items-center justify-center gap-2 shadow-lg ${
                                    userPrompt.trim() || userPreferences.some(pref =>
                                        pref.selected && (Array.isArray(pref.selected) ? pref.selected.length > 0 : true)
                                    )
                                        ? 'bg-brand-orange hover:bg-brand-orange-hover text-obsidian-bg shadow-brand-orange/20 cursor-pointer'
                                        : 'bg-obsidian-raised text-obsidian-secondary/40 border border-obsidian-border cursor-not-allowed'
                                }`}
                            >
                                <Brain className="w-5 h-5" />
                                <span className="text-base font-bold">Genera Viaggio</span>
                                <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                    </motion.div>
                )}

                {/* Step 2: Sophisticated Loading */}
                {currentStep === 1 && (
                    <div className="text-center py-16">
                        <div className="relative w-20 h-20 mx-auto mb-8">
                            <div className="w-20 h-20 rounded-3xl bg-obsidian-card border border-obsidian-border flex items-center justify-center text-brand-orange shadow-xl relative z-10">
                                <Brain className="w-10 h-10 animate-pulse text-brand-orange" />
                            </div>
                            <div className="absolute -inset-2 rounded-[28px] bg-brand-orange/20 animate-ping opacity-40" />
                        </div>

                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-obsidian-raised border border-obsidian-border text-brand-orange text-xs font-semibold mb-3">
                            <Sparkles size={12} />
                            <span>Creazione Itinerario AI</span>
                        </div>

                        <h2 className="text-xl font-bold text-obsidian-primary mb-2">Creazione Itinerario...</h2>
                        <p className="text-xs text-obsidian-secondary max-w-xs mx-auto leading-relaxed font-medium mb-8">
                            L'IA sta consultando le guide locali e analizzando il meteo.
                        </p>

                        <div className="max-w-xs mx-auto space-y-3">
                            {[
                                { text: "Analisi preferenze" },
                                { text: "Selezione gemme nascoste" },
                                { text: "Ottimizzazione percorso" }
                            ].map((item) => (
                                <div
                                    key={item.text}
                                    className="flex items-center space-x-3 bg-obsidian-card border border-obsidian-border rounded-xl p-3"
                                >
                                    <div className="w-2 h-2 rounded-full bg-brand-orange animate-pulse" />
                                    <span className="text-xs font-medium text-obsidian-secondary">{item.text}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Step 3: Generated Itinerary */}
                {currentStep === 2 && generatedItinerary && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                    >
                        {/* Day Navigator */}
                        <div className="flex space-x-2 mb-6 overflow-x-auto pb-2 scrollbar-none">
                            {generatedItinerary.map((day) => (
                                <button
                                    key={day.day}
                                    type="button"
                                    onClick={() => setCurrentDay(day.day)}
                                    className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                                        currentDay === day.day
                                            ? 'bg-obsidian-raised border-brand-orange ring-1 ring-brand-orange/40 text-obsidian-primary'
                                            : 'bg-obsidian-card border-obsidian-border text-obsidian-secondary hover:text-obsidian-primary'
                                    }`}
                                >
                                    Giorno {day.day}
                                </button>
                            ))}
                        </div>

                        {/* Current Day Details */}
                        <AnimatePresence mode="wait">
                            {generatedItinerary
                                .filter(day => day.day === currentDay)
                                .map(day => (
                                    <motion.div
                                        key={day.day}
                                        initial={{ opacity: 0, x: 50 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -50 }}
                                    >
                                        {/* Day Header */}
                                        <div className="bg-obsidian-card border border-obsidian-border rounded-2xl p-5 shadow-sm mb-6">
                                            <div className="flex items-center justify-between mb-2">
                                                <div>
                                                    <h2 className="text-xl font-bold text-obsidian-primary">{day.title}</h2>
                                                    <p className="text-obsidian-secondary text-xs mt-0.5">
                                                        {day.stops.length} tappe programmate
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => regenerateDay(day.day)}
                                                    className="p-2.5 bg-obsidian-raised hover:bg-obsidian-border border border-obsidian-border text-obsidian-secondary hover:text-obsidian-primary rounded-xl transition-colors cursor-pointer"
                                                    title="Rigenera giorno"
                                                >
                                                    <Shuffle className="w-4 h-4" />
                                                </button>
                                            </div>

                                            {day.weather && (
                                                <div className="flex items-center space-x-3 bg-obsidian-raised border border-obsidian-border p-3 rounded-xl mt-3">
                                                    <span className="text-2xl">{day.weather.icon}</span>
                                                    <div>
                                                        <p className="font-medium text-obsidian-primary text-xs">{day.weather.condition}</p>
                                                        <p className="text-[11px] text-obsidian-secondary">{day.weather.temperature}°C</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Stops Timeline */}
                                        {/* Gate RAGGIO DIFF 1b — gli offset si DERIVANO qui, al render,
                                            dai campi che computeStopTimings ha gia' messo sulle tappe.
                                            Non si persistono e non si chiedono al modello: un cumulativo
                                            salvato sarebbe vero solo finche' l'ordine non cambia, e
                                            l'ordine lo decide sortByProximity a monte. */}
                                        <div className="space-y-3">
                                            {(() => {
                                                const offsets = computeCumulativeOffsets(day.stops);
                                                return day.stops.map((stop, index) => {
                                                const IconComponent = (typeof stop.icon === 'string'
                                                    ? { Camera, ShoppingBag, Utensils, Eye, Coffee, MapPin }[stop.icon] || MapPin
                                                    : stop.icon) || MapPin;

                                                // "Inizio" per la prima tappa, "+35 min" per le altre,
                                                // null se un addendo manca (e allora non si monta nulla).
                                                const offsetLabel = formatOffsetLabel(offsets[index]);
                                                // La sosta e' un'altra informazione: quanto stai QUI, non
                                                // quanto e' passato dall'inizio. Sta sulla card, non nella
                                                // colonna, e porta il tilde della stima.
                                                const stayLabel = formatEstimate(stop.stayMinutes);

                                                return (
                                                    <div
                                                        key={stop.title ?? index}
                                                        className="bg-obsidian-card rounded-2xl border border-obsidian-border overflow-hidden shadow-sm"
                                                    >
                                                        <div className="flex">
                                                            {/* Left column + Icon — VINCOLO TECNICO: min-w-[64px] INVARIATO */}
                                                            <div className="flex flex-col items-center justify-start bg-obsidian-raised border-r border-obsidian-border px-3 py-4 min-w-[64px]">
                                                                {/* Gate RAGGIO DIFF 1b — offset su scala neutra, senza accento */}
                                                                {offsetLabel && (
                                                                    <span className="text-obsidian-secondary font-bold text-xs mb-2 whitespace-nowrap">{offsetLabel}</span>
                                                                )}
                                                                <div className="w-9 h-9 bg-obsidian-card border border-obsidian-border rounded-full flex items-center justify-center text-obsidian-primary">
                                                                    <IconComponent className="w-4 h-4 text-obsidian-secondary" />
                                                                </div>
                                                            </div>

                                                            {/* Content */}
                                                            <div className="flex-1 p-4">
                                                                <div className="flex items-start justify-between gap-2 mb-1">
                                                                    <h4 className="font-bold text-obsidian-primary text-sm leading-tight">{stop.title}</h4>
                                                                    {stop.rating && (
                                                                        <div className="flex items-center gap-1 flex-shrink-0 bg-obsidian-raised border border-obsidian-border px-2 py-0.5 rounded-full">
                                                                            <Star className="w-3 h-3 text-brand-orange fill-current" />
                                                                            <span className="text-xs font-bold text-obsidian-primary">{stop.rating}</span>
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                <p className="text-xs text-obsidian-secondary mb-2 line-clamp-2 leading-relaxed">{stop.description}</p>

                                                                <div className="flex items-center justify-between">
                                                                    <div className="flex items-center gap-2">
                                                                        {/* Categoria */}
                                                                        <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-obsidian-raised border border-obsidian-border text-obsidian-secondary">
                                                                            {stop.type}
                                                                        </span>
                                                                        {/* Sosta stimata */}
                                                                        {stayLabel && (
                                                                            <span className="text-xs text-obsidian-secondary flex items-center gap-1">
                                                                                <Clock className="w-3 h-3 text-obsidian-secondary" />
                                                                                {stayLabel}
                                                                            </span>
                                                                        )}
                                                                    </div>

                                                                    <button
                                                                        type="button"
                                                                        onClick={() => { setSelectedStop(stop); trackInteraction?.('stop_detail_view', { category: stop.type, city: activeCity, title: stop.title }); }}
                                                                        className="text-obsidian-secondary hover:text-obsidian-primary text-xs font-bold transition-colors cursor-pointer"
                                                                    >
                                                                        Dettagli →
                                                                    </button>
                                                                </div>

                                                                {stop.location && (
                                                                    <p className="text-[11px] text-obsidian-secondary flex items-center mt-1.5">
                                                                        <MapPin className="w-3 h-3 mr-1 flex-shrink-0 text-obsidian-secondary" />
                                                                        {stop.location}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                                });
                                            })()}
                                        </div>
                                    </motion.div>
                                ))}
                        </AnimatePresence>

                        {/* Action Buttons — Una sola CTA arancione */}
                        <div className="flex space-x-3 mt-8">
                            <button
                                type="button"
                                onClick={() => {
                                    setCurrentStep(0);
                                    setGeneratedItinerary(null);
                                }}
                                className="flex-1 bg-obsidian-raised hover:bg-obsidian-border text-obsidian-secondary hover:text-obsidian-primary py-3.5 px-4 rounded-xl font-bold text-xs transition-colors flex items-center justify-center space-x-2 border border-obsidian-border cursor-pointer"
                            >
                                <Shuffle className="w-4 h-4" />
                                <span>Ricomincia</span>
                            </button>

                            <Link
                                to="/map"
                                state={{
                                    route: generatedItinerary.find(d => d.day === currentDay)?.stops.map((s, i) => ({
                                        latitude: s.latitude,
                                        longitude: s.longitude,
                                        label: s.title,
                                        title: s.title, // Keep title for fallback
                                        name: s.title,  // Required for MapPage activity card
                                        description: s.description,
                                        category: s.type || 'Punto Mappa',
                                        // Gate VERITÀ VISIVA (F26) DIFF 5 — via lo stock.
                                        // `s.photos` non e' mai valorizzato, quindi lo stock
                                        // vinceva SEMPRE, su ogni waypoint di "Vedi su Mappa".
                                        // Che a valle venga filtrato (isPlacesPhoto nei drawer,
                                        // activityPhotoUrl in MapPage) e' la ragione per toglierlo,
                                        // non per lasciarlo: la sorgente resta viva per il prossimo
                                        // consumatore che non conosce l'allowlist.
                                        image: s.photos?.[0] || null,
                                        index: i + 1,
                                        type: 'waypoint'
                                    })) || [],
                                    // DVAI-053: normalizer unificato — passo i raw stops e il city,
                                    // il normalizer estrae title/description/transition/insiderTip/bestTime,
                                    // entrambe le forme di coord, image da googlePhoto.
                                    tourData: normalizeTour({
                                        id: `ai-itinerary-${Date.now()}`,
                                        title: generatedItinerary.find(d => d.day === currentDay)?.title || "Itinerario AI",
                                        type: 'ai-generated',
                                        isAiGenerated: true,
                                        city: activeCity || 'Roma',
                                        tags: [
                                            "AI",
                                            ...(userPrompt ? userPrompt.split(/\s+/).map(w => w.replace(/[^\w\s]/gi, '')) : []),
                                            ...(userPreferences.find(p => p.id === 'interests')?.selected || [])
                                        ],
                                        // stops grezzi dall'AI: il normalizer fa tutto il resto.
                                        stops: generatedItinerary.find(d => d.day === currentDay)?.stops || [],
                                    }, {
                                        cityFallback: activeCity || 'Roma',
                                        // Gate 2 FASE 3 — cityCenter dalla città target (mai GPS utente).
                                        // resolvedCityCenter è null se resolveCityCenter non ha ancora
                                        // risposto o è fallita: il normalizer applica il filtro solo se
                                        // il centro è presente. Il tour è stato generato con il centro
                                        // giusto nel flusso async, quindi il doppio filtro qui è
                                        // idempotente quando presente.
                                        cityCenter: resolvedCityCenter,
                                    })
                                }}
                                className="flex-1"
                            >
                                <button
                                    type="button"
                                    className="w-full bg-brand-orange hover:bg-brand-orange-hover text-obsidian-bg py-3.5 px-4 rounded-xl font-bold text-sm shadow-lg shadow-brand-orange/20 transition-colors flex items-center justify-center space-x-2 cursor-pointer"
                                >
                                    <Navigation className="w-4 h-4" />
                                    <span>Vedi su Mappa</span>
                                </button>
                            </Link>
                        </div>
                    </motion.div>
                )}

                {/* Stop Detail Modal */}
                <AnimatePresence>
                    {selectedStop && (
                        <motion.div
                            className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-4"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setSelectedStop(null)}
                        >
                            <motion.div
                                className="bg-obsidian-card border border-obsidian-border rounded-3xl p-6 max-w-sm w-full max-h-[80vh] overflow-y-auto text-obsidian-primary shadow-2xl"
                                initial={{ scale: 0.95, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.95, opacity: 0 }}
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-bold text-obsidian-primary leading-tight">{selectedStop.title}</h3>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedStop(null)}
                                        className="p-1.5 rounded-full bg-obsidian-raised hover:bg-obsidian-border text-obsidian-secondary hover:text-obsidian-primary transition-colors cursor-pointer"
                                    >
                                        ✕
                                    </button>
                                </div>

                                {/* Gate PULIZIA P5 — rimossi tre blocchi senza sorgente */}
                                <div className="space-y-4">
                                    {selectedStop.description && (
                                        <p className="text-xs text-obsidian-secondary leading-relaxed">{selectedStop.description}</p>
                                    )}

                                    {selectedStop.insiderTip && (
                                        <div className="bg-obsidian-raised/60 border border-obsidian-border rounded-xl p-3">
                                            <h4 className="font-bold text-obsidian-primary text-xs mb-1">Consiglio insider</h4>
                                            <p className="text-xs text-obsidian-secondary leading-relaxed">{selectedStop.insiderTip}</p>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-2 gap-3">
                                        {selectedStop.time && (
                                            <div className="bg-obsidian-raised border border-obsidian-border rounded-xl p-2.5">
                                                <h4 className="font-bold text-obsidian-secondary text-[10px] uppercase tracking-wider">Orario</h4>
                                                <p className="text-xs font-semibold text-obsidian-primary mt-0.5">{selectedStop.time}</p>
                                            </div>
                                        )}
                                        {selectedStop.rating && (
                                            <div className="bg-obsidian-raised border border-obsidian-border rounded-xl p-2.5">
                                                <h4 className="font-bold text-obsidian-secondary text-[10px] uppercase tracking-wider">Rating</h4>
                                                <div className="flex items-center space-x-1 mt-0.5">
                                                    <Star className="w-3.5 h-3.5 text-brand-orange fill-current" />
                                                    <span className="text-xs font-bold text-obsidian-primary">{selectedStop.rating}/5</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>

            <BottomNavigation />
        </div>
    );
}
