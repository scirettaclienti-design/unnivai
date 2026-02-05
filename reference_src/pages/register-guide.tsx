import { motion } from "framer-motion";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { ArrowLeft, MapPin, Mail, Lock, Phone, User, Star, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

const RegisterGuide = () => {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    phone: "",
    guideName: "",
    specialization: "",
    city: "",
    experience: "",
    hourlyRate: ""
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const requestData = {
        ...formData,
        experience: formData.experience ? parseInt(formData.experience) : 0
      };

      const response = await fetch("/api/auth/register-guide", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestData),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: "Registrazione completata!",
          description: "Benvenuto in UNNIVAI! Sei ora registrato come guida.",
          variant: "default",
        });
        
        setTimeout(() => setLocation("/"), 1500);
      } else {
        toast({
          title: "Errore nella registrazione",
          description: data.error || "Si è verificato un errore",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Errore di connessione",
        description: "Verifica la tua connessione internet",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-purple-100">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-purple-200">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center space-x-4">
            <Link href="/auth/welcome">
              <Button variant="ghost" size="sm" className="flex items-center space-x-2">
                <ArrowLeft className="w-4 h-4" />
                <span>Indietro</span>
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                Registrazione <span className="text-purple-600">Guida</span>
              </h1>
              <p className="text-gray-600">Condividi la tua passione per l'Italia</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-md mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="bg-white rounded-3xl shadow-xl p-8"
          >
            {/* Icon */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 shadow-lg mb-4">
                <MapPin className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800">Diventa una Guida</h2>
              <p className="text-gray-600 mt-2">Fai scoprire le bellezze locali</p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="username" className="flex items-center space-x-2 mb-2">
                  <User className="w-4 h-4" />
                  <span>Nome utente</span>
                </Label>
                <Input
                  id="username"
                  type="text"
                  value={formData.username}
                  onChange={(e) => handleInputChange("username", e.target.value)}
                  placeholder="Il tuo nome utente"
                  required
                  className="h-12"
                />
              </div>

              <div>
                <Label htmlFor="guideName" className="flex items-center space-x-2 mb-2">
                  <Star className="w-4 h-4" />
                  <span>Nome completo</span>
                </Label>
                <Input
                  id="guideName"
                  type="text"
                  value={formData.guideName}
                  onChange={(e) => handleInputChange("guideName", e.target.value)}
                  placeholder="Es. Marco Rossi"
                  required
                  className="h-12"
                />
              </div>

              <div>
                <Label htmlFor="email" className="flex items-center space-x-2 mb-2">
                  <Mail className="w-4 h-4" />
                  <span>Email</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  placeholder="marco@esempio.com"
                  required
                  className="h-12"
                />
              </div>

              <div>
                <Label htmlFor="password" className="flex items-center space-x-2 mb-2">
                  <Lock className="w-4 h-4" />
                  <span>Password</span>
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => handleInputChange("password", e.target.value)}
                  placeholder="Minimo 6 caratteri"
                  required
                  minLength={6}
                  className="h-12"
                />
              </div>

              <div>
                <Label htmlFor="city" className="flex items-center space-x-2 mb-2">
                  <MapPin className="w-4 h-4" />
                  <span>Città</span>
                </Label>
                <Input
                  id="city"
                  type="text"
                  value={formData.city}
                  onChange={(e) => handleInputChange("city", e.target.value)}
                  placeholder="Es. Roma, Milano, Firenze"
                  className="h-12"
                />
              </div>

              <div>
                <Label htmlFor="specialization" className="flex items-center space-x-2 mb-2">
                  <Globe className="w-4 h-4" />
                  <span>Specializzazione</span>
                </Label>
                <Input
                  id="specialization"
                  type="text"
                  value={formData.specialization}
                  onChange={(e) => handleInputChange("specialization", e.target.value)}
                  placeholder="Es. Storia, Arte, Gastronomia"
                  className="h-12"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="experience" className="flex items-center space-x-2 mb-2">
                    <Star className="w-4 h-4" />
                    <span>Anni esperienza</span>
                  </Label>
                  <Input
                    id="experience"
                    type="number"
                    value={formData.experience}
                    onChange={(e) => handleInputChange("experience", e.target.value)}
                    placeholder="5"
                    min="0"
                    className="h-12"
                  />
                </div>

                <div>
                  <Label htmlFor="hourlyRate" className="flex items-center space-x-2 mb-2">
                    <span>€</span>
                    <span>Tariffa/ora</span>
                  </Label>
                  <Input
                    id="hourlyRate"
                    type="text"
                    value={formData.hourlyRate}
                    onChange={(e) => handleInputChange("hourlyRate", e.target.value)}
                    placeholder="45.00"
                    className="h-12"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="phone" className="flex items-center space-x-2 mb-2">
                  <Phone className="w-4 h-4" />
                  <span>Telefono</span>
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleInputChange("phone", e.target.value)}
                  placeholder="+39 123 456 7890"
                  className="h-12"
                />
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 mt-6"
              >
                {isLoading ? "Registrazione in corso..." : "Registrati come guida"}
              </Button>
            </form>

            {/* Login Link */}
            <div className="text-center mt-8 pt-6 border-t border-gray-200">
              <p className="text-gray-600">
                Hai già un account?{" "}
                <Link href="/auth/login/guide">
                  <span className="text-purple-600 font-semibold hover:text-purple-700 cursor-pointer">
                    Accedi qui
                  </span>
                </Link>
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default RegisterGuide;