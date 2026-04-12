/**
 * DVAI-022 — MapAPIWrapper
 * Wrappa i figli con <APIProvider> (Google Maps SDK ~200 KB) solo dove necessario:
 * MapPage, TourBuilder, Explore.
 * Rimuovendolo da App.jsx si evita il caricamento del SDK su ogni pagina.
 */
import { APIProvider } from '@vis.gl/react-google-maps';

const MAP_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

export default function MapAPIWrapper({ children }) {
    return (
        <APIProvider apiKey={MAP_API_KEY} libraries={['places', 'marker']}>
            {children}
        </APIProvider>
    );
}
