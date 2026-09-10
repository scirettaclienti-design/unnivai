import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Camera, Image, Heart, Share2, Tag, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import TopBar from "../components/TopBar";
import BottomNavigation from "../components/BottomNavigation";

/**
 * Photos — In attesa di implementazione con storage Supabase reale (DVAI-035).
 * Conversione all'ossidiana: superfici token, icone lineari Lucide, tipografia sui due grigi.
 * NOTA VERIFICA FOTO: Nessuna immagine fittizia presente nel codice.
 */
export default function PhotosPage() {
    const features = [
        { icon: Image, title: "Galleria immersiva", desc: "Griglia e feed delle tue avventure" },
        { icon: Heart, title: "Like e commenti", desc: "Connettiti con la community DoveVAI" },
        { icon: Share2, title: "Condivisione social", desc: "Instagram, Facebook, WhatsApp" },
        { icon: Tag, title: "Tag automatici", desc: "Luoghi e tour taggati dall'AI" },
    ];

    return (
        <div className="min-h-screen bg-obsidian-bg font-quicksand text-obsidian-primary flex flex-col justify-between">
            <TopBar />

            <main className="max-w-md mx-auto px-4 py-6 pb-24 w-full flex-1 flex flex-col justify-center">
                {/* Back to Home Button */}
                <div className="mb-4">
                    <Link
                        to="/dashboard-user"
                        className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-obsidian-card border border-obsidian-border text-obsidian-secondary hover:text-obsidian-primary transition-colors text-xs font-bold"
                    >
                        <ArrowLeft size={14} />
                        <span>Home</span>
                    </Link>
                </div>

                {/* Central Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    className="bg-obsidian-card border border-obsidian-border rounded-[28px] p-6 sm:p-8 shadow-2xl text-center relative overflow-hidden"
                >
                    {/* Badge In Costruzione */}
                    <div className="mb-4 flex justify-center">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-obsidian-raised border border-obsidian-border text-[11px] font-bold text-obsidian-secondary uppercase tracking-widest">
                            <Clock className="w-3.5 h-3.5 text-obsidian-secondary" />
                            <span>In Costruzione</span>
                        </span>
                    </div>

                    {/* Hero Icon */}
                    <div className="w-16 h-16 rounded-2xl bg-obsidian-raised border border-obsidian-border flex items-center justify-center text-brand-orange mx-auto mb-4 shadow-md">
                        <Camera className="w-8 h-8 stroke-[1.75]" />
                    </div>

                    <h1 className="text-2xl sm:text-3xl font-extrabold text-obsidian-primary mb-2 tracking-tight">
                        Foto dei Tour
                    </h1>
                    <p className="text-obsidian-secondary text-sm leading-relaxed mb-6">
                        Presto potrai condividere i tuoi scatti migliori dai tour, sfogliare le storie degli altri viaggiatori e creare ricordi indimenticabili.
                    </p>

                    {/* Feature list */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-6 text-left">
                        {features.map((feat, idx) => {
                            const IconComponent = feat.icon;
                            return (
                                <div
                                    key={idx}
                                    className="bg-obsidian-raised border border-obsidian-border rounded-2xl p-3 flex items-start gap-3"
                                >
                                    <div className="w-8 h-8 rounded-xl bg-obsidian-card border border-obsidian-border flex items-center justify-center text-brand-orange shrink-0">
                                        <IconComponent className="w-4 h-4 stroke-[1.75]" />
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="text-xs font-bold text-obsidian-primary leading-tight mb-0.5">
                                            {feat.title}
                                        </h3>
                                        <p className="text-[11px] text-obsidian-secondary leading-snug">
                                            {feat.desc}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Single Orange CTA */}
                    <Link to="/explore" className="block">
                        <button className="w-full py-4 px-6 rounded-2xl bg-brand-orange hover:bg-brand-orange-hover text-obsidian-bg font-bold text-sm transition-colors flex items-center justify-center gap-2 shadow-lg shadow-brand-orange/20 cursor-pointer">
                            <span>Esplora Luoghi</span>
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    </Link>
                </motion.div>
            </main>

            <BottomNavigation />
        </div>
    );
}
