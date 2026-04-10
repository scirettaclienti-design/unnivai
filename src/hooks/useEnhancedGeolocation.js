import { useState, useEffect } from 'react';

// Function to save location to backend
const saveLocationToBackend = async (locationData) => {
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
const getNearbyData = async (latitude, longitude, radius = 5000) => {
    const response = await fetch(`/api/location/nearby?latitude=${latitude}&longitude=${longitude}&radius=${radius}`);

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
};

export function useEnhancedGeolocation(options = {}) {
    const [state, setState] = useState({
        location: null,
        loading: false,
        error: null,
        nearbyData: null,
        savedToDatabase: false
    });

    const getCurrentLocationWithBackend = async () => {
        if (!navigator.geolocation) {
            console.log('❌ Geolocalizzazione non supportata dal browser');
            triggerIpFallback();
            return;
        }

        setState(prev => ({ ...prev, loading: true, error: null, savedToDatabase: false }));

        // Opzioni ottimizzate per precisione reale
        const defaultOptions = {
            enableHighAccuracy: true, // Priorità alla precisione GPS
            timeout: 15000, // 15 secondi timeout
            maximumAge: 0, // Nessuna cache per forzare lettura fresca
            ...options
        };

        try {
            console.log('🚀 Richiedendo posizione GPS con alta precisione...');

            const position = await new Promise((resolve, reject) => {
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

            // Tentativo fallback IP reale e poi simulata
            console.log('🏙️ Attivando fallback location IP (ipapi.co)...');
            triggerIpFallback();
        }
    };

    const triggerIpFallback = async () => {
        try {
            const res = await fetch('https://ipapi.co/json/');
            const data = await res.json();
            if (data?.latitude && data?.longitude && data?.city) {
                console.log('✅ IP Fallback Location rilevata:', data.city);
                setState({
                    location: {
                        latitude: data.latitude,
                        longitude: data.longitude,
                        city: data.city,
                        country: data.country_name || 'Italia'
                    },
                    loading: false,
                    error: null,
                    nearbyData: [],
                    savedToDatabase: false
                });
                return;
            }
        } catch (e) {
            console.warn('IP Fallback fallito, ripiego su simulata', e);
        }
        setSimulatedLocation();
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

    const reverseGeocode = async (lat, lon) => {
        try {
            console.log('🔍 Ricerca città per coordinate:', { lat, lon });
            
            const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
            if (MAPS_KEY) {
                try {
                    const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&key=${MAPS_KEY}&result_type=locality|administrative_area_level_3`);
                    const data = await res.json();
                    
                    if (data.status === 'OK' && data.results.length > 0) {
                        const addressComponents = data.results[0].address_components;
                        let city = '';
                        let country = 'Italia';
                        let region = '';
                        
                        addressComponents.forEach(component => {
                            const types = component.types;
                            if (types.includes('locality') || types.includes('administrative_area_level_3')) {
                                if (!city) city = component.long_name;
                            } else if (types.includes('administrative_area_level_1')) {
                                region = component.long_name;
                            } else if (types.includes('country')) {
                                country = component.long_name;
                            }
                        });
                        
                        if (city && city.trim() !== '') {
                            console.log('✅ Città rilevata da Google:', city, country);
                            return { city, country, region };
                        }
                    }
                } catch (googleErr) {
                    console.warn('⚠️ Google Reverse Geocoding fallito, tento Nominatim', googleErr);
                }
            }

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
                'Roma';

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
                city: 'Roma',
                country: 'Italia',
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
