import { aiRecommendationService } from './aiRecommendationService';
import { dataService } from './dataService';

class LocationTourService {

    async generateLocationBasedTours(
        city,
        userName,
        coordinates
    ) {

        const weather = await aiRecommendationService.getCurrentWeather(city);

        // 1. Try to fetch real tours from DB
        let quickTours = await dataService.getToursByCity(city);

        // 2. Fallback to mock data if DB is empty or fails
        if (!quickTours || quickTours.length === 0) {
            console.log(`Using mock fallback for ${city}`);
            quickTours = this.getQuickToursForCity(city, weather.condition);
        } else {
            // Apply weather filtering to real data too if needed, 
            // or rely on DB capability. For now, we do client-side filtering 
            // to match the exact logic of the mock.
            if (weather.condition === 'rainy') {
                quickTours = quickTours.filter(tour => tour.type === 'culture' || tour.type === 'food');
            } else if (weather.condition === 'sunny') {
                quickTours = quickTours.sort((a, b) => {
                    const outdoorTypes = ['walking', 'nature'];
                    const aOutdoor = outdoorTypes.includes(a.type) ? 1 : 0;
                    const bOutdoor = outdoorTypes.includes(b.type) ? 1 : 0;
                    return bOutdoor - aOutdoor;
                });
            }
            // Ensure we respect the slice limit same as mock
            quickTours = quickTours.slice(0, 4);
        }

        const personalizedMessage = this.generatePersonalizedWelcome(userName, city, weather);
        const localTips = this.getLocalTips(city);

        return {
            city,
            weather: weather.description,
            quickTours,
            personalizedMessage,
            localTips
        };
    }

    getQuickToursForCity(city, weatherCondition) {
        const cityTours = {
            'Roma': [
                {
                    id: 'roma-quick-colosseum',
                    title: 'Colosseo Express',
                    description: 'Tour veloce del Colosseo con realtà aumentata',
                    duration: '45 min',
                    price: 25,
                    difficulty: 'facile',
                    type: 'culture',
                    highlights: ['Colosseo', 'Foro Romano', 'Arco di Costantino'],
                    startPoint: 'Metro Colosseo',
                    imageUrl: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=400&h=300&fit=crop',
                    rating: 4.7,
                    estimatedTime: 45
                },
                {
                    id: 'roma-quick-trastevere',
                    title: 'Trastevere Food Walk',
                    description: 'Assaggio veloce delle specialità romane',
                    duration: '1 ora',
                    price: 35,
                    difficulty: 'facile',
                    type: 'food',
                    highlights: ['Supplì', 'Maritozzo', 'Gelato artigianale'],
                    startPoint: 'Piazza di Santa Maria in Trastevere',
                    imageUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=400&h=300&fit=crop',
                    rating: 4.9,
                    estimatedTime: 60
                },
                {
                    id: 'roma-quick-pantheon',
                    title: 'Centro Storico Highlights',
                    description: 'Pantheon, Fontana di Trevi e Piazza Navona',
                    duration: '1.5 ore',
                    price: 20,
                    difficulty: 'medio',
                    type: 'walking',
                    highlights: ['Pantheon', 'Fontana di Trevi', 'Piazza Navona'],
                    startPoint: 'Pantheon',
                    imageUrl: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=300&fit=crop',
                    rating: 4.8,
                    estimatedTime: 90
                }
            ],
            'Milano': [
                {
                    id: 'milano-quick-duomo',
                    title: 'Duomo & Galleria Express',
                    description: 'Il meglio del centro di Milano in 1 ora',
                    duration: '1 ora',
                    price: 30,
                    difficulty: 'facile',
                    type: 'culture',
                    highlights: ['Duomo', 'Galleria Vittorio Emanuele II', 'Teatro alla Scala'],
                    startPoint: 'Piazza del Duomo',
                    imageUrl: 'https://images.unsplash.com/photo-1513581166391-887a96ddeafd?w=400&h=300&fit=crop',
                    rating: 4.6,
                    estimatedTime: 60
                },
                {
                    id: 'milano-quick-navigli',
                    title: 'Aperitivo nei Navigli',
                    description: 'Tour veloce dei locali più trendy',
                    duration: '1.5 ore',
                    price: 40,
                    difficulty: 'facile',
                    type: 'food',
                    highlights: ['Spritz milanese', 'Aperitivo', 'Movida locale'],
                    startPoint: 'Naviglio Grande',
                    imageUrl: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=400&h=300&fit=crop',
                    rating: 4.7,
                    estimatedTime: 90
                },
                {
                    id: 'milano-quick-shopping',
                    title: 'Quadrilatero della Moda',
                    description: 'Shopping tour nelle vie più eleganti',
                    duration: '2 ore',
                    price: 25,
                    difficulty: 'facile',
                    type: 'shopping',
                    highlights: ['Via Montenapoleone', 'Via della Spiga', 'Boutique storiche'],
                    startPoint: 'Via Montenapoleone',
                    imageUrl: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400&h=300&fit=crop',
                    rating: 4.5,
                    estimatedTime: 120
                }
            ],
            'Firenze': [
                {
                    id: 'firenze-quick-uffizi',
                    title: 'Uffizi Highlights',
                    description: 'I capolavori imperdibili in 1 ora',
                    duration: '1 ora',
                    price: 45,
                    difficulty: 'facile',
                    type: 'culture',
                    highlights: ['Venere di Botticelli', 'Annunciazione di Leonardo', 'Tondo Doni'],
                    startPoint: 'Galleria degli Uffizi',
                    imageUrl: 'https://images.unsplash.com/photo-1543429258-11de7da70b8c?w=400&h=300&fit=crop',
                    rating: 4.9,
                    estimatedTime: 60
                },
                {
                    id: 'firenze-quick-oltrarno',
                    title: 'Oltrarno Artigiano',
                    description: 'Botteghe storiche e artigiani locali',
                    duration: '1.5 ore',
                    price: 35,
                    difficulty: 'medio',
                    type: 'culture',
                    highlights: ['Botteghe artigiane', 'Palazzo Pitti', 'Giardino di Boboli'],
                    startPoint: 'Ponte Vecchio',
                    imageUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=300&fit=crop',
                    rating: 4.6,
                    estimatedTime: 90
                }
            ],
            'Venezia': [
                {
                    id: 'venezia-quick-piazza',
                    title: 'San Marco Express',
                    description: 'Piazza San Marco e Palazzo Ducale veloce',
                    duration: '1 ora',
                    price: 35,
                    difficulty: 'facile',
                    type: 'culture',
                    highlights: ['Basilica di San Marco', 'Palazzo Ducale', 'Campanile'],
                    startPoint: 'Piazza San Marco',
                    imageUrl: 'https://images.unsplash.com/photo-1523906834658-6e24ef2386f9?w=400&h=300&fit=crop',
                    rating: 4.8,
                    estimatedTime: 60
                },
                {
                    id: 'venezia-quick-gondola',
                    title: 'Mini Gondola Tour',
                    description: 'Giro breve sui canali principali',
                    duration: '30 min',
                    price: 60,
                    difficulty: 'facile',
                    type: 'culture',
                    highlights: ['Canal Grande', 'Ponte di Rialto', 'Palazzo Ca\' Rezzonico'],
                    startPoint: 'Ponte di Rialto',
                    imageUrl: 'https://images.unsplash.com/photo-1514890547357-a9ee288728e0?w=400&h=300&fit=crop',
                    rating: 4.9,
                    estimatedTime: 30
                }
            ],
            'Napoli': [
                {
                    id: 'napoli-quick-pizza',
                    title: 'Pizza Tour Express',
                    description: 'Le pizzerie storiche in 1 ora',
                    duration: '1 ora',
                    price: 25,
                    difficulty: 'facile',
                    type: 'food',
                    highlights: ['Pizza Margherita originale', 'Pizzerie storiche', 'Friarielli'],
                    startPoint: 'Via dei Tribunali',
                    imageUrl: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&h=300&fit=crop',
                    rating: 4.8,
                    estimatedTime: 60
                },
                {
                    id: 'napoli-quick-centro',
                    title: 'Centro Storico UNESCO',
                    description: 'Spaccanapoli e tesori nascosti',
                    duration: '1.5 ore',
                    price: 20,
                    difficulty: 'medio',
                    type: 'walking',
                    highlights: ['Spaccanapoli', 'Cappella Sansevero', 'Duomo'],
                    startPoint: 'Piazza del Gesù Nuovo',
                    imageUrl: 'https://images.unsplash.com/photo-1539650116574-75c0c6d73f6e?w=400&h=300&fit=crop',
                    rating: 4.7,
                    estimatedTime: 90
                }
            ]
        };

        let tours = cityTours[city] || cityTours['Roma'];

        // Filtra in base al meteo
        if (weatherCondition === 'rainy') {
            tours = tours.filter(tour => tour.type === 'culture' || tour.type === 'food');
        } else if (weatherCondition === 'sunny') {
            // Privilegia tour all'aperto quando c'è bel tempo
            tours = tours.sort((a, b) => {
                const outdoorTypes = ['walking', 'nature'];
                const aOutdoor = outdoorTypes.includes(a.type) ? 1 : 0;
                const bOutdoor = outdoorTypes.includes(b.type) ? 1 : 0;
                return bOutdoor - aOutdoor;
            });
        }

        return tours.slice(0, 4); // Massimo 4 tour veloci
    }

    generatePersonalizedWelcome(userName, city, weather) {
        const timeOfDay = this.getTimeOfDay();
        const weatherMessage = this.getWeatherMessage(weather.condition);

        const greetings = {
            morning: `Buongiorno ${userName}!`,
            afternoon: `Buon pomeriggio ${userName}!`,
            evening: `Buona sera ${userName}!`
        };

        const cityMessages = {
            'Roma': 'Benvenuto nella Città Eterna',
            'Milano': 'Benvenuto nella capitale della moda',
            'Firenze': 'Benvenuto nella culla del Rinascimento',
            'Venezia': 'Benvenuto nella città dei canali',
            'Napoli': 'Benvenuto nella città del sole'
        };

        return `${greetings[timeOfDay]} ${cityMessages[city] || `Benvenuto a ${city}`}! ${weatherMessage} Ho preparato alcuni tour veloci perfetti per te.`;
    }

    getWeatherMessage(condition) {
        const messages = {
            sunny: 'Il sole splende e è perfetto per esplorare!',
            cloudy: 'Il tempo è ideale per una passeggiata.',
            rainy: 'Con questa pioggerella, ti consiglio qualche attività al coperto.'
        };
        return messages[condition] || 'Il tempo è perfetto per scoprire la città!';
    }

    getTimeOfDay() {
        const hour = new Date().getHours();
        if (hour < 12) return 'morning';
        if (hour < 18) return 'afternoon';
        return 'evening';
    }

    getLocalTips(city) {
        const tips = {
            'Roma': [
                'Evita le ore di punta sui mezzi pubblici (8-9 e 17-19)',
                'Molti musei sono gratuiti la prima domenica del mese',
                'I romani pranzano tardi, ristoranti aperti dalle 12:30'
            ],
            'Milano': [
                'Usa i mezzi pubblici, il traffico è intenso',
                'L\'aperitivo inizia dalle 18:00 nei Navigli',
                'Molti negozi chiudono tra le 13-15 per il riposo'
            ],
            'Firenze': [
                'Prenota i musei online per evitare code',
                'Il centro storico è tutto pedonale',
                'I mercati del cuoio sono ottimi per souvenir'
            ],
            'Venezia': [
                'Compra il vaporetto giornaliero se visiti più isole',
                'Evita i ristoranti vicino a San Marco (turistici)',
                'Le maree alte (acqua alta) sono normali in inverno'
            ],
            'Napoli': [
                'Prova il caffè nei bar storici del centro',
                'I taxi hanno tariffe fisse per l\'aeroporto',
                'Il centro storico è Patrimonio UNESCO, visitalo!'
            ]
        };

        return tips[city] || [
            'Porta sempre una bottiglia d\'acqua',
            'Rispetta gli orari di riposo locali',
            'Chiedi sempre consigli ai locali!'
        ];
    }
}

export const locationTourService = new LocationTourService();
