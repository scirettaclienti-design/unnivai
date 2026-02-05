
// OpenMeteo is a free API that does not require an API key
const WEATHER_API_ENDPOINT = "https://api.open-meteo.com/v1/forecast";

class WeatherService {
    constructor() {
        this.cache = new Map();
        this.CACHE_TTL = 30 * 60 * 1000; // 30 minutes
    }

    async getCurrentWeather(lat, lng) {
        if (!lat || !lng) return this.getFallbackWeather();

        const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
        const cached = this.cache.get(cacheKey);

        if (cached && (Date.now() - cached.timestamp < this.CACHE_TTL)) {
            return cached.data;
        }

        try {
            const params = new URLSearchParams({
                latitude: lat,
                longitude: lng,
                current: "temperature_2m,weather_code",
                timezone: "auto"
            });

            const response = await fetch(`${WEATHER_API_ENDPOINT}?${params.toString()}`);

            if (!response.ok) throw new Error('Weather API error');

            const data = await response.json();

            const weatherData = {
                temperature: Math.round(data.current.temperature_2m),
                condition: this.mapWmoCodeToCondition(data.current.weather_code),
                description: this.getWmoDescription(data.current.weather_code)
            };

            this.cache.set(cacheKey, {
                timestamp: Date.now(),
                data: weatherData
            });

            return weatherData;

        } catch (error) {
            console.warn('Weather Service failed, using fallback:', error);
            return this.getFallbackWeather();
        }
    }

    getFallbackWeather() {
        return {
            temperature: 24,
            condition: 'sunny',
            description: 'Soleggiato'
        };
    }

    mapWmoCodeToCondition(code) {
        // WMO Weather interpretation codes (WW)
        if (code === 0 || code === 1) return 'sunny';
        if (code === 2 || code === 3) return 'cloudy';
        if (code >= 51 && code <= 67) return 'rainy'; // Drizzle / Rain
        if (code >= 80 && code <= 82) return 'rainy'; // Showers
        if (code >= 95) return 'rainy'; // Thunderstorm
        return 'cloudy'; // Default
    }

    getWmoDescription(code) {
        if (code === 0) return 'Cielo sereno';
        if (code === 1 || code === 2 || code === 3) return 'Parzialmente nuvoloso';
        if (code >= 51 && code <= 67) return 'Pioggia';
        return 'Variabile';
    }
}

export const weatherService = new WeatherService();
