/**
 * DVAI-011 / Blocco Estetica — Onboarding Wizard
 * 3 step: Ingresso & Dichiarazione → Scelta Interessi → Passaggio alla strada
 *
 * Principi estetici:
 * - Voce: "Non è per tutti. È per te."
 * - Registro: Editoriale, diretto, da insider. Nessun tech-cosplay né cartoon.
 * - Stato selezioni: Dichiarativo, blocco inchiostrato ad alto contrasto.
 * - Step 3: Passaggio di consegne pulito che prepara il permesso posizione.
 *
 * Vincoli architetturali:
 * - La città NON si chiede qui (la chiede il CityModal al mount della dashboard).
 * - I semi generati da computeSeed(selectedInterests) restano intatti per il PreferenceEngine.
 * - Test contrattuali invariati (label interessi, button text).
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
    Compass,
    ArrowRight,
    ArrowLeft,
    UtensilsCrossed,
    Landmark,
    Trees,
    Moon,
    Footprints,
    Coffee,
    ShoppingBag,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

const INTERESTS = [
    { id: 'food',      icon: UtensilsCrossed, label: 'Mangiare e bere',      desc: 'Tavoli veri, banchi, cucina locale',   seeds: ['food'] },
    { id: 'cultura',   icon: Landmark,        label: 'Storia e arte',        desc: 'Pietre antiche, gallerie, memorie',     seeds: ['cultura', 'arte'] },
    { id: 'natura',    icon: Trees,           label: 'Natura e panorami',    desc: 'Verde, prospettive, orizzonti aperti',  seeds: ['natura'] },
    { id: 'nightlife', icon: Moon,            label: 'Vita notturna',        desc: 'Luci basse, banconi, dopo mezzanotte',  seeds: ['nightlife'] },
    { id: 'avventura', icon: Footprints,      label: 'Camminare e scoprire', desc: 'Passo lungo, angoli fuori rotta',      seeds: ['avventura'] },
    { id: 'relax',     icon: Coffee,          label: 'Ritmo lento',          desc: 'Pause senza fretta, angoli calmi',      seeds: ['relax'] },
    { id: 'shopping',  icon: ShoppingBag,     label: 'Shopping e mercati',   desc: 'Botteghe, pezzi unici, banchi rionali', seeds: ['shopping'] },
];

const ONBOARDING_SEED_KEY = 'unnivai_onboarding_seed_v1';

const computeSeed = (selectedIds) => {
    const flat = selectedIds.flatMap(id => INTERESTS.find(i => i.id === id)?.seeds || []);
    return [...new Set(flat)];
};

const slideVariants = {
    enter: (dir) => ({ x: dir > 0 ? 40 : -40, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit:  (dir) => ({ x: dir > 0 ? -40 : 40, opacity: 0 }),
};

export default function Onboarding() {
    const [step, setStep] = useState(0);
    const [direction, setDirection] = useState(1);
    const [selectedInterests, setSelectedInterests] = useState([]);
    const [isSaving, setIsSaving] = useState(false);

    const navigate = useNavigate();
    const { user } = useAuth();

    const goNext = () => {
        setDirection(1);
        setStep(s => Math.min(s + 1, 2));
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
        const seed = computeSeed(selectedInterests);
        try {
            if (user?.id) {
                await supabase.from('profiles').upsert({
                    id: user.id,
                    interests: seed,
                    onboarding_complete: true,
                    updated_at: new Date().toISOString(),
                }, { onConflict: 'id' });
            }
            localStorage.setItem('dvai_onboarding_done', '1');
        } catch (err) {
            console.warn('[Onboarding] save failed:', err.message);
        }
        try {
            localStorage.setItem(ONBOARDING_SEED_KEY, JSON.stringify(seed));
        } catch {
            /* quota handling */
        }
        setIsSaving(false);
        navigate('/dashboard-user', { replace: true });
    };

    const canProceed = () => {
        if (step === 1) return selectedInterests.length > 0;
        return true;
    };

    return (
        <div className="min-h-svh bg-[#FAF8F5] text-stone-900 flex flex-col justify-between items-center p-4 sm:p-6 font-quicksand selection:bg-stone-900 selection:text-white">
            {/* Minimal step indicator */}
            <header className="w-full max-w-sm pt-2 flex items-center justify-between">
                <span className="text-[11px] font-bold tracking-widest uppercase text-stone-400">
                    DoveVAI
                </span>
                <div className="flex items-center space-x-1.5" aria-label={`Passo ${step + 1} di 3`}>
                    {[0, 1, 2].map((i) => (
                        <span
                            key={i}
                            className={`h-1 rounded-full transition-all duration-300 ${
                                i === step
                                    ? 'w-6 bg-stone-900'
                                    : i < step
                                    ? 'w-2 bg-stone-400'
                                    : 'w-2 bg-stone-200'
                            }`}
                        />
                    ))}
                </div>
            </header>

            {/* Main Stage Card */}
            <main className="w-full max-w-sm my-auto py-4">
                <AnimatePresence mode="wait" custom={direction}>
                    <motion.div
                        key={step}
                        custom={direction}
                        variants={slideVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                        className="bg-white rounded-3xl border border-stone-200/80 shadow-[0_10px_30px_-15px_rgba(0,0,0,0.07)] p-6 sm:p-7"
                    >
                        {/* ─── STEP 0: Ingresso & Dichiarazione ─── */}
                        {step === 0 && (
                            <div className="text-left">
                                <div className="w-12 h-12 rounded-2xl bg-stone-900 text-stone-100 flex items-center justify-center mb-6 shadow-sm">
                                    <Compass className="w-6 h-6 stroke-[1.75]" />
                                </div>
                                <div className="space-y-2 mb-6">
                                    <span className="inline-block text-[11px] font-bold uppercase tracking-wider text-terracotta-500">
                                        Manifesto
                                    </span>
                                    <h1 className="text-2xl sm:text-[26px] font-black tracking-tight text-stone-950 leading-[1.15]">
                                        Non è per tutti.<br />È per te.
                                    </h1>
                                </div>
                                <p className="text-stone-600 text-sm leading-relaxed mb-6 font-medium">
                                    Cammina dove gli altri non guardano. Solo posti veri, nessun filtro da guida.
                                </p>
                                <div className="border-t border-stone-100 pt-4 flex items-center justify-between text-xs text-stone-400 font-medium">
                                    <span>Percorsi su misura</span>
                                    <span>•</span>
                                    <span>Luoghi reali</span>
                                    <span>•</span>
                                    <span>A piedi</span>
                                </div>
                            </div>
                        )}

                        {/* ─── STEP 1: Scelta Interessi ─── */}
                        {step === 1 && (
                            <div>
                                <div className="mb-4 text-left">
                                    <h2 className="text-xl sm:text-2xl font-black tracking-tight text-stone-950">
                                        Cosa ti appassiona?
                                    </h2>
                                    <p className="text-stone-500 text-xs mt-1 font-medium">
                                        Dichiara come ti muovi.
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[52vh] overflow-y-auto pr-0.5 scrollbar-hide">
                                    {INTERESTS.map(interest => {
                                        const isSelected = selectedInterests.includes(interest.id);
                                        const IconComponent = interest.icon;
                                        return (
                                            <motion.button
                                                key={interest.id}
                                                type="button"
                                                onClick={() => toggleInterest(interest.id)}
                                                className={`p-3 rounded-2xl text-left transition-all border ${
                                                    isSelected
                                                        ? 'bg-stone-900 text-white border-stone-900 shadow-md shadow-stone-900/10'
                                                        : 'bg-stone-50/80 text-stone-800 border-stone-200/80 hover:border-stone-300 hover:bg-stone-100/60'
                                                }`}
                                                whileTap={{ scale: 0.98 }}
                                            >
                                                <div className="flex items-center justify-between mb-1.5">
                                                    <IconComponent
                                                        className={`w-4 h-4 stroke-[2] ${
                                                            isSelected ? 'text-amber-400' : 'text-stone-600'
                                                        }`}
                                                    />
                                                    {isSelected && (
                                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                                    )}
                                                </div>
                                                <p className={`text-xs font-bold leading-tight ${isSelected ? 'text-white' : 'text-stone-900'}`}>
                                                    {interest.label}
                                                </p>
                                                <p className={`text-[10px] leading-tight mt-0.5 ${isSelected ? 'text-stone-300' : 'text-stone-500'}`}>
                                                    {interest.desc}
                                                </p>
                                            </motion.button>
                                        );
                                    })}
                                </div>

                                {selectedInterests.length === 0 && (
                                    <p className="text-center text-[11px] text-terracotta-500 font-semibold mt-3">
                                        Seleziona almeno un interesse per continuare
                                    </p>
                                )}
                            </div>
                        )}

                        {/* ─── STEP 2: Passaggio di Consegne ─── */}
                        {step === 2 && (
                            <div className="text-left py-2">
                                <div className="w-12 h-12 rounded-2xl bg-stone-100 text-stone-900 flex items-center justify-center mb-6">
                                    <Compass className="w-6 h-6 stroke-[1.75]" />
                                </div>
                                <div className="space-y-2 mb-4">
                                    <span className="inline-block text-[11px] font-bold uppercase tracking-wider text-terracotta-500">
                                        Inizio
                                    </span>
                                    <h2 className="text-2xl font-black tracking-tight text-stone-950">
                                        Ora tocca alla strada.
                                    </h2>
                                </div>
                                <p className="text-stone-600 text-sm leading-relaxed font-medium">
                                    Ci serve solo sapere dove sei. Il percorso parte da lì.
                                </p>
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>
            </main>

            {/* Bottom Actions */}
            <footer className="w-full max-w-sm pb-2 space-y-3">
                <div className="flex space-x-2.5">
                    {step > 0 && step < 2 && (
                        <button
                            type="button"
                            onClick={goBack}
                            className="flex items-center justify-center px-4 py-3.5 rounded-2xl bg-white border border-stone-200 text-stone-700 font-bold text-xs hover:bg-stone-50 transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4 mr-1 stroke-[2.2]" />
                            <span>Indietro</span>
                        </button>
                    )}

                    {step < 2 ? (
                        <button
                            type="button"
                            onClick={goNext}
                            disabled={!canProceed()}
                            className={`flex-1 flex items-center justify-center space-x-1.5 py-3.5 rounded-2xl font-bold text-xs transition-all ${
                                canProceed()
                                    ? 'bg-stone-900 text-white hover:bg-stone-800 shadow-md shadow-stone-900/10'
                                    : 'bg-stone-200 text-stone-400 cursor-not-allowed'
                            }`}
                        >
                            <span>{step === 0 ? 'Iniziamo!' : 'Continua'}</span>
                            <ArrowRight className="w-4 h-4 stroke-[2.2]" />
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={handleComplete}
                            disabled={isSaving}
                            className="flex-1 flex items-center justify-center space-x-1.5 py-3.5 rounded-2xl bg-stone-900 text-white font-bold text-xs hover:bg-stone-800 shadow-md shadow-stone-900/15 transition-all disabled:opacity-50"
                        >
                            {isSaving ? (
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <>
                                    <span>Entra in DoveVAI</span>
                                    <ArrowRight className="w-4 h-4 stroke-[2.2]" />
                                </>
                            )}
                        </button>
                    )}
                </div>

                {step < 2 && (
                    <div className="text-center">
                        <button
                            type="button"
                            onClick={() => {
                                localStorage.setItem('dvai_onboarding_done', '1');
                                try {
                                    localStorage.setItem(ONBOARDING_SEED_KEY, '[]');
                                } catch {
                                    /* no-op */
                                }
                                navigate('/dashboard-user', { replace: true });
                            }}
                            className="text-[11px] font-semibold text-stone-400 hover:text-stone-700 transition-colors"
                        >
                            Salta per ora
                        </button>
                    </div>
                )}
            </footer>
        </div>
    );
}
