import React from 'react';
import { Bot, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const AIAskButton = ({ onClick, isVisible = true }) => {
    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    className="absolute bottom-32 right-4 z-40 pointer-events-auto"
                >
                    <button
                        onClick={onClick}
                        className="group relative flex items-center justify-center w-14 h-14 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-2xl shadow-[0_8px_30px_rgb(168,85,247,0.4)] hover:shadow-[0_8px_40px_rgb(168,85,247,0.6)] transition-all duration-300 hover:scale-110 active:scale-95 border border-white/20"
                    >
                        {/* Glow effect behind */}
                        <div className="absolute inset-0 bg-white/20 rounded-2xl blur-md group-hover:blur-lg transition-all" />
                        
                        {/* Icon */}
                        <Bot size={24} className="text-white relative z-10 drop-shadow-md" />
                        
                        {/* Tooltip */}
                        <div className="absolute right-full mr-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none flex items-center">
                            <div className="bg-gray-900 text-white text-xs font-bold px-3 py-1.5 rounded-xl whitespace-nowrap shadow-xl">
                                Assistente DoveVai
                            </div>
                            <div className="w-2 h-2 bg-gray-900 rotate-45 -ml-1" />
                        </div>
                    </button>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
