import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { MapPin, Edit, Star, Image as ImageIcon, Briefcase, Lock, Save, Trophy, TrendingUp, MousePointer, Eye, LogOut, Map, Zap, Target, ChevronRight, Globe, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AddressAutocomplete from '../components/AddressAutocomplete';
import ImageUploader from '../components/ImageUploader';
import { aiRecommendationService } from '../services/aiRecommendationService';
import { Sparkles, Check } from 'lucide-react';
import Toast from '../components/ToastNotification';

const CATEGORY_TAGS = [
    'Ristorazione', 'Ospitalità', 'Shopping', 'Artigianato', 'Cultura',
    'Tech', 'Lusso', 'Storia', 'Nightlife', 'Relax', 'Avventura'
];

export default function DashboardBusiness() {
    const { user, signOut } = useAuth();
    const navigate = useNavigate();
    const [business, setBusiness] = useState(null);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);

    // Toast State
    const [toast, setToast] = useState({ message: '', type: 'info', isVisible: false });

    // Analytics (Mocked for Demo Persistence)
    const [analytics, setAnalytics] = useState({
        views: 1240,
        clicks: 350,
        saves: 45,
        conversions: 12
    });

    // Form State
    const [formData, setFormData] = useState({
        company_name: '',
        category_tags: [],
        subscription_tier: 'free',
        description: '',
        address: '',
        website: '',
        instagram_handle: '',
        menu_url: '',
        image_urls: [],
        city: '',
        ai_metadata: null,
        latitude: null, // Ensure these are part of state
        longitude: null
    });
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    const showToast = (message, type = 'info') => {
        setToast({ message, type, isVisible: true });
        // Auto-hide handled by component, but we can reset if needed
    };

    const handleToastClose = () => {
        setToast({ ...toast, isVisible: false });
    };

    useEffect(() => {
        if (!user) return;

        const fetchBusiness = async () => {
            try {
                // 1. Fetch Profile Linked to User
                let { data, error } = await supabase
                    .from('businesses_profile')
                    .select('*')
                    .eq('user_id', user.id)
                    .single();

                if (error && (error.code === 'PGRST116' || error.message.includes('JSON'))) {
                    // Create default if missing
                    console.log("⚠️ No profile found. Creating default...");
                    const { data: newProfile, error: createError } = await supabase
                        .from('businesses_profile')
                        .insert([{
                            user_id: user.id,
                            company_name: 'La Mia Attività',
                            // Default values to avoid nulls
                            description: '',
                            city: '',
                            address: ''
                        }])
                        .select()
                        .single();

                    if (createError) throw createError;
                    data = newProfile;
                } else if (error) {
                    throw error;
                }

                console.log("✅ Profile Loaded:", data);
                setBusiness(data);

                // Parse Location if exists
                let lat = data.latitude || null;
                let lng = data.longitude || null;
                // Fallback to postgis point if exists but missing lat/lng (for legacy records)
                if (!lat && !lng && data.location && typeof data.location === 'string' && data.location.includes('POINT')) {
                    const parts = data.location.replace('POINT(', '').replace(')', '').split(' ');
                    lng = parseFloat(parts[0]);
                    lat = parseFloat(parts[1]);
                }

                setFormData({
                    company_name: data.company_name || '',
                    category_tags: data.category_tags || [],
                    subscription_tier: data.subscription_tier || 'free',
                    description: data.description || '',
                    address: data.address || '',
                    website: data.website || '',
                    instagram_handle: data.instagram_handle || '',
                    menu_url: data.menu_url || '',
                    image_urls: data.image_urls || [],
                    city: data.city || '',
                    ai_metadata: data.ai_metadata || null,
                    latitude: lat,
                    longitude: lng
                });
            } catch (err) {
                console.error('Error fetching business:', err);
                // 🤫 SILENT MODE: Don't show toast for fetch errors.
                // If profile missing, we just show empty form and UPSERT will fix it on save.
                // showToast("Errore caricamento dati: " + err.message, 'error');
            } finally {
                setLoading(false);
            }
        };

        fetchBusiness();
    }, [user]);

    const analyzeWithAI = async () => {
        if (!formData.description || formData.description.length < 20) {
            showToast("Scrivi una descrizione più lunga per l'AI!", 'warning');
            return;
        }
        setIsAnalyzing(true);
        try {
            // Pass Full Context
            const context = {
                description: formData.description,
                website: formData.website,
                instagram: formData.instagram_handle,
                image_urls: formData.image_urls // Pass images for Vision analysis
            };

            const analysis = await aiRecommendationService.analyzeBusinessDescription(context);
            if (analysis) {
                setFormData(prev => ({ ...prev, ai_metadata: analysis }));
                showToast("✨ Analisi AI Completata: Profilo Ottimizzato!", 'success');
            } else {
                showToast("Impossibile generare l'analisi.", 'error');
            }
        } catch (e) {
            console.error(e);
            showToast("Errore analisi AI", 'error');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const toggleTag = (tag) => {
        const currentTags = formData.category_tags || [];
        if (currentTags.includes(tag)) {
            setFormData({ ...formData, category_tags: currentTags.filter(t => t !== tag) });
        } else {
            if (currentTags.length >= 3) return showToast('Massimo 3 tag', 'warning');
            setFormData({ ...formData, category_tags: [...currentTags, tag] });
        }
    };

    const updateLocation = () => {
        if (!navigator.geolocation) return showToast('Geolocalizzazione non supportata', 'error');
        navigator.geolocation.getCurrentPosition(async (pos) => {
            const { latitude, longitude } = pos.coords;
            setFormData(prev => ({ ...prev, latitude, longitude }));

            // Update location in PostGIS format immediately? Or wait for save?
            // Better wait for save to batch updates.
            showToast('Posizione GPS acquisita! Clicca Salva per confermare.', 'success');
        }, (err) => showToast('Errore GPS: ' + err.message, 'error'));
    };

    // Address Autocomplete Callback
    // Address Autocomplete Callback
    const handleAddressSelect = (selection) => {
        const { address, lat, lng, raw } = selection;

        // Extract city from raw Nominatim data
        const addr = raw.address || {};
        // Prioritize city over village, and map "Roma Capitale" to "Roma" if needed
        let city = addr.city || addr.town || addr.municipality || addr.village || '';
        if (addr.county && addr.county.toLowerCase().includes('roma')) {
             city = 'Roma'; // Fallback fast for Rome
        }

        setFormData(prev => ({
            ...prev,
            address: address,
            latitude: lat,
            longitude: lng,
            city: city || prev.city // Fallback to existing if not found
        }));
    };

    const saveChanges = async () => {
        // 🛡️ VALIDAZIONE BASE
        if (!formData.company_name?.trim()) return showToast('Il nome dell\'attività è obbligatorio!', 'warning');
        if (!formData.address?.trim()) return showToast('L\'indirizzo è obbligatorio per la mappa!', 'warning');

        // 🔥 CRITICAL: If address is present but no coords, try to geocode ON SAVE
        let finalLat = formData.latitude;
        let finalLng = formData.longitude;
        let finalCity = formData.city; // Start with current form data

        if ((!finalLat || !finalLng) && formData.address) {
            console.log("📍 Geolocating address on save...", formData.address);
            try {
                // Add addressdetails=1 to get city info
                const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(formData.address)}&limit=1&addressdetails=1`);
                const data = await response.json();
                if (data && data.length > 0) {
                    finalLat = parseFloat(data[0].lat);
                    finalLng = parseFloat(data[0].lon);

                    // Extract city from address details
                    const addr = data[0].address || {};
                    let geoCity = addr.city || addr.town || addr.municipality || addr.village;
                    if (addr.county && addr.county.toLowerCase().includes('roma')) {
                         geoCity = 'Roma';
                    }
                    // Only override city if it was empty, respect user's manual change otherwise
                    finalCity = finalCity || geoCity;

                    console.log("✅ Geocoded:", finalLat, finalLng, "City:", finalCity);
                } else {
                    console.warn("⚠️ Could not geocode address.");
                    // Non-blocking warning: Save anyway but warn user about map visibility
                    showToast("Attenzione: Indirizzo non trovato sulla mappa (ma salvato).", 'warning');
                }
            } catch (e) {
                console.error("Geocoding error", e);
            }
        }

        try {
            console.log("💾 Saving Business Profile...", formData);

            const updates = {
                company_name: formData.company_name,
                category_tags: formData.category_tags,
                description: formData.description,
                address: formData.address,
                website: formData.website,
                instagram_handle: formData.instagram_handle,
                menu_url: formData.menu_url,
                image_urls: formData.image_urls,
                city: finalCity || 'Non specificata', // Use geocoded city
                ai_metadata: formData.ai_metadata
            };

            // Geo-Location Logic
            if (finalLat && finalLng) {
                console.log(`📍 Updating Location: ${finalLat}, ${finalLng}, City: ${finalCity}`);
                updates.latitude = finalLat;
                updates.longitude = finalLng;
                updates.location = `POINT(${finalLng} ${finalLat})`;
                updates.city = finalCity || updates.city; // Ensure it updates
            }

            // 🔄 UPSERT: id must match user.id due to Foreign Key constraint
            const { error } = await supabase
                .from('businesses_profile')
                .upsert({
                    ...updates,
                    id: user.id, // CRITICAL FIX: id is FK to users.id
                    user_id: user.id
                }, {
                    onConflict: 'user_id'
                });

            if (error) {
                // Specific helpful error for missing columns
                if (error.message && error.message.includes('column') && error.message.includes('does not exist')) {
                    throw new Error("Errore Database: Mancano delle colonne. Esegui lo script SQL di migrazione!");
                }
                throw error;
            }

            console.log("✅ Profile Saved Successfully");
            // Also explicitly update the lat/lng state so a refresh doesn't wipe if we didn't full reload
            setFormData(prev => ({
                ...prev,
                latitude: finalLat,
                longitude: finalLng
            }));
            setBusiness({ ...business, ...formData, latitude: finalLat, longitude: finalLng });
            setEditing(false);

            // 🔥 FEEDBACK SOLIDO (TOAST)
            showToast("Profilo Salvato con Successo! 🚀", 'success');

            // Optional: Ask to navigate
            /*
            if (window.confirm("Vuoi vedere il tuo profilo nella mappa ora?")) {
                 navigate('/explore');
            }
            */

        } catch (err) {
            console.error('❌ Save Error:', err);
            showToast('Errore Salvataggio: ' + (err.message || 'Sconosciuto'), 'error');
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="animate-spin h-10 w-10 border-2 border-orange-500 rounded-full border-t-transparent" />
            </div>
        );
    }

    const isElite = business?.subscription_tier === 'elite';

    // ── Reusable section card header ──────────────────────────────────────────
    const SectionHeader = ({ icon: Icon, label, iconColor = 'text-orange-500', action }) => (
        <div className={`flex items-center justify-between px-5 py-4 border-b ${isElite ? 'border-slate-800/50 bg-slate-900/40 backdrop-blur-md' : 'border-slate-100 bg-slate-50/50'}`}>
            <div className="flex items-center gap-2.5">
                <Icon className={`w-4.5 h-4.5 ${isElite && iconColor === 'text-orange-500' ? 'text-amber-400' : iconColor}`} size={18} />
                <span className={`font-semibold text-sm ${isElite ? 'text-white' : 'text-slate-800'}`}>{label}</span>
            </div>
            {action}
        </div>
    );

    return (
        <div className={`min-h-screen pb-24 md:pb-8 ${isElite ? 'bg-slate-900/95 text-slate-200' : 'bg-slate-50 text-gray-800'}`}>
            <Toast message={toast.message} type={toast.type} isVisible={toast.isVisible} onClose={handleToastClose} />

            {/* ── TOP BAR ── */}
            <div className={`border-b sticky top-0 z-30 transition-all duration-500 backdrop-blur-xl ${isElite ? 'bg-slate-900/80 border-slate-800 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)]' : 'bg-white/80 border-slate-200 shadow-sm'}`}>
                <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
                    {/* Brand */}
                    <div className="flex items-center gap-4">
                        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shadow-lg transition-transform hover:scale-105 ${isElite ? 'bg-gradient-to-br from-[#f6d365] to-[#d4af37] shadow-amber-500/20' : 'bg-gradient-to-br from-orange-500 to-rose-500 shadow-orange-500/20'}`}>
                            {isElite ? <Trophy className="w-5 h-5 text-white" /> : <Briefcase className="w-5 h-5 text-white" />}
                        </div>
                        <div>
                            <p className={`font-black text-lg sm:text-xl leading-tight tracking-tight ${isElite ? 'bg-clip-text text-transparent bg-gradient-to-r from-amber-200 to-yellow-500 drop-shadow-sm' : 'text-slate-800 drop-shadow-sm'}`}>
                                {business?.company_name || 'La Mia Attività'}
                            </p>
                            <p className="flex items-center gap-1.5 text-[11px] mt-0.5">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest shadow-sm ${isElite ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-white text-orange-600 border border-orange-200'}`}>
                                    {isElite ? <><Sparkles size={10} /> ELITE PARTNER</> : 'PIANO BASE'}
                                </span>
                                <span className={isElite ? 'text-slate-600' : 'text-slate-300'}>•</span>
                                <span className={`font-semibold ${isElite ? 'text-slate-400' : 'text-slate-500'}`}>{business?.city || 'Posizione non impostata'}</span>
                            </p>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                        {!editing ? (
                            <button
                                onClick={() => setEditing(true)}
                                className={`flex items-center gap-1.5 px-4 py-2 text-white rounded-xl text-xs font-bold transition-all shadow-md hover:-translate-y-0.5 ${isElite ? 'bg-gradient-to-r from-amber-500 to-yellow-500 hover:shadow-amber-500/25' : 'bg-gradient-to-r from-orange-500 to-rose-500 hover:shadow-orange-500/25'}`}
                            >
                                <Edit size={14} /> Modifica
                            </button>
                        ) : (
                            <>
                                <button
                                    onClick={() => setEditing(false)}
                                    className={`px-4 py-2 font-semibold text-xs transition-colors rounded-xl ${isElite ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}
                                >
                                    Annulla
                                </button>
                                <button
                                    onClick={saveChanges}
                                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl text-xs font-bold transition-all shadow-md hover:-translate-y-0.5 hover:shadow-emerald-500/25 active:scale-95"
                                >
                                    <Save size={14} /> Salva
                                </button>
                            </>
                        )}
                        <button onClick={() => signOut()} className={`p-2 transition-colors rounded-xl ml-1 ${isElite ? 'text-slate-500 hover:text-red-400 hover:bg-slate-800' : 'text-slate-400 hover:text-red-500 hover:bg-red-50'}`} title="Esci">
                            <LogOut size={18} />
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">

                {/* ── ANALYTICS STRIP ── */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                        { label: 'Visualizzazioni', value: analytics.views, icon: Eye, color: isElite ? 'text-amber-400' : 'text-blue-500', bg: isElite ? 'bg-amber-400/10' : 'bg-blue-50/70', border: isElite ? 'border-amber-500/20' : 'border-blue-100/50' },
                        { label: 'Click Scheda', value: analytics.clicks, icon: MousePointer, color: isElite ? 'text-amber-500' : 'text-purple-500', bg: isElite ? 'bg-amber-500/10' : 'bg-purple-50/70', border: isElite ? 'border-amber-500/20' : 'border-purple-100/50' },
                        { label: 'Salvataggi', value: analytics.saves, icon: Star, color: isElite ? 'text-amber-600' : 'text-orange-500', bg: isElite ? 'bg-amber-600/10' : 'bg-orange-50/70', border: isElite ? 'border-amber-500/20' : 'border-orange-100/50' },
                        { label: 'Conversioni', value: analytics.conversions + '%', icon: TrendingUp, color: isElite ? 'text-yellow-500' : 'text-emerald-500', bg: isElite ? 'bg-yellow-500/10' : 'bg-emerald-50/70', border: isElite ? 'border-amber-500/20' : 'border-emerald-100/50' },
                    ].map((s, i) => (
                        <div key={i} className={`rounded-2xl p-5 flex items-center gap-4 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md border-2 ${isElite ? 'bg-gradient-to-br from-slate-900 to-slate-800 ' + s.border : 'bg-white ' + s.border}`}>
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${s.bg}`}>
                                <s.icon className={`w-5 h-5 ${s.color}`} />
                            </div>
                            <div>
                                <p className={`text-3xl font-black leading-none tracking-tight ${isElite ? 'text-white' : 'text-slate-800'}`}>{s.value}</p>
                                <p className={`text-[10px] uppercase tracking-widest font-bold mt-1.5 ${isElite ? 'text-slate-400' : 'text-slate-400'}`}>{s.label}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* ── 2-COLUMN GRID ── */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

                    {/* LEFT — 2/3 */}
                    <div className="lg:col-span-2 space-y-5">

                        {/* PHOTOS */}
                        <div className={`rounded-3xl shadow-sm overflow-hidden border ${isElite ? 'bg-slate-800/80 border-slate-700/50 backdrop-blur-md' : 'bg-white border-slate-200/60'}`}>
                            <SectionHeader
                                icon={ImageIcon}
                                label="Galleria fotografica"
                                action={<span className="text-[11px] text-gray-400 bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-full">Max 5 foto</span>}
                            />
                            <div className="p-5">
                                {editing ? (
                                    <ImageUploader
                                        userId={user.id}
                                        images={formData.image_urls}
                                        onImagesChange={(urls) => setFormData({ ...formData, image_urls: urls })}
                                    />
                                ) : (
                                    <>
                                        {formData.image_urls && formData.image_urls.length > 0 ? (
                                            <div className="grid grid-cols-3 gap-2.5">
                                                {formData.image_urls.map((url, i) => (
                                                    <div key={i} className="aspect-square rounded-xl overflow-hidden bg-gray-50">
                                                        <img
                                                            src={url}
                                                            alt={`Foto ${i + 1}`}
                                                            className="w-full h-full object-cover hover:scale-105 transition duration-500"
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => setEditing(true)}
                                                className={`w-full py-12 flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed transition-all duration-300 ${isElite ? 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-amber-500 hover:text-amber-400' : 'border-slate-200 bg-slate-50/80 text-slate-400 hover:border-orange-400 hover:text-orange-500 hover:bg-orange-50/50'}`}
                                            >
                                                <ImageIcon size={32} className="mb-1 opacity-80" />
                                                <span className="text-sm font-bold tracking-wide">Aggiungi le tue foto</span>
                                                <span className="text-[11px] opacity-75 uppercase tracking-widest font-semibold">Clicca per caricare</span>
                                            </button>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>

                        {/* DETAILS */}
                        <div className={`rounded-3xl shadow-sm overflow-hidden border ${isElite ? 'bg-slate-800/80 border-slate-700/50 backdrop-blur-md' : 'bg-white border-slate-200/60'}`}>
                            <SectionHeader
                                icon={Edit}
                                label="Dettagli attività"
                                iconColor="text-blue-500"
                                action={editing && (
                                    <button
                                        onClick={analyzeWithAI}
                                        disabled={isAnalyzing}
                                        className="flex items-center gap-1 text-xs text-purple-600 font-semibold hover:text-purple-700 disabled:opacity-50 bg-purple-50 px-2.5 py-1 rounded-full border border-purple-100 transition"
                                    >
                                        <Sparkles size={12} />
                                        {isAnalyzing ? 'Analisi...' : 'Analisi AI'}
                                    </button>
                                )}
                            />
                            <div className="p-5 space-y-4">
                                {/* Row 1: Name + Address */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className={`block text-xs font-semibold uppercase tracking-wide mb-1.5 ${isElite ? 'text-slate-400' : 'text-gray-500'}`}>Nome Attività</label>
                                        {editing ? (
                                            <input
                                                type="text"
                                                className={`w-full border rounded-xl px-4 py-3 text-sm focus:ring-4 focus:border-transparent transition-all outline-none ${isElite ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400 focus:ring-amber-500/20 focus:border-amber-400' : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 shadow-sm focus:ring-orange-500/10 focus:border-orange-500'}`}
                                                value={formData.company_name}
                                                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                                                placeholder="Es. Trattoria da Mario"
                                            />
                                        ) : (
                                            <p className={`font-semibold text-base ${isElite ? 'text-white' : 'text-gray-900'}`}>{formData.company_name || '—'}</p>
                                        )}
                                    </div>
                                    <div>
                                        <label className={`block text-xs font-semibold uppercase tracking-wide mb-1.5 ${isElite ? 'text-slate-400' : 'text-gray-500'}`}>Indirizzo</label>
                                        {editing ? (
                                            <div className={isElite ? 'dark-autocomplete' : ''}>
                                                <AddressAutocomplete
                                                    defaultValue={formData.address}
                                                    onChange={(val) => setFormData(prev => ({ ...prev, address: val }))}
                                                    onSelect={handleAddressSelect}
                                                    isElite={isElite}
                                                />
                                                {formData.address && !formData.latitude && (
                                                    <p className="text-[10px] text-orange-600 mt-2 flex items-start gap-1 font-bold leading-tight bg-orange-50 p-2 rounded-lg border border-orange-100">
                                                        <span>⚠️</span> Per attivare la mappa, assicurati di cliccare una delle opzioni suggerite nel menu a tendina!
                                                    </p>
                                                )}
                                            </div>
                                        ) : (
                                            <div>
                                                <p className={`flex items-start gap-1 text-sm ${isElite ? 'text-slate-300' : 'text-slate-700'}`}>
                                                    <MapPin size={16} className={`mt-0.5 flex-shrink-0 ${isElite ? 'text-slate-500' : 'text-slate-400'}`} />
                                                    <span className="leading-snug">{formData.address || '—'}</span>
                                                </p>
                                                {formData.address && !formData.latitude && (
                                                    <div className={`mt-2 p-2.5 rounded-xl border text-[10px] font-bold leading-relaxed ${isElite ? 'bg-red-900/20 text-red-300 border-red-800/40' : 'bg-red-50 text-red-600 border-red-200 shadow-sm'}`}>
                                                        ⚠️ Coordinate Mappa mancanti. Questa attività non appare nei Tour geografici.<br/>
                                                        Clicca su <strong>Modifica</strong>, riscrivi l'indirizzo e <strong>selezionalo dalla lista</strong> per attivare il segnaposto.
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Row 2: City + Website */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className={`block text-xs font-semibold uppercase tracking-wide mb-1.5 ${isElite ? 'text-slate-400' : 'text-gray-500'}`}>Città</label>
                                        {editing ? (
                                            <input
                                                type="text"
                                                className={`w-full border rounded-xl px-4 py-3 text-sm focus:ring-4 focus:border-transparent transition-all outline-none ${isElite ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400 focus:ring-amber-500/20 focus:border-amber-400' : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 shadow-sm focus:ring-orange-500/10 focus:border-orange-500'}`}
                                                value={formData.city}
                                                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                                placeholder="es. Roma"
                                            />
                                        ) : (
                                            <p className={`text-sm ${isElite ? 'text-slate-300' : 'text-gray-700'}`}>{formData.city || '—'}</p>
                                        )}
                                    </div>
                                    <div>
                                        <label className={`block text-xs font-semibold uppercase tracking-wide mb-1.5 ${isElite ? 'text-slate-400' : 'text-gray-500'}`}>Sito / Menu</label>
                                        {editing ? (
                                            <input
                                                type="text"
                                                className={`w-full border rounded-xl px-4 py-3 text-sm focus:ring-4 focus:border-transparent transition-all outline-none ${isElite ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400 focus:ring-amber-500/20 focus:border-amber-400' : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 shadow-sm focus:ring-orange-500/10 focus:border-orange-500'}`}
                                                value={formData.website}
                                                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                                                placeholder="https://..."
                                            />
                                        ) : (
                                            <p className={`text-sm truncate ${isElite ? 'text-amber-400' : 'text-blue-600'}`}>{formData.website || '—'}</p>
                                        )}
                                    </div>
                                </div>

                                {/* Description */}
                                <div>
                                    <label className={`block text-xs font-semibold uppercase tracking-wide mb-1.5 ${isElite ? 'text-slate-400' : 'text-gray-500'}`}>Descrizione</label>
                                    {editing ? (
                                        <textarea
                                            rows={4}
                                            className={`w-full border rounded-xl px-4 py-3 text-sm focus:ring-4 focus:border-transparent transition-all outline-none resize-none leading-relaxed ${isElite ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400 focus:ring-amber-500/20 focus:border-amber-400' : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 shadow-sm focus:ring-orange-500/10 focus:border-orange-500'}`}
                                            value={formData.description}
                                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                            placeholder="Racconta la storia della tua attività, i punti di forza, cosa ti rende unico..."
                                        />
                                    ) : (
                                        <p className={`text-sm leading-relaxed whitespace-pre-line ${isElite ? 'text-slate-300' : 'text-gray-600'}`}>
                                            {formData.description || '—'}
                                        </p>
                                    )}
                                </div>

                                {/* AI Highlights */}
                                {!editing && formData.ai_metadata && (
                                    <div className={`p-5 rounded-2xl border ${isElite ? 'bg-slate-800/50 border-slate-700/50' : 'bg-gradient-to-br from-purple-50/80 to-indigo-50/80 border-purple-100/50 shadow-[inset_0_2px_10px_rgba(255,255,255,0.8)]'}`}>
                                        <p className={`text-[11px] font-bold uppercase tracking-widest mb-3 flex items-center gap-1.5 ${isElite ? 'text-purple-400' : 'text-purple-700'}`}>
                                            <Sparkles size={14} /> AI Highlights
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            {formData.ai_metadata.vibe?.map((v, i) => (
                                                <span key={i} className={`px-3 py-1.5 text-xs font-bold rounded-lg shadow-sm border ${isElite ? 'bg-purple-500/10 text-purple-300 border-purple-500/20' : 'bg-white text-purple-700 border-purple-100'}`}>{v}</span>
                                            ))}
                                            {formData.ai_metadata.style?.map((s, i) => (
                                                <span key={s + i} className={`px-3 py-1.5 text-xs font-bold rounded-lg shadow-sm border ${isElite ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20' : 'bg-white text-indigo-700 border-indigo-100'}`}>{s}</span>
                                            ))}
                                            {formData.ai_metadata.pace && (
                                                <span className={`px-3 py-1.5 text-xs font-bold rounded-lg shadow-sm border ${isElite ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' : 'bg-white text-emerald-700 border-emerald-100'}`}>
                                                    Ritmo: {formData.ai_metadata.pace}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* RIGHT — 1/3 */}
                    <div className="space-y-5">

                        {/* CATEGORIES */}
                        <div className={`rounded-3xl shadow-sm overflow-hidden border ${isElite ? 'bg-slate-800/80 border-slate-700/50 backdrop-blur-md' : 'bg-white border-slate-200/60'}`}>
                            <SectionHeader icon={Star} label="Categorie" iconColor="text-amber-500" />
                            <div className="p-5">
                                <p className={`text-[11px] mb-3 ${isElite ? 'text-slate-400' : 'text-gray-400'}`}>
                                    {editing ? 'Seleziona le categorie che descrivono la tua attività' : 'Le tue categorie attive'}
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {CATEGORY_TAGS.map(tag => {
                                        const isActive = formData.category_tags.includes(tag);
                                        return (
                                            <button
                                                key={tag}
                                                disabled={!editing}
                                                onClick={() => toggleTag(tag)}
                                                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${isActive
                                                        ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                                                        : editing
                                                            ? (isElite ? 'bg-slate-700 text-slate-300 border-slate-600 hover:border-orange-400 hover:text-orange-400' : 'bg-white text-gray-500 border-gray-200 hover:border-orange-300 hover:text-orange-500')
                                                            : (isElite ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-gray-50 text-gray-400 border-gray-100')
                                                    } ${!editing ? 'cursor-default' : 'cursor-pointer'}`}
                                            >
                                                {tag}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* VISIBILITY WIDGET */}
                        <TourVisibilityWidget
                            businessId={business?.id}
                            businessName={formData.company_name}
                            categoryTags={formData.category_tags}
                            aiMetadata={formData.ai_metadata}
                            hasLocation={!!(formData.latitude && formData.longitude)}
                            tier={formData.subscription_tier}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── MAPPINGS ────────────────────────────────────────────────────────────────
const BIZ_TO_TOUR_TAGS = {
    'Ristorazione': ['cibo', 'carbonara', 'street', 'pizza', 'food', 'nightlife'],
    'Ospitalità':   ['relax', 'romantico', 'lusso', 'spa'],
    'Shopping':     ['shopping', 'moda', 'quadrilatero', 'vintage'],
    'Artigianato':  ['shopping', 'storia', 'cultura'],
    'Cultura':      ['musei', 'storia', 'barocco', 'imperiale', 'cultura'],
    'Storia':       ['storia', 'imperiale', 'barocco', 'rione', 'piazze'],
    'Lusso':        ['shopping', 'lusso', 'romantico', 'quadrilatero'],
    'Nightlife':    ['nightlife', 'navigli', 'aperitivo'],
    'Relax':        ['relax', 'spa', 'natura', 'villa', 'parco'],
    'Avventura':    ['avventura', 'natura', 'sport'],
    'Tech':         ['cultura', 'innovazione'],
};
const AI_QUIZ_TO_BIZ = {
    'cibo':       ['Ristorazione'],
    'natura':     ['Relax', 'Avventura'],
    'storia':     ['Cultura', 'Storia', 'Artigianato'],
    'relax':      ['Relax', 'Ospitalità', 'Lusso'],
    'moda':       ['Shopping', 'Lusso'],
    'nightlife':  ['Nightlife', 'Ristorazione'],
    'citta':      ['Cultura', 'Shopping', 'Storia'],
    'romantico':  ['Ospitalità', 'Lusso', 'Ristorazione'],
    'carbonara':  ['Ristorazione'],
    'shopping':   ['Shopping', 'Artigianato', 'Lusso'],
    'strada':     ['Ristorazione', 'Artigianato'],
};
const AI_QUIZ_LABELS = {
    'cibo': '🍕 Cibo & Sapori', 'natura': '🌿 Natura', 'storia': '🏛️ Storia',
    'relax': '🧖 Relax', 'moda': '👗 Moda', 'nightlife': '🌙 Nightlife',
    'citta': '🏙️ Città', 'romantico': '❤️ Romantico', 'carbonara': '🍝 Carbonara Tour',
    'shopping': '🛍️ Shopping', 'strada': '🥪 Street Food',
};

// ─── TOUR VISIBILITY WIDGET ───────────────────────────────────────────────────
function TourVisibilityWidget({ businessId, businessName, categoryTags, aiMetadata, hasLocation, tier }) {
    const [guideTourCount, setGuideTourCount] = useState(null);
    const [loading, setLoading] = useState(false);
    const [activeSection, setActiveSection] = useState('guide');

    const tags = categoryTags || [];
    const vibes = aiMetadata?.vibe || [];
    const styles = aiMetadata?.styles || [];
    const hasAI = !!aiMetadata;

    const matchedTourTags = [...new Set(tags.flatMap(t => BIZ_TO_TOUR_TAGS[t] || []))];
    const matchedAiMoods = Object.entries(AI_QUIZ_TO_BIZ)
        .filter(([, cats]) => cats.some(c => tags.includes(c)))
        .map(([mood]) => mood);

    const scoreItems = [
        { ok: hasLocation,       weight: 30, label: 'Indirizzo Mappa' },
        { ok: tags.length >= 1,  weight: 25, label: 'Categoria' },
        { ok: tags.length >= 2,  weight: 15, label: '2+ Categorie' },
        { ok: hasAI,             weight: 20, label: 'Scansione IA' },
        { ok: vibes.length >= 2, weight: 10, label: 'Stile IA' },
    ];
    const score = scoreItems.reduce((s, i) => s + (i.ok ? i.weight : 0), 0);
    const scoreColor = score >= 70 ? '#22c55e' : score >= 40 ? '#f97316' : '#ef4444';
    const isReady = hasLocation && tags.length > 0;

    useEffect(() => {
        if (!businessId || !hasLocation || tags.length === 0) return;
        setLoading(true);
        supabase.from('tours').select('id, tags').eq('is_live', true)
            .then(({ data }) => {
                const expanded = tags.flatMap(t => [t.toLowerCase(), ...(BIZ_TO_TOUR_TAGS[t] || [])]);
                const matches = (data || []).filter(t =>
                    (t.tags || []).some(tt => expanded.includes(tt.toLowerCase()))
                );
                setGuideTourCount(matches.length);
            })
            .finally(() => setLoading(false));
    }, [businessId, hasLocation, tags.join(',')]);

    return (
        <div className={`rounded-2xl overflow-hidden shadow-sm border ${tier === 'elite' ? 'border-amber-500/40 relative shadow-xl' : 'border-slate-200/80 bg-white'}`} style={tier === 'elite' ? { background: 'linear-gradient(135deg,#111827,#1e293b)' } : {}}>
            {tier === 'elite' && <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 blur-3xl rounded-full pointer-events-none" />}
            {/* Header */}
            <div className={`px-5 pt-5 pb-3 border-b relative z-10 ${tier === 'elite' ? 'border-amber-500/20' : 'border-slate-100 bg-slate-50/50'}`}>
                <div className="flex items-center gap-2.5 mb-1">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shadow-sm ${tier === 'elite' ? 'bg-gradient-to-br from-[#f6d365] to-[#d4af37]' : 'bg-gradient-to-br from-orange-500 to-amber-500'}`}>
                        <Map className="w-4 h-4 text-white" />
                    </div>
                    <div>
                        <h3 className={`font-bold text-sm ${tier === 'elite' ? 'text-amber-400' : 'text-slate-800'}`}>Visibilità sui Tour</h3>
                        <p className={`text-[10px] font-medium ${tier === 'elite' ? 'text-slate-400' : 'text-slate-500'}`}>Come appari nelle esperienze UNNIVAI</p>
                    </div>
                    <div className="ml-auto text-right">
                        <div className="text-2xl font-black" style={{ color: tier === 'elite' && score >= 70 ? '#f6d365' : scoreColor }}>{score}%</div>
                        <p className={`text-[9px] uppercase tracking-widest font-bold ${tier === 'elite' ? 'text-slate-500' : 'text-slate-400'}`}>score</p>
                    </div>
                </div>
                <div className={`mt-3 h-1.5 rounded-full overflow-hidden ${tier === 'elite' ? 'bg-slate-700' : 'bg-slate-200'}`}>
                    <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${score}%`, background: `linear-gradient(90deg,${scoreColor},${scoreColor}88)` }} />
                </div>
                <div className="flex gap-3 mt-2.5 flex-wrap">
                    {scoreItems.map((s, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                            <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center ${s.ok ? 'bg-emerald-500 shadow-sm' : (tier === 'elite' ? 'bg-slate-700' : 'bg-slate-200')}`}>
                                {s.ok && <Check className="w-2.5 h-2.5 text-white" />}
                            </div>
                            <span className={`text-[10px] font-bold ${s.ok ? (tier === 'elite' ? 'text-slate-300' : 'text-slate-700') : (tier === 'elite' ? 'text-slate-600' : 'text-slate-400')}`}>{s.label}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Tabs */}
            <div className={`flex border-b relative z-10 ${tier === 'elite' ? 'border-amber-500/20' : 'border-slate-100'}`}>
                {[
                    { id: 'guide', icon: '🧭', label: 'Tour Guida', count: guideTourCount },
                    { id: 'ai',    icon: '🤖', label: 'Tour AI',    count: matchedAiMoods.length },
                ].map(tab => {
                    const isActive = activeSection === tab.id;
                    const activeColorClass = isActive 
                        ? (tier === 'elite' ? 'text-amber-400 border-b-2 border-amber-400 bg-amber-500/5' : 'text-orange-500 border-b-2 border-orange-500 bg-orange-50/80') 
                        : (tier === 'elite' ? 'text-slate-500 hover:text-slate-300' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50/50');
                    const badgeClass = isActive 
                        ? (tier === 'elite' ? 'bg-amber-500/20 text-amber-300' : 'bg-orange-100 text-orange-600 border border-orange-200')
                        : (tier === 'elite' ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-500 border border-slate-200');

                    return (
                        <button key={tab.id} onClick={() => setActiveSection(tab.id)}
                            className={`flex-1 py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${activeColorClass}`}>
                            <span>{tab.icon}</span><span>{tab.label}</span>
                            {tab.count != null && (
                                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black ${badgeClass}`}>{tab.count}</span>
                            )}
                        </button>
                    )
                })}
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">
                {activeSection === 'guide' && (
                    <>
                        <div className={`rounded-xl p-3.5 text-xs ${tier === 'elite' ? 'bg-slate-800/60 border border-slate-700 text-slate-400' : 'bg-slate-50 border border-slate-200 text-slate-600'}`}>
                            <p className={`font-bold mb-1 ${tier === 'elite' ? 'text-white' : 'text-slate-800'}`}>📍 Come funziona sulle Mappe</p>
                            Quando i turisti seguono un itinerario creato da una guida vicino al tuo indirizzo, la tua attività apparirà sulla mappa con un segnale speciale.
                            <div className={`mt-2.5 text-[10px] p-2.5 rounded-lg border leading-relaxed ${tier === 'elite' ? 'bg-slate-700/50 border-slate-600' : 'bg-white border-slate-200 shadow-sm'}`}>
                                {tier === 'elite' ? 
                                    <span className="text-slate-300">👑 <strong className="text-emerald-400">Vantaggio Elite:</strong> Sei visibile in formato espanso fino a <strong>15km</strong> di distanza (invece di soli 2.5km del piano base).</span> : 
                                    <span className="text-slate-600">⭐ <strong>Piano Base:</strong> Sei visibile entro <strong>2.5km</strong> dai tour di passaggio. (Passa a Elite per espandere il raggio a 15km!)</span>}
                            </div>
                        </div>
                        {isReady && matchedTourTags.length > 0 && (
                            <div>
                                <p className={`text-[10px] uppercase tracking-widest font-bold mb-2 ${tier === 'elite' ? 'text-slate-500' : 'text-slate-400'}`}>Parole chiave che ti collegano ai Tour Guida</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {matchedTourTags.slice(0, 12).map((t, i) => (
                                        <span key={i} className={`px-2.5 py-1 text-[10px] font-bold rounded-full border ${tier === 'elite' ? 'bg-orange-500/15 border-orange-500/30 text-orange-300' : 'bg-orange-50/80 border-orange-200 text-orange-600'}`}>#{t}</span>
                                    ))}
                                </div>
                            </div>
                        )}
                        {!isReady && (
                            <div className={`rounded-xl p-3 text-xs border ${tier === 'elite' ? 'bg-red-900/20 border-red-800/40 text-red-300' : 'bg-red-50 border-red-200 text-red-600'}`}>
                                ⚠️ Compila il campo <strong>Indirizzo</strong> e scegli almeno <strong>1 Categoria</strong> per apparire sui tour.
                            </div>
                        )}
                        {hasAI && vibes.length > 0 && (
                            <div>
                                <p className={`text-[10px] uppercase tracking-widest font-bold mb-2 ${tier === 'elite' ? 'text-slate-500' : 'text-slate-400'}`}>🧠 Caratteristiche rilevate dall'IA</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {[...vibes, ...styles].slice(0, 6).map((v, i) => (
                                        <span key={i} className={`px-2.5 py-1 text-[10px] font-bold rounded-full border ${tier === 'elite' ? 'bg-purple-500/15 border-purple-500/30 text-purple-300' : 'bg-purple-50 border-purple-200 text-purple-700'}`}>{v}</span>
                                    ))}
                                </div>
                            </div>
                        )}
                        {isReady && (
                            <div className={`rounded-xl p-3.5 flex items-center gap-3.5 border ${tier === 'elite' ? 'bg-slate-800/80 border-slate-600' : 'bg-white border-slate-200 shadow-sm'}`}>
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ${tier === 'elite' ? 'bg-gradient-to-br from-orange-500 to-amber-400' : 'bg-gradient-to-br from-orange-500 to-rose-500'}`}>
                                    {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <span className="text-white font-black text-sm">{guideTourCount ?? '?'}</span>}
                                </div>
                                <div>
                                    <p className={`font-bold text-xs ${tier === 'elite' ? 'text-white' : 'text-slate-800'}`}>Tour guida compatibili</p>
                                    <p className={`text-[10px] font-medium ${tier === 'elite' ? 'text-slate-400' : 'text-slate-500'}`}>attivi in piattaforma</p>
                                </div>
                            </div>
                        )}
                    </>
                )}
                {activeSection === 'ai' && (
                    <>
                        <div className={`rounded-xl p-3.5 text-xs ${tier === 'elite' ? 'bg-slate-800/60 border border-slate-700 text-slate-400' : 'bg-slate-50 border border-slate-200 text-slate-600'}`}>
                            <p className={`font-bold mb-1 ${tier === 'elite' ? 'text-white' : 'text-slate-800'}`}>🤖 Come ti trova l'IA</p>
                            I turisti chiedono ai nostri Personal Shopper IA "Cosa fare a Roma?". Tu verrai suggerito se il tuo Stile corrisponde ai gusti di chi cerca nella tua città.
                            <div className={`mt-2.5 text-[10px] p-2.5 rounded-lg border leading-relaxed ${tier === 'elite' ? 'bg-slate-700/50 border-slate-600' : 'bg-white border-slate-200 shadow-sm'}`}>
                                {tier === 'elite' ? 
                                    <span className="text-slate-300">👑 <strong className="text-emerald-400">Vantaggio Elite:</strong> Hai una spinta altissima (+5 di punteggio) negli algoritmi di raccomandazione per scavalcare la concorrenza.</span> : 
                                    <span className="text-slate-600">⭐ <strong>Piano Base:</strong> Sei visibile, ma ricordati che le posizioni migliori andranno sempre ai Partner Elite con il Booster attivo.</span>}
                            </div>
                        </div>
                        {matchedAiMoods.length > 0 ? (
                            <div>
                                <p className={`text-[10px] uppercase tracking-widest font-bold mb-2 ${tier === 'elite' ? 'text-slate-500' : 'text-slate-400'}`}>🗺️ Ti troveranno i turisti che cercano questi stili</p>
                                <div className="space-y-1.5">
                                    {matchedAiMoods.map((mood, i) => (
                                        <div key={i} className={`flex items-center gap-2 rounded-lg px-3 py-2 border ${tier === 'elite' ? 'bg-purple-900/20 border-purple-500/20' : 'bg-purple-50/80 border-purple-100 shadow-sm'}`}>
                                            <span className="text-base">{AI_QUIZ_LABELS[mood]?.split(' ')[0]}</span>
                                            <p className={`flex-1 text-[11px] font-bold ${tier === 'elite' ? 'text-purple-200' : 'text-purple-700'}`}>{AI_QUIZ_LABELS[mood]}</p>
                                            <CheckCircle2 className={`w-4 h-4 ${tier === 'elite' ? 'text-purple-400' : 'text-purple-500'}`} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className={`rounded-xl p-3 text-xs border ${tier === 'elite' ? 'bg-yellow-900/20 border-yellow-800/40 text-yellow-300' : 'bg-yellow-50 border-yellow-200 text-yellow-700'}`}>
                                💡 Scegli le Categorie della tua attività per farti trovare tramite l'Intelligenza Artificiale.
                            </div>
                        )}
                        {tags.length > 0 && (
                            <div>
                                <p className={`text-[10px] uppercase tracking-widest font-bold mb-2 ${tier === 'elite' ? 'text-slate-500' : 'text-slate-400'}`}>🔀 Come le tue Categorie si legano alle richieste IA</p>
                                <div className="space-y-1.5">
                                    {tags.map((tag, i) => {
                                        const moods = Object.entries(AI_QUIZ_TO_BIZ).filter(([, c]) => c.includes(tag)).map(([m]) => AI_QUIZ_LABELS[m]);
                                        return moods.length > 0 ? (
                                            <div key={i} className="flex items-start gap-2 text-[10px]">
                                                <span className={`px-2 py-0.5 rounded font-bold flex-shrink-0 border ${tier === 'elite' ? 'bg-orange-500/20 text-orange-300 border-orange-500/30' : 'bg-orange-50 text-orange-600 border-orange-200'}`}>{tag}</span>
                                                <span className={`mt-0.5 ${tier === 'elite' ? 'text-slate-500' : 'text-slate-300'}`}>→</span>
                                                <span className={`font-semibold ${tier === 'elite' ? 'text-slate-300' : 'text-slate-600'}`}>{moods.slice(0, 3).join(' · ')}</span>
                                            </div>
                                        ) : null;
                                    })}
                                </div>
                            </div>
                        )}
                        <div className={`rounded-xl p-3.5 flex items-center gap-3.5 border ${tier === 'elite' ? 'bg-slate-800/80 border-slate-600' : 'bg-white border-slate-200 shadow-sm'}`}>
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ${tier === 'elite' ? 'bg-gradient-to-br from-purple-600 to-indigo-500' : 'bg-gradient-to-br from-purple-500 to-blue-500'}`}>
                                <span className="text-white font-black text-sm">{matchedAiMoods.length}</span>
                            </div>
                            <div>
                                <p className={`font-bold text-xs ${tier === 'elite' ? 'text-white' : 'text-slate-800'}`}>Mood AI compatibili</p>
                                <p className={`text-[10px] font-medium ${tier === 'elite' ? 'text-slate-400' : 'text-slate-500'}`}>su {Object.keys(AI_QUIZ_LABELS).length} possibili</p>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Card preview */}
            <div className={`px-4 pb-4 border-t pt-4 ${tier === 'elite' ? 'border-slate-700/60' : 'border-slate-100'}`}>
                <p className={`text-[10px] uppercase tracking-widest font-bold mb-2.5 ${tier === 'elite' ? 'text-slate-500' : 'text-slate-400'}`}>ANTEPRIMA SCHEDA MAPPA</p>
                <div className={`rounded-xl overflow-hidden shadow-sm border ${tier === 'elite' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                    <div className={`h-14 relative flex items-center justify-center ${tier === 'elite' ? 'bg-gradient-to-br from-[#f6d365] to-[#d4af37]' : 'bg-gradient-to-br from-orange-400 to-amber-500'}`}>
                        <Globe className="w-8 h-8 text-white/20" />
                        <div className={`absolute top-2 left-2 text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm ${tier === 'elite' ? 'bg-black/50 text-amber-300 backdrop-blur-sm' : 'bg-orange-600 text-white'}`}>
                            <Star className="w-2.5 h-2.5 fill-current" /> Partner {tier === 'elite' ? 'Elite' : 'DoveVai'}
                        </div>
                    </div>
                    <div className="p-3">
                        <h4 className={`font-bold text-sm truncate ${tier === 'elite' ? 'text-slate-100' : 'text-slate-800'}`}>{businessName || 'La tua attività'}</h4>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                            {tags.slice(0, 2).map((tag, i) => (
                                <span key={i} className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${tier === 'elite' ? 'bg-orange-500/10 text-orange-300 border-orange-500/20' : 'bg-orange-50 text-orange-600 border-orange-200'}`}>{tag}</span>
                            ))}
                            {vibes.slice(0, 2).map((v, i) => (
                                <span key={i} className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${tier === 'elite' ? 'bg-purple-500/10 text-purple-300 border-purple-500/20' : 'bg-purple-50 text-purple-700 border-purple-200'}`}>{v}</span>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
