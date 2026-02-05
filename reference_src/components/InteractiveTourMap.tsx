import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Star, Clock, Users, Euro, Navigation, Zap, Eye, X, Map, Filter, Search } from 'lucide-react';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useUserProfile } from '@/hooks/useUserProfile';
import { locationTourService } from '@/services/locationTourService';

interface TourLocation {
  id: string;
  name: string;
  coordinates: { x: number; y: number };
  tours: Array<{
    id: string;
    title: string;
    duration: string;
    price: number;
    rating: number;
    difficulty: 'facile' | 'medio' | 'difficile';
    type: 'walking' | 'food' | 'culture' | 'shopping' | 'nature';
    participants: number;
    nextStart: string;
    highlights: string[];
    description: string;
    imageUrl: string;
  }>;
  isActive: boolean;
  category: 'historic' | 'food' | 'nature' | 'culture' | 'modern';
}

export default function InteractiveTourMap() {
  const { location } = useGeolocation();
  const { profile } = useUserProfile();
  const [selectedLocation, setSelectedLocation] = useState<TourLocation | null>(null);
  const [mapCenter, setMapCenter] = useState({ x: 50, y: 50 });
  const [zoom, setZoom] = useState(1);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [tourLocations, setTourLocations] = useState<TourLocation[]>([]);
  const [hoveredLocation, setHoveredLocation] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [mapMode, setMapMode] = useState<'satellite' | 'street' | 'artistic'>('artistic');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (location) {
      loadTourMapData();
    }
  }, [location]);

  const loadTourMapData = async () => {
    if (!location) return;
    
    const cityName = location.city;
    const mockLocations = generateCityTourLocations(cityName);
    setTourLocations(mockLocations);
  };

  const generateCityTourLocations = (city: string): TourLocation[] => {
    const locationData: Record<string, TourLocation[]> = {
      'Roma': [
        {
          id: 'colosseo',
          name: 'Colosseo',
          coordinates: { x: 65, y: 45 },
          category: 'historic' as const,
          tours: [
            {
              id: 'col-1',
              title: 'Gladiatori e Leggende',
              duration: '2h',
              price: 35,
              rating: 4.8,
              difficulty: 'medio' as const,
              type: 'culture' as const,
              participants: 12,
              nextStart: '10:30',
              highlights: ['Arena', 'Sotterranei', 'Foro Romano'],
              description: 'Scopri i segreti dell\'anfiteatro più famoso al mondo',
              imageUrl: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=400&h=300&fit=crop'
            }
          ],
          isActive: true
        },
        {
          id: 'trastevere',
          name: 'Trastevere',
          coordinates: { x: 30, y: 55 },
          category: 'food' as const,
          tours: [
            {
              id: 'tra-1',
              title: 'Sapori Autentici',
              duration: '3h',
              price: 45,
              rating: 4.9,
              difficulty: 'facile' as const,
              type: 'food' as const,
              participants: 8,
              nextStart: '19:00',
              highlights: ['Supplì', 'Carciofi', 'Vino locale'],
              description: 'Tour gastronomico nelle osterie storiche',
              imageUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=400&h=300&fit=crop'
            }
          ],
          isActive: true
        },
        {
          id: 'vaticano',
          name: 'Vaticano',
          coordinates: { x: 20, y: 25 },
          category: 'culture' as const,
          tours: [
            {
              id: 'vat-1',
              title: 'Tesori Pontifici',
              duration: '4h',
              price: 55,
              rating: 4.7,
              difficulty: 'medio' as const,
              type: 'culture' as const,
              participants: 15,
              nextStart: '09:00',
              highlights: ['Cappella Sistina', 'Musei Vaticani', 'San Pietro'],
              description: 'Arte sacra e storia della cristianità',
              imageUrl: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=300&fit=crop'
            }
          ],
          isActive: true
        },
        {
          id: 'villa-borghese',
          name: 'Villa Borghese',
          coordinates: { x: 55, y: 20 },
          category: 'nature' as const,
          tours: [
            {
              id: 'vil-1',
              title: 'Oasi Verde',
              duration: '2h',
              price: 25,
              rating: 4.5,
              difficulty: 'facile' as const,
              type: 'nature' as const,
              participants: 20,
              nextStart: '16:00',
              highlights: ['Giardini', 'Galleria Borghese', 'Laghetto'],
              description: 'Relax nel polmone verde di Roma',
              imageUrl: 'https://images.unsplash.com/photo-1539650116574-75c0c6d73f6e?w=400&h=300&fit=crop'
            }
          ],
          isActive: true
        }
      ],
      'Milano': [
        {
          id: 'duomo-milano',
          name: 'Duomo',
          coordinates: { x: 50, y: 50 },
          category: 'historic' as const,
          tours: [
            {
              id: 'duo-1',
              title: 'Guglie e Terrazze',
              duration: '2.5h',
              price: 40,
              rating: 4.6,
              difficulty: 'medio' as const,
              type: 'culture' as const,
              participants: 10,
              nextStart: '11:00',
              highlights: ['Terrazze', 'Guglie', 'Galleria'],
              description: 'Il simbolo di Milano dall\'alto',
              imageUrl: 'https://images.unsplash.com/photo-1513581166391-887a96ddeafd?w=400&h=300&fit=crop'
            }
          ],
          isActive: true
        },
        {
          id: 'navigli',
          name: 'Navigli',
          coordinates: { x: 25, y: 75 },
          category: 'modern' as const,
          tours: [
            {
              id: 'nav-1',
              title: 'Aperitivo Tour',
              duration: '2h',
              price: 35,
              rating: 4.7,
              difficulty: 'facile' as const,
              type: 'food' as const,
              participants: 12,
              nextStart: '18:30',
              highlights: ['Spritz', 'Locali trendy', 'Canali'],
              description: 'La movida milanese sui navigli',
              imageUrl: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=400&h=300&fit=crop'
            }
          ],
          isActive: true
        }
      ]
    };

    return locationData[city] || locationData['Roma'];
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      historic: 'from-amber-400 to-amber-600',
      food: 'from-red-400 to-red-600',
      nature: 'from-green-400 to-green-600',
      culture: 'from-purple-400 to-purple-600',
      modern: 'from-blue-400 to-blue-600'
    };
    return colors[category] || colors.historic;
  };

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, string> = {
      historic: '🏛️',
      food: '🍕',
      nature: '🌳',
      culture: '🎨',
      modern: '🏙️'
    };
    return icons[category] || icons.historic;
  };

  const getDifficultyColor = (difficulty: string) => {
    const colors: Record<string, string> = {
      facile: 'text-green-600 bg-green-100',
      medio: 'text-yellow-600 bg-yellow-100',
      difficile: 'text-red-600 bg-red-100'
    };
    return colors[difficulty] || colors.facile;
  };

  const filteredLocations = tourLocations.filter(loc => 
    activeFilter === 'all' || loc.category === activeFilter
  );

  const filters = [
    { key: 'all', label: 'Tutti', icon: '🗺️' },
    { key: 'historic', label: 'Storici', icon: '🏛️' },
    { key: 'food', label: 'Food', icon: '🍕' },
    { key: 'culture', label: 'Cultura', icon: '🎨' },
    { key: 'nature', label: 'Natura', icon: '🌳' },
    { key: 'modern', label: 'Moderni', icon: '🏙️' }
  ];

  const filteredAndSearchedLocations = filteredLocations.filter(loc =>
    loc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    loc.tours.some(tour => 
      tour.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tour.description.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  const getMapBackground = () => {
    switch(mapMode) {
      case 'satellite':
        return 'bg-gradient-to-br from-green-200 via-blue-100 to-green-300';
      case 'street':
        return 'bg-gradient-to-br from-gray-100 via-white to-gray-200';
      case 'artistic':
      default:
        return 'bg-gradient-to-br from-terracotta-100 via-ochre-50 to-amber-100';
    }
  };

  return (
    <div className="w-full h-screen bg-gradient-to-br from-ochre-50 to-terracotta-50 relative overflow-hidden">
      {/* Enhanced Header with Search and Controls */}
      <motion.div 
        className="absolute top-0 left-0 right-0 z-20 bg-white/95 backdrop-blur-xl border-b border-terracotta-200 shadow-lg"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="max-w-md mx-auto px-4 py-4">
          {/* Header Row */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold text-gray-800 flex items-center">
                <Map className="w-6 h-6 mr-2 text-terracotta-500" />
                Mappa Interattiva
              </h1>
              <p className="text-sm text-gray-600">
                {location?.city || 'Roma'} • {filteredAndSearchedLocations.length} punti
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <motion.button
                className={`p-2 rounded-xl transition-colors ${mapMode === 'artistic' ? 'bg-terracotta-500 text-white' : 'bg-gray-200 text-gray-600'}`}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setMapMode(mapMode === 'artistic' ? 'satellite' : 'artistic')}
              >
                <Eye className="w-5 h-5" />
              </motion.button>
              <motion.button
                className={`p-2 rounded-xl transition-colors ${zoom > 1 ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'}`}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setZoom(zoom === 1 ? 1.5 : 1)}
              >
                <Zap className="w-5 h-5" />
              </motion.button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Cerca tour, luoghi..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white/80 rounded-xl border border-gray-200 focus:border-terracotta-400 focus:outline-none text-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filters Toggle */}
          <div className="flex items-center justify-between mb-2">
            <motion.button
              className="flex items-center space-x-2 text-sm text-gray-600 hover:text-terracotta-600 transition-colors"
              onClick={() => setShowFilters(!showFilters)}
              whileHover={{ scale: 1.02 }}
            >
              <Filter className="w-4 h-4" />
              <span>Filtri</span>
              <motion.div
                animate={{ rotate: showFilters ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                ⌄
              </motion.div>
            </motion.button>
            <div className="text-xs text-gray-500">
              {activeFilter !== 'all' && `Filtro: ${filters.find(f => f.key === activeFilter)?.label}`}
            </div>
          </div>

          {/* Expandable Filters */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                className="mb-4"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div className="flex flex-wrap gap-2">
                  {filters.map((filter) => (
                    <motion.button
                      key={filter.key}
                      className={`flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                        activeFilter === filter.key
                          ? 'bg-terracotta-500 text-white shadow-lg'
                          : 'bg-white/80 text-gray-600 hover:bg-terracotta-100'
                      }`}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setActiveFilter(filter.key)}
                    >
                      <span>{filter.icon}</span>
                      <span>{filter.label}</span>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Enhanced Interactive Map */}
      <motion.div 
        className={`absolute ${showFilters ? 'top-56' : 'top-44'} left-0 right-0 bottom-0 overflow-hidden`}
        style={{ 
          transform: `scale(${zoom})`,
          transformOrigin: 'center center'
        }}
        transition={{ duration: 0.5 }}
      >
        {/* Simulated Interactive Rome Map */}
        <div className="w-full h-full relative overflow-hidden bg-gradient-to-br from-amber-50 via-stone-100 to-blue-50">
          {/* Rome City Background - Realistic Simulation */}
          <div className="absolute inset-0">
            {/* Tiber River */}
            <div className="absolute top-16 left-8 w-96 h-8 bg-blue-400 rounded-full transform rotate-12 shadow-lg"></div>
            <div className="absolute top-48 left-4 w-80 h-6 bg-blue-300 rounded-full transform rotate-15 shadow-lg"></div>
            
            {/* Historic Buildings and Landmarks */}
            <div className="absolute top-32 left-48 w-16 h-20 bg-amber-700 rounded-t shadow-xl" title="Colosseo"></div>
            <div className="absolute top-28 right-32 w-12 h-14 bg-orange-600 rounded shadow-xl" title="Pantheon"></div>
            <div className="absolute bottom-32 left-32 w-14 h-18 bg-red-700 rounded-t shadow-xl" title="Castel Sant'Angelo"></div>
            
            {/* Streets Network */}
            <div className="absolute top-44 left-0 right-0 h-4 bg-gray-300 shadow-lg"></div>
            <div className="absolute top-72 left-0 right-0 h-3 bg-gray-300 shadow-lg"></div>
            <div className="absolute top-0 bottom-0 left-40 w-3 bg-gray-300 shadow-lg"></div>
            <div className="absolute top-0 bottom-0 right-40 w-4 bg-gray-300 shadow-lg"></div>
            
            {/* Parks and Green Areas */}
            <div className="absolute top-8 right-16 w-28 h-28 bg-green-400 rounded-full shadow-xl"></div>
            <div className="absolute bottom-16 left-16 w-24 h-24 bg-green-400 rounded-full shadow-xl"></div>
          </div>
          
          {/* Interactive Tutorial Overlay */}
          <div className="absolute inset-0 pointer-events-none">
            {/* Tutorial Steps */}
            <motion.div
              className="absolute top-4 left-4 bg-white/95 backdrop-blur-sm p-4 rounded-xl shadow-xl max-w-sm pointer-events-auto"
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1 }}
            >
              <h3 className="font-bold text-gray-800 mb-2 flex items-center">
                <span className="w-6 h-6 bg-blue-500 rounded-full text-white text-xs flex items-center justify-center mr-2">1</span>
                Come usare la mappa
              </h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Clicca sui pin rossi per vedere i tour</li>
                <li>• Usa la ricerca per filtrare i luoghi</li>
                <li>• Cambia vista con i pulsanti sopra</li>
                <li>• Il punto blu è la tua posizione</li>
              </ul>
            </motion.div>

            {/* User Location Indicator */}
            {location && (
              <motion.div
                className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.8, type: "spring" }}
              >
                <div className="relative">
                  <motion.div
                    className="absolute inset-0 w-16 h-16 bg-blue-500/60 rounded-full"
                    animate={{ scale: [1, 2, 1], opacity: [0.8, 0, 0.8] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                  <div className="relative w-8 h-8 bg-blue-600 rounded-full border-3 border-white shadow-2xl flex items-center justify-center">
                    <div className="w-3 h-3 bg-white rounded-full" />
                  </div>
                  <div className="absolute top-10 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white text-xs px-2 py-1 rounded-full whitespace-nowrap shadow-lg">
                    Tu sei qui
                  </div>
                </div>
              </motion.div>
            )}

            {/* Guide Arrow pointing to first tour pin */}
            <motion.div
              className="absolute top-1/3 right-1/4 pointer-events-none z-20"
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 2 }}
            >
              <div className="relative">
                <div className="bg-yellow-400 text-black px-3 py-2 rounded-lg shadow-lg text-sm font-semibold">
                  Clicca qui per un tour!
                </div>
                <div className="absolute -bottom-2 left-4 w-4 h-4 bg-yellow-400 transform rotate-45"></div>
                <motion.div
                  className="absolute -right-2 top-1/2 transform -translate-y-1/2"
                  animate={{ x: [0, 10, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  →
                </motion.div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Enhanced Tour Locations */}
        <AnimatePresence>
          {filteredAndSearchedLocations.map((tourLoc, index) => (
            <motion.div
              key={tourLoc.id}
              className="absolute cursor-pointer"
              style={{
                left: `${tourLoc.coordinates.x}%`,
                top: `${tourLoc.coordinates.y}%`,
                transform: 'translate(-50%, -50%)'
              }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ delay: index * 0.1, duration: 0.4 }}
              whileHover={{ scale: 1.2, z: 10 }}
              onHoverStart={() => setHoveredLocation(tourLoc.id)}
              onHoverEnd={() => setHoveredLocation(null)}
              onClick={() => {
                setSelectedLocation(tourLoc);
                setShowDetails(true);
              }}
            >
              {/* Enhanced Location Pin - Properly Sized and High Contrast */}
              <motion.div 
                className="relative w-14 h-14 rounded-2xl shadow-2xl flex items-center justify-center border-3 border-white z-20"
                whileHover={{ 
                  scale: 1.3, 
                  rotate: [0, -5, 5, 0],
                  boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
                }}
                transition={{ duration: 0.3 }}
                style={{
                  background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 50%, #991b1b 100%)',
                  boxShadow: '0 10px 25px rgba(220, 38, 38, 0.5), inset 0 2px 4px rgba(255,255,255,0.2)'
                }}
              >
                <span className="text-2xl drop-shadow-lg filter brightness-110 text-white">
                  {getCategoryIcon(tourLoc.category)}
                </span>
                
                {/* Enhanced Pulse Animation */}
                {tourLoc.isActive && (
                  <>
                    <div className={`absolute inset-0 bg-gradient-to-br ${getCategoryColor(tourLoc.category)} rounded-2xl animate-ping opacity-40`} />
                    <div className={`absolute inset-2 bg-gradient-to-br ${getCategoryColor(tourLoc.category)} rounded-xl animate-pulse opacity-20`} />
                  </>
                )}

                {/* Enhanced Active Indicator */}
                {tourLoc.isActive && (
                  <motion.div 
                    className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full border-3 border-white shadow-lg flex items-center justify-center"
                    animate={{ 
                      scale: [1, 1.2, 1],
                      rotate: [0, 180, 360]
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <div className="w-2 h-2 bg-white rounded-full" />
                  </motion.div>
                )}

                {/* Tour Count Badge - High Contrast */}
                <div className="absolute -bottom-2 -left-2 bg-yellow-500 text-black text-xs font-black px-2 py-1 rounded-full shadow-xl border-2 border-white">
                  {tourLoc.tours.length}
                </div>
              </motion.div>

              {/* Enhanced Location Label with Animation */}
              <motion.div
                className="absolute top-20 left-1/2 transform -translate-x-1/2 z-10"
                initial={{ opacity: 0, y: -20, scale: 0.8 }}
                animate={{ 
                  opacity: hoveredLocation === tourLoc.id ? 1 : 0,
                  y: hoveredLocation === tourLoc.id ? 0 : -20,
                  scale: hoveredLocation === tourLoc.id ? 1 : 0.8
                }}
                transition={{ duration: 0.3, type: "spring", stiffness: 300 }}
              >
                <div className="bg-white/98 backdrop-blur-md px-4 py-3 rounded-2xl shadow-2xl border border-white/20 whitespace-nowrap">
                  {/* Arrow pointing to pin */}
                  <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-4 h-4 bg-white rotate-45 border-l border-t border-white/20"></div>
                  
                  <div className="relative z-10">
                    <div className="text-sm font-bold text-gray-800 flex items-center">
                      <span className="mr-2">{getCategoryIcon(tourLoc.category)}</span>
                      {tourLoc.name}
                    </div>
                    <div className="text-xs text-gray-600 mt-1 flex items-center justify-between">
                      <span>{tourLoc.tours.length} tour disponibili</span>
                      <span className="ml-3 text-terracotta-600 font-semibold">
                        Da €{Math.min(...tourLoc.tours.map(t => t.price))}
                      </span>
                    </div>
                    {tourLoc.isActive && (
                      <div className="text-xs text-green-600 font-medium mt-1 flex items-center">
                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1 animate-pulse"></div>
                        Tour attivi ora
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>

              {/* Enhanced Connection Effects */}
              {hoveredLocation === tourLoc.id && (
                <>
                  {/* Ripple Effect */}
                  <motion.div
                    className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-32 h-32 border-4 border-terracotta-400/30 rounded-full"
                    initial={{ scale: 0, opacity: 0.8 }}
                    animate={{ scale: 1, opacity: 0 }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                  <motion.div
                    className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-24 h-24 border-3 border-terracotta-500/50 rounded-full"
                    initial={{ scale: 0, opacity: 0.6 }}
                    animate={{ scale: 1, opacity: 0 }}
                    transition={{ duration: 1, repeat: Infinity, delay: 0.3 }}
                  />
                  
                  {/* Connection Line to Label */}
                  <motion.div
                    className="absolute top-16 left-8 w-0.5 h-6 bg-gradient-to-b from-terracotta-400 to-transparent"
                    initial={{ scaleY: 0, opacity: 0 }}
                    animate={{ scaleY: 1, opacity: 1 }}
                    transition={{ duration: 0.4, delay: 0.1 }}
                  />
                </>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>

      {/* Tour Details Modal */}
      <AnimatePresence>
        {showDetails && selectedLocation && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Background Overlay */}
            <div 
              className="absolute inset-0 bg-black/50"
              onClick={() => setShowDetails(false)}
            />

            {/* Modal Content */}
            <motion.div
              className="relative bg-white rounded-t-3xl w-full max-w-md max-h-[80vh] overflow-hidden"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 500 }}
            >
              {/* Modal Header */}
              <div className="sticky top-0 bg-white z-10 px-6 py-4 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-gray-800 flex items-center">
                      <span className="mr-2">{getCategoryIcon(selectedLocation.category)}</span>
                      {selectedLocation.name}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {selectedLocation.tours.length} esperienze disponibili
                    </p>
                  </div>
                  <button
                    onClick={() => setShowDetails(false)}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Enhanced Tours List */}
              <div className="overflow-y-auto px-6 py-4 space-y-4 max-h-96">
                {selectedLocation.tours.map((tour, tourIndex) => (
                  <motion.div
                    key={tour.id}
                    className="bg-gradient-to-r from-terracotta-50 to-ochre-50 rounded-2xl p-4 border border-terracotta-100 hover:border-terracotta-300 transition-all duration-300 hover:shadow-lg"
                    initial={{ opacity: 0, x: -20, rotateY: -10 }}
                    animate={{ opacity: 1, x: 0, rotateY: 0 }}
                    transition={{ duration: 0.4, delay: tourIndex * 0.1 }}
                    whileHover={{ 
                      scale: 1.02, 
                      boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
                      transition: { duration: 0.2 }
                    }}
                  >
                    <div className="flex items-start space-x-4">
                      <img
                        src={tour.imageUrl}
                        alt={tour.title}
                        className="w-20 h-20 rounded-xl object-cover"
                      />
                      
                      <div className="flex-1">
                        <h4 className="font-bold text-gray-800 mb-2">{tour.title}</h4>
                        <p className="text-sm text-gray-600 mb-3">{tour.description}</p>
                        
                        <div className="flex items-center space-x-4 text-xs text-gray-500 mb-3">
                          <div className="flex items-center space-x-1">
                            <Clock className="w-3 h-3" />
                            <span>{tour.duration}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Users className="w-3 h-3" />
                            <span>{tour.participants}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Star className="w-3 h-3 text-yellow-500" />
                            <span>{tour.rating}</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className="text-lg font-bold text-terracotta-600">
                              €{tour.price}
                            </span>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(tour.difficulty)}`}>
                              {tour.difficulty}
                            </span>
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            <div className="text-right">
                              <div className="text-xs text-gray-500">Prossimo inizio</div>
                              <div className="text-sm font-semibold text-green-600">
                                {tour.nextStart}
                              </div>
                            </div>
                            <motion.button
                              className="bg-gradient-to-r from-terracotta-500 to-terracotta-600 hover:from-terracotta-600 hover:to-terracotta-700 text-white px-4 py-2 rounded-xl text-sm font-semibold flex items-center space-x-1 shadow-lg hover:shadow-xl transition-all duration-300"
                              whileHover={{ 
                                scale: 1.05,
                                boxShadow: '0 8px 25px rgba(184, 81, 49, 0.4)'
                              }}
                              whileTap={{ 
                                scale: 0.95,
                                boxShadow: '0 4px 15px rgba(184, 81, 49, 0.3)'
                              }}
                              onClick={() => {
                                // Add haptic feedback effect
                                if (navigator.vibrate) {
                                  navigator.vibrate(50);
                                }
                              }}
                            >
                              <motion.div
                                animate={{ rotate: [0, 360] }}
                                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                              >
                                <Zap className="w-4 h-4" />
                              </motion.div>
                              <span>Prenota Ora</span>
                            </motion.button>
                          </div>
                        </div>

                        {/* Highlights */}
                        <div className="mt-3 flex flex-wrap gap-1">
                          {tour.highlights.map((highlight, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-1 bg-white/60 text-xs text-gray-600 rounded-full"
                            >
                              {highlight}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}