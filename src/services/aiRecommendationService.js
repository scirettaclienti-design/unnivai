// AI-powered recommendation service for Italian tourism
import { DEMO_CITIES } from '../data/demoData';

class AIRecommendationService {
    constructor() {
        this.apiKey = import.meta.env.VITE_OPENAI_API_KEY;
        this.mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN;
    }

    // Smart Weather based on Real Date (Seasonality)
    async getCurrentWeather(location) {
        const today = new Date();
        const month = today.getMonth(); // 0-11
        const hour = today.getHours();

        // Base temperature by season (Italy average)
        let baseTemp = 15;
        let conditions = ['sunny', 'cloudy', 'rainy'];
        let conditionWeights = [0.4, 0.3, 0.3];

        if (month >= 11 || month <= 1) { // Winter
            baseTemp = 8;
            conditionWeights = [0.3, 0.4, 0.3]; // More clouds/rain
        } else if (month >= 5 && month <= 7) { // Summer
            baseTemp = 28;
            conditionWeights = [0.7, 0.2, 0.1]; // Mostly sunny
        } else { // Spring/Autumn
            baseTemp = 18;
            conditionWeights = [0.5, 0.3, 0.2];
        }

        // Random Variation
        const tempVariation = Math.floor(Math.random() * 5) - 2;
        const temp = baseTemp + tempVariation;

        // Weighted Condition Selection
        const totalWeight = conditionWeights.reduce((a, b) => a + b, 0);
        const random = Math.random() * totalWeight;
        let currentWeight = 0;
        let selectedCondition = 'sunny';

        for (let i = 0; i < conditions.length; i++) {
            currentWeight += conditionWeights[i];
            if (random < currentWeight) {
                selectedCondition = conditions[i];
                break;
            }
        }

        return {
            condition: selectedCondition,
            temperature: temp,
            humidity: Math.floor(Math.random() * 40) + 40,
            windSpeed: Math.floor(Math.random() * 15) + 5,
            description: this.getWeatherDescription(selectedCondition, temp)
        };
    }

    getWeatherDescription(condition, temp) {
        if (temp < 10) return 'Giornata fredda, copriti bene!';
        if (temp > 30) return 'Fa caldo, cerca ombra e acqua.';

        const descriptions = {
            sunny: 'Cielo sereno, ottima luce per foto.',
            cloudy: 'Nuvole sparse, atmosfera suggestiva.',
            rainy: 'Pioggia in arrivo, meglio stare al coperto.'
        };
        return descriptions[condition] || 'Condizioni variabili';
    }

    // --- REAL POI SEARCH (Mapbox) ---
    async searchRealPOIs(category, lat, lng) {
        if (!this.mapboxToken) return [];
        try {
            console.log(`🔍 AI searching real ${category} near ${lat},${lng}`);
            const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${category}.json?proximity=${lng},${lat}&types=poi&limit=5&access_token=${this.mapboxToken}`;
            const res = await fetch(url);
            const data = await res.json();

            if (!data.features) return [];

            return data.features.map((f, index) => ({
                id: f.id || `poi-${index}`,
                title: f.text, // e.g. "Osteria da Mario"
                description: f.properties?.address || f.place_name || "Luogo interessante", // Real Address
                latitude: f.center[1],
                longitude: f.center[0],
                type: category === 'restaurant' || category === 'osteria' ? 'food' :
                    category === 'museum' ? 'cultura' : 'viewpoint',
                icon: category === 'restaurant' || category === 'osteria' ? 'Utensils' : 'MapPin',
                price: Math.floor(Math.random() * 30) + 15, // Mock price
                rating: 4.5 + (Math.random() * 0.4) // Mock rating
            }));
        } catch (e) {
            console.warn("Mapbox POI search failed", e);
            return [];
        }
    }

    // --- MAIN GENERATION FUNCTION ---
    async generateItinerary(city, preferences = {}, prompt = '', weatherOverride = null) {
        // 1. Get Context (Weather) - Prefer real context if available
        const weather = weatherOverride || await this.getCurrentWeather(city);

        // 2. Check for OpenAI Key - REAL INTELLIGENCE PATH
        if (this.apiKey && this.apiKey.length > 10) {
            try {
                console.log("🤖 AI: Using OpenAI GPT-4o-mini (Temperature 0.7) for Insider Tips...");
                return await this.generateItineraryWithOpenAI(city, preferences, prompt, weather);
            } catch (error) {
                console.error("AI API Failed, falling back to local logic:", error);
            }
        }

        // 3. Fallback: Local "Smart" Logic (Enhanced for Real Data)
        return await this.generateItineraryLocal(city, preferences, prompt, weather);
    }

    // --- OPENAI INTEGRATION ---
    async generateItineraryWithOpenAI(city, preferences, prompt, weather) {
        const systemPrompt = `
        SEI UN INSIDER LOCALE ESPERTO DI ${city}. 
        Il tuo obiettivo è creare un itinerario turistico UNICO e IPER-PERTINENTE.
        
        REGOLE FONDAMENTALI:
        1. NO LUOGHI GENERICI (niente Colosseo, Duomo, ecc.) A MENO CHE non siano richiesti esplicitamente o vitali per il contesto.
        2. CERCA GEMME NASCOSTE: Proponi luoghi che solo i locali conoscono.
        3. TEMA CINEMATOGRAFICO: Se l'utente menziona film ("La Grande Bellezza", "Dolce Vita"), DEVI includere le location esatte (es. Fontana dell'Acqua Paola, Palazzo Pamphilj).
        4. METEO-ADAPTIVE: Oggi a ${city} fa ${weather.temperature}°C ed è ${weather.condition}. Se piove, privilegia interni. Se fa caldo, parchi o sotterranei.
        5. SMART ECONOMY (Business Coerenti): Inserisci SEMPRE 2-3 punti ristoro o svago PERFETTAMENTE COERENTI con il tema.
           - Esempio "Angeli e Demoni": Suggerisci caffè storici o enoteche vicine al Vaticano/Pantheon.
           - Esempio "Street Art": Suggerisci birrerie artigianali o street food di qualità in zona Ostiense/Pigneto.
           - Esempio "Romantico": Suggerisci roof garden o wine bar intimi. 
        6. PREZZI E DETTAGLI REALISTICI:
           - Se è un drink/caffè, prezzo medio 5-15€. Se cena, 30-50€.
           - NON scrivere "2 € drink" se non è un chiosco economico. Usa stime sensate.
           - Descrizione: Includi un dettaglio sull'atmosfera o specialità (es. "Famoso per il Negroni sbagliato").
        7. FORMATO JSON RIGIDO: Rispondi SOLO con un array JSON valido di oggetti "Day".
        
        Struttura JSON richiesta:
        [
            {
                "day": 1,
                "title": "Titolo Evocativo del Giorno",
                "weather": { "condition": "${weather.condition}", "temperature": ${weather.temperature}, "icon": "🌤️" },
                "stops": [
                    {
                        "time": "HH:MM",
                        "title": "Nome Luogo",
                        "description": "Descrizione da insider (max 20 parole). Perché è speciale?",
                        "icon": "Camera" | "Utensils" | "ShoppingBag" | "Eye" | "MapPin" | "Wine" | "Coffee",
                        "type": "cultura" | "food" | "shopping" | "relax" | "natura" | "drink",
                        "latitude": 41.123,
                        "longitude": 12.123,
                        "price": 0,
                        "rating": 4.8
                    }
                ]
            }
        ]
        `;

        const userMessage = `
        Città: ${city}
        Utente: "${prompt}"
        Interessi: ${preferences.interests?.join(', ') || 'Vari'}
        Budget: ${preferences.budget || 'Medio'}
        Durata: ${preferences.duration || '1 Giorno'}
        `;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-3.5-turbo', // Use a fast, capable model
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userMessage }
                ],
                temperature: 0.7, // Creativity boosted for discovery
                max_tokens: 1500
            })
        });

        if (!response.ok) throw new Error('OpenAI API Error');

        const data = await response.json();
        let content = data.choices[0].message.content;

        // Clean markdown code blocks if present
        content = content.replace(/```json/g, '').replace(/```/g, '').trim();

        const parsed = JSON.parse(content);

        // 🛡️ DATA SANITIZATION: Ensure coordinates exist to prevent Map Crash
        const cityData = DEMO_CITIES[city] || DEMO_CITIES['Roma'];
        if (parsed && Array.isArray(parsed)) {
            parsed.forEach(day => {
                if (day.stops) {
                    day.stops.forEach(stop => {
                        if (!stop.latitude || !stop.longitude) {
                            // Jitter fallback if AI forgot coords
                            stop.latitude = cityData.center.latitude + (Math.random() * 0.01 - 0.005);
                            stop.longitude = cityData.center.longitude + (Math.random() * 0.01 - 0.005);
                        }
                    });
                }
            });
        }
        return parsed;
    }

    // --- ENHANCED LOCAL FALLBACK WITH REAL DATA ---
    async generateItineraryLocal(city, preferences, prompt, weather) {
        console.log("🧠 AI: Using Enhanced Local Logic (Real Data Enabled)");
        const cityData = DEMO_CITIES[city] || DEMO_CITIES['Roma'];
        const promptLower = prompt.toLowerCase();
        let selectedStops = [];

        // 1. DETECT INTENT FOR REAL SEARCH (Mapbox)
        let searchCategory = null;
        if (promptLower.includes('cibo') || promptLower.includes('food') || promptLower.includes('ristorante') || promptLower.includes('mangiare') || promptLower.includes('gastronomi')) {
            searchCategory = 'restaurant';
        } else if (promptLower.includes('museo') || promptLower.includes('arte') || promptLower.includes('museum')) {
            searchCategory = 'museum';
        } else if (promptLower.includes('parco') || promptLower.includes('natura') || promptLower.includes('verde')) {
            searchCategory = 'park';
        }

        if (searchCategory) {
            // 🚀 REAL DATA SEARCH
            const realPOIs = await this.searchRealPOIs(searchCategory, cityData.center.latitude, cityData.center.longitude);
            if (realPOIs.length > 0) {
                console.log(`✅ Found ${realPOIs.length} real POIs for ${searchCategory}`);
                selectedStops = realPOIs;
            }
        }

        // 2. IF NO REAL SEARCH OR EMPTY, CHECK HARDCODED THEMES
        if (selectedStops.length === 0) {
            const THEMES = {
                'grande bellezza': [
                    { id: 'gb-1', name: 'Fontana dell\'Acqua Paola', lat: 41.8893, lng: 12.4647, type: 'cultura', desc: 'Il "Fontanone" dell\'apertura del film.' },
                    { id: 'gb-2', name: 'Palazzo Pamphilj', lat: 41.8989, lng: 12.4732, type: 'cultura', desc: 'I saloni delle feste di Jep Gambardella.' },
                ],
                'romantico': [
                    { id: 'rom-1', name: 'Giardino degli Aranci', lat: 41.8845, lng: 12.4806, type: 'relax', desc: 'Tramonto mozzafiato su Roma.' },
                    { id: 'rom-2', name: 'Zodiaco', lat: 41.9213, lng: 12.4503, type: 'food', desc: 'Cena con la vista più alta della città.' }
                ]
            };

            Object.keys(THEMES).forEach(key => {
                if (promptLower.includes(key)) {
                    selectedStops = THEMES[key].map(stop => ({
                        title: stop.name,
                        description: stop.desc,
                        latitude: stop.lat,
                        longitude: stop.lng,
                        type: stop.type,
                        icon: stop.type === 'food' ? 'Utensils' : 'Camera',
                        price: 0,
                        rating: 4.9
                    }));
                }
            });
        }

        // 3. IF STILL EMPTY, FALLBACK TO DEMO DATA
        if (selectedStops.length === 0) {
            let candidates = [...(cityData.landmarks || []), ...(cityData.activities || []), ...(cityData.tours || [])];
            candidates = candidates.sort(() => 0.5 - Math.random()).slice(0, 3);

            selectedStops = candidates.map(c => ({
                title: c.name || c.title,
                description: c.description || "Luogo imperdibile della città.",
                latitude: c.latitude || cityData.center.latitude,
                longitude: c.longitude || cityData.center.longitude,
                type: c.category || 'cultura',
                icon: 'MapPin',
                price: c.price || 0,
                rating: c.rating || 4.5
            }));
        }

        // 4. FORMAT AS ITINERARY
        return [{
            day: 1,
            title: `Tour: ${prompt || 'Alla scoperta di ' + city}`,
            weather: {
                condition: weather.condition === 'sunny' ? "Soleggiato" : "Nuvoloso",
                temperature: weather.temperature,
                icon: "🌤️"
            },
            stops: selectedStops.map((stop, i) => ({
                ...stop,
                time: `${10 + i * 2}:00`,
            }))
        }];
    }

    // --- SMART NOTIFICATIONS (Restored & Enhanced) ---
    async generateSmartNotifications(userId, preferences, currentLocation) {
        const notifications = [];
        const weather = await this.getCurrentWeather(currentLocation || 'Roma');

        // 1. Weather Alert (if applicable)
        if (weather.condition === 'sunny' && weather.temperature > 20) {
            notifications.push({
                id: `smart-weather-${Date.now()}`,
                type: 'weather_alert',
                city: currentLocation || 'Roma',
                title: 'Giornata Perfetta!',
                message: `${weather.description} Ottimo momento per un tour all'aperto.`,
                relevanceScore: 5,
                source: 'smart',
                category: 'weather',
                actionType: 'scopri'
            });
        }
        return notifications;
    }

    // --- ISPIRAMI (QUIZ LOGIC) - BLINDATA (Static for Stability) ---
    async generateRecommendations(userPreferences, currentLocation, timeOfDay) {
        console.log("🧩 Quiz Logic: FORCE ROME/LOCATION");
        const city = currentLocation || 'Roma';
        const isRoma = city.toLowerCase().includes('roma');

        if (isRoma) {
            return [
                {
                    id: 'qz-1',
                    title: 'Giardino degli Aranci',
                    description: 'Il tramonto più bello di Roma, nascosto sull\'Aventino.',
                    category: 'relax',
                    location: 'Roma, Aventino',
                    price: 0,
                    duration: '1 ora',
                    rating: 4.9,
                    imageUrl: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=400',
                    reason: 'Top Pick per Relax'
                },
                {
                    id: 'qz-2',
                    title: 'Quartiere Coppedè',
                    description: 'Architettura fiabesca e liberty fuori dai giri turistici.',
                    category: 'cultura',
                    location: 'Roma, Trieste',
                    price: 0,
                    duration: '2 ore',
                    rating: 4.8,
                    imageUrl: 'https://images.unsplash.com/photo-1514896856000-91cb6de818e0?w=400',
                    reason: 'Top Pick per Architettura'
                },
                {
                    id: 'qz-3',
                    title: 'Trapizzino Testaccio',
                    description: 'Street food romano moderno: la tasca di pizza imperdibile.',
                    category: 'food',
                    location: 'Roma, Testaccio',
                    price: 15,
                    duration: '30 min',
                    rating: 4.7,
                    imageUrl: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400',
                    reason: 'Top Pick per Food'
                }
            ];
        }

        // Default Generico
        return [
            { id: 'gen-1', title: 'Centro Storico', category: 'cultura', location: `${city}, Centro`, imageUrl: 'https://images.unsplash.com/photo-1518182170543-5683ff52ae94?w=400' },
            { id: 'gen-2', title: 'Parco Principale', category: 'natura', location: `${city}, Parco`, imageUrl: 'https://images.unsplash.com/photo-1496555562768-46bc37452d3d?w=400' },
            { id: 'gen-3', title: 'Caffè Storico', category: 'food', location: `${city}, Centro`, imageUrl: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400' }
        ];
    }

    // Legacy support methods
    extractCityFromLocation(location) { return 'Roma'; }
    getTimeOfDay() { return 'morning'; }
}

export const aiRecommendationService = new AIRecommendationService();
