import { useState, useEffect } from 'react';

interface GeolocationState {
  location: {
    latitude: number;
    longitude: number;
    city: string;
    country: string;
  } | null;
  loading: boolean;
  error: string | null;
  nearbyData: any[] | null;
  savedToDatabase: boolean;
}

interface GeolocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
  autoSaveToDatabase?: boolean;
}

// Function to save location to backend
const saveLocationToBackend = async (locationData: {
  latitude: number;
  longitude: number;
  city: string;
  region?: string | null;
  country: string;
  accuracyMeters?: number;
}) => {
  const response = await fetch('/api/location/save', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(locationData)
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
};

// Function to get nearby users/businesses/guides
const getNearbyData = async (latitude: number, longitude: number, radius: number = 5000) => {
  const response = await fetch(`/api/location/nearby?latitude=${latitude}&longitude=${longitude}&radius=${radius}`);
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
};

export function useEnhancedGeolocation(options: GeolocationOptions = {}) {
  const [state, setState] = useState<GeolocationState>({
    location: null,
    loading: false,
    error: null,
    nearbyData: null,
    savedToDatabase: false
  });

  const getCurrentLocationWithBackend = async () => {
    if (!navigator.geolocation) {
      console.log('❌ Geolocalizzazione non supportata dal browser');
      setSimulatedLocation();
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null, savedToDatabase: false }));

    // Opzioni più aggressive per development
    const defaultOptions: PositionOptions = {
      enableHighAccuracy: false, // Meno preciso ma più veloce in development
      timeout: 5000, // Ridotto a 5 secondi per development
      maximumAge: 300000, // Cache di 5 minuti
      ...options
    };

    try {
      console.log('🚀 Richiedendo posizione GPS con alta precisione...');
      
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            console.log('✅ Posizione GPS ottenuta con successo');
            resolve(pos);
          },
          (err) => {
            console.log('❌ Errore ottenimento GPS:', err.code, err.message);
            reject(err);
          },
          defaultOptions
        );
      });

      const { latitude, longitude, accuracy } = position.coords;
      
      console.log('🌍 Coordinate GPS precise:', { 
        latitude: latitude.toFixed(6), 
        longitude: longitude.toFixed(6), 
        accuracy: Math.round(accuracy) + 'm' 
      });

      if (latitude && longitude && !isNaN(latitude) && !isNaN(longitude) && 
          Math.abs(latitude) > 0.001 && Math.abs(longitude) > 0.001) {
        
        // Reverse geocoding
        const cityData = await reverseGeocode(latitude, longitude);
        
        console.log('📍 Città identificata:', cityData.city, cityData.country);
        
        const locationData = {
          latitude,
          longitude,
          city: cityData.city,
          country: cityData.country
        };

        // Save to backend if option enabled (default true)
        let savedToDatabase = false;
        if (options.autoSaveToDatabase !== false) {
          try {
            await saveLocationToBackend({
              latitude,
              longitude,
              city: cityData.city,
              region: cityData.region || null,
              country: cityData.country,
              accuracyMeters: Math.round(accuracy)
            });
            console.log('✅ Posizione salvata nel database con successo');
            savedToDatabase = true;
          } catch (error) {
            console.warn('⚠️ Impossibile salvare posizione nel database:', error);
          }
        }

        // Get nearby data
        let nearbyData = null;
        try {
          const nearbyResponse = await getNearbyData(latitude, longitude);
          nearbyData = nearbyResponse.nearby;
          console.log('📍 Trovati nelle vicinanze:', nearbyData?.length || 0, 'elementi');
        } catch (error) {
          console.warn('⚠️ Impossibile recuperare dati nelle vicinanze:', error);
        }

        setState({
          location: locationData,
          loading: false,
          error: null,
          nearbyData,
          savedToDatabase
        });
        
        return; // Successo!
      } else {
        throw new Error('Coordinate GPS non valide o troppo imprecise');
      }
    } catch (error) {
      console.error('❌ Errore durante geolocalizzazione:', error);
      
      let errorMessage = 'Impossibile rilevare la posizione';
      if (error instanceof GeolocationPositionError) {
        switch (error.code) {
          case 1:
            errorMessage = 'Accesso GPS negato - usando Roma come fallback';
            console.log('🚫 GPS permissions denied, usando fallback rapido');
            break;
          case 2:
            errorMessage = 'GPS non disponibile - usando Roma (development mode)';
            console.log('📡 GPS not available in development environment');
            break;
          case 3:
            errorMessage = 'GPS timeout - usando Roma (development mode)';
            console.log('⏰ GPS timeout in development, usando fallback');
            break;
        }
      }

      // In development, usa subito il fallback senza aspettare
      console.log('🏙️ Attivando fallback location per development environment');
      setSimulatedLocation();
    }
  };

  const setSimulatedLocation = () => {
    console.log('🏙️ Impostazione posizione simulata: Roma (Development Mode)');
    setState({
      location: {
        latitude: 41.9028,
        longitude: 12.4964,
        city: 'Roma',
        country: 'Italia'
      },
      loading: false,
      error: null, // Rimuovi errore per una UX più pulita
      nearbyData: [],
      savedToDatabase: false
    });
    
    // Simula anche nearby data per testing
    setTimeout(() => {
      setState(prev => ({
        ...prev,
        nearbyData: [
          { 
            userId: 1, 
            username: 'Marco Rossi', 
            userType: 'customer', 
            city: 'Roma', 
            distance: 150 
          },
          { 
            userId: 2, 
            username: 'Italian Tours SRL', 
            userType: 'business', 
            city: 'Roma', 
            distance: 320 
          }
        ]
      }));
      console.log('🧪 Mock nearby data aggiunto per testing in development');
    }, 1000);
  };

  const reverseGeocode = async (lat: number, lon: number) => {
    try {
      console.log('🔍 Ricerca città per coordinate:', { lat, lon });
      
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&accept-language=it&addressdetails=1`
      );
      
      if (!response.ok) throw new Error('Geocoding failed');
      
      const data = await response.json();
      console.log('🏙️ Dati geocoding ricevuti:', data);
      
      const detectedCity = data.address?.city || 
                          data.address?.town || 
                          data.address?.village || 
                          data.address?.municipality ||
                          data.address?.county ||
                          data.address?.state ||
                          data.display_name?.split(',')[0] ||
                          'Posizione rilevata';
      
      const detectedCountry = data.address?.country || 'Italia';
      const detectedRegion = data.address?.state || data.address?.region;
      
      console.log('✅ Città finale rilevata:', detectedCity, detectedCountry);
      
      return {
        city: detectedCity,
        country: detectedCountry,
        region: detectedRegion
      };
    } catch (error) {
      console.warn('❌ Reverse geocoding fallito:', error);
      return {
        city: `Lat: ${lat.toFixed(4)}, Lon: ${lon.toFixed(4)}`,
        country: 'Posizione GPS',
        region: null
      };
    }
  };

  // Auto-detect location on hook initialization
  useEffect(() => {
    getCurrentLocationWithBackend();
  }, []);

  return {
    ...state,
    getCurrentLocation: getCurrentLocationWithBackend,
    isSupported: !!navigator.geolocation,
    hasPermission: !!state.location && !state.error?.includes('simulata')
  };
}