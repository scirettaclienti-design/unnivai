import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { dataService } from '../services/dataService';
import { computeWeights, weightsToAIProfile, tourAffinityScore, applyEvent, normalizeCategory } from '../services/preferenceEngine';

// Fase 2 Gate DNA: bump chiave localStorage (v1→v2). Il "brain" v1 conteneva
// chiavi cat: sporche (nomi-sezione, "guide"): ignorandolo, i client ripartono
// puliti e non ri-scrivono lo sporco nel DB dopo il reset. Vedi RESET SQL.
const STORAGE_KEY = 'unnivai_ai_learning_brain_v2';
// Gate SEME (L1): chiave dedicata del seme onboarding (id CORE seminati).
// FUORI dal brain di proposito: il seme NON entra MAI nel preferenceGraph
// (regola locked Gate DNA: il grafo contiene solo gusti da comportamento vero;
// la card "DNA in formazione" conta solo interazioni reali). Il seme e' un
// input SEPARATO passato a computeWeights come 2o argomento. Deve combaciare
// con ONBOARDING_SEED_KEY in Onboarding.jsx e la cleanup logout in AuthContext.jsx.
const ONBOARDING_SEED_KEY = 'unnivai_onboarding_seed_v1';
const MAX_INTERACTIONS = 30;
const SYNC_DEBOUNCE_MS = 3000;

// Gate SEME (L1): lettura SINCRONA del seme (nessun async nel path critico).
// JSON malformato/assente → [] (regola #1: nessun fallback produce contenuto,
// mai categorie di default). Filtra a sole stringhe per robustezza.
function readOnboardingSeed() {
    try {
        const raw = localStorage.getItem(ONBOARDING_SEED_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter(x => typeof x === 'string') : [];
    } catch {
        return [];
    }
}

/**
 * useAILearning — Preference Graph
 *
 * Traccia le interazioni dell'utente e costruisce un profilo di preferenze
 * che viene iniettato nei prompt AI per personalizzare itinerari.
 *
 * Persistenza:
 * - localStorage per accesso immediato (cache locale)
 * - Supabase user_preferences per persistenza cross-device
 * - Arricchimento incrementale: nuove interazioni si aggiungono, non sovrascrivono
 */
export function useAILearning() {
    const { user } = useAuth();
    const userId = user?.id;

    // Gate E-2: rimossi generatedToursCount + hasUnlockedPremium dallo state.
    // Servivano SOLO al paywall gate (hasHitPaywall = count>=10 && !unlocked).
    // Modello di lancio locked: nessun paywall in V1. L'unico limite è la
    // quota giornaliera (DAILY_QUOTA=10, DVAI-050) con messaggio onesto.
    const [learningState, setLearningState] = useState(() => {
        const defaults = {
            userDNAPreferences: [],
            preferenceGraph: {},  // { category: count, mood: count, ... }
            interactions: [],     // ultime 30 interazioni
            totalInteractions: 0,
            lastSyncedAt: null,
        };
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (!saved) return defaults;
            const parsed = JSON.parse(saved);
            // Merge con i default per tollerare versioni vecchie dello schema
            return {
                ...defaults,
                ...parsed,
                userDNAPreferences: Array.isArray(parsed?.userDNAPreferences) ? parsed.userDNAPreferences : [],
                interactions: Array.isArray(parsed?.interactions) ? parsed.interactions : [],
                preferenceGraph: (parsed?.preferenceGraph && typeof parsed.preferenceGraph === 'object') ? parsed.preferenceGraph : {},
                totalInteractions: Number.isFinite(parsed?.totalInteractions) ? parsed.totalInteractions : 0,
            };
        } catch {
            return defaults;
        }
    });

    // Gate SEME (L1): seme onboarding, stato SEPARATO dal brain, letto in modo
    // sincrono al mount (initializer) → gia' disponibile al primo render, prima
    // che parta la query 'home-experiences'. NON confluisce mai in
    // learningState.preferenceGraph.
    //
    // Gate SEME (L2): ora ha un setter. La lettura sincrona dal localStorage
    // resta il valore di PARTENZA (nessun ritardo nel path critico), ma non e'
    // piu' l'ultima parola: l'effect di sync-in qui sotto lo rimpiazza col
    // valore del server appena arriva. Serve perche' il localStorage viene
    // cancellato al logout (AuthContext, chiave user-derived) e non esiste su
    // un secondo device: senza questo, il seme continuerebbe a sparire.
    const [onboardingSeed, setOnboardingSeed] = useState(readOnboardingSeed);

    const syncTimerRef = useRef(null);
    const hasSyncedFromDb = useRef(false);

    // ─── Sync da Supabase al mount (solo una volta) ──────────────────────────
    useEffect(() => {
        if (!userId || hasSyncedFromDb.current) return;
        hasSyncedFromDb.current = true;

        const loadFromDb = async () => {
            const dbPrefs = await dataService.getUserPreferences(userId);
            if (!dbPrefs) return;

            // ─── Gate SEME (L2): il seme del server vince ─────────────────────
            // getUserPreferences fa select('*'), quindi onboarding_seed arriva
            // gia' con questa chiamata: nessun round-trip in piu', nessuna
            // funzione di lettura dedicata.
            //
            // CHI VINCE se locale e server divergono: il SERVER, sempre, una
            // volta che ha risposto. Il seme e' un dato dell'UTENTE, non della
            // sessione o del device: se ha rifatto l'onboarding su un altro
            // telefono, quella e' la sua dichiarazione piu' recente, e il
            // localStorage di questo device e' solo una cache che puo' essere
            // vecchia. La regola opposta ("vince il locale") renderebbe il
            // valore dipendente da quale device apri per primo.
            //
            // Il caso onboarding_seed NULL (utente che non ha mai sincronizzato,
            // o che ha fatto l'onboarding prima di questo gate) NON tocca il
            // valore locale: NULL significa "il server non sa", non "il server
            // dice vuoto". La distinzione NULL vs [] esiste in colonna proprio
            // per questo — [] e' uno skip esplicito e vince come ogni altro
            // valore. LIMITE NOTO, non chiuso qui: in quel caso il seme locale
            // non viene spinto sul server. Farlo vorrebbe dire una scrittura
            // dentro un path di sola lettura, con un fallimento che nessuna UI
            // sta guardando — cioe' esattamente il pattern che questo gate
            // elimina. Per quegli utenti il seme resta locale finche' non
            // rifanno l'onboarding.
            if (Array.isArray(dbPrefs.onboarding_seed)) {
                const serverSeed = dbPrefs.onboarding_seed.filter(x => typeof x === 'string');
                setOnboardingSeed(prev => {
                    // Identita' referenziale stabile se il valore non cambia:
                    // onboardingSeed e' una dipendenza del useMemo dei pesi, un
                    // array nuovo a parita' di contenuto ricalcolerebbe per nulla.
                    const same = prev.length === serverSeed.length
                        && prev.every((v, i) => v === serverSeed[i]);
                    return same ? prev : serverSeed;
                });
                // Riallinea la cache locale al server (best-effort: la fonte di
                // verita' e' comunque la colonna, questo serve solo al prossimo
                // mount sincrono).
                try {
                    localStorage.setItem(ONBOARDING_SEED_KEY, JSON.stringify(serverSeed));
                } catch { /* quota: il server resta la fonte di verita' */ }
            }

            setLearningState(prev => {
                // Merge: DB ha priorità se più recente, ma non perdiamo dati locali
                const dbInteractions = Array.isArray(dbPrefs.interactions) ? dbPrefs.interactions : [];
                const localInteractions = Array.isArray(prev.interactions) ? prev.interactions : [];
                const localDNA = Array.isArray(prev.userDNAPreferences) ? prev.userDNAPreferences : [];
                const localGraph = (prev.preferenceGraph && typeof prev.preferenceGraph === 'object') ? prev.preferenceGraph : {};

                // Unisci interazioni, deduplicando per timestamp
                const allInteractions = [...dbInteractions, ...localInteractions];
                const seen = new Set();
                const merged = allInteractions.filter(i => {
                    const key = `${i.type}-${i.timestamp}-${i.category || ''}`;
                    if (seen.has(key)) return false;
                    seen.add(key);
                    return true;
                }).slice(0, MAX_INTERACTIONS);

                const mergedGraph = { ...(dbPrefs.preference_data || {}), ...localGraph };
                // Somma i conteggi per chiavi comuni
                for (const [key, val] of Object.entries(dbPrefs.preference_data || {})) {
                    if (typeof val === 'number' && typeof localGraph[key] === 'number') {
                        mergedGraph[key] = Math.max(val, localGraph[key]);
                    }
                }

                return {
                    ...prev,
                    preferenceGraph: mergedGraph,
                    interactions: merged,
                    totalInteractions: Math.max(dbPrefs.total_interactions || 0, prev.totalInteractions || 0),
                    // Mantieni DNA locale se più ricco
                    userDNAPreferences: localDNA.length >= dbInteractions.length
                        ? localDNA
                        : merged.filter(i => i.type === 'tour_generated').map(i => i.data).slice(0, 10),
                    lastSyncedAt: new Date().toISOString(),
                };
            });
        };
        loadFromDb();
    }, [userId]);

    // ─── Salva in localStorage ad ogni cambio ─────────────────────────────────
    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(learningState));
        } catch {}
    }, [learningState]);

    // ─── Sync debounced verso Supabase ────────────────────────────────────────
    const syncToDb = useCallback(() => {
        if (!userId) return;
        if (syncTimerRef.current) clearTimeout(syncTimerRef.current);

        syncTimerRef.current = setTimeout(async () => {
            await dataService.upsertUserPreferences(
                userId,
                learningState.preferenceGraph,
                learningState.interactions,
                learningState.totalInteractions,
            );
        }, SYNC_DEBOUNCE_MS);
    }, [userId, learningState.preferenceGraph, learningState.interactions, learningState.totalInteractions]);

    // ─── Traccia un'interazione generica ──────────────────────────────────────
    const trackInteraction = useCallback((type, data = {}) => {
        setLearningState(prev => {
            const interaction = {
                type,
                data,
                timestamp: new Date().toISOString(),
                category: data.category || data.type || null,
                city: data.city || null,
            };

            const updatedInteractions = [interaction, ...prev.interactions].slice(0, MAX_INTERACTIONS);

            // Aggiorna il preference graph (conteggi per categoria/mood/tipo)
            const graph = { ...prev.preferenceGraph };
            // Fase 2 Gate DNA — normalizza la category sulla tassonomia autorevole
            // (CORE_CATEGORIES via normalizeCategory). Se NON è un gusto valido
            // (nomi-sezione "Scelto per te", feature spente "guide", ecc.) NON si
            // scrive la chiave cat: (regola #1: nessun dato falso alla sorgente).
            // È l'UNICO punto che scrive cat: — copre trackTourView/trackCategoryClick/
            // trackGeneratedTour (tutti passano da qui).
            if (data.category) {
                const normCat = normalizeCategory(data.category);
                if (normCat) graph[`cat:${normCat}`] = (graph[`cat:${normCat}`] || 0) + 1;
            }
            if (data.mood) graph[`mood:${data.mood}`] = (graph[`mood:${data.mood}`] || 0) + 1;
            if (data.type) graph[`type:${data.type}`] = (graph[`type:${data.type}`] || 0) + 1;
            if (data.city) graph[`city:${data.city}`] = (graph[`city:${data.city}`] || 0) + 1;
            if (data.duration) graph[`duration:${data.duration}`] = (graph[`duration:${data.duration}`] || 0) + 1;
            if (data.budget) graph[`budget:${data.budget}`] = (graph[`budget:${data.budget}`] || 0) + 1;

            return {
                ...prev,
                interactions: updatedInteractions,
                preferenceGraph: graph,
                totalInteractions: prev.totalInteractions + 1,
            };
        });

        // Debounced sync to Supabase
        syncToDb();
    }, [syncToDb]);

    // ─── Track tour generation (retrocompatibile) ─────────────────────────────
    // Gate E-2: rimosso incremento generatedToursCount (serviva solo al paywall).
    const trackGeneratedTour = useCallback((preferences) => {
        trackInteraction('tour_generated', preferences);

        setLearningState(prev => {
            const newPrefs = { ...preferences, date: new Date().toISOString() };
            const updatedDNA = [newPrefs, ...prev.userDNAPreferences].slice(0, 10);
            return {
                ...prev,
                userDNAPreferences: updatedDNA,
            };
        });
    }, [trackInteraction]);

    // ─── Track tour/POI view ──────────────────────────────────────────────────
    const trackTourView = useCallback((tour) => {
        trackInteraction('tour_view', {
            tourId: tour.id,
            category: tour.category || tour.type,
            city: tour.city,
            guideId: tour.guide_id || tour.guideId,
        });
    }, [trackInteraction]);

    // ─── Track category selection ─────────────────────────────────────────────
    const trackCategoryClick = useCallback((category, city) => {
        trackInteraction('category_click', { category, city });
    }, [trackInteraction]);

    // ─── Track search ─────────────────────────────────────────────────────────
    const trackSearch = useCallback((query, city) => {
        trackInteraction('search', { query, city });
    }, [trackInteraction]);

    // ─── Pesi normalizzati dal Preference Engine ────────────────────────────────
    // Gate SEME (L1): il seme onboarding entra QUI come 2o arg (prima era []).
    // computeWeights lo somma (+0.3/id normalizzato) ai click impliciti del grafo
    // e ri-normalizza. Il seme resta fuori dal grafo: influenza solo i pesi.
    //
    // Gate SEME (L2): onboardingSeed ora e' uno stato che PUO' cambiare dopo il
    // mount (quando risponde il sync-in dal server), non piu' solo il valore
    // dell'initializer. La dipendenza regge senza modifiche perche' setState
    // sostituisce il riferimento dell'array: il memo ricalcola quando e solo
    // quando il contenuto e' davvero cambiato (il setter sopra riusa il
    // riferimento precedente a parita' di valore).
    const weights = useMemo(() => {
        return computeWeights(learningState.preferenceGraph, onboardingSeed);
    }, [learningState.preferenceGraph, onboardingSeed]);

    // ─── Build AI context string da pesi strutturati ─────────────────────────
    const getAIContext = useCallback(() => {
        // Fase 1 Gate DNA — SOLO il profilo pulito del preference engine, già
        // filtrato sulla whitelist di gusto CORE_CATEGORIES (via computeWeights /
        // normalizeCategory in preferenceEngine.js). Se non c'è segnale di gusto
        // valido → NIENTE (regola #1: nessun fallback produce contenuto).
        //
        // RIMOSSO il fallback legacy che leggeva le chiavi `cat:` GREZZE del grafo
        // (senza normalizzare): produceva testi tipo "Categorie preferite: guide,
        // Scelto per te, Consigliato dall'AI" — nomi di sezioni UI + una feature
        // spenta (guide) spacciati per gusti dentro il prompt AI.
        return weightsToAIProfile(weights) || '';
    }, [weights]);

    // ─── Score affinità per ranking tour ─────────────────────────────────────
    const getTourAffinity = useCallback((tour) => {
        return tourAffinityScore(tour, weights);
    }, [weights]);

    // Gate E-2: unlockPremium + hasHitPaywall rimossi. Il paywall gate è morto:
    // modello di lancio locked = nessun paywall in V1. Il PaywallModal component
    // resta nel repo per V2/V3 ma non è più raggiungibile da nessun codepath.

    return {
        ...learningState,
        weights, // Pesi normalizzati 0.0-1.0 per categorie
        // Gate SEME (L1): true se l'onboarding ha seminato almeno un gusto.
        // Serve a DashboardUser per attivare il ranking DNA dal giorno 0 (R1),
        // senza aspettare 3 interazioni reali. NON altera il conteggio DNA.
        //
        // Gate SEME (L2): puo' passare da false a true DOPO il mount, quando il
        // seme arriva dal server su un device che non ce l'aveva in cache (il
        // caso "nuovo accesso dopo logout"). DashboardUser:204 lo usa come
        // membro della queryKey di 'home-experiences' via hasPreferences: il
        // cambio provoca un refetch sotto la chiave nuova, che e' il
        // comportamento voluto (il seme e' arrivato, il ranking deve cambiare).
        // Non e' un caso nuovo per quella query: totalInteractions, gia' membro
        // della stessa chiave, cambia allo stesso identico momento per effetto
        // del sync-in.
        hasSeed: onboardingSeed.length > 0,
        trackGeneratedTour,
        trackTourView,
        trackCategoryClick,
        trackSearch,
        trackInteraction,
        getAIContext,
        getTourAffinity, // Score affinità tour (0-100)
    };
}
