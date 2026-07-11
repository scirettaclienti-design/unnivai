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
import { Brain } from "lucide-react";
import { ArrowLeft, Waves, Mountain, Building2, Trees, ArrowRight, RotateCcw, Home, Sunrise, Sun, Sunset, Zap, Clock, Target, User, Heart, Users, UserCheck, MapPin, Calendar, Timer, UsersIcon } from "lucide-react";
import DemoHint from "@/components/DemoHint";
import { Link } from "react-router-dom";
import TopBar from "@/components/TopBar";
import BottomNavigation from "@/components/BottomNavigation";
import { QuickPathSummary } from "@/components/Map/QuickPathSummary";
import { useUserContext } from "@/hooks/useUserContext";
import { useAILearning } from "@/hooks/useAILearning";
import { DEMO_CITIES } from "@/data/demoData";
import PaywallModal from "@/components/PaywallModal";

// ─── Loading Sub-Steps animati ─────────────────────────────────────────────
// Gate B — Microcopy loading a 3 fasi (approvato Ivano). Narra l'attesa
// con quello che il motore FA davvero (soglia rating 4.2 + review), non con
// promesse marketing tipo "scarto quelli per turisti" (bugia: non c'è filtro).
const LOADING_STEPS = [
    { emoji: '🔍', textFn: (city) => `Cerco i posti veri di ${city}...` },
    { emoji: '⭐', textFn: () => 'Controllo cosa dicono quelli che ci sono stati...' },
    { emoji: '✨', textFn: () => 'Ci siamo quasi.' },
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

    return (
        <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="relative w-28 h-28 mb-8">
                <motion.div
                    className="absolute inset-0 border-4 border-t-terracotta-500 border-r-transparent border-b-orange-300 border-l-transparent rounded-full"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                    <motion.span
                        key={step}
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="text-4xl"
                    >
                        {LOADING_STEPS[Math.min(step, LOADING_STEPS.length - 1)].emoji}
                    </motion.span>
                </div>
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-3">Il tuo tour a {city}</h2>
            <AnimatePresence mode="wait">
                <motion.p
                    key={step}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                    className="text-gray-500 text-sm font-medium"
                >
                    {LOADING_STEPS[Math.min(step, LOADING_STEPS.length - 1)].textFn(city)}
                </motion.p>
            </AnimatePresence>
            {/* Progress dots */}
            <div className="flex gap-1.5 mt-6">
                {LOADING_STEPS.map((_, i) => (
                    <motion.div
                        key={i}
                        className="w-2 h-2 rounded-full"
                        animate={{
                            backgroundColor: i <= step ? '#f97316' : '#e5e7eb',
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

// 🌍 ADAPTIVE DATA ENGINE
const CITY_CONFIG = {
    'Roma': {
        main: ['citta', 'natura', 'storia', 'cibo'],
        sub: {
            citta: [
                { id: 'rione', title: 'Rioni Storici', image: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=300', description: 'Perditi tra i vicoli di Trastevere o Monti', emoji: '🛵' },
                { id: 'piazze', title: 'Piazze Eterne', image: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=300', description: 'La dolce vita tra Piazza Navona e Spagna', emoji: '⛲' },
                { id: 'shopping', title: 'Via del Corso', image: 'https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?w=300', description: 'Shopping tra vetrine e palazzi storici', emoji: '🛍️' }
            ],
            natura: [
                { id: 'villa', title: 'Ville Nobiliari', image: 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=300', description: 'Relax a Villa Borghese o Doria Pamphilj', emoji: '🌳' },
                { id: 'tevere', title: 'Lungo il Tevere', image: 'https://images.unsplash.com/photo-1565618244030-h200?w=300', description: 'Passeggiata ciclabile sulle sponde del fiume', emoji: '🚴' }
            ],
            storia: [
                { id: 'imperiale', title: 'Roma Imperiale', image: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=300', description: 'Colosseo e Fori Imperiali al tramonto', emoji: '⚔️' },
                { id: 'barocco', title: 'Roma Barocca', image: 'https://images.unsplash.com/photo-1548625361-9877484df6c5?w=300', description: 'Bernini, Borromini e le cupole', emoji: '⛪' }
            ],
            cibo: [
                { id: 'street', title: 'Street Food', image: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=300', description: 'Supplì, Pizza al taglio e Maritozzo', emoji: '🍕' },
                { id: 'carbonara', title: 'Carbonara Tour', image: 'https://images.unsplash.com/photo-1574868233905-25916053805b?w=300', description: 'Alla ricerca della pasta perfetta', emoji: '🍝' }
            ]
        }
    },
    'Milano': {
        main: ['citta', 'moda', 'parchi', 'canali'],
        sub: {
            citta: [
                { id: 'duomo', title: 'Zona Duomo', image: 'https://images.unsplash.com/photo-1547464333-28f0de20b8f9?w=300', description: 'Il cuore pulsante tra madonnina e galleria', emoji: '⛪' },
                { id: 'grattacieli', title: 'Skyline Gae Aulenti', image: 'https://images.unsplash.com/photo-1513581166391-887a96ddeafd?w=300', description: 'La Milano moderna del Bosco Verticale', emoji: '🏙️' }
            ],
            moda: [
                { id: 'quadrilatero', title: 'Quadrilatero', image: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=300', description: 'Fashion district e vetrine di lusso', emoji: '👠' },
                { id: 'vintage', title: 'Vintage Brera', image: 'https://images.unsplash.com/photo-1520006403909-838d6b92c22e?w=300', description: 'Botteghe storiche e design', emoji: '🕶️' }
            ],
            parchi: [
                { id: 'sempione', title: 'Parco Sempione', image: 'https://images.unsplash.com/photo-1579290076295-a226bc40b543?w=300', description: 'Relax vista Castello Sforzesco', emoji: '🏰' }
            ],
            canali: [
                { id: 'navigli', title: 'I Navigli', image: 'https://images.unsplash.com/photo-1513581166391-887a96ddeafd?w=300', description: 'Aperitivo e passeggiata sui canali', emoji: '🥂' }
            ]
        }
    },
    'Napoli': {
        main: ['mare', 'citta', 'vulcano', 'cibo'],
        sub: {
            mare: [
                { id: 'lungomare', title: 'Lungomare', image: 'https://images.unsplash.com/photo-1498394467144-8cb38902d184?w=300', description: 'Castel dell\'Ovo e vista Capri', emoji: '🌊' },
                { id: 'posillipo', title: 'Posillipo', image: 'https://images.unsplash.com/photo-1534720993072-cb99b397d415?w=300', description: 'Panorami mozzafiato dall\'alto', emoji: '📸' }
            ],
            citta: [
                { id: 'spaccanapoli', title: 'Spaccanapoli', image: 'https://images.unsplash.com/photo-1548625361-9877484df6c5?w=300', description: 'Il cuore verace e i presepi', emoji: '🌶️' },
                { id: 'quartieri', title: 'Quartieri Spagnoli', image: 'https://images.unsplash.com/photo-1574868233905-25916053805b?w=300', description: 'Murales, vicoli e vitalità', emoji: '🎭' }
            ],
            vulcano: [
                { id: 'vesuvio', title: 'Vesuvio View', image: 'https://images.unsplash.com/photo-1536417724282-598284687593?w=300', description: 'Punti panoramici sul vulcano', emoji: '🌋' }
            ],
            cibo: [
                { id: 'pizza', title: 'Vera Pizza', image: 'https://images.unsplash.com/photo-1574868233905-25916053805b?w=300', description: 'Le pizzerie storiche', emoji: '🍕' },
                { id: 'dolci', title: 'Sfogliatella', image: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=300', description: 'Pasticceria napoletana', emoji: '🧁' }
            ]
        }
    },
    // Default Fallback
    'default': {
        main: ['citta', 'natura', 'storia', 'relax'],
        sub: {
            citta: [{ id: 'centro', title: 'Centro Storico', image: 'https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?w=300', description: 'Monumenti e piazze principali', emoji: '🏰' }],
            natura: [{ id: 'parco', title: 'Parchi e Verde', image: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=300', description: 'Aree verdi e relax', emoji: '🌳' }],
            storia: [{ id: 'musei', title: 'Cultura e Musei', image: 'https://images.unsplash.com/photo-1548625361-9877484df6c5?w=300', description: 'Arte e storia locale', emoji: '🏛️' }],
            relax: [{ id: 'spa', title: 'Benessere', image: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=300', description: 'Terme e relax', emoji: '🧖' }]
        }
    }
};

// HELPER: Component-ready options generator
const getAdaptiveOptions = (city) => {
    const config = CITY_CONFIG[city] || CITY_CONFIG['default'];

    // Map main keys to full option objects
    const mainOptions = config.main.map(key => {
        switch (key) {
            case 'citta': return { id: 'citta', title: 'Città', emoji: '🏙️', color: 'from-purple-400 to-indigo-400' };
            case 'natura': return { id: 'natura', title: 'Natura', emoji: '🌿', color: 'from-emerald-400 to-green-400' };
            case 'mare': return { id: 'mare', title: 'Mare', emoji: '🌊', color: 'from-blue-400 to-cyan-400' };
            case 'montagna': return { id: 'montagna', title: 'Montagna', emoji: '⛰️', color: 'from-green-400 to-emerald-400' };
            case 'storia': return { id: 'storia', title: 'Storia', emoji: '🏛️', color: 'from-amber-400 to-orange-400' };
            case 'cibo': return { id: 'cibo', title: 'Gusto', emoji: '🍝', color: 'from-red-400 to-orange-400' };
            case 'moda': return { id: 'moda', title: 'Fashion', emoji: '👠', color: 'from-pink-400 to-rose-400' };
            case 'parchi': return { id: 'parchi', title: 'Parchi', emoji: '🌳', color: 'from-green-400 to-teal-400' };
            case 'canali': return { id: 'canali', title: 'Navigli', emoji: '🛶', color: 'from-blue-500 to-indigo-500' };
            case 'vulcano': return { id: 'vulcano', title: 'Vulcano', emoji: '🌋', color: 'from-red-600 to-orange-600' };
            case 'relax': return { id: 'relax', title: 'Relax', emoji: '🧖', color: 'from-teal-300 to-cyan-300' };
            default: return { id: key, title: key, emoji: '✨', color: 'from-gray-400 to-gray-500' };
        }
    });

    // Gate 2 FASE 3 — nessuna Unsplash di fallback. Le sub-opzioni che hanno
    // già una URL http (dal CITY_CONFIG) la mantengono per ora (Gate C riderà
    // anche il CITY_CONFIG). Quelle senza URL avranno `image: null` e il JSX
    // sotto (:795 area) userà il gradient categoryPalette come fallback.
    const subWithImages = {};
    Object.keys(config.sub).forEach(key => {
        subWithImages[key] = (config.sub[key] || []).map(item => ({
            ...item,
            image: item?.image && item.image.startsWith('http') ? item.image : null,
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
        emoji: '🌅',
        icon: Sunrise,
        time: '08:00 - 12:00',
        description: 'Perfetto per iniziare la giornata con energia',
        color: 'from-yellow-400 to-orange-400'
    },
    {
        id: 'pomeriggio',
        title: 'Pomeriggio',
        emoji: '☀️',
        icon: Sun,
        time: '14:00 - 18:00',
        description: 'Ideale per esplorare con calma',
        color: 'from-orange-400 to-red-400'
    },
    {
        id: 'sera',
        title: 'Sera',
        emoji: '🌆',
        icon: Sunset,
        time: '18:00 - 22:00',
        description: 'Magico per tramonti e atmosfere romantiche',
        color: 'from-purple-400 to-pink-400'
    }
];

// Step 4: Duration preferences
const durationOptions = [
    {
        id: 'veloce',
        title: 'Veloce',
        emoji: '⚡',
        icon: Zap,
        duration: '1-2 ore',
        description: 'Perfetto per una pausa veloce',
        color: 'from-green-400 to-emerald-400'
    },
    {
        id: 'medio',
        title: 'Medio',
        emoji: '🚶',
        icon: Clock,
        duration: '2-4 ore',
        description: 'Tempo ideale per esplorare con calma',
        color: 'from-blue-400 to-cyan-400'
    },
    {
        id: 'lungo',
        title: 'Lungo',
        emoji: '🎯',
        icon: Target,
        duration: '4-6 ore',
        description: 'Immersione completa nell\'esperienza',
        color: 'from-indigo-400 to-purple-400'
    }
];

// Step 5: Group size preferences
const groupOptions = [
    {
        id: 'solo',
        title: 'Solo',
        emoji: '🧘',
        icon: User,
        size: '1 persona',
        description: 'Momento di tranquillità e riflessione',
        color: 'from-gray-400 to-slate-400'
    },
    {
        id: 'coppia',
        title: 'In coppia',
        emoji: '💕',
        icon: Heart,
        size: '2 persone',
        description: 'Esperienza romantica e intima',
        color: 'from-pink-400 to-rose-400'
    },
    {
        id: 'amici',
        title: 'Con gli amici',
        emoji: '👥',
        icon: Users,
        size: '3-6 persone',
        description: 'Divertimento e condivisione',
        color: 'from-cyan-400 to-blue-400'
    },
    {
        id: 'famiglia',
        title: 'In famiglia',
        emoji: '👨‍👩‍👧‍👦',
        icon: UserCheck,
        size: '4-8 persone',
        description: 'Adatto a tutte le età',
        color: 'from-emerald-400 to-green-400'
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

    const { trackGeneratedTour, hasHitPaywall, unlockPremium } = useAILearning();
    const [showPaywall, setShowPaywall] = useState(false);

    // GENERATION STATE (LIFTED UP)
    // Gate 2 FASE 3 — status esteso con reason per distinguere i due messaggi.
    //   idle | loading | success | 'error-nothing' | 'error-technical'
    // "error-nothing" → messaggio brand ("Non basta per un tour.")
    // "error-technical" → messaggio infra ("Non riesco a raggiungere i posti.")
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
        
        // 🔒 Intercettazione Premium Gate
        if (hasHitPaywall) {
            setShowPaywall(true);
            return;
        }

        setCurrentStep(6); // Move to loading step
        // TRIGGER GENERATION IMMEDIATELY ON FINAL SELECTION
        generateItinerary(groupOption);
    };

    // ─── Gate 2 FASE 3 — Motore reale + policy anti-fallback ────────────────
    // Regole locked (nessun fallback genera mai un tour):
    // - Safety timeout 20s → 'error-technical' (guardia, mai un tour).
    // - resolveCityCenter fail → 'error-technical'.
    // - Motore ritorna 0 tappe → 'error-nothing'.
    // - Quota esaurita → 'error-technical' (con messaggio dedicato via toast).
    // - Qualsiasi altro throw → 'error-technical'.
    // Zero coordinate hardcoded. Zero Unsplash. Zero enforceRadius:false.
    const generateItinerary = async (group) => {
        console.log('[QuickPath] START generation:', {
            city: activeCity,
            main: selectedOption?.id,
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
            const prompt = buildPromptFromSelections({
                main:     selectedOption?.id,
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
            const prefsObject = {
                duration: selectedDuration?.title || '',
                group:    group?.title || '',
                interests: [selectedOption?.title, selectedSubOption?.title].filter(Boolean),
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
            const tourData = normalizeTour({
                id: 'ai-quiz-' + Date.now(),
                title: dayTitle,
                description: "Esperienza personalizzata generata dal motore AI DoveVAI.",
                city: activeCity,
                duration_minutes: selectedDuration?.id === 'veloce' ? 90
                    : selectedDuration?.id === 'lungo' ? 300
                    : 180, // medio
                price_eur: 0,
                rating: 5.0,
                stops: rawStops,
                isAiGenerated: true,
                tags: ['AI', group?.title, 'QuickPath',
                    selectedOption?.title, selectedSubOption?.title].filter(Boolean),
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

            // Distinzione errori:
            // - CityCenterUnresolvedError con reason='proxy' → tecnico
            // - CityCenterUnresolvedError con reason='not_found' → tecnico (città non risolvibile)
            // - Quota esaurita → tecnico (l'utente non può fare nulla ora)
            // - Altro → tecnico (rete, timeout OpenAI, etc.)
            const isCityCenterErr = err instanceof CityCenterUnresolvedError;
            const isQuotaErr = err?.code === 'QUOTA_EXCEEDED';
            const reason = 'technical';
            const detail = isCityCenterErr ? `cityCenter/${err.reason}`
                         : isQuotaErr      ? 'quota_exceeded'
                         : (err?.message || 'unknown');

            setGenerationError({ reason, detail });
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

    return (
        <div className="min-h-screen bg-gradient-to-b from-ochre-100 to-ochre-200 font-quicksand">
            <TopBar />

            <main className="max-w-md mx-auto px-4 py-8 pb-24">
                {/* Header */}
                <motion.div
                    className="flex items-center mb-8"
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                >
                    <Link to="/dashboard-user">
                        <motion.button
                            className="p-2 rounded-full bg-white/60 backdrop-blur-sm mr-4 hover:bg-white/80 transition-colors"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            <ArrowLeft className="w-5 h-5 text-gray-700" />
                        </motion.button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">Percorso Veloce</h1>
                        <p className="text-gray-600 text-sm">Scopri qualcosa di speciale in pochi minuti</p>
                    </div>
                </motion.div>

                {/* Progress Indicator: 6 step (ultimo = riepilogo/completamento) */}
                <motion.div
                    className="flex items-center justify-center space-x-2 mb-8"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                >
                    {[1, 2, 3, 4, 5, 6].map((step) => (
                        <div
                            key={step}
                            className={`w-3 h-3 rounded-full transition-all duration-300 ${currentStep >= step ? 'bg-terracotta-400' : 'bg-gray-300'
                                } ${currentStep === step ? 'scale-125' : ''}`}
                        />
                    ))}
                </motion.div>

                <AnimatePresence mode="wait">
                    {/* Step 1: Main Environment */}
                    {currentStep === 1 && (
                        <motion.div
                            key="step1"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 1.05, filter: "blur(10px)" }}
                            transition={{ duration: 0.5 }}
                        >
                            <div className="text-center mb-10">
                                <h2 className="text-3xl font-bold text-gray-900 mb-3 tracking-tight">Il tuo mood oggi?</h2>
                                <p className="text-gray-500 font-medium">L'ambiente perfetto per iniziare</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                {mainOptions.map((option, index) => (
                                    <motion.button
                                        key={option.id}
                                        onClick={() => handleMainSelection(option.id)}
                                        className="relative bg-white p-6 rounded-[2rem] shadow-sm border-2 border-transparent hover:border-gray-100 hover:shadow-xl transition-all duration-300 group overflow-hidden text-left h-48 flex flex-col justify-between"
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.1 }}
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                    >
                                        <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${option.color} opacity-10 rounded-bl-[4rem] group-hover:scale-150 transition-transform duration-500`} />

                                        <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${option.color} flex items-center justify-center text-2xl shadow-lg group-hover:rotate-12 transition-transform`}>
                                            {option.emoji}
                                        </div>

                                        <div>
                                            <h3 className="font-bold text-xl text-gray-900">{option.title}</h3>
                                            <div className="h-1 w-0 group-hover:w-full bg-gray-900 mt-2 transition-all duration-500 rounded-full" />
                                        </div>
                                    </motion.button>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {/* Step 2: Specific Activity */}
                    {currentStep === 2 && selectedOption && (
                        <motion.div
                            key="step2"
                            initial={{ opacity: 0, x: 50 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -50 }}
                            transition={{ duration: 0.5 }}
                        >
                            <div className="text-center mb-8">
                                <h2 className="text-2xl font-bold text-gray-900 mb-2">Cosa ti ispira?</h2>
                                <p className="text-gray-500">Scegli l'esperienza che fa per te</p>
                            </div>

                            <div className="space-y-4">
                                {subOptions[selectedOption]?.map((subOption, index) => (
                                    <motion.button
                                        key={subOption.id}
                                        onClick={() => handleSubSelection(subOption)}
                                        className="w-full bg-white rounded-[2rem] p-4 shadow-sm border border-gray-100 hover:shadow-lg hover:border-terracotta-200 transition-all flex items-center gap-5 group text-left relative overflow-hidden"
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.1 }}
                                        whileHover={{ x: 5 }}
                                    >
                                        {/* Gate 2 FASE 3 — Box preview: se sub ha URL Unsplash legacy dal
                                            CITY_CONFIG, la usiamo (Gate C rifarà il CITY_CONFIG). Se assente,
                                            fallback illustrato = gradient categoryPalette (coerente TourCover
                                            DVAI-058) + emoji sopra. Zero Unsplash generici di fallback. */}
                                        <div
                                            className="relative w-24 h-24 flex-shrink-0 rounded-2xl overflow-hidden shadow-inner"
                                            style={{
                                                background: subOption.image
                                                    ? 'transparent'
                                                    : getCoverPalette(selectedOption, null).gradient,
                                            }}
                                        >
                                            {subOption.image ? (
                                                <img
                                                    src={subOption.image}
                                                    alt={subOption.title || 'Esperienza'}
                                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                                                    onError={(e) => { e.target.onerror = null; e.target.style.display = 'none'; }}
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-4xl opacity-70 select-none">
                                                    {subOption.emoji}
                                                </div>
                                            )}
                                            <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors" />
                                            <div className="absolute bottom-1 right-1 bg-white/90 backdrop-blur rounded-lg px-2 py-1 text-lg shadow-sm">
                                                {subOption.emoji}
                                            </div>
                                        </div>

                                        <div className="flex-1 pr-4">
                                            <h3 className="font-bold text-lg text-gray-900 mb-1 group-hover:text-terracotta-600 transition-colors">{subOption.title}</h3>
                                            <p className="text-xs text-gray-500 leading-relaxed font-medium line-clamp-2">{subOption.description}</p>
                                        </div>

                                        <div className="absolute right-4 opacity-0 group-hover:opacity-100 transition-opacity text-terracotta-500">
                                            <ArrowRight />
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
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 1.1 }}
                            transition={{ duration: 0.5 }}
                        >
                            <div className="text-center mb-10">
                                <h2 className="text-2xl font-bold text-gray-900 mb-2">Quando partiamo?</h2>
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                {timeOptions.map((timeOption, index) => (
                                    <motion.button
                                        key={timeOption.id}
                                        onClick={() => handleTimeSelection(timeOption)}
                                        className="relative bg-white overflow-hidden rounded-[2.5rem] p-6 shadow-sm border border-gray-100 hover:shadow-xl transition-all group"
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.1 }}
                                        whileTap={{ scale: 0.98 }}
                                    >
                                        <div className={`absolute left-0 top-0 bottom-0 w-2 bg-gradient-to-b ${timeOption.color}`} />
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${timeOption.color} bg-opacity-10 flex items-center justify-center text-3xl shadow-sm text-white`}>
                                                    {timeOption.emoji}
                                                </div>
                                                <div className="text-left">
                                                    <h3 className="font-bold text-xl text-gray-900">{timeOption.title}</h3>
                                                    <p className="text-gray-400 text-xs font-bold tracking-wider uppercase mt-1">{timeOption.time}</p>
                                                </div>
                                            </div>
                                            <div className="w-8 h-8 rounded-full border-2 border-gray-100 group-hover:bg-gray-900 group-hover:border-gray-900 transition-colors" />
                                        </div>
                                    </motion.button>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {/* Step 4: Duration */}
                    {currentStep === 4 && (
                        <motion.div
                            key="step4"
                            initial={{ opacity: 0, x: 50 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -50 }}
                            transition={{ duration: 0.5 }}
                        >
                            <div className="text-center mb-10">
                                <h2 className="text-2xl font-bold text-gray-900 mb-2">Quanto tempo hai?</h2>
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                {durationOptions.map((durationOption, index) => (
                                    <motion.button
                                        key={durationOption.id}
                                        onClick={() => handleDurationSelection(durationOption)}
                                        className="bg-white rounded-[2rem] p-4 py-8 shadow-sm border border-gray-200 hover:border-gray-900 hover:shadow-xl transition-all flex flex-col items-center gap-3 group"
                                        initial={{ opacity: 0, scale: 0.8 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ delay: index * 0.1 }}
                                        whileHover={{ y: -5 }}
                                    >
                                        <div className="text-4xl group-hover:scale-125 transition-transform duration-300 filter grayscale group-hover:grayscale-0">
                                            {durationOption.emoji}
                                        </div>
                                        <div className="text-center">
                                            <h3 className="font-bold text-gray-900 text-sm">{durationOption.title}</h3>
                                            <p className="text-[10px] text-gray-400 mt-1">{durationOption.duration}</p>
                                        </div>
                                    </motion.button>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {/* Step 5: Group Size */}
                    {currentStep === 5 && (
                        <motion.div
                            key="step5"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 1.1 }}
                            transition={{ duration: 0.5 }}
                        >
                            <div className="text-center mb-10">
                                <h2 className="text-2xl font-bold text-gray-900 mb-2">Chi c'è con te?</h2>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                {groupOptions.map((groupOption, index) => (
                                    <motion.button
                                        key={groupOption.id}
                                        onClick={() => handleGroupSelection(groupOption)}
                                        className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100 hover:shadow-xl hover:border-terracotta-100 transition-all text-left relative overflow-hidden group"
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.1 }}
                                        whileTap={{ scale: 0.95 }}
                                    >
                                        <div className="absolute top-0 right-0 p-4 opacity-10 font-bold text-6xl group-hover:opacity-20 transition-opacity">
                                            {groupOption.emoji}
                                        </div>
                                        <div className="relative z-10">
                                            <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${groupOption.color} flex items-center justify-center text-white shadow-md mb-4`}>
                                                <groupOption.icon size={20} />
                                            </div>
                                            <h3 className="font-bold text-lg text-gray-900">{groupOption.title}</h3>
                                            <p className="text-xs text-gray-500 mt-1 font-medium">{groupOption.size}</p>
                                        </div>
                                    </motion.button>
                                ))}
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

                            {/* Gate 2 FASE 3 — Due messaggi distinti per due cause distinte.
                                Voce brand locked Ivano. */}
                            {/* Gate B — Se il motore ha risolto oggetto_umano dal traduttore
                                (path A: free-text), il messaggio è specifico. Altrimenti fallback
                                al testo generico (path B: solo checkbox). */}
                            {generationStatus === 'error-nothing' && (
                                <div className="text-center py-16 px-6 max-w-md mx-auto">
                                    <h3 className="text-2xl font-bold text-gray-900 mb-3">
                                        {generationError?.oggetto_umano
                                            ? `A ${activeCity} non troviamo ${generationError.oggetto_umano}.`
                                            : 'Non basta per un tour.'}
                                    </h3>
                                    <p className="text-gray-600 leading-relaxed mb-8">
                                        {generationError?.oggetto_umano
                                            ? 'Cambia richiesta e riprovo.'
                                            : `A ${activeCity} non ci sono abbastanza posti veri per quello che hai chiesto. Cambia una scelta e riprovo.`}
                                    </p>
                                    <button
                                        onClick={() => { setGenerationStatus('idle'); resetSelection(); }}
                                        className="px-6 py-3 bg-gray-900 text-white rounded-2xl font-bold hover:bg-gray-800 transition-colors"
                                    >
                                        Cambia una scelta
                                    </button>
                                </div>
                            )}

                            {generationStatus === 'error-technical' && (
                                <div className="text-center py-16 px-6 max-w-md mx-auto">
                                    <h3 className="text-2xl font-bold text-gray-900 mb-3">Non riesco a raggiungere i posti.</h3>
                                    <p className="text-gray-600 leading-relaxed mb-8">
                                        Riprova tra un attimo.
                                    </p>
                                    <button
                                        onClick={() => { setGenerationStatus('idle'); generateItinerary(selectedGroup); }}
                                        className="px-6 py-3 bg-gray-900 text-white rounded-2xl font-bold hover:bg-gray-800 transition-colors"
                                    >
                                        Riprova
                                    </button>
                                </div>
                            )}
                        </motion.div>
                    )}


                </AnimatePresence>
            </main>

            <BottomNavigation />
        </div >
    );
}

