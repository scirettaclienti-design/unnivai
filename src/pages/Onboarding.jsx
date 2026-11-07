/**
 * ONBOARDING-ACCESSO — il PRIMO INGRESSO, una volta per account: il consenso ai servizi AI (se manca), poi tre domande
 * brevi e saltabili — interessi, a tavola, come giri (passo e compagnia). È quello che il DNA già usa: interessi nel seme,
 * dieta/budget/stile come vincoli e gusti, passo e compagnia come PUNTO DI PARTENZA (`ritmo_iniziale`,
 * `compagnia_iniziale`: poi decidono i giri e le scelte vere). Tutto si cambia dal Profilo.
 *
 * «Fatto» sta sul server due volte: il seme in user_preferences.onboarding_seed (ONB-1, [] = saltato) e il segno
 * `primo_ingresso_fatto_at` nei metadati dell'account (lib/onboardingStatus.js). Così non ricompare cambiando telefono o
 * reinstallando; un ospite che crea l'account tiene lo stesso id, quindi risposte e giro di prova restano.
 *
 * Gate SEME (L2): un salvataggio fallito BLOCCA con «Riprova» (mai un «fatto» falso).
 */
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowLeft, AlertTriangle, RefreshCw } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { dataService } from '@/services/dataService';
import { buildSeed, DIETE, STILI, RITMI_PROFILO, COMPAGNIE_PROFILO } from '@/lib/foodPrefs';
import { INTERESTS, computeSeed } from '@/lib/interests';
import { markOnboardingDone, segnaPrimoIngressoSulServer } from '@/lib/onboardingStatus';
import { useOnboardingStatus } from '@/hooks/useOnboardingStatus';
import { haConsensoAi, daiConsensoAi, rimandaConsensoAi } from '@/lib/consensoAi';
import { CONSENSO_AI, PRIMO_INGRESSO as T } from '@/lib/testiAccount';
import { LogoUnnivai, FondoMarchio, EtichettaPasso } from '@/components/marchio/Marchio';

const ONBOARDING_SEED_KEY = 'unnivai_onboarding_seed_v1';
const BUDGET = [
    { id: '€', label: '€', hint: 'Poco' },
    { id: '€€', label: '€€', hint: 'Il giusto' },
    { id: '€€€', label: '€€€', hint: 'Un\'occasione' },
];

const slide = {
    enter: (dir) => ({ x: dir > 0 ? 24 : -24, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir) => ({ x: dir > 0 ? -24 : 24, opacity: 0 }),
};

// Gate SEME (L2): cache locale del seme, best-effort: la fonte è il server.
const writeLocalSeedCache = (seed) => {
    try { localStorage.setItem(ONBOARDING_SEED_KEY, JSON.stringify(seed)); } catch { /* quota: il server ha già il dato */ }
};

/** Una scelta a pillola (multipla o singola): ≥ 44 px, stato con aria-pressed. */
function Pillola({ selected, onClick, children, icon: Icona, className = '' }) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={selected}
            className={`min-h-[48px] px-4 rounded-2xl border text-left text-[15px] font-corpo font-semibold transition-colors flex items-center gap-2.5 cursor-pointer ${
                selected
                    ? 'bg-brand-orange/15 border-brand-orange text-obsidian-primary'
                    : 'bg-obsidian-card/80 border-obsidian-border text-obsidian-primary hover:bg-obsidian-raised'
            } ${className}`}
        >
            {Icona && <Icona className={`w-4 h-4 shrink-0 stroke-[2.2] ${selected ? 'text-brand-orange' : 'text-obsidian-secondary'}`} aria-hidden="true" />}
            <span>{children}</span>
        </button>
    );
}

const Domanda = ({ children }) => <p className="font-etichetta text-[11px] tracking-[0.18em] uppercase text-obsidian-secondary mb-2">{children}</p>;

export default function Onboarding() {
    const navigate = useNavigate();
    const { user } = useAuth();
    // Il consenso è il primo passo solo se manca (deciso all'apertura: dopo il «Va bene» il passo resta nell'elenco).
    const [conConsenso] = useState(() => !haConsensoAi(user));
    const passi = conConsenso ? ['consenso', 'interessi', 'tavola', 'giro'] : ['interessi', 'tavola', 'giro'];
    const [indice, setIndice] = useState(0);
    const [dir, setDir] = useState(1);
    const [interessi, setInteressi] = useState([]);
    const [dieta, setDieta] = useState([]);
    const [budget, setBudget] = useState(null);
    const [stile, setStile] = useState(null);
    const [ritmo, setRitmo] = useState(null);
    const [compagnia, setCompagnia] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState(null);
    // «Riprova» ritenta ESATTAMENTE il seme che stava salvando (anche lo skip, che salva []).
    const [pendingSeed, setPendingSeed] = useState(null);
    const uscito = useRef(false);
    const passo = passi[indice];
    const ultimo = indice === passi.length - 1;

    // ONB-1: una volta per account. Chi l'ha già fatto (DB o metadati dell'account) e arriva qui per URL torna a '/'.
    const stato = useOnboardingStatus(user?.id, user?.user_metadata);
    useEffect(() => {
        if (stato === 'done' && !isSaving && !uscito.current) navigate('/', { replace: true });
    }, [stato, isSaving, navigate]);

    const vai = (d) => {
        setDir(d);
        setIndice((i) => Math.min(Math.max(i + d, 0), passi.length - 1));
        try { document.documentElement.scrollTop = 0; document.body.scrollTop = 0; } catch { /* niente pagina */ }
    };

    const persistSeed = async (seed) => {
        setIsSaving(true);
        setSaveError(null);
        setPendingSeed(seed);
        // /onboarding è pubblica: senza sessione si salva la sola cache e si prosegue (RoleGuard porta al login).
        if (!user?.id) {
            writeLocalSeedCache(seed);
            try { localStorage.setItem('dvai_onboarding_done', '1'); } catch { /* storage ko */ }
            uscito.current = true;
            setIsSaving(false);
            navigate('/dashboard-user', { replace: true });
            return;
        }
        const result = await dataService.upsertOnboardingSeed(user.id, seed);
        if (!result?.success) {
            setSaveError(result?.error || 'Errore sconosciuto');
            setIsSaving(false);
            return;
        }
        writeLocalSeedCache(seed);
        markOnboardingDone(user.id);
        await segnaPrimoIngressoSulServer(); // il segno sull'account: best-effort, il seme dice già «fatto»
        uscito.current = true;
        setIsSaving(false);
        navigate('/dashboard-user', { replace: true });
    };

    const completa = () => persistSeed(buildSeed({
        interessi: computeSeed(interessi), dieta, budget, stile, ritmoIniziale: ritmo, compagniaIniziale: compagnia,
    }));
    // «Salta per ora»: [] sul server = fatto, senza gusti dichiarati (ONB-1).
    const saltaTutto = () => persistSeed([]);
    const retry = () => { if (pendingSeed) persistSeed(pendingSeed); };

    const avanti = () => (ultimo ? completa() : vai(1));
    const saltaDomanda = () => {
        if (passo === 'interessi') setInteressi([]);
        if (passo === 'tavola') { setDieta([]); setBudget(null); setStile(null); }
        if (passo === 'giro') { setRitmo(null); setCompagnia(null); }
        if (ultimo) persistSeed(buildSeed({ interessi: computeSeed(interessi), dieta, budget, stile }));
        else vai(1);
    };

    const consensoOk = async () => { await daiConsensoAi(user); vai(1); };
    const consensoDopo = () => { rimandaConsensoAi(); vai(1); };

    const toggle = (lista, set, id) => set(lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id]);
    const numero = indice + 1;

    return (
        <div className="min-h-svh w-full bg-obsidian-bg text-obsidian-primary font-corpo relative overflow-x-clip flex flex-col" data-testid="primo-ingresso" data-passo={passo}>
            <FondoMarchio vivo />
            <header className="relative z-10 w-full max-w-md mx-auto px-6 pt-6 flex items-center justify-between gap-3">
                <LogoUnnivai className="h-7 w-auto" animato />
                <div className="flex items-center gap-1.5" aria-label={`Passo ${numero} di ${passi.length}`}>
                    {passi.map((p, i) => (
                        <span key={p} className={`h-1 rounded-full transition-all duration-300 ${i === indice ? 'w-7 bg-brand-orange' : i < indice ? 'w-2 bg-obsidian-secondary' : 'w-2 bg-obsidian-border-elevated'}`} />
                    ))}
                </div>
            </header>

            <main className="relative z-10 w-full max-w-md mx-auto px-6 pt-8 pb-4 flex-1">
                <AnimatePresence mode="wait" custom={dir}>
                    <motion.div key={passo} custom={dir} variants={slide} initial="enter" animate="center" exit="exit" transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}>
                        {passo === 'consenso' && (
                            <section data-testid="consenso-ai" aria-labelledby="consenso-titolo">
                                <EtichettaPasso numero={numero} testo={T.PASSI.consenso} />
                                <h1 id="consenso-titolo" className="font-marchio font-extrabold text-[30px] leading-[1.05] tracking-tight mt-3">{CONSENSO_AI.TITOLO}</h1>
                                <p className="mt-3 text-[15px] text-obsidian-secondary leading-relaxed">{CONSENSO_AI.INTRO}</p>
                                <ul className="mt-5 space-y-3">
                                    {CONSENSO_AI.SERVIZI.map((s) => (
                                        <li key={s.nome} className="rounded-2xl border border-obsidian-border bg-obsidian-card/80 px-4 py-3">
                                            <p className="text-sm font-semibold text-obsidian-primary">{s.nome}</p>
                                            <p className="mt-1 text-[13px] text-obsidian-secondary leading-relaxed">{s.ricevono}</p>
                                        </li>
                                    ))}
                                </ul>
                                <p className="mt-3 text-[13px] text-obsidian-secondary leading-relaxed">{CONSENSO_AI.NON_RICEVONO}</p>
                                <a href="/privacy" className="mt-2 inline-block text-sm font-semibold text-brand-orange underline underline-offset-4 min-h-[44px] leading-[44px]" data-testid="consenso-ai-privacy">{CONSENSO_AI.PRIVACY_LINK}</a>
                            </section>
                        )}

                        {passo === 'interessi' && (
                            <section>
                                <EtichettaPasso numero={numero} testo={T.PASSI.interessi} />
                                <h1 className="font-marchio font-extrabold text-[32px] leading-[1.05] tracking-tight mt-3">{T.INTERESSI_TITOLO}</h1>
                                <p className="mt-2 text-[15px] text-obsidian-secondary leading-relaxed">{T.INTERESSI_SOTTO}</p>
                                <div className="mt-5 grid grid-cols-1 gap-2.5">
                                    {INTERESTS.map((it) => (
                                        <Pillola key={it.id} icon={it.icon} selected={interessi.includes(it.id)} onClick={() => toggle(interessi, setInteressi, it.id)}>{it.label}</Pillola>
                                    ))}
                                </div>
                            </section>
                        )}

                        {passo === 'tavola' && (
                            <section>
                                <EtichettaPasso numero={numero} testo={T.PASSI.tavola} />
                                <h1 className="font-marchio font-extrabold text-[32px] leading-[1.05] tracking-tight mt-3">{T.TAVOLA_TITOLO}</h1>
                                <div className="mt-5">
                                    <Domanda>{T.DIETA}</Domanda>
                                    <div className="flex flex-wrap gap-2">
                                        <Pillola selected={dieta.length === 0} onClick={() => setDieta([])}>{T.NESSUNA}</Pillola>
                                        {Object.entries(DIETE).map(([id, d]) => (
                                            <Pillola key={id} selected={dieta.includes(id)} onClick={() => toggle(dieta, setDieta, id)}>{d.label}</Pillola>
                                        ))}
                                    </div>
                                </div>
                                <div className="mt-5">
                                    <Domanda>{T.BUDGET}</Domanda>
                                    <div className="grid grid-cols-3 gap-2">
                                        {BUDGET.map((b) => (
                                            <Pillola key={b.id} selected={budget === b.id} onClick={() => setBudget(budget === b.id ? null : b.id)} className="justify-center flex-col !gap-0 py-2 text-center">
                                                <span className="block">{b.label}</span>
                                                <span className="block text-[11px] font-normal text-obsidian-secondary">{b.hint}</span>
                                            </Pillola>
                                        ))}
                                    </div>
                                </div>
                                <div className="mt-5">
                                    <Domanda>{T.STILE}</Domanda>
                                    <div className="flex flex-wrap gap-2">
                                        {Object.entries(STILI).map(([id, st]) => (
                                            <Pillola key={id} selected={stile === id} onClick={() => setStile(stile === id ? null : id)}>{st.label}</Pillola>
                                        ))}
                                    </div>
                                </div>
                            </section>
                        )}

                        {passo === 'giro' && (
                            <section>
                                <EtichettaPasso numero={numero} testo={T.PASSI.giro} />
                                <h1 className="font-marchio font-extrabold text-[32px] leading-[1.05] tracking-tight mt-3">{T.GIRO_TITOLO}</h1>
                                <div className="mt-5">
                                    <Domanda>{T.RITMO}</Domanda>
                                    <div className="grid grid-cols-3 gap-2">
                                        {Object.entries(RITMI_PROFILO).map(([id, label]) => (
                                            <Pillola key={id} selected={ritmo === id} onClick={() => setRitmo(ritmo === id ? null : id)} className="justify-center">{label}</Pillola>
                                        ))}
                                    </div>
                                </div>
                                <div className="mt-5">
                                    <Domanda>{T.COMPAGNIA}</Domanda>
                                    <div className="grid grid-cols-2 gap-2">
                                        {Object.entries(COMPAGNIE_PROFILO).map(([id, label]) => (
                                            <Pillola key={id} selected={compagnia === id} onClick={() => setCompagnia(compagnia === id ? null : id)} className="justify-center">{label}</Pillola>
                                        ))}
                                    </div>
                                </div>
                                <p className="mt-5 text-[13px] text-obsidian-secondary">{T.NOTA}</p>
                            </section>
                        )}
                    </motion.div>
                </AnimatePresence>
            </main>

            {/* I tasti restano in vista anche quando il passo è più lungo dello schermo (il consenso su un iPhone 14). */}
            <footer className="sticky bottom-0 z-10 w-full max-w-md mx-auto px-6 pt-6 space-y-3 bg-gradient-to-t from-obsidian-bg via-obsidian-bg/95 to-transparent" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}>
                {/* Gate SEME (L2): il fallimento si vede; finché è qui nulla è segnato come fatto. */}
                {saveError && (
                    <div role="alert" className="rounded-2xl bg-obsidian-card border border-status-error/40 p-4 space-y-3">
                        <div className="flex items-start gap-2.5">
                            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 stroke-[2.4] text-status-error" aria-hidden="true" />
                            <div className="space-y-1">
                                <p className="text-sm font-semibold text-obsidian-primary">{T.ERRORE_TITOLO}</p>
                                <p className="text-xs leading-relaxed text-obsidian-secondary">{T.ERRORE_TESTO}</p>
                                <p className="text-[11px] font-mono text-obsidian-secondary/80 break-words pt-0.5">{saveError}</p>
                            </div>
                        </div>
                        <button type="button" onClick={retry} disabled={isSaving} className="w-full min-h-[48px] flex items-center justify-center gap-2 rounded-full bg-brand-orange text-obsidian-bg font-semibold text-sm disabled:opacity-50 cursor-pointer">
                            {isSaving ? <span className="w-4 h-4 border-2 border-obsidian-bg border-t-transparent rounded-full animate-spin" /> : <><RefreshCw className="w-4 h-4" aria-hidden="true" /><span>{T.RIPROVA}</span></>}
                        </button>
                    </div>
                )}

                {passo === 'consenso' ? (
                    <>
                        <button type="button" onClick={consensoOk} className="w-full min-h-[52px] rounded-full bg-brand-orange text-obsidian-bg font-semibold text-[15px] cursor-pointer shadow-lg shadow-brand-orange/20" data-testid="consenso-ai-ok">{CONSENSO_AI.OK}</button>
                        <button type="button" onClick={consensoDopo} className="w-full min-h-[44px] text-sm font-semibold text-obsidian-secondary cursor-pointer" data-testid="consenso-ai-no">{CONSENSO_AI.NON_ADESSO}</button>
                    </>
                ) : (
                    <>
                        <div className="flex gap-3">
                            {indice > 0 && passi[indice - 1] !== 'consenso' && (
                                <button type="button" onClick={() => vai(-1)} aria-label={T.INDIETRO} className="min-h-[52px] w-[52px] shrink-0 inline-flex items-center justify-center rounded-full border border-obsidian-border bg-obsidian-card text-obsidian-primary cursor-pointer">
                                    <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                                </button>
                            )}
                            <button type="button" onClick={avanti} disabled={isSaving} data-testid="primo-avanti" className="flex-1 min-h-[52px] inline-flex items-center justify-center gap-2 rounded-full bg-brand-orange text-obsidian-bg font-semibold text-[15px] disabled:opacity-50 cursor-pointer shadow-lg shadow-brand-orange/20">
                                {isSaving
                                    ? <span className="w-4 h-4 border-2 border-obsidian-bg border-t-transparent rounded-full animate-spin" />
                                    : <><span>{ultimo ? T.FINE : T.AVANTI}</span><ArrowRight className="w-4 h-4" aria-hidden="true" /></>}
                            </button>
                        </div>
                        <div className="flex items-center justify-between">
                            <button type="button" onClick={saltaDomanda} disabled={isSaving} className="min-h-[44px] text-[13px] font-semibold text-obsidian-secondary hover:text-obsidian-primary disabled:opacity-50 cursor-pointer">{T.SALTA}</button>
                            <button type="button" onClick={saltaTutto} disabled={isSaving} className="min-h-[44px] text-[13px] font-semibold text-obsidian-secondary hover:text-obsidian-primary disabled:opacity-50 cursor-pointer" data-testid="primo-salta-tutto">{T.SALTA_TUTTO}</button>
                        </div>
                    </>
                )}
            </footer>
        </div>
    );
}
