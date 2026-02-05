import React from 'react';
import { useUserProfile } from '../hooks/useUserProfile';
import { useQuery } from '@tanstack/react-query';
import { dataService } from '../services/dataService';
import { Building2, MapPin, TrendingUp, Plus, Info } from 'lucide-react';

const DashboardBusiness = () => {
    const { profile } = useUserProfile();

    // Fetch activities owned by this business
    const { data: activities, isLoading } = useQuery({
        queryKey: ['business-activities', profile?.id],
        queryFn: () => dataService.getActivitiesByOwner(profile?.id),
        enabled: !!profile?.id,
        initialData: []
    });

    const primaryActivity = activities && activities.length > 0 ? activities[0] : null;
    const currentTier = primaryActivity?.level || 'free';
    const businessName = primaryActivity?.name || profile?.name || 'La tua Attività';
    const city = primaryActivity?.city || 'Città non impostata';

    return (
        <div className="p-6 max-w-4xl mx-auto font-sans">
            <h1 className="text-3xl font-bold mb-6 text-gray-800">Dashboard Business</h1>

            {/* Business Info Panel */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8 flex items-start justify-between">
                <div>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <Building2 className="text-indigo-600" size={24} />
                        {businessName}
                    </h2>
                    <p className="text-gray-500 mt-1 flex items-center gap-1">
                        <MapPin size={16} /> {city}
                    </p>
                </div>
                <div className="text-right">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${currentTier === 'premium' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                            currentTier === 'pro' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                                'bg-gray-50 text-gray-600 border-gray-200'
                        }`}>
                        Livello {currentTier}
                    </span>
                    <p className="text-xs text-gray-400 mt-2">Visibilità mappa</p>
                </div>
            </div>

            {/* Activities List & Value Proposition */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

                {/* Left: Activities List */}
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-lg text-gray-700">Le tue Attività</h3>
                        {activities.length > 0 &&
                            <button className="text-sm text-indigo-600 font-medium hover:underline flex items-center gap-1">
                                <Plus size={16} /> Aggiungi
                            </button>
                        }
                    </div>

                    {isLoading ? (
                        <div className="h-32 bg-gray-50 rounded-xl animate-pulse"></div>
                    ) : activities.length > 0 ? (
                        <div className="space-y-3">
                            {activities.map(activity => (
                                <div key={activity.id} className="p-4 bg-white border border-gray-100 rounded-xl shadow-sm flex justify-between items-center group hover:border-indigo-100 transition-colors">
                                    <div>
                                        <p className="font-medium text-gray-800">{activity.name}</p>
                                        <p className="text-xs text-gray-500 capitalize">{activity.category}</p>
                                    </div>
                                    <span className="text-xs font-mono text-gray-400">{activity.level}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center p-8 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                            <Building2 className="mx-auto text-gray-400 mb-2" size={32} />
                            <p className="text-gray-600 mb-4">Non hai ancora inserito attività.</p>
                            <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
                                Aggiungi la tua attività
                            </button>
                        </div>
                    )}
                </div>

                {/* Right: Value & Visibility Context */}
                <div className="bg-indigo-50/50 rounded-2xl p-6 border border-indigo-100">
                    <h3 className="font-semibold text-lg text-indigo-900 mb-4 flex items-center gap-2">
                        <TrendingUp size={20} />
                        Stato Visibilità
                    </h3>

                    {currentTier === 'free' ? (
                        <div className="space-y-4">
                            <p className="text-sm text-gray-600 leading-relaxed">
                                Attualmente la tua attività ha visibilità <strong>Standard</strong>.
                                Appare sulla mappa quando gli utenti cercano specificamente la tua categoria o si trovano nelle immediate vicinanze.
                            </p>
                            <div className="flex items-start gap-3 p-3 bg-white rounded-lg border border-indigo-100 shadow-sm">
                                <Info className="text-indigo-500 shrink-0 mt-0.5" size={18} />
                                <p className="text-xs text-gray-500">
                                    I partner Premium ottengono pin in evidenza e appaiono nei percorsi consigliati dall'AI.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <p className="text-sm text-gray-600 leading-relaxed">
                                Ottimo! La tua attività gode di visibilità <strong>{currentTier}</strong>.
                                Il tuo pin è in evidenza sulla mappa interattiva e viene suggerito nei percorsi tematici rilevanti.
                            </p>
                            <div className="w-full bg-green-100 text-green-700 px-4 py-2 rounded-lg text-sm font-medium text-center">
                                Visibilità Potenziata Attiva
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DashboardBusiness;
