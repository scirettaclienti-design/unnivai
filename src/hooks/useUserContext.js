import { useQuery } from "@tanstack/react-query";
import { userContextService } from "../services/userContextService";
import { useEnhancedGeolocation } from "./useEnhancedGeolocation";

export function useUserContext() {
    // We still use the geolocation hook to get the browser's GPS signal
    // This feeds into our context service
    const { location: gpsLocation, loading: gpsLoading } = useEnhancedGeolocation();

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

    return {
        ...userContext,
        isLoading: gpsLoading || contextLoading
    };
}
