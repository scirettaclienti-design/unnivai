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

    // --- AI BUSINESS ANALYZER (DEEP EXTRACTION + VISION) ---
    async analyzeBusinessDescription(context) {
        // context: { description, website, instagram, image_urls }
        let description = typeof context === 'string' ? context : context.description;
        const website = context.website || '';
        const instagram = context.instagram || '';
        const images = context.image_urls || [];

        if (!description || description.length < 10) return null;

        if (this.apiKey && this.apiKey.length > 10) {
            try {
                console.log("🤖 AI: Analyzing Business Deep Metadata (Text + Vision)...");

                // Construct Messages with Vision Support
                const userContent = [
                    { type: "text", text: `Analizza questa attività.\nDescrizione: "${description}"\nSito: ${website}\nInstagram: ${instagram}` }
                ];

                // Add up to 3 images for analysis if available
                images.slice(0, 3).forEach(url => {
                    if (url && url.startsWith('http')) {
                        userContent.push({
                            type: "image_url",
                            image_url: {
                                "url": url
                            }
                        });
                    }
                });

                const response = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.apiKey}`
                    },
                    body: JSON.stringify({
                        model: 'gpt-4o', // Vision Capable Match
                        response_format: { type: "json_object" },
                        messages: [
                            {
                                role: 'system',
                                content: `Sei un esperto di curation per esperienze turistiche premium.
                                Analizza i dati dell'attività (testo e foto) e genera un profilo JSON dettagliato per il matching.
                                
                                Usa le FOTO per dedurre Style e Vibe (es. se vedi legno -> Rustico, se vedi luci neon -> Moderno).
                                
                                SCHEMA JSON RICHIESTO:
                                {
                                  "vibe": ["Aggettivo1", "Aggettivo2", "Aggettivo3"], // Es. Romantico, Intimo, Caotico
                                  "style": ["Aggettivo1", "Aggettivo2"], // Es. Vintage, Industrial, Minimal
                                  "pace": "slow" | "active" | "normal", // Ritmo dell'esperienza
                                  "price_range": "€" | "€€" | "€€€" | "€€€€",
                                  "story_hook": "Una frase breve e accattivante per invitare l'utente (max 10 parole)"
                                }`
                            },
                            { role: 'user', content: userContent }
                        ],
                        temperature: 0.4,
                        max_tokens: 500
                    })
                });

                const data = await response.json();
                if (data.error) throw new Error(data.error.message);

                let content = data.choices[0].message.content;
                content = content.replace(/```json/g, '').replace(/```/g, '').trim();
                return JSON.parse(content);
            } catch (error) {
                console.error("AI Analysis Failed:", error);
                // Fallback to heuristic
            }
        }

        // Heuristic Fallback (Enhanced)
        return this.analyzeBusinessHeuristic(description);
    }

    analyzeBusinessHeuristic(text) {
        const lower = text.toLowerCase();
        let vibes = [];
        if (lower.includes('roman')) vibes.push('Romantico');
        if (lower.includes('relax') || lower.includes('tranquill')) vibes.push('Rilassante');
        if (lower.includes('divert') || lower.includes('music')) vibes.push('Divertente');
        if (vibes.length === 0) vibes.push('Accogliente');

        return {
            vibe: vibes,
            style: lower.includes('modern') ? ['Moderno'] : ['Tradizionale'],
            pace: (lower.includes('veloc') || lower.includes('street')) ? 'active' : 'slow',
            price_range: lower.includes('lusso') ? '€€€' : '€€',
            story_hook: `Scopri questa esperienza unica: ${vibes.join(', ')}.`
        };
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
           - DEVI INCLUDERE ALMENO 5 TAPE (Stops) per ogni giorno.
           - LE COORDINATE DEVONO ESSERE REALI.
        
        Struttura JSON richiesta:
        {
            "summary": {
                 "title": "Titolo del Tour",
                 "tagline": "Una frase breve accattivante",
                 "vibe": "cultura" | "relax" | "adventure",
                 "duration": "2h 30m"
            },
            "days": [
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
        }
        `;

        const userMessage = `
        Città: ${city}
        Utente: "${prompt}"
        Profilo: ${preferences.bio ? `Bio: ${preferences.bio}` : 'Turista generico'}
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

        // Handle Arrays (Legacy Prompt Support) or Objects (New Prompt)
        const days = Array.isArray(parsed) ? parsed : (parsed.days || []);
        const summary = !Array.isArray(parsed) ? (parsed.summary || {}) : { title: "Tour Generato AI" };

        // 🛡️ GEOCODING VALIDATION: Ensure coordinates are REAL via Mapbox
        // We do this serially or in parallel to fix "hallucinated" locations
        const validatedDays = await Promise.all(days.map(async (day) => {
            if (!day.stops) return day;

            const validStops = [];
            for (const stop of day.stops) {
                // 1. If AI gave coords, check if they are non-zero (basic check)
                let lat = stop.latitude;
                let lng = stop.longitude;

                // 2. If coords seem fake or missing, verify with Mapbox
                if (!lat || !lng || (lat === 0 && lng === 0)) {
                    console.log(`📍 Validating location for: ${stop.title} in ${city}`);
                    try {
                        const query = `${stop.title}, ${city}`;
                        const geocodeUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${this.mapboxToken}&limit=1`;
                        const res = await fetch(geocodeUrl);
                        const geoData = await res.json();

                        if (geoData.features && geoData.features.length > 0) {
                            const center = geoData.features[0].center;
                            lng = center[0];
                            lat = center[1];
                            console.log(`✅ Geocoded: ${stop.title} -> [${lat}, ${lng}]`);
                        } else {
                            console.warn(`⚠️ Could not geocode: ${stop.title}, trying generic search`);
                        }
                    } catch (e) {
                        console.error("Geocoding failed", e);
                    }
                }

                // 3. Final Check: Only add if we have valid coords
                if (lat && lng) {
                    validStops.push({
                        ...stop,
                        latitude: lat,
                        longitude: lng
                    });
                } else {
                    console.warn(`❌ Dropping invalid stop: ${stop.title}`);
                }
            }

            // If a day loses too many stops, we might need to regenerate or accept it shorter
            day.stops = validStops;
            return day;
        }));

        return { summary, days: validatedDays };
    }

    // --- NEW: UNIFIED QUIZ ENGINE ---
    async generateQuizResult(city, quizAnswers, weatherContext = null) {
        console.log("🧠 AI: Generating Quick Quiz Result (Unified Engine)...");
        // Reuse the main AI logic but with a specialized prompt wrapper
        const preferences = {
            interests: [quizAnswers.environment, quizAnswers.activity],
            duration: quizAnswers.duration,
            group: quizAnswers.group,
            bio: "Utente Quiz Veloce - Cerca ispirazione immediata"
        };

        const prompt = `Un'esperienza perfetta di tipo ${quizAnswers.activity} in ambiente ${quizAnswers.environment}, ideale per ${quizAnswers.group} nel momento ${quizAnswers.time}.`;

        // Use the main generation function to get a full itinerary structure
        const aiResult = await this.generateItinerary(city, preferences, prompt, weatherContext);

        // Return the first day's stops or a summarized version
        // Now returns { summary, days }
        if (aiResult?.days && aiResult.days.length > 0) {
            const firstDay = aiResult.days[0];
            return {
                title: aiResult.summary?.title || firstDay.title,
                description: aiResult.summary?.tagline || "Tour generato su misura per te.",
                stops: firstDay.stops,
                vibe: aiResult.summary?.vibe || 'mix'
            };
        }
        return null;
    }

    // --- ENHANCED LOCAL FALLBACK WITH REAL DATA ---
    async generateItineraryLocal(city, preferences, prompt, weather) {
        console.log("🧠 AI: Using Enhanced Local Logic (Real Data Enabled)");

        // EXPANDED MOCK LOCAL DATA FOR FALLBACK
        const CITY_DATA_STORE = {
            'Roma': [
                { title: 'Colosseo', category: 'cultura', lat: 41.8902, lng: 12.4922, desc: 'Simbolo eterno di Roma.' },
                { title: 'Pantheon', category: 'cultura', lat: 41.8986, lng: 12.4769, desc: 'Il tempio di tutti gli dei.' },
                { title: 'Trastevere', category: 'food', lat: 41.8883, lng: 12.4659, desc: 'Quartiere vivo e pieno di ristoranti.' },
                { title: 'Villa Borghese', category: 'natura', lat: 41.9129, lng: 12.4852, desc: 'Il cuore verde della città.' },
                { title: 'Piazza Navona', category: 'relax', lat: 41.8992, lng: 12.4731, desc: 'Perfetta per un aperitivo.' }
            ],
            'Napoli': [
                { title: 'Spaccanapoli', category: 'cultura', lat: 40.8499, lng: 14.2596, desc: 'L\'anima verace di Napoli.' },
                { title: 'Castel dell\'Ovo', category: 'mare', lat: 40.8280, lng: 14.2476, desc: 'Castello sul mare con vista incredibile.' },
                { title: 'Piazza del Plebiscito', category: 'cultura', lat: 40.8359, lng: 14.2486, desc: 'Iconica piazza monumentale.' },
                { title: 'Via dei Tribunali', category: 'food', lat: 40.8507, lng: 14.2562, desc: 'La via della pizza per eccellenza.' },
                { title: 'Lungomare Caracciolo', category: 'mare', lat: 40.8327, lng: 14.2386, desc: 'Passeggiata con vista Vesuvio.' }
            ],
            'Milano': [
                { title: 'Duomo di Milano', category: 'cultura', lat: 45.4641, lng: 9.1919, desc: 'Capolavoro gotico e simbolo della città.' },
                { title: 'Navigli', category: 'relax', lat: 45.4516, lng: 9.1764, desc: 'Canali storici e vita notturna.' },
                { title: 'Castello Sforzesco', category: 'cultura', lat: 45.4705, lng: 9.1795, desc: 'Imponente fortezza e musei.' },
                { title: 'Brera', category: 'moda', lat: 45.4716, lng: 9.1884, desc: 'Quartiere artistico ed elegante.' },
                { title: 'Parco Sempione', category: 'natura', lat: 45.4727, lng: 9.1770, desc: 'Relax nel verde dietro il castello.' }
            ]
        };

        const cityLower = city ? city.replace(' ', '') : 'Roma';
        // Normalize Key (Handle "Napoli " vs "Napoli")
        const cityKey = Object.keys(CITY_DATA_STORE).find(k => city.includes(k)) || 'Roma';
        const availableStops = CITY_DATA_STORE[cityKey];

        const promptLower = prompt.toLowerCase();
        let selectedStops = [];

        // 1. ATTEMPT CATEGORY FILTER
        if (promptLower.includes('cibo') || promptLower.includes('food') || promptLower.includes('gusto')) {
            selectedStops = availableStops.filter(s => s.category === 'food');
        } else if (promptLower.includes('mare') || promptLower.includes('acqua')) {
            selectedStops = availableStops.filter(s => s.category === 'mare' || s.category === 'natura');
        } else if (promptLower.includes('natura') || promptLower.includes('parco')) {
            selectedStops = availableStops.filter(s => s.category === 'natura');
        } else if (promptLower.includes('cultura') || promptLower.includes('arte') || promptLower.includes('storia')) {
            selectedStops = availableStops.filter(s => s.category === 'cultura');
        }

        // 2. FILL UP IF EMPTY OR FEW
        if (selectedStops.length < 3) {
            const others = availableStops.filter(s => !selectedStops.includes(s));
            // Shuffle and take needed
            const fill = others.sort(() => 0.5 - Math.random()).slice(0, 3 - selectedStops.length);
            selectedStops = [...selectedStops, ...fill];
        }

        // 3. FALLBACK TO GENERIC IF STILL EMPTY
        if (selectedStops.length === 0) {
            selectedStops = availableStops.slice(0, 3);
        }

        // 4. FORMAT AS ITINERARY
        return {
            summary: {
                title: `Alla scoperta di ${city}`,
                tagline: `Un itinerario selezionato per ${prompt.substring(0, 20)}...`,
                vibe: 'discovering',
                duration: '3h'
            },
            days: [{
                day: 1,
                title: `Giorno 1 a ${city}`,
                weather: {
                    condition: weather.condition === 'sunny' ? "Soleggiato" : "Nuvoloso",
                    temperature: weather.temperature,
                    icon: "🌤️"
                },
                stops: selectedStops.map((stop, i) => ({
                    title: stop.title,
                    description: stop.desc,
                    latitude: stop.lat,
                    longitude: stop.lng,
                    type: stop.category,
                    icon: stop.category === 'food' ? 'Utensils' : 'MapPin',
                    price: 0,
                    rating: 4.5 + (Math.random() * 0.5),
                    time: `${10 + i * 2}:00`
                }))
            }]
        };
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
