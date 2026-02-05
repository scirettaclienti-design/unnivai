import { motion } from "framer-motion";
import { Link } from "wouter";
import { useState, useEffect } from "react";
import { 
  MapPin, 
  Star, 
  Plus, 
  Users, 
  Calendar, 
  Clock,
  Settings,
  LogOut,
  Award,
  Target,
  Globe,
  CheckCircle,
  TrendingUp,
  BookOpen
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import LocationBasedFeatures from "@/components/LocationBasedFeatures";

const GuideDashboard = () => {
  const { toast } = useToast();
  const [guideData, setGuideData] = useState({
    guideName: "",
    specialization: "",
    rating: 0,
    totalReviews: 0,
    activeGuides: 0,
    totalEarnings: 0,
    hourlyRate: 0
  });

  const [statsData] = useState([
    { label: "Guide Attive", value: "5", change: "+1", icon: MapPin },
    { label: "Rating Medio", value: "4.9", change: "+0.1", icon: Star },
    { label: "Tour Completati", value: "47", change: "+8", icon: CheckCircle },
    { label: "Guadagno Mese", value: "€1,240", change: "+15%", icon: TrendingUp }
  ]);

  const [activeGuides] = useState([
    { 
      id: 1, 
      title: "Roma Antica e Colosseo", 
      nextTour: "Oggi 15:00", 
      participants: 8, 
      rating: 4.9,
      status: "active"
    },
    { 
      id: 2, 
      title: "Vaticano e Cappella Sistina", 
      nextTour: "Domani 10:00", 
      participants: 12, 
      rating: 4.8,
      status: "scheduled"
    },
    { 
      id: 3, 
      title: "Trastevere Notturno", 
      nextTour: "Sab 20:00", 
      participants: 6, 
      rating: 5.0,
      status: "scheduled"
    }
  ]);

  const [rankings] = useState([
    { position: 2, category: "Guide Storiche Roma", totalGuides: 34 },
    { position: 5, category: "Guide Culturali", totalGuides: 67 },
    { position: 8, category: "Generale Lazio", totalGuides: 128 }
  ]);

  const [upcomingTours] = useState([
    { time: "15:00", title: "Roma Antica", participants: 8, location: "Colosseo" },
    { time: "17:30", title: "Aperitivo Romano", participants: 4, location: "Campo de' Fiori" }
  ]);

  useEffect(() => {
    // Simulate fetching guide profile data
    const fetchGuideData = async () => {
      try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
          const data = await response.json();
          if (data.guideProfile) {
            setGuideData({
              guideName: data.guideProfile.guideName,
              specialization: data.guideProfile.specialization,
              rating: 4.9,
              totalReviews: 89,
              activeGuides: 5,
              totalEarnings: 1240,
              hourlyRate: parseFloat(data.guideProfile.hourlyRate || "45")
            });
          }
        }
      } catch (error) {
        console.error('Error fetching guide data:', error);
      }
    };

    fetchGuideData();
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
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-purple-100">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-purple-200">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-purple-600">
                <MapPin className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-800">
                  Dashboard <span className="text-purple-600">Guida</span>
                </h1>
                <p className="text-gray-600">{guideData.guideName || "Guida Turistica"}</p>
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
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-purple-600">
                    <IconComponent className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-purple-600 font-semibold text-sm">{stat.change}</span>
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
            {/* Active Guides */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="bg-white rounded-3xl shadow-lg p-8"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-800">Le Tue Guide</h2>
                <Link href="/create-guide">
                  <Button className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Nuova Guida
                  </Button>
                </Link>
              </div>
              
              <div className="space-y-4">
                {activeGuides.map((guide) => (
                  <div key={guide.id} className="flex items-center justify-between p-4 bg-purple-50 rounded-2xl">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="font-semibold text-gray-800">{guide.title}</h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          guide.status === 'active' 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {guide.status === 'active' ? 'In Corso' : 'Programmato'}
                        </span>
                      </div>
                      <div className="flex items-center space-x-4 text-sm text-gray-600">
                        <span className="flex items-center">
                          <Clock className="w-4 h-4 mr-1" />
                          {guide.nextTour}
                        </span>
                        <span className="flex items-center">
                          <Users className="w-4 h-4 mr-1" />
                          {guide.participants} partecipanti
                        </span>
                        <span className="flex items-center">
                          <Star className="w-4 h-4 mr-1 text-yellow-500" />
                          {guide.rating}
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

            {/* Today's Schedule */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6 }}
              className="bg-white rounded-3xl shadow-lg p-8"
            >
              <h2 className="text-xl font-bold text-gray-800 mb-6">Programma di Oggi</h2>
              <div className="space-y-4">
                {upcomingTours.map((tour, index) => (
                  <div key={index} className="flex items-center space-x-4 p-4 border border-gray-200 rounded-2xl">
                    <div className="flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 text-white font-bold">
                      {tour.time}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-800">{tour.title}</h3>
                      <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600">
                        <span className="flex items-center">
                          <Users className="w-4 h-4 mr-1" />
                          {tour.participants} persone
                        </span>
                        <span className="flex items-center">
                          <MapPin className="w-4 h-4 mr-1" />
                          {tour.location}
                        </span>
                      </div>
                    </div>
                    <Button variant="outline" size="sm">
                      Dettagli
                    </Button>
                  </div>
                ))}
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
              <LocationBasedFeatures userType="guide" showNearbyData={true} />
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
                <Link href="/create-guide">
                  <Button className="w-full justify-start bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700">
                    <Plus className="w-4 h-4 mr-3" />
                    Crea Nuova Guida
                  </Button>
                </Link>
                <Button variant="outline" className="w-full justify-start">
                  <Calendar className="w-4 h-4 mr-3" />
                  Gestisci Calendario
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Users className="w-4 h-4 mr-3" />
                  Visualizza Prenotazioni
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
                        <p className="text-xs text-gray-600">su {rank.totalGuides} guide</p>
                      </div>
                    </div>
                    {rank.position <= 5 && (
                      <Award className="w-5 h-5 text-yellow-500" />
                    )}
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Guide Performance */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.8 }}
              className="bg-white rounded-3xl shadow-lg p-6"
            >
              <h2 className="text-lg font-bold text-gray-800 mb-6">Performance</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Rating Medio</span>
                  <div className="flex items-center space-x-1">
                    <Star className="w-4 h-4 text-yellow-500 fill-current" />
                    <span className="font-semibold">4.9/5</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Tasso Completamento</span>
                  <span className="font-semibold text-green-600">98%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Tariffa Oraria</span>
                  <span className="font-semibold text-purple-600">€{guideData.hourlyRate}/h</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Ripetitori</span>
                  <span className="font-semibold text-blue-600">23%</span>
                </div>
              </div>
              
              <Button variant="outline" className="w-full mt-4">
                <Target className="w-4 h-4 mr-2" />
                Migliora Profilo
              </Button>
            </motion.div>

            {/* Specialization Badge */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.9 }}
              className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-3xl shadow-lg p-6 text-white"
            >
              <div className="flex items-center space-x-3 mb-4">
                <Globe className="w-8 h-8" />
                <div>
                  <h2 className="text-lg font-bold">Specializzazione</h2>
                  <p className="text-purple-100 capitalize">{guideData.specialization || "Storia"}</p>
                </div>
              </div>
              <p className="text-purple-100 text-sm">
                Continua a migliorare le tue competenze per scalare le classifiche e attrarre più visitatori.
              </p>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GuideDashboard;