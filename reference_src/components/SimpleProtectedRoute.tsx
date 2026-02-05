import { useEffect, useState } from "react";
import { useLocation } from "wouter";

interface User {
  id: number;
  username: string;
  email: string;
  userType: 'customer' | 'business' | 'guide';
}

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedUserTypes?: ('customer' | 'business' | 'guide')[];
}

const SimpleProtectedRoute = ({ 
  children, 
  allowedUserTypes = ['customer', 'business', 'guide']
}: ProtectedRouteProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [, setLocation] = useLocation();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/me');
        if (!response.ok) {
          setLocation('/auth/welcome');
          return;
        }
        
        const data = await response.json();
        const userData = data.user;
        
        if (!allowedUserTypes.includes(userData.userType)) {
          // Redirect to appropriate dashboard
          switch (userData.userType) {
            case 'business':
              setLocation('/dashboard/business');
              break;
            case 'guide':
              setLocation('/dashboard/guide');
              break;
            case 'customer':
            default:
              setLocation('/');
              break;
          }
          return;
        }
        
        setUser(userData);
      } catch (error) {
        setLocation('/auth/welcome');
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [allowedUserTypes, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-terracotta-200 border-t-terracotta-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Caricamento...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
};

export default SimpleProtectedRoute;