import React from 'react';
import { Star } from "lucide-react";
import { motion } from "framer-motion";

export default function FeaturedExperience() {
    return (
        <motion.div
            className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 shadow-lg mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
        >
            <div className="flex items-center space-x-4">
                <img
                    src="https://images.unsplash.com/photo-1523906834658-6e24ef2386f9?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&h=100"
                    alt="Tuscan countryside"
                    className="w-16 h-16 rounded-xl object-cover shadow-md"
                />
                <div className="flex-1">
                    <h3 className="font-semibold text-gray-800 mb-1">Esperienza del Giorno</h3>
                    <p className="text-sm text-gray-600 mb-2">Tour delle Colline Toscane con degustazione</p>
                    <div className="flex items-center space-x-2">
                        <span className="text-terracotta-400 font-semibold">€45</span>
                        <div className="flex items-center space-x-1">
                            <Star className="text-ochre-400 w-3 h-3 fill-current" />
                            <span className="text-xs text-gray-600">4.8</span>
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
