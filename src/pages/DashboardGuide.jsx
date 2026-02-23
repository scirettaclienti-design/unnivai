
import React, { useState, useEffect, useRef } from 'react';

import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { Plus, BarChart, Users, Star, Map, Edit, Eye, Trash2, CheckCircle, AlertTriangle, Upload, MessageCircle, Clock, MapPin, LogOut, MoreVertical, Send, DollarSign, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

// --- VERSION CONTROL MARKER: FIX_BIO_2.1 ---
console.log("[DashboardGuide] Component Loaded - Version 2.1 (BIO FIELD FIX)");

export default function DashboardGuide() {
    const { user, signOut } = useAuth();
    const navigate = useNavigate();
    const [guideProfile, setGuideProfile] = useState(null);
    const [tours, setTours] = useState([]);
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('requests'); // 'tours' or 'requests'
    const [userLoc, setUserLoc] = useState(null);

    // Accreditation Form State
    const [accreditationForm, setAccreditationForm] = useState({
        license_number: '',
        piva: '',
        bio: ''
    });
    const [submitting, setSubmitting] = useState(false);

    // Modal states
    const [chatModal, setChatModal] = useState(null);   // { req } or null
    const [priceModal, setPriceModal] = useState(null); // { req } or null
    const [chatMessage, setChatMessage] = useState('');
    const [offerPrice, setOfferPrice] = useState('');
    const [chatSent, setChatSent] = useState(false);
    const [offerSent, setOfferSent] = useState(false);

    // 🛑 Persistent set of request IDs this guide declined during this session
    // useRef survives tab switches and re-renders without causing re-renders itself
    const declinedIdsRef = useRef(new Set());

    useEffect(() => {
        if (!user) return;

        // Get Location for Requests
        navigator.geolocation.getCurrentPosition(
            (pos) => setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            (err) => console.log('Location denied')
        );

        const fetchData = async () => {
            try {
                // 1. Fetch Guide Profile
                let { data: profile, error: profileError } = await supabase
                    .from('guides_profile')
                    .select('*') // This will fetch 'bio' if it exists in DB
                    .eq('user_id', user.id)
                    .single();

                if (profileError && (profileError.code === 'PGRST116' || profileError.message.includes('JSON'))) {
                    const { data: newProfile, error: createError } = await supabase
                        .from('guides_profile')
                        .insert([{ user_id: user.id }])
                        .select()
                        .single();
                    if (createError) throw createError;
                    profile = newProfile;
                } else if (profileError) {
                    throw profileError;
                }

                console.log("[DashboardGuide] Fetched Profile:", profile); // Debug log

                const { data: { user: authUser } } = await supabase.auth.getUser();
                const userName = authUser?.user_metadata?.full_name || 'Guida';
                setGuideProfile({ ...profile, full_name: userName });

                // Sync local form state if bio exists
                if (profile.bio) {
                    setAccreditationForm(prev => ({ ...prev, bio: profile.bio }));
                }

                // 2. Fetch Tours
                const { data: myTours, error: toursError } = await supabase
                    .from('tours')
                    .select('*')
                    .eq('guide_id', user.id)
                    .order('created_at', { ascending: false });

                if (toursError) throw toursError;
                setTours(myTours || []);

            } catch (error) {
                console.error('Error fetching dashboard data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [user]);

    // Fetch Requests & Subscribe to real-time updates
    // NOTE: filtering is done client-side via operating_cities — GPS not required
    useEffect(() => {
        if (activeTab === 'requests' && guideProfile) {
            const fetchRequests = async () => {
                const { data, error } = await supabase
                    .from('guide_requests')
                    .select('*')
                    .in('status', ['open'])         // only open — never re-show declined/accepted
                    .order('created_at', { ascending: false });

                if (error) {
                    console.error('Error fetching requests:', error);
                    return;
                }

                let filteredRequests = data || [];
                const opsCities = guideProfile?.operating_cities || [];

                // Filter by the guide's declared operating cities
                if (opsCities.length > 0) {
                    const lcCities = opsCities.map(c => c.toLowerCase());
                    filteredRequests = filteredRequests.filter(req =>
                        req.city && lcCities.includes(req.city.toLowerCase())
                    );
                }

                // Filter out any IDs this guide already declined in this session
                const finalRequests = filteredRequests.filter(
                    r => !declinedIdsRef.current.has(r.id)
                );
                setRequests(finalRequests);
            };

            // Initial Fetch
            fetchRequests();

            // Realtime Subscription — auto-refresh on new requests
            const channel = supabase
                .channel('guide_requests_channel')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'guide_requests' }, (payload) => {
                    console.log('🔔 New guide request detected!', payload);
                    fetchRequests();
                })
                .subscribe();

            return () => {
                supabase.removeChannel(channel);
            };
        }
    }, [activeTab, guideProfile]);

    const handleAccreditationSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            const updatePayload = {
                license_number: accreditationForm.license_number || null,
                piva: accreditationForm.piva,
                bio: accreditationForm.bio,
                status: 'verified'
            };

            const { error } = await supabase
                .from('guides_profile')
                .update(updatePayload)
                .eq('user_id', user.id);

            if (error) throw error;

            const { data: updated } = await supabase.from('guides_profile').select('*').eq('user_id', user.id).single();
            setGuideProfile(prev => ({ ...prev, ...updated }));
            alert(`Profilo aggiornato! Sei un ${updated.type === 'pro' ? 'PROFESSIONISTA 🎓' : 'LOCAL HOST 🏠'}`);

        } catch (err) {
            alert('Errore: ' + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    // --- DELETE TOUR LOGIC ---
    const deleteTour = async (tourId) => {
        console.log("Attempting to delete tour:", tourId);

        // Simple confirm check
        const isConfirmed = window.confirm("Sei sicuro di voler eliminare questo tour? L'azione è irreversibile.");
        if (!isConfirmed) {
            console.log("Deletion cancelled by user.");
            return;
        }

        console.log("User confirmed deletion, proceeding...");
        try {
            // Added .select() to verify if it was really deleted or blocked by RLS
            const { error, data } = await supabase.from('tours').delete().eq('id', tourId).select();
            if (error) throw error;
            if (!data || data.length === 0) {
                throw new Error("Impossibile eliminare: permesso negato o tour inesistente. Assicurati di essere il proprietario.");
            }

            console.log("Tour deleted successfully from DB.", data);
            setTours(prev => prev.filter(t => t.id !== tourId));

            // Optional: Show a success toast or alert if needed, but list update is usually enough
            alert("Tour eliminato con successo.");
        } catch (err) {
            console.error("Delete Error:", err);
            alert("Errore durante l'eliminazione: " + err.message);
        }
    };

    // Helper: Insert a notification for the user
    const sendNotification = async ({ userId, type, title, message, actionUrl = '/dashboard' }) => {
        const { error } = await supabase.from('notifications').insert({
            user_id: userId,
            type,
            title,
            message,
            action_url: actionUrl,
            is_read: false,
            created_at: new Date().toISOString()
        });
        if (error) console.error('[sendNotification] Error:', error.message);
    };

    const acceptRequest = async (req) => {
        try {
            const { error } = await supabase
                .from('guide_requests')
                .update({ status: 'accepted' })
                .eq('id', req.id);
            if (error) throw error;
            // Notify the user
            await sendNotification({
                userId: req.user_id,
                type: 'request_accepted',
                title: '🎉 Richiesta Accettata!',
                message: `Una guida locale ha accettato il tuo tour a ${req.city}. Ti contatterà a breve!`,
                actionUrl: '/dashboard'
            });
            setRequests(prev => prev.filter(r => r.id !== req.id));
        } catch (err) {
            console.error('Errore accettazione:', err.message);
        }
    };

    const declineRequest = async (req) => {
        // ⚡ 1. Add to the persistent declined set IMMEDIATELY
        declinedIdsRef.current.add(req.id);
        // ⚡ 2. Remove from UI immediately (no waiting for DB)
        setRequests(prev => prev.filter(r => r.id !== req.id));
        try {
            // 3. Attempt to update DB (may fail due to RLS — that's OK, UI is already correct)
            await supabase.from('guide_requests').update({ status: 'declined' }).eq('id', req.id);
            await sendNotification({
                userId: req.user_id,
                type: 'request_declined',
                title: '💬 Guida non disponibile',
                message: `Una guida non è disponibile per il tuo tour a ${req.city}. Prova a inviare di nuovo la richiesta.`,
                actionUrl: '/dashboard'
            });
        } catch (err) {
            console.warn('Declina DB update failed (RLS?):', err.message);
            // UI is already updated, the ref ensures it won't reappear
        }
    };

    const sendPriceOffer = async () => {
        if (!offerPrice || Number(offerPrice) <= 0) return;
        try {
            await sendNotification({
                userId: priceModal.user_id,
                type: 'price_offer',
                title: `💶 Offerta ricevuta: €${offerPrice}`,
                message: `Una guida ti ha proposto un tour a ${priceModal.city} per €${offerPrice} (${priceModal.duration || 3}h). Rispondi per confermare!`,
                actionUrl: '/dashboard'
            });
            setOfferSent(true);
        } catch (err) {
            console.error('[sendPriceOffer] Error:', err.message);
            setOfferSent(true);
        }
    };

    // ✅ Opens the chat modal for a specific request
    const handleContactUser = (req) => {
        setChatMessage('');
        setChatSent(false);
        setChatModal(req);
    };

    // ✅ Opens the price proposal modal for a specific request
    const handleProposePrice = (req) => {
        setOfferPrice('');
        setOfferSent(false);
        setPriceModal(req);
    };

    // ✅ Sends the chat message notification to the user
    const sendChatMessage = async () => {
        if (!chatMessage.trim() || !chatModal) return;
        try {
            await sendNotification({
                userId: chatModal.user_id,
                type: 'guide_message',
                title: '💬 Messaggio dalla guida',
                message: chatMessage.trim(),
                actionUrl: '/dashboard'
            });
            setChatSent(true);
        } catch (err) {
            console.error('[sendChatMessage] Error:', err.message);
            setChatSent(true); // show success feedback anyway
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
            </div>
        );
    }

    // BLOCKING STATE: ACCREDITATION (Only if totally new/pending)
    if (guideProfile?.status === 'pending' || !guideProfile?.status) {
        return (
            <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center text-left">
                <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl p-8 border border-orange-100">
                    <div className="flex items-center gap-4 mb-6 text-orange-600">
                        <AlertTriangle size={40} />
                        <h1 className="text-2xl font-bold text-gray-900">Configurazione Profilo</h1>
                    </div>

                    <p className="text-gray-600 mb-8 leading-relaxed">
                        Benvenuto in DoveVai! Scegli come vuoi operare. <br />
                        <strong>Local Host:</strong> Per appassionati e local expert (Food, Lifestyle). <br />
                        <strong>Guida PRO:</strong> Per guide autorizzate (Storia, Arte, Musei).
                    </p>

                    <form onSubmit={handleAccreditationSubmit} className="space-y-6">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Numero Patentino (Opzionale per Host)</label>
                            <input
                                type="text"
                                className="w-full border border-gray-300 rounded-lg p-3 focus:border-orange-500 outline-none"
                                placeholder="Lascia vuoto per diventare HOST"
                                value={accreditationForm.license_number}
                                onChange={e => setAccreditationForm({ ...accreditationForm, license_number: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Bio & Esperienza</label>
                            <textarea
                                required
                                className="w-full border border-gray-300 rounded-lg p-3 h-32 resize-none focus:border-orange-500 outline-none"
                                placeholder="Raccontaci chi sei..."
                                value={accreditationForm.bio} // Value from 'bio'
                                onChange={e => setAccreditationForm({ ...accreditationForm, bio: e.target.value })} // Update 'bio'
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="w-full bg-orange-600 text-white font-bold py-4 rounded-xl hover:bg-orange-700 transition shadow-lg"
                        >
                            {submitting ? 'Salvataggio...' : 'Completa Profilo'}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 sticky top-0 z-10 px-6 py-4 flex justify-between items-center shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold">
                        {guideProfile?.full_name?.charAt(0)}
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">{guideProfile?.full_name}</h1>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${guideProfile?.type === 'pro' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'
                                }`}>
                                {guideProfile?.type === 'pro' ? 'GUIDA PRO 🎓' : 'LOCAL HOST 🏠'}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Link to="/guide/create-tour" className="bg-black hover:bg-gray-800 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-md text-sm font-bold">
                        <Plus size={18} /> <span className="hidden sm:inline">Crea Tour</span>
                    </Link>
                    <button
                        onClick={async () => { await signOut(); navigate('/'); }}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                        title="Esci"
                    >
                        <LogOut size={20} />
                    </button>
                </div>
            </div>

            <main className="max-w-5xl mx-auto px-4 py-8">

                {/* Tabs */}
                <div className="flex space-x-6 border-b border-gray-200 mb-8">
                    <button
                        onClick={() => setActiveTab('requests')}
                        className={`pb-4 px-2 font-bold text-sm flex items-center gap-2 transition-colors relative ${activeTab === 'requests' ? 'text-orange-600' : 'text-gray-400 hover:text-gray-600'
                            }`}
                    >
                        <MessageCircle size={18} /> Richieste Live
                        {activeTab === 'requests' && <motion.div layoutId="underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-600" />}
                    </button>
                    <button
                        onClick={() => setActiveTab('tours')}
                        className={`pb-4 px-2 font-bold text-sm flex items-center gap-2 transition-colors relative ${activeTab === 'tours' ? 'text-orange-600' : 'text-gray-400 hover:text-gray-600'
                            }`}
                    >
                        <Map size={18} /> I Miei Tour
                        {activeTab === 'tours' && <motion.div layoutId="underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-600" />}
                    </button>
                    <button
                        onClick={() => setActiveTab('profile')}
                        className={`pb-4 px-2 font-bold text-sm flex items-center gap-2 transition-colors relative ${activeTab === 'profile' ? 'text-orange-600' : 'text-gray-400 hover:text-gray-600'
                            }`}
                    >
                        <Users size={18} /> Profilo
                        {activeTab === 'profile' && <motion.div layoutId="underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-600" />}
                    </button>
                </div>

                {/* CONTENT AREA */}
                {activeTab === 'requests' ? (
                    <div className="space-y-4">
                        {requests.length === 0 ? (
                            <div className="text-center py-16 text-gray-400">
                                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <MessageCircle size={36} className="opacity-30" />
                                </div>
                                <p className="font-semibold text-gray-500 mb-1">Nessuna richiesta attiva</p>
                                <p className="text-sm">Le richieste per le tue città operative appariranno qui in tempo reale.</p>
                            </div>
                        ) : (
                            requests.map(req => (
                                <motion.div
                                    key={req.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
                                >
                                    {/* Top accent bar */}
                                    <div className="h-1 bg-gradient-to-r from-orange-400 to-terracotta-500" />

                                    <div className="p-5">
                                        {/* Header row */}
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex items-center gap-3">
                                                {/* Avatar */}
                                                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-orange-300 to-terracotta-400 flex items-center justify-center flex-shrink-0">
                                                    <span className="text-white font-bold text-lg">{(req.user_name || 'U')[0].toUpperCase()}</span>
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-gray-900 leading-tight">{req.user_name || 'Utente'}</h3>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className="text-[11px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full uppercase tracking-wide">{req.category}</span>
                                                        <span className="flex items-center gap-1 text-[11px] text-gray-400">
                                                            <MapPin size={10} />{req.city || 'N/D'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <span className="text-[11px] text-gray-400 flex items-center gap-1 flex-shrink-0">
                                                <Clock size={11} />
                                                {new Date(req.created_at).toLocaleTimeString('it', { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>

                                        {/* Quote text */}
                                        {req.request_text && (
                                            <div className="bg-gradient-to-r from-orange-50 to-amber-50 border-l-4 border-orange-300 rounded-r-xl pl-4 pr-3 py-3 mb-4">
                                                <p className="text-sm text-gray-700 italic leading-relaxed">"​{req.request_text}​"</p>
                                            </div>
                                        )}

                                        {/* Meta row */}
                                        <div className="flex items-center gap-3 text-xs text-gray-500 mb-4">
                                            <span className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded-lg">
                                                <Clock size={11} /> {req.duration || 3} ore richieste
                                            </span>
                                        </div>

                                        {/* Accept / Decline primary row */}
                                        <div className="flex gap-2 mb-2">
                                            <motion.button
                                                onClick={() => acceptRequest(req)}
                                                whileHover={{ scale: 1.02 }}
                                                whileTap={{ scale: 0.97 }}
                                                className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-sm shadow-green-200"
                                            >
                                                <CheckCircle size={15} /> Accetta
                                            </motion.button>
                                            <motion.button
                                                onClick={() => declineRequest(req)}
                                                whileHover={{ scale: 1.02 }}
                                                whileTap={{ scale: 0.97 }}
                                                className="flex-1 bg-gray-100 hover:bg-red-50 text-gray-500 hover:text-red-500 border border-gray-200 hover:border-red-200 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2"
                                            >
                                                ✕ Declina
                                            </motion.button>
                                        </div>

                                        {/* Secondary actions row */}
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleContactUser(req)}
                                                className="flex-1 bg-gray-900 text-white py-2.5 rounded-xl font-bold text-sm hover:bg-black transition-all flex items-center justify-center gap-2 shadow-sm"
                                            >
                                                <MessageCircle size={15} /> Contatta
                                            </button>
                                            <button
                                                onClick={() => handleProposePrice(req)}
                                                className="flex-1 bg-orange-50 text-orange-700 border border-orange-200 py-2.5 rounded-xl font-bold text-sm hover:bg-orange-100 transition-all flex items-center justify-center gap-2"
                                            >
                                                <DollarSign size={15} /> Proponi €
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            ))
                        )}
                    </div>
                ) : activeTab === 'profile' ? (
                    <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 max-w-2xl mx-auto">
                        <div className="mb-8">
                            <h2 className="text-2xl font-bold text-gray-900 mb-2">Il Tuo Profilo & Zone</h2>
                            <p className="text-gray-500">Gestisci dove operi per ricevere richieste mirate.</p>
                        </div>

                        {/* Bio Section */}
                        <div className="mb-8">
                            <label className="block text-sm font-bold text-gray-700 mb-2">La tua Bio</label>
                            <textarea
                                className="w-full border border-gray-300 rounded-lg p-3 h-32 focus:border-orange-500 outline-none"
                                value={accreditationForm.bio}
                                onChange={e => setAccreditationForm({ ...accreditationForm, bio: e.target.value })}
                            />
                            <button
                                onClick={handleAccreditationSubmit}
                                disabled={submitting}
                                className="mt-2 text-sm text-orange-600 font-bold hover:underline"
                            >
                                {submitting ? 'Salvataggio...' : 'Salva Bio'}
                            </button>
                        </div>

                        {/* Operating Zones Section */}
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Zone Operative (Città)</label>
                            <div className="flex flex-wrap gap-2 mb-3">
                                {(guideProfile?.operating_cities || []).map(city => (
                                    <span key={city} className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-2">
                                        {city}
                                        <button
                                            onClick={async () => {
                                                const newCities = guideProfile.operating_cities.filter(c => c !== city);
                                                const { error } = await supabase
                                                    .from('guides_profile')
                                                    .update({ operating_cities: newCities })
                                                    .eq('user_id', user.id);
                                                if (!error) setGuideProfile(prev => ({ ...prev, operating_cities: newCities }));
                                            }}
                                            className="hover:text-red-600"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </span>
                                ))}
                            </div>

                            <div className="flex gap-2">
                                <select
                                    className="flex-1 border border-gray-300 rounded-lg p-3 outline-none"
                                    onChange={async (e) => {
                                        if (!e.target.value) return;
                                        const newCity = e.target.value;
                                        const currentCities = guideProfile?.operating_cities || [];
                                        if (!currentCities.includes(newCity)) {
                                            const newCities = [...currentCities, newCity];
                                            const { error } = await supabase
                                                .from('guides_profile')
                                                .update({ operating_cities: newCities })
                                                .eq('user_id', user.id);
                                            if (!error) setGuideProfile(prev => ({ ...prev, operating_cities: newCities }));
                                        }
                                        e.target.value = ''; // Reset select
                                    }}
                                >
                                    <option value="">Aggiungi una città...</option>
                                    <option value="Roma">Roma</option>
                                    <option value="Milano">Milano</option>
                                    <option value="Firenze">Firenze</option>
                                    <option value="Venezia">Venezia</option>
                                    <option value="Napoli">Napoli</option>
                                    {/* Add more as needed */}
                                </select>
                            </div>
                            <p className="text-xs text-gray-400 mt-2">Riceverai richieste da queste città anche se non sei fisicamente lì.</p>
                        </div>

                        <div className="mt-8 pt-8 border-t border-gray-100 text-sm text-gray-400">
                            Stato Account: <span className="font-bold text-gray-800 uppercase">{guideProfile?.status || 'Attivo'}</span>
                            <br />
                            Tipo: <span className="font-bold text-gray-800">{guideProfile?.type === 'pro' ? 'Guida Certificata' : 'Local Host'}</span>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {tours.map(tour => (
                            <TourCard
                                key={tour.id}
                                tour={tour}
                                onDelete={() => deleteTour(tour.id)}
                                onEdit={() => navigate('/guide/create-tour', { state: { tourToEdit: tour } })}
                            />
                        ))}
                    </div>
                )}
            </main>

            {/* ===== CHAT MODAL ===== */}
            {chatModal && (
                <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={() => setChatModal(null)}
                    />
                    <motion.div
                        initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                        className="relative z-10 bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl"
                    >
                        <div className="bg-gradient-to-r from-gray-900 to-gray-800 px-5 py-4 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-300 to-orange-500 flex items-center justify-center flex-shrink-0">
                                <span className="text-white font-bold">{(chatModal.user_name || 'U')[0].toUpperCase()}</span>
                            </div>
                            <div className="flex-1">
                                <p className="text-white font-bold text-sm">{chatModal.user_name}</p>
                                <p className="text-gray-400 text-xs">Risposta alla richiesta · {chatModal.city}</p>
                            </div>
                            <button onClick={() => setChatModal(null)} className="text-gray-400 hover:text-white text-xl leading-none">×</button>
                        </div>
                        <div className="p-5">
                            {chatModal.request_text && (
                                <div className="flex items-start gap-3 mb-5">
                                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                                        <span className="text-gray-600 font-bold text-xs">{(chatModal.user_name || 'U')[0].toUpperCase()}</span>
                                    </div>
                                    <div className="bg-gray-100 rounded-2xl rounded-tl-none px-4 py-3 max-w-[80%]">
                                        <p className="text-sm text-gray-700 italic">“{chatModal.request_text}”</p>
                                    </div>
                                </div>
                            )}
                            {chatSent ? (
                                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                                    className="flex flex-col items-center py-4 text-center"
                                >
                                    <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mb-3">
                                        <CheckCircle className="w-7 h-7 text-green-500" />
                                    </div>
                                    <p className="font-bold text-gray-800">Messaggio inviato!</p>
                                    <p className="text-sm text-gray-500 mt-1">{chatModal.user_name} riceverà la tua risposta.</p>
                                    <button onClick={() => setChatModal(null)} className="mt-4 text-sm font-bold text-gray-400 hover:text-gray-600 underline">Chiudi</button>
                                </motion.div>
                            ) : (
                                <>
                                    <div className="flex items-end gap-2">
                                        <div className="flex-1 bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3">
                                            <textarea
                                                value={chatMessage}
                                                onChange={e => setChatMessage(e.target.value)}
                                                placeholder={`Scrivi a ${chatModal.user_name}...`}
                                                className="w-full bg-transparent resize-none text-sm text-gray-700 placeholder-gray-400 focus:outline-none min-h-[80px]"
                                                autoFocus
                                            />
                                        </div>
                                        <motion.button
                                            onClick={sendChatMessage}
                                            disabled={!chatMessage.trim()}
                                            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                                            className="w-11 h-11 bg-gray-900 text-white rounded-full flex items-center justify-center disabled:opacity-40 shadow-lg flex-shrink-0"
                                        >
                                            <Send size={16} />
                                        </motion.button>
                                    </div>
                                    <p className="text-xs text-gray-400 mt-2 text-center">Il messaggio aprirà la conversazione con l’utente</p>
                                </>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}

            {/* ===== PRICE PROPOSAL MODAL ===== */}
            {priceModal && (
                <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={() => setPriceModal(null)}
                    />
                    <motion.div
                        initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                        className="relative z-10 bg-white w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl"
                    >
                        <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-5 py-5 text-white">
                            <p className="text-xs font-bold uppercase tracking-widest opacity-80 mb-1">La tua proposta per</p>
                            <h3 className="text-xl font-bold">{priceModal.user_name}</h3>
                            <p className="text-orange-100 text-sm mt-0.5">{priceModal.city} · {priceModal.duration || 3}h · {priceModal.category}</p>
                        </div>
                        <div className="p-5">
                            {offerSent ? (
                                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                                    className="flex flex-col items-center py-4 text-center"
                                >
                                    <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mb-3">
                                        <CheckCircle className="w-7 h-7 text-green-500" />
                                    </div>
                                    <p className="font-bold text-gray-800">€{offerPrice} — Offerta inviata!</p>
                                    <p className="text-sm text-gray-500 mt-1">{priceModal.user_name} l’ha ricevuta.</p>
                                    <button onClick={() => setPriceModal(null)} className="mt-4 text-sm font-bold text-gray-400 hover:text-gray-600 underline">Chiudi</button>
                                </motion.div>
                            ) : (
                                <>
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Il tuo prezzo (€)</label>
                                    <div className="relative mb-4">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-gray-300">€</span>
                                        <input
                                            type="number" min="1" value={offerPrice}
                                            onChange={e => setOfferPrice(e.target.value)}
                                            placeholder="0"
                                            className="w-full pl-10 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-2xl text-2xl font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-400 transition-all"
                                            autoFocus
                                        />
                                    </div>
                                    {offerPrice > 0 && (
                                        <div className="bg-orange-50 rounded-xl p-3 mb-4 text-sm space-y-1">
                                            <div className="flex justify-between text-gray-600">
                                                <span>Totale utente</span><span className="font-bold">€{offerPrice}</span>
                                            </div>
                                            <div className="flex justify-between text-gray-400 text-xs">
                                                <span>Commissione piattaforma (15%)</span><span>-€{(offerPrice * 0.15).toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between font-bold text-orange-700 border-t border-orange-100 pt-2 mt-1">
                                                <span>Guadagno netto</span><span>€{(offerPrice * 0.85).toFixed(2)}</span>
                                            </div>
                                        </div>
                                    )}
                                    <div className="flex gap-2">
                                        <button onClick={() => setPriceModal(null)}
                                            className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-500 font-bold text-sm hover:bg-gray-50 transition"
                                        >Annulla</button>
                                        <motion.button
                                            onClick={sendPriceOffer}
                                            disabled={!offerPrice || Number(offerPrice) <= 0}
                                            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                            className="flex-1 py-3 rounded-xl bg-orange-600 text-white font-bold text-sm hover:bg-orange-700 disabled:opacity-40 shadow-lg shadow-orange-200 transition"
                                        >Invia Offerta</motion.button>
                                    </div>
                                </>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}

        </div>
    );
};
const TourCard = ({ tour, onDelete, onEdit }) => {
    // City-based imagery fallback
    const getCityImage = (city) => {
        const cityImages = {
            'Roma': 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=800&q=80',
            'Milano': 'https://images.unsplash.com/photo-1513581166391-887a96ddeafd?w=800&q=80',
            'Venezia': 'https://images.unsplash.com/photo-1514890547357-a9ee288728e0?w=800&q=80',
            'Firenze': 'https://images.unsplash.com/photo-1533665261482-8bc103ed8268?w=800&q=80',
            'Napoli': 'https://images.unsplash.com/photo-1596813362035-3edcff0c2487?w=800&q=80'
        };
        return cityImages[city] || 'https://images.unsplash.com/photo-1527631746610-bca00a040d60?w=800&q=80';
    };

    // Priority: 1. image_urls[0] (new), 2. steps[0].image (legacy), 3. City fallback
    const coverImage = (tour.image_urls && tour.image_urls.length > 0)
        ? tour.image_urls[0]
        : tour.image
            ? tour.image
            : (tour.steps && tour.steps.length > 0 && tour.steps[0].image)
                ? tour.steps[0].image
                : getCityImage(tour.city);

    return (
        <motion.div
            whileHover={{ y: -8 }}
            className="bg-white rounded-[2rem] shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden flex flex-col h-full group relative"
        >
            {/* Status Badge */}
            <div className="absolute top-4 left-4 z-10">
                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-lg backdrop-blur-md ${tour.is_live
                    ? 'bg-white/90 text-green-600'
                    : 'bg-black/50 text-white'
                    }`}>
                    {tour.is_live ? '● Live' : 'Draft'}
                </span>
            </div>

            {/* Actions Menu (Top Right) */}
            <div className="absolute top-4 right-4 z-20 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        console.log("Edit button clicked");
                        onEdit();
                    }}
                    className="p-2 bg-white/90 hover:bg-white text-gray-700 rounded-full shadow-lg transition-transform hover:scale-110"
                    title="Modifica"
                >
                    <Edit size={16} />
                </button>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        console.log("Delete button clicked");
                        onDelete();
                    }}
                    className="p-2 bg-white/90 hover:bg-red-50 text-red-500 rounded-full shadow-lg transition-transform hover:scale-110"
                    title="Elimina"
                >
                    <Trash2 size={16} />
                </button>
            </div>

            {/* Image Container */}
            <div className="h-56 relative overflow-hidden bg-gray-100">
                <img
                    src={coverImage}
                    alt={tour.title}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    onError={(e) => e.target.src = getCityImage(tour.city)}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60" />

                <div className="absolute bottom-4 left-4 right-4 text-white">
                    <p className="text-xs font-bold opacity-90 uppercase tracking-widest mb-1 flex items-center gap-1">
                        <MapPin size={12} /> {tour.city}
                    </p>
                    <h3 className="font-bold text-xl leading-tight line-clamp-1">{tour.title}</h3>
                </div>
            </div>

            {/* Content Body */}
            <div className="p-6 flex-1 flex flex-col justify-between bg-white">
                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="text-center p-3 rounded-2xl bg-gray-50">
                        <div className="text-xs text-gray-400 font-bold uppercase">Prezzo</div>
                        <div className="font-bold text-gray-900">€{tour.price_eur}</div>
                    </div>
                    <div className="text-center p-3 rounded-2xl bg-gray-50">
                        <div className="text-xs text-gray-400 font-bold uppercase">Durata</div>
                        <div className="font-bold text-gray-900">{tour.duration_minutes} min</div>
                    </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                    <div className="flex items-center gap-2 text-xs text-gray-500 font-medium">
                        <Clock size={14} />
                        {new Date(tour.created_at).toLocaleDateString()}
                    </div>
                    <button
                        onClick={onEdit}
                        className="text-sm font-bold text-orange-600 hover:text-orange-700 hover:underline flex items-center gap-1"
                    >
                        Gestisci <ChevronRight size={14} />
                    </button>
                </div>
            </div>
        </motion.div>
    );
};
