import { useQuery } from "@tanstack/react-query";
import { userContextService } from "../services/userContextService";
import { useEnhancedGeolocation } from "./useEnhancedGeolocation";
import { useAuth } from "../context/AuthContext";
import { useCity } from "../context/CityContext";

// Gate O.2: niente valori-ponte. La citta' e la temperatura si mostrano
// quando esistono davvero — mai un default hardcoded ("Roma", 24°C) con
// la faccia del dato reale. Il consumer di questo hook riceve `city` e
// `temperatureC` = undefined finche' non sono risolti; renderizza
// skeleton o nasconde il campo, mai un fallback fake.
export function useUserContext() {
    const { location: gpsLocation, loading: gpsLoading } = useEnhancedGeolocation();
    const { user } = useAuth();
    const { city: manualCity, isManual } = useCity();

    // Manual > GPS. Nessun fallback Roma. Se sia manuale che GPS mancano,
    // effectiveCity resta undefined -> la useQuery non parte (enabled: false)
    // -> il consumer entra in stato "senza citta'" (skeleton / CTA scegli citta').
    const rawCity = isManual ? manualCity : gpsLocation?.city;
    const looksLikeCoords = typeof rawCity === 'string' && (rawCity.startsWith('Lat:') || rawCity.includes('Lon:'));
    const effectiveCity = looksLikeCoords ? undefined : rawCity;

    const { data: userContext, isLoading: contextLoading } = useQuery({
        queryKey: ['userContext', effectiveCity],
        queryFn: () => userContextService.getUserContext(gpsLocation, isManual ? manualCity : null),
        enabled: !!effectiveCity,
        staleTime: 60_000,
    });

    // firstName: profilo auth se disponibile, altrimenti fallback stato "Ospite"
    // ('Ospite' e' una label di stato utente, non un dato mascherato da fatto).
    const realFirstName = user?.user_metadata?.full_name?.split(' ')[0]
        || user?.user_metadata?.first_name
        || user?.email?.split('@')[0]
        || userContext?.firstName
        || 'Ospite';

    return {
        ...(userContext || {}),
        firstName: realFirstName,
        email: user?.email,
        isGuest: !user,
        city: effectiveCity,
        isLoading: gpsLoading || contextLoading || !effectiveCity,
    };
}
