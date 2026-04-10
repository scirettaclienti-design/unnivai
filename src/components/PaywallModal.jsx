import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Brain, Lock, ArrowRight, Loader2 } from 'lucide-react';

export default function PaywallModal({ isOpen, onClose, onUnlock }) {
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        // Simulazione caricamento chiamata API a Supabase o CRM
        setTimeout(() => {
            setIsSubmitting(false);
            if (onUnlock) onUnlock();
        }, 1500);
    };

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />

            <motion.div
                initial={{ scale: 0.95, y: 20, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.95, y: 20, opacity: 0 }}
                className="relative bg-white w-full max-w-md rounded-[2rem] shadow-2xl p-6 overflow-hidden flex flex-col"
            >
                {/* Background Decor */}
                <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 bg-emerald-100 rounded-full blur-3xl opacity-50 pointer-events-none" />
                <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-48 h-48 bg-teal-100 rounded-full blur-3xl opacity-50 pointer-events-none" />

                {/* Lock Icon header */}
                <div className="flex justify-center mb-6 relative z-10">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                        <Lock className="text-white w-7 h-7" />
                    </div>
                </div>

                <div className="text-center relative z-10 mb-8">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-black uppercase tracking-widest mb-4">
                        <Sparkles size={12} /> Limite Raggiunto
                    </span>
                    <h2 className="text-3xl font-black text-gray-900 leading-tight mb-3">
                        L'AI ora conosce i tuoi gusti.
                    </h2>
                    <p className="text-gray-500 font-medium text-sm leading-relaxed">
                        Hai generato i tuoi <strong>10 Tour Gratuiti</strong>. Il nostro Sistema Mentale ha mappato il tuo DNA esplorativo. <br/>
                        Sblocca le intelligenze illimitate e vivi tour cuciti su misura col tasto <em>Sorprendimi</em>.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="relative z-10 space-y-4">
                    <div>
                        <input
                            type="text"
                            required
                            placeholder="Nome o Nickname"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full bg-gray-50 border border-gray-200 text-gray-900 px-5 py-3.5 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all font-medium"
                        />
                    </div>
                    <div>
                        <input
                            type="email"
                            required
                            placeholder="Il tuo indirizzo email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-gray-50 border border-gray-200 text-gray-900 px-5 py-3.5 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all font-medium"
                        />
                    </div>

                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className={`w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black py-4 rounded-2xl shadow-xl hover:shadow-2xl hover:shadow-emerald-500/40 active:scale-95 transition-all flex items-center justify-center gap-2 uppercase tracking-wide disabled:opacity-70 disabled:active:scale-100`}
                        >
                            {isSubmitting ? (
                                <><Loader2 className="w-5 h-5 animate-spin" /> Registrazione in corso...</>
                            ) : (
                                <>Sblocca Accesso Premium <ArrowRight size={18} /></>
                            )}
                        </button>
                    </div>
                    <button 
                        type="button" 
                        onClick={onClose} 
                        className="w-full text-center text-xs font-bold text-gray-400 hover:text-gray-600 uppercase tracking-widest mt-4 p-2 transition-colors"
                    >
                        Continua come ospite
                    </button>
                </form>

            </motion.div>
        </div>
    );
}
