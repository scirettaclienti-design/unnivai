import { useQuery } from "@tanstack/react-query";
import { userContextService } from "../services/userContextService";
import { useEnhancedGeolocation } from "./useEnhancedGeolocation";
import { useAuth } from "../context/AuthContext";

export function useUserContext() {
    // We still use the geolocation hook to get the browser's GPS signal
    // This feeds into our context service
    const { location: gpsLocation, loading: gpsLoading } = useEnhancedGeolocation();
    const { user } = useAuth(); // Get authenticated user

    const { data: userContext, isLoading: contextLoading } = useQuery({
        queryKey: ['userContext', gpsLocation?.city], // Re-fetch if GPS updates city
        queryFn: () => userContextService.getUserContext(gpsLocation),
        initialData: {
            userId: null,
            firstName: 'Ospite',
            city: 'Roma',
            temperatureC: 24,
            toursCount: 3,
            isGuest: true,
            source: 'fallback'
        },
        staleTime: 0, // Always fresh
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
        isLoading: gpsLoading || contextLoading
    };
}
