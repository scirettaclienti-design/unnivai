import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Settings, Smartphone, X } from 'lucide-react';
import { useState } from 'react';

interface LocationGuideProps {
  currentCity: string;
  onTryAgain: () => void;
}

export function LocationGuide({ currentCity, onTryAgain }: LocationGuideProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (currentCity !== 'Roma') return null;

  return (
    <>
      <motion.div
        className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4"
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-start space-x-3">
          <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
            <MapPin className="w-5 h-5 text-amber-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-amber-800 mb-1">
              Stiamo mostrando Roma come posizione
            </h3>
            <p className="text-sm text-amber-700 mb-3">
              Non riusciamo a rilevare la tua posizione reale (Manfredonia). 
              Per vedere tour nella tua zona, abilita la geolocalizzazione.
            </p>
            <div className="flex space-x-2">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onTryAgain}
                className="text-sm bg-terracotta-500 text-white px-4 py-2 rounded-full hover:bg-terracotta-600 transition-colors"
              >
                🎯 Rileva Posizione
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsOpen(true)}
                className="text-sm bg-amber-100 text-amber-700 px-4 py-2 rounded-full hover:bg-amber-200 transition-colors"
              >
                ❓ Come abilitare
              </motion.button>
            </div>
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              className="bg-white rounded-3xl p-6 max-w-md w-full"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-800">Come abilitare la posizione</h2>
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <Settings className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800">Sul Browser</h3>
                    <p className="text-sm text-gray-600">
                      Clicca sull'icona del lucchetto nella barra degli indirizzi e abilita "Posizione"
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <Smartphone className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800">Sul Dispositivo</h3>
                    <p className="text-sm text-gray-600">
                      Vai in Impostazioni → Privacy → Servizi di localizzazione e attiva la geolocalizzazione
                    </p>
                  </div>
                </div>

                <div className="bg-terracotta-50 rounded-2xl p-4">
                  <p className="text-sm text-terracotta-700">
                    <strong>Perché chiediamo la posizione?</strong><br />
                    Per mostrarti tour e esperienze specifiche per Manfredonia e la tua zona, 
                    invece di usare Roma come fallback.
                  </p>
                </div>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setIsOpen(false);
                    onTryAgain();
                  }}
                  className="w-full bg-terracotta-500 text-white py-3 rounded-2xl font-semibold hover:bg-terracotta-600 transition-colors"
                >
                  Prova Ora
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}