import { motion, AnimatePresence } from "framer-motion";
import { VERSIONE_APP } from '@/lib/versione';
import { useState, useEffect, useMemo } from "react";
import { User, Mail, MapPin, Edit, ArrowLeft, Award, Map } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import TopBar from "../components/TopBar";
import BottomNavigation from "../components/BottomNavigation";
import { useUserContext } from "../hooks/useUserContext";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../hooks/use-toast";
import { useAILearning } from "../hooks/useAILearning";
import { supabase } from "../lib/supabase";
import FoodPrefsEditor from "../components/FoodPrefsEditor";
import RitmoCompagniaEditor from "../components/RitmoCompagniaEditor";
import InterestsEditor from "../components/InterestsEditor";
import { salvaNomeProfilo } from "../lib/nomeProfilo";
import DnaProfilo from "../components/DnaProfilo";
import MeteProfilo from "../components/MeteProfilo";
import RisultatiProfilo from "../components/RisultatiProfilo";
import RiviviGiri from "../components/RiviviGiri";
import { meteDalRegistro, contatoriDalRegistro, risultatiDalRegistro } from "../lib/dnaProfilo";
import { leggiGiriSalvati, leggiGiriFatti, rimuoviGiroSalvato, giroSalvatoComeTour, giroDaRifare } from "../lib/giriSalvati";
import { TESTI_PROFILO } from "../lib/testiAccount";
import { QuickPathSummary } from "../components/Map/QuickPathSummary";
import { useModificaGiro } from "../hooks/useModificaGiro";
import { isOspite, TESTI_OSPITE } from "../lib/ospite";
import LinkLegali from "../components/LinkLegali";
import EliminaAccount from "../components/EliminaAccount";

export default function ProfilePage() {
    const { userId, firstName, city } = useUserContext();
    const { user } = useAuth();
    // DNA-6 — chi ha fatto l'accesso e' `user.id`: `userId` di useUserContext arriva solo dopo che la citta' e' risolta (senza posizione resterebbe vuoto).
    const idAccesso = user?.id ?? null;
    const { toast } = useToast();
    const { weights, dnaEvents, dnaShare, ritmoPreferito, compagniaPreferita, righeRegistro, correggiDna, onboardingPrefs, saveFoodPrefs, interestIds, saveInterests } = useAILearning();
    // DNA-6 — Mete e contatori vengono dal registro (public.dna_events), non da testo fisso.
    const mete = useMemo(() => meteDalRegistro(righeRegistro || []), [righeRegistro]);
    const contatori = useMemo(() => contatoriDalRegistro(righeRegistro || []), [righeRegistro]);
    const risultati = useMemo(() => risultatiDalRegistro(righeRegistro || []), [righeRegistro]);
    const [giriSalvati, setGiriSalvati] = useState([]);
    const [giriFatti, setGiriFatti] = useState([]);
    const navigate = useNavigate();
    // GIRI-SALVATI — il giro aperto dal Profilo: lo stesso riepilogo di quando e' stato generato, dalle tappe salvate (nessuna AI)
    const [giroAperto, setGiroAperto] = useState(null);
    const [tourAperto, setTourAperto] = useState(null);
    const apriGiro = (riga) => { setGiroAperto(riga); setTourAperto(giroSalvatoComeTour(riga)); };
    const chiudiGiro = () => { setGiroAperto(null); setTourAperto(null); };
    const modificaGiro = useModificaGiro({ tour: tourAperto, aggiorna: setTourAperto, dnaWeights: weights || {} });
    const [editName, setEditName] = useState(firstName || "Viaggiatore");
    // ACCESSO-1: il nome si modifica qui e si salva (profiles.first_name + metadati dell'account).
    const [modificaNome, setModificaNome] = useState(false);
    const [bozzaNome, setBozzaNome] = useState('');
    const [erroreNome, setErroreNome] = useState(null);
    const [salvandoNome, setSalvandoNome] = useState(false);

    const salvaNome = async (e) => {
        e.preventDefault();
        setErroreNome(null);
        setSalvandoNome(true);
        try {
            const r = await salvaNomeProfilo(supabase, userId, bozzaNome);
            if (!r.ok) { setErroreNome(r.errore); return; }
            setEditName(r.nome.split(/\s+/)[0]);
            setModificaNome(false);
            toast({ title: 'Nome salvato.', type: 'success' });
        } catch {
            setErroreNome('Non sono riuscito a salvare il nome. Riprova tra poco.');
        } finally {
            setSalvandoNome(false);
        }
    };
    // Le sezioni dei giri. Richieste (guide locali, V2) in V1 non c'e': components/RichiesteGuide.jsx, come le pagine di V1LockedGuard.
    const [activeQuickTab, setActiveQuickTab] = useState('zones');

    // Sync local state when context loads real name
    useEffect(() => {
        if (firstName && firstName !== 'Ospite') {
            setEditName(firstName);
        }
    }, [firstName]);

    useEffect(() => {
        if (!idAccesso) return;
        let vivo = true;
        leggiGiriSalvati().then(r => { if (vivo && r.ok) setGiriSalvati(r.giri); });
        leggiGiriFatti().then(r => { if (vivo && r.ok) setGiriFatti(r.giri); });
        return () => { vivo = false; };
    }, [idAccesso]);

    const rimuoviGiro = async (id) => {
        const r = await rimuoviGiroSalvato(id);
        if (r.ok) setGiriSalvati(g => g.filter(x => x.id !== id));
        else toast({ title: 'Non sono riuscito a rimuovere il giro. Riprova tra poco.', type: 'warning' });
    };

    // «Rifai questo giro»: le stesse tappe, sulla mappa, con un id nuovo. Nessuna generazione.
    const rifaiGiro = (riga) => {
        const tour = giroDaRifare(riga);
        if (tour) navigate('/map', { state: { tourData: tour, isAiGenerated: true } });
    };

    return (
        <div className="min-h-screen bg-obsidian-bg text-obsidian-primary font-quicksand">
            <TopBar />

            <main className="max-w-md mx-auto px-4 py-8 pb-24">
                {/* Back to Home */}
                <motion.div
                    className="mb-6"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.6 }}
                >
                    <Link to="/dashboard-user">
                        <motion.button
                            className="flex items-center space-x-2 bg-obsidian-card text-obsidian-secondary hover:text-obsidian-primary border border-obsidian-border px-4 py-2 rounded-2xl shadow-md hover:bg-obsidian-raised transition-all group"
                            whileHover={{ scale: 1.05, x: 5 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            <ArrowLeft className="w-5 h-5" />
                            <span className="font-medium text-xs">Torna alla Home</span>
                        </motion.button>
                    </Link>
                </motion.div>

                {/* Profile Header */}
                <motion.div
                    className="bg-obsidian-card border border-obsidian-border rounded-2xl p-6 shadow-xl mb-6"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.1 }}
                >
                    <div className="flex items-center space-x-4 mb-4">
                        <div className="w-16 h-16 bg-obsidian-raised border border-obsidian-border rounded-full flex items-center justify-center shadow-md">
                            <User className="text-obsidian-primary w-8 h-8 stroke-[1.75]" />
                        </div>
                        <div className="flex-1">
                            {modificaNome ? (
                                <form onSubmit={salvaNome} noValidate className="mb-1">
                                    <input
                                        type="text"
                                        value={bozzaNome}
                                        onChange={e => setBozzaNome(e.target.value)}
                                        aria-label="Il tuo nome"
                                        autoFocus
                                        className="w-full bg-obsidian-raised border border-obsidian-border rounded-xl px-3 py-2 text-obsidian-primary text-base font-bold focus:outline-none focus:border-brand-orange"
                                    />
                                    {erroreNome && <p role="alert" className="text-brand-orange text-xs pt-1 font-medium">{erroreNome}</p>}
                                    <div className="flex gap-2 pt-2">
                                        <button type="submit" disabled={salvandoNome} className="px-3 py-1.5 rounded-xl bg-brand-orange text-obsidian-bg text-xs font-bold disabled:opacity-50 cursor-pointer">
                                            {salvandoNome ? 'Salvo...' : 'Salva'}
                                        </button>
                                        <button type="button" onClick={() => { setModificaNome(false); setErroreNome(null); }} className="px-3 py-1.5 rounded-xl bg-obsidian-raised border border-obsidian-border text-obsidian-secondary text-xs font-bold cursor-pointer">
                                            Annulla
                                        </button>
                                    </div>
                                </form>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <h2 className="font-marchio font-extrabold text-2xl leading-tight text-obsidian-primary">{editName}</h2>
                                    <button
                                        type="button"
                                        onClick={() => { setBozzaNome(editName === 'Viaggiatore' ? '' : editName); setErroreNome(null); setModificaNome(true); }}
                                        aria-label="Modifica il nome"
                                        title="Modifica il nome"
                                        className="p-1.5 rounded-full text-obsidian-secondary hover:text-brand-orange transition-colors cursor-pointer"
                                    >
                                        <Edit className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                            <p className="text-obsidian-secondary flex items-center text-sm mb-1">
                                <Mail className="w-3 h-3 mr-1.5 text-obsidian-secondary" />
                                {user?.email || (isOspite(user) ? TESTI_OSPITE.PROFILO_OSPITE : 'Email non verificata')}
                            </p>
                            <p className="text-obsidian-secondary flex items-center text-sm">
                                <MapPin className="w-3 h-3 mr-1.5 text-obsidian-secondary" />
                                {city || 'Italia'}
                            </p>
                        </div>
                    </div>

                    {/* Stats — contatori veri dal registro */}
                    <div className="flex justify-around pt-4 border-t border-obsidian-border" data-testid="contatori-profilo">
                        <div className="text-center">
                            <div className="text-lg font-medium text-obsidian-primary font-etichetta" data-testid="contatore-giri">{contatori.giri}</div>
                            <div className="font-etichetta text-[10px] text-obsidian-secondary tracking-[0.12em] uppercase">Giri</div>
                        </div>
                        <div className="text-center">
                            <div className="text-lg font-medium text-obsidian-primary font-etichetta" data-testid="contatore-citta">{contatori.citta}</div>
                            <div className="font-etichetta text-[10px] text-obsidian-secondary tracking-[0.12em] uppercase">Città</div>
                        </div>
                        <div className="text-center">
                            <div className="text-lg font-medium text-obsidian-primary font-etichetta" data-testid="contatore-tappe">{contatori.tappe}</div>
                            <div className="font-etichetta text-[10px] text-obsidian-secondary tracking-[0.12em] uppercase">Tappe</div>
                        </div>
                    </div>
                    {contatori.giri === 0 && (
                        <p className="text-center text-xs text-obsidian-secondary mt-3">Il tuo primo giro ti aspetta: completane uno e questi numeri crescono.</p>
                    )}
                </motion.div>

                {/* DNA-6 — Il tuo DNA: i pesi del registro, in parole semplici, con la correzione per categoria */}
                <DnaProfilo
                    pesi={weights}
                    eventi={dnaEvents}
                    ritmo={ritmoPreferito}
                    compagnia={compagniaPreferita}
                    fiducia={dnaShare}
                    puoCorreggere={!!idAccesso}
                    onCorreggi={correggiDna}
                />

                {/* ONB-1 — gli interessi dell'onboarding: si cambiano solo da qui */}
                <InterestsEditor value={interestIds} onSave={saveInterests} toast={toast} />

                {/* DNA-5 — ritmo e compagnia: impostati qui vincono su cio' che il DNA impara */}
                <RitmoCompagniaEditor value={onboardingPrefs} onSave={saveFoodPrefs} toast={toast} />

                {/* P7b — dieta, budget e stile del primo accesso, modificabili qui */}
                <FoodPrefsEditor value={onboardingPrefs} onSave={saveFoodPrefs} toast={toast} />

                {/* I tuoi giri — Mete e Risultati (dal registro), un solo pannello aperto alla volta */}
                <motion.div
                    className="mb-6"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                >
                    <h3 className="font-marchio font-extrabold text-xl leading-tight text-obsidian-primary mb-3">{TESTI_PROFILO.GIRI_TITOLO}</h3>
                    <div className="grid grid-cols-2 gap-3" role="tablist">
                        {[['zones', TESTI_PROFILO.TAB_METE, Map], ['results', TESTI_PROFILO.TAB_RISULTATI, Award]].map(([id, nome, Icona]) => (
                            <button
                                key={id}
                                type="button"
                                role="tab"
                                aria-selected={activeQuickTab === id}
                                onClick={() => setActiveQuickTab(id)}
                                className={`min-h-[52px] px-4 rounded-2xl flex items-center gap-2.5 font-corpo font-semibold text-sm text-obsidian-primary transition-colors border cursor-pointer ${
                                    activeQuickTab === id
                                        ? 'bg-obsidian-raised border-brand-orange ring-1 ring-brand-orange'
                                        : 'bg-obsidian-card border-obsidian-border hover:bg-obsidian-raised'
                                }`}
                            >
                                <Icona className={`w-5 h-5 ${activeQuickTab === id ? 'text-brand-orange' : 'text-obsidian-secondary'}`} aria-hidden="true" />
                                {nome}
                            </button>
                        ))}
                    </div>
                </motion.div>

                <AnimatePresence mode="wait">
                    {activeQuickTab === 'results' && (
                        <motion.div
                            key="results"
                            className="mb-6 bg-obsidian-card border border-obsidian-border rounded-2xl p-5 shadow-lg"
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.15 }}
                        >
                            <h3 className="font-marchio font-extrabold text-lg text-obsidian-primary mb-3">{TESTI_PROFILO.RISULTATI_TITOLO}</h3>
                            <RisultatiProfilo risultati={risultati} />
                        </motion.div>
                    )}

                    {activeQuickTab === 'zones' && (
                        <motion.div
                            key="zones"
                            className="mb-6 bg-obsidian-card border border-obsidian-border rounded-2xl p-5 shadow-lg"
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.15 }}
                        >
                            <h3 className="font-marchio font-extrabold text-lg text-obsidian-primary mb-3">{TESTI_PROFILO.METE_TITOLO}</h3>
                            <MeteProfilo mete={mete} giriSalvati={giriSalvati} onRimuovi={rimuoviGiro} onApri={apriGiro} />
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* PROFILO-SEZIONI — i giri finiti: mappa, tappe, data e «Rifai questo giro» */}
                <RiviviGiri giri={giriFatti} haMete={mete.length > 0} onRifai={rifaiGiro} />

                {/* ACCOUNT-PRIVACY — privacy, termini ed eliminazione dell'account */}
                <LinkLegali className="mt-8" />
                <EliminaAccount />

                {/* MERGE-3 — la versione in produzione: commit e data del build */}
                <p data-versione className="text-center text-[11px] text-obsidian-secondary/80 pt-6 pb-2">{VERSIONE_APP}</p>
            </main>

            {/* GIRI-SALVATI — il giro salvato si riapre com'era (tappe e orari salvati, «Vedi mappa», «Togli»/«Cambia»): nessuna generazione */}
            {tourAperto && (
                <QuickPathSummary
                    tourData={tourAperto}
                    choices={{}}
                    modifica={modificaGiro}
                    sorgente={giroAperto?.source || 'altro'}
                    onViewMap={() => {
                        const tour = { ...tourAperto };
                        navigate('/map', { state: { tourData: tour, isAiGenerated: true } });
                    }}
                    onHome={chiudiGiro}
                />
            )}

            <BottomNavigation />
        </div>
    );
}
