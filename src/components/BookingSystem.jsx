/**
 * BookingSystem.jsx
 *
 * DVAI-006: Flusso prenotazione collegato a Stripe Checkout reale.
 *           Il passo "Pagamento" ora avvia la sessione Checkout invece di alert().
 * DVAI-040: Date generate dinamicamente (non più hardcoded gen/feb 2025).
 */
import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Clock, Users, CreditCard, Check, X, ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabase';

// Genera i prossimi N giorni disponibili a partire da domani
const generateAvailableDates = (count = 6) => {
    const dates = [];
    const today = new Date();
    for (let i = 1; i <= count; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        // Salta domenica (0) se si vuole, qui manteniamo tutti i giorni
        dates.push(d.toISOString().split('T')[0]);
    }
    return dates;
};

export default function BookingModal({ tourId, tourTitle, price, guideId, onClose, onConfirm }) {
    const [step, setStep] = useState(1);
    const [bookingData, setBookingData] = useState({ guests: 2, paymentMethod: 'card' });
    const [isCheckingOut, setIsCheckingOut] = useState(false);
    const [checkoutError, setCheckoutError] = useState(null);

    // DVAI-040: date dinamiche, non più hardcoded
    const availableDates = useMemo(() => generateAvailableDates(6), []);
    const availableTimes = ['09:00', '11:00', '14:00', '16:00', '18:00'];

    const totalPrice = price * (bookingData.guests || 1);

    // Step 3: conferma e avvia pagamento Stripe
    const handleConfirm = async () => {
        if (!bookingData.date || !bookingData.time || !bookingData.guests) return;

        setIsCheckingOut(true);
        setCheckoutError(null);

        try {
            const { data: { session } } = await supabase.auth.getSession();

            // Prima crea il booking nel DB via onConfirm (dataService)
            const bookingResult = await onConfirm({
                ...bookingData,
                totalPrice,
            });

            // DVAI-005: gestione errore createBooking
            if (bookingResult && bookingResult.success === false) {
                throw new Error(bookingResult.error ?? 'Errore durante la prenotazione');
            }

            // Se non c'è sessione (guest), chiudi semplicemente
            if (!session) {
                onClose();
                return;
            }

            // DVAI-006: avvia Stripe Checkout per il pagamento
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            const anonKey     = import.meta.env.VITE_SUPABASE_ANON_KEY;

            const res = await fetch(`${supabaseUrl}/functions/v1/create-checkout`, {
                method: 'POST',
                headers: {
                    'Content-Type':  'application/json',
                    'apikey':        anonKey,
                    'Authorization': `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                    bookingId:   bookingResult?.bookingId,  // se il DB ritorna l'id
                    guideId:     guideId ?? null,
                    tourTitle:   tourTitle ?? 'Tour DoveVai',
                    totalAmount: totalPrice,
                }),
            });

            const data = await res.json();

            if (!res.ok || !data.checkoutUrl) {
                // Non bloccare l'utente se il pagamento fallisce: la prenotazione è già registrata
                console.warn('[BookingSystem] Checkout non avviato:', data.error);
                setCheckoutError('Prenotazione salvata! Il link di pagamento non è disponibile al momento. Controlla le notifiche.');
                return;
            }

            onClose();
            window.open(data.checkoutUrl, '_blank', 'noopener,noreferrer');

        } catch (err) {
            console.error('[BookingSystem] Errore:', err.message);
            setCheckoutError(err.message ?? 'Errore imprevisto. Riprova.');
        } finally {
            setIsCheckingOut(false);
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
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Progress */}
                    <div className="flex items-center mb-6">
                        {[1, 2, 3].map((s) => (
                            <div key={s} className="flex items-center">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${s <= step ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-600'}`}>
                                    {s < step ? <Check className="w-4 h-4" /> : s}
                                </div>
                                {s < 3 && <div className={`w-8 h-1 ${s < step ? 'bg-orange-500' : 'bg-gray-200'}`} />}
                            </div>
                        ))}
                    </div>

                    {/* Content */}
                    <div className="space-y-6">
                        {step === 1 && (
                            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                                <h3 className="font-bold text-gray-800 mb-4">Seleziona Data e Ora</h3>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Data</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {availableDates.map((date) => (
                                            <button
                                                key={date}
                                                onClick={() => setBookingData({ ...bookingData, date })}
                                                className={`p-3 text-sm rounded-xl border transition-all ${bookingData.date === date
                                                    ? 'bg-orange-500 text-white border-orange-500'
                                                    : 'bg-white text-gray-700 border-gray-200 hover:border-orange-300'}`}
                                            >
                                                {new Date(date + 'T12:00:00').toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}
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
                                                onClick={() => setBookingData({ ...bookingData, time })}
                                                className={`p-3 text-sm rounded-xl border transition-all ${bookingData.time === time
                                                    ? 'bg-orange-500 text-white border-orange-500'
                                                    : 'bg-white text-gray-700 border-gray-200 hover:border-orange-300'}`}
                                            >
                                                {time}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {step === 2 && (
                            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                                <h3 className="font-bold text-gray-800 mb-4">Numero Partecipanti</h3>

                                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                                    <span className="font-medium">Ospiti</span>
                                    <div className="flex items-center space-x-4">
                                        <button
                                            onClick={() => setBookingData({ ...bookingData, guests: Math.max(1, (bookingData.guests || 1) - 1) })}
                                            className="w-8 h-8 bg-white rounded-lg border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100"
                                        >-</button>
                                        <span className="font-bold text-lg w-8 text-center">{bookingData.guests}</span>
                                        <button
                                            onClick={() => setBookingData({ ...bookingData, guests: Math.min(12, (bookingData.guests || 1) + 1) })}
                                            className="w-8 h-8 bg-white rounded-lg border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100"
                                        >+</button>
                                    </div>
                                </div>

                                <div className="bg-orange-50 p-4 rounded-xl">
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-700">Prezzo per persona:</span>
                                        <span className="font-bold">€{price}</span>
                                    </div>
                                    <div className="flex justify-between items-center mt-2 text-lg">
                                        <span className="font-bold text-gray-800">Totale:</span>
                                        <span className="font-bold text-orange-600">€{totalPrice}</span>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {step === 3 && (
                            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                                <h3 className="font-bold text-gray-800 mb-4">Riepilogo e Pagamento</h3>

                                <div className="space-y-3 p-4 bg-gray-50 rounded-xl">
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Tour:</span>
                                        <span className="font-medium">{tourTitle}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Data:</span>
                                        <span className="font-medium">
                                            {bookingData.date && new Date(bookingData.date + 'T12:00:00').toLocaleDateString('it-IT')}
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
                                        <span className="text-orange-600">€{totalPrice}</span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-xl text-sm text-blue-700">
                                    <CreditCard className="w-5 h-5 flex-shrink-0" />
                                    <span>Verrai reindirizzato a <strong>Stripe</strong> per completare il pagamento in sicurezza.</span>
                                </div>

                                {checkoutError && (
                                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                                        {checkoutError}
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex space-x-3 mt-6">
                        {step > 1 && (
                            <button
                                onClick={() => setStep(step - 1)}
                                disabled={isCheckingOut}
                                className="flex-1 py-3 px-4 bg-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-300 transition-colors disabled:opacity-50"
                            >
                                Indietro
                            </button>
                        )}
                        <button
                            onClick={() => step < 3 ? setStep(step + 1) : handleConfirm()}
                            disabled={
                                isCheckingOut ||
                                (step === 1 && (!bookingData.date || !bookingData.time)) ||
                                (step === 2 && !bookingData.guests)
                            }
                            className="flex-1 py-3 px-4 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isCheckingOut ? (
                                <>
                                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    Avvio pagamento...
                                </>
                            ) : step < 3 ? 'Continua' : (
                                <>
                                    Paga con Stripe
                                    <ExternalLink className="w-4 h-4" />
                                </>
                            )}
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
