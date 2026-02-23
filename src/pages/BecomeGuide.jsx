import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Send, CheckCircle, Camera, Award, MapPin, User, Mail, Phone, Calendar } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import TopBar from '@/components/TopBar';
import BottomNavigation from '@/components/BottomNavigation';
import { useUserContext } from '@/hooks/useUserContext';

export default function BecomeGuide() {
    const navigate = useNavigate();
    const { firstName, city } = useUserContext();
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        name: firstName || '',
        surname: '',
        city: city || '',
        email: '',
        phone: '',
        experience: '',
        motivation: '',
        languages: []
    });

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1500));

        setIsSubmitting(false);
        setIsSuccess(true);
        // In a real app, we would send this data to Supabase/Backend
    };

    if (isSuccess) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white font-quicksand flex flex-col items-center justify-center p-6 text-center">
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 200, damping: 20 }}
                    className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6"
                >
                    <CheckCircle className="w-12 h-12 text-green-500" />
                </motion.div>
                <motion.h2
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-3xl font-bold text-gray-800 mb-4"
                >
                    Richiesta Inviata!
                </motion.h2>
                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="text-gray-600 mb-8 max-w-sm"
                >
                    Grazie {formData.name}, il nostro team valuterà la tua candidatura come Local Guide. Ti contatteremo presto!
                </motion.p>
                <Link to="/tour-live">
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="bg-terracotta-500 text-white px-8 py-3 rounded-xl font-bold hover:bg-terracotta-600 transition-colors shadow-lg"
                    >
                        Torna ai Tour
                    </motion.button>
                </Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white font-quicksand">
            <TopBar />

            <main className="max-w-md mx-auto px-4 py-8 pb-24">
                {/* Header with improved navigation */}
                <motion.div
                    className="mb-8"
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <Link to="/tour-live" className="inline-flex items-center space-x-2 text-gray-600 hover:text-terracotta-500 transition-colors mb-4">
                        <ArrowLeft className="w-5 h-5" />
                        <span className="font-medium">Indietro</span>
                    </Link>
                    <h1 className="text-3xl font-bold text-gray-800 mb-2">Diventa una Guida</h1>
                    <p className="text-gray-600">Condividi la tua passione e guadagna mostrando la tua città</p>
                </motion.div>

                {/* Progress Steps */}
                <div className="flex items-center justify-center space-x-4 mb-8">
                    {[1, 2, 3].map((s) => (
                        <div key={s} className="flex items-center">
                            <motion.div
                                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${step >= s ? 'bg-purple-500 text-white' : 'bg-gray-200 text-gray-400'
                                    }`}
                                animate={{ scale: step === s ? 1.1 : 1 }}
                            >
                                {s}
                            </motion.div>
                            {s < 3 && (
                                <div className={`w-8 h-1 mx-2 rounded-full ${step > s ? 'bg-purple-500' : 'bg-gray-200'
                                    }`} />
                            )}
                        </div>
                    ))}
                </div>

                <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-3xl shadow-xl border border-gray-100">
                    <motion.div
                        key={step}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.3 }}
                    >
                        {step === 1 && (
                            <div className="space-y-4">
                                <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                                    <User className="w-5 h-5 mr-2 text-purple-500" />
                                    Chi sei?
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                                        <input
                                            type="text"
                                            name="name"
                                            required
                                            value={formData.name}
                                            onChange={handleInputChange}
                                            className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-purple-400 focus:outline-none"
                                            placeholder="Il tuo nome"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Cognome</label>
                                        <input
                                            type="text"
                                            name="surname"
                                            required
                                            value={formData.surname}
                                            onChange={handleInputChange}
                                            className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-purple-400 focus:outline-none"
                                            placeholder="Il tuo cognome"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Città</label>
                                    <div className="relative">
                                        <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                                        <input
                                            type="text"
                                            name="city"
                                            required
                                            value={formData.city}
                                            onChange={handleInputChange}
                                            className="w-full pl-10 pr-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-purple-400 focus:outline-none"
                                            placeholder="Dove vuoi fare da guida?"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                        <div className="relative">
                                            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                                            <input
                                                type="email"
                                                name="email"
                                                required
                                                value={formData.email}
                                                onChange={handleInputChange}
                                                className="w-full pl-10 pr-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-purple-400 focus:outline-none"
                                                placeholder="La tua email"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {step === 2 && (
                            <div className="space-y-4">
                                <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                                    <Award className="w-5 h-5 mr-2 text-purple-500" />
                                    La tua esperienza
                                </h3>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Perché vuoi diventare una guida?</label>
                                    <textarea
                                        name="motivation"
                                        required
                                        value={formData.motivation}
                                        onChange={handleInputChange}
                                        rows={4}
                                        className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-purple-400 focus:outline-none resize-none"
                                        placeholder="Raccontaci la tua passione per la tua città..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Lingue parlate</label>
                                    <input
                                        type="text"
                                        name="experience" // reusing field for simplicity or add languages
                                        value={formData.experience}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-purple-400 focus:outline-none"
                                        placeholder="Es. Italiano, Inglese, Spagnolo"
                                    />
                                </div>
                            </div>
                        )}

                        {step === 3 && (
                            <div className="space-y-6 text-center">
                                <div className="w-full h-40 bg-purple-50 rounded-2xl flex flex-col items-center justify-center border-2 border-dashed border-purple-200 hover:border-purple-400 transition-colors cursor-pointer group">
                                    <Camera className="w-12 h-12 text-purple-300 group-hover:text-purple-500 transition-colors mb-2" />
                                    <span className="text-sm text-gray-500 font-medium group-hover:text-purple-600">Carica una foto profilo</span>
                                    <input type="file" className="hidden" />
                                </div>

                                <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-100 text-left">
                                    <h4 className="font-bold text-yellow-800 text-sm mb-1">🚀 Perché DoveVai?</h4>
                                    <ul className="text-xs text-yellow-700 space-y-1 list-disc list-inside">
                                        <li>Guadagna condividendo le tue passioni</li>
                                        <li>Flessibilità totale sugli orari</li>
                                        <li>Community di viaggiatori autentici</li>
                                    </ul>
                                </div>

                                <motion.button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all flex items-center justify-center space-x-2 disabled:opacity-70"
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    {isSubmitting ? (
                                        <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            <Send className="w-5 h-5" />
                                            <span>Invia Candidatura</span>
                                        </>
                                    )}
                                </motion.button>
                            </div>
                        )}
                    </motion.div>

                    <div className="flex justify-between pt-4 border-t border-gray-100">
                        {step > 1 ? (
                            <button
                                type="button"
                                onClick={() => setStep(s => s - 1)}
                                className="text-gray-500 font-medium hover:text-gray-800 transition-colors"
                            >
                                Indietro
                            </button>
                        ) : (
                            <div /> // spacer
                        )}

                        {step < 3 && (
                            <motion.button
                                type="button"
                                onClick={() => setStep(s => s + 1)}
                                className="bg-gray-900 text-white px-6 py-2 rounded-xl font-bold hover:bg-black transition-colors"
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                            >
                                Avanti
                            </motion.button>
                        )}
                    </div>
                </form>
            </main>

            <BottomNavigation />
        </div>
    );
}
