// AI-powered recommendation service for Italian tourism
import { DEMO_CITIES } from '../data/demoData';

class AIRecommendationService {
    // Simulate weather API calls
    async getCurrentWeather(location) {
        // In a real app, this would call a weather API
        const weatherConditions = ['sunny', 'cloudy', 'rainy'];
        const randomCondition = weatherConditions[Math.floor(Math.random() * weatherConditions.length)];

        return {
            condition: randomCondition,
            temperature: Math.floor(Math.random() * 20) + 15, // 15-35°C
            humidity: Math.floor(Math.random() * 40) + 40, // 40-80%
            windSpeed: Math.floor(Math.random() * 15) + 5, // 5-20 km/h
            description: this.getWeatherDescription(randomCondition)
        };
    }

    getWeatherDescription(condition) {
        const descriptions = {
            sunny: 'Sole splendente, perfetto per esplorare',
            cloudy: 'Nuvoloso ma piacevole per camminare',
            rainy: 'Pioggerella, ideale per musei e interni'
        };
        return descriptions[condition] || 'Condizioni variabili';
    }

    // Generate smart tour recommendations
    async generateRecommendations(
        userPreferences,
        currentLocation,
        timeOfDay
    ) {
        const weather = await this.getCurrentWeather(currentLocation);
        const availableTours = this.getAvailableTours(currentLocation);

        return availableTours
            .map(tour => this.scoreTour(tour, userPreferences, weather, timeOfDay))
            .sort((a, b) => b.overallScore - a.overallScore)
            .slice(0, 5); // Top 5 recommendations
    }

    getAvailableTours(location) {
        // Integrate with DEMO_CITIES for consistent data
        const demoTours = [];

        Object.entries(DEMO_CITIES).forEach(([cityName, cityData]) => {
            // Map activities to Tour format
            (cityData.activities || []).forEach(act => {
                demoTours.push({
                    id: act.id,
                    title: act.name,
                    category: act.category,
                    location: `${cityName}, ${act.name}`,
                    city: cityName,
                    description: act.description,
                    price: act.level === 'free' ? 0 : 25,
                    duration: '2 ore',
                    rating: 4.8,
                    imageUrl: act.image || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=400&h=300&fit=crop',
                    indoorPercentage: act.category === 'culture' ? 80 : 10,
                    physicalIntensity: 2,
                    groupFriendly: true,
                    timeSlots: ['morning', 'afternoon', 'evening'],
                    latitude: act.latitude,
                    longitude: act.longitude
                });
            });

            // Map tours to Tour format
            (cityData.tours || []).forEach(tour => {
                demoTours.push({
                    ...tour,
                    city: cityName,
                    indoorPercentage: 50,
                    physicalIntensity: 3,
                    groupFriendly: true,
                    timeSlots: ['morning', 'afternoon'],
                    latitude: cityData.center.latitude, // Approximation if tour has no specific lat/long
                    longitude: cityData.center.longitude
                });
            });
        });

        // Database tour espanso con più città italiane (Legacy Hardcoded)
        const allTours = [
            ...demoTours,
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

    extractCityFromLocation(location) {
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

    scoreTour(
        tour,
        preferences,
        weather,
        timeOfDay
    ) {
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
        let urgency = 'low';
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

    generateReason(
        tour,
        weather,
        preferences,
        weatherScore,
        personalScore
    ) {
        const reasons = [];

        if (preferences.categories.includes(tour.category)) {
            const categoryNames = {
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

    // Generate smart notifications (Unified Schema)
    async generateSmartNotifications(
        userId,
        preferences,
        currentLocation
    ) {
        const notifications = [];
        const weather = await this.getCurrentWeather(currentLocation);
        const timeOfDay = this.getTimeOfDay();
        const cityContext = currentLocation || 'Roma';

        // 1. Weather-based recommendations
        if (weather.condition === 'sunny' && preferences.weatherSensitivity >= 3) {
            const outdoorTours = await this.generateRecommendations(preferences, cityContext, timeOfDay);
            const bestTour = outdoorTours.find(tour => tour.weatherScore >= 4);

            if (bestTour) {
                notifications.push({
                    id: `smart-weather-${Date.now()}`,
                    type: 'weather_alert',
                    city: cityContext,
                    title: 'Tempo Perfetto per Esplorare!',
                    message: `${weather.description} - Ideale per "${bestTour.title}"`,
                    relevanceScore: 5,
                    createdAt: new Date().toISOString(),
                    readAt: null,
                    source: 'smart',
                    // Legacy/UI Ext
                    location: cityContext,
                    imageUrl: bestTour.imageUrl,
                    actionType: 'scopri',
                    actionData: { tourId: bestTour.id },
                    category: 'weather'
                });
            }
        }

        // 2. Personalized tour recommendations
        const recommendations = await this.generateRecommendations(preferences, cityContext, timeOfDay);
        const topRecommendation = recommendations[0];

        if (topRecommendation && topRecommendation.overallScore >= 4) {
            notifications.push({
                id: `smart-tour-${Date.now()}`,
                type: 'tour_recommendation',
                city: cityContext,
                title: 'Nuovo Tour Perfetto per Te!',
                message: `${topRecommendation.title} - ${topRecommendation.reason}`,
                relevanceScore: topRecommendation.urgency === 'high' ? 5 : 4,
                createdAt: new Date().toISOString(),
                readAt: null,
                source: 'smart',
                // Legacy/UI Ext
                location: topRecommendation.location,
                imageUrl: topRecommendation.imageUrl,
                actionType: 'prenota',
                actionData: {
                    tourId: topRecommendation.id,
                    price: topRecommendation.price,
                },
                category: 'tours'
            });
        }

        // 3. Social Activity (New Generator)
        if (Math.random() > 0.6) {
            notifications.push({
                id: `smart-social-${Date.now()}`,
                type: 'social_activity',
                city: cityContext,
                title: 'La tua guida preferita è live!',
                message: 'Maria Benedetti ha appena iniziato un tour a ' + cityContext,
                relevanceScore: 3,
                createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(), // 5 mins ago
                readAt: null,
                source: 'smart',
                // Legacy/UI Ext
                actionType: 'vedi_live',
                actionData: { guideId: 'maria-benedetti' },
                category: 'social'
            });
        }

        return notifications;
    }

    getTimeOfDay() {
        const hour = new Date().getHours();
        if (hour < 12) return 'morning';
        if (hour < 18) return 'afternoon';
        return 'evening';
    }

    async generateSurpriseTour(city, userPreferences = {}, filterType = null) {
        // 1. Get Base Recommendations (ranked by AI)
        const timeOfDay = this.getTimeOfDay();
        let candidates = await this.generateRecommendations(userPreferences, city, timeOfDay);

        // 2. Apply Category Filter
        if (filterType) {
            // Map UI filter to internal categories
            const map = {
                'Gastronomia': 'food',
                'Arte': 'culture',
                'Natura': 'adventure'
            };
            const internalCategory = map[filterType];
            if (internalCategory) {
                candidates = candidates.filter(t => t.category === internalCategory);
            }
        }

        // 3. Fallback if specific filtering left no results
        if (candidates.length === 0) {
            candidates = await this.generateRecommendations({}, city, timeOfDay);
        }

        // 4. Select Winner (Weighted Random from top 3)
        const topCandidates = candidates.slice(0, 3);
        return topCandidates[Math.floor(Math.random() * topCandidates.length)];
    }

    // Generate Multi-Day Itinerary based on Prompt & Preferences
    async generateItinerary(city, preferences = {}, prompt = '') {
        const cityData = DEMO_CITIES[city] || DEMO_CITIES['Roma'];
        const allCandidates = [
            ...(cityData.landmarks || []).map(l => ({ ...l, type: 'landmark', price: 0, duration: 60 })), // Landmarks usually free/cheap
            ...(cityData.activities || []).map(a => ({ ...a, type: a.category, duration: 90 })),
            ...(cityData.tours || []).map(t => ({ ...t, type: 'tour', duration: 180 }))
        ];

        // 1. Filter by Interests (if specified)
        // Map UI interests to internal types
        const interestMap = {
            'Arte': ['culture', 'art', 'landmark'],
            'Storia': ['culture', 'history', 'landmark'],
            'Cibo': ['food', 'gastronomy'],
            'Natura': ['nature', 'park', 'adventure'],
            'Shopping': ['shop', 'shopping'],
            'Vita Notturna': ['nightlife', 'bar', 'romance']
        };

        const userInterests = preferences.interests || [];
        const allowedTypes = userInterests.length > 0
            ? userInterests.flatMap(i => interestMap[i] || [])
            : [];

        // Score candidates
        const scoredCandidates = allCandidates.map(item => {
            let score = 5; // Base score
            // Interest Match
            if (allowedTypes.length > 0) {
                if (allowedTypes.includes(item.category) || allowedTypes.includes(item.type)) score += 10;
            } else {
                // If no interests, everything is fair game, landmarks boosted
                if (item.type === 'landmark') score += 5;
            }

            // Budget Match
            if (preferences.budget === 'Economico' && (item.price === 0 || item.level === 'free')) score += 5;
            if (preferences.budget === 'Lusso' && (item.price > 50 || item.level === 'premium')) score += 5;

            // Prompt keyword match (simple)
            if (prompt) {
                const terms = prompt.toLowerCase().split(' ');
                terms.forEach(term => {
                    if (item.name?.toLowerCase().includes(term) || item.description?.toLowerCase().includes(term)) {
                        score += 15;
                    }
                });
            }

            return { ...item, matchScore: score };
        });

        // Sort by score
        scoredCandidates.sort((a, b) => b.matchScore - a.matchScore);

        // --- INTELLIGENT SEARCH HIERARCHY (Zona -> Città -> Provincia) ---
        const bestScore = scoredCandidates[0]?.matchScore || 0;
        const searchTerms = prompt ? prompt.toLowerCase() : '';

        // Thresholds: Strict Match > 20, Loose Match > 10

        if (prompt && bestScore < 15) {
            console.log(`AI: Nessun match esatto per "${prompt}". Espansione raggio ricerca.`);

            // Tier 1: Generate ONE "Bridge" item for the requested Zone (The "Specifico")
            // This satisfies "Show me results for a specific zone"
            const syntheticTitle = prompt.split(' ').slice(0, 3).join(' ').replace(/\b\w/g, l => l.toUpperCase());
            const zoneBridgeItem = {
                id: `ai-zone-${Date.now()}`,
                name: `${syntheticTitle} (Zona Richiesta)`,
                title: `${syntheticTitle}`,
                description: `Punto di interesse nell'area di "${prompt}". Selezionato per la tua richiesta specifica.`,
                category: 'special',
                type: 'special',
                latitude: cityData.center.latitude + (Math.random() * 0.01 - 0.005),
                longitude: cityData.center.longitude + (Math.random() * 0.01 - 0.005),
                price: 0,
                duration: 60,
                rating: 4.5,
                matchScore: 100, // Top priority
                tags: ['zona_specifica']
            };
            scoredCandidates.unshift(zoneBridgeItem);

            // Tier 2: City Fallback is already in 'allCandidates' (Rome Center etc)
            // We boost them slightly to ensure they are picked as "Nearby Alternatives"
            scoredCandidates.forEach(cand => {
                if (cand.id !== zoneBridgeItem.id) {
                    cand.matchScore += 5; // Boost availability
                    cand.description = `(In Città) ${cand.description}`; // Add context label
                }
            });

            // Tier 3: Province/Region Fallback (If we still need filler)
            // Add generic "Out of Town" options if we are short on stops
            const provinceFallbacks = [
                {
                    id: 'prov-1',
                    name: 'Agriturismo dei Colli',
                    title: 'Agriturismo dei Colli',
                    category: 'food',
                    type: 'gastronomy',
                    description: '(Provincia) Pranzo rustico a pochi km dalla città.',
                    price: 35,
                    duration: 180,
                    latitude: cityData.center.latitude + 0.1,
                    longitude: cityData.center.longitude + 0.1,
                    matchScore: 10
                },
                {
                    id: 'prov-2',
                    name: 'Escursione Naturale',
                    title: 'Parco Regionale',
                    category: 'nature',
                    type: 'nature',
                    description: '(Provincia) Passeggiata nel verde fuori porta.',
                    price: 0,
                    duration: 240,
                    latitude: cityData.center.latitude - 0.1,
                    longitude: cityData.center.longitude - 0.1,
                    matchScore: 10
                }
            ];

            // Only add province items if we don't have enough city items or prompt implies "Nature/Wide"
            scoredCandidates.push(...provinceFallbacks);
        }
        // -------------------------------------------------------------

        // Determine number of stops based on duration
        let stopsCount = 3;
        if (preferences.duration === '1 Giorno') stopsCount = 5;
        if (preferences.duration === '2-3 Giorni') stopsCount = 8;

        let paceModifier = 0;
        if (preferences.pace === 'Intenso') paceModifier = 2;
        if (preferences.pace === 'Rilassato') paceModifier = -1;

        stopsCount += paceModifier;
        if (stopsCount < 2) stopsCount = 2; // Minimum

        // Re-Sort after boosting/adding fallback
        const finalSelection = scoredCandidates
            .sort((a, b) => b.matchScore - a.matchScore)
            .slice(0, stopsCount);

        // Group into days
        const days = [];
        const stopsPerDay = Math.ceil(finalSelection.length / (preferences.duration === '2-3 Giorni' ? 2 : 1));

        for (let i = 0; i < finalSelection.length; i += stopsPerDay) {
            const dayStops = finalSelection.slice(i, i + stopsPerDay);
            const dayNum = days.length + 1;

            // Assign fake times
            const timedStops = dayStops.map((stop, idx) => ({
                id: stop.id,
                time: `${9 + idx * 3}:00`,
                title: stop.name || stop.title,
                description: stop.description || stop.type,
                icon: 'Camera',
                type: stop.category || stop.type,
                location: (typeof stop.location === 'string' ? stop.location : city),
                latitude: stop.latitude || cityData.center.latitude,
                longitude: stop.longitude || cityData.center.longitude,
                price: stop.price || 0,
                rating: stop.rating || 4.5
            }));

            days.push({
                day: dayNum,
                title: `Giorno ${dayNum} - ${prompt && bestScore < 15 ? 'Esplorazione Città e Dintorni' : 'Alla scoperta di ' + city}`,
                weather: { condition: "Soleggiato", temperature: 24, icon: "☀️" },
                stops: timedStops
            });
        }

        return days;
    }

    // Simulate user behavior analysis
    async analyzeUserBehavior(userId) {
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
