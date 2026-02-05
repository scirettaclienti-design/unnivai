import { motion } from 'framer-motion';
import { MapPin, Clock, Star, Users } from 'lucide-react';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useState } from 'react';

export default function PersonalizedWelcome() {
  const { location, getCurrentLocation } = useGeolocation();
  const { profile } = useUserProfile();
  const [showTours, setShowTours] = useState(false);
  
  // 🎯 MVP MODE: Dati immediati senza loading! 
  const username = profile?.firstName || 'Utente';
  const currentCity = location?.city || 'Catania';
  const currentTemp = '24°C';

  // Tour personalizzati per Catania
  const personalizedTours = [
    {
      id: '1',
      title: 'Etna Sunrise',
      description: 'Alba sul vulcano attivo più famoso d\'Europa',
      duration: '4 ore',
      price: 75,
      difficulty: 'medio' as const,
      type: 'nature' as const,
      highlights: ['Alba spettacolare', 'Guide vulcanologiche', 'Breakfast tipico'],
      startPoint: 'Rifugio Sapienza',
      imageUrl: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96',
      rating: 4.8,
      estimatedTime: 240
    },
    {
      id: '2', 
      title: 'Catania Street Food',
      description: 'Sapori autentici siciliani nei mercati storici',
      duration: '3 ore',
      price: 45,
      difficulty: 'facile' as const,
      type: 'food' as const,
      highlights: ['Arancini originali', 'Pescheria storica', 'Cannoli freschi'],
      startPoint: 'La Pescheria',
      imageUrl: 'https://images.unsplash.com/photo-1551218808-94e220e084d2',
      rating: 4.9,
      estimatedTime: 180
    },
    {
      id: '3',
      title: 'Teatro Romano', 
      description: 'Storia antica nel cuore della città',
      duration: '2 ore',
      price: 25,
      difficulty: 'facile' as const,
      type: 'culture' as const,
      highlights: ['Teatro del II secolo', 'Odeon romano', 'Centro storico'],
      startPoint: 'Via Vittorio Emanuele',
      imageUrl: 'https://images.unsplash.com/photo-1539650116574-75c0c6d05be0',
      rating: 4.6,
      estimatedTime: 120
    }
  ];

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'facile': return 'bg-green-100 text-green-700';
      case 'medio': return 'bg-yellow-100 text-yellow-700';
      case 'difficile': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'walking': return '🚶‍♂️';
      case 'food': return '🍕';
      case 'culture': return '🏛️';
      case 'shopping': return '🛍️';
      case 'nature': return '🌋';
      default: return '📍';
    }
  };

  return (
    <motion.div
      className="mb-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      {/* 🎯 Pulsante Tour Personalizzati */}
      <motion.div
        className="text-center mb-6"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <motion.button
          className="bg-gradient-to-r from-ochre-500 to-ochre-600 hover:from-ochre-600 hover:to-ochre-700 text-white px-8 py-4 rounded-2xl font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-200"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            console.log('🎯 Visualizza tour personalizzati per:', currentCity);
            setShowTours(!showTours);
          }}
          data-testid="button-personalized-tours"
        >
          🎯 Guarda i tour personalizzati per {currentCity}
        </motion.button>
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
              className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + index * 0.1 }}
              data-testid={`card-tour-${tour.id}`}
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
                <div className="flex flex-col items-end space-y-2">
                  <div className="text-right">
                    <span className="text-lg font-bold text-terracotta-600">€{tour.price}</span>
                    <span className="text-xs text-gray-500 block">a persona</span>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="bg-terracotta-500 hover:bg-terracotta-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
                    data-testid={`button-book-${tour.id}`}
                    onClick={() => console.log('Prenota tour:', tour.title)}
                  >
                    Prenota Ora
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