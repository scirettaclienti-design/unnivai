/**
 * DVAI-011 — Onboarding Wizard post-registrazione
 * 4 step: benvenuto → città → interessi → tutorial
 * Al termine: salva preferenze nel profilo Supabase e reindirizza alla dashboard.
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { MapPin, Compass, Sparkles, CheckCircle, ArrowRight, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useCity } from '@/context/CityContext';
import { supabase } from '@/lib/supabase';

const ITALIAN_CITIES = [
    'Roma', 'Milano', 'Napoli', 'Firenze', 'Venezia',
    'Bologna', 'Torino', 'Palermo', 'Bari', 'Genova',
    'Catania', 'Verona', 'Padova', 'Trieste', 'Trento',
    'Lecce', 'Siena', 'Modena', 'Parma', 'Perugia',
];

const INTERESTS = [
    { id: 'food',      emoji: '🍝', label: 'Gastronomia',   desc: 'Ristoranti, mercati, corsi di cucina' },
    { id: 'culture',   emoji: '🏛️', label: 'Cultura',        desc: 'Musei, storia, arte locale' },
    { id: 'adventure', emoji: '🧗', label: 'Avventura',      desc: 'Trekking, escursioni, sport' },
    { id: 'romantic',  emoji: '💑', label: 'Romantico',      desc: 'Coppie, tramonti, esperienze intime' },
    { id: 'art',       emoji: '🎨', label: 'Arte & Design',  desc: 'Gallerie, street art, artigianato' },
    { id: 'nature',    emoji: '🌿', label: 'Natura',         desc: 'Parchi, giardini, panorami' },
    { id: 'nightlife', emoji: '🌙', label: 'Vita notturna',  desc: 'Aperitivo, bar, eventi serali' },
    { id: 'shopping',  emoji: '🛍️', label: 'Shopping',       desc: 'Boutique, artigianato, mercatini' },
];

const STEP_CONFIG = [
    { id: 'welcome',   title: 'Benvenuto su DoveVAI',   subtitle: 'Il turismo italiano, reinventato' },
    { id: 'city',      title: 'Dove ti trovi?',          subtitle: 'Scegli la tua città di partenza' },
    { id: 'interests', title: 'Cosa ti appassiona?',     subtitle: 'Seleziona almeno un interesse' },
    { id: 'ready',     title: 'Tutto pronto!',            subtitle: 'Inizia la tua avventura italiana' },
];

const slideVariants = {
    enter: (dir) => ({ x: dir > 0 ? 300 : -300, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit:  (dir) => ({ x: dir > 0 ? -300 : 300, opacity: 0 }),
};

export default function Onboarding() {
    const [step, setStep] = useState(0);
    const [direction, setDirection] = useState(1);
    const [selectedCity, setSelectedCity] = useState('Roma');
    const [selectedInterests, setSelectedInterests] = useState([]);
    const [isSaving, setIsSaving] = useState(false);

    const navigate = useNavigate();
    const { user } = useAuth();
    const { setCity } = useCity();

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
        try {
            // Aggiorna CityContext immediatamente
            setCity(selectedCity);

            // Salva preferenze su Supabase profiles
            if (user?.id) {
                await supabase.from('profiles').upsert({
                    id: user.id,
                    current_city: selectedCity,
                    interests: selectedInterests,
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
        setIsSaving(false);
        navigate('/dashboard-user', { replace: true });
    };

    const canProceed = () => {
        if (step === 2) return selectedInterests.length > 0;
        return true;
    };

    const progress = ((step) / (STEP_CONFIG.length - 1)) * 100;

    return (
        <div className="min-h-screen bg-gradient-to-br from-ochre-50 via-white to-terracotta-50 font-quicksand flex flex-col items-center justify-center p-4">
            {/* Progress bar */}
            <div className="w-full max-w-sm mb-8">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-gray-400 font-medium">
                        Passo {step + 1} di {STEP_CONFIG.length}
                    </span>
                    <span className="text-xs text-terracotta-500 font-bold">
                        {STEP_CONFIG[step].id !== 'ready' ? `${Math.round(progress)}%` : '✓'}
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
                                    {[
                                        { emoji: '🗺️', title: 'Tour con guide locali', desc: 'Esperienze autentiche fuori dai circuiti turistici' },
                                        { emoji: '🤖', title: 'Itinerari AI', desc: 'Personalizzati in base ai tuoi interessi' },
                                        { emoji: '📍', title: 'Mappa interattiva', desc: 'Naviga le città italiane in tempo reale' },
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

                        {/* Step 1: Città */}
                        {step === 1 && (
                            <div>
                                <div className="text-center mb-5">
                                    <MapPin className="w-10 h-10 text-terracotta-500 mx-auto mb-2" />
                                    <h2 className="text-xl font-black text-gray-800">{STEP_CONFIG[1].title}</h2>
                                    <p className="text-gray-500 text-xs mt-1">{STEP_CONFIG[1].subtitle}</p>
                                </div>
                                <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                                    {ITALIAN_CITIES.map(city => (
                                        <motion.button
                                            key={city}
                                            onClick={() => setSelectedCity(city)}
                                            className={`px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${
                                                selectedCity === city
                                                    ? 'bg-terracotta-500 text-white shadow-lg shadow-terracotta-200'
                                                    : 'bg-gray-50 text-gray-600 hover:bg-terracotta-50 hover:text-terracotta-600'
                                            }`}
                                            whileTap={{ scale: 0.95 }}
                                        >
                                            {city}
                                        </motion.button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Step 2: Interessi */}
                        {step === 2 && (
                            <div>
                                <div className="text-center mb-4">
                                    <Compass className="w-10 h-10 text-terracotta-500 mx-auto mb-2" />
                                    <h2 className="text-xl font-black text-gray-800">{STEP_CONFIG[2].title}</h2>
                                    <p className="text-gray-500 text-xs mt-1">{STEP_CONFIG[2].subtitle}</p>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    {INTERESTS.map(interest => {
                                        const isSelected = selectedInterests.includes(interest.id);
                                        return (
                                            <motion.button
                                                key={interest.id}
                                                onClick={() => toggleInterest(interest.id)}
                                                className={`p-3 rounded-2xl text-left transition-all ${
                                                    isSelected
                                                        ? 'bg-terracotta-500 text-white shadow-lg shadow-terracotta-200'
                                                        : 'bg-gray-50 text-gray-700 hover:bg-terracotta-50'
                                                }`}
                                                whileTap={{ scale: 0.95 }}
                                            >
                                                <div className="text-2xl mb-1">{interest.emoji}</div>
                                                <p className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-gray-800'}`}>
                                                    {interest.label}
                                                </p>
                                                <p className={`text-[10px] ${isSelected ? 'text-white/80' : 'text-gray-400'}`}>
                                                    {interest.desc}
                                                </p>
                                            </motion.button>
                                        );
                                    })}
                                </div>
                                {selectedInterests.length === 0 && (
                                    <p className="text-center text-xs text-terracotta-400 mt-3">
                                        Seleziona almeno un interesse per continuare
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Step 3: Pronto */}
                        {step === 3 && (
                            <div className="text-center">
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                                    className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5"
                                >
                                    <CheckCircle className="w-10 h-10 text-green-500" />
                                </motion.div>
                                <h2 className="text-2xl font-black text-gray-800 mb-2">{STEP_CONFIG[3].title}</h2>
                                <p className="text-gray-500 text-sm mb-5">{STEP_CONFIG[3].subtitle}</p>

                                {/* Riepilogo scelte */}
                                <div className="space-y-2 text-left mb-5">
                                    <div className="flex items-center space-x-2 bg-terracotta-50 rounded-xl p-3">
                                        <MapPin className="w-4 h-4 text-terracotta-500" />
                                        <span className="text-sm font-bold text-gray-700">Città: <span className="text-terracotta-600">{selectedCity}</span></span>
                                    </div>
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
