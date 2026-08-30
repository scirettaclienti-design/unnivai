import { motion, AnimatePresence } from "framer-motion";
import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { aiRecommendationService } from "@/services/aiRecommendationService";
import { normalizeTour } from "@/services/tourShape";
// Gate 2 FASE 3 — servizi centrali del motore reale.
// resolveCityCenter: unica sorgente autoritativa del centro città (mai GPS).
// getCoverPalette: fallback illustrato per categoria (categoryPalette DVAI-058),
// usato al posto degli Unsplash generici per il rendering delle box wizard.
import { resolveCityCenter, CityCenterUnresolvedError } from "@/services/cityCenterService";
import { getCoverPalette } from "@/lib/categoryPalette";
// Gate 2 FASE 3 — businesses partner: SOSPESI in QuickPath (V3, non V1).
// Il DB non ha partner reali oggi; il codice attivo rischierebbe di rompere le
// tappe vere con splice. La chiamata è commentata più sotto con TODO(V3).
// import { dataService } from "@/services/dataService";
import { ArrowLeft, ArrowRight, Building2, Trees, Waves, Mountain, Landmark, UtensilsCrossed, Sparkles, Bath, Compass, Sunrise, Sun, Sunset, Zap, Clock, Target, User, Heart, Users, UserCheck, CheckCircle2, RotateCcw, Home, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import TopBar from "@/components/TopBar";
import BottomNavigation from "@/components/BottomNavigation";
import { QuickPathSummary } from "@/components/Map/QuickPathSummary";
import { useUserContext } from "@/hooks/useUserContext";
import { useAILearning } from "@/hooks/useAILearning";
import { DEMO_CITIES } from "@/data/demoData";
// Gate E-2: import PaywallModal rimosso. Il paywall gate è morto (modello di
// lancio locked: nessun paywall V1). Il componente resta nel repo per V2/V3.

// ─── Loading Sub-Steps animati ─────────────────────────────────────────────
// Gate B — Microcopy loading a 3 fasi (approvato Ivano). Narra l'attesa
// con quello che il motore FA davvero (soglia rating 4.2 + review), non con
// promesse marketing tipo "scarto quelli per turisti" (bugia: non c'è filtro).
const LOADING_STEPS = [
    { icon: Compass, textFn: (city) => `Cerco i posti veri di ${city}...` },
    { icon: Sparkles, textFn: () => 'Controllo cosa dicono quelli che ci sono stati...' },
    { icon: CheckCircle2, textFn: () => 'Ci siamo quasi.' },
];

const LoadingSubSteps = ({ city }) => {
    const [step, setStep] = useState(0);
    useEffect(() => {
        // Gate B — Il safety timeout QuickPath è 35s. Tre stringhe che cambiano ogni
        // ~4s: fase 1 (~0-4s), fase 2 (~4-8s), fase 3 (~8-35s) — l'ultima fa da
        // "ci siamo quasi" per i tour realmente lenti (10-15s tipici + margine).
        const interval = setInterval(() => {
            setStep(prev => (prev < LOADING_STEPS.length - 1 ? prev + 1 : prev));
        }, 4000);
        return () => clearInterval(interval);
    }, []);

    const CurrentIcon = LOADING_STEPS[Math.min(step, LOADING_STEPS.length - 1)].icon;

    return (
        <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="relative w-24 h-24 mb-8">
                <motion.div
                    className="absolute inset-0 border-4 border-obsidian-border border-t-brand-orange rounded-full"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                    <motion.div
                        key={step}
                        initial={{ scale: 0.6, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="text-brand-orange"
                    >
                        <CurrentIcon className="w-8 h-8 stroke-[1.75]" />
                    </motion.div>
                </div>
            </div>
            <h2 className="text-xl font-bold text-obsidian-primary mb-2">Il tuo tour a {city}</h2>
            <AnimatePresence mode="wait">
                <motion.p
                    key={step}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.25 }}
                    className="text-obsidian-secondary text-sm font-medium"
                >
                    {LOADING_STEPS[Math.min(step, LOADING_STEPS.length - 1)].textFn(city)}
                </motion.p>
            </AnimatePresence>
            {/* Progress dots */}
            <div className="flex gap-2 mt-6">
                {LOADING_STEPS.map((_, i) => (
                    <motion.div
                        key={i}
                        className="w-2 h-2 rounded-full"
                        animate={{
                            backgroundColor: i <= step ? '#E8833A' : '#26211E',
                            scale: i === step ? 1.3 : 1,
                        }}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                ))}
            </div>
        </div>
    );
};

// Gate 2 FASE 1 — RIMOSSI: GENERIC_ITALY_IMAGE, ROMA_IMAGE, getCityFallbackImage,
// FALLBACK_CARD_IMAGE. Il motore fake basato su Unsplash generici è morto.
// QuickPath userà TourCover (DVAI-058) come tutto il resto dell'app in FASE 3.

// ─── Gate 2 FASE 3 + Gate C Task 1 — buildPromptFromSelections ──────────────
// Traduce le 5 selezioni del wizard in un BRIEF OPERATIVO per il traduttore
// Gate B (translateIntentToQueries), non in prosa turistica. La differenza è
// visibile: "Voglio scoprire Siracusa attraverso luoghi tranquilli, giardini e
// caffè letterari" (vecchio) → il traduttore capisce "attrazioni vaghe" e pesca
// il Duomo. "A Siracusa cerco: spa, hammam, terme, centri benessere. Escludi:
// cattedrali, musei" (nuovo) → queries concrete + escludi espliciti. Sub-key
// mappati (relax.benessere→spa/hammam/terme). EXCLUDE_HINTS_BY_MAIN come rinforzo.

const DOMINANT_CATEGORIES = {
    citta: {
        _default:     'centro storico, piazze principali e monumenti',
        centro:       'centro storico, monumenti principali e piazze',
        rione:        'quartieri caratteristici, vicoli storici e vita di quartiere',
        piazze:       'piazze storiche, fontane e palazzi',
        shopping:     'vie dello shopping, botteghe e vetrine storiche',
        duomo:        'cattedrale, palazzi storici del centro e monumenti principali',
        grattacieli:  'architettura moderna, quartieri contemporanei e skyline',
        spaccanapoli: 'vicoli storici, chiese di quartiere e vita popolare',
        quartieri:    'quartieri autentici, murales e vita di strada',
    },
    natura: {
        _default:  'parchi, giardini e aree verdi',
        parco:     'parchi, giardini e aree verdi',
        villa:     'ville storiche e giardini nobiliari',
        tevere:    'lungofiume, ponti panoramici e passeggiate sull\'acqua',
        sempione:  'parchi urbani e giardini storici',
    },
    parchi: {
        _default:  'parchi, giardini e aree verdi',
        sempione:  'parchi urbani, giardini storici e arco monumentale',
    },
    mare: {
        _default:  'lungomare, spiagge cittadine e panorami sul mare',
        lungomare: 'lungomare, spiagge cittadine e panorami sul mare',
        posillipo: 'panorami sul mare, belvedere e paesaggi costieri',
    },
    montagna: {
        _default: 'sentieri di montagna, rifugi e panorami alpini',
    },
    storia: {
        _default:  'musei, siti archeologici e luoghi storici',
        musei:     'musei, siti archeologici e luoghi storici',
        imperiale: 'siti archeologici, monumenti antichi e rovine imperiali',
        barocco:   'palazzi barocchi, chiese e architettura del XVII secolo',
        vesuvio:   'siti vulcanici, panorami sul vulcano e osservatori naturali',
    },
    vulcano: {
        _default: 'siti vulcanici, panorami sul vulcano e osservatori naturali',
    },
    arte: {
        _default: 'musei d\'arte, gallerie e chiese affrescate',
    },
    cibo: {
        _default:  'trattorie tipiche, osterie e cucina tradizionale',
        street:    'street food, mercati e cucina di strada',
        carbonara: 'trattorie tipiche, cucina tradizionale e osterie storiche',
        pizza:     'pizzerie storiche, forni artigianali e locali della tradizione',
        dolci:     'pasticcerie storiche, dolciumi tradizionali e caffè letterari',
    },
    moda: {
        _default:     'vie dello shopping, boutique e vetrine di lusso',
        quadrilatero: 'vie dello shopping di lusso e boutique di alta moda',
        vintage:      'negozi vintage, design d\'autore e concept store',
    },
    canali: {
        _default: 'canali, lungocanale e locali sull\'acqua',
        navigli:  'canali storici, ponti e locali dei Navigli',
    },
    relax: {
        _default:  'spa, giardini panoramici, spiagge tranquille',
        spa:       'spa, hammam, terme, centri benessere',
        benessere: 'spa, hammam, terme, centri benessere',
        terme:     'terme, stabilimenti termali, spa',
        giardino:  'giardini panoramici, parchi tranquilli, ville storiche',
    },
};

// Gate C Task 1 — clausola di esclusione per macro-categoria. Rinforza il
// prompt del traduttore rendendo esplicito cosa NON è la richiesta, così
// vincoli.escludi arriva popolato al selettore-narratore e la textsearch
// non pesca fuori-tema. Es. per "relax", "cattedrali" e "musei" non ci vanno.
const EXCLUDE_HINTS_BY_MAIN = {
    relax:    'cattedrali, musei, monumenti turistici',
    natura:   'chiese, musei, monumenti storici',
    mare:     'chiese, musei, monumenti storici',
    montagna: 'chiese, musei, monumenti storici',
    parchi:   'chiese, musei, monumenti storici',
    canali:   'musei, chiese',
    cibo:     'musei, chiese, monumenti turistici',
    moda:     'chiese, musei, monumenti storici',
    vulcano:  'chiese, musei del centro',
    // Categorie storiche/urbane: nessuna esclusione hardcoded (il dominant
    // già seleziona bene). "arte", "storia", "citta" non compaiono qui.
};

const TIME_LABEL = {
    mattina:    'Al mattino',
    pomeriggio: 'Nel pomeriggio',
    sera:       'In serata',
};

const STOP_COUNT = {
    veloce: 'Esattamente 2 tappe.',
    medio:  'Esattamente 3-4 tappe.',
    lungo:  'Esattamente 5-6 tappe.',
};

const GROUP_LABEL = {
    solo:     'da esplorare in solitudine',
    coppia:   'per una coppia',
    amici:    'in compagnia di amici',
    famiglia: 'in famiglia',
};

const EXCLUSION_CLAUSE = 'Solo tappe di questa categoria: non aggiungere ristoranti, bar o caffè se non li ho chiesti esplicitamente.';
const FOOD_MAIN_KEYS = new Set(['cibo']);

export function buildPromptFromSelections({ main, sub, time, duration, group, city }) {
    const mainKey  = String(main  || '').toLowerCase().trim();
    const subKey   = String(sub   || '').toLowerCase().trim();
    const timeKey  = String(time  || '').toLowerCase().trim();
    const durKey   = String(duration || '').toLowerCase().trim();
    const groupKey = String(group || '').toLowerCase().trim();
    const cityName = String(city  || '').trim();

    const bucket   = DOMINANT_CATEGORIES[mainKey];
    const dominant = (bucket && (bucket[subKey] || bucket._default))
        || 'monumenti principali, piazze e vita locale';

    const timeLabel  = TIME_LABEL[timeKey]  || '';
    const groupLabel = GROUP_LABEL[groupKey] || '';
    const stopCount  = STOP_COUNT[durKey]   || '';
    const isFoodMain = FOOD_MAIN_KEYS.has(mainKey);
    const excludeHint = EXCLUDE_HINTS_BY_MAIN[mainKey] || '';

    // Gate C Task 1 — Brief operativo, non prosa. Prima frase: cosa cercare
    // (query concrete). Seconda: cosa escludere (rinforza vincoli.escludi).
    // Terza: contesto (tempo, gruppo, numero tappe).
    const sentence1 = cityName ? `A ${cityName} cerco: ${dominant}.` : `Cerco: ${dominant}.`;
    const sentence2 = excludeHint ? `Escludi: ${excludeHint}.` : '';
    const contextParts = [timeLabel, groupLabel].filter(Boolean);
    const sentence3 = contextParts.length > 0 ? contextParts.join(', ') + '.' : '';
    const sentence4 = stopCount;
    // EXCLUSION_CLAUSE (no food se non richiesto) va SOLO quando la categoria
    // non è già coperta da EXCLUDE_HINTS_BY_MAIN. Se il main è "citta"/"storia"/
    // "arte" (nessun exclude hint), la clausola food generica compare come prima.
    const sentence5 = (!isFoodMain && !excludeHint) ? EXCLUSION_CLAUSE : '';

    return [sentence1, sentence2, sentence3, sentence4, sentence5].filter(Boolean).join(' ');
}

// Gate VERITÀ VISIVA (F26) DIFF 5 — rimossa la proprieta' `image` (26 URL
// Unsplash) dalle opzioni del quiz. Non erano copertine di tour, ma foto
// patinate che illustravano una categoria: dopo il DIFF 4 ogni copertina e' un
// gradient, e tenerle avrebbe prodotto un downgrade visivo proprio nel momento
// della scelta. Una era falsa anche con la lettura piu' permissiva: il Colosseo
// su "Parchi e Verde".
// Nessun ridisegno: il render gia' prevedeva il caso senza immagine
// (:864-882) — gradient di categoria da getCoverPalette + emoji dell'opzione.
// 🌍 ADAPTIVE DATA ENGINE
const CITY_CONFIG = {
    'Roma': {
        main: ['citta', 'natura', 'storia', 'cibo'],
        sub: {
            citta: [
                { id: 'rione', title: 'Rioni Storici', description: 'Perditi tra i vicoli di Trastevere o Monti', emoji: '🛵' },
                { id: 'piazze', title: 'Piazze Eterne', description: 'La dolce vita tra Piazza Navona e Spagna', emoji: '⛲' },
                { id: 'shopping', title: 'Via del Corso', description: 'Shopping tra vetrine e palazzi storici', emoji: '🛍️' }
            ],
            natura: [
                { id: 'villa', title: 'Ville Nobiliari', description: 'Relax a Villa Borghese o Doria Pamphilj', emoji: '🌳' },
                { id: 'tevere', title: 'Lungo il Tevere', description: 'Passeggiata ciclabile sulle sponde del fiume', emoji: '🚴' }
            ],
            storia: [
                { id: 'imperiale', title: 'Roma Imperiale', description: 'Colosseo e Fori Imperiali al tramonto', emoji: '⚔️' },
                { id: 'barocco', title: 'Roma Barocca', description: 'Bernini, Borromini e le cupole', emoji: '⛪' }
            ],
            cibo: [
                { id: 'street', title: 'Street Food', description: 'Supplì, Pizza al taglio e Maritozzo', emoji: '🍕' },
                { id: 'carbonara', title: 'Carbonara Tour', description: 'Alla ricerca della pasta perfetta', emoji: '🍝' }
            ]
        }
    },
    'Milano': {
        main: ['citta', 'moda', 'parchi', 'canali'],
        sub: {
            citta: [
                { id: 'duomo', title: 'Zona Duomo', description: 'Il cuore pulsante tra madonnina e galleria', emoji: '⛪' },
                { id: 'grattacieli', title: 'Skyline Gae Aulenti', description: 'La Milano moderna del Bosco Verticale', emoji: '🏙️' }
            ],
            moda: [
                { id: 'quadrilatero', title: 'Quadrilatero', description: 'Fashion district e vetrine di lusso', emoji: '👠' },
                { id: 'vintage', title: 'Vintage Brera', description: 'Botteghe storiche e design', emoji: '🕶️' }
            ],
            parchi: [
                { id: 'sempione', title: 'Parco Sempione', description: 'Relax vista Castello Sforzesco', emoji: '🏰' }
            ],
            canali: [
                { id: 'navigli', title: 'I Navigli', description: 'Aperitivo e passeggiata sui canali', emoji: '🥂' }
            ]
        }
    },
    'Napoli': {
        main: ['mare', 'citta', 'vulcano', 'cibo'],
        sub: {
            mare: [
                { id: 'lungomare', title: 'Lungomare', description: 'Castel dell\'Ovo e vista Capri', emoji: '🌊' },
                { id: 'posillipo', title: 'Posillipo', description: 'Panorami mozzafiato dall\'alto', emoji: '📸' }
            ],
            citta: [
                { id: 'spaccanapoli', title: 'Spaccanapoli', description: 'Il cuore verace e i presepi', emoji: '🌶️' },
                { id: 'quartieri', title: 'Quartieri Spagnoli', description: 'Murales, vicoli e vitalità', emoji: '🎭' }
            ],
            vulcano: [
                { id: 'vesuvio', title: 'Vesuvio View', description: 'Punti panoramici sul vulcano', emoji: '🌋' }
            ],
            cibo: [
                { id: 'pizza', title: 'Vera Pizza', description: 'Le pizzerie storiche', emoji: '🍕' },
                { id: 'dolci', title: 'Sfogliatella', description: 'Pasticceria napoletana', emoji: '🧁' }
            ]
        }
    },
    // Default Fallback
    'default': {
        main: ['citta', 'natura', 'storia', 'relax'],
        sub: {
            citta: [{ id: 'centro', title: 'Centro Storico', description: 'Monumenti e piazze principali', emoji: '🏰' }],
            natura: [{ id: 'parco', title: 'Parchi e Verde', description: 'Aree verdi e relax', emoji: '🌳' }],
            storia: [{ id: 'musei', title: 'Cultura e Musei', description: 'Arte e storia locale', emoji: '🏛️' }],
            relax: [{ id: 'spa', title: 'Benessere', description: 'Terme e relax', emoji: '🧖' }]
        }
    }
};

// HELPER: Component-ready options generator
const getAdaptiveOptions = (city) => {
    const config = CITY_CONFIG[city] || CITY_CONFIG['default'];

    // Map main keys to full option objects with linear icons
    const mainOptions = config.main.map(key => {
        switch (key) {
            case 'citta': return { id: 'citta', title: 'Città', icon: Building2, emoji: '🏙️' };
            case 'natura': return { id: 'natura', title: 'Natura', icon: Trees, emoji: '🌿' };
            case 'mare': return { id: 'mare', title: 'Mare', icon: Waves, emoji: '🌊' };
            case 'montagna': return { id: 'montagna', title: 'Montagna', icon: Mountain, emoji: '⛰️' };
            case 'storia': return { id: 'storia', title: 'Storia', icon: Landmark, emoji: '🏛️' };
            case 'cibo': return { id: 'cibo', title: 'Gusto', icon: UtensilsCrossed, emoji: '🍝' };
            case 'moda': return { id: 'moda', title: 'Fashion', icon: Sparkles, emoji: '👠' };
            case 'parchi': return { id: 'parchi', title: 'Parchi', icon: Trees, emoji: '🌳' };
            case 'canali': return { id: 'canali', title: 'Navigli', icon: Waves, emoji: '🛶' };
            case 'vulcano': return { id: 'vulcano', title: 'Vulcano', icon: Mountain, emoji: '🌋' };
            case 'relax': return { id: 'relax', title: 'Relax', icon: Bath, emoji: '🧖' };
            default: return { id: key, title: key, icon: Sparkles, emoji: '✨' };
        }
    });

    // Gate J2 — Nessuna Unsplash nel wizard. Tutti gli `image` dei sub sono
    // FORZATI a null qui, ignorando ciò che sta scritto nel CITY_CONFIG. Il JSX
    // sotto renderizza il gradient categoryPalette (getCoverPalette) come cover
    // deterministica per ogni sub. I 26 Unsplash hardcoded in CITY_CONFIG.sub
    // sono ora inerti (potranno essere rimossi in un cleanup successivo).
    const subWithImages = {};
    Object.keys(config.sub).forEach(key => {
        subWithImages[key] = (config.sub[key] || []).map(item => ({
            ...item,
            image: null,
        }));
    });
    return {
        mainOptions,
        subOptions: subWithImages
    };
};

// Step 3: Time preferences
const timeOptions = [
    {
        id: 'mattina',
        title: 'Mattina',
        icon: Sunrise,
        time: '08:00 - 12:00',
        description: 'Perfetto per iniziare la giornata con energia',
    },
    {
        id: 'pomeriggio',
        title: 'Pomeriggio',
        icon: Sun,
        time: '14:00 - 18:00',
        description: 'Ideale per esplorare con calma',
    },
    {
        id: 'sera',
        title: 'Sera',
        icon: Sunset,
        time: '18:00 - 22:00',
        description: 'Magico per atmosfere suggestive',
    }
];

// Step 4: Duration preferences
const durationOptions = [
    {
        id: 'veloce',
        title: 'Veloce',
        icon: Zap,
        duration: '1-2 ore',
        description: 'Perfetto per una pausa veloce',
    },
    {
        id: 'medio',
        title: 'Medio',
        icon: Clock,
        duration: '2-4 ore',
        description: 'Tempo ideale per esplorare con calma',
    },
    {
        id: 'lungo',
        title: 'Lungo',
        icon: Target,
        duration: '4-6 ore',
        description: 'Immersione completa nell\'esperienza',
    }
];

// Step 5: Group size preferences
const groupOptions = [
    {
        id: 'solo',
        title: 'Solo',
        icon: User,
        size: '1 persona',
        description: 'Momento di tranquillità e riflessione',
    },
    {
        id: 'coppia',
        title: 'In coppia',
        icon: Heart,
        size: '2 persone',
        description: 'Esperienza per due',
    },
    {
        id: 'amici',
        title: 'Con gli amici',
        icon: Users,
        size: '3-6 persone',
        description: 'Divertimento e condivisione',
    },
    {
        id: 'famiglia',
        title: 'In famiglia',
        icon: UserCheck,
        size: '4-8 persone',
        description: 'Adatto a tutte le età',
    }
];

// ⚠️ FIXED ARCHITECTURE: PARENT-CONTROLLED GENERATION
export default function QuickPathPage() {
    const { city, lat, lng, weatherCondition, temperatureC } = useUserContext();
    const activeCityRaw = city || 'Roma';
    // ⚡ Normalize & Sanitize City
    let activeCity = activeCityRaw.charAt(0).toUpperCase() + activeCityRaw.slice(1).toLowerCase();

    // 🛡️ RECOVERY: If city is coordinates (e.g. "Lat: 41...") or invalid, default to Roma
    if (activeCity.includes('Lat') || activeCity.includes(':') || activeCity.length > 25) {
        console.warn("⚠️ Invalid City detected:", activeCity, "Defaulting to Roma");
        activeCity = 'Roma';
    }
    const navigate = useNavigate();

    // Gate 2 FASE 1 — RIMOSSO `quickRoute` (dipendeva da MOCK_ROUTES).
    // Non era usato altrove: dead code trovato durante la demolizione.

    // 🧠 ADAPTIVE OPTIONS
    const { mainOptions, subOptions } = getAdaptiveOptions(activeCity);

    const [currentStep, setCurrentStep] = useState(1);
    const [selectedOption, setSelectedOption] = useState(null);
    const [selectedSubOption, setSelectedSubOption] = useState(null);
    const [selectedTime, setSelectedTime] = useState(null);
    const [selectedDuration, setSelectedDuration] = useState(null);
    const [selectedGroup, setSelectedGroup] = useState(null);

    const { trackGeneratedTour } = useAILearning();
    // Gate E-2: hasHitPaywall + unlockPremium + showPaywall rimossi (paywall
    // morto). Prima: dopo 10 tour vita hasHitPaywall=true → click su gruppo
    // apriva showPaywall, ma <PaywallModal> non era MAI renderizzato nel JSX,
    // e l'utente restava fermo silenzioso. Bug preesistente, non causato da
    // Gate D — Gate E-2 lo ha ucciso alla radice.

    // GENERATION STATE (LIFTED UP)
    // Gate 2 FASE 3 + Gate D-6 — status esteso con reason per messaggi distinti.
    //   idle | loading | success | 'error-nothing' | 'error-technical' | 'error-quota'
    // "error-nothing"   → messaggio brand ("Non basta per un tour.")
    // "error-technical" → messaggio infra ("Non riesco a raggiungere i posti.")
    // "error-quota"     → cap 10/giorno onesto ("Hai esplorato tanto oggi.")
    //                     coerente con AiItinerary + SurpriseTour. Prima era
    //                     confuso con "technical" e mentiva sui "posti".
    const [generationStatus, setGenerationStatus] = useState('idle');
    const [generationError, setGenerationError] = useState(null);
    const [readyTourData, setReadyTourData] = useState(null);

    // 🧠 MEMOIZE CONTEXT TO PREVENT INFINITE LOOPS
    const weatherContext = useMemo(() => ({
        condition: weatherCondition,
        temperature: temperatureC
    }), [weatherCondition, temperatureC]);

    const handleMainSelection = (optionId) => {
        setSelectedOption(optionId);
        setCurrentStep(2);
    };

    const handleSubSelection = (subOption) => {
        setSelectedSubOption(subOption);
        setCurrentStep(3);
    };

    const handleTimeSelection = (timeOption) => {
        setSelectedTime(timeOption);
        setCurrentStep(4);
    };

    const handleDurationSelection = (durationOption) => {
        setSelectedDuration(durationOption);
        setCurrentStep(5);
    };

    const handleGroupSelection = (groupOption) => {
        setSelectedGroup(groupOption);
        // Gate E-2: rimosso il paywall gate silenzioso qui. Prima
        // hasHitPaywall (>=10 tour vita) faceva setShowPaywall(true)+return,
        // ma <PaywallModal> non era mai renderizzato → utente bloccato senza
        // spiegazione. Ora il wizard prosegue sempre. Il cap 10/giorno server
        // (checkAndIncrementQuota → error-quota) è l'unico limite in V1.
        setCurrentStep(6); // Move to loading step
        // TRIGGER GENERATION IMMEDIATELY ON FINAL SELECTION
        generateItinerary(groupOption);
    };

    // ─── Gate 2 FASE 3 — Motore reale + policy anti-fallback ────────────────
    // Regole locked (nessun fallback genera mai un tour):
    // - Safety timeout 20s → 'error-technical' (guardia, mai un tour).
    // - resolveCityCenter fail → 'error-technical'.
    // - Motore ritorna 0 tappe → 'error-nothing'.
    // - Quota esaurita → 'error-quota' (Gate D-6 — copy onesto dedicato).
    // - Qualsiasi altro throw → 'error-technical'.
    // Zero coordinate hardcoded. Zero Unsplash. Zero enforceRadius:false.
    const generateItinerary = async (group) => {
        // Gate H — selectedOption è la STRING id (settata via
        // handleMainSelection(option.id) al click sulla box). Gli altri 4
        // (sub/time/duration/group) sono OGGETTI (i loro onClick passano
        // l'oggetto intero). Prima il codice qui leggeva selectedOption?.id
        // che restituiva undefined → main=undefined → buildPromptFromSelections
        // cadeva sul dominant di default per ogni scelta → prompt sempre
        // identico → cache hit → stesso tour indipendentemente dalla scelta.
        console.log('[QuickPath] START generation:', {
            city: activeCity,
            main: selectedOption,
            sub: selectedSubOption?.id,
            time: selectedTime?.id,
            duration: selectedDuration?.id,
            group: group?.id,
        });
        setGenerationStatus('loading');
        setGenerationError(null);
        setReadyTourData(null);

        // Gate B — Safety timeout 35s (era 20s). Con Path A c'è una chiamata AI
        // extra (traduttore) prima del textsearch + selettore: latenza totale
        // può arrivare a 20-25s realistici (su 4G di un turista). 35s dà margine
        // senza far scattare un errore falso su un tour che sta per arrivare.
        let timedOut = false;
        const safetyTimeoutId = setTimeout(() => {
            timedOut = true;
            console.warn('[QuickPath] safety timeout 35s → error-technical');
            setGenerationError({ reason: 'technical', detail: 'timeout 35s' });
            setGenerationStatus('error-technical');
        }, 35000);

        try {
            // 1. Costruisci prompt dalle 5 selezioni (buildPromptFromSelections).
            // Gate H: selectedOption è STRING (vedi commento in generateItinerary).
            const prompt = buildPromptFromSelections({
                main:     selectedOption,
                sub:      selectedSubOption?.id,
                time:     selectedTime?.id,
                duration: selectedDuration?.id,
                group:    group?.id,
                city:     activeCity,
            });
            console.log('[QuickPath] prompt:', prompt);

            // 2. Risolvi centro città AUTORITATIVAMENTE.
            const cityCenter = await resolveCityCenter(activeCity);

            // 3. Prefs: usa la stessa shape che AiItinerary passa al motore
            //    (duration/group testuali + interests come coppia main+sub).
            // Gate H: selectedOption è STRING → risolviamo title via mainOptions.find.
            const mainTitle = mainOptions.find(o => o.id === selectedOption)?.title;
            const prefsObject = {
                duration: selectedDuration?.title || '',
                group:    group?.title || '',
                interests: [mainTitle, selectedSubOption?.title].filter(Boolean),
            };

            // 4. aiProfile dal graph learning (come fa AiItinerary).
            const aiProfile = (typeof getAIContext === 'function' ? getAIContext() : '') || '';

            // 5. CHIAMATA MOTORE — stessa firma di AiItinerary, un solo motore.
            const result = await aiRecommendationService.generateItinerary(
                activeCity,
                prefsObject,
                prompt,
                { condition: weatherCondition || 'sunny', temperature: temperatureC || 20 },
                aiProfile,
                cityCenter,
            );

            if (timedOut) return; // il timeout ha già gestito l'errore

            // Gate B — Path A no-results: il motore ha risolto _oggetto_umano
            // dal traduttore d'intento. Passa in errore con quella parola per
            // messaggio onesto ("A ${city} non troviamo spiagge.").
            const rawStops = result?.days?.[0]?.stops || [];
            if (!Array.isArray(rawStops) || rawStops.length === 0) {
                const oggetto = result?._oggetto_umano || null;
                console.warn(`[QuickPath] motore 0 tappe → error-nothing (oggetto="${oggetto || 'n/a'}", source=${result?._source || 'unknown'})`);
                clearTimeout(safetyTimeoutId);
                setGenerationError({ reason: 'nothing', oggetto_umano: oggetto });
                setGenerationStatus('error-nothing');
                return;
            }

            // 7. Businesses partner: SOSPESI in QuickPath.
            //    TODO(V3): ri-aggancia quando il DB avrà partner reali. Oggi
            //    la iniezione via splice rompeva l'ordine delle tappe vere e
            //    riempiva slot inutili. V1 = solo motore AI viaggiatore.
            // const businesses = await dataService.getBusinessesByCityAndTags(activeCity, tags, pace);

            // 8. Normalizza il tour. enforceRadius NON è più false: il tour
            //    è AI e il raggio si applica (il motore ha già filtrato in
            //    generateItinerary, il normalizer riapplica per uniformità).
            const dayTitle = result?.days?.[0]?.title || `Esplora ${activeCity}`;
            // Gate I — se il motore ha trovato UN SOLO posto vero che valeva
            // per la richiesta, la description si trasforma in messaggio onesto
            // ("un solo posto"). Meglio 1 tappa vera + spiegazione che 0 tappe
            // + errore bugiardo su una città che il posto ce l'ha (Villa Bellini).
            const singleStop = !!result?._singleStop;
            const tourDescription = singleStop
                ? `A ${activeCity} abbiamo trovato un solo posto che vale per questa richiesta. Te lo mostriamo com'è.`
                : "Esperienza personalizzata generata dal motore AI DoveVAI.";
            const tourData = normalizeTour({
                id: 'ai-quiz-' + Date.now(),
                title: dayTitle,
                description: tourDescription,
                city: activeCity,
                duration_minutes: selectedDuration?.id === 'veloce' ? 90
                    : selectedDuration?.id === 'lungo' ? 300
                    : 180, // medio
                price_eur: 0,
                rating: 5.0,
                stops: rawStops,
                isAiGenerated: true,
                tags: ['AI', group?.title, 'QuickPath',
                    mainTitle, selectedSubOption?.title].filter(Boolean),
                guideBio: "Itinerario cucito su misura dal motore AI DoveVAI.",
                highlights: [selectedSubOption?.title, activeCity, group?.title].filter(Boolean),
                included: [],
                notIncluded: [],
                center: { latitude: cityCenter.latitude, longitude: cityCenter.longitude },
            }, {
                cityFallback: activeCity,
                cityCenter, // enforceRadius default (on): il raggio si applica.
            });

            clearTimeout(safetyTimeoutId);

            // 9. Tracking preferenze per apprendimento AI.
            try {
                trackGeneratedTour({
                    mood: selectedSubOption?.title || '',
                    inspiration: selectedSubOption?.description || '',
                    time: selectedTime?.title || '',
                    duration: selectedDuration?.title || '',
                    group: group?.title || '',
                    city: activeCity,
                });
            } catch (trackErr) { console.warn('[QuickPath] tracking error:', trackErr?.message); }

            setReadyTourData(tourData);
            setGenerationStatus('success');
            console.log('[QuickPath] SUCCESS — tour reale generato, tappe:', tourData.steps?.length);

        } catch (err) {
            clearTimeout(safetyTimeoutId);
            if (timedOut) return; // il timeout ha già gestito

            console.warn('[QuickPath] generation error:', err?.name, err?.message);

            // Gate D-6 — distinzione errori:
            // - Quota esaurita → 'error-quota' con copy onesto ("Hai esplorato
            //   tanto oggi."). Coerente con AiItinerary + SurpriseTour.
            // - CityCenterUnresolvedError → tecnico (città non risolvibile / proxy giù)
            // - Altro → tecnico (rete, timeout OpenAI, etc.)
            const isQuotaErr = err?.code === 'QUOTA_EXCEEDED';
            if (isQuotaErr) {
                setGenerationError({ reason: 'quota', detail: 'quota_exceeded' });
                setGenerationStatus('error-quota');
                return;
            }
            const isCityCenterErr = err instanceof CityCenterUnresolvedError;
            const detail = isCityCenterErr
                ? `cityCenter/${err.reason}`
                : (err?.message || 'unknown');
            setGenerationError({ reason: 'technical', detail });
            setGenerationStatus('error-technical');
        }
    };

    const resetSelection = () => {
        setCurrentStep(1);
        setSelectedOption(null);
        setSelectedSubOption(null);
        setSelectedTime(null);
        setSelectedDuration(null);
        setSelectedGroup(null);
        setGenerationStatus('idle');
        setReadyTourData(null);
    };

    const handleBack = () => {
        if (currentStep > 1 && generationStatus === 'idle') {
            setCurrentStep(prev => prev - 1);
        } else {
            navigate('/dashboard-user');
        }
    };

    return (
        <div className="min-h-screen bg-obsidian-bg font-quicksand pb-24 text-obsidian-primary">
            <TopBar />

            <main className="max-w-md mx-auto px-4 py-8 pb-24">
                {/* Header */}
                <motion.div
                    className="flex items-center mb-8"
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                >
                    <motion.button
                        onClick={handleBack}
                        className="p-2 rounded-full bg-obsidian-raised hover:bg-obsidian-card text-obsidian-primary border border-obsidian-border transition-colors mr-4 cursor-pointer"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        aria-label="Indietro"
                    >
                        <ArrowLeft className="w-5 h-5 text-obsidian-primary" />
                    </motion.button>
                    <div>
                        <h1 className="text-2xl font-bold text-obsidian-primary tracking-tight">Percorso Veloce</h1>
                        <p className="text-obsidian-secondary text-sm">Scopri qualcosa di speciale in pochi minuti</p>
                    </div>
                </motion.div>

                {/* Progress Indicator: 6 step */}
                <motion.div
                    className="flex items-center justify-center space-x-2 mb-8"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.4, delay: 0.1 }}
                >
                    {[1, 2, 3, 4, 5, 6].map((step) => (
                        <div
                            key={step}
                            className={`h-2 rounded-full transition-all duration-300 ${
                                currentStep === step
                                    ? 'w-6 bg-brand-orange shadow-sm shadow-brand-orange/30'
                                    : currentStep > step
                                    ? 'w-2 bg-brand-orange/60'
                                    : 'w-2 bg-obsidian-raised border border-obsidian-border'
                            }`}
                        />
                    ))}
                </motion.div>

                <AnimatePresence mode="wait">
                    {/* Step 1: Main Environment */}
                    {currentStep === 1 && (
                        <motion.div
                            key="step1"
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 1.02 }}
                            transition={{ duration: 0.3 }}
                        >
                            <div className="text-center mb-8">
                                <h2 className="text-2xl font-bold text-obsidian-primary mb-2 tracking-tight">Il tuo mood oggi?</h2>
                                <p className="text-obsidian-secondary text-sm">L'ambiente perfetto per iniziare</p>
                            </div>

                            <div className="grid grid-cols-2 gap-3.5">
                                {mainOptions.map((option, index) => {
                                    const IconComponent = option.icon || Sparkles;
                                    return (
                                        <motion.button
                                            key={option.id}
                                            onClick={() => handleMainSelection(option.id)}
                                            className="relative bg-obsidian-card p-5 rounded-[24px] border border-obsidian-border hover:border-brand-orange/60 hover:bg-obsidian-raised transition-all duration-200 group overflow-hidden text-left h-44 flex flex-col justify-between shadow-sm cursor-pointer"
                                            initial={{ opacity: 0, y: 15 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: index * 0.04 }}
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                        >
                                            <div className="w-12 h-12 rounded-2xl bg-obsidian-raised border border-obsidian-border flex items-center justify-center text-obsidian-secondary group-hover:text-brand-orange group-hover:border-brand-orange/40 transition-colors shadow-sm">
                                                <IconComponent className="w-6 h-6 stroke-[1.75]" />
                                            </div>

                                            <div>
                                                <h3 className="font-bold text-lg text-obsidian-primary group-hover:text-brand-orange transition-colors">{option.title}</h3>
                                                <div className="h-0.5 w-0 group-hover:w-8 bg-brand-orange mt-2 transition-all duration-300 rounded-full" />
                                            </div>
                                        </motion.button>
                                    );
                                })}
                            </div>
                        </motion.div>
                    )}

                    {/* Step 2: Specific Activity */}
                    {currentStep === 2 && selectedOption && (
                        <motion.div
                            key="step2"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.3 }}
                        >
                            <div className="text-center mb-8">
                                <h2 className="text-2xl font-bold text-obsidian-primary mb-2">Cosa ti ispira?</h2>
                                <p className="text-obsidian-secondary text-sm">Scegli l'esperienza che fa per te</p>
                            </div>

                            <div className="space-y-3">
                                {subOptions[selectedOption]?.map((subOption, index) => (
                                    <motion.button
                                        key={subOption.id}
                                        onClick={() => handleSubSelection(subOption)}
                                        className="w-full bg-obsidian-card rounded-[24px] p-4 border border-obsidian-border hover:border-brand-orange/60 hover:bg-obsidian-raised transition-all flex items-center gap-4 group text-left relative overflow-hidden shadow-sm cursor-pointer"
                                        initial={{ opacity: 0, y: 15 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.04 }}
                                        whileHover={{ x: 4 }}
                                        whileTap={{ scale: 0.98 }}
                                    >
                                        {/* Box preview: gradient categoryPalette deterministico (DVAI-058) */}
                                        <div
                                            className="relative w-20 h-20 flex-shrink-0 rounded-2xl overflow-hidden border border-obsidian-border shadow-inner flex items-center justify-center"
                                            style={{
                                                background: getCoverPalette(selectedOption, null).gradient,
                                            }}
                                        >
                                            <div className="w-full h-full flex items-center justify-center text-3xl opacity-60 select-none">
                                                {subOption.emoji}
                                            </div>
                                        </div>

                                        <div className="flex-1 min-w-0 pr-2">
                                            <h3 className="font-bold text-base text-obsidian-primary mb-1 group-hover:text-brand-orange transition-colors truncate">
                                                {subOption.title}
                                            </h3>
                                            <p className="text-xs text-obsidian-secondary leading-relaxed line-clamp-2 font-medium">
                                                {subOption.description}
                                            </p>
                                        </div>

                                        <div className="text-obsidian-secondary group-hover:text-brand-orange transition-colors shrink-0">
                                            <ArrowRight className="w-5 h-5" />
                                        </div>
                                    </motion.button>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {/* Step 3: Time Preference */}
                    {currentStep === 3 && (
                        <motion.div
                            key="step3"
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 1.02 }}
                            transition={{ duration: 0.3 }}
                        >
                            <div className="text-center mb-8">
                                <h2 className="text-2xl font-bold text-obsidian-primary mb-2">Quando partiamo?</h2>
                                <p className="text-obsidian-secondary text-sm">Scegli la fascia oraria preferita</p>
                            </div>

                            <div className="space-y-3">
                                {timeOptions.map((timeOption, index) => {
                                    const IconComponent = timeOption.icon || Sun;
                                    return (
                                        <motion.button
                                            key={timeOption.id}
                                            onClick={() => handleTimeSelection(timeOption)}
                                            className="w-full bg-obsidian-card overflow-hidden rounded-[24px] p-4 border border-obsidian-border hover:border-brand-orange/60 hover:bg-obsidian-raised transition-all flex items-center justify-between group shadow-sm text-left cursor-pointer"
                                            initial={{ opacity: 0, y: 15 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: index * 0.04 }}
                                            whileHover={{ x: 4 }}
                                            whileTap={{ scale: 0.98 }}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-2xl bg-obsidian-raised border border-obsidian-border flex items-center justify-center text-obsidian-secondary group-hover:text-brand-orange group-hover:border-brand-orange/40 transition-colors shadow-sm shrink-0">
                                                    <IconComponent className="w-6 h-6 stroke-[1.75]" />
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-base text-obsidian-primary group-hover:text-brand-orange transition-colors">
                                                        {timeOption.title}
                                                    </h3>
                                                    <p className="text-obsidian-secondary text-xs font-semibold tracking-wider mt-0.5">
                                                        {timeOption.time}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-obsidian-secondary group-hover:text-brand-orange transition-colors shrink-0">
                                                <ArrowRight className="w-5 h-5" />
                                            </div>
                                        </motion.button>
                                    );
                                })}
                            </div>
                        </motion.div>
                    )}

                    {/* Step 4: Duration */}
                    {currentStep === 4 && (
                        <motion.div
                            key="step4"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.3 }}
                        >
                            <div className="text-center mb-8">
                                <h2 className="text-2xl font-bold text-obsidian-primary mb-2">Quanto tempo hai?</h2>
                                <p className="text-obsidian-secondary text-sm">Regola il ritmo della visita</p>
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                {durationOptions.map((durationOption, index) => {
                                    const IconComponent = durationOption.icon || Clock;
                                    return (
                                        <motion.button
                                            key={durationOption.id}
                                            onClick={() => handleDurationSelection(durationOption)}
                                            className="bg-obsidian-card rounded-[24px] p-4 py-6 border border-obsidian-border hover:border-brand-orange/60 hover:bg-obsidian-raised transition-all flex flex-col items-center gap-3 group shadow-sm cursor-pointer"
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            transition={{ delay: index * 0.04 }}
                                            whileHover={{ y: -3 }}
                                            whileTap={{ scale: 0.97 }}
                                        >
                                            <div className="w-11 h-11 rounded-2xl bg-obsidian-raised border border-obsidian-border flex items-center justify-center text-obsidian-secondary group-hover:text-brand-orange group-hover:border-brand-orange/40 transition-colors shadow-sm">
                                                <IconComponent className="w-5 h-5 stroke-[1.75]" />
                                            </div>
                                            <div className="text-center">
                                                <h3 className="font-bold text-obsidian-primary text-sm group-hover:text-brand-orange transition-colors">
                                                    {durationOption.title}
                                                </h3>
                                                <p className="text-[11px] text-obsidian-secondary mt-0.5 font-medium">
                                                    {durationOption.duration}
                                                </p>
                                            </div>
                                        </motion.button>
                                    );
                                })}
                            </div>
                        </motion.div>
                    )}

                    {/* Step 5: Group Size */}
                    {currentStep === 5 && (
                        <motion.div
                            key="step5"
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 1.02 }}
                            transition={{ duration: 0.3 }}
                        >
                            <div className="text-center mb-8">
                                <h2 className="text-2xl font-bold text-obsidian-primary mb-2">Chi c'è con te?</h2>
                                <p className="text-obsidian-secondary text-sm">Adatteremo tappe e pause al gruppo</p>
                            </div>

                            <div className="grid grid-cols-2 gap-3.5">
                                {groupOptions.map((groupOption, index) => {
                                    const IconComponent = groupOption.icon || User;
                                    return (
                                        <motion.button
                                            key={groupOption.id}
                                            onClick={() => handleGroupSelection(groupOption)}
                                            className="bg-obsidian-card rounded-[24px] p-5 border border-obsidian-border hover:border-brand-orange/60 hover:bg-obsidian-raised transition-all text-left relative overflow-hidden group shadow-sm cursor-pointer"
                                            initial={{ opacity: 0, y: 15 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: index * 0.04 }}
                                            whileTap={{ scale: 0.97 }}
                                        >
                                            <div className="w-11 h-11 rounded-2xl bg-obsidian-raised border border-obsidian-border flex items-center justify-center text-obsidian-secondary group-hover:text-brand-orange group-hover:border-brand-orange/40 transition-colors shadow-sm mb-3">
                                                <IconComponent className="w-5 h-5 stroke-[1.75]" />
                                            </div>
                                            <h3 className="font-bold text-base text-obsidian-primary group-hover:text-brand-orange transition-colors">
                                                {groupOption.title}
                                            </h3>
                                            <p className="text-xs text-obsidian-secondary mt-0.5 font-medium">
                                                {groupOption.size}
                                            </p>
                                        </motion.button>
                                    );
                                })}
                            </div>
                        </motion.div>
                    )}

                    {/* Step 6: GENERATION STATE */}
                    {currentStep === 6 && (
                        <motion.div
                            key="step6"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                        >
                            {generationStatus === 'loading' && (
                                <LoadingSubSteps city={activeCity} />
                            )}

                            {generationStatus === 'success' && readyTourData && (
                                <QuickPathSummary
                                    tourData={readyTourData}
                                    choices={{
                                        mood: mainOptions.find(o => o.id === selectedOption)?.title || selectedOption,
                                        inspiration: selectedSubOption?.title,
                                        time: selectedTime?.title,
                                        duration: selectedDuration?.title,
                                        group: selectedGroup?.title
                                    }}
                                    onViewMap={() => {
                                        const tour = { ...readyTourData };
                                        if (tour.steps?.length) {
                                            tour.steps = tour.steps.map(s => ({
                                                ...s,
                                                lat: typeof s.lat === 'number' ? s.lat : parseFloat(s.latitude),
                                                lng: typeof s.lng === 'number' ? s.lng : parseFloat(s.longitude),
                                                latitude: typeof s.latitude === 'number' ? s.latitude : parseFloat(s.lat),
                                                longitude: typeof s.longitude === 'number' ? s.longitude : parseFloat(s.lng),
                                            }));
                                        }
                                        navigate('/map', { state: { tourData: tour, isAiGenerated: true } });
                                    }}
                                    onHome={() => {
                                        resetSelection();
                                        navigate('/dashboard-user');
                                    }}
                                />
                            )}

                            {/* Gate 2 FASE 3 — Due messaggi distinti per due cause distinte */}
                            {generationStatus === 'error-nothing' && (
                                <div className="bg-obsidian-card border border-obsidian-border rounded-[28px] p-8 text-center max-w-md mx-auto shadow-2xl">
                                    <h3 className="text-2xl font-bold text-obsidian-primary mb-3">
                                        {generationError?.oggetto_umano
                                            ? `A ${activeCity} non troviamo ${generationError.oggetto_umano}.`
                                            : 'Non basta per un tour.'}
                                    </h3>
                                    <p className="text-obsidian-secondary text-sm leading-relaxed mb-8 font-medium">
                                        {generationError?.oggetto_umano
                                            ? 'Cambia richiesta e riprovo.'
                                            : `A ${activeCity} non ci sono abbastanza posti veri per quello che hai chiesto. Cambia una scelta e riprovo.`}
                                    </p>
                                    <button
                                        onClick={() => { setGenerationStatus('idle'); resetSelection(); }}
                                        className="px-6 py-3.5 bg-brand-orange hover:bg-brand-orange-hover text-obsidian-bg rounded-xl font-bold transition-colors w-full sm:w-auto shadow-md shadow-brand-orange/20 cursor-pointer"
                                    >
                                        Cambia una scelta
                                    </button>
                                </div>
                            )}

                            {generationStatus === 'error-technical' && (
                                <div className="bg-obsidian-card border border-obsidian-border rounded-[28px] p-8 text-center max-w-md mx-auto shadow-2xl">
                                    <h3 className="text-2xl font-bold text-obsidian-primary mb-3">Non riesco a raggiungere i posti.</h3>
                                    <p className="text-obsidian-secondary text-sm leading-relaxed mb-8 font-medium">
                                        Riprova tra un attimo.
                                    </p>
                                    <button
                                        onClick={() => { setGenerationStatus('idle'); generateItinerary(selectedGroup); }}
                                        className="px-6 py-3.5 bg-brand-orange hover:bg-brand-orange-hover text-obsidian-bg rounded-xl font-bold transition-colors w-full sm:w-auto shadow-md shadow-brand-orange/20 cursor-pointer"
                                    >
                                        Riprova
                                    </button>
                                </div>
                            )}

                            {generationStatus === 'error-quota' && (
                                <div className="bg-obsidian-card border border-obsidian-border rounded-[28px] p-8 text-center max-w-md mx-auto shadow-2xl">
                                    <div className="w-14 h-14 rounded-2xl bg-obsidian-raised border border-obsidian-border flex items-center justify-center text-brand-orange mx-auto mb-4 shadow-sm">
                                        <Clock className="w-7 h-7 stroke-[1.75]" />
                                    </div>
                                    <h3 className="text-2xl font-bold text-obsidian-primary mb-3">Hai esplorato tanto oggi.</h3>
                                    <p className="text-obsidian-secondary text-sm leading-relaxed mb-8 font-medium">
                                        Domani nuove esperienze.
                                    </p>
                                    <button
                                        onClick={() => navigate('/dashboard-user')}
                                        className="px-6 py-3.5 bg-brand-orange hover:bg-brand-orange-hover text-obsidian-bg rounded-xl font-bold transition-colors w-full sm:w-auto shadow-md shadow-brand-orange/20 cursor-pointer"
                                    >
                                        Torna alla home
                                    </button>
                                </div>
                            )}
                        </motion.div>
                    )}

                </AnimatePresence>
            </main>

            <BottomNavigation />
        </div>
    );
}


