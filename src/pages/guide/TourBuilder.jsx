
import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import UnnivaiMap from '../../components/UnnivaiMap';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Upload, ChevronRight, Check, Search, Trash2, Users, Globe } from 'lucide-react';
import { Toast } from '../../components/ToastNotification';
import { validateTourSteps } from '../../config/tourSchema';
import { mapService } from '../../services/mapService';
import { aiRecommendationService } from '../../services/aiRecommendationService';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

// Default city coordinates if API fails
const CITY_COORDS = {
    'Roma': { lat: 41.9028, lng: 12.4964 },
    'Milano': { lat: 45.4642, lng: 9.1900 },
    'Firenze': { lat: 43.7696, lng: 11.2558 },
    'Napoli': { lat: 40.8518, lng: 14.2681 },
    'Venezia': { lat: 45.4408, lng: 12.3155 }
};

export default function TourBuilder() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);

    // Edit Mode State
    const [isEditing, setIsEditing] = useState(false);
    const [tourId, setTourId] = useState(null);

    // Toast State
    const [toast, setToast] = useState({ isVisible: false, message: '', type: 'info' });

    const showToast = (message, type = 'info') => {
        setToast({ isVisible: true, message, type });
        setTimeout(() => setToast(prev => ({ ...prev, isVisible: false })), 3000);
    };

    // Form State
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        city: 'Roma',
        price: '',
        duration: '',
        maxParticipants: 10,
        language: 'Italiano',
        tags: [],
        image_urls: []
    });

    const PREDEFINED_TAGS = ['Arte', 'Cultura', 'Cibo', 'Natura', 'Storia', 'Romantico', 'Avventura'];

    const toggleTag = (tag) => {
        const current = formData.tags;
        if (current.includes(tag)) {
            setFormData({ ...formData, tags: current.filter(t => t !== tag) });
        } else {
            // UNLIMITED TAGS (User requested removing limits, applying here too for consistency)
            setFormData({ ...formData, tags: [...current, tag] });
        }
    };

    // --- CHECK FOR EDIT MODE ---
    useEffect(() => {
        if (location.state && location.state.tourToEdit) {
            const tour = location.state.tourToEdit;
            console.log("Editing Tour:", tour);
            setIsEditing(true);
            setTourId(tour.id);
            setFormData({
                title: tour.title,
                description: tour.description || '',
                city: tour.city,
                price: tour.price_eur ? tour.price_eur.toString() : '',
                duration: tour.duration_minutes ? tour.duration_minutes.toString() : '',
                maxParticipants: tour.max_participants || 10,
                language: tour.language || 'Italiano',
                tags: tour.tags || [],
                image_urls: tour.image_urls || (tour.image ? [tour.image] : [])
            });

            if (tour.steps && Array.isArray(tour.steps)) {
                // Sanitize steps to ensure coordinates exist (legacy support)
                const sanitizedSteps = tour.steps.map(s => ({
                    ...s,
                    coordinates: s.coordinates || { lat: s.lat || 0, lng: s.lng || 0 }
                }));
                setSteps(sanitizedSteps);
            }
        }
    }, [location]);

    // Map State (Step 2)
    const [viewState, setViewState] = useState({
        latitude: CITY_COORDS['Roma'].lat,
        longitude: CITY_COORDS['Roma'].lng,
        zoom: 13
    });
    const [steps, setSteps] = useState([]);
    const [selectedStepIndex, setSelectedStepIndex] = useState(null);
    const [partners, setPartners] = useState([]);
    const [partnerSearch, setPartnerSearch] = useState('');

    // --- STEP 1 LOGIC ---
    const handleCityChange = (e) => {
        const city = e.target.value;
        setFormData({ ...formData, city });
        if (CITY_COORDS[city]) {
            setViewState({
                latitude: CITY_COORDS[city].lat,
                longitude: CITY_COORDS[city].lng,
                zoom: 13
            });
        }
    };

    // --- STEP 2 LOGIC (MAP) ---
    const addStepOnMap = (e) => {
        const lat = e.detail?.latLng?.lat ?? e.lngLat?.lat;
        const lng = e.detail?.latLng?.lng ?? e.lngLat?.lng;
        if (lat === undefined || lng === undefined) return;
        const newStep = {
            id: crypto.randomUUID(),
            order: steps.length + 1,
            lat: lat,
            lng: lng,
            title: `Tappa ${steps.length + 1}`,
            description: '',
            coordinates: { lat, lng },
            linked_business_id: null,
            partnerName: null // for UI display
        };
        const newSteps = [...steps, newStep];
        setSteps(newSteps);
        setSelectedStepIndex(newSteps.length - 1); // Focus new step
    };

    const updateStep = (index, field, value) => {
        const newSteps = [...steps];
        newSteps[index][field] = value;
        setSteps(newSteps);
    };

    const enrichStep = async (index) => {
        const currentStep = steps[index];
        // Only enrich if there is a title and no description yet
        if (!currentStep.title || currentStep.description || currentStep.title.startsWith('Tappa ')) return;
        
        showToast('Generazione AI in corso per ' + currentStep.title + '...', 'info');
        try {
            const enriched = await aiRecommendationService.enrichMonuments([currentStep]);
            if (enriched && enriched.length > 0 && enriched[0].historicalNotes) {
                const newSteps = [...steps];
                newSteps[index].description = enriched[0].historicalNotes;
                if (enriched[0].funFacts && enriched[0].funFacts.length > 0) {
                     newSteps[index].tags = enriched[0].funFacts; // Or store it in a specific field
                }
                setSteps(newSteps);
                showToast('Descrizione generata con successo!', 'success');
            }
        } catch (e) {
            console.error('AI Enrichment Failed:', e);
            // Optionally notify user or just fail silently
        }
    };

    const removeStep = (index) => {
        const newSteps = steps.filter((_, i) => i !== index);
        setSteps(newSteps);
        setSelectedStepIndex(null);
    };

    // Smart Partner Search (RPC)
    const searchPartners = async (query) => {
        if (!query || selectedStepIndex === null) return;

        const currentStep = steps[selectedStepIndex];
        const { data, error } = await supabase.rpc('search_nearby_partners', {
            lat: currentStep.coordinates.lat,
            lng: currentStep.coordinates.lng,
            radius_meters: 500, // 500m radius
            filter_tag: query
        });

        if (error) console.error(error);
        else setPartners(data || []);
    };

    const linkPartner = (partner) => {
        const newSteps = [...steps];
        newSteps[selectedStepIndex].linked_business_id = partner.id;
        newSteps[selectedStepIndex].partnerName = partner.name;
        newSteps[selectedStepIndex].title = partner.name; // Auto-set title
        setSteps(newSteps);
        setPartners([]); // Clear search
        setPartnerSearch('');
    };

    // GeoJSON Route Line
    const routeGeoJSON = {
        type: 'Feature',
        properties: {},
        geometry: {
            type: 'LineString',
            coordinates: steps.map(s => [s.coordinates.lng, s.coordinates.lat])
        }
    };


    // --- STEP 3 LOGIC (PUBLISH) ---
    // --- STEP 3 LOGIC (PUBLISH / UPDATE) ---
    const publishTour = async () => {
        if (steps.length === 0) {
            showToast('Inserisci almeno una tappa sulla mappa!', 'warning');
            return;
        }

        // 1. Validation Logic
        const validation = validateTourSteps(steps);
        if (!validation.valid) {
            showToast(`Errore dati: ${validation.error}`, 'error');
            return;
        }

        if (!user) {
            showToast('Errore: Utente non identificato. Effettua il login.', 'error');
            return;
        }

        setLoading(true);
        try {
            // 2. Route Path Generation (Mapbox Directions)
            let routeWKT;
            const routeData = await mapService.getRoute(steps);

            if (routeData && routeData.geometry) {
                // Convert GeoJSON LineString to WKT
                const coords = routeData.geometry.coordinates.map(c => `${c[0]} ${c[1]}`).join(', ');
                routeWKT = `LINESTRING(${coords})`;
            } else {
                // Fallback to straight lines if Mapbox fails
                console.warn("Mapbox route generation failed, using straight lines.");
                const coordsString = steps
                    .map(s => `${s.lng} ${s.lat}`)
                    .join(', ');
                routeWKT = `LINESTRING(${coordsString})`;
            }

            // Geo-Tagging Start Location
            const startStep = steps[0];
            const startLocationWKT = `POINT(${startStep.lng} ${startStep.lat})`;

            // 3. Clean Steps for DB (Ensure strictly schema compliant)
            const cleanSteps = steps.map((s, idx) => ({
                id: s.id || crypto.randomUUID(),
                order: idx + 1, // Ensure sequential order updates
                lat: s.lat,
                lng: s.lng,
                title: s.title,
                description: s.description || '',
                linked_business_id: s.linked_business_id || null
            }));

            // 4. Fetch Nearby Activities (Action 3 - Verification)
            // Ideally we could save these or just verify the function works here
            if (routeData && routeData.geometry) {
                const nearby = await mapService.fetchNearbyActivities(routeData.geometry, formData.city);
                console.log("Nearby Activities Found:", nearby.length);
                // We could attach these to the tour payload if there's a column, 
                // e.g., 'cached_activities', but for now we stick to the requested prompt 
                // which says "Implement a function...". The "appear on map" part 
                // likely implies the viewing-side logic.
            }

            const tourPayload = {
                guide_id: user.id,
                title: formData.title,
                description: formData.description,
                city: formData.city,
                price_eur: parseFloat(formData.price) || 0,
                duration_minutes: parseInt(formData.duration) || 0,
                max_participants: parseInt(formData.maxParticipants) || 10,
                language: formData.language,
                tags: formData.tags,
                steps: cleanSteps,
                route_path: routeWKT,
                start_location: startLocationWKT,
                image_urls: formData.image_urls,
                is_live: true
            };

            let error;

            if (isEditing) {
                const { error: updateError, data: updateData } = await supabase
                    .from('tours')
                    .update(tourPayload)
                    .eq('id', tourId)
                    .select();

                if (!updateError && (!updateData || updateData.length === 0)) {
                    throw new Error("Impossibile salvare: permesso negato o tour inesistente. Assicurati di esserne il proprietario.");
                }
                error = updateError;
            } else {
                const { error: insertError } = await supabase
                    .from('tours')
                    .insert(tourPayload);
                error = insertError;
            }

            if (error) throw error;

            showToast(isEditing ? 'Tour aggiornato con successo! ✨' : 'Tour pubblicato con successo! 🚀', 'success');
            setTimeout(() => navigate('/dashboard-guide'), 2000);
        } catch (err) {
            console.error('Publish Error:', err);
            showToast('Errore operazione: ' + err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="h-screen flex flex-col bg-gray-50">
            <Toast
                isVisible={toast.isVisible}
                message={toast.message}
                type={toast.type}
                onClose={() => setToast(prev => ({ ...prev, isVisible: false }))}
            />
            {/* Header Wizard */}
            <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center shadow-sm z-20">
                <h1 className="text-xl font-bold text-gray-800">{isEditing ? 'Modifica Tour' : 'Crea Nuovo Tour'}</h1>
                <div className="flex gap-2">
                    <div className={`h-2 w-16 rounded-full transition-colors ${step >= 1 ? 'bg-orange-600' : 'bg-gray-200'}`}></div>
                    <div className={`h-2 w-16 rounded-full transition-colors ${step >= 2 ? 'bg-orange-600' : 'bg-gray-200'}`}></div>
                    <div className={`h-2 w-16 rounded-full transition-colors ${step >= 3 ? 'bg-orange-600' : 'bg-gray-200'}`}></div>
                </div>
            </div>

            <main className="flex-1 overflow-hidden relative">

                {/* STEP 1: GENERAL INFO */}
                {step === 1 && (
                    <motion.div
                        initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                        className="max-w-2xl mx-auto mt-10 p-8 bg-white rounded-2xl shadow-lg"
                    >
                        <h2 className="text-2xl font-serif mb-6 text-gray-800">Raccontaci la tua idea</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Titolo (Min 5 caratteri)</label>
                                <input
                                    type="text"
                                    className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-orange-500 outline-none"
                                    placeholder="Es. Roma Segreta: Il Quartiere Coppedè"
                                    value={formData.title}
                                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Città</label>
                                    <select
                                        className="w-full border border-gray-300 rounded-lg p-3 outline-none"
                                        value={formData.city}
                                        onChange={handleCityChange}
                                    >
                                        {Object.keys(CITY_COORDS).map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Prezzo (€)</label>
                                    <input
                                        type="number"
                                        className="w-full border border-gray-300 rounded-lg p-3 outline-none"
                                        placeholder="0.00"
                                        value={formData.price}
                                        onChange={e => setFormData({ ...formData, price: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Descrizione</label>
                                <textarea
                                    className="w-full border border-gray-300 rounded-lg p-3 h-24 outline-none"
                                    placeholder="Descrivi l'esperienza che vivranno i tuoi ospiti..."
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Durata (minuti)</label>
                                <input
                                    type="number"
                                    className="w-full border border-gray-300 rounded-lg p-3 outline-none"
                                    placeholder="Es. 90"
                                    value={formData.duration}
                                    onChange={e => setFormData({ ...formData, duration: e.target.value })}
                                />
                            </div>

                            {/* New Standard Fields */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Max Partecipanti</label>
                                    <div className="relative">
                                        <Users className="absolute left-3 top-3 text-gray-400" size={18} />
                                        <input
                                            type="number"
                                            className="w-full pl-10 border border-gray-300 rounded-lg p-3 outline-none"
                                            value={formData.maxParticipants}
                                            onChange={e => setFormData({ ...formData, maxParticipants: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Lingua</label>
                                    <div className="relative">
                                        <Globe className="absolute left-3 top-3 text-gray-400" size={18} />
                                        <select
                                            className="w-full pl-10 border border-gray-300 rounded-lg p-3 outline-none bg-white"
                                            value={formData.language}
                                            onChange={e => setFormData({ ...formData, language: e.target.value })}
                                        >
                                            <option>Italiano</option>
                                            <option>English</option>
                                            <option>Français</option>
                                            <option>Español</option>
                                            <option>Deutsch</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Tags Selection */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Categoria (Max 3)</label>
                                <div className="flex flex-wrap gap-2">
                                    {PREDEFINED_TAGS.map(tag => (
                                        <button
                                            key={tag}
                                            onClick={() => toggleTag(tag)}
                                            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${formData.tags.includes(tag)
                                                ? 'bg-orange-100 border-orange-200 text-orange-700'
                                                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                                }`}
                                        >
                                            {tag}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {/* IMAGE UPLOAD SECTION */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Galleria Foto (Max 5)</label>
                                {/* REAL IMAGE UPLOAD */}
                                <div className="grid grid-cols-3 gap-3 mb-2">
                                    {formData.image_urls.map((url, idx) => (
                                        <div key={idx} className="relative aspect-video rounded-lg overflow-hidden group">
                                            <img src={url} alt={`Preview ${idx}`} className="w-full h-full object-cover" />
                                            <button
                                                onClick={() => setFormData(prev => ({ ...prev, image_urls: prev.image_urls.filter((_, i) => i !== idx) }))}
                                                className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    ))}
                                    {formData.image_urls.length < 5 && (
                                        <div className="aspect-video border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:border-orange-400 hover:text-orange-500 cursor-pointer transition-colors relative">
                                            {uploadingImage ? (
                                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-500"></div>
                                            ) : (
                                                <>
                                                    <Upload size={24} className="mb-1" />
                                                    <span className="text-xs font-bold">Aggiungi Foto</span>
                                                </>
                                            )}
                                            <input
                                                type="file"
                                                accept="image/*"
                                                className="absolute inset-0 opacity-0 cursor-pointer"
                                                disabled={uploadingImage}
                                                onChange={async (e) => {
                                                    const file = e.target.files[0];
                                                    if (!file) return;

                                                    setUploadingImage(true);
                                                    try {
                                                        const fileExt = file.name.split('.').pop();
                                                        const fileName = `${Math.random()}.${fileExt}`;
                                                        const filePath = `${user.id}/${fileName}`;

                                                        const { error: uploadError } = await supabase.storage
                                                            .from('tour-images')
                                                            .upload(filePath, file);

                                                        if (uploadError) throw uploadError;

                                                        const { data: { publicUrl } } = supabase.storage
                                                            .from('tour-images')
                                                            .getPublicUrl(filePath);

                                                        setFormData(prev => ({
                                                            ...prev,
                                                            image_urls: [...prev.image_urls, publicUrl]
                                                        }));
                                                        showToast('Immagine caricata con successo!', 'success');
                                                    } catch (error) {
                                                        console.error('Error uploading image:', error);
                                                        showToast('Errore caricamento immagine: ' + error.message, 'error');
                                                    } finally {
                                                        setUploadingImage(false);
                                                    }
                                                }}
                                            />
                                        </div>
                                    )}
                                </div>

                            </div >
                        </div>
                        <div className="mt-8 flex justify-end">
                            <button
                                onClick={() => formData.title.length >= 5 && setStep(2)}
                                disabled={formData.title.length < 5}
                                className="bg-orange-600 disabled:bg-gray-300 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-orange-700 transition"
                            >
                                Vai alla Mappa <ChevronRight size={20} />
                            </button>
                        </div>
                    </motion.div >
                )
                }

                {/* STEP 2: MAP EDITOR (SPLIT VIEW) */}
                {
                    step === 2 && (
                        <div className="flex h-full">
                            {/* Sidebar Editor */}
                            <div className="w-1/3 min-w-[350px] bg-white border-r border-gray-200 flex flex-col z-10 shadow-xl">
                                <div className="p-4 border-b border-gray-100 bg-gray-50">
                                    <h3 className="font-bold text-gray-800">Tappe del Tour ({steps.length})</h3>
                                    <p className="text-xs text-gray-500">Clicca sulla mappa per aggiungere punti</p>
                                </div>

                                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                    {steps.length === 0 && (
                                        <div className="text-center py-10 text-gray-400">
                                            <MapPin className="mx-auto h-12 w-12 mb-2 opacity-20" />
                                            <p>La mappa è la tua tela.<br />Clicca per iniziare.</p>
                                        </div>
                                    )}

                                    {steps.map((s, idx) => (
                                        <div
                                            key={idx}
                                            className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${selectedStepIndex === idx ? 'border-orange-500 bg-orange-50' : 'border-gray-100 hover:border-gray-300'}`}
                                            onClick={() => {
                                                setSelectedStepIndex(idx);
                                                setViewState({ ...viewState, latitude: s.coordinates.lat, longitude: s.coordinates.lng, zoom: 16 });
                                            }}
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="bg-gray-800 text-white text-xs font-bold px-2 py-0.5 rounded-full">#{idx + 1}</span>
                                                <button onClick={(e) => { e.stopPropagation(); removeStep(idx); }} className="text-red-400 hover:text-red-600"><Trash2 size={16} /></button>
                                            </div>
                                            {selectedStepIndex === idx ? (
                                                <div className="space-y-3">
                                                    <input
                                                        type="text"
                                                        className="w-full text-sm border-gray-300 rounded p-2"
                                                        value={s.title}
                                                        onChange={(e) => updateStep(idx, 'title', e.target.value)}
                                                        onBlur={() => enrichStep(idx)}
                                                        placeholder="Nome Tappa" // Auto-filled by partner
                                                    />
                                                    {/* Smart Partner Search */}
                                                    <div className="relative">
                                                        <div className="flex">
                                                            <input
                                                                type="text"
                                                                className="w-full text-sm border-gray-300 rounded-l p-2"
                                                                placeholder="Cerca partner vicini..."
                                                                value={partnerSearch}
                                                                onChange={(e) => setPartnerSearch(e.target.value)}
                                                            />
                                                            <button
                                                                onClick={() => searchPartners(partnerSearch)}
                                                                className="bg-gray-100 px-3 border border-l-0 border-gray-300 rounded-r hover:bg-gray-200"
                                                            >
                                                                <Search size={16} />
                                                            </button>
                                                        </div>
                                                        {partners.length > 0 && (
                                                            <div className="absolute top-full left-0 right-0 bg-white shadow-xl rounded-b-lg border border-gray-200 z-50 max-h-40 overflow-y-auto">
                                                                {partners.map(p => (
                                                                    <div
                                                                        key={p.id}
                                                                        className="p-2 hover:bg-orange-50 cursor-pointer text-sm border-b"
                                                                        onClick={() => linkPartner(p)}
                                                                    >
                                                                        <div className="font-bold text-gray-800">{p.name}</div>
                                                                        <div className="text-xs text-gray-500">Tier: {p.tier} • {Math.round(p.distance_meters)}m</div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                    {s.linked_business_id && (
                                                        <div className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded flex items-center gap-1">
                                                            <Check size={12} /> Partner Collegato: {s.partnerName}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <h4 className="font-semibold text-gray-700">{s.title}</h4>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                <div className="p-4 border-t border-gray-200 bg-white">
                                    <div className="flex justify-between gap-3">
                                        <button
                                            onClick={() => setStep(1)}
                                            className="w-1/2 py-3 border border-gray-300 rounded-xl font-bold text-gray-600 hover:bg-gray-50"
                                        >
                                            Indietro
                                        </button>
                                        <button
                                            onClick={() => setStep(3)}
                                            // UNLIMITED STOPS: Removed disabled condition
                                            className="w-1/2 py-3 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-700 shadow-lg transition-all"
                                        >
                                            Riepilogo ({steps.length}/3)
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Map Surface */}
                            <div className="flex-1 relative">
                                <UnnivaiMap
                                    initialCenter={{ latitude: viewState.latitude, longitude: viewState.longitude }}
                                    defaultZoom={viewState.zoom}
                                    activities={steps.map(s => ({ ...s, category: 'Tour Step' }))}
                                    routePoints={steps}
                                    onClick={addStepOnMap}
                                    onActivityClick={(item) => {
                                        const originalIndex = steps.findIndex(s => s.id === item.id);
                                        if (originalIndex !== -1) setSelectedStepIndex(originalIndex);
                                    }}
                                />

                                {/* Overlay Instructions */}
                                <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-md px-4 py-2 rounded-lg shadow-md border border-gray-200 text-sm font-medium z-10 pointer-events-none">
                                    📍 Clicca sulla mappa per aggiungere una tappa
                                </div>
                            </div>
                        </div>
                    )
                }

                {/* STEP 3: REVIEW */}
                {
                    step === 3 && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                            className="max-w-3xl mx-auto mt-6 p-8 bg-white rounded-2xl shadow-xl"
                        >
                            <div className="text-center mb-6">
                                <div className="mx-auto h-16 w-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-3">
                                    <Check size={32} />
                                </div>
                                <h2 className="text-2xl font-serif text-gray-900 mb-1">{isEditing ? 'Conferma Modifiche' : 'Tutto pronto!'}</h2>
                                <p className="text-gray-500 text-sm">Controlla i dettagli prima di {isEditing ? 'salvare' : 'pubblicare'}.</p>
                            </div>

                            {/* Cover Image Preview */}
                            <div className="w-full h-48 mb-4 rounded-xl overflow-hidden border border-gray-200 bg-gray-100">
                                {formData.image_urls && formData.image_urls.length > 0 ? (
                                    <img src={formData.image_urls[0]} alt="Anteprima Tour" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                                        <Upload size={32} className="mb-2" />
                                        <p className="text-sm">Nessuna foto copertina</p>
                                        <p className="text-xs">Torna allo Step 1 per aggiungerne una</p>
                                    </div>
                                )}
                            </div>

                            <div className="bg-gray-50 rounded-xl p-5 text-left mb-6 border border-gray-100 space-y-3">
                                <h3 className="text-xl font-bold text-gray-900">{formData.title}</h3>
                                {formData.description && (
                                    <p className="text-gray-600 text-sm line-clamp-3">{formData.description}</p>
                                )}

                                <div className="grid grid-cols-2 gap-3 text-sm pt-3 border-t border-gray-200">
                                    <div className="flex justify-between bg-white p-2 rounded-lg">
                                        <span className="text-gray-500">Prezzo</span>
                                        <span className="font-bold text-green-700">€{formData.price || 0}</span>
                                    </div>
                                    <div className="flex justify-between bg-white p-2 rounded-lg">
                                        <span className="text-gray-500">Durata</span>
                                        <span className="font-bold">{formData.duration || 0} min</span>
                                    </div>
                                    <div className="flex justify-between bg-white p-2 rounded-lg">
                                        <span className="text-gray-500">Città</span>
                                        <span className="font-bold">{formData.city}</span>
                                    </div>
                                    <div className="flex justify-between bg-white p-2 rounded-lg">
                                        <span className="text-gray-500">Tappe</span>
                                        <span className="font-bold">{steps.length}</span>
                                    </div>
                                    <div className="flex justify-between bg-white p-2 rounded-lg">
                                        <span className="text-gray-500">Max Partecipanti</span>
                                        <span className="font-bold">{formData.maxParticipants}</span>
                                    </div>
                                    <div className="flex justify-between bg-white p-2 rounded-lg">
                                        <span className="text-gray-500">Lingua</span>
                                        <span className="font-bold">{formData.language}</span>
                                    </div>
                                </div>
                                {formData.tags && formData.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-2 pt-2">
                                        {formData.tags.map(tag => (
                                            <span key={tag} className="bg-orange-100 text-orange-700 text-xs font-bold px-2 py-1 rounded-full">{tag}</span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-3 justify-center">
                                <button
                                    onClick={() => setStep(1)}
                                    className="flex-1 px-4 py-3 border-2 border-orange-200 rounded-xl font-bold text-orange-600 hover:bg-orange-50 transition-colors"
                                >
                                    ✏️ Modifica Info
                                </button>
                                <button
                                    onClick={() => setStep(2)}
                                    className="flex-1 px-4 py-3 border border-gray-300 rounded-xl font-bold text-gray-600 hover:bg-gray-50"
                                >
                                    🗺 Modifica Mappa
                                </button>
                                <button
                                    onClick={publishTour}
                                    disabled={loading}
                                    className="flex-1 px-4 py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 shadow-lg hover:shadow-green-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {loading ? 'Salvataggio...' : isEditing ? '💾 Salva Modifiche' : '🚀 Pubblica Ora'}
                                </button>
                            </div>
                        </motion.div>
                    )
                }

            </main >
        </div >
    );
}
