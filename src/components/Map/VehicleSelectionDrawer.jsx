import { motion, AnimatePresence } from 'framer-motion';
import { Footprints, Bike, Car, BusFront } from 'lucide-react';

const VEHICLES = [
  { id: 'walking', label: 'A piedi', icon: Footprints, color: '#f97316' }, // Brand Orange
  { id: 'cycling', label: 'In bici', icon: Bike, color: '#22c55e' },
  { id: 'driving', label: 'In auto', icon: Car, color: '#3b82f6' },
  { id: 'transit', label: 'Mezzi pubblici', icon: BusFront, color: '#A855F7' } // Colore richiesto
];

export const VehicleSelectionDrawer = ({ isOpen, onSelect, onClose }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
          className="absolute bottom-0 left-0 right-0 z-[1002] bg-white rounded-t-3xl p-6 shadow-2xl"
        >
          <h3 className="text-xl font-bold mb-4 text-center">Come vuoi spostarti?</h3>
          <div className="grid grid-cols-2 gap-3 mb-6">
            {VEHICLES.map((v) => (
              <button
                key={v.id}
                onClick={() => onSelect(v.id)}
                className="flex flex-col items-center justify-center p-4 rounded-2xl border-2 border-gray-100 hover:border-orange-500 hover:bg-orange-50 transition-all active:scale-95"
              >
                <v.icon size={28} style={{ color: v.color }} className="mb-2" />
                <span className="text-sm font-semibold">{v.label}</span>
              </button>
            ))}
          </div>
          <button onClick={onClose} className="w-full py-3 text-gray-500 font-medium hover:bg-gray-50 rounded-xl transition-colors">Annulla</button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
