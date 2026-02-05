// AI-powered recommendation service for Italian tourism
export interface WeatherData {
  condition: 'sunny' | 'cloudy' | 'rainy' | 'stormy';
  temperature: number;
  humidity: number;
  windSpeed: number;
  description: string;
}

export interface UserPreferences {
  categories: string[];
  budgetRange: 'low' | 'medium' | 'high';
  travelStyle: 'relaxed' | 'balanced' | 'intensive';
  groupSize: 'solo' | 'small' | 'large';
  weatherSensitivity: number; // 1-5
}

export interface TourRecommendation {
  id: string;
  title: string;
  category: string;
  location: string;
  description: string;
  price: number;
  duration: string;
  rating: number;
  imageUrl: string;
  weatherScore: number; // How well it matches current weather
  personalScore: number; // How well it matches user preferences
  overallScore: number;
  reason: string;
  urgency: 'low' | 'medium' | 'high';
  validUntil: Date;
}

export interface NotificationData {
  id: string;
  type: 'tour_recommendation' | 'weather_alert' | 'social_activity' | 'tour_reminder' | 'group_invite' | 'location' | 'special' | 'recommendation' | 'weather' | 'tip' | 'greeting' | 'food';
  title: string;  
  message: string;
  timestamp: Date;
  location?: string;
  imageUrl?: string;
  actionText?: string;
  actionUrl?: string;
  actionType?: string;
  actionData?: any;
  category?: 'tours' | 'social' | 'weather';
  priority: 'low' | 'medium' | 'high';
  locationBased?: boolean;
  weatherAdaptive?: boolean;
  categoryBased?: boolean;
  isPromotion?: boolean;
  isUrgent?: boolean;
  isWeekendSpecial?: boolean;
  isLocalTip?: boolean;
  timeBased?: boolean;
  tourData?: any;
  expiresAt?: Date;
}

class AIRecommendationService {
  // Simulate weather API calls
  async getCurrentWeather(location: string): Promise<WeatherData> {
    // In a real app, this would call a weather API
    const weatherConditions = ['sunny', 'cloudy', 'rainy'] as const;
    const randomCondition = weatherConditions[Math.floor(Math.random() * weatherConditions.length)];
    
    return {
      condition: randomCondition,
      temperature: Math.floor(Math.random() * 20) + 15, // 15-35°C
      humidity: Math.floor(Math.random() * 40) + 40, // 40-80%
      windSpeed: Math.floor(Math.random() * 15) + 5, // 5-20 km/h
      description: this.getWeatherDescription(randomCondition)
    };
  }

  private getWeatherDescription(condition: string): string {
    const descriptions: Record<string, string> = {
      sunny: 'Sole splendente, perfetto per esplorare',
      cloudy: 'Nuvoloso ma piacevole per camminare',
      rainy: 'Pioggerella, ideale per musei e interni'
    };
    return descriptions[condition] || 'Condizioni variabili';
  }

  // Generate smart tour recommendations
  async generateRecommendations(
    userPreferences: UserPreferences,
    currentLocation: string,
    timeOfDay: 'morning' | 'afternoon' | 'evening'
  ): Promise<TourRecommendation[]> {
    const weather = await this.getCurrentWeather(currentLocation);
    const availableTours = this.getAvailableTours(currentLocation);
    
    return availableTours
      .map(tour => this.scoreTour(tour, userPreferences, weather, timeOfDay))
      .sort((a, b) => b.overallScore - a.overallScore)
      .slice(0, 5); // Top 5 recommendations
  }

  private getAvailableTours(location: string) {
    // Database tour espanso con più città italiane
    const allTours = [
      // Roma
      {
        id: 'food-trastevere',
        title: 'Sapori Autentici di Trastevere',
        category: 'food',
        location: 'Roma, Trastevere', 
        city: 'Roma',
        description: 'Tour gastronomico tra le osterie storiche del quartiere',
        price: 45,
        duration: '3 ore',
        rating: 4.8,
        imageUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=400&h=300&fit=crop',
        indoorPercentage: 60,
        physicalIntensity: 2,
        groupFriendly: true,
        timeSlots: ['morning', 'afternoon', 'evening']
      },
      {
        id: 'colosseum-history',
        title: 'Segreti del Colosseo',
        category: 'history',
        location: 'Roma, Centro',
        city: 'Roma',
        description: 'Scopri la storia nascosta dell\'anfiteatro più famoso al mondo',
        price: 35,
        duration: '2.5 ore',
        rating: 4.7,
        imageUrl: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=400&h=300&fit=crop',
        indoorPercentage: 30,
        physicalIntensity: 3,
        groupFriendly: true,
        timeSlots: ['morning', 'afternoon']
      },
      // Milano
      {
        id: 'duomo-milan',
        title: 'Duomo e Galleria Vittorio Emanuele',
        category: 'art',
        location: 'Milano, Centro',
        city: 'Milano',
        description: 'Visita alle guglie del Duomo e shopping di lusso',
        price: 40,
        duration: '2.5 ore',
        rating: 4.6,
        imageUrl: 'https://images.unsplash.com/photo-1513581166391-887a96ddeafd?w=400&h=300&fit=crop',
        indoorPercentage: 70,
        physicalIntensity: 3,
        groupFriendly: true,
        timeSlots: ['morning', 'afternoon']
      },
      {
        id: 'aperitivo-milan',
        title: 'Aperitivo Milanese nei Navigli',
        category: 'food',
        location: 'Milano, Navigli',
        city: 'Milano',
        description: 'Tour degli aperitivi più trendy della movida milanese',
        price: 35,
        duration: '2 ore',
        rating: 4.7,
        imageUrl: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=400&h=300&fit=crop',
        indoorPercentage: 50,
        physicalIntensity: 1,
        groupFriendly: true,
        timeSlots: ['evening']
      },
      // Firenze
      {
        id: 'uffizi-florence',
        title: 'Capolavori degli Uffizi',
        category: 'art',
        location: 'Firenze, Centro Storico',
        city: 'Firenze',
        description: 'Tour guidato nei musei più famosi del Rinascimento',
        price: 50,
        duration: '3 ore',
        rating: 4.9,
        imageUrl: 'https://images.unsplash.com/photo-1543429258-11de7da70b8c?w=400&h=300&fit=crop',
        indoorPercentage: 95,
        physicalIntensity: 2,
        groupFriendly: false,
        timeSlots: ['morning', 'afternoon']
      },
      {
        id: 'chianti-wine',
        title: 'Degustazione nel Chianti',
        category: 'food',
        location: 'Firenze, Chianti',
        city: 'Firenze',
        description: 'Tour delle cantine storiche con degustazioni',
        price: 65,
        duration: '4 ore',
        rating: 4.8,
        imageUrl: 'https://images.unsplash.com/photo-1474722883778-792e7990302f?w=400&h=300&fit=crop',
        indoorPercentage: 40,
        physicalIntensity: 2,
        groupFriendly: true,
        timeSlots: ['afternoon']
      },
      // Venezia
      {
        id: 'gondola-venice',
        title: 'Tramonto in Gondola',
        category: 'romance',
        location: 'Venezia, Canal Grande',
        city: 'Venezia',
        description: 'Tour romantico tra i canali al tramonto',
        price: 80,
        duration: '1.5 ore',
        rating: 4.9,
        imageUrl: 'https://images.unsplash.com/photo-1523906834658-6e24ef2386f9?w=400&h=300&fit=crop',
        indoorPercentage: 0,
        physicalIntensity: 1,
        groupFriendly: false,
        timeSlots: ['evening']
      },
      {
        id: 'murano-glass',
        title: 'Laboratori del Vetro a Murano',
        category: 'art',
        location: 'Venezia, Murano',
        city: 'Venezia',
        description: 'Visita ai maestri vetrai dell\'isola di Murano',
        price: 45,
        duration: '3 ore',
        rating: 4.5,
        imageUrl: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=300&fit=crop',
        indoorPercentage: 80,
        physicalIntensity: 2,
        groupFriendly: true,
        timeSlots: ['morning', 'afternoon']
      },
      // Napoli
      {
        id: 'pizza-naples',
        title: 'La Vera Pizza Napoletana',
        category: 'food',
        location: 'Napoli, Centro Storico',
        city: 'Napoli',
        description: 'Tour delle pizzerie storiche con degustazioni',
        price: 30,
        duration: '2.5 ore',
        rating: 4.8,
        imageUrl: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&h=300&fit=crop',
        indoorPercentage: 70,
        physicalIntensity: 2,
        groupFriendly: true,
        timeSlots: ['afternoon', 'evening']
      },
      {
        id: 'pompeii-history',
        title: 'Pompei e Vesuvio',
        category: 'history',
        location: 'Napoli, Pompei',
        city: 'Napoli',
        description: 'Escursione archeologica alle città sepolte',
        price: 60,
        duration: '6 ore',
        rating: 4.7,
        imageUrl: 'https://images.unsplash.com/photo-1539650116574-75c0c6d73f6e?w=400&h=300&fit=crop',
        indoorPercentage: 20,
        physicalIntensity: 4,
        groupFriendly: true,
        timeSlots: ['morning']
      }
    ];

    // Filtra per città rilevata o Roma come fallback
    const targetCity = this.extractCityFromLocation(location);
    const cityTours = allTours.filter(tour => 
      tour.city.toLowerCase() === targetCity.toLowerCase()
    );

    // Se non ci sono tour per la città, mostra tour di Roma
    return cityTours.length > 0 ? cityTours : allTours.filter(tour => tour.city === 'Roma');
  }

  private extractCityFromLocation(location: string): string {
    const cityKeywords = {
      'milan': 'Milano',
      'milano': 'Milano', 
      'florence': 'Firenze',
      'firenze': 'Firenze',
      'venice': 'Venezia',
      'venezia': 'Venezia',
      'naples': 'Napoli',
      'napoli': 'Napoli',
      'rome': 'Roma',
      'roma': 'Roma'
    };

    const locationLower = location.toLowerCase();
    
    for (const [keyword, city] of Object.entries(cityKeywords)) {
      if (locationLower.includes(keyword)) {
        return city;
      }
    }
    
    return 'Roma'; // Default fallback
  }

  private scoreTour(
    tour: any,
    preferences: UserPreferences,
    weather: WeatherData,
    timeOfDay: string
  ): TourRecommendation {
    let weatherScore = 0;
    let personalScore = 0;

    // Weather scoring
    if (weather.condition === 'rainy') {
      weatherScore = tour.indoorPercentage / 100 * 5; // Prefer indoor activities
    } else if (weather.condition === 'sunny') {
      weatherScore = (100 - tour.indoorPercentage) / 100 * 5; // Prefer outdoor activities
    } else {
      weatherScore = 3; // Neutral for cloudy weather
    }

    // Temperature adjustment
    if (weather.temperature > 30 && tour.indoorPercentage < 50) {
      weatherScore -= 1; // Too hot for outdoor activities
    }

    // Personal preferences scoring
    if (preferences.categories.includes(tour.category)) {
      personalScore += 2;
    }

    // Budget matching
    const tourPriceCategory = tour.price < 30 ? 'low' : tour.price < 50 ? 'medium' : 'high';
    if (tourPriceCategory === preferences.budgetRange) {
      personalScore += 1;
    }

    // Travel style matching
    if (preferences.travelStyle === 'relaxed' && tour.physicalIntensity <= 2) {
      personalScore += 1;
    } else if (preferences.travelStyle === 'intensive' && tour.physicalIntensity >= 4) {
      personalScore += 1;
    } else if (preferences.travelStyle === 'balanced') {
      personalScore += 0.5;
    }

    // Group size matching
    if (preferences.groupSize === 'large' && tour.groupFriendly) {
      personalScore += 0.5;
    }

    // Time slot availability
    if (tour.timeSlots.includes(timeOfDay)) {
      personalScore += 0.5;
    }

    // Weather sensitivity adjustment
    const weatherWeight = preferences.weatherSensitivity / 5;
    const personalWeight = (5 - preferences.weatherSensitivity) / 5;

    const overallScore = (weatherScore * weatherWeight + personalScore * personalWeight) * tour.rating / 5;

    // Generate explanation
    const reason = this.generateReason(tour, weather, preferences, weatherScore, personalScore);

    // Determine urgency based on weather and time sensitivity
    let urgency: 'low' | 'medium' | 'high' = 'low';
    if (weather.condition === 'sunny' && tour.indoorPercentage < 30) {
      urgency = 'high'; // Perfect weather for outdoor activities
    } else if (weather.condition === 'rainy' && tour.indoorPercentage > 80) {
      urgency = 'medium'; // Good alternative for bad weather
    }

    return {
      id: tour.id,
      title: tour.title,
      category: tour.category,
      location: tour.location,
      description: tour.description,
      price: tour.price,
      duration: tour.duration,
      rating: tour.rating,
      imageUrl: tour.imageUrl,
      weatherScore: Math.round(weatherScore * 10) / 10,
      personalScore: Math.round(personalScore * 10) / 10,
      overallScore: Math.round(overallScore * 10) / 10,
      reason,
      urgency,
      validUntil: new Date(Date.now() + 6 * 60 * 60 * 1000) // Valid for 6 hours
    };
  }

  private generateReason(
    tour: any,
    weather: WeatherData,
    preferences: UserPreferences,
    weatherScore: number,
    personalScore: number
  ): string {
    const reasons: string[] = [];

    if (preferences.categories.includes(tour.category)) {
      const categoryNames: Record<string, string> = {
        food: 'gastronomia',
        history: 'storia',
        art: 'arte',
        nature: 'natura',
        adventure: 'avventura'
      };
      reasons.push(`Perfetto per i tuoi interessi in ${categoryNames[tour.category] || tour.category}`);
    }

    if (weather.condition === 'rainy' && tour.indoorPercentage > 70) {
      reasons.push(`Ideale con la pioggia - ${tour.indoorPercentage}% al coperto`);
    } else if (weather.condition === 'sunny' && tour.indoorPercentage < 50) {
      reasons.push(`Perfetto con il sole - ${weather.temperature}°C ideali`);
    }

    if (tour.rating >= 4.7) {
      reasons.push(`Altamente valutato (${tour.rating}/5)`);
    }

    if (reasons.length === 0) {
      reasons.push('Consigliato in base alle tue preferenze');
    }

    return reasons.join(' • ');
  }

  // Generate smart notifications
  async generateSmartNotifications(
    userId: number,
    preferences: UserPreferences,
    currentLocation: string
  ): Promise<NotificationData[]> {
    const notifications: NotificationData[] = [];
    const weather = await this.getCurrentWeather(currentLocation);
    const timeOfDay = this.getTimeOfDay();
    
    // Weather-based recommendations
    if (weather.condition === 'sunny' && preferences.weatherSensitivity >= 3) {
      const outdoorTours = await this.generateRecommendations(preferences, currentLocation, timeOfDay);
      const bestTour = outdoorTours.find(tour => tour.weatherScore >= 4);
      
      if (bestTour) {
        notifications.push({
          type: 'weather_alert',
          title: 'Tempo Perfetto per Esplorare!',
          message: `${weather.description} - Ideale per "${bestTour.title}"`,
          location: currentLocation,
          imageUrl: bestTour.imageUrl,
          actionType: 'scopri',
          actionData: { tourId: bestTour.id },
          category: 'weather',
          priority: 4,
          expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000) // 4 hours
        });
      }
    }

    // Personalized tour recommendations
    const recommendations = await this.generateRecommendations(preferences, currentLocation, timeOfDay);
    const topRecommendation = recommendations[0];
    
    if (topRecommendation && topRecommendation.overallScore >= 4) {
      notifications.push({
        type: 'tour_recommendation', 
        title: 'Nuovo Tour Perfetto per Te!',
        message: `${topRecommendation.title} - ${topRecommendation.reason}`,
        location: topRecommendation.location,
        imageUrl: topRecommendation.imageUrl,
        actionType: 'prenota',
        actionData: { 
          tourId: topRecommendation.id,
          price: topRecommendation.price,
          specialOffer: Math.random() > 0.7 // 30% chance of special offer
        },
        category: 'tours',
        priority: topRecommendation.urgency === 'high' ? 5 : 3,
        expiresAt: topRecommendation.validUntil
      });
    }

    // Time-sensitive offers
    if (Math.random() > 0.8) { // 20% chance
      notifications.push({
        type: 'tour_recommendation',
        title: 'Offerta Last Minute!',
        message: 'Sconto 25% sui tour che iniziano tra 2 ore - Solo per oggi',
        location: currentLocation,
        actionType: 'prenota',
        actionData: { discount: 25, urgency: true },
        category: 'tours',
        priority: 4,
        expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000)
      });
    }

    return notifications;
  }

  private getTimeOfDay(): 'morning' | 'afternoon' | 'evening' {
    const hour = new Date().getHours();
    if (hour < 12) return 'morning';
    if (hour < 18) return 'afternoon';
    return 'evening';
  }

  // Simulate user behavior analysis
  async analyzeUserBehavior(userId: number): Promise<UserPreferences> {
    // In a real app, this would analyze user's past bookings, likes, searches
    return {
      categories: ['food', 'history'], // Most visited categories
      budgetRange: 'medium',
      travelStyle: 'balanced',
      groupSize: 'small',
      weatherSensitivity: 3
    };
  }
}

export const aiRecommendationService = new AIRecommendationService();