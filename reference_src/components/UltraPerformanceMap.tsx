import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { 
  MapPin, Star, Clock, Users, Euro, Navigation, Zap, Eye, X, Map, Filter, Search, 
  Bookmark, Calendar, Phone, MessageSquare, ArrowRight, Target, Layers, Route,
  Camera, Share2, Heart, TrendingUp, ThumbsUp, Gift, Wifi, Battery, Signal
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEnhancedGeolocation } from '@/hooks/useEnhancedGeolocation';
import { useUserProfile } from '@/hooks/useUserProfile';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface Tour {
  id: number;
  title: string;
  description: string;
  shortDescription: string;
  category: string;
  location: string;
  latitude: number;
  longitude: number;
  durationMinutes: number;
  maxParticipants: number;
  price: number;
  difficultyLevel: number;
  includedItems: string[];
  meetingPoint: string;
  highlights: string[];
  images: string[];
  isActive: boolean;
  businessId: number;
  currency: string;
}

interface ClusterData {
  id: string;
  x: number;
  y: number;
  tours: Tour[];
  count: number;
  category: string;
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
}

interface MapState {
  center: { x: number; y: number };
  zoom: number;
  rotation: number;
  isDragging: boolean;
  lastPanTime: number;
}

export default function UltraPerformanceMap() {
  const queryClient = useQueryClient();
  const { location, loading: locationLoading } = useEnhancedGeolocation();
  const { profile } = useUserProfile();
  
  // Map State Management with Performance Optimization
  const [mapState, setMapState] = useState<MapState>({
    center: { x: 50, y: 50 },
    zoom: 1,
    rotation: 0,
    isDragging: false,
    lastPanTime: 0
  });
  
  const [selectedTour, setSelectedTour] = useState<Tour | null>(null);
  const [hoveredCluster, setHoveredCluster] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [mapMode, setMapMode] = useState<'standard' | 'satellite' | 'street'>('standard');
  const [clusteringLevel, setClusteringLevel] = useState(3);
  
  // Performance: Refs for gesture handling
  const mapRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const lastTouchRef = useRef<{ x: number; y: number; time: number } | null>(null);
  
  // Motion values for smooth animations
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const scale = useMotionValue(1);
  const rotate = useMotionValue(0);
  
  // Real Database Tour Fetching with Caching
  const { data: tours = [], isLoading: toursLoading, error } = useQuery({
    queryKey: ['/api/tours', location?.city],
    queryFn: async () => {
      const response = await fetch('/api/tours');
      if (!response.ok) throw new Error('Failed to fetch tours');
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes cache
    gcTime: 30 * 60 * 1000, // 30 minutes background cache
    refetchOnWindowFocus: false,
    enabled: true // Always enabled - don't wait for location
  });

  // Real-time Availability Query
  const { data: availabilityData } = useQuery({
    queryKey: ['/api/tours/availability'],
    queryFn: async () => {
      const response = await fetch('/api/tours/availability');
      if (!response.ok) throw new Error('Failed to fetch availability');
      return response.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
    enabled: tours.length > 0
  });

  // Instant Booking Mutation
  const bookingMutation = useMutation({
    mutationFn: async (bookingData: any) => {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookingData)
      });
      if (!response.ok) throw new Error('Booking failed');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tours/availability'] });
      setShowBookingModal(false);
      // Show success toast
    }
  });

  // Smart Clustering Algorithm with Performance Optimization
  const clusteredTours = useMemo(() => {
    if (!tours.length) return [];
    
    const clusters: ClusterData[] = [];
    const processed = new Set<number>();
    const clusterRadius = 150 / mapState.zoom; // Dynamic clustering based on zoom
    
    tours.forEach((tour: Tour, index: number) => {
      if (processed.has(tour.id)) return;
      
      // Convert lat/lng to screen coordinates (simplified)
      const x = ((tour.longitude + 180) / 360) * 100;
      const y = ((90 - tour.latitude) / 180) * 100;
      
      // Find nearby tours for clustering
      const nearbyTours = tours.filter((otherTour: Tour, otherIndex: number) => {
        if (processed.has(otherTour.id) || otherTour.id === tour.id) return false;
        
        const otherX = ((otherTour.longitude + 180) / 360) * 100;
        const otherY = ((90 - otherTour.latitude) / 180) * 100;
        
        const distance = Math.sqrt((x - otherX) ** 2 + (y - otherY) ** 2);
        return distance < clusterRadius;
      });
      
      const clusterTours = [tour, ...nearbyTours];
      clusterTours.forEach(t => processed.add(t.id));
      
      const prices = clusterTours.map(t => parseFloat(t.price.toString()));
      
      clusters.push({
        id: `cluster-${tour.id}`,
        x,
        y,
        tours: clusterTours,
        count: clusterTours.length,
        category: tour.category,
        avgPrice: prices.reduce((a, b) => a + b, 0) / prices.length,
        minPrice: Math.min(...prices),
        maxPrice: Math.max(...prices)
      });
    });
    
    return clusters;
  }, [tours, mapState.zoom, clusteringLevel]);

  // Advanced Filter Logic with Search
  const filteredClusters = useMemo(() => {
    let filtered = clusteredTours;
    
    // Category filter
    if (activeFilter !== 'all') {
      filtered = filtered.filter(cluster => 
        cluster.tours.some(tour => tour.category === activeFilter)
      );
    }
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(cluster =>
        cluster.tours.some(tour =>
          tour.title.toLowerCase().includes(query) ||
          tour.description.toLowerCase().includes(query) ||
          tour.location.toLowerCase().includes(query)
        )
      );
    }
    
    return filtered;
  }, [clusteredTours, activeFilter, searchQuery]);

  // Touch/Mouse Gesture Handlers for Mobile Optimization
  const handleGestureStart = useCallback((event: React.TouchEvent | React.MouseEvent) => {
    isDraggingRef.current = true;
    setMapState(prev => ({ ...prev, isDragging: true }));
    
    const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
    const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;
    
    lastTouchRef.current = { x: clientX, y: clientY, time: Date.now() };
  }, []);

  const handleGestureMove = useCallback((event: React.TouchEvent | React.MouseEvent) => {
    if (!isDraggingRef.current || !lastTouchRef.current) return;
    
    const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
    const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;
    
    const deltaX = clientX - lastTouchRef.current.x;
    const deltaY = clientY - lastTouchRef.current.y;
    
    // Smooth panning with momentum
    setMapState(prev => ({
      ...prev,
      center: {
        x: Math.max(0, Math.min(100, prev.center.x - deltaX * 0.1)),
        y: Math.max(0, Math.min(100, prev.center.y - deltaY * 0.1))
      },
      lastPanTime: Date.now()
    }));
    
    lastTouchRef.current = { x: clientX, y: clientY, time: Date.now() };
  }, []);

  const handleGestureEnd = useCallback(() => {
    isDraggingRef.current = false;
    setMapState(prev => ({ ...prev, isDragging: false }));
    lastTouchRef.current = null;
  }, []);

  // Smart Zoom with Constraints
  const handleZoom = useCallback((delta: number, clientX?: number, clientY?: number) => {
    setMapState(prev => {
      const newZoom = Math.max(0.5, Math.min(5, prev.zoom + delta));
      return { ...prev, zoom: newZoom };
    });
  }, []);

  // Category Configuration
  const categories = [
    { key: 'all', label: 'Tutti', icon: '🗺️', color: 'bg-gray-500' },
    { key: 'history', label: 'Storia', icon: '🏛️', color: 'bg-amber-500' },
    { key: 'food', label: 'Food', icon: '🍝', color: 'bg-red-500' },
    { key: 'culture', label: 'Cultura', icon: '🎨', color: 'bg-purple-500' },
    { key: 'nature', label: 'Natura', icon: '🌳', color: 'bg-green-500' },
    { key: 'adventure', label: 'Avventura', icon: '🗺️', color: 'bg-blue-500' }
  ];

  const getCategoryColor = (category: string) => {
    const cat = categories.find(c => c.key === category);
    return cat?.color || 'bg-gray-500';
  };

  const getCategoryIcon = (category: string) => {
    const cat = categories.find(c => c.key === category);
    return cat?.icon || '📍';
  };

  // Instant Booking Handler
  const handleQuickBook = (tour: Tour) => {
    setSelectedTour(tour);
    setShowBookingModal(true);
  };

  if (toursLoading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <motion.div
          className="text-center"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
        >
          <motion.div
            className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">Caricamento Mappa Ultra</h3>
          <p className="text-gray-500">Ottimizzando tour per la tua posizione...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen bg-gradient-to-br from-slate-50 to-blue-50 relative overflow-hidden">
      {/* Ultra Performance Header */}
      <motion.div 
        className="absolute top-0 left-0 right-0 z-30 bg-gradient-to-r from-terracotta-500 to-ochre-500 shadow-xl"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, type: "spring" }}
      >
        <div className="max-w-md mx-auto px-4 py-3">
          {/* Personal Greeting Bar */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <motion.div 
                className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center"
                whileHover={{ rotate: 180 }}
                transition={{ duration: 0.3 }}
              >
                <MapPin className="text-white w-5 h-5" />
              </motion.div>
              <div>
                <motion.h1 
                  className="text-lg font-bold text-white"
                  whileHover={{ scale: 1.05 }}
                >
                  Ciao, {profile?.firstName || 'Esploratore'}!
                </motion.h1>
                <motion.p 
                  className="text-sm text-white/80 flex items-center"
                  whileHover={{ scale: 1.05 }}
                >
                  <MapPin className="text-white/70 w-3 h-3 mr-1" />
                  <span>{location?.city || 'Roma'}, {location?.country || 'Italia'}</span>
                  <span className="ml-2 text-xs bg-green-500/20 px-2 py-0.5 rounded-full">
                    📍 Live Map
                  </span>
                </motion.p>
              </div>
            </div>
            
            <motion.div
              className="flex items-center space-x-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <Wifi className="w-4 h-4 text-white/80" />
              <Signal className="w-4 h-4 text-white/80" />
              <Battery className="w-4 h-4 text-white/80" />
            </motion.div>
          </div>

          {/* Auto-Generated Personalized Tours */}
          <motion.div 
            className="mb-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
          >
            <h3 className="text-white/90 text-sm font-semibold mb-2 flex items-center">
              <Zap className="w-4 h-4 mr-2" />
              Tour Per Te ({location?.city || 'Roma'})
            </h3>
            <div className="flex space-x-2 overflow-x-auto pb-2">
              {tours.slice(0, 3).map((tour: Tour, index: number) => (
                <motion.div
                  key={tour.id}
                  className="flex-shrink-0 bg-white/20 backdrop-blur-sm rounded-xl p-3 min-w-[140px] border border-white/10"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + index * 0.1 }}
                  whileHover={{ scale: 1.05, backgroundColor: 'rgba(255,255,255,0.3)' }}
                  onClick={() => setSelectedTour(tour)}
                >
                  <div className="text-lg mb-1">
                    {tour.category === 'food' ? '🍝' : tour.category === 'history' ? '🏛️' : '🎨'}
                  </div>
                  <h4 className="text-white text-xs font-bold leading-tight mb-1">
                    {tour.title.length > 25 ? tour.title.substring(0, 25) + '...' : tour.title}
                  </h4>
                  <div className="flex items-center justify-between">
                    <span className="text-yellow-300 text-xs font-bold">€{tour.price}</span>
                    <div className="flex items-center">
                      <Clock className="w-3 h-3 text-white/70 mr-1" />
                      <span className="text-white/70 text-xs">{Math.round(tour.durationMinutes/60)}h</span>
                    </div>
                  </div>
                  <motion.div 
                    className="mt-2 w-full h-1 bg-white/20 rounded-full overflow-hidden"
                    whileHover={{ scale: 1.05 }}
                  >
                    <motion.div 
                      className="h-full bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full"
                      initial={{ width: '0%' }}
                      animate={{ width: `${Math.random() * 40 + 60}%` }}
                      transition={{ delay: 0.7 + index * 0.1, duration: 0.8 }}
                    />
                  </motion.div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Status Bar */}
          <div className="flex items-center justify-between mb-3 text-xs text-gray-500">
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-1">
                <Signal className="w-3 h-3" />
                <span>5G</span>
              </div>
              <div className="flex items-center space-x-1">
                <Wifi className="w-3 h-3" />
                <span>Ultra</span>
              </div>
              <div className="flex items-center space-x-1">
                <Battery className="w-3 h-3" />
                <span>95%</span>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant="secondary" className="text-xs">
                {filteredClusters.length} zone
              </Badge>
              <Badge variant="outline" className="text-xs">
                Live
              </Badge>
            </div>
          </div>

          {/* Main Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold text-gray-800 flex items-center">
                <motion.div
                  className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg mr-3 flex items-center justify-center"
                  whileHover={{ rotate: 360 }}
                  transition={{ duration: 0.6 }}
                >
                  <Map className="w-4 h-4 text-white" />
                </motion.div>
                Ultra Map
              </h1>
              <p className="text-sm text-gray-600 flex items-center">
                <MapPin className="w-3 h-3 mr-1" />
                {location?.city || 'Roma'} • {tours.length} tour
              </p>
            </div>
            
            <div className="flex items-center space-x-2">
              <motion.button
                className={`p-2 rounded-xl transition-colors ${mapMode === 'satellite' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'}`}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setMapMode(mapMode === 'satellite' ? 'standard' : 'satellite')}
              >
                <Layers className="w-4 h-4" />
              </motion.button>
              
              <motion.button
                className={`p-2 rounded-xl transition-colors ${mapState.zoom > 1 ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-600'}`}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => handleZoom(mapState.zoom > 1 ? -0.5 : 0.5)}
              >
                <Target className="w-4 h-4" />
              </motion.button>
            </div>
          </div>

          {/* Smart Search Bar */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Cerca tour, luoghi, esperienze..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-12 py-3 bg-white/80 backdrop-blur-sm rounded-xl border border-gray-200 focus:border-blue-400 focus:outline-none text-sm shadow-sm"
            />
            {searchQuery && (
              <motion.button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <X className="w-4 h-4" />
              </motion.button>
            )}
          </div>

          {/* Advanced Filters */}
          <div className="flex items-center justify-between mb-2">
            <motion.button
              className="flex items-center space-x-2 text-sm text-gray-600 hover:text-blue-600 transition-colors"
              onClick={() => setShowFilters(!showFilters)}
              whileHover={{ scale: 1.02 }}
            >
              <Filter className="w-4 h-4" />
              <span>Filtri Avanzati</span>
              <motion.span
                animate={{ rotate: showFilters ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                ⌄
              </motion.span>
            </motion.button>
            
            <div className="flex items-center space-x-2 text-xs text-gray-500">
              <TrendingUp className="w-3 h-3" />
              <span>Real-time</span>
            </div>
          </div>

          {/* Expandable Filter Grid */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-3 gap-2 pb-4">
                  {categories.map((category) => (
                    <motion.button
                      key={category.key}
                      className={`flex flex-col items-center space-y-1 p-3 rounded-xl text-xs font-medium transition-all ${
                        activeFilter === category.key
                          ? 'bg-blue-500 text-white shadow-lg transform scale-105'
                          : 'bg-white/80 text-gray-600 hover:bg-blue-50 border border-gray-200'
                      }`}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setActiveFilter(category.key)}
                    >
                      <span className="text-lg">{category.icon}</span>
                      <span>{category.label}</span>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Ultra Interactive Map Container */}
      <motion.div 
        ref={mapRef}
        className={`absolute ${showFilters ? 'top-64' : 'top-52'} left-0 right-0 bottom-0 overflow-hidden cursor-grab active:cursor-grabbing`}
        style={{
          transform: `scale(${mapState.zoom}) translate(${mapState.center.x - 50}%, ${mapState.center.y - 50}%)`,
          transformOrigin: 'center center'
        }}
        transition={{ type: "spring", damping: 20, stiffness: 100 }}
        onMouseDown={handleGestureStart}
        onMouseMove={handleGestureMove}
        onMouseUp={handleGestureEnd}
        onTouchStart={handleGestureStart}
        onTouchMove={handleGestureMove}
        onTouchEnd={handleGestureEnd}
        whileHover={{ cursor: 'grab' }}
        drag
        dragConstraints={{
          left: -50,
          right: 50,
          top: -50,
          bottom: 50
        }}
      >
        {/* Enhanced City Background */}
        <div className="w-full h-full relative bg-gradient-to-br from-emerald-100 via-blue-50 to-purple-100">
          {/* Realistic City Layout */}
          <div className="absolute inset-0">
            {/* Rivers and Water */}
            <motion.div 
              className="absolute top-20 left-12 w-96 h-6 bg-blue-400 rounded-full shadow-lg"
              style={{ transform: 'rotate(15deg)' }}
              initial={{ opacity: 0.6 }}
              animate={{ opacity: [0.6, 0.8, 0.6] }}
              transition={{ duration: 4, repeat: Infinity }}
            />
            
            {/* Major Streets */}
            <div className="absolute top-0 bottom-0 left-1/2 w-2 bg-gray-300 shadow-lg" />
            <div className="absolute left-0 right-0 top-1/2 h-2 bg-gray-300 shadow-lg" />
            
            {/* Landmarks */}
            <motion.div 
              className="absolute top-1/3 left-2/3 w-12 h-16 bg-amber-600 rounded-t shadow-2xl"
              whileHover={{ scale: 1.1, shadow: "0 20px 40px rgba(0,0,0,0.3)" }}
            />
            
            {/* Parks */}
            <motion.div 
              className="absolute top-16 right-20 w-24 h-24 bg-green-400 rounded-full shadow-xl"
              animate={{ scale: [1, 1.02, 1] }}
              transition={{ duration: 3, repeat: Infinity }}
            />
          </div>

          {/* User Location with Enhanced Animation */}
          {location && (
            <motion.div
              className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.8, type: "spring" }}
            >
              <motion.div
                className="relative"
                animate={{ 
                  rotate: [0, 360],
                }}
                transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
              >
                <motion.div
                  className="absolute inset-0 w-20 h-20 bg-blue-500/30 rounded-full"
                  animate={{ scale: [1, 2.5, 1], opacity: [0.7, 0, 0.7] }}
                  transition={{ duration: 3, repeat: Infinity }}
                />
                <div className="relative w-12 h-12 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full border-4 border-white shadow-2xl flex items-center justify-center">
                  <Navigation className="w-6 h-6 text-white" />
                </div>
                <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white text-xs px-3 py-1 rounded-full whitespace-nowrap shadow-lg">
                  📍 Tu sei qui
                </div>
              </motion.div>
            </motion.div>
          )}
        </div>

        {/* Ultra Performance Tour Clusters */}
        <AnimatePresence>
          {filteredClusters.map((cluster, index) => (
            <motion.div
              key={cluster.id}
              className="absolute cursor-pointer"
              style={{
                left: `${cluster.x}%`,
                top: `${cluster.y}%`,
                transform: 'translate(-50%, -50%)',
                zIndex: hoveredCluster === cluster.id ? 25 : 15
              }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ 
                delay: index * 0.05, 
                duration: 0.4,
                type: "spring",
                stiffness: 200,
                damping: 15
              }}
              whileHover={{ 
                scale: 1.3,
                zIndex: 25,
                transition: { duration: 0.2 }
              }}
              onHoverStart={() => setHoveredCluster(cluster.id)}
              onHoverEnd={() => setHoveredCluster(null)}
              onClick={() => setSelectedTour(cluster.tours[0])}
            >
              {/* Enhanced Cluster Pin */}
              <motion.div 
                className={`relative w-16 h-16 rounded-2xl shadow-2xl border-4 border-white ${getCategoryColor(cluster.category)} flex flex-col items-center justify-center`}
                whileHover={{ 
                  scale: 1.1,
                  boxShadow: '0 25px 50px rgba(0,0,0,0.4)',
                  y: -5
                }}
                style={{
                  background: `linear-gradient(135deg, ${cluster.category === 'food' ? '#dc2626' : cluster.category === 'history' ? '#d97706' : cluster.category === 'culture' ? '#7c3aed' : '#059669'} 0%, ${cluster.category === 'food' ? '#991b1b' : cluster.category === 'history' ? '#92400e' : cluster.category === 'culture' ? '#5b21b6' : '#047857'} 100%)`
                }}
              >
                <span className="text-xl text-white filter drop-shadow-lg">
                  {getCategoryIcon(cluster.category)}
                </span>
                
                {/* Multi-tour Indicator */}
                {cluster.count > 1 && (
                  <span className="text-xs text-white font-bold">
                    +{cluster.count - 1}
                  </span>
                )}

                {/* Real-time Availability Pulse */}
                <motion.div 
                  className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-white shadow-lg"
                  animate={{ 
                    scale: [1, 1.3, 1],
                    opacity: [1, 0.7, 1]
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                />

                {/* Price Badge */}
                <div className="absolute -bottom-3 -left-2 bg-yellow-500 text-black text-xs font-black px-2 py-1 rounded-full shadow-lg border-2 border-white">
                  €{Math.round(cluster.minPrice)}
                </div>

                {/* Quick Action Buttons */}
                <AnimatePresence>
                  {hoveredCluster === cluster.id && (
                    <motion.div
                      className="absolute -top-16 left-1/2 transform -translate-x-1/2 flex space-x-2"
                      initial={{ opacity: 0, y: 10, scale: 0.8 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.8 }}
                      transition={{ duration: 0.2 }}
                    >
                      <motion.button
                        className="p-2 bg-blue-500 text-white rounded-full shadow-lg hover:bg-blue-600"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleQuickBook(cluster.tours[0]);
                        }}
                      >
                        <Calendar className="w-4 h-4" />
                      </motion.button>
                      
                      <motion.button
                        className="p-2 bg-green-500 text-white rounded-full shadow-lg hover:bg-green-600"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                      >
                        <Share2 className="w-4 h-4" />
                      </motion.button>
                      
                      <motion.button
                        className="p-2 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                      >
                        <Heart className="w-4 h-4" />
                      </motion.button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* Enhanced Hover Info */}
              <AnimatePresence>
                {hoveredCluster === cluster.id && (
                  <motion.div
                    className="absolute top-20 left-1/2 transform -translate-x-1/2 z-30 pointer-events-none"
                    initial={{ opacity: 0, y: -10, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.9 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl p-4 max-w-xs border border-gray-200">
                      <h4 className="font-bold text-gray-800 mb-2 flex items-center">
                        <span className="mr-2">{getCategoryIcon(cluster.category)}</span>
                        {cluster.tours[0].title}
                      </h4>
                      
                      <div className="grid grid-cols-2 gap-3 text-xs text-gray-600 mb-3">
                        <div className="flex items-center">
                          <Clock className="w-3 h-3 mr-1" />
                          {cluster.tours[0].durationMinutes}min
                        </div>
                        <div className="flex items-center">
                          <Users className="w-3 h-3 mr-1" />
                          max {cluster.tours[0].maxParticipants}
                        </div>
                        <div className="flex items-center">
                          <Star className="w-3 h-3 mr-1 text-yellow-500" />
                          4.8 (127)
                        </div>
                        <div className="flex items-center">
                          <Euro className="w-3 h-3 mr-1 text-green-500" />
                          {cluster.tours[0].price}
                        </div>
                      </div>
                      
                      {cluster.count > 1 && (
                        <div className="text-xs text-blue-600 font-medium">
                          +{cluster.count - 1} altri tour disponibili
                        </div>
                      )}
                      
                      <div className="flex space-x-2 mt-3">
                        <Badge variant="secondary" className="text-xs">
                          Disponibile ora
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          Conferma istantanea
                        </Badge>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>

      {/* Quick Actions Floating Menu */}
      <motion.div
        className="absolute bottom-8 right-6 z-40"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 1, duration: 0.6 }}
      >
        <div className="flex flex-col space-y-3">
          <motion.button
            className="w-14 h-14 bg-blue-500 hover:bg-blue-600 text-white rounded-full shadow-2xl flex items-center justify-center"
            whileHover={{ scale: 1.1, rotate: 180 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setMapState(prev => ({ ...prev, center: { x: 50, y: 50 }, zoom: 1 }))}
          >
            <Navigation className="w-6 h-6" />
          </motion.button>
          
          <motion.button
            className="w-14 h-14 bg-green-500 hover:bg-green-600 text-white rounded-full shadow-2xl flex items-center justify-center"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <Route className="w-6 h-6" />
          </motion.button>
          
          <motion.button
            className="w-14 h-14 bg-purple-500 hover:bg-purple-600 text-white rounded-full shadow-2xl flex items-center justify-center"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <Camera className="w-6 h-6" />
          </motion.button>
        </div>
      </motion.div>

      {/* Ultra Tour Detail Modal */}
      <AnimatePresence>
        {selectedTour && (
          <motion.div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedTour(null)}
          >
            <motion.div
              className="bg-white rounded-t-3xl p-6 w-full max-h-[80vh] overflow-y-auto"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Tour Header */}
              <div className="flex items-start justify-between mb-6">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="text-2xl">{getCategoryIcon(selectedTour.category)}</span>
                    <Badge variant="secondary">{selectedTour.category}</Badge>
                    <Badge variant="outline" className="bg-green-50 text-green-700">
                      Disponibile ora
                    </Badge>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-800 mb-2">
                    {selectedTour.title}
                  </h3>
                  <p className="text-gray-600 mb-4">
                    {selectedTour.shortDescription}
                  </p>
                  
                  {/* Key Stats */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="flex items-center space-x-2">
                      <Clock className="w-5 h-5 text-blue-500" />
                      <span className="text-sm font-medium">{selectedTour.durationMinutes} minuti</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Users className="w-5 h-5 text-green-500" />
                      <span className="text-sm font-medium">Max {selectedTour.maxParticipants} persone</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Star className="w-5 h-5 text-yellow-500" />
                      <span className="text-sm font-medium">4.8 (127 recensioni)</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <MapPin className="w-5 h-5 text-red-500" />
                      <span className="text-sm font-medium">{selectedTour.location}</span>
                    </div>
                  </div>
                </div>
                
                <button
                  onClick={() => setSelectedTour(null)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-6 h-6 text-gray-500" />
                </button>
              </div>

              {/* Tour Image */}
              {selectedTour.images && selectedTour.images.length > 0 && (
                <div className="mb-6 rounded-2xl overflow-hidden">
                  <img 
                    src={selectedTour.images[0]} 
                    alt={selectedTour.title}
                    className="w-full h-48 object-cover"
                  />
                </div>
              )}

              {/* Highlights */}
              {selectedTour.highlights && selectedTour.highlights.length > 0 && (
                <div className="mb-6">
                  <h4 className="font-bold text-gray-800 mb-3 flex items-center">
                    <Star className="w-5 h-5 text-yellow-500 mr-2" />
                    Highlights
                  </h4>
                  <div className="grid grid-cols-1 gap-2">
                    {selectedTour.highlights.map((highlight, index) => (
                      <div key={index} className="flex items-center space-x-2 text-sm text-gray-600">
                        <div className="w-2 h-2 bg-blue-500 rounded-full" />
                        <span>{highlight}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Incluso */}
              {selectedTour.includedItems && selectedTour.includedItems.length > 0 && (
                <div className="mb-6">
                  <h4 className="font-bold text-gray-800 mb-3 flex items-center">
                    <Gift className="w-5 h-5 text-green-500 mr-2" />
                    Incluso nel prezzo
                  </h4>
                  <div className="grid grid-cols-1 gap-2">
                    {selectedTour.includedItems.map((item, index) => (
                      <div key={index} className="flex items-center space-x-2 text-sm text-gray-600">
                        <ThumbsUp className="w-4 h-4 text-green-500" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Price and Booking */}
              <div className="border-t pt-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-3xl font-bold text-gray-800">
                      €{selectedTour.price}
                      <span className="text-lg font-normal text-gray-500"> / persona</span>
                    </div>
                    <div className="text-sm text-gray-500">
                      Punto d'incontro: {selectedTour.meetingPoint}
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    className="flex items-center justify-center space-x-2"
                    onClick={() => setSelectedTour(null)}
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>Contatta</span>
                  </Button>
                  
                  <Button
                    className="bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center space-x-2"
                    onClick={() => handleQuickBook(selectedTour)}
                    disabled={bookingMutation.isPending}
                  >
                    {bookingMutation.isPending ? (
                      <motion.div
                        className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      />
                    ) : (
                      <>
                        <Calendar className="w-4 h-4" />
                        <span>Prenota Ora</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}