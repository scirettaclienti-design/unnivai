import React, { useState, useEffect } from 'react';
import { CloudSun, Wind, CloudRain, Sun, Cloud, Snowflake } from 'lucide-react';

export const WeatherAirBadge = ({ city, center, onClick }) => {
    const [weather, setWeather] = useState(null);

    useEffect(() => {
        const fetchWeather = async () => {
            try {
                const lat = center?.latitude || center?.lat;
                const lng = center?.longitude || center?.lng;

                // Fallback graceful se le coordinate non sono ancora proiettate
                if (!lat || !lng) {
                    setWeather({
                        temp: 22,
                        windSpeed: 10,
                        conditionText: 'Soleggiato',
                        color: 'text-green-500', 
                        Icon: CloudSun
                    });
                    return;
                }

                // Chiama le API gratuite di Open-Meteo per dati reali
                const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,wind_speed_10m,weather_code`);
                const data = await res.json();

                if (data && data.current) {
                    const code = data.current.weather_code;
                    let conditionText = 'Sereno';
                    let Icon = Sun;
                    let iconColor = 'text-yellow-500';

                    if (code >= 1 && code <= 3) {
                        conditionText = 'Nuvoloso';
                        Icon = Cloud;
                        iconColor = 'text-gray-400';
                    } else if (code >= 51 && code <= 67) {
                        conditionText = 'Pioggia';
                        Icon = CloudRain;
                        iconColor = 'text-blue-500';
                    } else if (code >= 71) {
                        conditionText = 'Neve';
                        Icon = Snowflake;
                        iconColor = 'text-sky-300';
                    }

                    const windSpeedKmh = Math.round(data.current.wind_speed_10m);
                    let windColor = 'text-green-500';
                    if (windSpeedKmh > 15) windColor = 'text-amber-500';
                    if (windSpeedKmh > 30) windColor = 'text-red-500';

                    setWeather({
                        temp: Math.round(data.current.temperature_2m),
                        windSpeed: windSpeedKmh,
                        conditionText,
                        color: windColor,
                        Icon,
                        iconColor
                    });
                }
            } catch (error) {
                console.warn("Meteo non disponibile", error);
            }
        };

        fetchWeather();
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
