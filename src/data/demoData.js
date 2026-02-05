export const ENABLE_DEMO_MODE = true;

export const DEMO_CITIES = {
    'Catania': {
        center: { latitude: 37.5079, longitude: 15.0830 },
        activities: [
            { id: 'cat1', name: 'Pescheria di Catania', latitude: 37.5020, longitude: 15.0860, level: 'premium', category: 'food', description: 'Il mercato del pesce storico.' },
            { id: 'cat2', name: 'Bar del Duomo', latitude: 37.5027, longitude: 15.0872, level: 'free', category: 'food', description: 'Granita e brioche con vista cattedrale.' },
            { id: 'cat3', name: 'Anfiteatro Romano', latitude: 37.5042, longitude: 15.0855, level: 'pro', category: 'culture', description: 'Rovine romane nel cuore della città.' },
            { id: 'cat4', name: 'Villa Bellini', latitude: 37.5090, longitude: 15.0845, level: 'base', category: 'nature', description: 'Polmone verde della città.' }
        ],
        tours: [
            {
                id: 'tour_cat_1',
                title: 'Street Food Catanese',
                location: 'Catania, Centro Storico',
                rating: 4.9,
                reviews: 210,
                price: 35,
                duration: '3 ore',
                imageUrl: 'https://images.unsplash.com/photo-1516629986345-0d046c31969a?w=400&h=300&fit=crop',
                tag: '🔥 Trending',
                tagColor: 'from-orange-400 to-red-500',
                category: 'food',
                emoji: '🍋'
            },
            {
                id: 'tour_cat_2',
                title: 'Etna al Tramonto',
                location: 'Catania -> Etna',
                rating: 5.0,
                reviews: 85,
                price: 75,
                duration: '4 ore',
                imageUrl: 'https://images.unsplash.com/photo-1533038590840-1cde6e668a91?w=400&h=300&fit=crop',
                tag: '🌋 Avventura',
                tagColor: 'from-purple-400 to-indigo-500',
                category: 'nature',
                emoji: '🌋'
            }
        ],
        guides: [
            { id: 'g_cat_1', name: 'Giuseppe Rossi', city: 'Catania', status: 'online', bio: 'Vulcanologo e amante della cucina.' }
        ],
        landmarks: [
            {
                id: 'duomo_catania',
                name: 'Duomo di Sant\'Agata',
                latitude: 37.5027,
                longitude: 15.0872,
                description: 'Splendida cattedrale barocca dedicata alla patrona.',
                image: 'https://images.unsplash.com/photo-1668875631248-842c67b09598?w=200&h=150&fit=crop',
                link: '/tour-details/cat1'
            },
            {
                id: 'castello_ursino',
                name: 'Castello Ursino',
                latitude: 37.4993,
                longitude: 15.0838,
                description: 'Antico castello normanno, oggi museo civico.',
                image: 'https://images.unsplash.com/photo-1596818136827-0402170327f2?w=200&h=150&fit=crop',
                link: '/tour-details/cat2'
            }
        ]
    },
    'Palermo': {
        center: { latitude: 38.1157, longitude: 13.3615 },
        activities: [
            { id: 'pal1', name: 'Mercato di Ballarò', latitude: 38.1130, longitude: 13.3600, level: 'premium', category: 'food', description: 'Il mercato più antico di Palermo.' },
            { id: 'pal2', name: 'Teatro Massimo', latitude: 38.1202, longitude: 13.3562, level: 'pro', category: 'culture', description: 'Il più grande teatro lirico d\'Italia.' },
            { id: 'pal3', name: 'Cattedrale di Palermo', latitude: 38.1146, longitude: 13.3561, level: 'base', category: 'culture', description: 'Capolavoro arabo-normanno.' },
            { id: 'pal4', name: 'Quattro Canti', latitude: 38.1158, longitude: 13.3614, level: 'free', category: 'culture', description: 'Piazza barocca ottagonale.' }
        ],
        tours: [
            {
                id: 'tour_pal_1',
                title: 'Misteri di Palermo',
                location: 'Palermo, Kalsa',
                rating: 4.8,
                reviews: 150,
                price: 25,
                duration: '2 ore',
                imageUrl: 'https://images.unsplash.com/photo-1596707323534-75896a25b682?w=400&h=300&fit=crop',
                tag: '✨ Nuovo',
                tagColor: 'from-blue-400 to-teal-500',
                category: 'culture',
                emoji: '👻'
            },
            {
                id: 'tour_pal_2',
                title: 'Street Art & Panelle',
                location: 'Palermo, Centro',
                rating: 4.7,
                reviews: 95,
                price: 30,
                duration: '2.5 ore',
                imageUrl: 'https://images.unsplash.com/photo-1542475510-91ac1a942471?w=400&h=300&fit=crop',
                tag: '🎨 Arte',
                tagColor: 'from-pink-400 to-red-500',
                category: 'art',
                emoji: '🎨'
            }
        ],
        guides: [
            { id: 'g_pal_1', name: 'Maria Falcone', city: 'Palermo', status: 'offline', bio: 'Storica dell\'arte siciliana.' }
        ],
        landmarks: [
            {
                id: 'cattedrale_palermo',
                name: 'Cattedrale di Palermo',
                latitude: 38.1146,
                longitude: 13.3561,
                description: 'Complesso architettonico unico, mix di stili e culture.',
                image: 'https://images.unsplash.com/photo-1597925068252-03487f2ff845?w=200&h=150&fit=crop',
                link: '/tour-details/pal1'
            },
            {
                id: 'teatro_massimo',
                name: 'Teatro Massimo',
                latitude: 38.1202,
                longitude: 13.3562,
                description: 'Il più grande edificio teatrale lirico d\'Italia.',
                image: 'https://images.unsplash.com/photo-1574523368285-8f6452243d4e?w=200&h=150&fit=crop',
                link: '/tour-details/pal2'
            }
        ]
    },
    'Roma': {
        center: { latitude: 41.9028, longitude: 12.4964 },
        activities: [
            { id: 'rom1', name: 'Fontanella Pubblica', latitude: 41.9035, longitude: 12.4975, level: 'free', category: 'service', description: 'Acqua fresca gratis.' },
            { id: 'rom2', name: 'Souvenir Roma', latitude: 41.9045, longitude: 12.4955, level: 'base', category: 'shop', description: 'Negozio di souvenir.' },
            { id: 'rom3', name: 'Trattoria Romana', latitude: 41.9015, longitude: 12.4985, level: 'pro', category: 'food', description: 'Cucina tipica romana.' },
            { id: 'rom4', name: 'Hotel Imperiale', latitude: 41.9010, longitude: 12.4940, level: 'premium', category: 'hotel', description: 'Hotel di lusso.' }
        ],
        tours: [
            {
                id: 'tour_rom_1',
                title: 'Roma Antica',
                location: 'Roma, Centro',
                rating: 4.9,
                reviews: 320,
                price: 45,
                duration: '3 ore',
                imageUrl: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=400&h=300&fit=crop',
                tag: '🏛️ Storia',
                tagColor: 'from-yellow-400 to-orange-500',
                category: 'culture',
                emoji: '🏛️'
            },
            {
                id: 'tour_rom_2',
                title: 'Tour Gastronomico Trastevere',
                location: 'Roma, Trastevere',
                rating: 4.8,
                reviews: 150,
                price: 65,
                duration: '4 ore',
                imageUrl: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=300&fit=crop',
                tag: '🍝 Cibo',
                tagColor: 'from-orange-400 to-red-500',
                category: 'food',
                emoji: '🍝'
            },
            {
                id: 'tour_rom_3',
                title: 'Vespa Tour Panoramico',
                location: 'Roma, Vari',
                rating: 4.7,
                reviews: 80,
                price: 90,
                duration: '2.5 ore',
                imageUrl: 'https://images.unsplash.com/photo-1620922830303-a1c245237c02?w=400&h=300&fit=crop',
                tag: '🛵 Fun',
                tagColor: 'from-blue-400 to-cyan-500',
                category: 'fun',
                emoji: '🛵'
            },
            {
                id: 'tour_rom_4',
                title: 'Angeli e Demoni',
                location: 'Roma, Vaticano',
                rating: 4.6,
                reviews: 210,
                price: 35,
                duration: '3 ore',
                imageUrl: 'https://images.unsplash.com/photo-1548625361-9877484df6c5?w=400&h=300&fit=crop',
                tag: '🕵️ Mistero',
                tagColor: 'from-purple-400 to-indigo-500',
                category: 'mystery',
                emoji: '🕵️'
            },
            {
                id: 'tour_rom_5',
                title: 'Roma Barocca',
                location: 'Roma, Centro',
                rating: 4.8,
                reviews: 120,
                price: 40,
                duration: '2 ore',
                imageUrl: 'https://images.unsplash.com/photo-1525874684015-58379d421a52?w=400&h=300&fit=crop',
                tag: '🎨 Arte',
                tagColor: 'from-pink-400 to-rose-500',
                category: 'art',
                emoji: '🎨'
            }
        ],
        guides: [
            { id: 'g_rom_1', name: 'Alessandro Manzoni', city: 'Roma', status: 'online', bio: 'Esperto di storia romana.' }
        ],
        landmarks: [
            {
                id: 'colosseo',
                name: 'Colosseo',
                latitude: 41.8902,
                longitude: 12.4922,
                description: 'Il simbolo eterno di Roma. Arena dei gladiatori.',
                image: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=200&h=150&fit=crop',
                link: '/tour-details/1'
            },
            {
                id: 'pantheon',
                name: 'Pantheon',
                latitude: 41.8986,
                longitude: 12.4769,
                description: 'Il tempio di tutti gli dei, perfettamente conservato.',
                image: 'https://images.unsplash.com/photo-1555992336-749746e30129?w=200&h=150&fit=crop',
                link: '/tour-details/2'
            },
            {
                id: 'trevi',
                name: 'Fontana di Trevi',
                latitude: 41.9009,
                longitude: 12.4833,
                description: 'Esprimi un desiderio nella fontana più famosa.',
                image: 'https://images.unsplash.com/photo-1556621245-c1f0d37e2831?w=200&h=150&fit=crop',
                link: '/tour-details/3'
            },
            {
                id: 'vaticano',
                name: 'San Pietro',
                latitude: 41.9022,
                longitude: 12.4539,
                description: 'Il cuore della cristianità e arte rinascimentale.',
                image: 'https://images.unsplash.com/photo-1579290076295-a226bc40b543?w=200&h=150&fit=crop',
                link: '/tour-details/4'
            }
        ]
    }
};

export const MOCK_ROUTES = {
    'Catania': [
        { latitude: 37.5020, longitude: 15.0860, label: 'Start: Pescheria' },
        { latitude: 37.5027, longitude: 15.0872, label: 'Duomo' },
        { latitude: 37.5042, longitude: 15.0855, label: 'Anfiteatro' },
        { latitude: 37.5090, longitude: 15.0845, label: 'End: Villa Bellini' }
    ],
    'Palermo': [
        { latitude: 38.1202, longitude: 13.3562, label: 'Start: Teatro Massimo' },
        { latitude: 38.1158, longitude: 13.3614, label: 'Quattro Canti' },
        { latitude: 38.1146, longitude: 13.3561, label: 'Cattedrale' },
        { latitude: 38.1130, longitude: 13.3600, label: 'End: Ballarò' }
    ],
    'Roma': [
        { latitude: 41.9000, longitude: 12.4900, label: 'Start' },
        { latitude: 41.9010, longitude: 12.4940, label: 'Tappa 1' },
        { latitude: 41.9025, longitude: 12.4960, label: 'Tappa 2' },
        { latitude: 41.9035, longitude: 12.4975, label: 'End' }
    ]
};
