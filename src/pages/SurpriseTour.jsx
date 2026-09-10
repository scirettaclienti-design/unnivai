import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import { MapPin, Star, Clock, Users, ArrowLeft, Sparkles, Gift, ArrowRight, AlertCircle, Compass } from "lucide-react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import TopBar from "../components/TopBar";
import BottomNavigation from "../components/BottomNavigation";
import { getCoverPalette } from "@/lib/categoryPalette";

// Gate VERITÀ VISIVA (F26) DIFF 5 — rimossi CITY_IMAGES e getAdaptiveImage.
// Senza foto reale la copertina e' null e cade nel ramo B illustrato
// (gradient di categoria + glifo).

const surpriseTypes = [
    {
        id: 1,
        title: "Tour Gastronomico",
        emoji: "🍕",
        count: 8,
        categoryName: "Gastronomia"
    },
    {
        id: 2,
        title: "Avventura Culturale",
        emoji: "🏛️",
        count: 6,
        categoryName: "Arte"
    },
    {
        id: 3,
        title: "Esperienza Naturale",
        emoji: "🌿",
        count: 10,
        categoryName: "Natura"
    },
    {
        id: 4,
        title: "Sorpresa Totale",
        emoji: "🎲",
        count: 15,
        categoryName: null
    }
];

const formatMinutes = (min) => {
    if (!Number.isFinite(min) || min <= 0) return null;
    if (min < 60) return `${min} min`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
};

import { useUserContext } from "@/hooks/useUserContext";
import { useAILearning } from "@/hooks/useAILearning";
import { aiRecommendationService } from "@/services/aiRecommendationService";
import { normalizeTour } from "@/services/tourShape";
import { useToast } from "@/hooks/use-toast";

// Gate NARRATORE/POI (Fase 2a) — decisione pura, esportata per i test.
// Stesso pattern di getTourRenderState (TourDetails, Gate E-1): la scelta sta
// in una funzione pura, il componente la applica e basta.
//
// Il motore restituisce { days: [{ stops: [] }], _source: 'no-results' } quando
// non ha tappe da servire — `days.length` vale 1, non 0. Per questo si guardano
// LE TAPPE e non `_source`: il guard regge per qualunque via il tour si svuoti,
// non solo per i tre `_source` di no-results. È il motivo per cui QuickPath
// (:641-648) non si è mai rotto su questo caso, ed è il modello imitato qui.
//
// @returns {'error'|'empty'|'ready'}
export function getSurpriseOutcome(result) {
    if (!result || !Array.isArray(result.days) || result.days.length === 0) return 'error';
    const stops = result.days[0]?.stops;
    if (!Array.isArray(stops) || stops.length === 0) return 'empty';
    return 'ready';
}

export default function SurpriseTourPage() {
    // DVAI-055: estraggo lat/lng dal userContext per il vincolo geografico
    const { city, userId, firstName, lat, lng } = useUserContext();
    const { toast } = useToast();
    const { userDNAPreferences } = useAILearning();

    const navigate = useNavigate();
    const location = useLocation();
    // Gate PULIZIA P4 (DIFF 6) — rimosso lo state `selectedSurprise`: il setter
    // non era chiamato da nessuna parte e l'unico blocco che lo leggeva era il
    // JSX morto qui sotto. Il termine `!selectedSurprise` nella condizione di
    // autoSuggest era costantemente true, quindi toglierlo non cambia il flusso.
    const [isShuffling, setIsShuffling] = useState(false);
    const [selectedFilter, setSelectedFilter] = useState(null);
    // Gate Z.3: id del tipo cliccato. Distinto da selectedFilter perche'
    // "Sorpresa Totale" (id=4) ha filterMap[4]=null: click su Sorpresa Totale
    // -> selectedFilter=null MA selectedSurpriseType=4 (scelta esplicita).
    // Il bottone Genera si attiva quando selectedSurpriseType !== null.
    const [selectedSurpriseType, setSelectedSurpriseType] = useState(null);
    const [generatedTour, setGeneratedTour] = useState(null);
    const [generationError, setGenerationError] = useState(null);
    // DVAI-061 B — Flash pulsante "Domani nuove esperienze 🌅" per 3s quando
    // quota esaurita. Feedback dove l'utente sta guardando (il pulsante), non
    // solo il toast in basso (banner blindness + fuori viewport iPhone).
    const [quotaExhaustedFlash, setQuotaExhaustedFlash] = useState(false);
    const quotaFlashTimerRef = useRef(null);

    const triggerQuotaFlash = () => {
        setQuotaExhaustedFlash(true);
        if (quotaFlashTimerRef.current) clearTimeout(quotaFlashTimerRef.current);
        quotaFlashTimerRef.current = setTimeout(() => setQuotaExhaustedFlash(false), 3000);
    };

    useEffect(() => () => {
        if (quotaFlashTimerRef.current) clearTimeout(quotaFlashTimerRef.current);
    }, []);

    // Dynamic filtered list based on ACTIVE CITY
    // Gate J2: currentExperiences + getFilteredExperiences rimossi (lista finta).

    const filterMap = {
        1: "Gastronomia",
        2: "Arte",
        3: "Natura",
        4: null
    };

    // Gate J2: getFilteredExperiences rimossa (era la funzione che ritornava
    // le 3 esperienze finte filtrate).

    // 🚀 INNESCO AUTOMATICO (se si arriva da una Card Inconscia)
    useEffect(() => {
        if (location.state?.autoSuggest && !isShuffling) {
            // Eseguiamo la simulazione grafica per 1.5 secondi prima di triggerare davvero, o triggeriamo subito.
            // Puliamo lo state per non ciclare se torna indietro
            const suggestion = location.state.autoSuggest;
            window.history.replaceState({ ...window.history.state, usr: { ...location.state, autoSuggest: null } }, '');
            
            // Aspettiamo che la pagina si renderizzi e poi inneschiamo
            setTimeout(() => {
                shuffleExperience(suggestion);
            }, 600);
        }
        if (location.state?.previewTour) {
            setGeneratedTour(location.state.previewTour);
            setSelectedFilter(location.state.previewFilter || 'Gastronomia');
        }
        if (location.state?.previewError) {
            setGenerationError(location.state.previewError);
        }
        if (location.state?.previewLoading) {
            setIsShuffling(true);
        }
    }, [location.state]);

    const shuffleExperience = async (suggestedTheme = null) => {
        console.log('[DVAI-061] shuffleExperience: click received', { suggestedTheme, city, hasGps: Number.isFinite(lat) && Number.isFinite(lng) });

        // DVAI-061 C — Preflight quota lato client. Se già a limite: feedback
        // immediato sul pulsante (B) + toast, ZERO spinner, ZERO delay.
        // Non blocca guest (authenticated=false → exceeded=false).
        try {
            const quotaStatus = await aiRecommendationService.getDailyQuotaStatus();
            console.log('[DVAI-061] shuffleExperience: quota preflight =', quotaStatus);
            if (quotaStatus.exceeded) {
                console.log('[DVAI-061] shuffleExperience: quota exceeded → flash pulsante + toast (no spinner, no delay)');
                triggerQuotaFlash();
                toast({
                    title: 'Hai esplorato tanto oggi',
                    description: 'Le tue esperienze di oggi sono esaurite. Domani ne troverai di nuove, cucite su di te.',
                    type: 'info',
                    duration: 5000,
                });
                return;
            }
        } catch (preflightErr) {
            console.warn('[DVAI-061] shuffleExperience: preflight failed, proseguo con generation', preflightErr?.message);
        }

        // DVAI-061 A — Feedback immediato: parte lo spinner ora, senza il vecchio
        // await 1500ms hardcoded. Se generateItinerary fallisce in <500ms, il
        // toast/flash arriva subito senza far attendere l'utente sotto finto spinner.
        setIsShuffling(true);
        console.log('[DVAI-061] shuffleExperience: generation started');

        try {
            // 1. Prepare User Context using AI History
            const pastInterests = userDNAPreferences.map(p => {
                const parts = [p.inspiration, p.mood, p.category].filter(Boolean);
                return parts.length > 0 ? parts.join(' ') : null;
            }).filter(Boolean).slice(0, 3);
            const pastPace = userDNAPreferences.find(p => p.duration)?.duration || 'Medio';
            const pastGroup = userDNAPreferences.find(p => p.group)?.group || 'Solo';

            const userProfile = {
                bio: "Profilo vettoriale estratto dalle generazioni passate.",
                interests: suggestedTheme ? [suggestedTheme] : selectedFilter ? [selectedFilter] : (pastInterests.length > 0 ? pastInterests : ["Arte", "Cibo", "Scoperte Urbane"]),
                expectedPace: pastPace,
                expectedGroup: pastGroup
            };

            // DVAI-055: rimosso il "20 km" mal collocato dal userPrompt — il vincolo
            // geografico è ora nel system prompt (regola 15) via cityCenter, e il
            // filtro Haversine a valle lo garantisce anche se l'AI non lo rispetta.
            const prompt = `Sei l'intelligenza di Unnivai. Genera un'esperienza a sorpresa esaltante a ${city || 'Roma'}.
            Dati Storici Inconsci Utente: Cerca ritmi di viaggio [${userProfile.expectedPace}] in compagnia di [${userProfile.expectedGroup}].
            Interessi storici calcolati: ${userProfile.interests.join(', ')}.
            Categoria di oggi: ${suggestedTheme ? suggestedTheme : selectedFilter || 'Mix delle sue più profonde passioni storiche'}.
            L'esperienza DEVE essere fuori dai soliti schemi turistici commerciali e sembrare magia pura, calzando i suoi gusti inconsci.
            NON inventare coordinate.`;

            // 2. Call AI Service
            const result = await aiRecommendationService.generateItinerary(
                city || 'Roma',
                {
                    interests: userProfile.interests,
                    duration: 'Mezza Giornata',
                    budget: 'Medio'
                },
                prompt,
                {},
                '',
                // DVAI-055: cityCenter dal userContext. Se lat/lng assenti, no filtro
                // (retrocompat: fallback al comportamento precedente).
                Number.isFinite(lat) && Number.isFinite(lng) ? { latitude: lat, longitude: lng } : null
            );

            // Gate NARRATORE/POI (Fase 2a) — il check storico
            // (`!result.days || result.days.length === 0`) NON scattava mai sul
            // payload onesto del motore: { days: [{ stops: [] }] } ha
            // days.length === 1. Si arrivava a navigare su un tour a zero tappe.
            const outcome = getSurpriseOutcome(result);
            if (outcome === 'error') throw new Error("AI Generation Failed");
            if (outcome === 'empty') {
                const oggetto = result?._oggetto_umano || null;
                console.warn(`[DVAI-061] shuffleExperience: motore 0 tappe → nessuna navigazione (oggetto="${oggetto || 'n/a'}", source=${result?._source || 'unknown'})`);
                setGenerationError({
                    title: oggetto
                        ? `A ${city || 'Roma'} non troviamo ${oggetto}.`
                        : 'Non basta per un tour.',
                    description: oggetto
                        ? 'Cambia richiesta e riprovo.'
                        : `A ${city || 'Roma'} non ci sono abbastanza posti veri per quello che hai chiesto.`
                });
                return;
            }

            // 3. Map to Tour Data Format
            const surpriseTour = result.days[0]; // Take 1st day as the experience

            // Generate Route Path (Linear approximation for now, or use mapService if available)
            // Just connecting dots for visual feedback
            const routeCoords = surpriseTour.stops.map(s => `${s.longitude} ${s.latitude}`).join(', ');
            const routeWKT = `LINESTRING(${routeCoords})`;

            // DVAI-051 + F26 DIFF 5: cover reale dal primo POI (Google Places), oppure
            // nessuna copertina. Il "fallback tematico citta'" e' stato rimosso.
            // Mantiene gli stessi campi narrativi del tour insider per renderizzare
            // "💡 Insider", "Quando:", "→ transizione" nella scheda.
            const stop0 = surpriseTour.stops[0] || {};
            const cover = stop0.googlePhoto || null;

            // DVAI-053: normalizer unificato — stessa shape di Per Te e AiItinerary.
            const mappedTour = normalizeTour({
                id: 'surprise-' + Date.now(),
                title: surpriseTour.title || "Avventura a Sorpresa",
                // DVAI-051: serializzazione safe — userProfile.interests può contenere
                // selectedFilter/suggestedTheme che a volte sono React elements (e
                // JSON.stringify cicla su FiberNode → TypeError). Estraiamo solo testo.
                description: `Un'esperienza unica generata per te: ${userProfile.interests.map(i => {
                    if (typeof i === 'string') return i;
                    if (i?.title) return i.title;
                    if (i?.name) return i.name;
                    return 'Sorpresa';
                }).join(', ')}.`,
                city: city || 'Roma',
                duration_minutes: 180,
                price_eur: 0,
                rating: 5.0,
                image: cover, // cover esplicito → vince sul calcolo del normalizer
                isAiGenerated: true,
                tags: ['Sorpresa', selectedFilter || 'Mix'],
                routePath: routeWKT,
                waypoints: surpriseTour.stops.map(s => [parseFloat(s.latitude), parseFloat(s.longitude)]),
                // Passo gli stops grezzi: il normalizer estrae title/description/transition/...
                // e mappa googlePhoto → image, lat/lng/latitude/longitude entrambi.
                stops: surpriseTour.stops,
            }, {
                cityFallback: city || 'Roma',
                // DVAI-055-b: doppio filtro innocuo — generateItinerary ha già filtrato con
                // cityCenter, il normalizer riapplica per uniformità con gli altri path.
                cityCenter: Number.isFinite(lat) && Number.isFinite(lng)
                    ? { latitude: lat, longitude: lng }
                    : null,
            });

            // 4. Save to Result Card
            console.log('[DVAI-061] shuffleExperience: generation success →', mappedTour.id);
            setGeneratedTour(mappedTour);

        } catch (error) {
            console.error('[DVAI-061] shuffleExperience: generation failed', error);
            if (error?.code === 'QUOTA_EXCEEDED') {
                // DVAI-050 / DVAI-056: cap anti-abuso — toast in-app (no window.alert).
                // DVAI-061 B: SEMPRE flash pulsante come backup se preflight ha sbagliato
                // (RLS, race con altre schede, whatever). L'utente vede il feedback
                // dove ha cliccato, sempre.
                triggerQuotaFlash();
                setGenerationError({
                    title: 'Hai esplorato tanto oggi',
                    description: 'Le tue esperienze di oggi sono esaurite. Domani ne troverai di nuove, cucite su di te.'
                });
            } else {
                // DVAI-051: NON cadere più su mock numerico. Toast in-app coerente.
                setGenerationError({
                    title: "L'AI sta avendo un momento difficile",
                    description: 'Non è stato possibile generare l\'itinerario a sorpresa. Riprova tra qualche secondo.'
                });
            }
            setIsShuffling(false);
        } finally {
            setIsShuffling(false);
        }
    };

    const handleFilterClick = (typeId) => {
        setSelectedFilter(filterMap[typeId]);
        // Gate Z.3: traccia scelta esplicita (anche "Sorpresa Totale" id=4 conta).
        setSelectedSurpriseType(typeId);
    };

    // ─────────────────────────────────────────────────────────────
    // STATO 1: CARICAMENTO / GENERAZIONE IN CORSO
    // ─────────────────────────────────────────────────────────────
    if (isShuffling) {
        return (
            <div className="min-h-screen bg-obsidian-bg font-quicksand text-obsidian-primary flex flex-col justify-between">
                <TopBar />
                <main className="max-w-md mx-auto px-4 py-16 flex-1 flex flex-col items-center justify-center text-center">
                    <div className="relative mb-6">
                        <div className="w-20 h-20 rounded-3xl bg-obsidian-card border border-obsidian-border flex items-center justify-center text-brand-orange shadow-xl relative z-10">
                            <Sparkles className="w-10 h-10 animate-spin" style={{ animationDuration: '3s' }} />
                        </div>
                        <div className="absolute -inset-2 rounded-[28px] bg-brand-orange/20 animate-ping opacity-40" />
                    </div>

                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-obsidian-raised border border-obsidian-border text-brand-orange text-xs font-semibold mb-3">
                        <Sparkles size={12} />
                        <span>Generazione Esperienza Unica</span>
                    </div>

                    <h2 className="text-xl font-bold text-obsidian-primary mb-2">
                        Sto cucendo la tua sorpresa...
                    </h2>
                    <p className="text-xs text-obsidian-secondary max-w-xs leading-relaxed font-medium mb-8">
                        L'intelligenza sta analizzando i luoghi autentici di {city || 'Roma'} per creare un itinerario unico
                    </p>

                    <div className="w-full max-w-xs space-y-3">
                        <div className="h-14 bg-obsidian-card border border-obsidian-border rounded-2xl animate-pulse" />
                        <div className="h-14 bg-obsidian-card border border-obsidian-border rounded-2xl animate-pulse delay-100" />
                        <div className="h-14 bg-obsidian-card border border-obsidian-border rounded-2xl animate-pulse delay-200" />
                    </div>
                </main>
                <BottomNavigation />
            </div>
        );
    }

    // ─────────────────────────────────────────────────────────────
    // STATO 2: ERRORE DI GENERAZIONE
    // ─────────────────────────────────────────────────────────────
    if (generationError) {
        return (
            <div className="min-h-screen bg-obsidian-bg font-quicksand text-obsidian-primary flex flex-col justify-between">
                <TopBar />
                <main className="max-w-md mx-auto px-4 py-16 flex-1 flex flex-col items-center justify-center text-center">
                    <div className="w-16 h-16 rounded-2xl bg-obsidian-raised border border-obsidian-border flex items-center justify-center text-obsidian-secondary mb-4 shadow-sm">
                        <AlertCircle className="w-8 h-8 text-obsidian-secondary" />
                    </div>
                    <h2 className="text-xl font-bold text-obsidian-primary mb-2">
                        {generationError.title}
                    </h2>
                    <p className="text-xs text-obsidian-secondary max-w-xs leading-relaxed font-medium mb-8">
                        {generationError.description}
                    </p>
                    <div className="w-full max-w-xs space-y-3">
                        <button
                            onClick={() => { setGenerationError(null); shuffleExperience(); }}
                            className="w-full bg-brand-orange hover:bg-brand-orange-hover text-obsidian-bg font-bold py-3.5 rounded-xl transition-colors cursor-pointer text-sm shadow-md shadow-brand-orange/20"
                        >
                            Riprova
                        </button>
                        <button
                            onClick={() => { setGenerationError(null); }}
                            className="w-full bg-obsidian-card hover:bg-obsidian-raised text-obsidian-secondary hover:text-obsidian-primary font-bold py-3 rounded-xl transition-colors cursor-pointer text-xs border border-obsidian-border"
                        >
                            Cambia categoria
                        </button>
                    </div>
                </main>
                <BottomNavigation />
            </div>
        );
    }

    // ─────────────────────────────────────────────────────────────
    // STATO 3: SCHEDA RISULTATO (LINGUAGGIO RIEPILOGO QUICKPATH)
    // ─────────────────────────────────────────────────────────────
    if (generatedTour) {
        const mappedTour = generatedTour;
        const mainImage = mappedTour.imageUrl || mappedTour.image || null;
        const moodPalette = getCoverPalette(selectedFilter?.toLowerCase() || 'sorpresa', null);
        const durationLabel = formatMinutes(mappedTour.duration_minutes);

        return (
            <div className="min-h-screen bg-obsidian-bg font-quicksand text-obsidian-primary flex flex-col justify-between">
                <TopBar />

                <main className="max-w-md mx-auto px-4 py-6 pb-24 w-full">
                    {/* Header bar con indietro */}
                    <div className="mb-4 flex items-center justify-between">
                        <button
                            onClick={() => setGeneratedTour(null)}
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-obsidian-card border border-obsidian-border text-obsidian-secondary hover:text-obsidian-primary transition-colors text-xs font-bold cursor-pointer"
                        >
                            <ArrowLeft size={14} /> Altra sorpresa
                        </button>
                        <span className="text-[11px] font-bold text-brand-orange uppercase tracking-wider">Esperienza Creata</span>
                    </div>

                    {/* Scheda Risultato */}
                    <div className="bg-obsidian-card border border-obsidian-border rounded-[28px] shadow-2xl overflow-hidden">
                        {/* Visual Header / Copertina */}
                        <div
                            className="relative h-48 w-full overflow-hidden"
                            style={{
                                background: mainImage ? '#161311' : moodPalette.gradient,
                            }}
                        >
                            {mainImage && (
                                <img
                                    src={mainImage}
                                    alt={mappedTour.title}
                                    className="absolute inset-0 w-full h-full object-cover"
                                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                />
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-obsidian-card via-obsidian-card/40 to-transparent" />
                            
                            <div className="absolute bottom-4 left-5 right-5 text-obsidian-primary">
                                <p className="text-xs font-bold text-brand-orange uppercase tracking-widest mb-1 flex items-center gap-1.5">
                                    <MapPin size={13} /> {mappedTour.city}
                                </p>
                                <h2 className="text-2xl font-black tracking-tight leading-tight text-obsidian-primary drop-shadow-sm">
                                    {mappedTour.title}
                                </h2>
                            </div>
                        </div>

                        <div className="px-5 py-5 space-y-5">
                            {/* Badge Itinerario AI */}
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-obsidian-raised border border-obsidian-border text-obsidian-secondary text-xs font-semibold w-max shadow-sm">
                                <Sparkles size={13} className="text-brand-orange" />
                                <span>Itinerario cucito dall'AI</span>
                            </div>

                            {/* Il tuo DNA Esplorativo */}
                            <div className="bg-obsidian-raised rounded-2xl p-4 border border-obsidian-border relative overflow-hidden">
                                <h3 className="text-xs font-bold text-obsidian-secondary uppercase tracking-wider mb-3">
                                    Il tuo DNA Esplorativo
                                </h3>
                                
                                <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-sm">
                                    <div className="flex flex-col">
                                        <span className="text-obsidian-secondary text-xs">Categoria</span>
                                        <span className="font-bold text-obsidian-primary">{selectedFilter || 'Sorpresa Totale'}</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-obsidian-secondary text-xs">Ritmo</span>
                                        <span className="font-bold text-obsidian-primary">Mezza Giornata</span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                        <Clock size={15} className="text-brand-orange" />
                                        <span className="font-bold text-obsidian-primary">{durationLabel || '3h'}</span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                        <Users size={15} className="text-brand-orange" />
                                        <span className="font-bold text-obsidian-primary">Esperienza Unica</span>
                                    </div>
                                </div>
                            </div>

                            {/* Statistiche */}
                            <div className="flex items-center justify-around px-2">
                                <div className="text-center">
                                    <p className="text-3xl font-black text-obsidian-primary">{mappedTour.stops?.length || 0}</p>
                                    <p className="text-xs text-obsidian-secondary font-bold uppercase tracking-widest mt-0.5">Tappe</p>
                                </div>
                                {durationLabel && (
                                    <>
                                        <div className="w-px h-10 bg-obsidian-border" />
                                        <div className="text-center">
                                            <p className="text-3xl font-black text-obsidian-primary">{durationLabel}</p>
                                            <p className="text-xs text-obsidian-secondary font-bold uppercase tracking-widest mt-0.5">Durata</p>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Tappe Generate (Linguaggio QuickPath) */}
                            {Array.isArray(mappedTour.stops) && mappedTour.stops.length > 0 && (
                                <div className="mt-4 bg-obsidian-raised/60 rounded-2xl p-3.5 border border-obsidian-border">
                                    <h4 className="text-[10px] font-bold text-obsidian-secondary uppercase tracking-widest mb-2 px-1">Itinerario Generato</h4>
                                    <div
                                        className="space-y-3 max-h-[240px] overflow-y-auto pr-2 pt-2.5 pb-1 scrollbar-thin scrollbar-thumb-obsidian-border"
                                        style={{
                                            maskImage: 'linear-gradient(to bottom, transparent 0%, black 26px, black 100%)',
                                            WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 26px, black 100%)',
                                        }}
                                    >
                                        {mappedTour.stops.map((step, idx) => (
                                            <div key={idx} className="flex items-start gap-3 bg-obsidian-card p-3 rounded-xl border border-obsidian-border shadow-sm relative overflow-hidden group">
                                                {idx !== mappedTour.stops.length - 1 && (
                                                    <div className="absolute left-[1.35rem] top-8 bottom-[-12px] w-0.5 bg-obsidian-border z-0" />
                                                )}
                                                <div className="w-6 h-6 rounded-full bg-brand-orange text-obsidian-bg flex items-center justify-center text-[11px] font-bold shrink-0 relative z-10 shadow-sm mt-0.5">
                                                    {idx + 1}
                                                </div>
                                                <div className="flex-1 min-w-0 relative z-10">
                                                    <p className="text-sm font-bold text-obsidian-primary leading-tight">{step.name || step.title || `Tappa ${idx+1}`}</p>
                                                    <p className="text-xs text-obsidian-secondary mt-1 leading-relaxed font-medium">{step.description || step.category || 'Esplorazione consigliata'}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* CTAs — Una sola CTA arancione */}
                            <div className="pt-2 flex flex-col gap-3">
                                <button
                                    onClick={() => navigate(`/tour-details/${mappedTour.id}`, { state: { tourData: mappedTour, isAiGenerated: true } })}
                                    className="w-full bg-brand-orange hover:bg-brand-orange-hover text-obsidian-bg py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-brand-orange/20 transition-colors text-sm cursor-pointer"
                                >
                                    <ArrowRight size={18} />
                                    Vedi Dettagli Tour
                                </button>
                                <button
                                    onClick={() => setGeneratedTour(null)}
                                    className="w-full bg-obsidian-raised hover:bg-obsidian-border text-obsidian-secondary hover:text-obsidian-primary py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors text-xs cursor-pointer border border-obsidian-border"
                                >
                                    Genera un'altra sorpresa
                                </button>
                            </div>
                        </div>
                    </div>
                </main>

                <BottomNavigation />
            </div>
        );
    }

    // ─────────────────────────────────────────────────────────────
    // STATO 4: SCHERMATA DI AVVIO / SELEZIONE
    // ─────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-obsidian-bg font-quicksand text-obsidian-primary flex flex-col justify-between">
            <TopBar />

            <main className="max-w-md mx-auto px-4 py-6 pb-24 w-full">
                {/* Back to Home Button */}
                <div className="mb-4">
                    <Link
                        to="/dashboard-user"
                        className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-obsidian-card border border-obsidian-border text-obsidian-secondary hover:text-obsidian-primary transition-colors text-xs font-bold"
                    >
                        <ArrowLeft size={14} />
                        <span>Home</span>
                    </Link>
                </div>

                {/* Header */}
                <div className="text-center mb-6">
                    <div className="w-16 h-16 rounded-2xl bg-obsidian-card border border-obsidian-border flex items-center justify-center text-brand-orange mx-auto mb-3 shadow-md">
                        <Gift className="w-8 h-8 text-brand-orange" />
                    </div>
                    <h1 className="text-2xl font-bold text-obsidian-primary mb-1">Tour Sorpresa</h1>
                    <p className="text-obsidian-secondary text-sm font-medium">Scegli una categoria, poi genera la tua esperienza</p>
                </div>

                {/* Scegli la tua categoria */}
                <div className="mb-6">
                    <h2 className="text-sm font-bold text-obsidian-secondary uppercase tracking-wider mb-3">Scegli la tua categoria</h2>
                    <div className="grid grid-cols-2 gap-3">
                        {surpriseTypes.map((type) => {
                            const isActive = type.id === selectedSurpriseType;
                            return (
                                <div
                                    key={type.id}
                                    onClick={() => handleFilterClick(type.id)}
                                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col items-center text-center ${
                                        isActive
                                            ? 'bg-obsidian-raised border-brand-orange ring-1 ring-brand-orange/40 shadow-sm'
                                            : 'bg-obsidian-card border-obsidian-border hover:bg-obsidian-raised/60 hover:border-obsidian-raised'
                                    }`}
                                >
                                    <div className={`text-2xl mb-2.5 p-3 rounded-xl border flex items-center justify-center ${
                                        isActive
                                            ? 'bg-brand-orange/10 border-brand-orange/30 text-brand-orange'
                                            : 'bg-obsidian-raised border-obsidian-border text-obsidian-secondary'
                                    }`}>
                                        <span className="text-2xl">{type.emoji}</span>
                                    </div>
                                    <h4 className={`font-bold text-sm leading-tight ${isActive ? 'text-obsidian-primary' : 'text-obsidian-secondary'}`}>
                                        {type.title}
                                    </h4>
                                    {isActive && (
                                        <div className="mt-2 w-1.5 h-1.5 bg-brand-orange rounded-full" />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Bottone Genera */}
                <div className="mb-8">
                    <button
                        onClick={() => shuffleExperience()}
                        disabled={isShuffling || quotaExhaustedFlash || selectedSurpriseType === null}
                        className={`w-full py-4 px-6 rounded-2xl font-bold transition-colors flex items-center justify-center gap-2 shadow-lg ${
                            selectedSurpriseType === null
                                ? 'bg-obsidian-raised text-obsidian-secondary/50 border border-obsidian-border cursor-not-allowed'
                                : quotaExhaustedFlash
                                    ? 'bg-obsidian-card border border-brand-orange/40 text-brand-orange'
                                    : 'bg-brand-orange hover:bg-brand-orange-hover text-obsidian-bg shadow-brand-orange/20 cursor-pointer'
                        }`}
                    >
                        <Sparkles className="w-5 h-5" />
                        <span className="text-base">
                            {selectedSurpriseType === null
                                ? 'Scegli una categoria'
                                : quotaExhaustedFlash
                                    ? 'Domani nuove esperienze 🌅'
                                    : (selectedFilter ? `Genera esperienza ${selectedFilter}` : 'Sorprendimi')}
                        </span>
                    </button>
                </div>
            </main>

            <BottomNavigation />
        </div>
    );
}
