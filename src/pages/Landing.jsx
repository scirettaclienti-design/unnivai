
import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Globe, Compass, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';

const Landing = () => {
    useEffect(() => {
        const testConnection = async () => {
            try {
                const { data, error } = await supabase.from('explorers').select('id').limit(1);
                if (error) {
                    console.error('Errore connessione Supabase:', error);
                } else {
                    console.log('Connessione Supabase OK');
                }
            } catch (err) {
                console.error('Eccezione test connessione:', err);
            }
        };
        testConnection();
    }, []);

    return (
        <div className="relative min-h-screen bg-gray-900 text-white overflow-hidden font-sans">

            {/* Background Video / Overlay */}
            <div className="absolute inset-0 z-0">
                <video
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="w-full h-full object-cover opacity-50"
                >
                    <source src="https://videos.pexels.com/video-files/4456997/4456997-uhd_2560_1440_25fps.mp4" type="video/mp4" />
                    {/* Fallback image */}
                    <img
                        src="https://images.unsplash.com/photo-1516483638261-f4dbaf036963?q=80&w=2574&auto=format&fit=crop"
                        alt="Background"
                        className="w-full h-full object-cover"
                    />
                </video>
                <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/40 to-transparent" />
            </div>

            {/* Navigation (Simple) */}
            <nav className="relative z-10 flex justify-between items-center px-6 py-6 md:px-12">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-orange-600 rounded-full flex items-center justify-center">
                        <Compass className="w-5 h-5 text-white" />
                    </div>
                    <span className="font-serif text-xl font-bold tracking-wider">UNNIVAI</span>
                </div>
                <Link to="/login" className="text-sm font-semibold hover:text-orange-400 transition-colors">
                    Accedi
                </Link>
            </nav>

            {/* Hero Content */}
            <main className="relative z-10 flex flex-col items-center justify-center min-h-[85vh] text-center px-4 py-10">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                    className="flex flex-col items-center max-w-4xl mx-auto"
                >
                    <span className="inline-block py-1 px-3 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-bold tracking-widest uppercase mb-6 text-orange-400">
                        Il futuro del viaggio è qui
                    </span>
                    <h1 className="text-5xl md:text-7xl font-serif font-bold mb-6 leading-tight">
                        UNNIVAI: Tecnologia che racconta. <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-600">
                            Persone che guidano.
                        </span>
                    </h1>
                    <p className="text-lg md:text-2xl text-gray-300 max-w-2xl mx-auto mb-12 leading-relaxed">
                        L'unica piattaforma turistica dove l'AI incontra le storie vere.
                        Esplora l'Italia autentica attraverso gli occhi di chi la vive ogni giorno.
                    </p>

                    <Link to="/login" className="relative z-50 mb-12 md:mb-20">
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="group px-8 py-5 bg-orange-600 text-white rounded-full font-bold text-lg shadow-[0_0_40px_-10px_rgba(234,88,12,0.6)] hover:shadow-[0_0_60px_-10px_rgba(234,88,12,0.8)] transition-all flex items-center gap-3 cursor-pointer"
                        >
                            INIZIA L'AVVENTURA
                            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </motion.button>
                    </Link>
                </motion.div>

                {/* Features Grid */}
                <motion.div
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4, duration: 0.8 }}
                    className="w-full max-w-5xl px-4 grid grid-cols-1 md:grid-cols-3 gap-8 text-left relative md:absolute md:bottom-10"
                >
                    <div className="bg-white/5 backdrop-blur-sm p-6 rounded-2xl border border-white/10 hover:bg-white/10 transition-colors">
                        <Globe className="w-8 h-8 text-blue-400 mb-3" />
                        <h3 className="font-bold text-lg mb-1">Mappa Intelligente</h3>
                        <p className="text-sm text-gray-400">Navigazione immersiva con punti di interesse curati e geolocalizzazione precisa.</p>
                    </div>
                    <div className="bg-white/5 backdrop-blur-sm p-6 rounded-2xl border border-white/10 hover:bg-white/10 transition-colors">
                        <Users className="w-8 h-8 text-orange-400 mb-3" />
                        <h3 className="font-bold text-lg mb-1">Guide Locali Vere</h3>
                        <p className="text-sm text-gray-400">Connettiti con esperti del territorio certificati, non semplici audioguide.</p>
                    </div>
                    <div className="bg-white/5 backdrop-blur-sm p-6 rounded-2xl border border-white/10 hover:bg-white/10 transition-colors">
                        <Compass className="w-8 h-8 text-green-400 mb-3" />
                        <h3 className="font-bold text-lg mb-1">Itinerari su Misura</h3>
                        <p className="text-sm text-gray-400">Dalle gemme nascoste ai grandi classici, crea il percorso perfetto per te.</p>
                    </div>
                </motion.div>
            </main>
        </div>
    );
};

export default Landing;
