import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Award, MapPin, Clock, MessageCircle } from 'lucide-react';
import confetti from 'canvas-confetti';

export const TourSummaryModal = ({ isOpen, onClose, stats, titleName }) => {
    if (!isOpen) return null;

    useEffect(() => {
        if (isOpen) {
            // Trigger confetti
            setTimeout(() => {
                confetti({
                    particleCount: 150,
                    spread: 80,
                    origin: { y: 0.6 },
                    colors: ['#f6d365', '#d4af37', '#ffffff'] // Gold theme
                });
            }, 300);

            // Save to Local History
            try {
                const history = JSON.parse(localStorage.getItem('user_tour_history') || '[]');
                const newEntry = {
                    id: Date.now(),
                    date: new Date().toISOString(),
                    title: titleName || 'Storico Urbano',
                    duration: stats?.duration || '0h',
                    distance: stats?.distance || '0 km',
                    completedCount: stats?.completedCount || 0
                };
                
                // Avoid duplicates if saved in the same minute
                const recent = history[0];
                if (!recent || recent.title !== newEntry.title || (newEntry.id - recent.id > 60000)) {
                    history.unshift(newEntry);
                    localStorage.setItem('user_tour_history', JSON.stringify(history.slice(0, 50))); // Keep last 50
                }
            } catch (e) {
                console.warn('Could not save tour history', e);
            }
        }
    }, [isOpen]);

    const handleShare = () => {
        const text = `Ho appena scoperto i segreti di Roma con DoveVai! 🏛️ ${stats?.completedCount || 0} monumenti sbloccati in ${stats?.duration || '45 min'}. Scarica l'app per il tuo prossimo tour!`;
        window.open(`whatsapp://send?text=${encodeURIComponent(text)}`);
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
                <motion.div 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }} 
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                />
                <motion.div 
                    initial={{ scale: 0.9, opacity: 0, y: 20 }} 
                    animate={{ scale: 1, opacity: 1, y: 0 }} 
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    className="bg-white rounded-[2rem] shadow-2xl overflow-hidden relative w-full max-w-sm z-10"
                >
                    {/* Header Decoration */}
                    <div className="h-32 bg-gradient-to-br from-yellow-400 to-[#d4af37] relative flex items-center justify-center">
                        <Award size={64} className="text-white drop-shadow-md z-10" />
                        <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-black/20 text-white rounded-full backdrop-blur-sm transition-colors hover:bg-black/40"><X size={18}/></button>
                        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-[120%] h-12 bg-white rounded-t-[50%]"></div>
                    </div>

                    <div className="px-6 pb-8 pt-10 flex flex-col items-center text-center gap-6">
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", stiffness: 400, damping: 10, delay: 0.2 }}
                            className="bg-yellow-100/90 text-yellow-800 text-[13px] font-black px-6 py-2.5 rounded-full tracking-widest uppercase shadow-sm border border-yellow-200 mb-1 z-20"
                        >
                            {titleName || 'Storico Urbano'}
                        </motion.div>
                        
                        <h2 className="text-4xl font-black text-gray-900 drop-shadow-sm px-2 leading-tight">Tour Completato!</h2>

                        <div className="flex flex-col gap-5 w-full mt-2 mb-2">
                            <div className="flex gap-4 w-full">
                                <div className="bg-white rounded-3xl pt-6 pb-5 px-4 border border-gray-100 shadow-md flex flex-col items-center justify-center flex-1 relative overflow-hidden min-h-[130px]">
                                    <div className="absolute top-0 left-0 w-full h-1.5 bg-orange-400 opacity-80" />
                                    <Clock size={28} className="text-orange-500 mb-2" />
                                    <span className="text-2xl font-black text-gray-900 leading-none mb-1">{stats?.duration || '1h 20m'}</span>
                                    <span className="text-[11px] text-gray-500 font-bold uppercase tracking-widest mt-1">Tempo</span>
                                </div>
                                <div className="bg-white rounded-3xl pt-6 pb-5 px-4 border border-gray-100 shadow-md flex flex-col items-center justify-center flex-1 relative overflow-hidden min-h-[130px]">
                                    <div className="absolute top-0 left-0 w-full h-1.5 bg-orange-400 opacity-80" />
                                    <MapPin size={28} className="text-orange-500 mb-2" />
                                    <span className="text-2xl font-black text-gray-900 leading-none mb-1">{stats?.distance || '2.4 km'}</span>
                                    <span className="text-[11px] text-gray-500 font-bold uppercase tracking-widest mt-1">Distanza</span>
                                </div>
                            </div>
                            <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-3xl pt-8 pb-6 px-4 border border-orange-200 shadow-lg flex flex-col items-center justify-center relative overflow-hidden w-full min-h-[140px]">
                                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-yellow-400 to-orange-500" />
                                <Award size={36} className="text-orange-500 mb-2 drop-shadow-md" />
                                <span className="text-3xl font-black text-gray-900 leading-none mb-1">{stats?.completedCount || 0} Tappe</span>
                                <span className="text-[12px] text-gray-600 font-bold uppercase tracking-widest mt-1">Monumenti Scoperte</span>
                            </div>
                        </div>

                        <button 
                            onClick={handleShare}
                            className="w-full bg-[#25D366] text-white py-4 rounded-2xl font-black flex items-center justify-center gap-2 shadow-lg shadow-green-500/30 hover:scale-[1.02] active:scale-95 transition-all text-sm uppercase tracking-wide"
                        >
                            <MessageCircle size={18} /> Condividi su WhatsApp
                        </button>

                        <button 
                            onClick={onClose}
                            className="w-full mt-3 bg-gray-100 text-gray-600 hover:bg-gray-200 py-4 rounded-2xl font-bold transition-colors text-sm"
                        >
                            Torna alla Navigazione
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};
