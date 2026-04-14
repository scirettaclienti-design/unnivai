import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Info, Sparkles, MapPin, Navigation, Globe, PhoneCall, CalendarCheck, Volume2, Square, BookOpen, Lightbulb, Loader2 } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { useToast } from '../../hooks/use-toast';

export const POIDetailDrawer = ({ poi, onClose, onUnlock, transportMode, onNavigate }) => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const { toast } = useToast();

  // Define premium status: Monument (0) or Subscribed Business
  const isPremium = poi?.level === 0 || poi?.is_premium === true || poi?.subscription_status === 'active';

  const initialImageUrl = poi?.image || poi?.image_urls?.[0];
  const [displayImage, setDisplayImage] = useState(initialImageUrl);
  
  const map = useMap();
  const placesLib = useMapsLibrary('places');

  useEffect(() => {
      // If we already have a specific image or we are not a waypoint/poi missing an image, return.
      if (displayImage && !displayImage.includes('unsplash.com')) return;
      if (!map || !placesLib || !poi || (!poi.name && !poi.title)) return;

      const service = new placesLib.PlacesService(map);
      const request = {
          query: `${poi.name || poi.title} ${poi.city || poi.location || ''}`,
          fields: ['photos']
      };

      service.findPlaceFromQuery(request, (results, status) => {
          if (status === window.google.maps.places.PlacesServiceStatus.OK && results && results[0] && results[0].photos) {
              setDisplayImage(results[0].photos[0].getUrl({ maxWidth: 800 }));
          }
      });
  }, [map, placesLib, poi?.name, poi?.title, displayImage]);

  useEffect(() => {
    // Stop speaking when drawer closes or unmounts
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  if (!poi) return null;

  const toggleSpeech = () => {
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    } else {
      if ('speechSynthesis' in window && poi.historicalNotes) {
        const utterance = new SpeechSynthesisUtterance(poi.historicalNotes);
        utterance.lang = 'it-IT';
        const voices = window.speechSynthesis.getVoices();
        const itVoice = voices.find(v => v.lang.startsWith('it')) || voices[0];
        if (itVoice) utterance.voice = itVoice;
        utterance.onend = () => setIsSpeaking(false);
        window.speechSynthesis.speak(utterance);
        setIsSpeaking(true);
      }
    }
  };

  const handleUnlock = () => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#f6d365', '#d4af37', '#ffffff', '#14b8a6'] // Gold and Teal
    });
    if (onUnlock) onUnlock(poi);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="absolute bottom-0 left-0 right-0 z-[1001] bg-white/95 backdrop-blur-3xl rounded-t-[2.5rem] shadow-[0_-20px_60px_rgba(0,0,0,0.15)] border-t border-white/60 min-h-[40vh] max-h-[85vh] flex flex-col overflow-hidden"
      >
        <div className="absolute top-0 left-0 right-0 h-1.5 flex justify-center z-10">
           <div className="w-16 h-1.5 bg-gray-300/80 rounded-full mt-4" />
        </div>
        
        {displayImage && (
            <div className="w-full h-40 shrink-0 relative mt-0">
                <img loading="lazy" src={displayImage} className="w-full h-full object-cover transition-opacity duration-700 opacity-100" alt={poi.name || poi.title} />
                <div className="absolute inset-0 bg-gradient-to-t from-white via-white/20 to-transparent mix-blend-normal" />
            </div>
        )}

        <div className={`p-8 pb-14 overflow-y-auto flex-1 no-scrollbar pt-2 ${displayImage ? '-mt-12 relative z-10' : 'mt-8'}`}>
          
          {/* HEADER SECTION */}
          <div className="flex justify-between items-start mb-6">
            <div className="flex-1 pr-4">
              {(poi.level === 0 || poi.type === 'native_poi') && <span className="text-5xl mb-4 block drop-shadow-lg">{poi.icon || '📍'}</span>}
              <div className="flex flex-wrap items-center gap-3 mt-2 mb-4">
                {/* Tour Step Badge */}
                {poi.level === 2 && (
                  <span className="text-white font-black bg-gradient-to-r from-orange-600 to-terracotta-500 px-4 py-1.5 rounded-full text-[11px] uppercase tracking-[0.2em] shadow-lg shadow-orange-500/30">
                    {typeof poi.index === 'number' ? `Tappa ${poi.index + 1}` : 'Tappa Tour'}
                  </span>
                )}
                {poi.level === 0 && (
                   <span className="text-white font-black bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-1.5 rounded-full text-[11px] uppercase tracking-[0.2em] shadow-lg shadow-orange-500/20">
                     Monumento
                   </span>
                )}
              </div>
              
              <h2 className="text-4xl font-black text-gray-900 leading-tight tracking-tight mb-3 drop-shadow-sm">
                {poi.name || poi.company_name || poi.title}
              </h2>
              
              {/* GOOGLE REVIEWS / RATING */}
              {poi.rating && (
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="font-black text-gray-900">{parseFloat(poi.rating).toFixed(1)}</span>
                  <div className="flex items-center text-yellow-500">
                    {[1,2,3,4,5].map(star => (
                      <svg key={star} className={`w-4 h-4 ${star <= Math.round(poi.rating) ? 'fill-current' : 'text-gray-300 fill-current'}`} viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                  {poi.reviewsCount && (
                    <span className="text-gray-500 text-sm font-medium ml-1">({poi.reviewsCount})</span>
                  )}
                </div>
              )}
              
              <div className="flex flex-wrap items-center gap-2 mt-3">
                {/* Location / City */}
                {(poi.city || poi.location) && (
                  <div className="flex items-center gap-1 text-gray-500 font-bold text-xs uppercase tracking-wider bg-gray-50 border border-gray-100 px-3 py-1.5 rounded-full">
                    <MapPin size={12} /> <span>{poi.city || poi.location}</span>
                  </div>
                )}
                
                {/* Business/POI Specific Badges */}
                {/* Visualizzati solo se l'entità è premium o pubblica (isPremium) */}
                {isPremium && (poi.price_level || poi.business_hours || poi.price) && (
                  <>
                    {(poi.price_level || poi.price) && (
                      <span className="text-green-700 font-bold bg-green-50 px-3 py-1.5 rounded-full text-xs uppercase tracking-wider border border-green-100">
                        {poi.price_level || poi.price}
                      </span>
                    )}
                    {poi.business_hours && (
                      <span className="text-blue-700 font-bold bg-blue-50 px-3 py-1.5 rounded-full text-xs uppercase tracking-wider border border-blue-100">
                        {poi.business_hours}
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-3 items-center pt-2">
              <button onClick={onClose} className="p-3 bg-gray-50 hover:bg-gray-200 rounded-full transition-colors active:scale-95 text-gray-500 shadow-sm shrink-0">
                <X size={20} />
              </button>
              {poi.historicalNotes && (
                <button 
                  onClick={toggleSpeech}
                  className="p-3 bg-purple-50 hover:bg-purple-100 text-purple-600 rounded-full transition-colors active:scale-95 shadow-sm border border-purple-100 shrink-0 relative"
                  title="Ascolta Guida"
                >
                  {isSpeaking ? <Square fill="currentColor" size={20} className="text-red-500 animate-pulse" /> : <Volume2 size={20} />}
                  {!isSpeaking && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-purple-500 rounded-full animate-ping" />}
                  {!isSpeaking && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-purple-500 rounded-full" />}
                </button>
              )}
            </div>
          </div>

          {/* ACTION BAR (Esclusiva Premium/Monumenti) */}
          {isPremium && (poi.website_url || poi.phone_number || poi.booking_url) && (
            <div className="flex gap-3 mb-8">
              {poi.website_url && (
                <button 
                  onClick={() => window.open(poi.website_url, '_blank')}
                  className="flex-1 bg-gray-50 text-gray-700 font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 hover:bg-gray-100 transition-colors border border-gray-200 shadow-sm text-sm"
                >
                  <Globe size={18} /> Sito
                </button>
              )}
              {poi.phone_number && (
                <button 
                  onClick={() => window.open(`tel:${poi.phone_number}`, '_self')}
                  className="flex-1 bg-gray-50 text-gray-700 font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 hover:bg-gray-100 transition-colors border border-gray-200 shadow-sm text-sm"
                >
                  <PhoneCall size={18} /> Chiama
                </button>
              )}
              {poi.booking_url ? (
                <button 
                  onClick={() => window.open(poi.booking_url, '_blank')}
                  className="flex-[1.5] bg-gradient-to-r from-[#d4af37] to-[#eaaa00] text-white font-black py-3.5 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-yellow-500/30 hover:shadow-xl active:scale-95 transition-all text-sm uppercase tracking-wide"
                >
                  <CalendarCheck size={18} /> Prenota
                </button>
              ) : poi.level === 1 ? (
                <button 
                  onClick={() => toast({ title: 'Prenotazione non disponibile per questa struttura.', type: 'info' })}
                  className="flex-[1.5] bg-gray-900 text-white font-black py-3.5 rounded-2xl flex items-center justify-center gap-2 shadow-lg hover:bg-black active:scale-95 transition-all text-sm uppercase tracking-wide"
                >
                  Dettagli
                </button>
              ) : null}
            </div>
          )}

          {/* CONTENT SECTION (History, Facts, Subtitle) */}
          <div className="space-y-6 mb-8">
            {poi.historicalNotes && (
              <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-lg shadow-gray-200/50 relative">
                <div className="flex items-center gap-2 mb-4 text-gray-800 font-black text-xs uppercase tracking-widest">
                  <BookOpen size={16} className="text-orange-500" /> <span>Storia e Curiosità</span>
                </div>
                <p className="text-gray-700 leading-relaxed font-medium text-base">"{poi.historicalNotes}"</p>
              </div>
            )}

            {poi.funFacts?.length > 0 && (
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-6 rounded-3xl border border-orange-100 shadow-md">
                <div className="flex items-center gap-2 mb-4 text-orange-900 font-black text-xs uppercase tracking-widest">
                  <Lightbulb size={18} className="text-orange-500 animate-pulse" /> <span>Lo sapevi che?</span>
                </div>
                <p className="text-orange-900 text-sm font-bold leading-relaxed">{poi.funFacts[0]}</p>
              </div>
            )}
            
            {poi.description && poi.description !== "Punto d'interesse consigliato." && poi.description !== "Punto di interesse" && !poi.historicalNotes && (
              <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-lg shadow-gray-200/50 relative">
                <div className="flex items-center gap-2 mb-4 text-gray-800 font-black text-xs uppercase tracking-widest">
                  <BookOpen size={16} className="text-orange-500" /> <span>Panoramica</span>
                </div>
                <p className="text-gray-700 leading-relaxed font-medium text-base">"{poi.description}"</p>
              </div>
            )}

            {/* FALLBACK LOADING STATE */}
            {(poi.level === 2 || poi.level === 0) && !poi.historicalNotes && (!poi.description || poi.description === "Punto d'interesse consigliato." || poi.description === "Punto di interesse") && !poi.funFacts && (
              <div className="flex flex-col items-center justify-center p-8 bg-gray-50/80 backdrop-blur-sm rounded-3xl border border-gray-100 shadow-inner my-4">
                <Loader2 size={32} className="text-orange-500 animate-spin mb-4" />
                <p className="text-gray-600 font-bold text-sm text-center">
                  Generazione approfondimenti in corso...
                </p>
                <p className="text-gray-400 text-xs font-medium mt-2 text-center">
                  L'Intelligenza Artificiale sta scrivendo una storia unica per te.
                </p>
              </div>
            )}
          </div>

          {/* MAIN BOTTOM CALL TO ACTION */}
          {poi.level === 2 ? (
            <button 
              onClick={handleUnlock}
              disabled={poi.completed}
              className={`w-full text-white py-4.5 rounded-[1.25rem] font-black flex items-center justify-center gap-3 shadow-xl active:scale-95 transition-all text-sm tracking-widest uppercase relative overflow-hidden group ${poi.completed ? 'bg-gradient-to-r from-teal-400 to-teal-600 shadow-teal-500/40 cursor-default active:scale-100' : 'bg-[length:200%_auto] bg-gradient-to-r from-orange-500 via-pink-500 to-orange-500 hover:bg-[right_center] animate-[pulse_3s_ease-in-out_infinite] shadow-orange-500/40 hover:shadow-orange-500/60'}`}
            >
              {/* Animated Gradient shimmer overlay */}
              {!poi.completed && <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-[100%] group-hover:translate-x-[100%] transition-transform duration-1000" />}
              <span className="relative z-10 flex items-center gap-3">
                 {poi.completed ? 'Tappa Completata' : 'Sblocca Contenuto'} <Sparkles size={18} className={poi.completed ? "text-teal-100" : "text-yellow-200"} />
              </span>
            </button>
          ) : poi.level === 1 ? (
             <button className="w-full bg-gray-100/80 backdrop-blur-sm border border-gray-200 text-gray-400 py-4.5 rounded-[1.25rem] font-bold flex items-center justify-center gap-2 transition-all text-sm cursor-not-allowed uppercase tracking-wider">
               <Navigation size={18} /> Ottieni Indicazioni
             </button>
          ) : (
            <button
              onClick={() => onNavigate && onNavigate(poi)}
              className="w-full text-white py-3.5 rounded-full font-bold flex items-center justify-center gap-2 shadow-lg shadow-orange-400/30 active:scale-95 transition-all text-sm min-h-[44px]"
              style={{ background: 'linear-gradient(135deg, #C2703E, #D4A843)' }}>
              <Navigation size={18} /> Naviga
            </button>
          )}

          {/* TRANSIT BRIDGE */}
          {transportMode === 'transit' && (
            <button 
              onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${poi.latitude || poi.lat},${poi.longitude || poi.lng}&travelmode=transit`, '_blank')}
              className="w-full mt-3 bg-indigo-600 text-white py-4 rounded-[1.25rem] font-bold flex items-center justify-center gap-2 shadow-lg hover:bg-indigo-700 active:scale-95 transition-all text-sm"
            >
              <Navigation size={18} /> Ottieni Percorso Bus/Metro
            </button>
          )}

        </div>
      </motion.div>
    </AnimatePresence>
  );
};
