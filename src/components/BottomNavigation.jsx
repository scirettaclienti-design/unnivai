import React from "react";
import { Home, Compass, User, Camera } from "lucide-react";
import { motion } from "framer-motion";
import { useLocation, Link } from "react-router-dom";

const navItems = [
    { id: 'home', label: 'Home', icon: Home, path: '/dashboard-user' },
    { id: 'explore', label: 'Esplora', icon: Compass, path: '/explore' },
    { id: 'photos', label: 'Foto', icon: Camera, path: '/photos' },
    { id: 'profile', label: 'Profilo', icon: User, path: '/profile' }
];

export default function BottomNavigation() {
    const { pathname: location } = useLocation();

    const getActiveTab = () => {
        if (location === '/') return 'home';
        if (location === '/dashboard-user') return 'home';
        if (location === '/explore') return 'explore';
        if (location === '/photos') return 'photos';
        if (location === '/profile') return 'profile';
        return 'home';
    };

    const activeTab = getActiveTab();

    return (
        <footer className="fixed bottom-0 w-full z-50 bg-white/90 backdrop-blur-md border-t border-stone-200/70 pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.03)]">
            <div className="max-w-md mx-auto px-6 py-2.5">
                <nav className="flex items-center justify-between" aria-label="Navigazione principale">
                    {navItems.map((item) => {
                        const IconComponent = item.icon;
                        const isActive = activeTab === item.id;

                        return (
                            <Link key={item.id} to={item.path} className="relative z-10 py-1 px-3">
                                <motion.div
                                    className={`flex flex-col items-center space-y-1 transition-colors duration-200 ${
                                        isActive ? 'text-stone-950 font-bold' : 'text-stone-400 hover:text-stone-600 font-medium'
                                    }`}
                                    whileTap={{ scale: 0.94 }}
                                >
                                    <div className="relative flex flex-col items-center">
                                        <IconComponent
                                            className={`w-5 h-5 transition-transform duration-200 ${
                                                isActive ? 'stroke-[2.5] scale-105 text-stone-950' : 'stroke-[1.75] text-stone-400'
                                            }`}
                                        />
                                        {isActive && (
                                            <motion.span
                                                layoutId="activeNavIndicator"
                                                className="absolute -bottom-1 w-1 h-1 rounded-full bg-stone-900"
                                                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                                            />
                                        )}
                                    </div>
                                    <span className="text-[10px] tracking-tight">
                                        {item.label}
                                    </span>
                                </motion.div>
                            </Link>
                        );
                    })}
                </nav>
            </div>
        </footer>
    );
}
