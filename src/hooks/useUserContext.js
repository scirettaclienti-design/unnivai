import { useQuery } from "@tanstack/react-query";
import { userContextService } from "../services/userContextService";
import { useEnhancedGeolocation } from "./useEnhancedGeolocation";
import { useAuth } from "../context/AuthContext";
import { useCity } from "../context/CityContext";

export function useUserContext() {
    // We still use the geolocation hook to get the browser's GPS signal
    // This feeds into our context service
    const { location: gpsLocation, loading: gpsLoading } = useEnhancedGeolocation();
    const { user } = useAuth(); // Get authenticated user
    const { city: manualCity, isManual } = useCity();

    // Effective City Logic: mai mostrare "Lat: ... Lon: ..." in UI
    const rawCity = isManual ? manualCity : (gpsLocation?.city || 'Roma');
    const looksLikeCoords = typeof rawCity === 'string' && (rawCity.startsWith('Lat:') || rawCity.includes('Lon:'));
    const effectiveCity = looksLikeCoords ? 'Roma' : rawCity;

    const { data: userContext, isLoading: contextLoading } = useQuery({
        queryKey: ['userContext', effectiveCity], // Re-fetch if city changes
        queryFn: () => userContextService.getUserContext(gpsLocation, isManual ? manualCity : null),
        initialData: {
            userId: null,
            firstName: 'Ospite',
            city: 'Roma',
            temperatureC: 24,
            toursCount: 3,
            isGuest: true,
            source: 'fallback'
        },
        staleTime: 60_000, // DVAI-025: 60 s di cache per evitare refetch eccessivi
    });

    // Determine the Real First Name from Auth (if available) or fallback to Context/Default
    const realFirstName = user?.user_metadata?.full_name?.split(' ')[0]
        || user?.user_metadata?.first_name
        || user?.email?.split('@')[0]
        || userContext?.firstName
        || 'Ospite';

    return {
        ...userContext,
        firstName: realFirstName, // Override with real name
        email: user?.email,      //  expose email
        isGuest: !user,           // Correct guest status
        city: effectiveCity,      // Override city
        isLoading: gpsLoading || contextLoading
    };
}
