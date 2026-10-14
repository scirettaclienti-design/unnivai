import React, { useState, useEffect } from 'react';
import { Wind, CloudRain, Sun, Cloud, Snowflake, CloudFog } from 'lucide-react';
import { weatherService } from '../../services/weatherService';
import { weatherLabel } from '../../lib/italianLabels';

// VERITÀ-PRE-GIRO — il badge mostra il meteo vero o niente: senza coordinate, senza risposta o con una risposta incompleta non appare
// (prima, senza coordinate, mostrava «Soleggiato, 22°, vento 10» inventati). La condizione si legge con la stessa tabella del servizio
// (un temporale non è «Neve», la nebbia non è «Sereno»).
const ICONE = {
    sunny: { Icon: Sun, iconColor: 'text-yellow-500' },
    cloudy: { Icon: Cloud, iconColor: 'text-gray-400' },
    rainy: { Icon: CloudRain, iconColor: 'text-blue-500' },
    snowy: { Icon: Snowflake, iconColor: 'text-sky-300' },
    foggy: { Icon: CloudFog, iconColor: 'text-gray-400' },
};
const maiuscola = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);

export const WeatherAirBadge = ({ city, center, onClick }) => {
    const [weather, setWeather] = useState(null);

    useEffect(() => {
        let vivo = true;
        const fetchWeather = async () => {
            try {
                const lat = center?.latitude || center?.lat;
                const lng = center?.longitude || center?.lng;

                // Senza coordinate non si sa dove: nessun meteo.
                if (!lat || !lng) { setWeather(null); return; }

                // Chiama le API gratuite di Open-Meteo per dati reali
                const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,wind_speed_10m,weather_code`);
                if (!res.ok) { if (vivo) setWeather(null); return; }
                const data = await res.json();

                const temp = data?.current?.temperature_2m;
                const vento = data?.current?.wind_speed_10m;
                const codice = data?.current?.weather_code;
                const condizione = typeof codice === 'number' ? weatherService.mapWmoCodeToCondition(codice) : null;
                // risposta incompleta o con un codice che non conosciamo: niente
                if (typeof temp !== 'number' || !Number.isFinite(temp) || typeof vento !== 'number' || !Number.isFinite(vento) || !condizione) {
                    if (vivo) setWeather(null);
                    return;
                }

                const windSpeedKmh = Math.round(vento);
                let windColor = 'text-green-500';
                if (windSpeedKmh > 15) windColor = 'text-amber-500';
                if (windSpeedKmh > 30) windColor = 'text-red-500';

                if (vivo) setWeather({
                    temp: Math.round(temp),
                    windSpeed: windSpeedKmh,
                    conditionText: maiuscola(weatherLabel(condizione)),
                    color: windColor,
                    ...ICONE[condizione],
                });
            } catch (error) {
                console.warn("Meteo non disponibile", error);
                if (vivo) setWeather(null);
            }
        };

        fetchWeather();
        return () => { vivo = false; };
    }, [center?.lat, center?.latitude, center?.lng, center?.longitude]);

    if (!weather) return null;

    const { Icon, iconColor } = weather;

    return (
        <div className="absolute top-20 right-4 md:top-4 md:right-4 z-40 animate-in fade-in slide-in-from-right-4 duration-500 pointer-events-auto">
            <div 
                className={`bg-white/90 backdrop-blur-xl rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-white/60 p-2 flex flex-col gap-2 transition-all hover:scale-105 ${onClick ? 'cursor-pointer hover:border-orange-200' : ''}`}
                title={weather.conditionText}
                onClick={() => onClick && onClick(weather)}
            >
                {/* Weather */}
                <div className="flex items-center gap-2 px-2">
                    <Icon size={16} className={iconColor} />
                    <span className="text-xs font-bold text-gray-900">{weather.temp}°C</span>
                </div>
                
                <div className="h-px w-full bg-gray-200/50" />
                
                {/* Wind (replaces AQI) */}
                <div className="flex items-center gap-2 px-2">
                    <Wind size={16} className={weather.color} />
                    <div className="flex flex-col">
                        <span className="text-[9px] font-black uppercase tracking-widest text-gray-400 leading-none mb-0.5">Vento</span>
                        <span className="text-xs font-bold text-gray-900 leading-none">{weather.windSpeed} <span className="text-[9px] text-gray-400 font-semibold">km/h</span></span>
                    </div>
                </div>
            </div>
        </div>
    );
};
