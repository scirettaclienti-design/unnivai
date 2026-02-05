import { Home, Compass, User, Camera } from "lucide-react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { Link } from "wouter";

const navItems = [
  { id: 'home', label: 'Home', icon: Home, path: '/' },
  { id: 'explore', label: 'Esplora', icon: Compass, path: '/explore' },
  { id: 'photos', label: 'Foto', icon: Camera, path: '/photos' },
  { id: 'profile', label: 'Profilo', icon: User, path: '/profile' }
];

export default function BottomNavigation() {
  const [location] = useLocation();
  
  const getActiveTab = () => {
    if (location === '/') return 'home';
    if (location === '/explore') return 'explore';
    if (location === '/photos') return 'photos';
    if (location === '/profile') return 'profile';
    return 'home';
  };
  
  const activeTab = getActiveTab();

  return (
    <footer className="bg-white/90 backdrop-blur-sm border-t border-gray-200 sticky bottom-0">
      <div className="max-w-md mx-auto px-4 py-3">
        <nav className="flex items-center justify-around">
          {navItems.map((item) => {
            const IconComponent = item.icon;
            const isActive = activeTab === item.id;
            
            return (
              <Link key={item.id} href={item.path}>
                <motion.button
                  className={`flex flex-col items-center space-y-1 transition-colors ${
                    isActive ? 'text-terracotta-400' : 'text-gray-400 hover:text-terracotta-400'
                  }`}
                  whileTap={{ scale: 0.95 }}
                >
                  <motion.div
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      isActive ? 'bg-terracotta-100' : ''
                    }`}
                    animate={isActive ? { scale: 1.1 } : { scale: 1 }}
                    transition={{ duration: 0.2 }}
                  >
                    <IconComponent className="w-5 h-5" />
                  </motion.div>
                  <span className="text-xs font-medium">{item.label}</span>
                </motion.button>
              </Link>
            );
          })}
        </nav>
      </div>
    </footer>
  );
}
