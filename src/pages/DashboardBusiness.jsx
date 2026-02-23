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

                // Parse Location if exists (POINT(lng lat))
                let lat = null;
                let lng = null;
                if (data.location && typeof data.location === 'string' && data.location.includes('POINT')) {
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
        const city = addr.city || addr.town || addr.village || addr.municipality || '';

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
                    finalCity = addr.city || addr.town || addr.village || addr.municipality || finalCity;

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
            setBusiness({ ...business, ...formData });
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
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2.5">
                <Icon className={`w-4.5 h-4.5 ${iconColor}`} size={18} />
                <span className="font-semibold text-gray-800 text-sm">{label}</span>
            </div>
            {action}
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50 pb-24 md:pb-8">
            <Toast message={toast.message} type={toast.type} isVisible={toast.isVisible} onClose={handleToastClose} />

            {/* ── TOP BAR ── */}
            <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
                <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
                    {/* Brand */}
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
                            <Briefcase className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <p className="font-bold text-gray-900 text-sm leading-tight">
                                {business?.company_name || 'La Mia Attività'}
                            </p>
                            <p className="text-[11px] text-gray-400">
                                <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold mr-1 ${isElite ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                                    {isElite ? 'Elite' : 'Base'}
                                </span>
                                {business?.city || 'Posizione non impostata'}
                            </p>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                        {!editing ? (
                            <button
                                onClick={() => setEditing(true)}
                                className="flex items-center gap-1.5 px-3.5 py-2 bg-orange-500 text-white rounded-lg text-xs font-bold hover:bg-orange-600 transition shadow-sm"
                            >
                                <Edit size={14} /> Modifica
                            </button>
                        ) : (
                            <>
                                <button
                                    onClick={() => setEditing(false)}
                                    className="px-3 py-2 text-gray-500 text-xs font-medium hover:text-gray-700 transition"
                                >
                                    Annulla
                                </button>
                                <button
                                    onClick={saveChanges}
                                    className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 text-white rounded-lg text-xs font-bold hover:bg-emerald-600 transition shadow-sm active:scale-95"
                                >
                                    <Save size={14} /> Salva Modifiche
                                </button>
                            </>
                        )}
                        <button onClick={() => signOut()} className="p-2 text-gray-400 hover:text-red-500 transition" title="Esci">
                            <LogOut size={18} />
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">

                {/* ── ANALYTICS STRIP ── */}
                <div className="grid grid-cols-4 gap-3">
                    {[
                        { label: 'Visualizzazioni', value: analytics.views, icon: Eye, color: 'text-blue-500', bg: 'bg-blue-50/70' },
                        { label: 'Click Scheda', value: analytics.clicks, icon: MousePointer, color: 'text-purple-500', bg: 'bg-purple-50/70' },
                        { label: 'Salvataggi', value: analytics.saves, icon: Star, color: 'text-amber-500', bg: 'bg-amber-50/70' },
                        { label: 'Conversioni', value: analytics.conversions + '%', icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-50/70' },
                    ].map((s, i) => (
                        <div key={i} className="bg-white border border-gray-100 rounded-xl p-3.5 flex items-center gap-3 shadow-sm">
                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${s.bg}`}>
                                <s.icon className={`w-4 h-4 ${s.color}`} />
                            </div>
                            <div>
                                <p className="text-xl font-bold text-gray-900 leading-none">{s.value}</p>
                                <p className="text-[10px] text-gray-400 mt-0.5 uppercase tracking-wide font-medium">{s.label}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* ── 2-COLUMN GRID ── */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

                    {/* LEFT — 2/3 */}
                    <div className="lg:col-span-2 space-y-5">

                        {/* PHOTOS */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
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
                                                className="w-full py-10 flex flex-col items-center justify-center gap-2 text-gray-400 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 hover:border-orange-300 hover:text-orange-400 transition"
                                            >
                                                <ImageIcon size={28} />
                                                <span className="text-sm font-medium">Aggiungi le tue foto</span>
                                                <span className="text-xs">Clicca per caricare</span>
                                            </button>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>

                        {/* DETAILS */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
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
                                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Nome Attività</label>
                                        {editing ? (
                                            <input
                                                type="text"
                                                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-400 focus:border-transparent transition outline-none"
                                                value={formData.company_name}
                                                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                                                placeholder="Es. Trattoria da Mario"
                                            />
                                        ) : (
                                            <p className="text-gray-900 font-semibold text-base">{formData.company_name || '—'}</p>
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Indirizzo</label>
                                        {editing ? (
                                            <AddressAutocomplete
                                                defaultValue={formData.address}
                                                onChange={(val) => setFormData(prev => ({ ...prev, address: val }))}
                                                onSelect={handleAddressSelect}
                                            />
                                        ) : (
                                            <p className="text-gray-700 flex items-center gap-1 text-sm">
                                                <MapPin size={14} className="text-gray-400 flex-shrink-0" />
                                                {formData.address || '—'}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Row 2: City + Website */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Città</label>
                                        {editing ? (
                                            <input
                                                type="text"
                                                className="w-full border border-gray-100 bg-gray-50 rounded-xl px-3 py-2.5 text-sm text-gray-400 cursor-not-allowed"
                                                value={formData.city}
                                                readOnly
                                                placeholder="Auto dall'indirizzo"
                                            />
                                        ) : (
                                            <p className="text-gray-700 text-sm">{formData.city || '—'}</p>
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Sito / Menu</label>
                                        {editing ? (
                                            <input
                                                type="text"
                                                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-400 focus:border-transparent transition outline-none"
                                                value={formData.website}
                                                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                                                placeholder="https://..."
                                            />
                                        ) : (
                                            <p className="text-blue-600 text-sm truncate">{formData.website || '—'}</p>
                                        )}
                                    </div>
                                </div>

                                {/* Description */}
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Descrizione</label>
                                    {editing ? (
                                        <textarea
                                            rows={4}
                                            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-400 focus:border-transparent transition outline-none resize-none leading-relaxed"
                                            value={formData.description}
                                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                            placeholder="Racconta la storia della tua attività, i punti di forza, cosa ti rende unico..."
                                        />
                                    ) : (
                                        <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-line">
                                            {formData.description || '—'}
                                        </p>
                                    )}
                                </div>

                                {/* AI Highlights */}
                                {!editing && formData.ai_metadata && (
                                    <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl border border-purple-100 p-4">
                                        <p className="text-[11px] font-bold text-purple-700 uppercase tracking-wider mb-2.5 flex items-center gap-1">
                                            <Sparkles size={12} /> AI Highlights
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            {formData.ai_metadata.vibe?.map((v, i) => (
                                                <span key={i} className="px-2.5 py-1 bg-white text-purple-700 text-xs font-medium rounded-lg shadow-sm border border-purple-100">{v}</span>
                                            ))}
                                            {formData.ai_metadata.style?.map((s, i) => (
                                                <span key={s + i} className="px-2.5 py-1 bg-white text-indigo-700 text-xs font-medium rounded-lg shadow-sm border border-indigo-100">{s}</span>
                                            ))}
                                            {formData.ai_metadata.pace && (
                                                <span className="px-2.5 py-1 bg-white text-emerald-700 text-xs font-medium rounded-lg shadow-sm border border-emerald-100">
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
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                            <SectionHeader icon={Star} label="Categorie" iconColor="text-amber-500" />
                            <div className="p-5">
                                <p className="text-[11px] text-gray-400 mb-3">
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
                                                            ? 'bg-white text-gray-500 border-gray-200 hover:border-orange-300 hover:text-orange-500'
                                                            : 'bg-gray-50 text-gray-400 border-gray-100'
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
function TourVisibilityWidget({ businessId, businessName, categoryTags, aiMetadata, hasLocation }) {
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
        { ok: hasLocation,       weight: 30, label: 'Posizione GPS' },
        { ok: tags.length >= 1,  weight: 25, label: 'Categoria' },
        { ok: tags.length >= 2,  weight: 15, label: '2+ Categorie' },
        { ok: hasAI,             weight: 20, label: 'Analisi AI' },
        { ok: vibes.length >= 2, weight: 10, label: 'Vibe AI' },
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
        <div className="rounded-2xl overflow-hidden border border-slate-700 shadow-xl" style={{ background: 'linear-gradient(135deg,#0f172a,#1e293b)' }}>
            {/* Header */}
            <div className="px-5 pt-5 pb-3 border-b border-slate-700/60">
                <div className="flex items-center gap-2.5 mb-1">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500 to-amber-400 flex items-center justify-center">
                        <Map className="w-4 h-4 text-white" />
                    </div>
                    <div>
                        <h3 className="font-bold text-white text-sm">Visibilità sui Tour</h3>
                        <p className="text-slate-500 text-[10px]">Come appari nelle esperienze UNNIVAI</p>
                    </div>
                    <div className="ml-auto text-right">
                        <div className="text-2xl font-black" style={{ color: scoreColor }}>{score}%</div>
                        <p className="text-[9px] text-slate-500 uppercase tracking-widest">score</p>
                    </div>
                </div>
                <div className="mt-3 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${score}%`, background: `linear-gradient(90deg,${scoreColor},${scoreColor}88)` }} />
                </div>
                <div className="flex gap-3 mt-2.5 flex-wrap">
                    {scoreItems.map((s, i) => (
                        <div key={i} className="flex items-center gap-1">
                            <div className={`w-3 h-3 rounded-full flex items-center justify-center ${s.ok ? 'bg-emerald-500' : 'bg-slate-600'}`}>
                                {s.ok && <Check className="w-2 h-2 text-white" />}
                            </div>
                            <span className={`text-[10px] font-medium ${s.ok ? 'text-slate-300' : 'text-slate-600'}`}>{s.label}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-700/60">
                {[
                    { id: 'guide', icon: '🧭', label: 'Tour Guida', count: guideTourCount },
                    { id: 'ai',    icon: '🤖', label: 'Tour AI',    count: matchedAiMoods.length },
                ].map(tab => (
                    <button key={tab.id} onClick={() => setActiveSection(tab.id)}
                        className={`flex-1 py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                            activeSection === tab.id ? 'text-orange-400 border-b-2 border-orange-400 bg-orange-500/5' : 'text-slate-500 hover:text-slate-300'}`}>
                        <span>{tab.icon}</span><span>{tab.label}</span>
                        {tab.count != null && (
                            <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black ${activeSection === tab.id ? 'bg-orange-500/20 text-orange-300' : 'bg-slate-700 text-slate-400'}`}>{tab.count}</span>
                        )}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="p-4 space-y-3">
                {activeSection === 'guide' && (
                    <>
                        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-3 text-xs text-slate-400">
                            <p className="font-semibold text-white mb-1">📍 Come funziona</p>
                            Quando una guida crea un tour, le attività con tag compatibili nel percorso appaiono sulla mappa come <span className="text-amber-300 font-bold">Partner DoveVai</span>.
                        </div>
                        {isReady && matchedTourTags.length > 0 && (
                            <div>
                                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-2">Tag di matching attivi</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {matchedTourTags.slice(0, 12).map((t, i) => (
                                        <span key={i} className="px-2 py-1 bg-orange-500/15 border border-orange-500/30 text-orange-300 text-[10px] font-bold rounded-full">#{t}</span>
                                    ))}
                                </div>
                            </div>
                        )}
                        {!isReady && (
                            <div className="bg-red-900/20 border border-red-800/40 rounded-xl p-3 text-xs text-red-300">
                                ⚠️ Aggiungi <strong>GPS</strong> e almeno <strong>1 categoria</strong> per apparire sui tour.
                            </div>
                        )}
                        {hasAI && vibes.length > 0 && (
                            <div>
                                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-2">🧠 Boost AI</p>
                                <div className="flex flex-wrap gap-1">
                                    {[...vibes, ...styles].slice(0, 6).map((v, i) => (
                                        <span key={i} className="px-2 py-0.5 bg-purple-500/15 border border-purple-500/30 text-purple-300 text-[10px] font-bold rounded-full">{v}</span>
                                    ))}
                                </div>
                            </div>
                        )}
                        {isReady && (
                            <div className="bg-slate-800/80 border border-slate-600 rounded-xl p-3 flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-400 flex items-center justify-center flex-shrink-0">
                                    {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <span className="text-white font-black text-sm">{guideTourCount ?? '?'}</span>}
                                </div>
                                <div>
                                    <p className="text-white font-bold text-xs">Tour guida compatibili</p>
                                    <p className="text-slate-400 text-[10px]">attivi in piattaforma</p>
                                </div>
                            </div>
                        )}
                    </>
                )}
                {activeSection === 'ai' && (
                    <>
                        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-3 text-xs text-slate-400">
                            <p className="font-semibold text-white mb-1">�� Come funziona nei Tour AI</p>
                            Quando un utente usa <span className="text-purple-300 font-semibold">Quick Path</span> o <span className="text-purple-300 font-semibold">Sorprendimi</span>, l'AI seleziona attività in base al <span className="text-white font-semibold">mood</span> e alla città.
                        </div>
                        {matchedAiMoods.length > 0 ? (
                            <div>
                                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-2">Appari nei percorsi con questi mood</p>
                                <div className="space-y-1.5">
                                    {matchedAiMoods.map((mood, i) => (
                                        <div key={i} className="flex items-center gap-2 bg-purple-900/20 border border-purple-500/20 rounded-lg px-3 py-2">
                                            <span className="text-base">{AI_QUIZ_LABELS[mood]?.split(' ')[0]}</span>
                                            <p className="flex-1 text-[11px] text-purple-200 font-semibold">{AI_QUIZ_LABELS[mood]}</p>
                                            <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="bg-yellow-900/20 border border-yellow-800/40 rounded-xl p-3 text-xs text-yellow-300">
                                💡 Aggiungi categorie per comparire nei tour AI.
                            </div>
                        )}
                        {tags.length > 0 && (
                            <div>
                                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-2">Le tue categorie → quiz AI</p>
                                <div className="space-y-1">
                                    {tags.map((tag, i) => {
                                        const moods = Object.entries(AI_QUIZ_TO_BIZ).filter(([, c]) => c.includes(tag)).map(([m]) => AI_QUIZ_LABELS[m]);
                                        return moods.length > 0 ? (
                                            <div key={i} className="flex items-start gap-2 text-[10px]">
                                                <span className="bg-orange-500/20 text-orange-300 px-1.5 py-0.5 rounded font-bold flex-shrink-0">{tag}</span>
                                                <span className="text-slate-500 mt-0.5">→</span>
                                                <span className="text-slate-300">{moods.slice(0, 3).join(' · ')}</span>
                                            </div>
                                        ) : null;
                                    })}
                                </div>
                            </div>
                        )}
                        <div className="bg-slate-800/80 border border-slate-600 rounded-xl p-3 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-500 flex items-center justify-center flex-shrink-0">
                                <span className="text-white font-black text-sm">{matchedAiMoods.length}</span>
                            </div>
                            <div>
                                <p className="text-white font-bold text-xs">Mood AI compatibili</p>
                                <p className="text-slate-400 text-[10px]">su {Object.keys(AI_QUIZ_LABELS).length} possibili</p>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Card preview */}
            <div className="px-4 pb-4 border-t border-slate-700/60 pt-3">
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-2">ANTEPRIMA SCHEDA MAPPA</p>
                <div className="bg-white rounded-xl overflow-hidden shadow-lg">
                    <div className="h-14 bg-gradient-to-br from-orange-400 to-amber-500 relative flex items-center justify-center">
                        <Globe className="w-8 h-8 text-white/20" />
                        <div className="absolute top-2 left-2 bg-orange-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Star className="w-2.5 h-2.5 fill-current" /> Partner DoveVai
                        </div>
                    </div>
                    <div className="p-2.5">
                        <h4 className="font-bold text-gray-900 text-sm truncate">{businessName || 'La tua attività'}</h4>
                        <div className="flex flex-wrap gap-1 mt-1">
                            {tags.slice(0, 2).map((tag, i) => (
                                <span key={i} className="text-[9px] font-bold bg-orange-50 text-orange-700 border border-orange-200 px-1.5 py-0.5 rounded-full">{tag}</span>
                            ))}
                            {vibes.slice(0, 2).map((v, i) => (
                                <span key={i} className="text-[9px] font-bold bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded-full">{v}</span>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
