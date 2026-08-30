import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { User, Mail, MapPin, Heart, Star, Edit, ArrowLeft, Home, Share2, Facebook, Twitter, Instagram, Link as LinkIcon, Eye, ChevronRight, Award, Target, Users, Compass, Search, Map, Clock, ArrowRight, X, MessageCircle } from "lucide-react";
import { Link } from "react-router-dom";
import TopBar from "../components/TopBar";
import BottomNavigation from "../components/BottomNavigation";
import ChatModalUser from "../components/ChatModalUser";
import { useUserContext } from "../hooks/useUserContext";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../hooks/use-toast";
import { useAILearning } from "../hooks/useAILearning";
import { normalizeCategory } from "../services/preferenceEngine";
import { supabase } from "../lib/supabase";

// Fase 2 Gate DNA: soglia minima di interazioni di gusto CATEGORIZZATE sotto la
// quale NON si mostrano percentuali. Motivo: con pochi eventi una categoria
// domina in modo ingannevole (3 eventi → "100% food"); ~12 dà spazio a 2-4
// categorie perché le proporzioni siano un trend reale, non l'artefatto di 1-2
// click. Sotto soglia: messaggio "DNA in formazione". Costante nominata.
const DNA_MIN_CATEGORIZED = 12;

export default function ProfilePage() {
    const { userId, firstName, city } = useUserContext();
    const { user } = useAuth();
    const { toast } = useToast();
    const { preferenceGraph } = useAILearning();
    const [editName, setEditName] = useState(firstName || "Viaggiatore");
    const [selectedTour, setSelectedTour] = useState(null);
    const [showShareModal, setShowShareModal] = useState(false);
    const [activeQuickTab, setActiveQuickTab] = useState('requests');
    const [chatModalRequest, setChatModalRequest] = useState(null);

    // Dynamic Data State
    const [myRequests, setMyRequests] = useState([]);
    const [tourHistory, setTourHistory] = useState([]);

    // Sync local state when context loads real name
    useEffect(() => {
        if (firstName && firstName !== 'Ospite') {
            setEditName(firstName);
        }
    }, [firstName]);

    useEffect(() => {
        if (!userId) return;

        const fetchProfileData = async () => {
            try {
                // Livello 1 verità: rimosso il fetch stats da `explorers`. La query
                // leggeva `tours_completed` (colonna INESISTENTE → errore) su una
                // tabella comunque VUOTA e non alimentata da alcun codice. Nessun
                // contatore reale > 0 esiste oggi → i contatori mostrano empty state
                // onesto. Il collegamento vero (ponte nav→profilo) è il gate successivo.

                // 2. Fetch Memories (Photos joined with Tours)
                const { data: photos, error: photoError } = await supabase
                    .from('user_photos')
                    .select(`
                        id,
                        media_url,
                        created_at,
                        tour_id,
                        tours (
                            id,
                            title,
                            city,
                            rating,
                            duration
                        )
                    `)
                    .eq('user_id', userId)
                    .order('created_at', { ascending: false })
                    .limit(100); // DVAI-024

                if (photoError) console.error("Error fetching photos:", photoError);

                if (photos && photos.length > 0) {
                    // Group photos by Tour ID to reconstruct "History"
                    const historyMap = {};

                    photos.forEach(photo => {
                        const tour = photo.tours;
                        if (!tour) return; // Skip orphaned photos

                        if (!historyMap[tour.id]) {
                            historyMap[tour.id] = {
                                id: tour.id,
                                title: tour.title || "Tour Senza Nome",
                                location: tour.city || "Italia",
                                date: new Date(photo.created_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' }),
                                rating: tour.rating || null, // Livello 1: rating reale del tour o niente (mai 5 finto)
                                image: photo.media_url, // cover = prima foto reale
                                duration: tour.duration || null, // reale o niente (mai "2 ore" finto)
                                guide: null, // V1 non ha guide (feature V2). Mai "Guide Expert".
                                highlights: [], // niente highlights inventati
                                description: `Hai esplorato ${tour.city || 'questo luogo'} catturando ${photos.filter(p => p.tour_id === tour.id).length} momenti speciali.`,
                                photos: []
                            };
                        }
                        historyMap[tour.id].photos.push(photo.media_url);
                    });

                    setTourHistory(Object.values(historyMap));
                } else {
                    setTourHistory([]); // clear if no photos
                }

                // 3. Fetch Active Requests
                const { data: requests, error: reqError } = await supabase
                    .from('guide_requests')
                    .select('*')
                    .eq('user_id', userId)
                    .neq('status', 'completed')
                    .order('created_at', { ascending: false })
                    .limit(100); // DVAI-024

                if (!reqError && requests) {
                    setMyRequests(requests);
                }

            } catch (err) {
                console.error("Profile fetch error:", err);
            }
        };

        fetchProfileData();
    }, [userId]);

    const shareTour = (platform, tour) => {
        // Livello 1: testo onesto — via l'aggettivo "fantastico" (voce brand) e il
        // rating tour-level (seed non reale, regola O.4). Solo il fatto: cosa e dove.
        const message = `Ho appena esplorato "${tour.title}" a ${tour.location} con DoveVai!`;
        const url = window.location.href;

        switch (platform) {
            case 'facebook':
                window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(message)}`, '_blank');
                break;
            case 'twitter':
                window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}&url=${encodeURIComponent(url)}`, '_blank');
                break;
            case 'instagram':
                navigator.clipboard.writeText(message);
                toast({ title: 'Messaggio copiato! Incollalo su Instagram Stories', type: 'success' });
                break;
            case 'copy':
                navigator.clipboard.writeText(`${message} ${url}`);
                toast({ title: 'Link copiato negli appunti!', type: 'success' });
                break;
        }
        setShowShareModal(false);
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
                            <h2 className="text-xl font-bold text-obsidian-primary">{editName}</h2>
                            <p className="text-obsidian-secondary flex items-center text-sm mb-1">
                                <Mail className="w-3 h-3 mr-1.5 text-obsidian-secondary" />
                                {user?.email || 'Email non verificata'}
                            </p>
                            <p className="text-obsidian-secondary flex items-center text-sm">
                                <MapPin className="w-3 h-3 mr-1.5 text-obsidian-secondary" />
                                {city || 'Italia'}
                            </p>
                        </div>
                    </div>

                    {/* Stats — Stato Vuoto Pulito */}
                    <div className="flex justify-around pt-4 border-t border-obsidian-border">
                        <div className="text-center">
                            <div className="text-lg font-medium text-obsidian-secondary/40 font-mono">—</div>
                            <div className="text-xs text-obsidian-secondary font-medium tracking-wide uppercase">Tour</div>
                        </div>
                        <div className="text-center">
                            <div className="text-lg font-medium text-obsidian-secondary/40 font-mono">—</div>
                            <div className="text-xs text-obsidian-secondary font-medium tracking-wide uppercase">Guide</div>
                        </div>
                        <div className="text-center">
                            <div className="text-lg font-medium text-obsidian-secondary/40 font-mono">—</div>
                            <div className="text-xs text-obsidian-secondary font-medium tracking-wide uppercase">Rating</div>
                        </div>
                    </div>
                    <p className="text-center text-xs text-obsidian-secondary/70 mt-3">Il tuo primo giro ti aspetta: completane uno e questi numeri prendono vita.</p>
                </motion.div>

                {/* Tour DNA — Informativo */}
                {(() => {
                    const catCounts = {};
                    for (const [k, v] of Object.entries(preferenceGraph || {})) {
                        if (!k.startsWith('cat:') || typeof v !== 'number') continue;
                        const norm = normalizeCategory(k.slice(4));
                        if (norm) catCounts[norm] = (catCounts[norm] || 0) + v;
                    }
                    const validTotal = Object.values(catCounts).reduce((s, v) => s + v, 0);
                    const cats = Object.entries(catCounts).sort(([, a], [, b]) => b - a).slice(0, 4);
                    const belowThreshold = validTotal < DNA_MIN_CATEGORIZED;
                    const DNA_SHADES = ['bg-obsidian-primary', 'bg-obsidian-secondary', 'bg-obsidian-secondary/60', 'bg-obsidian-border'];

                    return (
                        <motion.div
                            className="mb-6 bg-obsidian-card border border-obsidian-border rounded-2xl p-5 shadow-sm"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                        >
                            <h3 className="font-bold text-obsidian-primary text-sm mb-3 flex items-center gap-2">
                                <Compass className="w-4 h-4 text-obsidian-secondary" /> Il tuo Tour DNA
                            </h3>
                            {belowThreshold ? (
                                <p className="text-sm text-obsidian-secondary italic">Il tuo DNA si sta formando: ogni tour che apri e ogni tappa che raggiungi aggiunge un pezzo.</p>
                            ) : (
                                <>
                                    <div className="flex h-2.5 rounded-full overflow-hidden mb-3 bg-obsidian-raised">
                                        {cats.map(([k, v], i) => (
                                            <div key={k} className={`${DNA_SHADES[i]} transition-all`} style={{ width: `${(v / validTotal) * 100}%` }} />
                                        ))}
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {cats.map(([k, v], i) => {
                                            const pct = Math.round((v / validTotal) * 100);
                                            return (
                                                <span key={k} className="flex items-center gap-1.5 text-xs font-medium text-obsidian-primary bg-obsidian-raised border border-obsidian-border px-2.5 py-1 rounded-lg">
                                                    <span className={`w-2 h-2 rounded-full ${DNA_SHADES[i]}`} />
                                                    {k} {pct}%
                                                </span>
                                            );
                                        })}
                                    </div>
                                    <p className="text-[10px] text-obsidian-secondary/70 mt-2">{validTotal} interazioni di gusto analizzate</p>
                                </>
                            )}
                        </motion.div>
                    );
                })()}

                {/* Quick Actions — Icone Lineari Monocrome */}
                <motion.div
                    className="mb-6"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                >
                    <h3 className="text-lg font-bold text-obsidian-primary mb-4">Azioni Rapide</h3>
                    <div className="grid grid-cols-3 gap-3">
                        <motion.button
                            onClick={() => setActiveQuickTab('requests')}
                            className={`p-3.5 rounded-2xl shadow-lg relative overflow-hidden transition-all border ${
                                activeQuickTab === 'requests'
                                    ? 'bg-obsidian-raised text-obsidian-primary border-brand-orange ring-1 ring-brand-orange'
                                    : 'bg-obsidian-card text-obsidian-primary border-obsidian-border hover:bg-obsidian-raised'
                            }`}
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            <div className="flex items-center justify-between mb-2.5">
                                <MessageCircle className={`w-5 h-5 ${activeQuickTab === 'requests' ? 'text-brand-orange' : 'text-obsidian-secondary'}`} />
                            </div>
                            <h4 className="font-bold text-[11px] leading-tight text-obsidian-primary text-left">Richieste</h4>
                            {myRequests.length > 0 && (
                                <span className="absolute top-2.5 right-2.5 flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-orange opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-orange"></span>
                                </span>
                            )}
                        </motion.button>

                        <motion.button
                            onClick={() => setActiveQuickTab('results')}
                            className={`p-3.5 rounded-2xl shadow-lg relative overflow-hidden transition-all border ${
                                activeQuickTab === 'results'
                                    ? 'bg-obsidian-raised text-obsidian-primary border-brand-orange ring-1 ring-brand-orange'
                                    : 'bg-obsidian-card text-obsidian-primary border-obsidian-border hover:bg-obsidian-raised'
                            }`}
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            <div className="flex items-center justify-between mb-2.5">
                                <Award className={`w-5 h-5 ${activeQuickTab === 'results' ? 'text-brand-orange' : 'text-obsidian-secondary'}`} />
                            </div>
                            <h4 className="font-bold text-[11px] leading-tight text-obsidian-primary text-left">Risultati</h4>
                        </motion.button>

                        <motion.button
                            onClick={() => setActiveQuickTab('zones')}
                            className={`p-3.5 rounded-2xl shadow-lg relative overflow-hidden transition-all border ${
                                activeQuickTab === 'zones'
                                    ? 'bg-obsidian-raised text-obsidian-primary border-brand-orange ring-1 ring-brand-orange'
                                    : 'bg-obsidian-card text-obsidian-primary border-obsidian-border hover:bg-obsidian-raised'
                            }`}
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            <div className="flex items-center justify-between mb-2.5">
                                <Map className={`w-5 h-5 ${activeQuickTab === 'zones' ? 'text-brand-orange' : 'text-obsidian-secondary'}`} />
                            </div>
                            <h4 className="font-bold text-[11px] leading-tight text-obsidian-primary text-left">Mete</h4>
                        </motion.button>
                    </div>
                </motion.div>

                {/* Tab Panels — Un solo pannello aperto alla volta */}
                <AnimatePresence mode="wait">
                    {activeQuickTab === 'requests' && (
                        <motion.div
                            key="requests"
                            className="mb-6 bg-obsidian-card border border-obsidian-border rounded-2xl p-5 shadow-lg"
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.15 }}
                        >
                            <h3 className="text-base font-bold text-obsidian-primary mb-4 flex items-center">
                                <MessageCircle className="w-4 h-4 mr-2 text-obsidian-secondary" />
                                Richieste Attive
                            </h3>

                            <div className="space-y-3">
                                {myRequests.length === 0 ? (
                                    <p className="text-sm text-obsidian-secondary italic">Non hai richieste attive al momento.</p>
                                ) : (
                                    myRequests.map((req) => (
                                        <div key={req.id} className="bg-obsidian-bg p-4 rounded-xl border border-obsidian-border flex flex-col space-y-2">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h4 className="font-bold text-obsidian-primary text-sm">Tour a {req.city}</h4>
                                                    <p className="text-xs text-obsidian-secondary">{new Date(req.created_at).toLocaleDateString()} • {req.duration || 3} ore</p>
                                                </div>
                                                <span className={`px-2 py-0.5 text-[10px] font-bold rounded-lg border ${
                                                    req.status === 'pending'
                                                        ? 'bg-obsidian-raised text-brand-orange border-brand-orange/30'
                                                        : 'bg-obsidian-raised text-obsidian-primary border-obsidian-border'
                                                }`}>
                                                    {req.status === 'pending' ? 'In attesa' : req.status === 'accepted' ? 'Accettata' : req.status}
                                                </span>
                                            </div>
                                            {req.guide_id && (
                                                <div className="mt-2 pt-2 border-t border-obsidian-border flex items-center justify-between">
                                                    <p className="text-xs text-obsidian-secondary font-medium flex items-center">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-brand-orange mr-1.5"></span>
                                                        Assegnata a una guida locale
                                                    </p>
                                                    <button
                                                        onClick={() => setChatModalRequest(req)}
                                                        className="bg-brand-orange text-obsidian-bg hover:bg-brand-orange-hover transition-colors px-3 py-1.5 rounded-lg text-xs font-bold flex items-center"
                                                    >
                                                        <MessageCircle className="w-3 h-3 mr-1" /> Apri Chat
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </motion.div>
                    )}

                    {activeQuickTab === 'results' && (
                        <motion.div
                            key="results"
                            className="mb-6 bg-obsidian-card border border-obsidian-border rounded-2xl p-5 shadow-lg"
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.15 }}
                        >
                            <h3 className="text-base font-bold text-obsidian-primary mb-3 flex items-center">
                                <Award className="w-4 h-4 mr-2 text-obsidian-secondary" />
                                I Miei Risultati
                            </h3>
                            <p className="text-sm text-obsidian-secondary italic">I traguardi appariranno qui man mano che esplori: il primo si sblocca al tuo primo tour completato.</p>
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
                            <h3 className="text-base font-bold text-obsidian-primary mb-3 flex items-center">
                                <Map className="w-4 h-4 mr-2 text-obsidian-secondary" />
                                Esplora Zone
                            </h3>
                            <p className="text-sm text-obsidian-secondary italic">Le zone che esplori appariranno qui: ogni città che visiti lascia il segno.</p>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Tour History - "Rivivi" Section */}
                <motion.div
                    className="mb-6"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.3 }}
                >
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-obsidian-primary flex items-center">
                            <Clock className="w-5 h-5 mr-2 text-obsidian-secondary" />
                            Rivivi i tuoi Tour
                        </h3>
                        {tourHistory.length > 0 && (
                            <div className="flex items-center space-x-3 text-sm text-obsidian-secondary">
                                <span>{tourHistory.length} tour</span>
                                <span>•</span>
                                <span>{tourHistory.reduce((total, tour) => total + tour.photos.length, 0)} foto</span>
                                <Link to="/photos">
                                    <span className="text-obsidian-secondary hover:text-obsidian-primary font-medium cursor-pointer transition-colors">Vedi tutte</span>
                                </Link>
                            </div>
                        )}
                    </div>

                    <div className="space-y-4">
                        {tourHistory.length === 0 && (
                            <div className="bg-obsidian-card border border-obsidian-border rounded-2xl p-6 shadow-sm text-center">
                                <p className="text-sm text-obsidian-secondary italic">Le tue tappe raccontano dove sei stato — inizia a scriverle. Le foto dei tuoi tour appariranno qui.</p>
                            </div>
                        )}
                        {tourHistory.map((tour, index) => (
                            <motion.div
                                key={tour.id}
                                className="bg-obsidian-card border border-obsidian-border rounded-2xl p-4 shadow-lg"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.4 + index * 0.1 }}
                            >
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h4 className="font-bold text-obsidian-primary text-sm">{tour.title}</h4>
                                        <div className="flex items-center space-x-1">
                                            {Array.from({ length: tour.rating || 0 }).map((_, i) => (
                                                <Star key={i} className="w-3 h-3 text-brand-orange fill-current" />
                                            ))}
                                        </div>
                                    </div>

                                    <p className="text-xs text-obsidian-secondary flex items-center">
                                        <MapPin className="w-3 h-3 mr-1 text-obsidian-secondary" />
                                        {tour.location} • {tour.date}
                                    </p>

                                    {/* Foto del tour */}
                                    <div className="relative mt-2">
                                        <div className="flex items-center justify-between mb-2">
                                            <h5 className="text-xs font-bold text-obsidian-secondary flex items-center">
                                                Ricordi ({tour.photos.length})
                                            </h5>
                                        </div>
                                        <div className="flex gap-2 pb-1 overflow-x-hidden">
                                            {tour.photos.slice(0, 3).map((photo, photoIndex) => (
                                                <motion.div
                                                    key={photoIndex}
                                                    className="flex-shrink-0 relative group cursor-pointer overflow-hidden rounded-xl w-20 h-20 shadow-sm border border-obsidian-border"
                                                    whileHover={{ scale: 1.05, rotate: photoIndex % 2 === 0 ? 2 : -2 }}
                                                    whileTap={{ scale: 0.95 }}
                                                    onClick={() => setSelectedTour(tour)}
                                                >
                                                    <img
                                                        src={photo}
                                                        alt={`Ricordo ${photoIndex + 1}`}
                                                        className="w-full h-full object-cover"
                                                    />
                                                    <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors" />
                                                </motion.div>
                                            ))}

                                            {tour.photos.length > 3 && (
                                                <motion.div
                                                    className="flex-shrink-0 w-20 h-20 bg-obsidian-raised rounded-xl flex flex-col items-center justify-center cursor-pointer border border-obsidian-border hover:border-brand-orange transition-colors"
                                                    whileHover={{ scale: 1.05 }}
                                                    whileTap={{ scale: 0.95 }}
                                                    onClick={() => setSelectedTour(tour)}
                                                >
                                                    <span className="text-obsidian-primary font-bold text-xs">+{tour.photos.length - 3}</span>
                                                </motion.div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Buttons */}
                                    <div className="flex items-center gap-2 pt-3 mt-2 border-t border-obsidian-border">
                                        <motion.button
                                            onClick={() => setSelectedTour(tour)}
                                            className="flex-1 bg-obsidian-raised text-obsidian-primary hover:bg-brand-orange hover:text-obsidian-bg border border-obsidian-border hover:border-brand-orange px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 group"
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                        >
                                            <Eye className="w-3.5 h-3.5 text-obsidian-secondary group-hover:text-obsidian-bg transition-colors" />
                                            <span>Rivivi Ricordo</span>
                                        </motion.button>

                                        <motion.button
                                            onClick={() => {
                                                setSelectedTour(tour);
                                                setShowShareModal(true);
                                            }}
                                            className="p-2.5 rounded-xl border border-obsidian-border hover:bg-obsidian-raised text-obsidian-secondary hover:text-obsidian-primary transition-colors"
                                            whileHover={{ scale: 1.1, rotate: 5 }}
                                            whileTap={{ scale: 0.9 }}
                                        >
                                            <Share2 className="w-4 h-4" />
                                        </motion.button>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </motion.div>

                {/* Tour Detail Modal */}
                <AnimatePresence>
                    {selectedTour && !showShareModal && (
                        <motion.div
                            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.3, ease: "easeInOut" }}
                            onClick={() => setSelectedTour(null)}
                        >
                            <motion.div
                                className="bg-obsidian-card border border-obsidian-border rounded-3xl w-full max-w-sm max-h-[85vh] overflow-y-auto overflow-x-hidden shadow-2xl relative"
                                initial={{ scale: 0.9, opacity: 0, y: 100 }}
                                animate={{ scale: 1, opacity: 1, y: 0 }}
                                exit={{ scale: 0.95, opacity: 0, y: 50 }}
                                transition={{
                                    type: "spring",
                                    damping: 25,
                                    stiffness: 350,
                                    mass: 0.5
                                }}
                                onClick={(e) => e.stopPropagation()}
                            >
                                {/* Hero Image Header */}
                                <div className="relative h-72">
                                    <img
                                        src={selectedTour.image}
                                        alt={selectedTour.title}
                                        className="w-full h-full object-cover"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-obsidian-card via-obsidian-card/40 to-transparent" />

                                    {/* Floating Close Button */}
                                    <button
                                        onClick={() => setSelectedTour(null)}
                                        className="absolute top-4 right-4 p-2 rounded-full bg-obsidian-bg/80 backdrop-blur-md text-obsidian-primary border border-obsidian-border hover:bg-obsidian-raised transition-all"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>

                                    {/* Title & Location Overlay */}
                                    <div className="absolute bottom-0 left-0 right-0 p-6 text-obsidian-primary">
                                        <div className="flex items-center space-x-1 text-brand-orange text-xs font-bold uppercase tracking-wider mb-2">
                                            <MapPin className="w-3 h-3" />
                                            <span>{selectedTour.location}</span>
                                        </div>
                                        <h3 className="text-2xl font-bold leading-tight mb-2">{selectedTour.title}</h3>
                                        <div className="flex items-center space-x-2 text-xs text-obsidian-secondary">
                                            <div className="flex">
                                                {Array.from({ length: 5 }).map((_, i) => (
                                                    <Star
                                                        key={i}
                                                        className={`w-3 h-3 ${i < selectedTour.rating ? 'text-brand-orange fill-current' : 'text-obsidian-border'}`}
                                                    />
                                                ))}
                                            </div>
                                            <span>•</span>
                                            <span>{selectedTour.date}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Content Body */}
                                <div className="p-6 space-y-6">
                                    {/* Stats Grid */}
                                    <div className="flex items-center justify-between bg-obsidian-bg rounded-2xl p-4 border border-obsidian-border">
                                        <div className="flex items-center space-x-3">
                                            <div className="w-10 h-10 rounded-full bg-obsidian-raised border border-obsidian-border flex items-center justify-center text-obsidian-primary">
                                                <Clock className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <p className="text-xs text-obsidian-secondary font-medium">Durata</p>
                                                <p className="text-sm font-bold text-obsidian-primary">{selectedTour.duration || '—'}</p>
                                            </div>
                                        </div>
                                        <div className="w-px h-8 bg-obsidian-border" />
                                        <div className="flex items-center space-x-3">
                                            <div className="w-10 h-10 rounded-full bg-obsidian-raised border border-obsidian-border flex items-center justify-center text-obsidian-primary">
                                                <User className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <p className="text-xs text-obsidian-secondary font-medium">Guida</p>
                                                <p className="text-sm font-bold text-obsidian-primary">{selectedTour.guide || '—'}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Description */}
                                    <div>
                                        <h4 className="font-bold text-obsidian-primary mb-2 flex items-center">
                                            Descrizione
                                        </h4>
                                        <p className="text-sm text-obsidian-secondary leading-relaxed min-h-[60px]">
                                            {selectedTour.description}
                                        </p>
                                    </div>

                                    {/* Highlights Chips */}
                                    {selectedTour.highlights?.length > 0 && (
                                    <div>
                                        <h4 className="font-bold text-obsidian-primary mb-3 flex items-center">
                                            Highlights
                                        </h4>
                                        <div className="flex flex-wrap gap-2">
                                            {selectedTour.highlights.map((highlight, index) => (
                                                <span
                                                    key={index}
                                                    className="px-3 py-1.5 bg-obsidian-raised text-obsidian-primary rounded-lg text-xs font-semibold border border-obsidian-border flex items-center"
                                                >
                                                    <Target className="w-3 h-3 mr-1.5 text-obsidian-secondary" />
                                                    {highlight}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                    )}

                                    {/* Gallery Section */}
                                    {selectedTour?.photos && (
                                        <div className="pt-2">
                                            <div className="flex items-center justify-between mb-4">
                                                <h4 className="font-bold text-obsidian-primary flex items-center">
                                                    Gallery
                                                </h4>
                                                <Link to="/photos" className="text-xs font-bold text-obsidian-secondary hover:text-obsidian-primary flex items-center group transition-colors">
                                                    Vedi tutte
                                                    <ChevronRight className="w-3 h-3 ml-0.5 group-hover:translate-x-0.5 transition-transform" />
                                                </Link>
                                            </div>

                                            <div className="grid grid-cols-2 gap-3 mb-6">
                                                {/* Main Featured Photo */}
                                                {selectedTour.photos[0] && (
                                                    <motion.div
                                                        className="col-span-2 relative h-48 rounded-2xl overflow-hidden shadow-md cursor-pointer group border border-obsidian-border"
                                                        whileHover={{ scale: 1.01 }}
                                                        transition={{ duration: 0.2 }}
                                                    >
                                                        <img
                                                            src={selectedTour.photos[0]}
                                                            alt="Main photo"
                                                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                                        />
                                                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                                        <div className="absolute top-2 right-2 bg-obsidian-bg/80 backdrop-blur-sm border border-obsidian-border px-2 py-1 rounded-lg">
                                                            <p className="text-obsidian-primary text-[10px] font-bold">Featured</p>
                                                        </div>
                                                    </motion.div>
                                                )}

                                                {/* Secondary Photos Grid */}
                                                {selectedTour.photos.slice(1, 4).map((photo, index) => (
                                                    <motion.div
                                                        key={index}
                                                        className="relative h-24 rounded-xl overflow-hidden shadow-sm cursor-pointer group border border-obsidian-border"
                                                        whileHover={{ scale: 1.05 }}
                                                    >
                                                        <img
                                                            src={photo}
                                                            alt={`Gallery ${index}`}
                                                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                                        />
                                                    </motion.div>
                                                ))}

                                                {/* "More" Card */}
                                                {selectedTour.photos.length > 4 && (
                                                    <Link to="/photos">
                                                        <motion.div
                                                            className="relative h-24 bg-obsidian-raised rounded-xl overflow-hidden shadow-sm flex flex-col items-center justify-center cursor-pointer border border-obsidian-border hover:border-brand-orange transition-all group"
                                                            whileHover={{ scale: 1.05 }}
                                                        >
                                                            <span className="font-bold text-obsidian-primary text-lg group-hover:scale-110 transition-transform">+{selectedTour.photos.length - 4}</span>
                                                            <span className="text-[10px] text-obsidian-secondary">altre foto</span>
                                                        </motion.div>
                                                    </Link>
                                                )}
                                            </div>

                                            <Link to="/photos">
                                                <motion.button
                                                    className="w-full py-3.5 bg-brand-orange text-obsidian-bg rounded-xl text-sm font-bold shadow-lg hover:bg-brand-orange-hover transition-all flex items-center justify-center gap-2 group"
                                                    whileTap={{ scale: 0.98 }}
                                                >
                                                    Visualizza Album Completo
                                                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                                </motion.button>
                                            </Link>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Share Modal */}
                <AnimatePresence>
                    {showShareModal && selectedTour && (
                        <motion.div
                            className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowShareModal(false)}
                        >
                            <motion.div
                                className="bg-obsidian-card border border-obsidian-border rounded-3xl p-6 max-w-sm w-full shadow-2xl"
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.8, opacity: 0 }}
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-bold text-obsidian-primary">Condividi Tour</h3>
                                    <button
                                        onClick={() => setShowShareModal(false)}
                                        className="p-2 rounded-full bg-obsidian-raised border border-obsidian-border text-obsidian-secondary hover:text-obsidian-primary transition-colors"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>

                                <p className="text-sm text-obsidian-secondary mb-6">
                                    Condividi "{selectedTour.title}" con i tuoi amici
                                </p>

                                <div className="grid grid-cols-2 gap-3">
                                    <motion.button
                                        onClick={() => shareTour('facebook', selectedTour)}
                                        className="bg-obsidian-bg hover:bg-obsidian-raised border border-obsidian-border text-obsidian-primary p-4 rounded-2xl flex flex-col items-center space-y-2 transition-colors"
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                    >
                                        <Facebook className="w-6 h-6 text-obsidian-secondary" />
                                        <span className="text-xs font-medium">Facebook</span>
                                    </motion.button>

                                    <motion.button
                                        onClick={() => shareTour('twitter', selectedTour)}
                                        className="bg-obsidian-bg hover:bg-obsidian-raised border border-obsidian-border text-obsidian-primary p-4 rounded-2xl flex flex-col items-center space-y-2 transition-colors"
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                    >
                                        <Twitter className="w-6 h-6 text-obsidian-secondary" />
                                        <span className="text-xs font-medium">Twitter</span>
                                    </motion.button>

                                    <motion.button
                                        onClick={() => shareTour('instagram', selectedTour)}
                                        className="bg-obsidian-bg hover:bg-obsidian-raised border border-obsidian-border text-obsidian-primary p-4 rounded-2xl flex flex-col items-center space-y-2 transition-colors"
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                    >
                                        <Instagram className="w-6 h-6 text-obsidian-secondary" />
                                        <span className="text-xs font-medium">Instagram</span>
                                    </motion.button>

                                    <motion.button
                                        onClick={() => shareTour('copy', selectedTour)}
                                        className="bg-obsidian-bg hover:bg-obsidian-raised border border-obsidian-border text-obsidian-primary p-4 rounded-2xl flex flex-col items-center space-y-2 transition-colors"
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                    >
                                        <LinkIcon className="w-6 h-6 text-obsidian-secondary" />
                                        <span className="text-xs font-medium">Copia Link</span>
                                    </motion.button>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <ChatModalUser
                    isOpen={!!chatModalRequest}
                    onClose={() => setChatModalRequest(null)}
                    request={chatModalRequest}
                    userId={userId}
                    userName={firstName || 'Utente'}
                />
            </main>

            <BottomNavigation />
        </div>
    );
}
