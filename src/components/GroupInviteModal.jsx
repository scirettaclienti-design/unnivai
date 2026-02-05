import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, MapPin, Users, Check } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function GroupInviteModal({ isOpen, onClose, inviteData }) {
    if (!isOpen || !inviteData) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                    />

                    {/* Modal Card */}
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        className="relative w-full max-w-sm bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden border border-white/50"
                    >
                        {/* Decorative Header Background */}
                        <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-br from-purple-500 to-indigo-600 opacity-90" />

                        {/* Close Button */}
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/40 rounded-full text-white transition-colors z-10"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="relative px-6 pt-20 pb-8 flex flex-col items-center">
                            {/* Avatar Group */}
                            <div className="relative mb-4">
                                <div className="w-24 h-24 rounded-full border-4 border-white shadow-xl overflow-hidden relative z-10">
                                    <img
                                        src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop"
                                        alt="Sofia"
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                <div className="absolute -bottom-2 -right-2 bg-white rounded-full p-1.5 shadow-md z-20">
                                    <div className="bg-purple-100 rounded-full p-1">
                                        <Users className="w-4 h-4 text-purple-600" />
                                    </div>
                                </div>
                            </div>

                            {/* Title & Message */}
                            <h2 className="text-2xl font-bold text-gray-800 text-center mb-1">
                                {inviteData.sender || 'Sofia'} ti ha invitato!
                            </h2>
                            <p className="text-gray-500 text-center text-sm mb-6 px-4">
                                Vuole esplorare con te in questo tour di gruppo.
                            </p>

                            {/* Tour Card Sneak Peek */}
                            <div className="w-full bg-white/60 rounded-2xl p-3 mb-8 border border-white/50 shadow-sm">
                                <div className="flex gap-3">
                                    <img
                                        src={inviteData.image}
                                        alt="Tour"
                                        className="w-20 h-20 rounded-xl object-cover"
                                    />
                                    <div className="flex-1">
                                        <h3 className="font-bold text-gray-800 text-sm mb-1 line-clamp-2">
                                            {inviteData.title?.replace('Invito Tour di Gruppo', 'Walking Tour Centro Storico')}
                                        </h3>
                                        <div className="flex items-center text-xs text-gray-500 mb-1">
                                            <Calendar className="w-3 h-3 mr-1" />
                                            <span>15 Febbraio • 10:00</span>
                                        </div>
                                        <div className="flex items-center text-xs text-gray-500">
                                            <MapPin className="w-3 h-3 mr-1" />
                                            <span>{inviteData.location}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="w-full flex gap-3">
                                <button
                                    onClick={onClose}
                                    className="flex-1 py-3 px-4 rounded-xl text-sm font-bold text-gray-500 hover:bg-gray-100 transition-colors"
                                >
                                    Non ora
                                </button>
                                <Link
                                    to="/tour-details/3"
                                    onClick={onClose}
                                    className="flex-1 py-3 px-4 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-purple-500 to-indigo-600 shadow-lg shadow-purple-500/30 flex items-center justify-center gap-2 hover:scale-105 transition-transform"
                                >
                                    <Check className="w-4 h-4" />
                                    Accetta
                                </Link>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
