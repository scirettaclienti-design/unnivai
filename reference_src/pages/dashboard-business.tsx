import { motion } from "framer-motion";
import { Link } from "wouter";
import { useState, useEffect } from "react";
import { 
  BarChart3, 
  Users, 
  MapPin, 
  Star, 
  Plus, 
  Eye, 
  TrendingUp, 
  Calendar,
  Building2,
  Settings,
  LogOut,
  Award,
  Target,
  Activity
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import LocationBasedFeatures from "@/components/LocationBasedFeatures";

const BusinessDashboard = () => {
  const { toast } = useToast();
  const [businessData, setBusinessData] = useState({
    businessName: "",
    totalViews: 0,
    monthlyViews: 0,
    rating: 0,
    totalReviews: 0,
    activeTours: 0,
    totalBookings: 0
  });

  const [statsData] = useState([
    { label: "Visite Totali", value: "2,847", change: "+12%", icon: Eye },
    { label: "Visite Mensili", value: "342", change: "+8%", icon: TrendingUp },
    { label: "Tour Attivi", value: "7", change: "+2", icon: MapPin },
    { label: "Prenotazioni", value: "89", change: "+23%", icon: Calendar }
  ]);

  const [tours] = useState([
    { id: 1, name: "Degustazione Vini Chianti", views: 234, bookings: 12, rating: 4.8 },
    { id: 2, name: "Cucina Tradizionale Toscana", views: 189, bookings: 8, rating: 4.9 },
    { id: 3, name: "Tour Storico Centro", views: 156, bookings: 15, rating: 4.7 }
  ]);

  const [rankings] = useState([
    { position: 3, category: "Gastronomia", totalBusinesses: 47 },
    { position: 7, category: "Esperienze Culturali", totalBusinesses: 82 },
    { position: 12, category: "Generale Firenze", totalBusinesses: 156 }
  ]);

  useEffect(() => {
    // Simulate fetching business profile data
    const fetchBusinessData = async () => {
      try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
          const data = await response.json();
          if (data.businessProfile) {
            setBusinessData({
              businessName: data.businessProfile.businessName,
              totalViews: 2847,
              monthlyViews: 342,
              rating: 4.8,
              totalReviews: 127,
              activeTours: 7,
              totalBookings: 89
            });
          }
        }
      } catch (error) {
        console.error('Error fetching business data:', error);
      }
    };

    fetchBusinessData();
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = '/auth/welcome';
    } catch (error) {
      toast({
        title: "Errore durante il logout",
        description: "Riprova tra qualche istante",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-green-100">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-green-200">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-green-400 to-green-600">
                <Building2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-800">
                  Dashboard <span className="text-green-600">Business</span>
                </h1>
                <p className="text-gray-600">{businessData.businessName || "La tua attività"}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Button variant="outline" size="sm">
                <Settings className="w-4 h-4 mr-2" />
                Impostazioni
              </Button>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {statsData.map((stat, index) => {
            const IconComponent = stat.icon;
            return (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className="bg-white rounded-3xl shadow-lg p-6 hover:shadow-xl transition-shadow"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-green-400 to-green-600">
                    <IconComponent className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-green-600 font-semibold text-sm">{stat.change}</span>
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-800 mb-1">{stat.value}</p>
                  <p className="text-gray-600 text-sm">{stat.label}</p>
                </div>
              </motion.div>
            );
          })}
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-8">
            {/* Tours Performance */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="bg-white rounded-3xl shadow-lg p-8"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-800">Performance Tour</h2>
                <Link href="/create-tour">
                  <Button className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Nuovo Tour
                  </Button>
                </Link>
              </div>
              
              <div className="space-y-4">
                {tours.map((tour) => (
                  <div key={tour.id} className="flex items-center justify-between p-4 bg-green-50 rounded-2xl">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-800">{tour.name}</h3>
                      <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600">
                        <span className="flex items-center">
                          <Eye className="w-4 h-4 mr-1" />
                          {tour.views} visite
                        </span>
                        <span className="flex items-center">
                          <Calendar className="w-4 h-4 mr-1" />
                          {tour.bookings} prenotazioni
                        </span>
                        <span className="flex items-center">
                          <Star className="w-4 h-4 mr-1 text-yellow-500" />
                          {tour.rating}
                        </span>
                      </div>
                    </div>
                    <Button variant="outline" size="sm">
                      Gestisci
                    </Button>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Analytics Chart Placeholder */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6 }}
              className="bg-white rounded-3xl shadow-lg p-8"
            >
              <h2 className="text-xl font-bold text-gray-800 mb-6">Andamento Visite</h2>
              <div className="h-64 bg-gradient-to-br from-green-50 to-green-100 rounded-2xl flex items-center justify-center">
                <div className="text-center">
                  <BarChart3 className="w-16 h-16 text-green-400 mx-auto mb-4" />
                  <p className="text-gray-600">Grafico analytics in arrivo</p>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Right Column */}
          <div className="space-y-8">
            {/* Location-based Features */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              <LocationBasedFeatures userType="business" showNearbyData={true} />
            </motion.div>
            {/* Quick Actions */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="bg-white rounded-3xl shadow-lg p-6"
            >
              <h2 className="text-lg font-bold text-gray-800 mb-6">Azioni Rapide</h2>
              <div className="space-y-3">
                <Link href="/create-tour">
                  <Button className="w-full justify-start bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700">
                    <Plus className="w-4 h-4 mr-3" />
                    Crea Nuovo Tour
                  </Button>
                </Link>
                <Button variant="outline" className="w-full justify-start">
                  <BarChart3 className="w-4 h-4 mr-3" />
                  Visualizza Analytics
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Users className="w-4 h-4 mr-3" />
                  Gestisci Prenotazioni
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Star className="w-4 h-4 mr-3" />
                  Rispondi Recensioni
                </Button>
              </div>
            </motion.div>

            {/* Rankings */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.7 }}
              className="bg-white rounded-3xl shadow-lg p-6"
            >
              <h2 className="text-lg font-bold text-gray-800 mb-6">Classifiche</h2>
              <div className="space-y-4">
                {rankings.map((rank, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-500 text-white text-sm font-bold">
                        #{rank.position}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800 text-sm">{rank.category}</p>
                        <p className="text-xs text-gray-600">su {rank.totalBusinesses} attività</p>
                      </div>
                    </div>
                    {rank.position <= 5 && (
                      <Award className="w-5 h-5 text-yellow-500" />
                    )}
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Business Health */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.8 }}
              className="bg-white rounded-3xl shadow-lg p-6"
            >
              <h2 className="text-lg font-bold text-gray-800 mb-6">Salute Business</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Rating Medio</span>
                  <div className="flex items-center space-x-1">
                    <Star className="w-4 h-4 text-yellow-500 fill-current" />
                    <span className="font-semibold">4.8/5</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Tasso Risposta</span>
                  <span className="font-semibold text-green-600">95%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Completamento Profilo</span>
                  <span className="font-semibold text-blue-600">87%</span>
                </div>
              </div>
              
              <Button variant="outline" className="w-full mt-4">
                <Target className="w-4 h-4 mr-2" />
                Migliora Profilo
              </Button>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BusinessDashboard;