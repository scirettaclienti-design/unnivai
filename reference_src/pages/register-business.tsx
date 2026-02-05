import { motion } from "framer-motion";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { ArrowLeft, Building2, Mail, Lock, Phone, User, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

const RegisterBusiness = () => {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    phone: "",
    businessName: "",
    businessType: "",
    vatNumber: ""
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/register-business", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: "Registrazione completata!",
          description: "Benvenuto in UNNIVAI! La tua attività è ora registrata.",
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
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-green-100">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-green-200">
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
                Registrazione <span className="text-green-600">Attività</span>
              </h1>
              <p className="text-gray-600">Iscriviti e promuovi la tua attività</p>
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
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-green-400 to-green-600 shadow-lg mb-4">
                <Building2 className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800">Registra la tua Attività</h2>
              <p className="text-gray-600 mt-2">Raggiungi turisti da tutto il mondo</p>
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
                <Label htmlFor="businessName" className="flex items-center space-x-2 mb-2">
                  <Building2 className="w-4 h-4" />
                  <span>Nome attività</span>
                </Label>
                <Input
                  id="businessName"
                  type="text"
                  value={formData.businessName}
                  onChange={(e) => handleInputChange("businessName", e.target.value)}
                  placeholder="Es. Ristorante Da Mario"
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
                  placeholder="info@tuaattivita.com"
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

              <div>
                <Label htmlFor="businessType" className="flex items-center space-x-2 mb-2">
                  <MapPin className="w-4 h-4" />
                  <span>Tipo attività</span>
                </Label>
                <Input
                  id="businessType"
                  type="text"
                  value={formData.businessType}
                  onChange={(e) => handleInputChange("businessType", e.target.value)}
                  placeholder="Es. Ristorante, Hotel, Museo"
                  className="h-12"
                />
              </div>

              <div>
                <Label htmlFor="vatNumber" className="flex items-center space-x-2 mb-2">
                  <Building2 className="w-4 h-4" />
                  <span>P.IVA (opzionale)</span>
                </Label>
                <Input
                  id="vatNumber"
                  type="text"
                  value={formData.vatNumber}
                  onChange={(e) => handleInputChange("vatNumber", e.target.value)}
                  placeholder="12345678901"
                  className="h-12"
                />
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 mt-6"
              >
                {isLoading ? "Registrazione in corso..." : "Registra attività"}
              </Button>
            </form>

            {/* Login Link */}
            <div className="text-center mt-8 pt-6 border-t border-gray-200">
              <p className="text-gray-600">
                Hai già un account?{" "}
                <Link href="/auth/login/business">
                  <span className="text-green-600 font-semibold hover:text-green-700 cursor-pointer">
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

export default RegisterBusiness;