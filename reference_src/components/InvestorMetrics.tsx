import { motion } from "framer-motion";
import { TrendingUp, Users, MapPin, Euro, Star, Zap, Globe, Target } from "lucide-react";

// Component specifico per metriche di business presentabili agli investitori
export function InvestorDashboard() {
  const keyMetrics = [
    {
      title: "ARR (Annual Recurring Revenue)",
      value: "€1.8M",
      change: "+245%",
      trend: "up",
      description: "Crescita anno su anno"
    },
    {
      title: "CAC (Customer Acquisition Cost)",
      value: "€24",
      change: "-18%",
      trend: "down",
      description: "Riduzione costi di acquisizione"
    },
    {
      title: "LTV (Customer Lifetime Value)",
      value: "€312",
      change: "+87%",
      trend: "up", 
      description: "Valore vita cliente"
    },
    {
      title: "Tasso di Retention",
      value: "94%",
      change: "+12%",
      trend: "up",
      description: "Clienti che tornano"
    }
  ];

  const marketMetrics = [
    { icon: Globe, label: "TAM Mercato", value: "€2.8B", color: "text-blue-600" },
    { icon: Target, label: "SAM Raggiungibile", value: "€850M", color: "text-green-600" },
    { icon: Zap, label: "Crescita Mercato", value: "+34%/anno", color: "text-purple-600" },
    { icon: Users, label: "Utenti Target", value: "12M", color: "text-orange-600" }
  ];

  return (
    <div className="space-y-6">
      {/* Key Business Metrics */}
      <motion.div
        className="bg-white/90 backdrop-blur-sm rounded-3xl p-6 border border-white/30"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
          <TrendingUp className="w-6 h-6 mr-2 text-green-600" />
          Metriche Chiave di Business
        </h3>
        
        <div className="grid grid-cols-2 gap-4">
          {keyMetrics.map((metric, index) => (
            <motion.div
              key={metric.title}
              className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-4 border border-gray-100"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ scale: 1.02, y: -2 }}
            >
              <div className="text-2xl font-bold text-gray-800">{metric.value}</div>
              <div className="text-sm text-gray-600 mb-1">{metric.title}</div>
              <div className={`flex items-center space-x-1 text-xs ${
                metric.trend === 'up' ? 'text-green-600' : 'text-red-600'
              }`}>
                <span>{metric.trend === 'up' ? '↗️' : '↘️'}</span>
                <span className="font-medium">{metric.change}</span>
              </div>
              <div className="text-xs text-gray-500 mt-1">{metric.description}</div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Market Opportunity */}
      <motion.div
        className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-3xl p-6 border border-blue-100"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
          <Globe className="w-6 h-6 mr-2 text-blue-600" />
          Opportunità di Mercato
        </h3>
        
        <div className="grid grid-cols-2 gap-4">
          {marketMetrics.map((metric, index) => (
            <motion.div
              key={metric.label}
              className="bg-white/80 rounded-xl p-4 text-center"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 + index * 0.1 }}
              whileHover={{ scale: 1.05, rotate: 1 }}
            >
              <metric.icon className={`w-8 h-8 mx-auto mb-2 ${metric.color}`} />
              <div className="font-bold text-lg text-gray-800">{metric.value}</div>
              <div className="text-xs text-gray-600">{metric.label}</div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Competitive Advantage */}
      <motion.div
        className="bg-gradient-to-br from-terracotta-50 to-orange-50 rounded-3xl p-6 border border-terracotta-100"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
      >
        <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
          <Star className="w-6 h-6 mr-2 text-terracotta-600" />
          Vantaggi Competitivi
        </h3>
        
        <div className="space-y-3">
          {[
            { title: "AI Personalizzazione in Tempo Reale", description: "Algoritmi proprietari per tour su misura" },
            { title: "Network Guide Locali Esclusivo", description: "1200+ guide certificate in 50+ città italiane" },
            { title: "Tecnologia GPS Avanzata", description: "Geolocalizzazione precisa e raccomandazioni contestuali" },
            { title: "Modello Marketplace Scalabile", description: "Commissioni del 15% su ogni prenotazione" }
          ].map((advantage, index) => (
            <motion.div
              key={advantage.title}
              className="bg-white/80 rounded-xl p-4 flex items-start space-x-3"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 + index * 0.1 }}
              whileHover={{ x: 5, scale: 1.01 }}
            >
              <div className="w-2 h-2 bg-terracotta-500 rounded-full mt-2 flex-shrink-0" />
              <div>
                <div className="font-bold text-gray-800 text-sm">{advantage.title}</div>
                <div className="text-gray-600 text-xs">{advantage.description}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

export default InvestorDashboard;