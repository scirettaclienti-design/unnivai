import React, { useState, useEffect } from 'react';
import { Star, Navigation, MapPin, X, Map } from 'lucide-react';
import { resolvePoiPhoto } from '../../lib/poiPhoto';
import { isPlacesPhoto } from '../../lib/categoryPalette';

export const POIPopupCard = ({ poi, onClose, onNavigate }) => {
    if (!poi) return null;

    // Gate VERITÀ VISIVA (F26) — stesso intervento del drawer: il seme da
    // `poi.image || poi.image_urls?.[0]` metteva a schermo l'immagine del
    // chiamante prima di ogni verifica. Si parte da null e si accetta subito
    // solo ciò che è già ancorato a Google Places.
    const [displayImage, setDisplayImage] = useState(
        () => (isPlacesPhoto(poi.image) ? poi.image : null),
    );
    // Gate FOTO (passo 1) — terza condizione. Prima ne esistevano due
    // ("ho una foto" / "non ho una foto") e la seconda renderizzava sempre uno
    // spinner: se la foto non arrivava mai, quello spinner girava per sempre
    // (regola #7, nessuno stato non-uscibile). Ora "ricerca conclusa senza
    // foto" è uno stato suo, impostato su OGNI via d'uscita — successo,
    // fallimento (il ramo che non esisteva) e early-return.
    const [photoPhase, setPhotoPhase] = useState('pending'); // 'pending' | 'resolved'

    // Gate FOTO — via la ricerca per nome (findPlaceFromQuery). Qui era anche
    // peggio che nel drawer: la clausola `isTourWaypoint` faceva ripartire la
    // query ANCHE con una googlePhoto corretta già in mano, sovrascrivendo una
    // foto giusta con una cercata per nome. Rimossa.
    useEffect(() => {
        // F26 — "è ancorata a Google Places?" al posto di "è unsplash?".
        if (isPlacesPhoto(displayImage)) { setPhotoPhase('resolved'); return; }
        // Senza place_id nessun ancoraggio è possibile: azzera e chiudi la fase,
        // così non resta a schermo un'immagine ereditata dal chiamante.
        if (!poi.googlePlaceId) { setDisplayImage(null); setPhotoPhase('resolved'); return; }

        // Timeout proprio (5s) dentro fetchPlaceDetailsForTour, ma non abortabile
        // dall'esterno: il flag impedisce il setState dopo lo smontaggio.
        let cancelled = false;
        (async () => {
            const { placesDiscoveryService } = await import('../../services/placesDiscoveryService');
            const details = await placesDiscoveryService.fetchPlaceDetailsForTour(poi.googlePlaceId, poi.city);
            if (cancelled) return;
            // F26 — il null è ONORATO: `if (url)` scartava proprio il verdetto
            // che serviva. "Ricerca conclusa senza foto" resta uno stato finito
            // (photoPhase 'resolved'), quindi nessuno spinner perpetuo.
            setDisplayImage(resolvePoiPhoto(poi, details));
            setPhotoPhase('resolved');
        })();
        return () => { cancelled = true; };
    }, [poi.googlePlaceId, poi.city, displayImage]);

    // Fake rating since we might not always have it mapped
    const [rating, setRating] = useState(poi.rating || 4.5);
    const [reviews, setReviews] = useState(poi.user_ratings_total || Math.floor(Math.random() * 500) + 50);

    // If it's a native Google POI, the POI Drawer was fetching live ratings.
    // We'll just display them if passed in `poi` object.
    
    return (
        <div className="w-64 md:w-72 bg-white rounded-xl overflow-hidden shadow-2xl flex flex-col pointer-events-auto relative">
            {/* Header Image */}
            {displayImage ? (
                <div className="h-32 relative shrink-0 bg-gray-100">
                    <img loading="lazy" src={displayImage} alt={poi.name || poi.title} className="w-full h-full object-cover transition-opacity duration-700 opacity-100" />
                    <button 
                        onClick={(e) => { e.stopPropagation(); onClose(); }}
                        className="absolute top-2 right-2 p-1.5 bg-black/40 hover:bg-black/60 backdrop-blur-md rounded-full text-white transition-colors"
                    >
                        <X size={14} strokeWidth={3} />
                    </button>
                </div>
            ) : photoPhase === 'pending' ? (
                // Ricerca in corso — l'unico caso in cui lo spinner è onesto.
                <div className="h-32 relative shrink-0 bg-gray-50 flex items-center justify-center">
                    <div className="w-6 h-6 border-2 border-orange-400 border-t-transparent rounded-full animate-spin opacity-50" />
                    <div className="absolute top-2 right-2 z-10">
                        <button
                            onClick={(e) => { e.stopPropagation(); onClose(); }}
                            className="p-1.5 bg-gray-200 hover:bg-gray-300 rounded-full text-gray-600 transition-colors"
                        >
                            <X size={14} strokeWidth={3} />
                        </button>
                    </div>
                </div>
            ) : (
                // Ricerca conclusa senza foto: stato FINITO. Header compatto,
                // niente immagine e niente placeholder — stesso trattamento del
                // drawer (POIDetailDrawer.jsx:88,95), che il blocco lo omette.
                <div className="relative shrink-0 flex justify-end px-2 pt-2">
                    <button
                        onClick={(e) => { e.stopPropagation(); onClose(); }}
                        className="p-1.5 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600 transition-colors"
                    >
                        <X size={14} strokeWidth={3} />
                    </button>
                </div>
            )}
            
            {/* Content */}
            <div className="p-3">
                <h3 className="font-bold text-gray-900 text-base leading-tight mb-1 truncate">
                    {poi.name || poi.title}
                </h3>
                
                {/* Rating & Category */}
                <div className="flex items-center gap-1.5 mb-2">
                    <span className="text-sm font-bold text-gray-800">{rating.toFixed(1)}</span>
                    <div className="flex text-yellow-500">
                        {[1, 2, 3, 4, 5].map(star => (
                            <Star key={star} size={12} fill={star <= Math.round(rating) ? 'currentColor' : 'none'} strokeWidth={1.5} />
                        ))}
                    </div>
                    <span className="text-xs text-gray-500">({reviews})</span>
                    <span className="text-xs text-gray-300 mx-0.5">•</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded-md truncate max-w-[80px]">
                        {poi.category || poi.type || 'Punto Mappa'}
                    </span>
                </div>

                {/* Address/Description */}
                <p className="text-xs text-gray-500 line-clamp-2 mb-3 pr-2 flex items-start gap-1">
                    <MapPin size={12} className="shrink-0 mt-0.5 text-gray-400" />
                    {poi.description || poi.address || poi.vicinity || `Punto di interesse${poi.city ? ` a ${poi.city}` : ''}`}
                </p>

                {/* Actions */}
                <div className="flex gap-2 mt-auto">
                    <button 
                        onClick={(e) => { e.stopPropagation(); onNavigate && onNavigate(poi); }}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                    >
                        <Navigation size={14} className="fill-current rotate-45" />
                        Apri Direzioni
                    </button>
                    {poi.id && (
                        <button 
                            className="p-2 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors flex shrink-0 items-center justify-center"
                            title="Salva posizione"
                        >
                            <Map size={14} />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
