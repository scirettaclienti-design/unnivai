import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { Calendar, Clock, Users, CreditCard, Check, X, MapPin, Star, Euro } from "lucide-react";

interface BookingProps {
  tourId: string;
  tourTitle: string;
  price: number;
  onClose: () => void;
  onConfirm: (booking: BookingData) => void;
}

interface BookingData {
  date: string;
  time: string;
  guests: number;
  totalPrice: number;
  paymentMethod: string;
}

export function BookingModal({ tourId, tourTitle, price, onClose, onConfirm }: BookingProps) {
  const [step, setStep] = useState(1);
  const [bookingData, setBookingData] = useState<Partial<BookingData>>({
    guests: 2,
    paymentMethod: 'card'
  });

  const availableDates = [
    '2025-01-29', '2025-01-30', '2025-01-31', 
    '2025-02-01', '2025-02-02', '2025-02-03'
  ];
  
  const availableTimes = ['09:00', '11:00', '14:00', '16:00', '18:00'];

  const handleConfirm = () => {
    if (bookingData.date && bookingData.time && bookingData.guests) {
      onConfirm({
        ...bookingData,
        totalPrice: price * bookingData.guests
      } as BookingData);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="bg-white rounded-3xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto"
          initial={{ scale: 0.8, y: 50 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.8, y: 50 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-800">Prenota Tour</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Progress */}
          <div className="flex items-center mb-6">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  s <= step ? 'bg-terracotta-500 text-white' : 'bg-gray-200 text-gray-600'
                }`}>
                  {s < step ? <Check className="w-4 h-4" /> : s}
                </div>
                {s < 3 && <div className={`w-8 h-1 ${s < step ? 'bg-terracotta-500' : 'bg-gray-200'}`} />}
              </div>
            ))}
          </div>

          {/* Content */}
          <div className="space-y-6">
            {step === 1 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-4"
              >
                <h3 className="font-bold text-gray-800 mb-4">Seleziona Data e Ora</h3>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Data</label>
                  <div className="grid grid-cols-3 gap-2">
                    {availableDates.map((date) => (
                      <button
                        key={date}
                        onClick={() => setBookingData({...bookingData, date})}
                        className={`p-3 text-sm rounded-xl border transition-all ${
                          bookingData.date === date
                            ? 'bg-terracotta-500 text-white border-terracotta-500'
                            : 'bg-white text-gray-700 border-gray-200 hover:border-terracotta-300'
                        }`}
                      >
                        {new Date(date).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Orario</label>
                  <div className="grid grid-cols-3 gap-2">
                    {availableTimes.map((time) => (
                      <button
                        key={time}
                        onClick={() => setBookingData({...bookingData, time})}
                        className={`p-3 text-sm rounded-xl border transition-all ${
                          bookingData.time === time
                            ? 'bg-terracotta-500 text-white border-terracotta-500'
                            : 'bg-white text-gray-700 border-gray-200 hover:border-terracotta-300'
                        }`}
                      >
                        {time}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-4"
              >
                <h3 className="font-bold text-gray-800 mb-4">Numero Partecipanti</h3>
                
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <span className="font-medium">Ospiti</span>
                  <div className="flex items-center space-x-4">
                    <button
                      onClick={() => setBookingData({...bookingData, guests: Math.max(1, (bookingData.guests || 1) - 1)})}
                      className="w-8 h-8 bg-white rounded-lg border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100"
                    >
                      -
                    </button>
                    <span className="font-bold text-lg w-8 text-center">{bookingData.guests}</span>
                    <button
                      onClick={() => setBookingData({...bookingData, guests: Math.min(12, (bookingData.guests || 1) + 1)})}
                      className="w-8 h-8 bg-white rounded-lg border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="bg-terracotta-50 p-4 rounded-xl">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700">Prezzo per persona:</span>
                    <span className="font-bold">€{price}</span>
                  </div>
                  <div className="flex justify-between items-center mt-2 text-lg">
                    <span className="font-bold text-gray-800">Totale:</span>
                    <span className="font-bold text-terracotta-600">€{(bookingData.guests || 1) * price}</span>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-4"
              >
                <h3 className="font-bold text-gray-800 mb-4">Riepilogo Prenotazione</h3>
                
                <div className="space-y-3 p-4 bg-gray-50 rounded-xl">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tour:</span>
                    <span className="font-medium">{tourTitle}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Data:</span>
                    <span className="font-medium">
                      {bookingData.date && new Date(bookingData.date).toLocaleDateString('it-IT')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Orario:</span>
                    <span className="font-medium">{bookingData.time}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Partecipanti:</span>
                    <span className="font-medium">{bookingData.guests}</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between text-lg font-bold">
                    <span>Totale:</span>
                    <span className="text-terracotta-600">€{(bookingData.guests || 1) * price}</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-700">Metodo di Pagamento</label>
                  <div className="space-y-2">
                    {['card', 'paypal', 'apple'].map((method) => (
                      <button
                        key={method}
                        onClick={() => setBookingData({...bookingData, paymentMethod: method})}
                        className={`w-full p-3 rounded-xl border flex items-center space-x-3 transition-all ${
                          bookingData.paymentMethod === method
                            ? 'bg-terracotta-50 border-terracotta-500'
                            : 'bg-white border-gray-200 hover:border-terracotta-300'
                        }`}
                      >
                        <CreditCard className="w-5 h-5" />
                        <span>{method === 'card' ? 'Carta di Credito' : method === 'paypal' ? 'PayPal' : 'Apple Pay'}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {/* Actions */}
          <div className="flex space-x-3 mt-6">
            {step > 1 && (
              <button
                onClick={() => setStep(step - 1)}
                className="flex-1 py-3 px-4 bg-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-300 transition-colors"
              >
                Indietro
              </button>
            )}
            <button
              onClick={() => step < 3 ? setStep(step + 1) : handleConfirm()}
              disabled={
                (step === 1 && (!bookingData.date || !bookingData.time)) ||
                (step === 2 && !bookingData.guests)
              }
              className="flex-1 py-3 px-4 bg-terracotta-500 text-white rounded-xl font-medium hover:bg-terracotta-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {step < 3 ? 'Continua' : 'Conferma Prenotazione'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default BookingModal;