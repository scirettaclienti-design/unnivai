import { motion } from "framer-motion";
import { Star, Users, MapPin, TrendingUp, Award, Zap } from "lucide-react";

// Component per statistiche impressive per investors
export function MVPStats() {
    const stats = [
        { number: "12.5K+", label: "Utenti Attivi", icon: Users, color: "text-blue-600" },
        { number: "2.8K+", label: "Tour Completati", icon: MapPin, color: "text-green-600" },
        { number: "4.9", label: "Rating Medio", icon: Star, color: "text-yellow-600" },
        { number: "95%", label: "Tasso Soddisfazione", icon: Award, color: "text-purple-600" },
        { number: "+185%", label: "Crescita Mensile", icon: TrendingUp, color: "text-red-600" },
        { number: "€125K", label: "Ricavi Mensili", icon: Zap, color: "text-orange-600" }
    ];

    return (
        <motion.div
            className="grid grid-cols-2 md:grid-cols-3 gap-4 p-6 bg-gradient-to-br from-white/90 to-white/80 rounded-3xl backdrop-blur-sm border border-white/30"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
        >
            {stats.map((stat, index) => (
                <motion.div
                    key={stat.label}
                    className="text-center"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.1 }}
                >
                    <motion.div
                        className={`inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-white shadow-lg mb-2 ${stat.color}`}
                        whileHover={{ scale: 1.1, rotate: 5 }}
                    >
                        <stat.icon className="w-6 h-6" />
                    </motion.div>
                    <div className="font-bold text-lg text-gray-800">{stat.number}</div>
                    <div className="text-xs text-gray-600">{stat.label}</div>
                </motion.div>
            ))}
        </motion.div>
    );
}

// Component per value propositions per investors
export function ValuePropositions() {
    const propositions = [
        {
            title: "Mercato TAM €2.8B",
            description: "Turismo esperienziale in crescita del 34% annuo",
            icon: "🎯"
        },
        {
            title: "Tecnologia AI Avanzata",
            description: "Personalizzazione in tempo reale basata su GPS",
            icon: "🤖"
        },
        {
            title: "Network Locale Unico",
            description: "1200+ guide locali certificate in 50+ città",
            icon: "🌍"
        },
        {
            title: "Modello B2B2C Scalabile",
            description: "Partnership con hotel, ristoranti e attrazioni",
            icon: "🚀"
        }
    ];

    return (
        <div className="space-y-4">
            {propositions.map((prop, index) => (
                <motion.div
                    key={prop.title}
                    className="bg-white/80 rounded-2xl p-4 border border-gray-200"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.2 }}
                    whileHover={{ scale: 1.02, x: 5 }}
                >
                    <div className="flex items-start space-x-3">
                        <span className="text-2xl">{prop.icon}</span>
                        <div>
                            <h4 className="font-bold text-gray-800 mb-1">{prop.title}</h4>
                            <p className="text-sm text-gray-600">{prop.description}</p>
                        </div>
                    </div>
                </motion.div>
            ))}
        </div>
    );
}
