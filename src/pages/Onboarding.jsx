/**
 * DVAI-011 / Blocco Estetica — Onboarding Wizard (Direzione A: Inchiostro & Ossidiana)
 * Full-screen immersivo, contrasto netto bianco/nero, zero radio button, bottoni in caso normale.
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
    ArrowRight,
    ArrowLeft,
    UtensilsCrossed,
    Landmark,
    Trees,
    Moon,
    Footprints,
    Coffee,
    ShoppingBag,
    AlertTriangle,
    RefreshCw,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { dataService } from '@/services/dataService';

const INTERESTS = [
    { id: 'food',      icon: UtensilsCrossed, label: 'Mangiare e bere',      seeds: ['food'] },
    { id: 'cultura',   icon: Landmark,        label: 'Storia e arte',        seeds: ['cultura', 'arte'] },
    { id: 'natura',    icon: Trees,           label: 'Natura e panorami',    seeds: ['natura'] },
    { id: 'nightlife', icon: Moon,            label: 'Vita notturna',        seeds: ['nightlife'] },
    { id: 'avventura', icon: Footprints,      label: 'Camminare e scoprire', seeds: ['avventura'] },
    { id: 'relax',     icon: Coffee,          label: 'Ritmo lento',          seeds: ['relax'] },
    { id: 'shopping',  icon: ShoppingBag,     label: 'Shopping e mercati',   seeds: ['shopping'] },
];

const ONBOARDING_SEED_KEY = 'unnivai_onboarding_seed_v1';

const computeSeed = (selectedIds) => {
    const flat = selectedIds.flatMap(id => INTERESTS.find(i => i.id === id)?.seeds || []);
    return [...new Set(flat)];
};

const slideVariants = {
    enter: (dir) => ({ x: dir > 0 ? 30 : -30, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit:  (dir) => ({ x: dir > 0 ? -30 : 30, opacity: 0 }),
};

// Gate SEME (L2): cache locale del seme. Best-effort DI PROPOSITO — la fonte
// di verita' e' user_preferences.onboarding_seed sul server. Se il localStorage
// e' pieno il seme e' gia' salvato dove conta, quindi un fallimento qui non
// deve bloccare l'utente ne' essere mostrato come errore.
const writeLocalSeedCache = (seed) => {
    try {
        localStorage.setItem(ONBOARDING_SEED_KEY, JSON.stringify(seed));
    } catch {
        /* quota: il server ha gia' il dato, la cache si ricostruisce al prossimo mount */
    }
};

export default function Onboarding() {
    const [step, setStep] = useState(0);
    const [direction, setDirection] = useState(1);
    const [selectedInterests, setSelectedInterests] = useState([]);
    const [isSaving, setIsSaving] = useState(false);
    // Gate SEME (L2): un fallimento di salvataggio del seme NON e' piu' un
    // console.warn. Vive qui e viene renderizzato: l'utente lo vede e riprova.
    const [saveError, setSaveError] = useState(null);
    // Ricordiamo quale seme stava salvando, cosi' "Riprova" ritenta ESATTAMENTE
    // quello (vale anche per lo skip, che salva []): senza, il retry dopo uno
    // skip fallito ripartirebbe dagli interessi selezionati, cioe' salverebbe
    // una cosa diversa da quella che l'utente aveva chiesto.
    const [pendingSeed, setPendingSeed] = useState(null);

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

    /**
     * Gate SEME (L2) — unico punto di salvataggio del seme, per TUTTE le uscite
     * dall'onboarding (conferma con gusti scelti e "Salta per ora" con []).
     *
     * PRIMA scriveva su profiles.interests / profiles.onboarding_complete:
     * colonne che non sono mai esistite. L'upsert falliva SEMPRE, l'errore
     * finiva in un console.warn, e si navigava lo stesso al dashboard. Il seme
     * sopravviveva solo nel localStorage di quel device, e AuthContext lo
     * cancella al logout: quello che l'utente dichiarava moriva al primo
     * logout e non e' mai esistito su un secondo device.
     *
     * Ora: il server e' la fonte di verita' (user_preferences.onboarding_seed),
     * il localStorage e' solo cache, e un fallimento BLOCCA. Niente navigate,
     * niente 'dvai_onboarding_done' — segnare "onboarding fatto" dopo un
     * salvataggio fallito sarebbe la stessa bugia di prima, spostata di una
     * riga.
     */
    const persistSeed = async (seed) => {
        setIsSaving(true);
        setSaveError(null);
        setPendingSeed(seed);

        // Utente non autenticato. Puo' succedere: /onboarding e' una route
        // PUBBLICA (App.jsx:130, fuori da RoleGuard), quindi raggiungibile per
        // URL diretto senza sessione — il RootDispatcher ci manda solo utenti
        // loggati, ma non e' l'unica porta. Qui non c'e' nessuna riga da
        // scrivere e le RLS di user_preferences (auth.uid() = user_id)
        // rifiuterebbero comunque la scrittura. Bloccare con "Riprova"
        // intrappolerebbe l'utente per sempre: nessun numero di tentativi crea
        // una sessione. Si salva la sola cache locale e si prosegue —
        // RoleGuard su /dashboard-user lo mandera' a /login, e al primo login
        // vero il seme locale e' ancora li' per essere sincronizzato.
        if (!user?.id) {
            writeLocalSeedCache(seed);
            localStorage.setItem('dvai_onboarding_done', '1');
            setIsSaving(false);
            navigate('/dashboard-user', { replace: true });
            return;
        }

        const result = await dataService.upsertOnboardingSeed(user.id, seed);

        if (!result?.success) {
            // L'errore diventa visibile. Nessun navigate, nessun flag "fatto".
            setSaveError(result?.error || 'Errore sconosciuto');
            setIsSaving(false);
            return;
        }

        writeLocalSeedCache(seed);
        localStorage.setItem('dvai_onboarding_done', '1');
        setIsSaving(false);
        navigate('/dashboard-user', { replace: true });
    };

    const handleComplete = () => persistSeed(computeSeed(selectedInterests));

    // "Salta per ora" passa dallo STESSO meccanismo e scrive [] sul server.
    // Uno skip esplicito e' un dato dell'utente quanto una scelta di gusti
    // ("ho deciso di non dichiarare nulla"): se restasse locale morirebbe al
    // logout esattamente come il bug che stiamo chiudendo, e su un secondo
    // device l'utente si vedrebbe richiedere l'onboarding all'infinito. Il
    // server distingue NULL (mai fatto) da [] (fatto, saltato) proprio per
    // questo.
    const handleSkip = () => persistSeed([]);

    const retry = () => { if (pendingSeed) persistSeed(pendingSeed); };

    const canProceed = () => {
        if (step === 1) return selectedInterests.length > 0;
        return true;
    };

    return (
        <div className="min-h-svh w-full bg-obsidian-bg text-obsidian-primary flex flex-col justify-between p-6 sm:p-8 font-quicksand relative overflow-hidden selection:bg-brand-orange selection:text-obsidian-bg">
            {/* Header: Brand & Minimal Step indicator */}
            <header className="w-full max-w-md mx-auto pt-2 flex items-center justify-between z-10">
                <span className="text-xs font-black tracking-widest uppercase text-obsidian-secondary">
                    DoveVAI
                </span>
                <div className="flex items-center space-x-2" aria-label={`Passo ${step + 1} di 3`}>
                    {[0, 1, 2].map((i) => (
                        <span
                            key={i}
                            className={`h-1 rounded-full transition-all duration-300 ${
                                i === step
                                    ? 'w-8 bg-brand-orange'
                                    : i < step
                                    ? 'w-2 bg-obsidian-secondary'
                                    : 'w-2 bg-obsidian-raised'
                            }`}
                        />
                    ))}
                </div>
            </header>

            {/* Main Stage (equilibrato verticalmente) */}
            <main className="w-full max-w-md mx-auto my-auto py-6 z-10">
                <AnimatePresence mode="wait" custom={direction}>
                    <motion.div
                        key={step}
                        custom={direction}
                        variants={slideVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                        className="w-full"
                    >
                        {/* ─── STEP 0: Il Manifesto ─── */}
                        {step === 0 && (
                            <div className="space-y-5">
                                <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-obsidian-primary leading-[1.08]">
                                    Non è per tutti.<br />
                                    È per te.
                                </h1>
                                <p className="text-obsidian-secondary text-base sm:text-lg leading-relaxed font-medium max-w-sm pt-1">
                                    Percorsi a piedi sui luoghi che gli altri superano. Solo posti veri, nessun filtro da guida.
                                </p>
                            </div>
                        )}

                        {/* ─── STEP 1: Come ti muovi? ─── */}
                        {step === 1 && (
                            <div className="space-y-4">
                                <div>
                                    <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-obsidian-primary">
                                        Come ti muovi?
                                    </h2>
                                    <p className="text-obsidian-secondary text-xs sm:text-sm mt-1 font-medium">
                                        Dichiara cosa cercare.
                                    </p>
                                </div>

                                <div className="space-y-2.5 max-h-[54vh] overflow-y-auto pr-1 scrollbar-hide pt-1">
                                    {INTERESTS.map(interest => {
                                        const isSelected = selectedInterests.includes(interest.id);
                                        const IconComponent = interest.icon;
                                        return (
                                            <motion.button
                                                key={interest.id}
                                                type="button"
                                                onClick={() => toggleInterest(interest.id)}
                                                className={`w-full p-4 rounded-2xl flex items-center transition-all border text-left ${
                                                    isSelected
                                                        ? 'bg-ivory-bg border-ivory-bg text-ivory-text font-black shadow-md'
                                                        : 'bg-obsidian-card border-obsidian-border text-obsidian-primary font-bold hover:bg-obsidian-raised'
                                                }`}
                                                whileTap={{ scale: 0.98 }}
                                            >
                                                <div className="flex items-center space-x-3.5">
                                                    <div className={`p-2 rounded-xl transition-colors ${
                                                        isSelected ? 'bg-ivory-badge' : 'bg-obsidian-raised'
                                                    }`}>
                                                        <IconComponent className={`w-4 h-4 stroke-[2.4] ${
                                                            isSelected ? 'text-ivory-icon' : 'text-brand-orange'
                                                        }`} />
                                                    </div>
                                                    <span className="text-sm tracking-tight">
                                                        {interest.label}
                                                    </span>
                                                </div>
                                            </motion.button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* ─── STEP 2: Passaggio alla Strada ─── */}
                        {step === 2 && (
                            <div className="space-y-5">
                                <h2 className="text-4xl sm:text-5xl font-black tracking-tight text-obsidian-primary leading-[1.08]">
                                    Ora tocca<br />alla strada.
                                </h2>
                                <p className="text-obsidian-secondary text-base sm:text-lg leading-relaxed font-medium max-w-sm pt-1">
                                    Ci serve solo sapere dove sei. Il percorso parte da lì.
                                </p>
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>
            </main>

            {/* Bottom Navigation Actions */}
            <footer className="w-full max-w-md mx-auto pb-4 space-y-4 z-10">
                {/* Gate SEME (L2): il fallimento di salvataggio e' VISIBILE.
                    Finche' questo blocco e' a schermo l'utente non e' passato al
                    dashboard e nulla e' stato marcato come fatto. */}
                {saveError && (
                    <div
                        role="alert"
                        className="rounded-2xl bg-obsidian-card border border-status-error/40 p-4 space-y-3"
                    >
                        <div className="flex items-start space-x-2.5">
                            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 stroke-[2.4] text-status-error" />
                            <div className="space-y-1">
                                <p className="text-sm font-black tracking-tight text-obsidian-primary">
                                    Non siamo riusciti a salvare le tue scelte.
                                </p>
                                <p className="text-xs font-medium leading-relaxed text-obsidian-secondary">
                                    Non le abbiamo perse, ma non sono ancora al sicuro: senza salvarle
                                    andrebbero via al prossimo accesso. Controlla la connessione e riprova.
                                </p>
                                <p className="text-[11px] font-mono text-obsidian-secondary/70 break-words pt-0.5">
                                    {saveError}
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={retry}
                            disabled={isSaving}
                            className="w-full flex items-center justify-center space-x-2 py-3 rounded-xl bg-brand-orange text-obsidian-bg font-black text-sm hover:bg-brand-orange-hover transition-all disabled:opacity-50 active:scale-98"
                        >
                            {isSaving ? (
                                <div className="w-4 h-4 border-2 border-obsidian-bg border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <>
                                    <RefreshCw className="w-4 h-4 stroke-[2.5]" />
                                    <span>Riprova</span>
                                </>
                            )}
                        </button>
                    </div>
                )}

                <div className="flex space-x-3">
                    {step > 0 && step < 2 && (
                        <button
                            type="button"
                            onClick={goBack}
                            className="flex items-center justify-center px-5 py-4 rounded-2xl bg-obsidian-card border border-obsidian-border text-obsidian-primary font-bold text-sm hover:bg-obsidian-raised transition-colors active:scale-98"
                        >
                            <ArrowLeft className="w-4 h-4 mr-1.5 stroke-[2.2]" />
                            <span>Indietro</span>
                        </button>
                    )}

                    {step < 2 ? (
                        <button
                            type="button"
                            onClick={goNext}
                            disabled={!canProceed()}
                            className={`flex-1 flex items-center justify-center space-x-2 py-4 rounded-2xl font-black text-sm transition-all active:scale-98 ${
                                canProceed()
                                    ? 'bg-brand-orange text-obsidian-bg hover:bg-brand-orange-hover'
                                    : 'bg-obsidian-raised border border-obsidian-border text-obsidian-secondary cursor-not-allowed'
                            }`}
                        >
                            <span>{step === 0 ? 'Iniziamo!' : 'Continua'}</span>
                            <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={handleComplete}
                            disabled={isSaving}
                            className="flex-1 flex items-center justify-center space-x-2 py-4 rounded-2xl bg-brand-orange text-obsidian-bg font-black text-sm hover:bg-brand-orange-hover transition-all disabled:opacity-50 active:scale-98"
                        >
                            {isSaving ? (
                                <div className="w-4 h-4 border-2 border-obsidian-bg border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <>
                                    <span>Entra in DoveVAI</span>
                                    <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                                </>
                            )}
                        </button>
                    )}
                </div>

                {step < 2 && (
                    <div className="text-center">
                        <button
                            type="button"
                            onClick={handleSkip}
                            disabled={isSaving}
                            className="text-xs font-bold text-obsidian-secondary hover:text-obsidian-primary transition-colors py-1 disabled:opacity-50"
                        >
                            Salta per ora
                        </button>
                    </div>
                )}
            </footer>
        </div>
    );
}
