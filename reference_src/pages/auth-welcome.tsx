import { motion } from "framer-motion";
import { Link } from "wouter";
import { Users, Building2, MapPin, ArrowRight } from "lucide-react";

const AuthWelcome = () => {
  const userTypes = [
    {
      id: "customer",
      title: "Sono un Viaggiatore",
      description: "Scopri esperienze autentiche e vivi l'Italia come un locale",
      icon: Users,
      color: "from-blue-400 to-blue-600",
      route: "/auth/register/customer"
    },
    {
      id: "business", 
      title: "Sono un'Attività",
      description: "Promuovi la tua attività e raggiungi turisti da tutto il mondo",
      icon: Building2,
      color: "from-green-400 to-green-600",
      route: "/auth/register/business"
    },
    {
      id: "guide",
      title: "Sono una Guida",
      description: "Condividi la tua passione e fai scoprire le bellezze locali",
      icon: MapPin,
      color: "from-purple-400 to-purple-600", 
      route: "/auth/register/guide"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-red-50">
      {/* Header */}
      <div className="relative overflow-hidden bg-white/80 backdrop-blur-sm border-b border-orange-200">
        <div className="container mx-auto px-4 py-6">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <h1 className="text-4xl font-bold text-gray-800 mb-2">
              Benvenuto in <span className="text-terracotta-600">UNNIVAI</span>
            </h1>
            <p className="text-gray-600 text-lg">
              La piattaforma che connette viaggiatori, attività e guide locali
            </p>
          </motion.div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-center mb-12"
        >
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">
            Come vuoi utilizzare la piattaforma?
          </h2>
          <p className="text-gray-600">
            Scegli il profilo che meglio ti rappresenta per iniziare
          </p>
        </motion.div>

        {/* User Type Cards */}
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {userTypes.map((userType, index) => {
            const IconComponent = userType.icon;
            
            return (
              <motion.div
                key={userType.id}
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 + index * 0.1 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.98 }}
              >
                <Link href={userType.route}>
                  <div className="relative bg-white rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-300 overflow-hidden cursor-pointer group">
                    {/* Gradient Background */}
                    <div className={`absolute inset-0 bg-gradient-to-br ${userType.color} opacity-0 group-hover:opacity-10 transition-opacity duration-300`} />
                    
                    {/* Content */}
                    <div className="relative p-8 text-center">
                      {/* Icon */}
                      <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br ${userType.color} mb-6 shadow-lg`}>
                        <IconComponent className="w-10 h-10 text-white" />
                      </div>

                      {/* Title */}
                      <h3 className="text-2xl font-bold text-gray-800 mb-4 group-hover:text-terracotta-600 transition-colors">
                        {userType.title}
                      </h3>

                      {/* Description */}
                      <p className="text-gray-600 leading-relaxed mb-6">
                        {userType.description}
                      </p>

                      {/* CTA Button */}
                      <div className="inline-flex items-center space-x-2 text-terracotta-600 font-semibold group-hover:text-terracotta-700 transition-colors">
                        <span>Inizia ora</span>
                        <ArrowRight className="w-5 h-5 transform group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>

                    {/* Decorative Elements */}
                    <div className="absolute top-4 right-4 w-20 h-20 bg-gradient-to-br from-white/20 to-transparent rounded-full blur-xl" />
                    <div className="absolute bottom-4 left-4 w-16 h-16 bg-gradient-to-tr from-white/10 to-transparent rounded-full blur-lg" />
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>

        {/* Login Section */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="text-center mt-16"
        >
          <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-8 max-w-md mx-auto border border-orange-200">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">
              Hai già un account?
            </h3>
            <p className="text-gray-600 mb-6">
              Accedi con le tue credenziali esistenti
            </p>
            
            <div className="space-y-3">
              <Link href="/auth/login/customer">
                <button className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 px-6 rounded-xl font-semibold transition-colors">
                  Login Viaggiatore
                </button>
              </Link>
              <Link href="/auth/login/business">
                <button className="w-full bg-green-500 hover:bg-green-600 text-white py-3 px-6 rounded-xl font-semibold transition-colors">
                  Login Attività
                </button>
              </Link>
              <Link href="/auth/login/guide">
                <button className="w-full bg-purple-500 hover:bg-purple-600 text-white py-3 px-6 rounded-xl font-semibold transition-colors">
                  Login Guida
                </button>
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default AuthWelcome;