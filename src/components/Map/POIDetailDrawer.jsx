import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MapPin, Navigation, Globe, PhoneCall, CalendarCheck, Volume2, Square, BookOpen, Lightbulb, Loader2, Star } from 'lucide-react';
import confetti from 'canvas-confetti';
import { resolvePoiPhoto } from '../../lib/poiPhoto';
import { getCoverPalette, isPlacesPhoto } from '../../lib/categoryPalette';
import { THEME } from '../../styles/themeTokens';

export const POIDetailDrawer = ({
  poi,
  onClose,
  onUnlock,
  transportMode,
  onNavigate,
  isNavigating = false,
  isCompleted = false,
  isTourStep = false,
}) => {
  const [isSpeaking, setIsSpeaking] = useState(false);

  const isPremium = poi?.level === 0 || poi?.is_premium === true || poi?.subscription_status === 'active';

  // Gate VERITÀ VISIVA (F26) — solo foto Places verificate
  const [displayImage, setDisplayImage] = useState(
    () => (isPlacesPhoto(poi?.image) ? poi.image : null),
  );

  useEffect(() => {
    if (isPlacesPhoto(displayImage)) return;
    if (!poi?.googlePlaceId) { setDisplayImage(null); return; }

    let cancelled = false;
    (async () => {
      const { placesDiscoveryService } = await import('../../services/placesDiscoveryService');
      const details = await placesDiscoveryService.fetchPlaceDetailsForTour(poi.googlePlaceId, poi.city);
      if (cancelled) return;
      setDisplayImage(resolvePoiPhoto(poi, details));
    })();
    return () => { cancelled = true; };
  }, [poi?.googlePlaceId, poi?.city, displayImage]);

  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
    };
  }, []);

  if (!poi) return null;

  const toggleSpeech = () => {
    if (isSpeaking) {
      window.speechSynthesis?.cancel();
      setIsSpeaking(false);
    } else {
      const textToSpeak = poi.historicalNotes || poi.description;
      if ('speechSynthesis' in window && textToSpeak) {
        const utterance = new SpeechSynthesisUtterance(textToSpeak);
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
      colors: [THEME.raw.accentPrimary, THEME.raw.accentDeep, THEME.raw.textPrimary, THEME.raw.surfaceElevated],
    });
    if (onUnlock) onUnlock(poi);
  };

  const palette = getCoverPalette(poi?.category || poi?.type, poi?.type);
  const poiTitle = poi.name || poi.company_name || poi.title || 'Punto di interesse';
  const hasValidRating = Number.isFinite(poi.rating) && poi.rating > 0;
  const isStepInTour = isTourStep || typeof poi.index === 'number';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 240 }}
        className="absolute bottom-0 left-0 right-0 z-[1001] bg-obsidian-card rounded-t-[2rem] shadow-[0_-15px_40px_rgba(0,0,0,0.5)] border-t border-obsidian-border min-h-[38vh] max-h-[82vh] flex flex-col overflow-hidden font-quicksand"
      >
        {/* Grab Handle */}
        <div className="absolute top-0 left-0 right-0 h-4 flex justify-center items-center z-20 pointer-events-none">
          <div className="w-10 h-1 bg-obsidian-border-elevated rounded-full" />
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          type="button"
          aria-label="Chiudi scheda"
          className="absolute top-3 right-3 z-30 p-2 bg-black/40 hover:bg-black/60 backdrop-blur-md rounded-full text-white transition-colors active:scale-95 shadow-sm"
        >
          <X size={16} strokeWidth={2.5} />
        </button>

        {/* ─── COVER HEADER WITH SEAMLESS FADE ─── */}
        <div className="w-full h-44 shrink-0 relative overflow-hidden bg-obsidian-bg">
          {displayImage ? (
            <img
              loading="lazy"
              src={displayImage}
              alt={poiTitle}
              className="w-full h-full object-cover"
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{ background: palette.gradient }}
            >
              <span className="text-6xl opacity-25 select-none">{palette.icon}</span>
            </div>
          )}

          {/* Sfumatura progressiva verso il corpo ossidiana della scheda */}
          <div
            className="absolute inset-0 pointer-events-none bg-gradient-to-t from-obsidian-card via-obsidian-card/70 to-transparent"
          />
        </div>

        {/* ─── SCROLLABLE CONTENT BODY ─── */}
        <div className="px-6 pb-8 overflow-y-auto flex-1 scrollbar-hide -mt-8 relative z-10 space-y-4">

          {/* BADGE & TITLE SECTION */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              {isStepInTour ? (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-brand-orange/15 text-brand-orange border border-brand-orange/30 shadow-sm">
                  {typeof poi.index === 'number' ? `Tappa ${poi.index + 1}` : 'Tappa Tour'}
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-obsidian-raised text-obsidian-secondary border border-obsidian-border">
                  {poi.category || poi.type || 'Punto Mappa'}
                </span>
              )}

              {(poi.city || poi.location) && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-obsidian-secondary">
                  <MapPin size={11} className="text-obsidian-secondary/60" />
                  {poi.city || poi.location}
                </span>
              )}
            </div>

            <div className="flex items-start justify-between gap-3">
              <h2 className="text-2xl font-black text-obsidian-primary tracking-tight leading-tight">
                {poiTitle}
              </h2>

              {(poi.historicalNotes || poi.description) && (
                <button
                  type="button"
                  onClick={toggleSpeech}
                  className="p-2.5 bg-obsidian-raised hover:bg-obsidian-border text-obsidian-secondary hover:text-obsidian-primary rounded-full transition-colors active:scale-95 border border-obsidian-border shrink-0"
                  title="Ascolta sintesi"
                  aria-label="Ascolta sintesi"
                >
                  {isSpeaking ? (
                    <Square size={16} fill="currentColor" className="text-brand-orange animate-pulse" />
                  ) : (
                    <Volume2 size={16} />
                  )}
                </button>
              )}
            </div>

            {/* RATING GOOGLE PLACES (Renderizzato SOLO se dato reale) */}
            {hasValidRating && (
              <div className="flex items-center gap-1.5 mt-1.5">
                <Star size={13} className="text-brand-orange fill-current shrink-0" />
                <span className="font-bold text-xs text-obsidian-primary">{parseFloat(poi.rating).toFixed(1)}</span>
                {poi.reviewsCount && (
                  <span className="text-obsidian-secondary text-xs font-medium">({poi.reviewsCount.toLocaleString('it-IT')})</span>
                )}
              </div>
            )}
          </div>

          {/* ACTION BAR PREMIUM/BUSINESS (Sito web, Telefono testo) */}
          {isPremium && (poi.website_url || poi.phone_number || poi.booking_url) && (
            <div className="flex gap-2.5 pt-1">
              {poi.website_url && (
                <button
                  type="button"
                  onClick={() => window.open(poi.website_url, '_blank')}
                  className="flex-1 bg-obsidian-raised hover:bg-obsidian-border text-obsidian-primary font-bold py-2.5 px-3 rounded-xl border border-obsidian-border text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Globe size={14} /> Sito web
                </button>
              )}

              {/* Gate K: numero di telefono come testo selezionabile */}
              {poi.phone_number && (
                <div className="flex-1 bg-obsidian-raised text-obsidian-primary py-2.5 px-3 rounded-xl border border-obsidian-border text-xs flex items-center justify-center gap-1.5 select-all">
                  <PhoneCall size={13} className="text-obsidian-secondary" />
                  <span className="font-semibold">{poi.phone_number}</span>
                </div>
              )}

              {poi.booking_url && (
                <button
                  type="button"
                  onClick={() => window.open(poi.booking_url, '_blank')}
                  className="flex-1 bg-obsidian-raised hover:bg-obsidian-border text-obsidian-primary font-bold py-2.5 px-3 rounded-xl border border-obsidian-border text-xs flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                >
                  <CalendarCheck size={14} /> Prenota
                </button>
              )}
            </div>
          )}

          {/* ─── NARRATIVA / DESCRIZIONE REALE ─── */}
          <div className="space-y-3 pt-1">
            {poi.historicalNotes && (
              <div className="bg-obsidian-raised p-4 rounded-2xl border border-obsidian-border">
                <div className="flex items-center gap-1.5 mb-2 text-obsidian-primary font-bold text-[11px] uppercase tracking-wider">
                  <BookOpen size={13} className="text-brand-orange" />
                  <span>Cenni e contesto</span>
                </div>
                <p className="text-obsidian-primary text-xs sm:text-sm leading-relaxed font-medium">
                  "{poi.historicalNotes}"
                </p>
              </div>
            )}

            {poi.description && !poi.historicalNotes && poi.description !== "Punto d'interesse consigliato." && poi.description !== "Punto di interesse" && (
              <div className="bg-obsidian-raised p-4 rounded-2xl border border-obsidian-border">
                <p className="text-obsidian-primary text-xs sm:text-sm leading-relaxed font-medium">
                  "{poi.description}"
                </p>
              </div>
            )}

            {poi.funFacts?.length > 0 && (
              <div className="bg-obsidian-raised p-4 rounded-2xl border border-obsidian-border">
                <div className="flex items-center gap-1.5 mb-1.5 text-obsidian-primary font-bold text-[11px] uppercase tracking-wider">
                  <Lightbulb size={13} className="text-brand-orange" />
                  <span>Dettaglio</span>
                </div>
                <p className="text-obsidian-primary text-xs leading-relaxed font-medium">
                  {poi.funFacts[0]}
                </p>
              </div>
            )}
          </div>

          {/* ─── MAIN CTA ACTION ─── */}
          <div className="pt-2">
            {isNavigating && isTourStep ? (
              isCompleted ? (
                <button
                  type="button"
                  disabled
                  className="w-full bg-obsidian-raised border border-obsidian-border text-obsidian-secondary/50 py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 text-xs uppercase tracking-wider cursor-not-allowed"
                >
                  <MapPin size={15} /> Tappa completata
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onUnlock && onUnlock(poi)}
                  className="w-full bg-brand-orange hover:bg-brand-orange-hover text-obsidian-bg py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-md shadow-brand-orange/20 active:scale-98 transition-all text-xs uppercase tracking-wider min-h-[46px]"
                >
                  <MapPin size={15} /> Sono arrivato
                </button>
              )
            ) : isStepInTour ? (
              <button
                type="button"
                onClick={() => onNavigate && onNavigate(poi)}
                className="w-full bg-brand-orange hover:bg-brand-orange-hover text-obsidian-bg py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-md shadow-brand-orange/20 active:scale-98 transition-all text-xs tracking-wide min-h-[46px]"
              >
                <Navigation size={15} className="fill-current" />
                Raggiungi questa tappa
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onNavigate && onNavigate(poi)}
                className="w-full bg-brand-orange hover:bg-brand-orange-hover text-obsidian-bg py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-md shadow-brand-orange/20 active:scale-98 transition-all text-xs tracking-wide min-h-[46px]"
              >
                <Navigation size={15} className="fill-current" />
                Cammina fino a qui
              </button>
            )}

            {transportMode === 'transit' && (
              <button
                type="button"
                onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${poi.latitude || poi.lat},${poi.longitude || poi.lng}&travelmode=transit`, '_blank')}
                className="w-full mt-2.5 bg-obsidian-raised hover:bg-obsidian-border text-obsidian-secondary hover:text-obsidian-primary py-3 rounded-xl font-bold flex items-center justify-center gap-2 border border-obsidian-border text-xs transition-colors"
              >
                <Navigation size={13} /> Indicazioni con mezzi pubblici
              </button>
            )}
          </div>

        </div>
      </motion.div>
    </AnimatePresence>
  );
};

