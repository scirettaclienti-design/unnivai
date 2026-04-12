import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, X, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { dataService } from '@/services/dataService';

export default function ReviewModal({ isOpen, onClose, tourId, guideId, bookingId, guideName, tourTitle }) {
    const [rating, setRating] = useState(0);
    const [hoveredStar, setHoveredStar] = useState(0);
    const [comment, setComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();

    const handleSubmit = async () => {
        if (rating === 0) {
            toast({ title: 'Seleziona un voto', description: 'Clicca sulle stelle per votare.', variant: 'warning' });
            return;
        }

        setIsSubmitting(true);
        try {
            const result = await dataService.createReview({
                tour_id: tourId,
                guide_id: guideId,
                booking_id: bookingId || null,
                rating,
                comment: comment.trim() || null,
            });

            if (!result.success) throw new Error(result.error);

            toast({ title: 'Grazie per la recensione!', description: 'Il tuo feedback aiuta la community.', variant: 'success' });
            onClose();
        } catch (err) {
            toast({
                title: 'Errore',
                description: err.message?.includes('unique') ? 'Hai già recensito questo tour.' : 'Non è stato possibile salvare la recensione.',
                variant: 'error',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4"
                onClick={onClose}
            >
                <motion.div
                    initial={{ y: 100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 100, opacity: 0 }}
                    className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl"
                    onClick={e => e.stopPropagation()}
                >
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xl font-bold text-gray-800" style={{ fontFamily: 'Quicksand, sans-serif' }}>
                            Lascia una recensione
                        </h3>
                        <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100">
                            <X className="w-5 h-5 text-gray-400" />
                        </button>
                    </div>

                    {tourTitle && (
                        <p className="text-sm text-gray-500 mb-1">{tourTitle}</p>
                    )}
                    {guideName && (
                        <p className="text-sm text-gray-500 mb-4">Guida: <span className="font-medium text-gray-700">{guideName}</span></p>
                    )}

                    {/* Stelle */}
                    <div className="flex justify-center gap-2 mb-6">
                        {[1, 2, 3, 4, 5].map(star => (
                            <button
                                key={star}
                                onMouseEnter={() => setHoveredStar(star)}
                                onMouseLeave={() => setHoveredStar(0)}
                                onClick={() => setRating(star)}
                                className="transition-transform hover:scale-110"
                            >
                                <Star
                                    className={`w-10 h-10 transition-colors ${
                                        star <= (hoveredStar || rating)
                                            ? 'fill-orange-400 text-orange-400'
                                            : 'text-gray-300'
                                    }`}
                                />
                            </button>
                        ))}
                    </div>

                    {rating > 0 && (
                        <p className="text-center text-sm text-gray-500 mb-4">
                            {rating === 1 && 'Scarso'}
                            {rating === 2 && 'Sufficiente'}
                            {rating === 3 && 'Buono'}
                            {rating === 4 && 'Ottimo'}
                            {rating === 5 && 'Eccezionale!'}
                        </p>
                    )}

                    {/* Commento */}
                    <textarea
                        value={comment}
                        onChange={e => setComment(e.target.value)}
                        placeholder="Racconta la tua esperienza (opzionale)..."
                        rows={3}
                        maxLength={500}
                        className="w-full p-3 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-orange-300 mb-4"
                    />

                    <button
                        onClick={handleSubmit}
                        disabled={rating === 0 || isSubmitting}
                        className="w-full py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-xl font-bold text-center transition-colors shadow-md flex items-center justify-center gap-2"
                    >
                        {isSubmitting ? (
                            <span className="animate-pulse">Invio...</span>
                        ) : (
                            <>
                                <Send className="w-4 h-4" />
                                Invia Recensione
                            </>
                        )}
                    </button>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
