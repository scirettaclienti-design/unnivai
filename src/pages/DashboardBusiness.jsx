
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import { MapPin, Edit, Star, Image as ImageIcon, Briefcase, Lock, Save, Trophy } from 'lucide-react';

const VIBE_TAGS = [
    'Romantico', 'Veloce', 'Tradizionale', 'Relax', 'Gourmet',
    'Economico', 'Vista Panoramica', 'Vegano', 'Artistico', 'Storico', 'Notturno'
];

export default function DashboardBusiness() {
    const { user } = useAuth();
    const [business, setBusiness] = useState(null);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        description: '',
        opening_hours: '',
        vibe_tags: []
    });

    useEffect(() => {
        if (!user) return;

        const fetchBusiness = async () => {
            try {
                const { data, error } = await supabase
                    .from('activities')
                    .select('*')
                    .eq('owner_id', user.id)
                    .single();

                if (error) throw error;

                setBusiness(data);
                setFormData({
                    description: data.description || '',
                    opening_hours: typeof data.opening_hours === 'string' ? data.opening_hours : JSON.stringify(data.opening_hours, null, 2),
                    vibe_tags: data.vibe_tags || []
                });
            } catch (err) {
                console.error('Error fetching business:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchBusiness();
    }, [user]);

    const handleTagToggle = (tag) => {
        const currentTags = formData.vibe_tags;
        if (currentTags.includes(tag)) {
            setFormData({ ...formData, vibe_tags: currentTags.filter(t => t !== tag) });
        } else {
            if (currentTags.length >= 5) return alert('Massimo 5 tag!');
            setFormData({ ...formData, vibe_tags: [...currentTags, tag] });
        }
    };

    const saveChanges = async () => {
        try {
            const { error } = await supabase
                .from('activities')
                .update({
                    description: formData.description,
                    opening_hours: formData.opening_hours, // Simplified for now
                    vibe_tags: formData.vibe_tags
                })
                .eq('id', business.id);

            if (error) throw error;

            setBusiness({ ...business, ...formData });
            setEditing(false);
            alert('Profilo aggiornato con successo!');
        } catch (err) {
            console.error('Update Error:', err);
            alert('Errore aggiornamento: ' + err.message);
        }
    };

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="animate-spin h-10 w-10 border-2 border-blue-600 rounded-full border-t-transparent"></div>
        </div>;
    }

    if (!business) {
        return <div className="p-8 text-center">Nessuna attività collegata a questo account.</div>;
    }

    const isPremium = business.subscription_tier === 'premium';
    const isFree = business.subscription_tier === 'free';

    return (
        <div className="min-h-screen bg-gray-50 pb-20">

            {/* Header */}
            <div className="bg-white px-6 py-6 shadow-sm border-b border-gray-200">
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">{business.name}</h1>
                        <p className="text-gray-500 flex items-center gap-1 text-sm mt-1">
                            <MapPin size={14} /> {business.city || 'Roma, Italia'}
                        </p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide flex items-center gap-1 ${isPremium ? 'bg-purple-100 text-purple-700' :
                            business.subscription_tier === 'base' ? 'bg-blue-100 text-blue-700' :
                                'bg-gray-100 text-gray-600'
                        }`}>
                        {isPremium && <Trophy size={12} />}
                        {business.subscription_tier}
                    </span>
                </div>

                {!isPremium && (
                    <div className="mt-4 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl p-4 text-white flex justify-between items-center shadow-lg transform hover:scale-[1.01] transition-transform cursor-pointer">
                        <div>
                            <h3 className="font-bold text-lg">Passa a Premium 👑</h3>
                            <p className="text-purple-100 text-sm">Sblocca analisi avanzate e visibilità prioritaria.</p>
                        </div>
                        <button className="bg-white text-purple-700 px-4 py-2 rounded-lg font-bold text-sm shadow hover:bg-gray-100">
                            Upgrade
                        </button>
                    </div>
                )}
            </div>

            <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">

                {/* Main Stats (Tier Gated) */}
                <div className="grid grid-cols-2 gap-4">
                    <StatCard
                        title="Ricerche Guide"
                        value={isPremium ? "124" : "???"}
                        locked={!isPremium}
                        icon={<Briefcase size={20} className="text-blue-500" />}
                    />
                    <StatCard
                        title="Selezionato in Tour"
                        value={isPremium ? "8" : "?"}
                        locked={!isPremium}
                        icon={<Star size={20} className="text-yellow-500" />}
                    />
                </div>

                {/* Profile Editor */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                        <h2 className="font-bold text-gray-800 flex items-center gap-2">
                            <Edit size={18} className="text-gray-400" />
                            Il tuo Profilo Publico
                        </h2>
                        <button
                            onClick={() => editing ? saveChanges() : setEditing(true)}
                            className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${editing
                                    ? 'bg-green-600 text-white hover:bg-green-700 shadow-md'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            {editing ? <><Save size={16} /> Salva Modifiche</> : 'Modifica'}
                        </button>
                    </div>

                    <div className="p-6 space-y-6">
                        {/* Description */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Descrizione Attività</label>
                            {editing ? (
                                <textarea
                                    className="w-full border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-blue-500 outline-none h-32 resize-none"
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Racconta la tua storia..."
                                />
                            ) : (
                                <p className="text-gray-600 text-sm leading-relaxed">
                                    {business.description || 'Nessuna descrizione inserita. Modifica il profilo per aggiungerne una.'}
                                </p>
                            )}
                        </div>

                        {/* Vibe Tags */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                I tuoi Vibe Tags <span className="text-xs font-normal text-gray-400">(Max 5)</span>
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {editing ? (
                                    VIBE_TAGS.map(tag => (
                                        <button
                                            key={tag}
                                            onClick={() => handleTagToggle(tag)}
                                            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${formData.vibe_tags.includes(tag)
                                                    ? 'bg-blue-100 border-blue-200 text-blue-700'
                                                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                                }`}
                                        >
                                            {tag}
                                        </button>
                                    ))
                                ) : (
                                    business.vibe_tags?.length > 0
                                        ? business.vibe_tags.map(tag => (
                                            <span key={tag} className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm font-medium">
                                                {tag}
                                            </span>
                                        ))
                                        : <span className="text-gray-400 italic text-sm">Nessun tag selezionato</span>
                                )}
                            </div>
                        </div>

                        {/* Opening Hours Simple */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Orari di Apertura</label>
                            {editing ? (
                                <input
                                    type="text"
                                    className="w-full border border-gray-300 rounded-lg p-3 outline-none"
                                    value={formData.opening_hours}
                                    onChange={e => setFormData({ ...formData, opening_hours: e.target.value })}
                                    placeholder="Es. Lun-Sab 09:00 - 20:00"
                                />
                            ) : (
                                <p className="text-gray-800 font-medium">
                                    {typeof business.opening_hours === 'string' ? business.opening_hours : 'Orari non specificati'}
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Photos Section Placeholder */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col items-center justify-center text-center space-y-4">
                    <div className="h-16 w-16 bg-blue-50 rounded-full flex items-center justify-center text-blue-500">
                        <ImageIcon size={32} />
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-900">Foto Copertina & Gallery</h3>
                        <p className="text-sm text-gray-500 max-w-xs mx-auto">Carica foto ad alta risoluzione per attirare più clienti.</p>
                    </div>
                    <button className="text-blue-600 font-bold text-sm hover:underline">Gestisci Foto</button>
                </div>

            </main>
        </div>
    );
}

const StatCard = ({ title, value, locked, icon }) => (
    <div className={`relative overflow-hidden bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 ${locked ? 'opacity-75' : ''}`}>
        <div className={`p-3 rounded-xl ${locked ? 'bg-gray-100 text-gray-400' : 'bg-blue-50 text-blue-600'}`}>
            {locked ? <Lock size={20} /> : icon}
        </div>
        <div>
            <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">{title}</p>
            <h3 className={`text-2xl font-bold ${locked ? 'blur-sm select-none' : 'text-gray-900'}`}>{value}</h3>
        </div>

        {locked && (
            <div className="absolute inset-0 bg-white/40 backdrop-blur-[1px] flex items-center justify-center z-10 transition-opacity opacity-0 hover:opacity-100 cursor-help">
                <span className="bg-gray-900 text-white text-xs px-2 py-1 rounded shadow-lg">Premium Feature</span>
            </div>
        )}
    </div>
);
