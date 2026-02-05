
const DEMO_CITIES = {
    'Roma': {
        center: { latitude: 41.9028, longitude: 12.4964 },
        landmarks: [
            { id: 'colosseo', name: 'Colosseo', latitude: 41.8902, longitude: 12.4922, type: 'landmark' },
            { id: 'pantheon', name: 'Pantheon', latitude: 41.8986, longitude: 12.4769, type: 'landmark' },
            { id: 'trevi', name: 'Fontana di Trevi', latitude: 41.9009, longitude: 12.4833, type: 'landmark' },
            { id: 'vaticano', name: 'San Pietro', latitude: 41.9022, longitude: 12.4539, type: 'landmark' }
        ],
        activities: [
            { id: 'rom1', name: 'Fontanella Pubblica', latitude: 41.9035, longitude: 12.4975, level: 'free', category: 'service' },
            { id: 'rom2', name: 'Souvenir Roma', latitude: 41.9045, longitude: 12.4955, level: 'base', category: 'shop' },
            { id: 'rom3', name: 'Trattoria Romana', latitude: 41.9015, longitude: 12.4985, level: 'pro', category: 'food' },
            { id: 'rom4', name: 'Hotel Imperiale', latitude: 41.9010, longitude: 12.4940, level: 'premium', category: 'hotel' }
        ]
    },
    'Palermo': {
        center: { latitude: 38.1157, longitude: 13.3615 },
        activities: [
            { id: 'pal1', name: 'Mercato di Ballarò', latitude: 38.1130, longitude: 13.3600, level: 'premium', category: 'food' },
            { id: 'pal2', name: 'Teatro Massimo', latitude: 38.1202, longitude: 13.3562, level: 'pro', category: 'culture' },
            { id: 'pal3', name: 'Cattedrale di Palermo', latitude: 38.1146, longitude: 13.3561, level: 'base', category: 'culture' },
            { id: 'pal4', name: 'Quattro Canti', latitude: 38.1158, longitude: 13.3614, level: 'free', category: 'culture' }
        ]
    },
    'Catania': {
        center: { latitude: 37.5079, longitude: 15.0830 },
        activities: [
            { id: 'cat1', name: 'Pescheria di Catania', latitude: 37.5020, longitude: 15.0860, level: 'premium', category: 'food' },
            { id: 'cat2', name: 'Bar del Duomo', latitude: 37.5027, longitude: 15.0872, level: 'free', category: 'food' },
            { id: 'cat3', name: 'Anfiteatro Romano', latitude: 37.5042, longitude: 15.0855, level: 'pro', category: 'culture' },
            { id: 'cat4', name: 'Villa Bellini', latitude: 37.5090, longitude: 15.0845, level: 'base', category: 'nature' }
        ]
    }
};

async function generateItinerary(city, preferences = {}, prompt = '') {
    const cityData = DEMO_CITIES[city] || DEMO_CITIES['Roma'];
    const allCandidates = [
        ...(cityData.landmarks || []).map(l => ({ ...l, type: 'landmark', price: 0, duration: 60 })),
        ...(cityData.activities || []).map(a => ({ ...a, type: a.category, duration: 90 })),
        ...(cityData.tours || []).map(t => ({ ...t, type: 'tour', duration: 180 }))
    ];

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

    const scoredCandidates = allCandidates.map(item => {
        let score = 5;
        if (allowedTypes.length > 0) {
            if (allowedTypes.includes(item.category) || allowedTypes.includes(item.type)) score += 10;
        } else {
            if (item.type === 'landmark') score += 5;
        }

        if (preferences.budget === 'Economico' && (item.price === 0 || item.level === 'free')) score += 5;
        if (preferences.budget === 'Lusso' && (item.price > 50 || item.level === 'premium')) score += 5;

        // Prompt keyword match (simple)
        if (prompt) {
            const terms = prompt.toLowerCase().split(' ');
            terms.forEach(term => {
                if (item.name?.toLowerCase().includes(term) || (item.description || '').toLowerCase().includes(term)) {
                    score += 15;
                }
            });
        }
        return { ...item, matchScore: score };
    });

    scoredCandidates.sort((a, b) => b.matchScore - a.matchScore);

    let stopsCount = 3;
    if (preferences.duration === '1 Giorno') stopsCount = 5;
    if (preferences.duration === '2-3 Giorni') stopsCount = 8;

    let paceModifier = 0;
    if (preferences.pace === 'Intenso') paceModifier = 2;
    if (preferences.pace === 'Rilassato') paceModifier = -1;

    stopsCount += paceModifier;
    if (stopsCount < 2) stopsCount = 2;

    const selected = scoredCandidates.slice(0, stopsCount);

    const days = [];
    const stopsPerDay = Math.ceil(selected.length / (preferences.duration === '2-3 Giorni' ? 2 : 1));

    for (let i = 0; i < selected.length; i += stopsPerDay) {
        const dayStops = selected.slice(i, i + stopsPerDay);
        const dayNum = days.length + 1;

        const timedStops = dayStops.map((stop, idx) => ({
            id: stop.id,
            time: `${9 + idx * 3}:00`,
            title: stop.name || stop.title,
            latitude: stop.latitude,
            longitude: stop.longitude,
            score: stop.matchScore
        }));

        days.push({
            day: dayNum,
            stops: timedStops
        });
    }

    return days;
}

// Scenarios
async function runTests() {
    console.log("--- TEST EASY: Roma 4h, Coppia, Moderato ---");
    const easy = await generateItinerary('Roma', {
        preferences: { budget: 'Medio', pace: 'Attivo', group: 'Coppia', duration: 'Mezza Giornata' },
        prompt: 'Voglio vedere le cose principali'
    });
    console.log(JSON.stringify(easy, null, 2));

    console.log("\n--- TEST MEDIUM: Palermo 6h, Solo, Slow, Cibo ---");
    const medium = await generateItinerary('Palermo', {
        interests: ['Cibo'],
        budget: 'Economico',
        pace: 'Rilassato',
        duration: '1 Giorno' // ~6h mapped to 1 day concept broadly or custom
    }, 'mercati storici cibo di strada');
    console.log(JSON.stringify(medium, null, 2));

    console.log("\n--- TEST HARD: Catania 2 giorni, Amici, Intenso, Mix ---");
    const hard = await generateItinerary('Catania', {
        interests: ['Storia', 'Natura', 'Cibo'],
        budget: 'Lusso',
        pace: 'Intenso',
        duration: '2-3 Giorni'
    }, 'leggende metropolitane artigiani vista mare');

    console.log(JSON.stringify(hard, null, 2));
}

runTests();
