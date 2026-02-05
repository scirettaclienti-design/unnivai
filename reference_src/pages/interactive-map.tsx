import { motion } from "framer-motion";
import { ArrowLeft, MapPin, Navigation, Filter, Search } from "lucide-react";
import { Link } from "wouter";
import UltraPerformanceMap from "@/components/UltraPerformanceMap";
import TopBar from "@/components/TopBar";
import BottomNavigation from "@/components/BottomNavigation";

export default function InteractiveMapPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Full Screen Ultra Performance Map */}
      <UltraPerformanceMap />
      
      {/* Back Button Overlay */}
      <div className="absolute top-4 left-4 z-50">
        <Link href="/">
          <motion.button
            className="flex items-center space-x-2 bg-white/90 backdrop-blur-md text-blue-600 px-4 py-2 rounded-xl shadow-lg hover:shadow-xl border border-blue-200"
            whileHover={{ scale: 1.05, x: -5 }}
            whileTap={{ scale: 0.95 }}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="font-medium">Home</span>
          </motion.button>
        </Link>
      </div>

      <BottomNavigation />
    </div>
  );
}