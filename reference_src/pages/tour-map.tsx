import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import SimulatedRomeMap from "@/components/SimulatedRomeMap";

export default function TourMapPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-ochre-100 to-ochre-200 relative">
      {/* Back Button */}
      <div className="absolute top-4 left-4 z-50">
        <Link href="/">
          <motion.button
            className="flex items-center space-x-2 bg-white/90 backdrop-blur-md text-terracotta-600 px-4 py-2 rounded-xl shadow-lg hover:shadow-xl"
            whileHover={{ scale: 1.05, x: -5 }}
            whileTap={{ scale: 0.95 }}
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="font-medium">Home</span>
          </motion.button>
        </Link>
      </div>

      {/* Header */}
      <div className="absolute top-20 left-0 right-0 z-40 px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Mappa Interattiva Roma</h1>
          <p className="text-gray-600">Clicca sui pin per esplorare i tour disponibili</p>
        </div>
      </div>

      {/* Simulated Rome Map Component */}
      <div className="w-full h-screen pt-32">
        <SimulatedRomeMap />
      </div>
    </div>
  );
}