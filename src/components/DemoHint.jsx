import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ENABLE_DEMO_MODE } from '../data/demoData';
import { X } from 'lucide-react';

export default function DemoHint({ text, className = "", delay = 500 }) {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (ENABLE_DEMO_MODE) {
            const timer = setTimeout(() => setIsVisible(true), delay);
            return () => clearTimeout(timer);
        }
    }, [delay]);

    if (!ENABLE_DEMO_MODE) return null;

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 0, transform: 'translateY(10px)' }}
                    animate={{ opacity: 1, transform: 'translateY(0px)' }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className={`absolute z-30 bg-blue-600/90 backdrop-blur-sm text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-xl flex items-center gap-2 pointer-events-auto cursor-pointer border border-blue-400/30 ${className}`}
                    onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault(); // Prevent triggering parent link
                        setIsVisible(false);
                    }}
                >
                    <span className="shimmer-text">💡 {text}</span>
                    <X size={10} className="opacity-70 hover:opacity-100" />
                </motion.div>
            )}
        </AnimatePresence>
    );
}
