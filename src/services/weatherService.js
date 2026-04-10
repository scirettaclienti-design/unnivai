
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
    // Bust the cache for a specific lat/lng pair — called on manual city change
    clearCacheForCoords(lat, lng) {
        if (!lat || !lng) return;
        this.cache.delete(`${parseFloat(lat).toFixed(4)},${parseFloat(lng).toFixed(4)}`);
    }

    // forceRefresh=true skips the 30-min cache and fetches live data
    async getWeather(city, lat, lng, forceRefresh = false) {
        // 1. If we have exact coords, use them (best precision)
        if (lat && lng) {
            if (forceRefresh) this.clearCacheForCoords(lat, lng);
            return this.getCurrentWeather(lat, lng);
        }

        // 2. Geocode the city name (OpenMeteo geocoding — free, no key needed)
        if (city && typeof city === 'string') {
            try {
                const coords = await this.getCoordsFromCity(city);
                if (coords) {
                    if (forceRefresh) this.clearCacheForCoords(coords.latitude, coords.longitude);
                    return this.getCurrentWeather(coords.latitude, coords.longitude);
                }
            } catch (e) {
                console.warn(`Weather Geocoding failed for ${city}`, e);
            }
        }

        // 3. Fallback
        return this.getFallbackWeather();
    }

    async getCoordsFromCity(city) {
        try {
            const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=it&format=json`);
            const data = await response.json();
            if (data.results && data.results.length > 0) {
                return {
                    latitude: data.results[0].latitude,
                    longitude: data.results[0].longitude
                };
            }
        } catch (e) {
            return null;
        }
        return null;
    }
}

export const weatherService = new WeatherService();
