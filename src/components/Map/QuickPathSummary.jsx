import React from 'react';
import { motion } from 'framer-motion';
import { MapPin, Navigation, Clock, Users, ArrowRight, Sparkles, Home } from 'lucide-react';
import { getCoverPalette } from '@/lib/categoryPalette';

// Gate PULIZIA P1 — formatta minuti → "45 min" / "3h" / "1h 30m".
// Il vecchio inline `(min % 60 || '')` trattava lo 0 come falsy e stampava
// "3h m" per ogni durata multipla di 60 (medio=180, lungo=300 di QuickPath).
// Stessa guardia `resto === 0` gia' usata in NavigationHUD.jsx:80 e MapPage.jsx:89.
const formatMinutes = (min) => {
    if (!Number.isFinite(min) || min <= 0) return null;
    if (min < 60) return `${min} min`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
};

export const QuickPathSummary = ({ tourData, choices, onViewMap, onHome }) => {
    if (!tourData) return null;

    const durationLabel = formatMinutes(tourData.duration_minutes);

    // Gate VERITÀ VISIVA (F26) DIFF 4 — via lo stock Unsplash di ripiego.
    // Questa e' la copertina del tour appena generato: se non c'e' una foto
    // Places verificata si mostra il gradient di categoria (TourCover ramo B),
    // non una piazza italiana a caso presentata come il tuo percorso.
    const mainImage = tourData.imageUrl || tourData.images?.[0] || null;
    const moodPalette = getCoverPalette(choices?.mood || 'citta', null);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md overflow-y-auto">
            <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="bg-obsidian-card border border-obsidian-border text-obsidian-primary rounded-[28px] shadow-2xl max-w-lg w-full overflow-hidden relative my-auto"
            >
                {/* Visual Header */}
                <div
                    className="relative h-48 w-full overflow-hidden"
                    style={{
                        background: mainImage ? '#161311' : moodPalette.gradient,
                    }}
                >
                    {mainImage && (
                        <img
                            src={mainImage}
                            alt={tourData.title}
                            className="absolute inset-0 w-full h-full object-cover"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-obsidian-card via-obsidian-card/40 to-transparent" />
                    
                    {/* Micro-caption città e titolo tour */}
                    <div className="absolute bottom-4 left-5 right-5 text-obsidian-primary">
                        <p className="text-xs font-bold text-brand-orange uppercase tracking-widest mb-1 flex items-center gap-1.5">
                            <MapPin size={13} /> {tourData.city}
                        </p>
                        <h2 className="text-2xl font-black tracking-tight leading-tight text-obsidian-primary drop-shadow-sm">
                            {tourData.title}
                        </h2>
                    </div>
                </div>

                <div className="px-6 py-6 space-y-6">
                    {/* Badge Itinerario AI (fuori dalla foto) */}
                    <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-obsidian-raised border border-obsidian-border text-obsidian-secondary text-xs font-semibold w-max shadow-sm">
                        <Sparkles size={13} className="text-brand-orange" />
                        <span>Itinerario cucito dall'AI</span>
                    </div>

                    {/* Le tue scelte */}
                    <div className="bg-obsidian-raised rounded-2xl p-4 border border-obsidian-border relative overflow-hidden">
                        <h3 className="text-xs font-bold text-obsidian-secondary uppercase tracking-wider mb-3">
                            Il tuo DNA Esplorativo
                        </h3>
                        
                        <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-sm">
                            <div className="flex flex-col">
                                <span className="text-obsidian-secondary text-xs">Mood</span>
                                <span className="font-bold text-obsidian-primary">{choices?.mood || '—'}</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-obsidian-secondary text-xs">Ispirazione</span>
                                <span className="font-bold text-obsidian-primary">{choices?.inspiration || '—'}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                                <Clock size={15} className="text-brand-orange" />
                                <span className="font-bold text-obsidian-primary">{choices?.duration || '—'}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                                <Users size={15} className="text-brand-orange" />
                                <span className="font-bold text-obsidian-primary">{choices?.group || '—'}</span>
                            </div>
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center justify-around px-2">
                        <div className="text-center">
                            <p className="text-3xl font-black text-obsidian-primary">{tourData.steps?.length || 0}</p>
                            <p className="text-xs text-obsidian-secondary font-bold uppercase tracking-widest mt-0.5">Tappe</p>
                        </div>
                        {durationLabel && (
                            <>
                                <div className="w-px h-10 bg-obsidian-border" />
                                <div className="text-center">
                                    <p className="text-3xl font-black text-obsidian-primary">{durationLabel}</p>
                                    <p className="text-xs text-obsidian-secondary font-bold uppercase tracking-widest mt-0.5">Durata</p>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Tappe Generate (descrizioni intere, senza troncamento forzato) */}
                    {tourData.steps?.length > 0 && (
                        <div className="mt-4 bg-obsidian-raised/60 rounded-2xl p-3.5 border border-obsidian-border">
                            <h4 className="text-[10px] font-bold text-obsidian-secondary uppercase tracking-widest mb-3 px-1">Itinerario Generato</h4>
                            <div className="space-y-3 max-h-[260px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-obsidian-border">
                                {tourData.steps.map((step, idx) => (
                                    <div key={idx} className="flex items-start gap-3 bg-obsidian-card p-3 rounded-xl border border-obsidian-border shadow-sm relative overflow-hidden group">
                                        {idx !== tourData.steps.length - 1 && (
                                            <div className="absolute left-[1.35rem] top-8 bottom-[-12px] w-0.5 bg-obsidian-border z-0" />
                                        )}
                                        <div className="w-6 h-6 rounded-full bg-brand-orange text-obsidian-bg flex items-center justify-center text-[11px] font-bold shrink-0 relative z-10 shadow-sm mt-0.5">
                                            {idx + 1}
                                        </div>
                                        <div className="flex-1 min-w-0 relative z-10">
                                            <p className="text-sm font-bold text-obsidian-primary leading-tight">{step.name || step.title || `Tappa ${idx+1}`}</p>
                                            <p className="text-xs text-obsidian-secondary mt-1 leading-relaxed font-medium">{step.description || step.category || 'Esplorazione consigliata'}</p>
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
                            className="w-full bg-brand-orange hover:bg-brand-orange-hover text-obsidian-bg py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-brand-orange/20 transition-colors text-sm cursor-pointer"
                        >
                            <Navigation size={18} className="text-obsidian-bg" />
                            <span>Vedi mappa</span>
                            <ArrowRight size={18} className="text-obsidian-bg" />
                        </button>

                        <button
                            onClick={onHome}
                            className="w-full text-obsidian-secondary hover:text-obsidian-primary font-bold py-3 text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
                        >
                            <Home size={16} /> Torna alla Home
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};
