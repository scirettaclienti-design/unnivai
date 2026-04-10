import React from 'react';
import { motion } from 'framer-motion';
import { MapPin, Navigation, Clock, Users, ArrowRight, Sparkles, Home } from 'lucide-react';

export const QuickPathSummary = ({ tourData, choices, onViewMap, onHome }) => {
    if (!tourData) return null;

    const mainImage = tourData.imageUrl || tourData.images?.[0] || 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800';

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
            <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="bg-white rounded-[2rem] shadow-2xl max-w-lg w-full overflow-hidden relative"
            >
                {/* Visual Header */}
                <div className="relative h-48 w-full overflow-hidden">
                    <img
                        src={mainImage}
                        alt={tourData.title}
                        className="w-full h-full object-cover"
                        onError={(e) => { e.target.onerror = null; e.target.src = 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800'; }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                    
                    <div className="absolute top-4 left-4 bg-white/20 backdrop-blur-md border border-white/30 text-white text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full flex items-center gap-1.5">
                        <Sparkles size={14} className="text-yellow-400" />
                        AI Generated
                    </div>

                    <div className="absolute bottom-4 left-4 right-4 text-white">
                        <p className="text-sm font-semibold text-orange-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                            <MapPin size={14} /> {tourData.city}
                        </p>
                        <h2 className="text-3xl font-black tracking-tight leading-none drop-shadow-md">
                            {tourData.title}
                        </h2>
                    </div>
                </div>

                <div className="px-6 py-6 space-y-6">
                    {/* Le tue scelte */}
                    <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 relative overflow-hidden">
                        <div className="absolute -right-4 -top-4 w-16 h-16 bg-orange-100 rounded-full opacity-50 blur-xl" />
                        
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                            Il tuo DNA Esplorativo
                        </h3>
                        
                        <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-sm">
                            <div className="flex flex-col">
                                <span className="text-gray-500 text-xs">Mood</span>
                                <span className="font-bold text-gray-900">{choices?.mood || '—'}</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-gray-500 text-xs">Ispirazione</span>
                                <span className="font-bold text-gray-900">{choices?.inspiration || '—'}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                                <Clock size={16} className="text-orange-500" />
                                <span className="font-bold text-gray-900">{choices?.duration || '—'}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                                <Users size={16} className="text-orange-500" />
                                <span className="font-bold text-gray-900">{choices?.group || '—'}</span>
                            </div>
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center justify-between px-2">
                        <div className="text-center">
                            <p className="text-3xl font-black text-gray-900">{tourData.steps?.length || 0}</p>
                            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-0.5">Tappe</p>
                        </div>
                        <div className="w-px h-10 bg-gray-200" />
                        <div className="text-center">
                            <p className="text-3xl font-black text-gray-900">{tourData.duration_minutes ? Math.floor(tourData.duration_minutes/60) + 'h ' + (tourData.duration_minutes%60 || '') + 'm' : '~2h'}</p>
                            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-0.5">Durata</p>
                        </div>
                        <div className="w-px h-10 bg-gray-200" />
                        <div className="text-center">
                            <p className="text-3xl font-black text-gray-900">100%</p>
                            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-0.5">Match</p>
                        </div>
                    </div>

                    {/* Tappe Generate (Nuovo) */}
                    {tourData.steps?.length > 0 && (
                        <div className="mt-4 bg-gray-50/50 rounded-2xl p-3 border border-gray-100">
                            <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 px-1">Itinerario Generato</h4>
                            <div className="space-y-2.5 max-h-[140px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-200">
                                {tourData.steps.map((step, idx) => (
                                    <div key={idx} className="flex items-start gap-3 bg-white p-2.5 rounded-xl border border-gray-100 shadow-sm relative overflow-hidden group">
                                        {/* Highlight connection line simulation */}
                                        {idx !== tourData.steps.length - 1 && (
                                            <div className="absolute left-[1.35rem] top-8 bottom-[-10px] w-0.5 bg-gray-100 z-0" />
                                        )}
                                        <div className="w-6 h-6 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-[11px] font-black shrink-0 relative z-10 shadow-sm">
                                            {idx + 1}
                                        </div>
                                        <div className="flex-1 min-w-0 pb-0.5 relative z-10">
                                            <p className="text-sm font-extrabold text-gray-900 truncate leading-tight">{step.name || step.title || `Tappa ${idx+1}`}</p>
                                            <p className="text-[11px] text-gray-500 truncate mt-0.5 font-medium">{step.description || step.category || 'Esplorazione consigliata'}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* CTAs */}
                    <div className="pt-2 flex flex-col gap-3">
                        <button
                            onClick={onViewMap}
                            className="w-full relative overflow-hidden group bg-gray-900 text-white py-4.5 rounded-[1.25rem] font-bold flex items-center justify-center gap-2 shadow-xl shadow-gray-900/20 hover:shadow-2xl hover:shadow-gray-900/40 transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0"
                            style={{ padding: '1.2rem' }}
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-terracotta-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                            <Navigation size={20} className="relative z-10 group-hover:text-white transition-colors" />
                            <span className="relative z-10 text-lg tracking-wide uppercase">Vedi Mappa</span>
                            <ArrowRight size={20} className="relative z-10 group-hover:translate-x-1 transition-transform" />
                        </button>

                        <button
                            onClick={onHome}
                            className="w-full text-gray-500 hover:text-gray-900 font-bold py-3 text-sm flex items-center justify-center gap-2 transition-colors"
                        >
                            <Home size={16} /> Torna alla Home
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};
