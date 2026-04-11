import { motion } from "framer-motion";
import { ArrowLeft, Clock, Bell } from "lucide-react";
import { Link } from "react-router-dom";
import TopBar from "./TopBar";
import BottomNavigation from "./BottomNavigation";

/**
 * Overlay "Disponibile a breve" — coerente col brand DoveVAI
 * Terracotta + Quicksand. Usato per Photos e Trending in attesa
 * dell'implementazione con dati reali (DVAI-035).
 */
export default function ComingSoonOverlay({
    icon = "📸",
    title = "In Arrivo",
    subtitle = "Questa sezione è in fase di sviluppo",
    backTo = "/dashboard-user",
    backLabel = "Home",
    features = [],
    accent = "terracotta"
}) {
    const colors = {
        terracotta: {
            badge: "bg-terracotta-500 text-white",
            glow: "bg-terracotta-300",
            button: "bg-terracotta-500 hover:bg-terracotta-600",
            ring: "ring-terracotta-200",
            dot: "bg-terracotta-400",
        },
        red: {
            badge: "bg-red-500 text-white",
            glow: "bg-red-300",
            button: "bg-red-500 hover:bg-red-600",
            ring: "ring-red-200",
            dot: "bg-red-400",
        },
    };

    const c = colors[accent] || colors.terracotta;

    return (
        <div className="min-h-screen bg-gradient-to-b from-ochre-50 via-white to-ochre-100 font-quicksand">
            <TopBar />

            <main className="max-w-md mx-auto px-4 py-8 pb-28">
                {/* Back */}
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="mb-8"
                >
                    <Link to={backTo}>
                        <motion.button
                            className="flex items-center space-x-2 bg-white/80 backdrop-blur-sm text-terracotta-600 px-4 py-2 rounded-2xl shadow-md hover:shadow-lg transition-all"
                            whileHover={{ scale: 1.04 }}
                            whileTap={{ scale: 0.96 }}
                        >
                            <ArrowLeft className="w-5 h-5" />
                            <span className="font-semibold">{backLabel}</span>
                        </motion.button>
                    </Link>
                </motion.div>

                {/* Card centrale */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, ease: "easeOut" }}
                    className={`relative bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl p-8 ring-4 ${c.ring} overflow-hidden`}
                >
                    {/* Glow sfondo */}
                    <div className={`absolute -top-10 -right-10 w-48 h-48 ${c.glow} rounded-full blur-[60px] opacity-25 pointer-events-none`} />
                    <div className={`absolute -bottom-8 -left-8 w-36 h-36 ${c.glow} rounded-full blur-[50px] opacity-20 pointer-events-none`} />

                    {/* Badge */}
                    <div className="relative z-10 flex flex-col items-center text-center">
                        <motion.span
                            className={`inline-flex items-center space-x-1.5 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-6 shadow-sm ${c.badge}`}
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: 0.2 }}
                        >
                            <Clock className="w-3 h-3" />
                            <span>Disponibile a breve</span>
                        </motion.span>

                        {/* Emoji con animazione */}
                        <motion.div
                            className="text-7xl mb-6 select-none"
                            animate={{
                                scale: [1, 1.08, 1],
                                rotate: [0, 4, -4, 0],
                            }}
                            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                        >
                            {icon}
                        </motion.div>

                        <h1 className="text-3xl font-black text-gray-800 mb-3 tracking-tight">{title}</h1>
                        <p className="text-gray-500 text-sm leading-relaxed mb-8 max-w-xs">{subtitle}</p>

                        {/* Feature preview list */}
                        {features.length > 0 && (
                            <div className="w-full space-y-3 mb-8">
                                {features.map((feature, i) => (
                                    <motion.div
                                        key={i}
                                        className="flex items-center space-x-3 bg-gray-50 rounded-2xl px-4 py-3"
                                        initial={{ opacity: 0, x: -15 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.3 + i * 0.1 }}
                                    >
                                        <span className="text-xl">{feature.emoji}</span>
                                        <div className="text-left">
                                            <p className="text-sm font-bold text-gray-700">{feature.title}</p>
                                            <p className="text-xs text-gray-400">{feature.desc}</p>
                                        </div>
                                        <div className={`ml-auto w-2 h-2 rounded-full ${c.dot} opacity-60`} />
                                    </motion.div>
                                ))}
                            </div>
                        )}

                        {/* Pulsante notifica */}
                        <motion.button
                            className={`flex items-center space-x-2 ${c.button} text-white px-6 py-3 rounded-2xl font-bold shadow-lg transition-colors`}
                            whileHover={{ scale: 1.04 }}
                            whileTap={{ scale: 0.96 }}
                            onClick={() => {
                                // Toast al posto di alert
                                const event = new CustomEvent('dvai-toast', {
                                    detail: {
                                        type: 'success',
                                        message: 'Ti avviseremo non appena la sezione sarà disponibile! 🔔',
                                    }
                                });
                                window.dispatchEvent(event);
                            }}
                        >
                            <Bell className="w-4 h-4" />
                            <span>Avvisami al lancio</span>
                        </motion.button>
                    </div>
                </motion.div>

                {/* Pill info */}
                <motion.p
                    className="text-center text-xs text-gray-400 mt-6"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8 }}
                >
                    DoveVAI · La piattaforma del turismo italiano
                </motion.p>
            </main>

            <BottomNavigation />
        </div>
    );
}
