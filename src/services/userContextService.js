import { supabase } from '../lib/supabase';
import { aiRecommendationService } from './aiRecommendationService';
import { dataService } from './dataService';
import { weatherService } from './weatherService';

class UserContextService {
    async getUserContext(gpsLocation = null) {
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
        } catch (e) {
            console.warn('Auth context fetch failed', e);
        }


        // 2. Location: GPS > Supabase Profile (if logged) > localStorage > Fallback
        let city = 'Roma'; // Fallback Default
        let lat = null;
        let lng = null;
        let source = 'fallback';

        // A. Check GPS
        if (gpsLocation?.latitude && gpsLocation?.longitude) {
            city = gpsLocation.city || await this.reverseGeocodeCity(gpsLocation.latitude, gpsLocation.longitude);
            lat = gpsLocation.latitude;
            lng = gpsLocation.longitude;
            source = 'gps';

            // Persist GPS location to Supabase if logged in
            if (!profile.isGuest && profile.userId) {
                this.updateSupabaseProfileCity(profile.userId, city);
            }
        }
        // B. Check Supabase Profile (if logged in and no GPS override)
        else if (!profile.isGuest && profile.userId) {
            const savedProfileCity = await this.getSupabaseProfileCity(profile.userId);
            if (savedProfileCity) {
                city = savedProfileCity;
                source = 'manual'; // Treated as manual persistence
            } else {
                // Check localStorage as fallback for logged user too if new device
                const localCity = localStorage.getItem('user_city');
                if (localCity) {
                    city = localCity;
                    source = 'manual';
                }
            }
        }
        // C. Check localStorage (Guest)
        else {
            const savedCity = localStorage.getItem('user_city');
            if (savedCity) {
                city = savedCity;
                source = 'manual';
            }
        }

        // 3. Weather
        let temperatureC = 24; // Default MVP
        let weatherCondition = 'sunny';
        try {
            // Priority: Real API (if lat/lng) > Fallback Service
            if (lat && lng) {
                const realWeather = await weatherService.getCurrentWeather(lat, lng);
                temperatureC = realWeather.temperature;
                weatherCondition = realWeather.condition;
            } else {
                // Fallback via AI Service (Mock) if no coords
                const weather = await aiRecommendationService.getCurrentWeather(city);
                temperatureC = weather.temperature;
                weatherCondition = weather.condition;
            }
        } catch (e) {
            console.warn('Weather fetch failed', e);
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
        } catch (e) {
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

    // Helper for consistency if gpsLocation lacks city name
    async reverseGeocodeCity(lat, lng) {
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=it`
            );
            if (!response.ok) throw new Error('Geocoding failed');
            const data = await response.json();
            return data.address?.city ||
                data.address?.town ||
                data.address?.village ||
                data.address?.municipality ||
                'Posizione rilevata';
        } catch (e) {
            console.warn('Service geocoding failed, falling back to cached or default');
            return 'Roma';
        }
    }

    // Helper: Update city in Supabase profile (for authenticated users)
    async updateSupabaseProfileCity(userId, city) {
        try {
            await supabase.from('profiles').upsert({ id: userId, current_city: city });
        } catch (e) {
            // silent fail
        }
    }

    // Helper: Get city from Supabase profile
    async getSupabaseProfileCity(userId) {
        try {
            const { data } = await supabase.from('profiles').select('current_city').eq('id', userId).single();
            return data?.current_city;
        } catch (e) {
            return null;
        }
    }
}

export const userContextService = new UserContextService();
