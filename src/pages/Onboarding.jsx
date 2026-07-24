/**
 * DVAI-011 — Onboarding Wizard post-registrazione
 * 3 step: benvenuto → interessi → pronto
 * Gate EE — Vincolo strutturale locked Ivano: l'onboarding NON ha un suo
 * sistema di città. La città si chiede in UN SOLO POSTO (CityModal
 * Gate AA), al primo mount della dashboard. Qui: solo profilo + interessi.
 * Al termine: salva preferenze nel profilo Supabase e reindirizza a
 * /dashboard-user, dove AA aprira' il CityModal onboarding.
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Compass, Sparkles, CheckCircle, ArrowRight, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

// Gate EE — ITALIAN_CITIES rimosso: dead code (mai usato nel wizard corrente).

// Gate SEME (L1): ogni voce dichiara `seeds` = gli id CORE_CATEGORIES che
// semina nel preference engine (2o arg di computeWeights). Una voce puo'
// seminarne piu' d'uno ("Storia e arte" → cultura + arte). Gli id in `seeds`
// sono verificati contro normalizeCategory (referto: 8/8 non-null).
// 'romantic' RIMOSSO: normalizeCategory lo scartava in silenzio (referto #1).
// Label provvisorie: le riscrive il gate estetica (separato).
const INTERESTS = [
    { id: 'food',      emoji: '🍝', label: 'Mangiare e bere',      desc: 'Ristoranti, mercati, corsi di cucina', seeds: ['food'] },
    { id: 'cultura',   emoji: '🏛️', label: 'Storia e arte',        desc: 'Musei, storia, gallerie, arte locale', seeds: ['cultura', 'arte'] },
    { id: 'natura',    emoji: '🌿', label: 'Natura e panorami',    desc: 'Parchi, giardini, panorami',          seeds: ['natura'] },
    { id: 'nightlife', emoji: '🌙', label: 'Vita notturna',        desc: 'Aperitivo, bar, eventi serali',       seeds: ['nightlife'] },
    { id: 'avventura', emoji: '🧗', label: 'Camminare e scoprire', desc: 'Trekking, escursioni, sport',         seeds: ['avventura'] },
    { id: 'relax',     emoji: '☕', label: 'Ritmo lento',          desc: 'Pause, benessere, angoli tranquilli', seeds: ['relax'] },
    { id: 'shopping',  emoji: '🛍️', label: 'Shopping e mercati',   desc: 'Boutique, artigianato, mercatini',    seeds: ['shopping'] },
];

// Gate SEME (L1): chiave localStorage dedicata (FUORI dal brain). Deve
// combaciare con ONBOARDING_SEED_KEY in useAILearning.js e con la lista di
// cleanup logout in AuthContext.jsx.
const ONBOARDING_SEED_KEY = 'unnivai_onboarding_seed_v1';

// Gate SEME (L1): dagli id-voce selezionati agli id CORE seminati (flat, dedup).
const computeSeed = (selectedIds) => {
    const flat = selectedIds.flatMap(id => INTERESTS.find(i => i.id === id)?.seeds || []);
    return [...new Set(flat)];
};

const STEP_CONFIG = [
    { id: 'welcome',   title: 'Benvenuto su DoveVAI',   subtitle: 'Il posto esiste. Nessuno te lo aveva mostrato così.' },
    { id: 'interests', title: 'Cosa ti appassiona?',     subtitle: 'Seleziona almeno un interesse' },
    // Gate EE: rimosso subtitle "La tua posizione e' stata rilevata
    // automaticamente" — bugia esplicita (non era mai rilevata, era Roma
    // hardcoded). La citta' la chiede il CityModal Gate AA al primo mount
    // della dashboard. Qui l'onboarding non nomina mai la citta'.
    { id: 'ready',     title: 'Ci siamo. Inizia.',       subtitle: 'La città te la chiediamo tra un secondo.' },
];

const slideVariants = {
    enter: (dir) => ({ x: dir > 0 ? 300 : -300, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit:  (dir) => ({ x: dir > 0 ? -300 : 300, opacity: 0 }),
};

export default function Onboarding() {
    const [step, setStep] = useState(0);
    const [direction, setDirection] = useState(1);
    // Gate EE: RIMOSSO selectedCity useState('Roma') (fallback Roma silenzioso)
    // e setCity da useCity() (l'onboarding NON deve avere un suo motore di
    // citta'). La citta' la chiede il CityModal Gate AA — un solo posto.
    const [selectedInterests, setSelectedInterests] = useState([]);
    const [isSaving, setIsSaving] = useState(false);

    const navigate = useNavigate();
    const { user } = useAuth();

    const goNext = () => {
        setDirection(1);
        setStep(s => Math.min(s + 1, STEP_CONFIG.length - 1));
    };
    const goBack = () => {
        setDirection(-1);
        setStep(s => Math.max(s - 1, 0));
    };

    const toggleInterest = (id) => {
        setSelectedInterests(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleComplete = async () => {
        setIsSaving(true);
        // Gate SEME (L1): id CORE seminati (flat, dedup) dagli interessi scelti.
        const seed = computeSeed(selectedInterests);
        try {
            // Salva solo preferenze/interessi — la città viene dal GPS.
            // Gate SEME (L1): profiles.interests ora contiene gli id CORE seminati
            // (NON le label), cosi' il dato DB e' riusabile in futuro senza rimappatura.
            if (user?.id) {
                await supabase.from('profiles').upsert({
                    id: user.id,
                    interests: seed,
                    onboarding_complete: true,
                    updated_at: new Date().toISOString(),
                }, { onConflict: 'id' });
            }

            // Flag locale per evitare di mostrare l'onboarding di nuovo
            localStorage.setItem('dvai_onboarding_done', '1');

        } catch (err) {
            console.warn('[Onboarding] save failed:', err.message);
            // Salva comunque il flag locale e procedi — l'utente non deve rimanere bloccato
        }
        // Gate SEME (L1): il seme va scritto SEMPRE e PRIMA del navigate (sync),
        // indipendente dall'esito del salvataggio DB — deve essere gia' in
        // localStorage quando DashboardUser monta e useAILearning lo legge.
        try { localStorage.setItem(ONBOARDING_SEED_KEY, JSON.stringify(seed)); } catch { /* quota: seme salta, comportamento = utente senza seme */ }
        setIsSaving(false);
        navigate('/dashboard-user', { replace: true });
    };

    const canProceed = () => {
        if (step === 1) return selectedInterests.length > 0; // step interessi
        return true;
    };

    const progress = ((step) / (STEP_CONFIG.length - 1)) * 100;

    return (
        <div className="min-h-svh bg-gradient-to-br from-ochre-50 via-white to-terracotta-50 font-quicksand flex flex-col items-center justify-center p-3 sm:p-4">
            {/* Progress bar — Gate FF.1: min-h-svh (dynamic viewport) + padding
                ridotto per iPhone SE. mb-6 mobile per lasciare piu' spazio al
                contenuto centrale (grid 2x4 interessi altrimenti scorre). */}
            <div className="w-full max-w-sm mb-6 sm:mb-8">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-gray-400 font-medium">
                        Passo {step + 1} di {STEP_CONFIG.length}
                    </span>
                    <span className="text-xs text-terracotta-500 font-bold">
                        {STEP_CONFIG[step]?.id !== 'ready' ? `${Math.round(progress)}%` : '✓'}
                    </span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <motion.div
                        className="h-full bg-gradient-to-r from-terracotta-400 to-terracotta-600 rounded-full"
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.4 }}
                    />
                </div>
            </div>

            {/* Card */}
            <div className="w-full max-w-sm overflow-hidden">
                <AnimatePresence mode="wait" custom={direction}>
                    <motion.div
                        key={step}
                        custom={direction}
                        variants={slideVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ duration: 0.3, ease: 'easeInOut' }}
                        className="bg-white rounded-3xl shadow-2xl p-6"
                    >
                        {/* Step 0: Benvenuto */}
                        {step === 0 && (
                            <div className="text-center">
                                <motion.div
                                    className="text-7xl mb-6 select-none"
                                    animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
                                    transition={{ duration: 3, repeat: Infinity }}
                                >
                                    🇮🇹
                                </motion.div>
                                <h1 className="text-2xl font-black text-gray-800 mb-2">
                                    {STEP_CONFIG[0].title}
                                </h1>
                                <p className="text-gray-500 text-sm mb-6">{STEP_CONFIG[0].subtitle}</p>
                                <div className="space-y-3 text-left mb-6">
                                    {/* Gate EE — Rimossa la card che prometteva "esperienze autentiche
                                        con persone del posto fuori dai circuiti turistici" (feature V2
                                        promessa come V1). Le due card restanti descrivono solo cio' che
                                        V1 fa davvero. */}
                                    {[
                                        { emoji: '🤖', title: 'Itinerari AI', desc: 'Su misura per te, in qualunque città scegli' },
                                        { emoji: '📍', title: 'Mappa vera', desc: 'Coordinate reali, marker nel punto giusto' },
                                    ].map((item, i) => (
                                        <motion.div
                                            key={i}
                                            className="flex items-start space-x-3 bg-gray-50 rounded-2xl p-3"
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: 0.2 + i * 0.1 }}
                                        >
                                            <span className="text-2xl">{item.emoji}</span>
                                            <div>
                                                <p className="font-bold text-sm text-gray-800">{item.title}</p>
                                                <p className="text-xs text-gray-500">{item.desc}</p>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Step 1: Interessi (città viene dal CityModal Gate AA post-onboarding) */}
                        {/* Gate FF.1 — grid 2x4 compressa per entrare in iPhone SE 375x667.
                            Padding card p-2.5, emoji text-xl, label/desc font-size ridotti.
                            Su viewport standard (>=sm) resta come prima. */}
                        {step === 1 && (
                            <div>
                                <div className="text-center mb-3 sm:mb-4">
                                    <Compass className="w-8 h-8 sm:w-10 sm:h-10 text-terracotta-500 mx-auto mb-1.5 sm:mb-2" />
                                    <h2 className="text-lg sm:text-xl font-black text-gray-800">{STEP_CONFIG[1]?.title}</h2>
                                    <p className="text-gray-500 text-xs mt-1">{STEP_CONFIG[1]?.subtitle}</p>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    {INTERESTS.map(interest => {
                                        const isSelected = selectedInterests.includes(interest.id);
                                        return (
                                            <motion.button
                                                key={interest.id}
                                                onClick={() => toggleInterest(interest.id)}
                                                className={`p-2 sm:p-3 rounded-xl sm:rounded-2xl text-left transition-all ${
                                                    isSelected
                                                        ? 'bg-terracotta-500 text-white shadow-lg shadow-terracotta-200'
                                                        : 'bg-gray-50 text-gray-700 hover:bg-terracotta-50'
                                                }`}
                                                whileTap={{ scale: 0.95 }}
                                            >
                                                <div className="text-xl sm:text-2xl mb-0.5 sm:mb-1">{interest.emoji}</div>
                                                <p className={`text-[11px] sm:text-xs font-bold leading-tight ${isSelected ? 'text-white' : 'text-gray-800'}`}>
                                                    {interest.label}
                                                </p>
                                                <p className={`text-[9px] sm:text-[10px] leading-tight ${isSelected ? 'text-white/80' : 'text-gray-400'}`}>
                                                    {interest.desc}
                                                </p>
                                            </motion.button>
                                        );
                                    })}
                                </div>
                                {selectedInterests.length === 0 && (
                                    <p className="text-center text-xs text-terracotta-400 mt-2 sm:mt-3">
                                        Seleziona almeno un interesse per continuare
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Step 3: Pronto */}
                        {step === 2 && (
                            <div className="text-center">
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                                    className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5"
                                >
                                    <CheckCircle className="w-10 h-10 text-green-500" />
                                </motion.div>
                                <h2 className="text-2xl font-black text-gray-800 mb-2">{STEP_CONFIG[2]?.title || 'Tutto pronto!'}</h2>
                                <p className="text-gray-500 text-sm mb-5">{STEP_CONFIG[2]?.subtitle || 'Inizia la tua avventura'}</p>

                                {/* Riepilogo scelte — Gate EE: solo interessi (scelti davvero
                                    dall'utente). RIMOSSO "Città: Roma" (era hardcoded, mostrare
                                    Roma qui era una bugia mascherata da riepilogo). La citta'
                                    la chiede il CityModal Gate AA subito dopo. */}
                                <div className="space-y-2 text-left mb-5">
                                    <div className="flex items-start space-x-2 bg-terracotta-50 rounded-xl p-3">
                                        <Sparkles className="w-4 h-4 text-terracotta-500 mt-0.5" />
                                        <div>
                                            <span className="text-sm font-bold text-gray-700">Interessi: </span>
                                            <span className="text-xs text-terracotta-600">
                                                {selectedInterests.map(id => INTERESTS.find(i => i.id === id)?.emoji).join(' ')}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Navigation buttons */}
            <div className="w-full max-w-sm mt-5 flex space-x-3">
                {step > 0 && step < STEP_CONFIG.length - 1 && (
                    <motion.button
                        onClick={goBack}
                        className="flex items-center space-x-1 px-4 py-3 rounded-2xl bg-white text-gray-500 font-bold shadow-sm hover:shadow-md transition-all"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.97 }}
                    >
                        <ArrowLeft className="w-4 h-4" />
                        <span className="text-sm">Indietro</span>
                    </motion.button>
                )}

                {step < STEP_CONFIG.length - 1 ? (
                    <motion.button
                        onClick={goNext}
                        disabled={!canProceed()}
                        className={`flex-1 flex items-center justify-center space-x-2 py-3 rounded-2xl font-bold shadow-lg transition-all ${
                            canProceed()
                                ? 'bg-terracotta-500 text-white hover:bg-terracotta-600 shadow-terracotta-200'
                                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        }`}
                        whileHover={canProceed() ? { scale: 1.02 } : {}}
                        whileTap={canProceed() ? { scale: 0.97 } : {}}
                    >
                        <span>{step === 0 ? 'Iniziamo!' : 'Continua'}</span>
                        <ArrowRight className="w-4 h-4" />
                    </motion.button>
                ) : (
                    <motion.button
                        onClick={handleComplete}
                        disabled={isSaving}
                        className="flex-1 flex items-center justify-center space-x-2 py-3 rounded-2xl bg-terracotta-500 text-white font-bold shadow-lg shadow-terracotta-200 hover:bg-terracotta-600 transition-all disabled:opacity-60"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.97 }}
                    >
                        {isSaving ? (
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <>
                                <span>Entra in DoveVAI</span>
                                <span>🚀</span>
                            </>
                        )}
                    </motion.button>
                )}
            </div>

            {/* Skip link */}
            {step < STEP_CONFIG.length - 1 && (
                <button
                    onClick={() => {
                        localStorage.setItem('dvai_onboarding_done', '1');
                        // Gate SEME (L1): "saltato" scrive seme VUOTO (non omette la
                        // chiave): "ho saltato" deve essere distinguibile da "non sono
                        // mai passato". Nessun seme di default (regola #1).
                        try { localStorage.setItem(ONBOARDING_SEED_KEY, '[]'); } catch { /* no-op */ }
                        navigate('/dashboard-user', { replace: true });
                    }}
                    className="mt-4 text-xs text-gray-400 hover:text-gray-600 transition-colors underline"
                >
                    Salta per ora
                </button>
            )}
        </div>
    );
}
