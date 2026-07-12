import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, MapPin, Clock, Star, Play, Users, Camera, Utensils, Heart, Eye, Zap, Calendar, Gift } from "lucide-react";
import { Link } from "react-router-dom";
import TopBar from "../components/TopBar";
import BottomNavigation from "../components/BottomNavigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { dataService } from "../services/dataService";
import { supabase } from "../lib/supabase";

// Gate J2: liveToursMock RIMOSSO. Prima serviva 3 tour finti (Maria Benedetti a
// Roma €18 4.8★, Giuseppe Torrisi a Palermo €22 4.9★, Andrea Morosini a Venezia
// €25 4.7★) con foto Unsplash come fallback quando il DB non aveva tour per
// la città corrente. Meglio empty state onesto ("Nessun tour live oggi") che
// tour inventati con guide inesistenti (Maria Benedetti era già uccisa in
// Gate D-1 tourDetailsMock, era rientrata qui).

import { useUserContext } from "@/hooks/useUserContext";

export default function TourLivePage() {
    // 1. Consume Context
    const { city: currentCity } = useUserContext();

    // Determine which icons to use based on category string
    const getCategoryIcon = (category) => {
        switch (category) {
            case 'food': return Utensils;
            case 'culture': return Camera;
            case 'adventure': return Eye;
            default: return Star;
        }
    };

    const queryClient = useQueryClient();

    // Realtime Live Status Updates
    useEffect(() => {
        // Subscribe to live updates
        const channel = dataService.subscribeToLiveTours(() => {
            // Update the specific query for the current city
            queryClient.invalidateQueries({ queryKey: ['tours', currentCity] });
        });

        return () => {
            if (channel) supabase.removeChannel(channel);
        };
    }, [queryClient, currentCity]);

    const { data: rawTours } = useQuery({
        // 2. Dependency on currentCity
        queryKey: ['tours', currentCity],
        queryFn: async () => {
            // 3. Dynamic Fetch
            const tours = await dataService.getToursByCity(currentCity);

            // 4. Fallback Validation
            // If DB returns data, use it.
            // If empty (e.g. no tours in Milan), we might fallback to mock options 
            // BUT we should ideally filter mock options by city if we had a large mock DB.
            // For MVP: If 'Roma' (default) => use mock if needed.
            // If other city => if empty, show nothing or generic "coming soon" (handled by UI state typically, 
            // but here we just return empty array or generic mocks adapted).
            // Let's keep strict behavior: If DB yields nothing, return empty or fallback subset.
            // Current Mock Data is hardcoded for Roma/Palermo/Venezia.

            // Gate J2: nessun fallback liveToursMock. Se il DB non ha tour per
            // la città, la lista resta vuota e la UI mostra empty state onesto.
            return tours || [];
        },
        initialData: [], // Start empty, let query resolve
        staleTime: 60 * 1000 * 5
    });

    // Ensure we map icons back to the object for UI consistency
    const liveTours = rawTours.map(tour => ({
        ...tour,
        // Map dataService properties to this page's specific needs if they differ,
        // or ensure defaults. dataService returns standard UI object.
        // We need to re-attach the icon component which is not serializable from DB/Service
        categoryIcon: getCategoryIcon(tour.category || tour.type),
        // Ensure image property matches (dataService uses imageUrl, this page uses image)
        image: tour.imageUrl || tour.image
    }));
    return (
        <div className="min-h-screen bg-gradient-to-b from-ochre-100 to-ochre-200 font-quicksand">
            <TopBar />

            <main className="max-w-md mx-auto px-4 py-8 pb-24">
                {/* Interactive Header */}
                <motion.div
                    className="mb-8"
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                >
                    <div className="flex items-center mb-6">
                        <Link to="/dashboard-user">
                            <motion.button
                                className="p-2 rounded-full bg-white/60 backdrop-blur-sm mr-4 hover:bg-white/80 transition-colors"
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                            >
                                <ArrowLeft className="w-5 h-5 text-gray-700" />
                            </motion.button>
                        </Link>
                        <div className="flex-1">
                            <div className="flex items-center space-x-3">
                                <motion.div
                                    className="text-4xl"
                                    whileHover={{ scale: 1.2, rotate: 10 }}
                                    transition={{ type: "spring", stiffness: 300 }}
                                >
                                    🎯
                                </motion.div>
                                <div>
                                    <h1 className="text-2xl font-bold text-gray-800">Tour Live</h1>
                                    <p className="text-gray-600 text-sm">Esperienze autentiche in diretta</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Live Status Banner */}
                    <motion.div
                        className="bg-gradient-to-r from-red-400 to-pink-400 rounded-2xl p-4 mb-6 text-white relative overflow-hidden"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.8 }}
                    >
                        <motion.div
                            className="absolute inset-0 bg-white/10 rounded-2xl"
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ duration: 1, delay: 0.3 }}
                        />
                        <div className="relative flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                                <motion.div
                                    className="w-3 h-3 bg-white rounded-full"
                                    animate={{ scale: [1, 1.2, 1] }}
                                    transition={{ duration: 1, repeat: Infinity }}
                                />
                                <div>
                                    <h3 className="font-bold">🔴 LIVE ORA</h3>
                                    <p className="text-sm opacity-90">2 tour attivi in questo momento</p>
                                </div>
                            </div>
                            <motion.div
                                className="text-3xl"
                                whileHover={{ scale: 1.3, rotate: 15 }}
                            >
                                📺
                            </motion.div>
                        </div>
                    </motion.div>
                </motion.div>

                {/* Interactive Tour Cards */}
                <div className="space-y-8">
                    {
                        liveTours.map((tour, index) => (
                            <motion.div
                                key={tour.id}
                                className="bg-gradient-to-br from-white/90 to-white/70 backdrop-blur-sm rounded-3xl overflow-hidden shadow-xl border border-white/30 relative"
                                initial={{ opacity: 0, rotateY: -90 }}
                                animate={{ opacity: 1, rotateY: 0 }}
                                transition={{ duration: 0.8, delay: index * 0.2, type: "spring" }}
                                whileHover={{ scale: 1.02, rotateY: 5 }}
                            >
                                {/* Live Indicator */}
                                {tour.live && (
                                    <motion.div
                                        className="absolute top-4 left-4 z-10 bg-red-500 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center space-x-1"
                                        animate={{ scale: [1, 1.1, 1] }}
                                        transition={{ duration: 2, repeat: Infinity }}
                                    >
                                        <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                                        <span>LIVE</span>
                                    </motion.div>
                                )}

                                <div className="relative">
                                    <motion.img
                                        src={tour.image}
                                        alt={tour.title}
                                        className="w-full h-64 object-cover"
                                        whileHover={{ scale: 1.05 }}
                                        transition={{ duration: 0.6 }}
                                    />

                                    {/* Price Badge */}
                                    <motion.div
                                        className="absolute top-4 right-4 bg-gradient-to-r from-terracotta-400 to-terracotta-500 text-white px-4 py-2 rounded-2xl shadow-lg"
                                        whileHover={{ scale: 1.1, rotateZ: 5 }}
                                    >
                                        <div className="text-center">
                                            <div className="text-lg font-bold">{tour.price}€</div>
                                            {tour.originalPrice && (
                                                <div className="text-xs line-through opacity-70">{tour.originalPrice}€</div>
                                            )}
                                        </div>
                                    </motion.div>

                                    {/* Category Icon */}
                                    <motion.div
                                        className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm p-3 rounded-2xl shadow-lg"
                                        whileHover={{ scale: 1.2, rotate: 15 }}
                                        transition={{ type: "spring", stiffness: 300 }}
                                    >
                                        <tour.categoryIcon className="w-6 h-6 text-terracotta-400" />
                                    </motion.div>
                                </div>

                                <div className="p-8">
                                    {/* Title and Status */}
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex-1">
                                            <h3 className="text-xl font-bold text-gray-800 mb-2">{tour.title}</h3>
                                            <p className="text-gray-600 leading-relaxed">{tour.description}</p>
                                        </div>
                                        <motion.div
                                            className="text-4xl ml-4"
                                            whileHover={{ scale: 1.3, rotate: 15 }}
                                            transition={{ type: "spring", stiffness: 400 }}
                                        >
                                            {tour.category === 'food' ? '🍝' :
                                                tour.category === 'culture' ? '🎨' :
                                                    tour.category === 'adventure' ? '🗺️' : '✨'}
                                        </motion.div>
                                    </div>

                                    {/* Guide Info */}
                                    <motion.div
                                        className="bg-gradient-to-r from-terracotta-100 to-ochre-100 rounded-2xl p-4 mb-6"
                                        whileHover={{ scale: 1.02 }}
                                    >
                                        <div className="flex items-center space-x-3">
                                            <motion.div
                                                className="text-3xl"
                                                whileHover={{ scale: 1.2, rotate: 10 }}
                                            >
                                                {tour.guideAvatar}
                                            </motion.div>
                                            <div className="flex-1">
                                                <h4 className="font-bold text-gray-800">La tua guida: {tour.guide}</h4>
                                                <div className="flex items-center space-x-4 mt-1">
                                                    <div className="flex items-center">
                                                        <Star className="w-4 h-4 text-yellow-400 fill-current mr-1" />
                                                        <span className="text-sm font-medium">{tour.rating}</span>
                                                        <span className="text-xs text-gray-500 ml-1">({tour.reviews})</span>
                                                    </div>
                                                    <div className="text-xs text-gray-500">
                                                        💬 {tour.reviews} recensioni
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>

                                    {/* Highlights */}
                                    <div className="mb-6">
                                        <h4 className="font-bold text-gray-800 mb-3">Cosa ti aspetta:</h4>
                                        <div className="flex flex-wrap gap-2">
                                            {tour.highlights.map((highlight, hidx) => (
                                                <motion.span
                                                    key={hidx}
                                                    className="bg-gradient-to-r from-terracotta-200 to-ochre-200 px-3 py-2 rounded-full text-sm font-medium text-gray-700"
                                                    initial={{ opacity: 0, scale: 0.8 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    transition={{ duration: 0.6, delay: index * 0.2 + hidx * 0.1 }}
                                                    whileHover={{ scale: 1.1 }}
                                                >
                                                    {highlight}
                                                </motion.span>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Tour Details */}
                                    <div className="grid grid-cols-2 gap-4 mb-6">
                                        <motion.div
                                            className="bg-white/50 rounded-xl p-3 flex items-center space-x-2"
                                            whileHover={{ scale: 1.05 }}
                                        >
                                            <MapPin className="w-5 h-5 text-terracotta-400" />
                                            <div>
                                                <div className="text-xs text-gray-500">Dove</div>
                                                <div className="text-sm font-medium">{tour.location}</div>
                                            </div>
                                        </motion.div>

                                        <motion.div
                                            className="bg-white/50 rounded-xl p-3 flex items-center space-x-2"
                                            whileHover={{ scale: 1.05 }}
                                        >
                                            <Clock className="w-5 h-5 text-terracotta-400" />
                                            <div>
                                                <div className="text-xs text-gray-500">Durata</div>
                                                <div className="text-sm font-medium">{tour.duration}</div>
                                            </div>
                                        </motion.div>

                                        <motion.div
                                            className="bg-white/50 rounded-xl p-3 flex items-center space-x-2"
                                            whileHover={{ scale: 1.05 }}
                                        >
                                            <Users className="w-5 h-5 text-terracotta-400" />
                                            <div>
                                                <div className="text-xs text-gray-500">Partecipanti</div>
                                                <div className="text-sm font-medium">{tour.participants}/{tour.maxParticipants}</div>
                                            </div>
                                        </motion.div>

                                        <motion.div
                                            className="bg-white/50 rounded-xl p-3 flex items-center space-x-2"
                                            whileHover={{ scale: 1.05 }}
                                        >
                                            <Calendar className="w-5 h-5 text-terracotta-400" />
                                            <div>
                                                <div className="text-xs text-gray-500">Inizio</div>
                                                <div className="text-sm font-medium">{tour.nextStart}</div>
                                            </div>
                                        </motion.div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex space-x-3">
                                        <Link to="/map" state={{ focusedActivity: tour }}>
                                            <motion.button
                                                className="bg-white text-terracotta-500 border-2 border-terracotta-400 p-4 rounded-2xl shadow-lg hover:bg-terracotta-50 transition-all duration-300 h-full flex items-center justify-center"
                                                whileHover={{ scale: 1.1, rotate: -5 }}
                                                whileTap={{ scale: 0.9 }}
                                            >
                                                <MapPin className="w-6 h-6" />
                                            </motion.button>
                                        </Link>
                                        <Link to={`/tour-details/${tour.id}`} className="flex-1">
                                            {tour.live ? (
                                                <motion.button
                                                    className="w-full bg-gradient-to-r from-red-400 to-red-500 text-white py-4 rounded-2xl font-bold text-lg shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center space-x-2"
                                                    whileHover={{ scale: 1.05, rotateX: 5 }}
                                                    whileTap={{ scale: 0.95 }}
                                                >
                                                    <Play className="w-6 h-6" />
                                                    <span>🔴 Scopri</span>
                                                </motion.button>
                                            ) : (
                                                <motion.button
                                                    className="w-full bg-gradient-to-r from-terracotta-400 to-terracotta-500 text-white py-4 rounded-2xl font-bold text-lg shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center space-x-2"
                                                    whileHover={{ scale: 1.05, rotateX: 5 }}
                                                    whileTap={{ scale: 0.95 }}
                                                >
                                                    <Calendar className="w-6 h-6" />
                                                    <span>📅 Prenota</span>
                                                </motion.button>
                                            )}
                                        </Link>

                                        <motion.button
                                            className="bg-gradient-to-r from-olive-400 to-olive-500 text-white p-4 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300"
                                            whileHover={{ scale: 1.1, rotate: 15 }}
                                            whileTap={{ scale: 0.9 }}
                                            onClick={() => dataService.toggleFavorite(tour.id)}
                                        >
                                            <Heart className="w-6 h-6" />
                                        </motion.button>
                                    </div>
                                </div>
                            </motion.div>
                        ))
                    }
                </div>

                {/* Interactive Action Center */}
                <motion.div
                    className="mt-12 space-y-6"
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 1 }}
                >
                    {/* Quick Actions */}
                    <div className="grid grid-cols-2 gap-4">
                        <Link to="/explore">
                            <motion.button
                                className="w-full bg-gradient-to-r from-olive-400 to-olive-500 text-white p-6 rounded-3xl shadow-lg hover:shadow-xl transition-all duration-300 flex flex-col items-center space-y-2"
                                whileHover={{ scale: 1.05, rotateX: 5 }}
                                whileTap={{ scale: 0.95 }}
                                initial={{ rotateY: -90 }}
                                animate={{ rotateY: 0 }}
                                transition={{ duration: 0.8, delay: 1.2 }}
                            >
                                <motion.div
                                    whileHover={{ rotate: 15, scale: 1.2 }}
                                    transition={{ type: "spring", stiffness: 300 }}
                                >
                                    <Zap className="w-8 h-8" />
                                </motion.div>
                                <span className="font-bold">🚀 Esplora tutto</span>
                            </motion.button>
                        </Link>

                        <Link to="/ai-itinerary">
                            <motion.button
                                className="w-full bg-gradient-to-r from-terracotta-400 to-terracotta-500 text-white p-6 rounded-3xl shadow-lg hover:shadow-xl transition-all duration-300 flex flex-col items-center space-y-2"
                                whileHover={{ scale: 1.05, rotateX: -5 }}
                                whileTap={{ scale: 0.95 }}
                                initial={{ rotateY: 90 }}
                                animate={{ rotateY: 0 }}
                                transition={{ duration: 0.8, delay: 1.4 }}
                            >
                                <motion.div
                                    whileHover={{ y: -3, scale: 1.2 }}
                                    transition={{ type: "spring", stiffness: 300 }}
                                >
                                    <Gift className="w-8 h-8" />
                                </motion.div>
                                <span className="font-bold">🎁 Sorprendimi</span>
                            </motion.button>
                        </Link>
                    </div>

                    {/* Gate J1: CTA "Diventa guida" rimossa. Il signup guida
                        è disattivato in V1 (dashboard guide con analytics finte
                        muore con Gate J1). Riappare in V2. */}
                </motion.div>
            </main>

            <BottomNavigation />
        </div>
    );
}
