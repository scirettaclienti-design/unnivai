import { Home, Compass, User, Camera } from "lucide-react";
import { motion } from "framer-motion";
import { useLocation, Link } from "react-router-dom";

const navItems = [
    { id: 'home', label: 'Home', icon: Home, path: '/' },
    { id: 'explore', label: 'Esplora', icon: Compass, path: '/explore' },
    { id: 'photos', label: 'Foto', icon: Camera, path: '/photos' },
    { id: 'profile', label: 'Profilo', icon: User, path: '/profile' }
];

export default function BottomNavigation() {
    const { pathname: location } = useLocation();

    const getActiveTab = () => {
        if (location === '/') return 'home';
        if (location === '/explore') return 'explore';
        if (location === '/photos') return 'photos';
        if (location === '/profile') return 'profile';
        return 'home';
    };

    const activeTab = getActiveTab();

    return (
        <footer className="fixed bottom-0 w-full z-50 bg-white/80 backdrop-blur-md border-t border-gray-200/50 pb-safe">
            <div className="max-w-md mx-auto px-6 py-4">
                <nav className="flex items-center justify-between">
                    {navItems.map((item) => {
                        const IconComponent = item.icon;
                        const isActive = activeTab === item.id;

                        return (
                            <Link key={item.id} to={item.path} className="relative z-10">
                                <motion.button
                                    className={`flex flex-col items-center space-y-1 transition-colors duration-300 ${isActive ? 'text-terracotta-500' : 'text-gray-400 hover:text-gray-600'
                                        }`}
                                    whileTap={{ scale: 0.9 }}
                                >
                                    <div className="relative">
                                        <IconComponent className={`w-6 h-6 ${isActive ? 'stroke-[2.5px]' : 'stroke-2'}`} />
                                        {isActive && (
                                            <motion.div
                                                layoutId="nav-glow"
                                                className="absolute inset-0 bg-terracotta-400/20 blur-lg rounded-full"
                                                transition={{ duration: 0.3 }}
                                            />
                                        )}
                                    </div>
                                    <span className={`text-[10px] font-medium tracking-wide ${isActive ? 'opacity-100' : 'opacity-80'}`}>
                                        {item.label}
                                    </span>
                                </motion.button>
                            </Link>
                        );
                    })}
                </nav>
            </div>
        </footer>
    );
}
