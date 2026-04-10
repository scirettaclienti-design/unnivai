import React from 'react';
// import { Marker } from 'react-map-gl';
const Marker = ({ children }) => <div className="hidden">{children}</div>;
import { Utensils, ShoppingBag, Coffee, Camera, Landmark, Flag, MapPin, Store } from 'lucide-react';

const getLucideIcon = (typeInput) => {
    // If we receive an array (like category_tags), we flatten it or check it against a priority list
    const tags = Array.isArray(typeInput) ? typeInput.map(t => t.toLowerCase()) : [typeInput?.toLowerCase()].filter(Boolean);
    
    // Priority check to assign the most specific icon
    if (tags.some(t => ['food', 'restaurant', 'osteria', 'trattoria', 'bar', 'ristorazione', 'cibo', 'gastronomia'].includes(t))) {
        return <Utensils size={18} strokeWidth={2.5} />;
    }
    if (tags.some(t => ['coffee', 'caffè', 'bar'].includes(t))) {
        return <Coffee size={18} strokeWidth={2.5} />;
    }
    if (tags.some(t => ['shopping', 'shop', 'negozio'].includes(t))) {
        return <ShoppingBag size={18} strokeWidth={2.5} />;
    }
    if (tags.some(t => ['photo', 'fotografia', 'punto panoramico'].includes(t))) {
        return <Camera size={18} strokeWidth={2.5} />;
    }
    if (tags.some(t => ['tour_entry', 'guida'].includes(t))) {
        return <Flag size={18} strokeWidth={2.5} />;
    }
    if (tags.some(t => ['culture', 'cultura', 'storia', 'arte', 'monumento'].includes(t))) {
        return <Landmark size={18} strokeWidth={2.5} />;
    }
    if (tags.some(t => ['business_partner', 'service', 'attività'].includes(t))) {
        return <Store size={18} strokeWidth={2.5} />;
    }
    
    // Fallback if no specific tag is found, default to Store for businesses or MapPin
    return <Store size={18} strokeWidth={2.5} />;
};

const getSignatureIcon = (name) => {
    if (!name) return null;
    const n = name.toLowerCase();
    
    // 1. Check Offline Cache
    try {
        // Assume che ci sia un service o process che salva 'signature_icon_colosseo' nel localStorage
        const safeKey = `signature_icon_${n.replace(/\s+/g, '_')}`;
        const cached = localStorage.getItem(safeKey);
        if (cached) return cached; // Restituisce Base64 se presente
    } catch (e) {}

    // 2. Fallback to Online URLs
    if (n.includes('colosseo')) return 'https://images.unsplash.com/photo-1552832233-da6a59921e10?w=100&h=100&fit=crop';
    if (n.includes('pantheon')) return 'https://images.unsplash.com/photo-1552084771-e0e470879cf0?w=100&h=100&fit=crop';
    if (n.includes('trevi')) return 'https://images.unsplash.com/photo-1515542622106-78bda8bb0e5b?w=100&h=100&fit=crop';
    if (n.includes('pietro') || n.includes('vatican')) return 'https://images.unsplash.com/photo-1531572753322-ad011ceefd5e?w=100&h=100&fit=crop';
    return null;
};

export const SmartMarker = ({ point, level, onClick, zIndex }) => {
    const lat = point.latitude || point.lat;
    const lng = point.longitude || point.lng;

    if (!lat || !lng) return null;

    const handleClick = (e) => {
        if (e.originalEvent) e.originalEvent.stopPropagation();
        else e.stopPropagation();
        
        if (onClick) onClick({ ...point, level });
    };

    // LEVEL 2: Tour Step
    if (level === 2) {
        const stepNum = (typeof point.index === 'number') ? point.index + 1 : '';
        const isCompleted = point.completed;

        return (
            <Marker latitude={lat} longitude={lng} anchor="center" style={{ zIndex }}>
                <div onClick={handleClick} className="relative group cursor-pointer transition-transform duration-300 hover:scale-110">
                    {/* Shadow pulsante per direzione attiva */}
                    {!isCompleted && <div className="absolute -inset-2 bg-black/20 rounded-full animate-pulse pointer-events-none" />}
                    
                    {/* Cerchio base Glassmorphism. Completato = accento colore, Da fare = vetro neutro bianco/grigio semitrasparente */}
                    <div className={`w-8 h-8 flex items-center justify-center rounded-full shadow-lg relative z-10 transition-all hover:shadow-xl backdrop-blur-md border ${
                        isCompleted 
                        ? 'bg-teal-500/80 border-teal-400 text-white shadow-teal-500/30' 
                        : 'bg-white/70 border-white/80 text-gray-800 hover:bg-white/90'
                    }`}>
                        <span className="font-extrabold text-[13px] leading-none">
                            {stepNum}
                        </span>
                    </div>
                </div>
            </Marker>
        );
    }

    // LEVEL 1: Business Activity
    if (level === 1) {
        const isElite = point.subscription_tier === 'elite' || point.tier === 'elite';

        return (
            <Marker latitude={lat} longitude={lng} anchor="center" style={{ zIndex }}>
                <div onClick={handleClick} className="relative group cursor-pointer transition-transform duration-300 hover:scale-110">
                    {/* Only Elite gets the pulsing background aura */}
                    {isElite && <div className="absolute -inset-2 bg-[#d4af37]/40 rounded-full animate-pulse pointer-events-none" />}
                    
                    {/* Base circle: Gold for Elite, Orange for Base */}
                    <div className={`w-10 h-10 rounded-full border-2 border-white text-white flex items-center justify-center shadow-lg relative z-10 ${
                        isElite 
                        ? 'bg-gradient-to-br from-[#f6d365] to-[#d4af37]' 
                        : 'bg-gradient-to-br from-orange-400 to-orange-500'
                    }`}>
                        {getLucideIcon(point.category_tags || point.category || point.type)}
                    </div>
                    {/* Tooltip on hover */}
                    <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-bold text-gray-900 bg-white border border-gray-200 px-3 py-1.5 rounded-xl shadow-lg pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50 flex items-center gap-1">
                        {isElite && <span className="text-[#d4af37] text-sm drop-shadow-sm mr-1">👑</span>}
                        {point.company_name || point.title || point.name || 'Attività'}
                    </div>
                </div>
            </Marker>
        );
    }

    // LEVEL 0: Monument / POI
    const signatureImg = getSignatureIcon(point.name || point.title);

    return (
        <Marker latitude={lat} longitude={lng} anchor="center" style={{ zIndex }}>
            {/* Scala 70% per dare profondità */}
            <div onClick={handleClick} className="flex flex-col items-center group cursor-pointer relative transition-transform duration-300 transform scale-75 hover:scale-[0.85] opacity-90 hover:opacity-100">
                {signatureImg ? (
                    <div className="w-12 h-12 rounded-full border-[3px] border-[#d4af37] shadow-lg overflow-hidden bg-white">
                        <img src={signatureImg} alt={point.name || 'Monumento'} className="w-full h-full object-cover" />
                    </div>
                ) : (
                    <div className="bg-white/95 p-1.5 rounded-full border border-gray-200 shadow-lg">
                        <span className="text-xl leading-none">{point.icon || '🏛️'}</span>
                    </div>
                )}
                <p className="mt-1 text-[11px] font-bold text-white bg-black/60 px-2 py-0.5 rounded shadow-sm opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap absolute top-full pointer-events-none z-50">
                    {point.name || point.title || 'Monumento'}
                </p>
            </div>
        </Marker>
    );
};
