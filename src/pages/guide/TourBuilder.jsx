
import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Map, { Marker, Source, Layer, Popup } from 'react-map-gl';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Upload, ChevronRight, Check, Search, Trash2 } from 'lucide-react';

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
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        city: 'Roma',
        price: '',
        duration: '',
        coverUrl: ''
    });

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
        const { lng, lat } = e.lngLat;
        const newStep = {
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
    const publishTour = async () => {
        if (steps.length < 3) {
            alert('Devi inserire almeno 3 tappe!');
            return;
        }

        setLoading(true);
        try {
            // Construct Route Path WKT for PostGIS
            // LINESTRING(lng lat, lng lat, ...)
            const coordsString = steps
                .map(s => `${s.coordinates.lng} ${s.coordinates.lat}`)
                .join(', ');
            const routeWKT = `LINESTRING(${coordsString})`;

            const { error } = await supabase
                .from('tours')
                .insert({
                    guide_id: user.id,
                    title: formData.title,
                    description: formData.description,
                    city: formData.city,
                    price_eur: parseFloat(formData.price),
                    duration_minutes: parseInt(formData.duration),
                    steps: steps, // JSONB structure
                    route_path: routeWKT, // Spatial column
                    is_live: true // Publish immediately for MVP
                });

            if (error) throw error;

            alert('Tour pubblicato con successo!');
            navigate('/dashboard-guide');
        } catch (err) {
            console.error('Publish Error:', err);
            alert('Errore durante la pubblicazione: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="h-screen flex flex-col bg-gray-50">
            {/* Header Wizard */}
            <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center shadow-sm z-20">
                <h1 className="text-xl font-bold text-gray-800">Crea Nuovo Tour</h1>
                <div className="flex gap-2">
                    <div className={`h-2 w-16 rounded-full ${step >= 1 ? 'bg-orange-600' : 'bg-gray-200'}`}></div>
                    <div className={`h-2 w-16 rounded-full ${step >= 2 ? 'bg-orange-600' : 'bg-gray-200'}`}></div>
                    <div className={`h-2 w-16 rounded-full ${step >= 3 ? 'bg-orange-600' : 'bg-gray-200'}`}></div>
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
                            {/* Placeholder for Duration */}
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
                    </motion.div>
                )}

                {/* STEP 2: MAP EDITOR (SPLIT VIEW) */}
                {step === 2 && (
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
                                        disabled={steps.length < 3}
                                        className="w-1/2 py-3 bg-orange-600 disabled:bg-gray-300 text-white rounded-xl font-bold hover:bg-orange-700 shadow-lg disabled:shadow-none transition-all"
                                    >
                                        Riepilogo ({steps.length}/3)
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Map Surface */}
                        <div className="flex-1 relative">
                            <Map
                                {...viewState}
                                onMove={evt => setViewState(evt.viewState)}
                                mapStyle="mapbox://styles/mapbox/streets-v12"
                                mapboxAccessToken={MAPBOX_TOKEN}
                                onClick={addStepOnMap}
                                cursor="crosshair"
                            >
                                {/* Route Line */}
                                {steps.length > 1 && (
                                    <Source id="route" type="geojson" data={routeGeoJSON}>
                                        <Layer
                                            id="route-layer"
                                            type="line"
                                            paint={{
                                                'line-color': '#ea580c',
                                                'line-width': 4,
                                                'line-dasharray': [2, 1]
                                            }}
                                        />
                                    </Source>
                                )}

                                {/* Markers */}
                                {steps.map((s, idx) => (
                                    <Marker
                                        key={idx}
                                        latitude={s.coordinates.lat}
                                        longitude={s.coordinates.lng}
                                        anchor="bottom"
                                        onClick={(e) => {
                                            e.originalEvent.stopPropagation();
                                            setSelectedStepIndex(idx);
                                        }}
                                    >
                                        <div className={`
                                            flex items-center justify-center w-8 h-8 rounded-full border-2 shadow-lg cursor-pointer transform transition-transform hover:scale-110
                                            ${selectedStepIndex === idx ? 'bg-orange-600 border-white text-white scale-125 z-50' : 'bg-white border-orange-600 text-orange-600'}
                                        `}>
                                            <span className="font-bold text-sm">{idx + 1}</span>
                                        </div>
                                    </Marker>
                                ))}
                            </Map>

                            {/* Overlay Instructions */}
                            <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-md px-4 py-2 rounded-lg shadow-md border border-gray-200 text-sm font-medium z-10 pointer-events-none">
                                📍 Clicca sulla mappa per aggiungere una tappa
                            </div>
                        </div>
                    </div>
                )}

                {/* STEP 3: REVIEW */}
                {step === 3 && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                        className="max-w-3xl mx-auto mt-10 p-8 bg-white rounded-2xl shadow-xl text-center"
                    >
                        <div className="mb-6">
                            <div className="mx-auto h-20 w-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
                                <Check size={40} />
                            </div>
                            <h2 className="text-3xl font-serif text-gray-900 mb-2">Tutto pronto!</h2>
                            <p className="text-gray-500">Il tuo tour "{formData.title}" sta per andare live a {formData.city}.</p>
                        </div>

                        <div className="bg-gray-50 rounded-xl p-6 text-left mb-8 border border-gray-100">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div><span className="text-gray-500">Prezzo:</span> <span className="font-bold">€{formData.price}</span></div>
                                <div><span className="text-gray-500">Durata:</span> <span className="font-bold">{formData.duration} min</span></div>
                                <div><span className="text-gray-500">Tappe:</span> <span className="font-bold">{steps.length}</span></div>
                                <div><span className="text-gray-500">Partner:</span> <span className="font-bold">{steps.filter(s => s.linked_business_id).length} collegati</span></div>
                            </div>
                        </div>

                        <div className="flex gap-4 justify-center">
                            <button
                                onClick={() => setStep(2)}
                                className="px-6 py-3 border border-gray-300 rounded-xl font-bold text-gray-600 hover:bg-gray-50"
                            >
                                Modifica Mappa
                            </button>
                            <button
                                onClick={publishTour}
                                disabled={loading}
                                className="px-8 py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 shadow-lg hover:shadow-green-200 transition-all flex items-center gap-2"
                            >
                                {loading ? 'Pubblicazione...' : 'Pubblica Ora 🚀'}
                            </button>
                        </div>
                    </motion.div>
                )}

            </main>
        </div>
    );
}
