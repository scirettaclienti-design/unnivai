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
//
// Gate AA.1: distinguiamo "non lo so ancora" (loading vero: GPS in corso o
// query in fetch) da "non lo so" (stato noto: GPS finito, nessuna citta').
// Il secondo NON e' loading — e' uno stato da cui l'utente esce chiedendogli.
// Prima: isLoading includeva !effectiveCity -> deadlock su primo accesso
// senza cache (browser nuovo, GPS negato/fallito) -> "Ciao, ...!" eterno.
export function useUserContext() {
    const { location: gpsLocation, loading: gpsLoading } = useEnhancedGeolocation();
    const { user } = useAuth();
    const { city: manualCity, isManual } = useCity();

    const rawCity = isManual ? manualCity : gpsLocation?.city;
    const looksLikeCoords = typeof rawCity === 'string' && (rawCity.startsWith('Lat:') || rawCity.includes('Lon:'));
    const effectiveCity = looksLikeCoords ? undefined : rawCity;

    const { data: userContext, isLoading: contextLoading, isFetching: contextFetching } = useQuery({
        queryKey: ['userContext', effectiveCity],
        queryFn: () => userContextService.getUserContext(gpsLocation, isManual ? manualCity : null),
        enabled: !!effectiveCity,
        staleTime: 60_000,
    });

    // firstName: profilo auth se disponibile, altrimenti fallback stato "Ospite".
    // 'Ospite' e' una label di stato utente, non un dato mascherato da fatto.
    // NON dipende dalla citta': l'auth risolve subito, il nome arriva subito.
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
        // Gate AA.1: isLoading e' true SOLO quando c'e' un fetch in corso vero
        // (GPS che cerca posizione OR react-query che sta fetchando userContext).
        // Se GPS ha finito (successo o fallimento) E la query non e' in fetch,
        // isLoading e' false — anche se effectiveCity e' undefined. In quel
        // caso il consumer sa che "non c'e' citta'" e apre il CityModal (AA.2).
        isLoading: gpsLoading || contextFetching,
        // Nuovo: stato esplicito "senza citta' (ma boot finito)" per triggerare
        // il CityModal onboarding. Esiste solo dopo che GPS ha finito il suo giro.
        needsCityChoice: !gpsLoading && !effectiveCity,
    };
}
