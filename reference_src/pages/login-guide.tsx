import { motion } from "framer-motion";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { ArrowLeft, MapPin, Mail, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

const LoginGuide = () => {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    email: "",
    password: ""
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/login-guide", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: "Login effettuato!",
          description: "Bentornato nella tua dashboard guida!",
          variant: "default",
        });
        
        setTimeout(() => setLocation("/"), 1500);
      } else {
        toast({
          title: "Errore di accesso",
          description: data.error || "Email o password non validi",
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
                Login <span className="text-purple-600">Guida</span>
              </h1>
              <p className="text-gray-600">Accedi alla tua dashboard</p>
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
              <h2 className="text-2xl font-bold text-gray-800">Accesso Guida</h2>
              <p className="text-gray-600 mt-2">Gestisci i tuoi tour</p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
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
                  placeholder="La tua password"
                  required
                  className="h-12"
                />
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
              >
                {isLoading ? "Accesso in corso..." : "Accedi"}
              </Button>
            </form>

            {/* Register Link */}
            <div className="text-center mt-8 pt-6 border-t border-gray-200">
              <p className="text-gray-600">
                Non hai ancora un account?{" "}
                <Link href="/auth/register/guide">
                  <span className="text-purple-600 font-semibold hover:text-purple-700 cursor-pointer">
                    Registrati qui
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

export default LoginGuide;