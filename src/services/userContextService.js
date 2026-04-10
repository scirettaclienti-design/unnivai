import { supabase } from '../lib/supabase';
import { dataService } from './dataService';
import { weatherService } from './weatherService';

class UserContextService {
    async getUserContext(gpsLocation = null, manualCity = null) {
        // 1. Auth: Get User Profile
        let profile = {
            userId: null,
            firstName: 'Ospite',
            isGuest: true
        };

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                const meta = session.user.user_metadata || {};
                const emailName = session.user.email?.split('@')[0] || 'Utente';
                const fullName = meta.full_name || meta.name || emailName;

                profile = {
                    userId: session.user.id,
                    firstName: fullName.split(' ')[0],
                    isGuest: false
                };
            }
        } catch {
            console.warn('Auth context fetch failed');
        }


        // 2. Location logic
        let city = 'Roma'; // Fallback Default
        let lat = null;
        let lng = null;
        let source = 'fallback';

        // 🚀 PRIORITY 1: MANUAL OVERRIDE (From TopBar/CityContext)
        if (manualCity) {
            city = manualCity;
            source = 'manual';
            // Fetch coords for manual city
            const coords = await this.getCoordinatesForCity(city);
            if (coords) {
                lat = coords.lat;
                lng = coords.lng;
            } else {
                // If geocoding fails, maybe nullify lat/lng to force fallbacks or keep null
                // We'll keep them null, weather service handles fallback via city name
                console.warn(`Could not geocode manual city: ${city}`);
            }
        }
        // PRIORITY 2: GPS (Only if no manual override)
        else if (gpsLocation?.latitude && gpsLocation?.longitude) {
            city = gpsLocation.city || await this.reverseGeocodeCity(gpsLocation.latitude, gpsLocation.longitude);
            lat = gpsLocation.latitude;
            lng = gpsLocation.longitude;
            source = 'gps';

            if (!profile.isGuest && profile.userId) {
                this.updateSupabaseProfileCity(profile.userId, city);
            }
        }
        // PRIORITY 3: Supabase Profile (Logged in)
        else if (!profile.isGuest && profile.userId) {
            const savedProfileCity = await this.getSupabaseProfileCity(profile.userId);
            if (savedProfileCity) {
                city = savedProfileCity;
                source = 'manual';
            } else {
                const localCity = localStorage.getItem('user_city');
                if (localCity) {
                    city = localCity;
                    source = 'manual';
                }
            }
        }
        // PRIORITY 4: localStorage (Guest)
        else {
            const savedCity = localStorage.getItem('user_city');
            if (savedCity) {
                city = savedCity;
                source = 'manual';
            }
        }

        // 🛡️ RE-VERIFY COORDS FOR PERSISTED MANUAL (Priority 3 & 4)
        // If we picked a manual city from profile/storage (and didn't have specific manual override above), make sure we have coords
        if (source === 'manual' && city && !lat && !manualCity) {
            const coords = await this.getCoordinatesForCity(city);
            if (coords) {
                lat = coords.lat;
                lng = coords.lng;
            }
        }

        // 3. Weather
        let temperatureC = 24; // Default MVP
        let weatherCondition = 'sunny';

        // 🛡️ SANITIZATION: Ensure City is a Name, NOT Coordinates
        // If city looks like specific coordinates or "Lat:", trigger failover
        if (city && (city.includes('Lat') || city.includes(':') || (city.match(/\d/) && city.length > 20))) {
            console.warn(`⚠️ Detected Coordinate String in City Context: ${city}. Forcing Reverse Geocode/Fallback.`);
            if (lat && lng) {
                try {
                    const realName = await this.reverseGeocodeCity(lat, lng);
                    console.log(`✅ Recovered Real City Name: ${realName}`);
                    city = realName;
                } catch {
                    city = 'Roma';
                }
            } else {
                city = 'Roma';
            }
        }

        // Final Capitalization
        if (city && typeof city === 'string') {
            city = city.charAt(0).toUpperCase() + city.slice(1).toLowerCase();
        } else {
            city = 'Roma';
        }

        // Fetch Weather for Final City.
        // forceRefresh=true when the user manually picked a city so we bypass
        // the 30-minute in-memory cache and always show live data.
        try {
            const w = await weatherService.getWeather(city, lat, lng, !!manualCity);
            if (w) {
                temperatureC = w.temperature;
                weatherCondition = w.condition;
            }
        } catch {
            console.warn('Weather fetch failed');
        }

        // 4. Tours Count
        let toursCount = 3; // Default Mock Count
        try {
            if (dataService.useRealData) {
                const { count, error } = await supabase
                    .from('tours')
                    .select('*', { count: 'exact', head: true })
                    .eq('city', city);

                if (!error && count !== null) {
                    toursCount = count;
                }
            }
        } catch {
            // Silent fallback to mock count
        }

        // Final Context Object
        return {
            ...profile,
            city,
            lat,
            lng,
            temperatureC,
            weatherCondition, // Extra internal context
            toursCount,
            source
        };
    }

    // Helper: Reverse Geocoding (Lat/Lng -> City)
    async reverseGeocodeCity(lat, lng) {
        try {
            const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
            const response = await fetch(
                `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}&language=it`
            );
            if (!response.ok) throw new Error('Geocoding failed');
            const data = await response.json();

            if (data.results && data.results.length > 0) {
                const components = data.results[0].address_components;
                const locality = components.find(c => c.types.includes('locality'));
                if (locality) return locality.long_name;
                
                const admin_level_3 = components.find(c => c.types.includes('administrative_area_level_3'));
                if (admin_level_3) return admin_level_3.long_name;
                
                const admin_level_2 = components.find(c => c.types.includes('administrative_area_level_2'));
                if (admin_level_2) return admin_level_2.long_name;
            }
            return 'Roma';
        } catch (e) {
            console.warn('Service geocoding failed, falling back to cached or default');
            return 'Roma';
        }
    }

    // Helper: Direct Geocoding (City -> Lat/Lng)
    async getCoordinatesForCity(cityName) {
        // ⚡ FAST PATH: Hardcoded Coords for Major Cities (No API Lag)
        const CITY_COORDS = {
            'Roma': { lat: 41.9028, lng: 12.4964 },
            'Milano': { lat: 45.4642, lng: 9.1900 },
            'Napoli': { lat: 40.8518, lng: 14.2681 },
            'Firenze': { lat: 43.7696, lng: 11.2558 },
            'Venezia': { lat: 45.4408, lng: 12.3155 },
            'Torino': { lat: 45.0703, lng: 7.6869 },
            'Palermo': { lat: 38.1157, lng: 13.3615 },
            'Bologna': { lat: 44.4949, lng: 11.3426 },
            'Genova': { lat: 44.4056, lng: 8.9463 },
            'Bari': { lat: 41.1171, lng: 16.8719 },
            'Catania': { lat: 37.5079, lng: 15.0830 },
            'Perugia': { lat: 43.1107, lng: 12.3908 }
        };

        const normalized = cityName.charAt(0).toUpperCase() + cityName.slice(1).toLowerCase();
        if (CITY_COORDS[normalized]) {
            console.log(`📍 Using Fast Coords for ${normalized}`);
            return CITY_COORDS[normalized];
        }

        try {
            const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
            const response = await fetch(
                `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(cityName)}&key=${apiKey}&language=it`
            );
            if (!response.ok) throw new Error('City Search Failed');
            const data = await response.json();
            if (data.results && data.results.length > 0) {
                const location = data.results[0].geometry.location;
                return { lat: location.lat, lng: location.lng };
            }
        } catch (e) {
            console.warn('City coords fetch failed', e);
        }
        return null;
    }

    // Helper: Update city in Supabase profile (for authenticated users)
    async updateSupabaseProfileCity(userId, city) {
        try {
            await supabase.from('profiles').upsert({ id: userId, current_city: city });
        } catch {
            // silent fail
        }
    }

    // Helper: Get city from Supabase profile
    async getSupabaseProfileCity(userId) {
        try {
            const { data } = await supabase.from('profiles').select('current_city').eq('id', userId).single();
            return data?.current_city;
        } catch {
            return null;
        }
    }
}

export const userContextService = new UserContextService();
