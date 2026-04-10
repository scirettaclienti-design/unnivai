import React from 'react';
import Map, { Marker } from 'react-map-gl';
import { useNavigate } from 'react-router-dom';
import { Maximize2 } from 'lucide-react';
import { useCity } from '@/context/CityContext';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

export const ExploreMiniMap = ({ tours = [] }) => {
  const { city } = useCity();
  const navigate = useNavigate();

  // Coordinate di default (Roma) se la città non è ancora risolta
  const initialViewState = {
    longitude: 12.4964,
    latitude: 41.9028,
    zoom: 11
  };

  return (
    <div className="relative w-full h-64 rounded-3xl overflow-hidden shadow-lg border border-gray-100 mb-8">
      <Map
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={initialViewState}
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/light-v11"
        scrollZoom={false}
        dragPan={false}
      >
        {tours.map((tour) => (
          <Marker 
            key={tour.id} 
            latitude={tour.steps?.[0]?.lat || 41.8902} 
            longitude={tour.steps?.[0]?.lng || 12.4922}
          >
            {/* Puntaoreri Neri Minimalisti richiesti */}
            <div className="w-4 h-4 bg-black rounded-full border-2 border-white shadow-md hover:scale-110 transition-transform cursor-pointer" />
          </Marker>
        ))}
      </Map>
      
      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
      
      <button 
        onClick={() => navigate('/map')}
        className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-sm text-black px-4 py-2 rounded-full flex items-center gap-2 text-sm font-semibold shadow-xl hover:bg-white transition-colors"
      >
        <Maximize2 size={16} />
        Espandi Mappa
      </button>
    </div>
  );
};
