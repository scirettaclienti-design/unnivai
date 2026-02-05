import { motion } from 'framer-motion';
import { MapPin, Clock, Star, Users, Sparkles, Map } from 'lucide-react';
import { useUserContext } from '@/hooks/useUserContext';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function PersonalizedWelcome() {
    // 🎯 Unify Data Source: Use Context for Real Data (GPS + Weather)
    const {
        firstName,
        city: currentCity,
        temperatureC
    } = useUserContext();

    const [showTours, setShowTours] = useState(false);
    const navigate = useNavigate();

    // 🎯 Use Real Data
    const username = firstName || 'Utente';
    // Format temperature nicely
    const currentTemp = temperatureC ? `${temperatureC}°C` : '--';

    // Tour personalizzati per Catania (con COORDINATE per la Mappa)
    const personalizedTours = [
        {
            id: '1',
            title: 'Etna Sunrise',
            description: 'Alba sul vulcano attivo più famoso d\'Europa',
            duration: '4 ore',
            price: 75,
            difficulty: 'medio',
            type: 'nature',
            highlights: ['Alba spettacolare', 'Guide vulcanologiche', 'Breakfast tipico'],
            startPoint: 'Rifugio Sapienza',
            imageUrl: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96',
            rating: 4.8,
            estimatedTime: 240,
            // Standard Waypoints (Lat, Lng)
            waypoints: [
                [37.7047, 14.9989], // Start
                [37.7121, 14.9950],
                [37.7210, 14.9890],
                [37.7510, 14.9934] // Summit area
            ]
        },
        {
            id: '2',
            title: 'Catania Street Food',
            description: 'Sapori autentici siciliani nei mercati storici',
            duration: '3 ore',
            price: 45,
            difficulty: 'facile',
            type: 'food',
            highlights: ['Arancini originali', 'Pescheria storica', 'Cannoli freschi'],
            startPoint: 'La Pescheria',
            imageUrl: 'https://images.unsplash.com/photo-1551218808-94e220e084d2',
            rating: 4.9,
            estimatedTime: 180,
            waypoints: [
                [37.5022, 15.0870], // Pescheria
                [37.5035, 15.0860],
                [37.5050, 15.0840], // Piazza Duomo
                [37.5080, 15.0830]
            ]
        },
        {
            id: '3',
            title: 'Teatro Romano',
            description: 'Storia antica nel cuore della città',
            duration: '2 ore',
            price: 25,
            difficulty: 'facile',
            type: 'culture',
            highlights: ['Teatro del II secolo', 'Odeon romano', 'Centro storico'],
            startPoint: 'Via Vittorio Emanuele',
            imageUrl: 'https://images.unsplash.com/photo-1539650116574-75c0c6d05be0',
            rating: 4.6,
            estimatedTime: 120,
            waypoints: [
                [37.5027, 15.0845], // Teatro Romano
                [37.5030, 15.0850],
                [37.5040, 15.0880]
            ]
        }
    ];

    const getDifficultyColor = (difficulty) => {
        switch (difficulty) {
            case 'facile': return 'bg-green-100 text-green-700';
            case 'medio': return 'bg-yellow-100 text-yellow-700';
            case 'difficile': return 'bg-red-100 text-red-700';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    const getTypeIcon = (type) => {
        switch (type) {
            case 'walking': return '🚶‍♂️';
            case 'food': return '🍕';
            case 'culture': return '🏛️';
            case 'shopping': return '🛍️';
            case 'nature': return '🌋';
            default: return '📍';
        }
    };

    // 🗺️ NAVIGATION HANDLER
    const handleTourClick = (tour) => {
        // Construct Standard Object
        const tourPayload = {
            id: tour.id,
            title: tour.title,
            waypoints: tour.waypoints || [], // Ensure waypoints exist
            mode: 'tour',
            price: tour.price,
            duration: tour.duration,
            description: tour.description,
            type: tour.type,
            difficulty: tour.difficulty,
            imageUrl: tour.imageUrl,
            rating: tour.rating
        };

        console.log('🗺️ Navigating to Tour Details with payload:', tourPayload);

        // Navigate to Unified Tour Details Page
        navigate(`/tour-details/${tour.id}`, {
            state: {
                tourData: tourPayload
            }
        });
    };

    return (
        <motion.div
            className="mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
        >
            {/* 🎯 Pulsante Tour Personalizzati (Pill Style) */}
            <motion.div
                className="flex justify-center mb-6"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
            >
                <button
                    onClick={() => setShowTours(!showTours)}
                    className="w-full bg-white/90 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/50 text-left transition-all hover:shadow-xl active:scale-95 group relative overflow-hidden"
                    data-testid="button-personalized-tours"
                >
                    <div className="absolute inset-0 bg-gradient-to-r from-terracotta-50 to-white opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="relative z-10 flex items-center justify-between">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-800 font-playfair mb-1">
                                Ciao, {username}!
                            </h2>
                            <p className="text-terracotta-600 font-medium flex items-center">
                                <Sparkles className="w-4 h-4 mr-1" />
                                Il tuo tour personalizzato è pronto
                            </p>
                        </div>
                        <div className="bg-terracotta-100 p-3 rounded-full group-hover:bg-terracotta-200 transition-colors">
                            <Map className={`w-6 h-6 text-terracotta-600 transition-transform duration-300 ${showTours ? 'rotate-180' : ''}`} />
                        </div>
                    </div>
                </button>
            </motion.div>


            {/* 🎯 Lista Tour Personalizzati */}
            {showTours && (
                <motion.div
                    className="space-y-4"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    transition={{ duration: 0.5 }}
                >
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">I Tuoi Tour a {currentCity}</h3>
                    {personalizedTours.map((tour, index) => (
                        <motion.div
                            key={tour.id}
                            className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200 cursor-pointer"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 + index * 0.1 }}
                            data-testid={`card-tour-${tour.id}`}
                            onClick={() => handleTourClick(tour)} // Click on card navigates to Map!
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center space-x-2 mb-2">
                                        <span className="text-lg">{getTypeIcon(tour.type)}</span>
                                        <h4 className="font-semibold text-gray-900">{tour.title}</h4>
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(tour.difficulty)}`}>
                                            {tour.difficulty}
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-600 mb-2">{tour.description}</p>
                                    <div className="flex items-center space-x-4 text-xs text-gray-500">
                                        <div className="flex items-center space-x-1">
                                            <Clock className="w-3 h-3" />
                                            <span>{tour.duration}</span>
                                        </div>
                                        <div className="flex items-center space-x-1">
                                            <Star className="w-3 h-3 text-yellow-500 fill-current" />
                                            <span>{tour.rating}</span>
                                        </div>
                                        <div className="flex items-center space-x-1">
                                            <Users className="w-3 h-3" />
                                            <span>{tour.startPoint}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end space-y-2 relative">
                                    <button
                                        className="absolute -top-12 right-0 p-2 bg-white/80 rounded-full shadow-sm hover:bg-white text-gray-400 hover:text-red-500 transition-colors"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            // Toggle favorite logic here
                                        }}
                                    >
                                        <Star className="w-5 h-5" /> {/* Using Star as placeholder for Heart/Favorite if Heart not imported, or change to Heart if available. Heart is not imported in this file. I will use Star or import Heart. Let's check imports. Star is imported. */}
                                    </button>

                                    <div className="text-right mt-6">
                                        <span className="text-lg font-bold text-terracotta-600">€{tour.price}</span>
                                        <span className="text-xs text-gray-500 block">a persona</span>
                                    </div>
                                    <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        className="bg-terracotta-500 hover:bg-terracotta-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
                                        data-testid={`button-book-${tour.id}`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleTourClick(tour);
                                        }}
                                    >
                                        Dettagli
                                    </motion.button>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </motion.div>
            )}

        </motion.div>
    );
}
