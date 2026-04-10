import { useState, useEffect } from 'react';

export function useGeolocation(options = {}) {
    const [state, setState] = useState({
        location: null,
        loading: false,
        error: null
    });

    const initializeLocation = async () => {
        console.log('🌍 Inizializzazione sistema geolocalizzazione...');

        if (!navigator.geolocation) {
            console.log('❌ Geolocalizzazione non supportata dal browser');
            setSimulatedLocation();
            return;
        }

        // Prova sempre la geolocalizzazione reale prima
        console.log('🎯 Tentativo geolocalizzazione reale...');
        await getCurrentLocation();
    };

    const getCurrentLocation = async () => {
        if (!navigator.geolocation) {
            console.log('❌ Geolocalizzazione non supportata dal browser');
            setSimulatedLocation();
            return;
        }

        setState(prev => ({ ...prev, loading: true, error: null }));

        const defaultOptions = {
            enableHighAccuracy: true, // Abilita per maggiore precisione
            timeout: 15000, // Timeout più lungo per dare tempo al GPS
            maximumAge: 60000, // Cache di 1 minuto per essere più reattivo
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

            // Verifica che le coordinate siano sensate (non 0,0 o valori invalidi)
            if (latitude && longitude && !isNaN(latitude) && !isNaN(longitude) &&
                Math.abs(latitude) > 0.001 && Math.abs(longitude) > 0.001) {

                // Reverse geocoding per ottenere città e paese
                const cityData = await reverseGeocode(latitude, longitude);

                console.log('📍 Città identificata:', cityData.city, cityData.country);

                setState({
                    location: {
                        latitude,
                        longitude,
                        city: cityData.city,
                        country: cityData.country
                    },
                    loading: false,
                    error: null
                });

                return; // Successo!
            } else {
                throw new Error('Coordinate GPS non valide o troppo imprecise');
            }

        } catch (error) {
            let errorMessage = 'Errore nel rilevare la posizione';

            console.log('❌ Dettagli errore geolocalizzazione:', error);

            if (error instanceof GeolocationPositionError) {
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage = 'Permessi geolocalizzazione negati dall\'utente';
                        console.log('🚫 L\'utente ha negato i permessi di geolocalizzazione');
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage = 'Posizione GPS non disponibile (segnale debole?)';
                        console.log('📡 Segnale GPS non disponibile');
                        break;
                    case error.TIMEOUT:
                        errorMessage = 'Timeout nel rilevamento GPS (15s scaduti)';
                        console.log('⏰ Timeout GPS dopo 15 secondi');
                        break;
                }
            }

            // Solo in caso di errore reale, usa il fallback
            console.log('⚠️ Usando posizione di fallback a causa di:', errorMessage);

            setState({
                location: null,
                loading: false,
                error: errorMessage
            });

            // Fallback solo dopo errore reale
            setTimeout(() => {
                console.log('🔄 Applicando fallback dopo errore geolocalizzazione');
                setSimulatedLocation();
            }, 1000);
        }
    };

    // Funzione per il reverse geocoding usando OpenStreetMap (gratuito)
    const reverseGeocode = async (lat, lon) => {
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
                'Roma';

            const detectedCountry = data.address?.country || 'Italia';

            console.log('✅ Città finale rilevata:', detectedCity, detectedCountry);

            return {
                city: detectedCity,
                country: detectedCountry
            };
        } catch (error) {
            console.warn('❌ Reverse geocoding fallito:', error);
            return {
                city: `Lat: ${lat.toFixed(4)}, Lon: ${lon.toFixed(4)}`,
                country: 'Posizione GPS'
            };
        }
    };

    const setSimulatedLocation = () => {
        console.log('🎯 Impostazione posizione di fallback: Roma, Italia');
        console.log('💡 Per vedere la tua posizione reale, abilita la geolocalizzazione nel browser');
        setState({
            location: {
                latitude: 41.9028,
                longitude: 12.4964,
                city: 'Roma',
                country: 'Italia'
            },
            loading: false,
            error: 'Posizione simulata - abilita GPS per la tua posizione reale'
        });
    };

    // Sistema di fallback intelligente per deployment
    useEffect(() => {
        initializeLocation();
    }, []);

    return {
        ...state,
        getCurrentLocation,
        hasPermission: !!state.location
    };
}
