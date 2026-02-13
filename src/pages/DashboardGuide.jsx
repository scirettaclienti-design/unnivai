
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { Plus, BarChart, Users, Star, Map, Edit, Eye, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function DashboardGuide() {
    const { user } = useAuth();
    const [guideProfile, setGuideProfile] = useState(null);
    const [tours, setTours] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) return;

        const fetchData = async () => {
            try {
                // 1. Fetch Guide Profile
                const { data: profile, error: profileError } = await supabase
                    .from('guides')
                    .select('*')
                    .eq('id', user.id)
                    .single();

                if (profileError) throw profileError;

                // Get Auth User Metadata for name/avatar if not in guides table
                const { data: { user: authUser } } = await supabase.auth.getUser();
                const userName = authUser?.user_metadata?.full_name || 'Guida';

                setGuideProfile({ ...profile, full_name: userName });

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

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
            </div>
        );
    }

    const commissionRate = guideProfile?.level === 'mentore' ? 10 : guideProfile?.level === 'ambasciatore' ? 15 : 20;

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            {/* Header / Top Bar */}
            <div className="bg-white border-b border-gray-200 sticky top-0 z-10 px-6 py-4 flex justify-between items-center shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold">
                        {guideProfile?.full_name?.charAt(0) || 'G'}
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">{guideProfile?.full_name}</h1>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${guideProfile?.level === 'mentore' ? 'bg-purple-100 text-purple-700' :
                                    guideProfile?.level === 'ambasciatore' ? 'bg-blue-100 text-blue-700' :
                                        'bg-green-100 text-green-700'
                                }`}>
                                {guideProfile?.level?.toUpperCase() || 'ESPLORATORE'}
                            </span>
                            <span>•</span>
                            <span>Fee: {commissionRate}%</span>
                        </div>
                    </div>
                </div>

                <Link to="/guide/create-tour" className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-md">
                    <Plus size={18} />
                    <span className="hidden sm:inline">Nuovo Tour</span>
                </Link>
            </div>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

                {/* Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    <StatCard
                        icon={<BarChart className="text-blue-600" />}
                        label="Guadagni Totali"
                        value={`€ ${(tours.length * 120).toFixed(0)}`} // Placeholder calc based on tours
                        subtext="Ultimi 30 giorni"
                        color="bg-blue-50"
                    />
                    <StatCard
                        icon={<Map className="text-orange-600" />}
                        label="Tour Attivi"
                        value={tours.filter(t => t.is_live).length}
                        subtext={`Su ${tours.length} totali`}
                        color="bg-orange-50"
                    />
                    <StatCard
                        icon={<Users className="text-green-600" />}
                        label="Partecipanti"
                        value={tours.reduce((acc, t) => acc + (t.current_participants || 0), 0)}
                        subtext="Totale storico"
                        color="bg-green-50"
                    />
                    <StatCard
                        icon={<Star className="text-yellow-600" />}
                        label="Rating Medio"
                        value={guideProfile?.ranking_score?.toFixed(1) || 'N/A'}
                        subtext="Basato su 0 recensioni"
                        color="bg-yellow-50"
                    />
                </div>

                {/* Tours Management Section */}
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-800">I Miei Tour</h2>
                    <div className="flex gap-2">
                        {/* Filters could go here */}
                    </div>
                </div>

                {tours.length === 0 ? (
                    <EmptyState />
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {tours.map((tour) => (
                            <TourCard key={tour.id} tour={tour} />
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}

// Sub-components for cleaner file

const StatCard = ({ icon, label, value, subtext, color }) => (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-start justify-between">
        <div>
            <p className="text-gray-500 text-sm font-medium mb-1">{label}</p>
            <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
            <p className="text-xs text-gray-400 mt-1">{subtext}</p>
        </div>
        <div className={`p-3 rounded-xl ${color}`}>
            {icon}
        </div>
    </div>
);

const TourCard = ({ tour }) => {
    // Extract first image or use placeholder
    const coverImage = tour.steps?.[0]?.media?.[0]?.url || tour.steps?.[0]?.image || `https://source.unsplash.com/800x600/?${tour.city},travel`;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow group"
        >
            <div className="h-48 bg-gray-200 relative overflow-hidden">
                <img
                    src={coverImage}
                    alt={tour.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    onError={(e) => e.target.src = 'https://placehold.co/600x400?text=No+Image'}
                />
                <div className="absolute top-3 right-3">
                    <span className={`px-2 py-1 rounded-md text-xs font-bold uppercase tracking-wide backdrop-blur-md ${tour.is_live
                            ? 'bg-green-500/90 text-white'
                            : 'bg-gray-800/80 text-white'
                        }`}>
                        {tour.is_live ? 'Pubblicato' : 'Bozza'}
                    </span>
                </div>
            </div>

            <div className="p-5">
                <div className="flex justify-between items-start mb-2">
                    <div>
                        <h3 className="font-bold text-lg text-gray-900 line-clamp-1">{tour.title}</h3>
                        <p className="text-sm text-gray-500 flex items-center gap-1">
                            <Map size={14} /> {tour.city}
                        </p>
                    </div>
                    <p className="font-bold text-orange-600">€{tour.price_eur}</p>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center text-gray-500">
                    <div className="text-xs">
                        {tour.duration_minutes} min • {tour.max_participants} max
                    </div>
                    <div className="flex gap-2">
                        <button className="p-2 hover:bg-gray-100 rounded-full text-gray-600 transition-colors" title="Vedi">
                            <Eye size={18} />
                        </button>
                        <button className="p-2 hover:bg-gray-100 rounded-full text-blue-600 transition-colors" title="Modifica">
                            <Edit size={18} />
                        </button>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

const EmptyState = () => (
    <div className="text-center py-16 bg-white rounded-3xl border-2 border-dashed border-gray-200">
        <div className="mx-auto h-24 w-24 bg-orange-50 rounded-full flex items-center justify-center mb-6">
            <Map className="text-orange-400 h-10 w-10" />
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">Non hai ancora creato nessun tour</h3>
        <p className="text-gray-500 max-w-sm mx-auto mb-8">Inizia a guadagnare condividendo la tua passione per la tua città. Crea il tuo primo itinerario in pochi minuti.</p>
        <Link to="/guide/create-tour" className="inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-xl font-bold transition-all hover:scale-105 active:scale-95 shadow-lg shadow-orange-200">
            <Plus size={20} />
            Crea il tuo Primo Tour
        </Link>
    </div>
);
