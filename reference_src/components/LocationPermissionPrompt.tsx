import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, X, Settings } from 'lucide-react';

interface LocationPermissionPromptProps {
  onAllow: () => void;
  onDeny: () => void;
  isVisible: boolean;
}

export default function LocationPermissionPrompt({ onAllow, onDeny, isVisible }: LocationPermissionPromptProps) {
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(onDeny, 300);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative"
            initial={{ scale: 0.8, y: 50 }}
            animate={{ scale: isClosing ? 0.8 : 1, y: isClosing ? 50 : 0 }}
            exit={{ scale: 0.8, y: 50 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
          >
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center">
              <motion.div
                className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4"
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <MapPin className="w-8 h-8 text-blue-600" />
              </motion.div>

              <h3 className="text-xl font-bold text-gray-800 mb-2">
                Scopri tour nella tua zona
              </h3>
              
              <p className="text-gray-600 mb-6 leading-relaxed">
                Per offrirti tour e esperienze personalizzate vicino a te, 
                abbiamo bisogno di accedere alla tua posizione.
              </p>

              <div className="space-y-3">
                <motion.button
                  onClick={onAllow}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Consenti posizione
                </motion.button>
                
                <button
                  onClick={handleClose}
                  className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 px-6 rounded-xl transition-colors"
                >
                  Usa Roma come predefinita
                </button>
              </div>

              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <div className="flex items-start space-x-2 text-sm text-blue-700">
                  <Settings className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <p>
                    <strong>Suggerimento:</strong> Se hai negato i permessi, vai nelle 
                    impostazioni del browser → Privacy → Posizione e abilita questo sito.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}