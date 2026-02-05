import { motion, AnimatePresence } from "framer-motion";
import { Check, X, AlertCircle, Info } from "lucide-react";
import { useEffect } from "react";

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  isVisible: boolean;
  onClose: () => void;
  duration?: number;
}

export function Toast({ message, type, isVisible, onClose, duration = 2000 }: ToastProps) {
  useEffect(() => {
    if (isVisible && duration > 0) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [isVisible, duration, onClose]);

  const getIcon = () => {
    switch (type) {
      case 'success': return <Check className="w-5 h-5" />;
      case 'error': return <AlertCircle className="w-5 h-5" />;
      case 'warning': return <AlertCircle className="w-5 h-5" />;
      case 'info': return <Info className="w-5 h-5" />;
    }
  };

  const getColors = () => {
    switch (type) {
      case 'success': return 'bg-gradient-to-r from-green-500 to-green-600 shadow-green-200';
      case 'error': return 'bg-gradient-to-r from-red-500 to-red-600 shadow-red-200';
      case 'warning': return 'bg-gradient-to-r from-yellow-500 to-orange-500 shadow-yellow-200';
      case 'info': return 'bg-gradient-to-r from-blue-500 to-blue-600 shadow-blue-200';
    }
  };

  const getEmoji = () => {
    switch (type) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'warning': return '⚠️';
      case 'info': return 'ℹ️';
    }
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-sm px-4 sm:max-w-md"
          initial={{ opacity: 0, y: -50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -30, scale: 0.95 }}
          transition={{ 
            duration: 0.3, 
            ease: [0.22, 1, 0.36, 1],
            type: "spring",
            stiffness: 400,
            damping: 30
          }}
        >
          <motion.div 
            className={`${getColors()} text-white rounded-2xl p-3 sm:p-4 shadow-2xl backdrop-blur-sm flex items-center space-x-3 border border-white/20`}
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.95 }}
          >
            <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
              <span className="text-xl sm:text-2xl flex-shrink-0">{getEmoji()}</span>
              <p className="text-white font-medium text-xs sm:text-sm leading-tight sm:leading-relaxed line-clamp-2 min-w-0">{message}</p>
            </div>
            <motion.button
              onClick={onClose}
              className="text-white/80 hover:text-white transition-colors p-1 rounded-full hover:bg-white/20 flex-shrink-0"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <X className="w-3 h-3 sm:w-4 sm:h-4" />
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}