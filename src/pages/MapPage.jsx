import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import DOMPurify from 'dompurify';
import {
    ArrowLeft, Search, Navigation as NavIcon, X, ArrowRight,
    Clock, MapPin, Store, Sparkles, Tag, MessageCircle,
    Car, BusFront, Footprints, Bike
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useUserContext } from '../hooks/useUserContext';
import { useCity } from '../context/CityContext';
import UnnivaiMap from '../components/UnnivaiMap';
import { WeatherAirBadge } from '../components/Map/WeatherAirBadge';
import { POIDetailDrawer } from '../components/Map/POIDetailDrawer';
import { TourSummaryModal } from '../components/Map/TourSummaryModal';
import { CitySearchBar } from '../components/Map/CitySearchBar';
import { AIDrawer } from '../components/Map/AIDrawer';
import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMap, useMapsLibrary, InfoWindow } from '@vis.gl/react-google-maps';
import { dataService } from '../services/dataService';
import { poiService } from '../services/poiService';
import { POIPopupCard } from '../components/Map/POIPopupCard';
import { supabase } from '../lib/supabase';
import './MapPage.css';

import { DEMO_CITIES, MOCK_ROUTES } from '../data/demoData';

const DEFAULT_CITY = 'Roma';

// ─── SEMANTIC TAG MAPPING ─────────────────────────────────────────────────────
// Tour tags → Business category_tags equivalents (one-to-many)
const TAG_MAPPING = {
    'cibo': ['Ristorazione', 'Cibo', 'Gastronomia', 'Conviviale', 'Tradizionale', 'Rustico', 'Ospitalità'],
    'arte': ['Cultura', 'Arte', 'Artigianato', 'Creativo'],
    'cultura': ['Cultura', 'Storia', 'Arte', 'Tradizionale', 'Classico'],
    'storia': ['Cultura', 'Storia', 'Tradizionale', 'Classico', 'Rustico', 'Autentico'],
    'romantico': ['Lusso', 'Ospitalità', 'Relax', 'Accogliente', 'Intimo', 'Ristorazione'],
    'avventura': ['Avventura', 'Nightlife', 'Esplorare', 'Dinamico'],
    'natura': ['Relax', 'Avventura', 'Tranquillo', 'All\'aperto'],
    'shopping': ['Shopping', 'Artigianato', 'Lusso', 'Premium'],
    'sorpresa': ['Esplorare', 'Conviviale', 'Relax', 'Avventura'],
    'gastronomia': ['Ristorazione', 'Cibo', 'Tradizionale', 'Conviviale', 'Accogliente', 'Ospitalità'],
    'relax': ['Relax', 'Benessere', 'Tranquillo', 'Natura', 'Ristorazione', 'Ospitalità']
};

const tagsMatch = (tourTags = [], businessTags = [], aiVibes = [], aiStyles = []) => {
    // If no filter → show all
    if (!tourTags.length) return true;

    const allBusinessTags = [...businessTags, ...aiVibes, ...aiStyles].map(t => typeof t === 'string' ? t.toLowerCase() : '');
    const expandedTourTags = tourTags.flatMap(t => {
        const key = typeof t === 'string' ? t.toLowerCase() : '';
        return TAG_MAPPING[key] || [t];
    }).map(t => typeof t === 'string' ? t.toLowerCase() : '');
    const allTourTags = [...tourTags.map(t => typeof t === 'string' ? t.toLowerCase() : ''), ...expandedTourTags];

    // Substring match so "Ristorazione" matches "ristorazione" and "Tradizionale" matches "tradizionale"
    return allBusinessTags.some(bt => bt && allTourTags.some(tt => tt && (tt.includes(bt) || bt.includes(tt))));
};

const haversineM = (lat1, lng1, lat2, lng2) => {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// ─── SERVER-SIDE FILTER AUDIT ────────────────────────────────────────────────
//
// What is pushed to Supabase (evaluated in Postgres, no wire transfer):
//   1. location IS NOT NULL        → .not('location', 'is', null)   [unchanged]
//   2. city ilike activeCity       → .ilike('city', city)           [NEW]
//   3. category_tags && tourTags   → .filter('category_tags', 'ov', '{…}') [NEW]
//      Uses PostgREST `ov` operator (PG: &&) on the text[] column.
//      Applied only when tourTags is non-empty; coarse pre-filter only —
//      the fine-grained case-insensitive substring match still runs client-side.
//
// What stays client-side (and why):
//   4. Distance / haversine radius → needs lat/lng extracted from POINT column.
//      Server-side alternative: supabase.rpc('businesses_within_radius', {…})
//      Requires a Postgres function (see ST_DWithin roadmap below).
//   5. ai_metadata.vibe / style tags → stored in JSONB; PostgREST JSONB array
//      overlap is complex to express cleanly. Left to client-side tagsMatch().
//
// ── ST_DWithin ROADMAP ───────────────────────────────────────────────────────
// When the `businesses_profile.location` column has grown large enough that
// even the city-scoped query is slow, replace the haversine client filter with
// a Postgres RPC:
//
//   CREATE OR REPLACE FUNCTION businesses_within_radius(
//     user_lat  FLOAT, user_lng FLOAT, radius_m FLOAT
//   ) RETURNS SETOF businesses_profile LANGUAGE sql STABLE AS $$
//     SELECT * FROM businesses_profile
//     WHERE ST_DWithin(
//       location::geography,
//       ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography,
//       radius_m
//     );
//   $$;
//
//   -- Then call with:
//   supabase.rpc('businesses_within_radius', { user_lat, user_lng, radius_m })
//     .filter('category_tags', 'ov', tagLiteral)
//     .ilike('city', city)
//
// ─────────────────────────────────────────────────────────────────────────────

const fetchMatchingBusinesses = async (lat, lng, tourTags = [], radiusM = 2500, city = null) => {
    if (!lat || !lng) return [];
    try {
        let query = supabase
            .from('businesses_profile')
            // city is filtered server-side; no need to wire it through the payload
            .select('id, company_name, category_tags, description, address, image_urls, ai_metadata, location, subscription_tier')
            .not('location', 'is', null);

        // Filter 1: City scope — biggest single win.
        // Without this, a Roma session fetches Milano, Napoli, etc.
        if (city) {
            query = query.ilike('city', city);
        }

        // Filter 2: Category tags coarse pre-filter was removed here.
        // We evaluate tag matching purely on the client via `tagsMatch()`
        // because we want to include `ai_metadata.vibe` and `ai_metadata.style`
        // which cannot easily be queried in a PostgREST array overlap on JSONB array.

        const { data, error } = await query.limit(100); // DVAI-024
        if (error || !data) return [];

        return data
            .map(b => {
                if (!b.location) return null;
                let bLat, bLng;
                if (typeof b.location === 'string' && b.location.includes('POINT')) {
                    const parts = b.location.replace('POINT(', '').replace(')', '').split(' ');
                    bLng = parseFloat(parts[0]);
                    bLat = parseFloat(parts[1]);
                } else if (b.location?.coordinates) {
                    bLng = b.location.coordinates[0];
                    bLat = b.location.coordinates[1];
                } else if (typeof b.location === 'string' && /^[0-9A-Fa-f]+$/.test(b.location)) {
                    // Try parsing standard PostGIS EWKB hex format for Point geometries
                    try {
                        const isLittle = b.location.startsWith('01');
                        const tHex = b.location.substring(2, 10);
                        const offset = (tHex === '01000020' || tHex === '20000001') ? 18 : (tHex === '01000000' || tHex === '00000001' ? 10 : 0);
                        if (!offset || b.location.length < offset + 32) return null;
                        
                        const parseDouble = (hexStr) => {
                            const v = new DataView(new ArrayBuffer(8));
                            for (let i = 0; i < 8; i++) v.setUint8(i, parseInt(hexStr.substring(i * 2, i * 2 + 2), 16));
                            return v.getFloat64(0, isLittle);
                        };
                        bLng = parseDouble(b.location.substring(offset, offset + 16));
                        bLat = parseDouble(b.location.substring(offset + 16, offset + 32));
                    } catch (e) { 
                        return null; 
                    }
                } else {
                    return null;
                }
                if (isNaN(bLat) || isNaN(bLng)) return null;

                const dist = haversineM(lat, lng, bLat, bLng);
                
                // Tier-based logic for inclusion
                const isElite = b.subscription_tier === 'elite';
                // ELITE: 15km di visibilità, BASE: 2.5km dal centro del tour
                const dynamicRadius = isElite ? 15000 : 2500; 
                if (dist > dynamicRadius) return null;

                const bTags = b.category_tags || [];
                const aiVibes = b.ai_metadata?.vibe || [];
                const aiStyles = b.ai_metadata?.style || [];

                if (!tagsMatch(tourTags, bTags, aiVibes, aiStyles)) return null;

                return {
                    id: `biz_${b.id}`,
                    rawId: b.id,
                    name: b.company_name,
                    title: b.company_name,
                    latitude: bLat,
                    longitude: bLng,
                    type: 'business_partner',
                    category_tags: bTags,
                    description: b.description || '',
                    address: b.address || '',
                    image: b.image_urls?.[0] || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=500',
                    ai_metadata: b.ai_metadata,
                    subscription_tier: b.subscription_tier,
                    distanceM: Math.round(dist),
                };
            })
            .filter(Boolean)
            .sort((a, b) => {
                // Elite partners priorizzati a parità di condizioni, poi per distanza
                if (a.subscription_tier === 'elite' && b.subscription_tier !== 'elite') return -1;
                if (b.subscription_tier === 'elite' && a.subscription_tier !== 'elite') return 1;
                return a.distanceM - b.distanceM;
            })
            .slice(0, 8);
    } catch (e) {
        console.warn('fetchMatchingBusinesses error', e);
        return [];
    }
};


// ─── MAIN COMPONENT ────────────────────────────────────────────────────────────
const MapPage = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { city, lat, lng } = useUserContext();
    const { isManual } = useCity();
    const queryClient = useQueryClient();

    const map = useMap();
    const placesLibrary = useMapsLibrary('places');
    const [placesService, setPlacesService] = useState(null);

    useEffect(() => {
        if (!placesLibrary || !map) return;
        setPlacesService(new placesLibrary.PlacesService(map));
    }, [placesLibrary, map]);
    const mapRef = useMemo(() => ({
        current: map ? {
            flyTo: ({ center, zoom, pitch, bearing }) => {
                if (!map) return;
                map.moveCamera({
                    center: center ? { lat: center[1], lng: center[0] } : undefined,
                    zoom: zoom,
                    tilt: pitch,
                    heading: bearing
                });
            },
            getBounds: () => {
                if (!map) return null;
                const b = map.getBounds();
                if (!b) return null;
                const ne = b.getNorthEast();
                const sw = b.getSouthWest();
                return { _ne: { lat: ne.lat(), lng: ne.lng() }, _sw: { lat: sw.lat(), lng: sw.lng() } };
            },
            fitBounds: (boundsArr, options) => {
                if (!map) return;
                const bounds = new window.google.maps.LatLngBounds();
                bounds.extend({ lat: boundsArr[0][1], lng: boundsArr[0][0] });
                bounds.extend({ lat: boundsArr[1][1], lng: boundsArr[1][0] });
                map.fitBounds(bounds, options?.padding);
            },
            startTracking: () => {}
        } : null
    }), [map]);

    const activeCity = city || DEFAULT_CITY;
    const cityData = DEMO_CITIES[activeCity] || DEMO_CITIES['Roma'];

    const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 768);

    useEffect(() => {
        const handleResize = () => setIsDesktop(window.innerWidth >= 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const passedCenter = location.state?.initialCenter 
        ? { latitude: location.state.initialCenter.lat, longitude: location.state.initialCenter.lng } 
        : null;

    const [activeTourData] = useState(() => location.state?.tourData || null);
    const [viewMode] = useState(() => {
        const s = location.state;
        return (s?.tourData || s?.focusedActivity || s?.route) ? 'activities' : 'tours';
    });

    // ─── STATE ───────────────────────────────────────────────────────────────
    const [selectedActivity, setSelectedActivity] = useState(null);
    const [selectedPartner, setSelectedPartner] = useState(null);
    const [selectedPOI, setSelectedPOI] = useState(null);
    const [isRoutePlannerOpen, setIsRoutePlannerOpen] = useState(false);
    const [pageTransportMode, setPageTransportMode] = useState('walking');
    const [isNavigating, setIsNavigating] = useState(false);
    const [isMapReady, setIsMapReady] = useState(false);
    const [watchId, setWatchId] = useState(null);
    const [localCenter, setLocalCenter] = useState(null);
    const [isLocating, setIsLocating] = useState(!passedCenter && !activeTourData);

    const [isCameraFollowing, setIsCameraFollowing] = useState(false);
    const followingRef = useRef(false);
    // 🔑 Dynamic photo enrichment for selected tour markers
    const [activityPhotoUrl, setActivityPhotoUrl] = useState(null);

    useEffect(() => {
        setActivityPhotoUrl(null); // Reset on selection change
        if (!selectedActivity) return;

        // If already has a real Google Places photo (not Unsplash/placeholder), use it
        const img = selectedActivity.image;
        const isGeneric = !img || img.includes('unsplash.com') || img.includes('placeholder') || img.includes('via.placeholder');
        if (!isGeneric) {
            setActivityPhotoUrl(img);
            return;
        }

        // Dynamically fetch a real Google Places photo
        if (!placesService) return;
        const queryName = selectedActivity.name || selectedActivity.title || '';
        const queryCity = selectedActivity.city || city || '';
        if (!queryName) return;

        const request = {
            query: `${queryName} ${queryCity} Italia`.trim(),
            fields: ['photos']
        };

        placesService.findPlaceFromQuery(request, (results, status) => {
            if (
                status === window.google.maps.places.PlacesServiceStatus.OK &&
                results?.[0]?.photos?.[0]
            ) {
                setActivityPhotoUrl(results[0].photos[0].getUrl({ maxWidth: 800 }));
            }
        });
    }, [selectedActivity, placesService, city]);

    const setFollowing = useCallback((val) => {
        setIsCameraFollowing(val);
        followingRef.current = val;
        
        // Se riattiviamo il following, facciamo un fly-to immediato all'ultima posizione nota
        if (val && localCenter && mapRef.current) {
            mapRef.current.flyTo({ center: [localCenter.longitude, localCenter.latitude], zoom: 19, pitch: 60 });
        }
    }, [localCenter]);

    // FIX: Auto-geolocate on MapPage mount if no center is provided
    useEffect(() => {
        if (!navigator.geolocation) {
            setIsLocating(false);
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setLocalCenter({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
                setIsLocating(false);
            },
            (err) => {
                console.warn('MapPage GPS Fallback failed:', err);
                setIsLocating(false); // Timeout/Deny fallback
            },
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );
    }, []);

    // NEW STATES: Tour Completion Tracking
    const [completedSteps, setCompletedSteps] = useState([]);
    const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
    
    // Mostriamo la "route" solo se c'è un tour e NON siamo appena sbarcati dall'Explore con un focus città
    const [showRoute, setShowRoute] = useState(() => {
        if (passedCenter) return false;
        const s = location.state;
        return !!(s?.tourData || s?.focusedActivity || s?.route);
    });

    const [liveRoute, setLiveRoute] = useState(null);
    const [businessPartners, setBusinessPartners] = useState([]);
    const [loadingPartners, setLoadingPartners] = useState(false);
    const [mapBounds, setMapBounds] = useState(null);
    const [showSearchHere, setShowSearchHere] = useState(false);
    const [routeStats, setRouteStats] = useState(null); // { durationSec, distanceM, mode }
    const [isOffline, setIsOffline] = useState(!navigator.onLine);
    const [isGeminiOpen, setIsGeminiOpen] = useState(false);

    useEffect(() => {
        const handleOnline = () => setIsOffline(false);
        const handleOffline = () => setIsOffline(true);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            if (watchId) navigator.geolocation.clearWatch(watchId);
        };
    }, [watchId]);
    
    // NEW STATE: Background monuments for Level 0 when viewing a tour
    const [backgroundMonuments, setBackgroundMonuments] = useState([]);

    // ─── AI ENRICHMENT ON CLICK ──────────────────────────────────────────────
    useEffect(() => {
        let isCurrent = true;

        const enrich = async () => {
            if (!selectedPOI) return;
            
            // Check if we actually need enrichment (missing historical notes)
            // also consider description might be empty or a placeholder
            const hasGoodDescription = selectedPOI.description && selectedPOI.description !== "Punto d'interesse consigliato." && selectedPOI.description !== "Punto di interesse";
            const needsEnrichment = !selectedPOI.historicalNotes && (!hasGoodDescription || !selectedPOI.funFacts);

            if (needsEnrichment && city) {
                try {
                    const enrichedData = await aiRecommendationService.enrichMonuments([{
                        name: selectedPOI.title || selectedPOI.name || 'Punto di interesse',
                        type: selectedPOI.type
                    }], city);

                    if (isCurrent && enrichedData && enrichedData[0]) {
                        // Update the selected POI with the new data
                        setSelectedPOI(prev => {
                            if (!prev || (prev.title !== selectedPOI.title && prev.name !== selectedPOI.name)) return prev;
                            const newPoi = { ...prev };
                            if (!hasGoodDescription && enrichedData[0].description) {
                                newPoi.description = enrichedData[0].description;
                            }
                            newPoi.historicalNotes = enrichedData[0].historical_notes || enrichedData[0].historicalNotes || '';
                            newPoi.funFacts = enrichedData[0].fun_facts || enrichedData[0].funFacts || [];
                            return newPoi;
                        });
                    }
                } catch (e) {
                    console.warn("Auto-enrichment failed for POI:", e);
                }
            }
        };

        enrich();

        return () => {
            isCurrent = false;
        };
    }, [selectedPOI, city]);

    const tourData = activeTourData || location.state?.tourData;

    // ─── ACTIVE ROUTE ────────────────────────────────────────────────────────
    const activeRoute = useMemo(() => {
        try {
            if (tourData?.steps?.length > 0) {
                return tourData.steps.map((s, i) => ({
                    latitude: parseFloat(s.lat || s.latitude),
                    longitude: parseFloat(s.lng || s.longitude),
                    label: s.title || `Tappa ${i + 1}`,
                    title: s.title,
                    image: s.image,
                    type: s.type || 'waypoint',
                    description: s.description,
                    city: s.city || tourData.city || city || '',
                    index: i,
                }));
            }
            if (tourData?.waypoints) {
                return tourData.waypoints.map((p, i) => ({
                    latitude: Array.isArray(p) ? p[0] : p.latitude,
                    longitude: Array.isArray(p) ? p[1] : p.longitude,
                    label: `Tappa ${i + 1}`,
                    index: i,
                    type: 'waypoint',
                }));
            }
            if (location.state?.route) return location.state.route;
            return MOCK_ROUTES[activeCity] || MOCK_ROUTES['Roma'];
        } catch { return []; }
    }, [tourData, location.state, activeCity]);

    // ─── PLANNER PREVIEW ROUTE (BEFORE NAVIGATING) ───────────────────────────
    const plannerPreviewRoute = useMemo(() => {
        if (!isRoutePlannerOpen || isNavigating) return null;
        
        const locLat = localCenter?.latitude || cityData?.center?.latitude;
        const locLng = localCenter?.longitude || cityData?.center?.longitude;
        
        const destLat = selectedPOI?.latitude || selectedPOI?.lat || selectedActivity?.latitude;
        const destLng = selectedPOI?.longitude || selectedPOI?.lng || selectedActivity?.longitude;
        
        if (locLat && locLng && destLat && destLng) {
            return [
                { lat: locLat, lng: locLng, title: 'La tua posizione' },
                { lat: destLat, lng: destLng, title: selectedPOI?.name || selectedActivity?.name || 'Destinazione' }
            ];
        }
        return null;
    }, [isRoutePlannerOpen, isNavigating, localCenter, cityData, selectedPOI, selectedActivity]);

    // ─── CITY FLY-TO ─────────────────────────────────────────────────────────
    useEffect(() => {
        if (!mapRef.current || !isMapReady) return;
        if (activeTourData?.center?.latitude && activeTourData?.center?.longitude) {
            mapRef.current.flyTo({
                center: [activeTourData.center.longitude, activeTourData.center.latitude],
                zoom: 13, duration: 2000, essential: true,
            });
            return;
        }
        if (showRoute || selectedActivity || isLocating) return;
        
        const activeLat = isManual ? lat : (localCenter?.latitude || lat);
        const activeLng = isManual ? lng : (localCenter?.longitude || lng);

        const targetLat = activeLat || cityData?.center?.latitude;
        const targetLng = activeLng || cityData?.center?.longitude;

        if (targetLat && targetLng) {
            // Zoom in slightly more if we are using an exact user GPS or Geocoded location
            const targetZoom = (activeLat === localCenter?.latitude || isManual) ? 14 : 13;
            mapRef.current.flyTo({ center: [targetLng, targetLat], zoom: targetZoom, duration: 2000, essential: true });
            setShowSearchHere(false);
        }
    }, [activeCity, lat, lng, cityData, showRoute, activeTourData, selectedActivity, isMapReady, localCenter, isLocating, isManual]);

    // ─── AUTO-FIT TO ROUTE (PREVIEW & TOURS ONLY) ────────────────────────────
    useEffect(() => {
        // Only auto-fit when previewing a route or viewing a tour. DO NOT auto-fit during active navigation!
        if (isNavigating || !mapRef.current) return;

        const pointsToFit = showRoute ? (liveRoute || activeRoute) : (isRoutePlannerOpen && plannerPreviewRoute ? plannerPreviewRoute : []);
        
        if (!pointsToFit || pointsToFit.length < 2) return;

        try {
            const lngs = pointsToFit.map(p => p.longitude || p.lng).filter(v => typeof v === 'number' && !isNaN(v));
            const lats = pointsToFit.map(p => p.latitude || p.lat).filter(v => typeof v === 'number' && !isNaN(v));
            if (lngs.length && lats.length) {
                mapRef.current.fitBounds(
                    [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
                    { padding: { top: 100, bottom: 400, left: 50, right: 400 }, duration: 1500, maxZoom: 15 }
                );
            }
        } catch (e) { console.warn('fitBounds failed', e); }
    }, [activeRoute, showRoute, plannerPreviewRoute, isRoutePlannerOpen, isNavigating]);

    // ─── GLOBAL TOURS QUERY ──────────────────────────────────────────────────
    const { data: globalTours, isLoading: isLoadingTours, isFetching: isFetchingTours } = useQuery({
        queryKey: ['global-tours', activeCity],
        queryFn: async () => {
            const tours = await dataService.getToursByCity(activeCity);
            if (!tours) return [];
            return tours.map(t => ({
                id: `${t.id}`,
                name: t.title,
                latitude: t.steps?.[0]?.lat || 0,
                longitude: t.steps?.[0]?.lng || 0,
                price: t.price,
                duration: t.duration,
                category: t.category,
                description: t.description,
                image: t.imageUrl,
                type: 'tour_entry',
            })).filter(t => t.latitude && t.longitude);
        },
        staleTime: 1000 * 60 * 5,
        enabled: !!activeCity,
    });

    // ─── FETCH MATCHING PARTNERS when tour is shown ──────────────────────────
    useEffect(() => {
        if (!showRoute || !tourData) { setBusinessPartners([]); return; }
        const startLat = tourData.steps?.[0]?.lat || tourData.center?.latitude;
        const startLng = tourData.steps?.[0]?.lng || tourData.center?.longitude;
        if (!startLat || !startLng) return;
        const tourTags = tourData.tags || [];
        setLoadingPartners(true);
        // Increase search radius to 15000m to catch businesses on Via Tiburtina and slightly outside the immediate center
        fetchMatchingBusinesses(startLat, startLng, tourTags, 15000, activeCity)
            .then(partners => setBusinessPartners(partners))
            .finally(() => setLoadingPartners(false));
            
        // Fetch background monuments (Level 0) for the city
        poiService.fetchRealPois(activeCity).then(monuments => {
            if (monuments) setBackgroundMonuments(monuments);
        });
    }, [showRoute, tourData, activeCity]);

    // ─── MAP DISPLAY ITEMS ───────────────────────────────────────────────────
    const mapDisplayItems = useMemo(() => {
        if (viewMode === 'tours') return globalTours || [];
        return [];
    }, [viewMode, globalTours]);

    // All markers when route active: tour stops + business partners (Removed backgroundMonuments to prevent clutter)
    const allMapMarkers = useMemo(() => {
        if (showRoute) return [...(activeRoute || []), ...businessPartners];
        return mapDisplayItems;
    }, [showRoute, activeRoute, businessPartners, mapDisplayItems]);

    // Drawer items (bounded)
    const visibleDrawerItems = useMemo(() => {
        if (viewMode !== 'tours' || !globalTours) return [];
        if (!mapBounds) return globalTours.slice(0, 5);
        return globalTours.filter(t =>
            t.longitude >= mapBounds._sw.lng && t.longitude <= mapBounds._ne.lng &&
            t.latitude >= mapBounds._sw.lat && t.latitude <= mapBounds._ne.lat
        );
    }, [viewMode, globalTours, mapBounds]);

    // ─── HANDLERS ────────────────────────────────────────────────────────────
    const handleTourClick = (tour) => {
        setSelectedActivity(tour);
        mapRef.current?.flyTo({ center: [tour.longitude, tour.latitude], zoom: 16 });
    };

    const handleMarkerClick = (item) => {
        if (item.type === 'business_partner') {
            setSelectedPartner(item);
            setSelectedActivity(null);
            setSelectedPOI(null);
            mapRef.current?.flyTo({ center: [item.longitude, item.latitude], zoom: 17 });
        } else if (item.type === 'tour_step' || item.type === 'poi' || item.type === 'monument' || item.type === 'waypoint') {
            setSelectedPOI(item);
            setSelectedActivity(null);
            setSelectedPartner(null);
            mapRef.current?.flyTo({ center: [item.longitude, item.latitude], zoom: 17 });
        } else {
            handleTourClick(item);
            setSelectedPartner(null);
            setSelectedPOI(null);
        }
    };

    const handleStartNavigationClick = () => {
        if (isNavigating) {
            setIsNavigating(false); // Terminate current navigation to calculate new route
            setLiveRoute(null);
            setRouteStats(null);
            setCompletedSteps([]);
        }
        setIsRoutePlannerOpen(true);
    };

    // ─── FULLSCREEN NAVIGATION (Google Maps style) ────────────────────────────
    const requestNavFullscreen = () => {
        try {
            const el = document.documentElement;
            if (el.requestFullscreen) el.requestFullscreen();
            else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
            else if (el.mozRequestFullScreen) el.mozRequestFullScreen();
        } catch { /* ignora se il browser nega il fullscreen */ }
    };

    const exitNavFullscreen = () => {
        try {
            if (document.fullscreenElement ||
                document.webkitFullscreenElement ||
                document.mozFullScreenElement) {
                if (document.exitFullscreen) document.exitFullscreen();
                else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
                else if (document.mozCancelFullScreen) document.mozCancelFullScreen();
            }
        } catch { /* ignora */ }
    };

    const handleEndNavigation = () => {
        setIsNavigating(false);
        setFollowing(false);
        setLiveRoute(null);
        if (watchId) navigator.geolocation.clearWatch(watchId);
        mapRef.current?.flyTo({ pitch: 0, bearing: 0, zoom: 14 });
        exitNavFullscreen(); // Esci dal fullscreen quando la navigazione termina
        if (completedSteps.length > 0) {
            setTimeout(() => setIsSummaryModalOpen(true), 300);
        }
    };

    const handleStartNavigationReal = () => {
        setIsRoutePlannerOpen(false);
        setIsNavigating(true);
        setFollowing(true);
        requestNavFullscreen(); // Entra in fullscreen come Google Maps
        if (plannerPreviewRoute) {
            // Guarantee immediate polyline render even if GPS fails
            setLiveRoute([...plannerPreviewRoute]);
        }
        setCompletedSteps([]); // Reset tracking when restarting
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                ({ coords }) => {
                    if (mapRef.current) {
                        mapRef.current.flyTo({ center: [coords.longitude, coords.latitude], zoom: 18, pitch: 45 });
                        mapRef.current.startTracking?.();
                    }
                    
                    const remainingRoute = activeRoute?.filter(step => !completedSteps.includes(step.id)) || [];
                    let newLiveRoute = [];
                    
                    if (selectedPOI || selectedActivity) {
                        const destLat = selectedPOI?.latitude || selectedPOI?.lat || selectedActivity?.latitude;
                        const destLng = selectedPOI?.longitude || selectedPOI?.lng || selectedActivity?.longitude;
                        if (destLat && destLng) {
                            newLiveRoute = [
                                { lat: coords.latitude, lng: coords.longitude, title: 'La tua posizione' },
                                { lat: destLat, lng: destLng, title: selectedPOI?.name || selectedActivity?.name || 'Destinazione' }
                            ];
                        }
                    } else if (remainingRoute.length > 0) {
                        newLiveRoute = [
                            { lat: coords.latitude, lng: coords.longitude, title: 'La tua posizione' },
                            ...remainingRoute.map(step => ({ lat: parseFloat(step.latitude || step.lat), lng: parseFloat(step.longitude || step.lng), title: step.name || step.title }))
                        ];
                    }

                    if (newLiveRoute.length > 0) {
                        setLiveRoute(newLiveRoute);
                    }

                    // Traking Posizione e Auto-Flight
                    let lastUpdateTime = 0;
                    const wId = navigator.geolocation.watchPosition(
                        (pos) => {
                            const { latitude, longitude, heading } = pos.coords;
                            setLocalCenter({ latitude, longitude });
                            
                            const now = Date.now();
                            // Throttle updates to max 2FPS for camera to avoid micro-stutters,
                            // unless you're moving very fast (we keep it smooth via internal WebGL engine)
                            if (followingRef.current && map && (now - lastUpdateTime > 500)) {
                                lastUpdateTime = now;
                                map.moveCamera({
                                    center: { lat: latitude, lng: longitude },
                                    zoom: 19, // Street-level high-fidelity 3D follow mode
                                    tilt: 60,
                                    heading: heading !== null ? heading : undefined
                                });
                            }
                        },
                        (err) => console.warn("Errore Inseguimento Navigazione:", err),
                        { enableHighAccuracy: true, maximumAge: 1000 }
                    );
                    setWatchId(wId);
                },
                () => {
                    // DVAI-039: sostituito alert() con toast event
                    window.dispatchEvent(new CustomEvent('dvai-toast', {
                        detail: { type: 'warning', message: 'Posizione non rilevata. Navigazione dalla prima tappa.' }
                    }));
                    if (activeRoute?.length && mapRef.current) {
                        mapRef.current.flyTo({ center: [activeRoute[0].longitude, activeRoute[0].latitude], zoom: 17, pitch: 45 });
                    }
                },
                { enableHighAccuracy: true, timeout: 5000 }
            );
        }
    };

    const handlePOIUnlock = (poiObj) => {
        if (!completedSteps.includes(poiObj.id)) {
            const newCompleted = [...completedSteps, poiObj.id];
            setCompletedSteps(newCompleted);

            // Se tutte le tappe del tour sono completate (ignoriamo i partner)
            const tourStepsCount = activeRoute.length;
            if (newCompleted.length >= tourStepsCount) {
                setTimeout(() => setIsSummaryModalOpen(true), 1500); 
            }
        }
    };

    // ─── CUSTOM POI INTERCEPTION (Premium Google Maps Feel) ───
    const handleNativePOIClick = useCallback((e) => {
        // Support sia per l'evento RAW (e.placeId) sia per vis.gl Event (e.detail.placeId)
        const placeId = e.detail?.placeId || e.placeId;
        
        // Ignoriamo i click liberi sulla mappa (no POI)
        if (!placeId) return;
        
        // Stop default native InfoWindow (assoluta priorità)
        if (e.domEvent?.preventDefault) e.domEvent.preventDefault();
        if (typeof e.stop === 'function') e.stop();
        if (e.detail && typeof e.detail.stop === 'function') e.detail.stop();

        // If placesService isn't ready, fallback to basic info
        if (!placesService) {
            setSelectedPOI({
                id: placeId,
                name: e.detail?.name || e.name || 'Punto di Interesse',
                category: 'Google Maps POI',
                description: 'Caricamento dettagli non disponibile al momento.',
                latitude: e.detail.location?.lat,
                longitude: e.detail.location?.lng,
                type: 'native_poi',
                image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=500'
            });
            return;
        }

        const request = {
            placeId: placeId,
            fields: ['name', 'formatted_address', 'geometry', 'photos', 'rating', 'user_ratings_total', 'types']
        };

        placesService.getDetails(request, (place, status) => {
            if (status === window.google.maps.places.PlacesServiceStatus.OK && place) {
                const imageUrl = place.photos && place.photos.length > 0 
                    ? place.photos[0].getUrl({ maxWidth: 800 }) 
                    : 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=500';
                
                // Map the categories to a readable genre
                const category = place.types && place.types.length > 0 
                    ? place.types[0].replace(/_/g, ' ').toUpperCase() 
                    : 'POI';
                
                setSelectedPOI({
                    id: place.place_id,
                    name: place.name,
                    category: category,
                    description: place.formatted_address,
                    image: imageUrl,
                    rating: place.rating,
                    reviewsCount: place.user_ratings_total,
                    latitude: place.geometry?.location?.lat(),
                    longitude: place.geometry?.location?.lng(),
                    type: 'native_poi',
                });
            }
        });
    }, [placesService]);

    const handleSearchHere = () => {
        setShowSearchHere(false);
        queryClient.invalidateQueries(['global-tours']);
    };

    const handleRouteStats = useCallback((stats) => {
        setRouteStats(stats); // Pass the whole object directly to keep steps
    }, []);

    // ─── RENDER ───────────────────────────────────────────────────────────────
    return (
        <div className="relative w-full h-screen overflow-hidden bg-gray-50">

            {/* 1. MAP CONTAINER */}
            <div className="absolute inset-0 z-0">
                {(!activeRoute || activeRoute.length === 0) && showRoute ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-50">
                        <div className="bg-white p-6 rounded-2xl shadow-xl text-center max-w-sm mx-4">
                            <div className="mx-auto w-12 h-12 bg-orange-100 text-orange-500 rounded-full flex items-center justify-center mb-4">
                                <MapPin size={24} />
                            </div>
                            <h3 className="text-lg font-bold text-gray-800 mb-2">Mappa non disponibile</h3>
                            <p className="text-gray-500 text-sm mb-6">Questo tour non ha ancora un percorso geografico definito.</p>
                            <Link to="/dashboard-user">
                                <button className="w-full bg-black text-white py-3 rounded-xl font-bold">Torna alla Home</button>
                            </Link>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Layer rimosso per ottimizzazione estrama 60fps (I grandi box-shadow inset sopra a WebGL causano microlag nel panning) */}
                        {isLocating && (
                            <div className="absolute inset-0 z-20 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm transition-opacity duration-500">
                                <div className="bg-white/90 backdrop-blur-xl px-6 py-4 rounded-2xl shadow-2xl flex flex-col items-center gap-3 animate-in zoom-in-95">
                                    <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
                                    <span className="text-sm font-bold text-gray-800">Acquisizione posizione...</span>
                                </div>
                            </div>
                        )}
                        <UnnivaiMap
                            ref={mapRef}
                            height="100%"
                            width="100%"
                            activities={showRoute ? allMapMarkers : mapDisplayItems}
                            routePoints={showRoute ? (liveRoute || activeRoute) : (isRoutePlannerOpen && plannerPreviewRoute ? plannerPreviewRoute : [])}
                            onActivityClick={handleMarkerClick}
                            onClick={handleNativePOIClick}
                            onDragStart={() => {
                                if (isNavigating && followingRef.current) {
                                    setFollowing(false);
                                }
                            }}
                            isNavigating={isNavigating}
                            transportModeOverride={pageTransportMode}
                            onRouteStats={handleRouteStats}
                            selectedId={selectedActivity?.id}
                            activeCity={activeCity}
                            initialCenter={activeTourData?.center || passedCenter || localCenter || (lat && lng ? { latitude: lat, longitude: lng } : null)}
                            onLoad={() => setIsMapReady(true)}
                            completedSteps={completedSteps}
                            mapMood={tourData?.mood || 'default'}
                            suggestedTransit={pageTransportMode}
                            userLocation={localCenter}
                        />

                        {/* Riprendi Navigazione Button (Free Mode) */}
                        {isNavigating && !isCameraFollowing && (
                            <button
                                onClick={() => setFollowing(true)}
                                className="absolute bottom-40 right-4 z-50 bg-white shadow-xl px-4 py-3 rounded-2xl flex items-center justify-center gap-2 font-bold text-orange-600 ring-2 ring-orange-100 hover:scale-105 active:scale-95 transition-transform"
                            >
                                <NavIcon size={18} fill="currentColor" /> Riprendi
                            </button>
                        )}

                        {/* Partner count badge */}
                        {(showRoute || isRoutePlannerOpen) && businessPartners.length > 0 && (
                            <div className="absolute top-4 right-16 z-40 bg-orange-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 animate-in fade-in pointer-events-none">
                                <Store size={12} />
                                {businessPartners.length} partner compatibili
                            </div>
                        )}
                        {/* 1. TOP BAR - Conditionally rendered for Focus Mode */}
                        {!isNavigating && !isRoutePlannerOpen ? (
                            <>
                                <WeatherAirBadge onClick={() => setIsGeminiOpen(true)} city={activeCity} center={activeTourData?.center || passedCenter || localCenter || (lat && lng ? { latitude: lat, longitude: lng } : null)} />

                                <div className="absolute top-6 left-1/2 -translate-x-1/2 md:top-4 md:left-[4.5rem] md:translate-x-0 z-40 w-[90%] md:w-96 max-w-sm pointer-events-auto animate-in slide-in-from-top-6 fade-in duration-500">
                                    <CitySearchBar 
                                        activeCity={activeCity}
                                        onCitySelect={(selection) => {
                                            if (selection.gps) {
                                                // Pan back to GPS
                                                if (localCenter) {
                                                    mapRef.current?.flyTo({ center: [localCenter.longitude, localCenter.latitude], zoom: 14, duration: 1500 });
                                                } else {
                                                    // Trigger navigator geolocation fallback if needed
                                                    if (navigator.geolocation) {
                                                        navigator.geolocation.getCurrentPosition(pos => {
                                                            setLocalCenter({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
                                                            mapRef.current?.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 14, duration: 1500 });
                                                        });
                                                    }
                                                }
                                            } else if (selection.bounce) {
                                                // Just bounce back to active city center
                                                const targetLat = localCenter ? localCenter.latitude : (lat && lng) ? lat : cityData?.center?.latitude;
                                                const targetLng = localCenter ? localCenter.longitude : (lat && lng) ? lng : cityData?.center?.longitude;
                                                mapRef.current?.flyTo({ center: [targetLng, targetLat], zoom: 13, duration: 1500 });
                                            } else {
                                                // Selected a new city from autocomplete
                                                mapRef.current?.flyTo({ center: [selection.lng, selection.lat], zoom: 13, duration: 1500 });
                                            }
                                        }}
                                    />
                                </div>
                            </>
                        ) : (isRoutePlannerOpen || isNavigating) ? (
                            <>
                                {/* GOOGLE MAPS STYLE ROUTE PLANNER (SIDEBAR ON DESKTOP, TOP ON MOBILE) */}
                                <div className={`fixed md:absolute inset-x-0 bottom-0 md:inset-x-auto md:top-4 md:left-4 z-[60] bg-white md:rounded-[24px] rounded-t-[32px] shadow-2xl md:w-[400px] flex flex-col transition-transform duration-500 ease-in-[cubic-bezier(0.32,0.72,0,1)] ${isRoutePlannerOpen && !isNavigating ? 'translate-y-0 md:h-[calc(100vh-32px)] md:max-h-[800px] h-[55vh] max-h-[50vh]' : 'translate-y-full md:-translate-x-[120%] md:translate-y-0'}`}>
                                    {/* Header / Back */}
                                    <div className="flex items-start gap-3 p-4 pt-12 md:pt-6">
                                        <button onClick={() => setIsRoutePlannerOpen(false)} className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors text-gray-700">
                                            <ArrowLeft size={22} />
                                        </button>
                                        <div className="flex-1 flex flex-col gap-2 relative">
                                            {/* Origin input */}
                                            <div className="bg-gray-100 rounded-xl px-4 py-3 flex items-center gap-3 border border-gray-200">
                                                <div className="w-2 h-2 rounded-full border-[2px] border-blue-500"></div>
                                                <span className="text-sm font-medium text-gray-600">La tua posizione</span>
                                            </div>
                                            {/* Destination input */}
                                            <div className="bg-gray-100 rounded-xl px-4 py-3 flex items-center gap-3 border border-gray-200">
                                                <MapPin size={16} className="text-orange-500" />
                                                <span className="text-sm font-bold text-gray-900 truncate">
                                                    {selectedPOI?.name || selectedActivity?.name || tourData?.title || 'Destinazione'}
                                                </span>
                                            </div>
                                            {/* Connection line */}
                                            <div className="absolute left-[20px] top-[40px] bottom-[40px] w-0.5 border-l-2 border-dotted border-gray-300"></div>
                                        </div>
                                    </div>

                                    {/* Transport Modes */}
                                    <div className="flex px-4 gap-2 mt-2 pb-4 border-b border-gray-100">
                                        {[
                                            { id: 'driving', icon: Car, label: 'Auto' },
                                            { id: 'transit', icon: BusFront, label: 'Mezzi' },
                                            { id: 'walking', icon: Footprints, label: 'Piedi' },
                                            { id: 'cycling', icon: Bike, label: 'Bici' }
                                        ].map((mode) => (
                                            <button 
                                                key={mode.id}
                                                onClick={() => setPageTransportMode(mode.id)}
                                                className={`flex flex-col items-center justify-center py-2.5 flex-1 rounded-xl transition-all ${pageTransportMode === mode.id ? 'bg-blue-50 text-blue-600 ring-1 ring-blue-500/50' : 'bg-transparent text-gray-500 hover:bg-gray-50'}`}
                                            >
                                                <mode.icon size={22} className="mb-1" />
                                                <span className={`text-[9px] font-bold uppercase tracking-wider ${pageTransportMode === mode.id ? 'text-blue-700' : ''}`}>{mode.label}</span>
                                                {pageTransportMode === mode.id && routeStats && !routeStats.error && (
                                                    <span className="text-[11px] font-black mt-0.5">{Math.round(routeStats.durationSec / 60)} min</span>
                                                )}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Route Options */}
                                    <div className="flex flex-1 flex-col px-4 pt-2 pb-4 overflow-y-auto bg-white/50">
                                            <div className="bg-white p-4 rounded-xl shadow-md border border-gray-100 flex flex-col gap-0.5">
                                                <h4 className="font-bold text-gray-900 text-sm">Percorso Consigliato</h4>
                                                {routeStats ? (
                                                    <div className="mt-1 flex items-baseline gap-2">
                                                        <span className="text-2xl font-black text-green-600">{Math.round(routeStats.durationSec / 60)} min</span>
                                                        <span className="text-sm font-bold text-gray-500">
                                                            ({routeStats.distanceM >= 1000 ? (routeStats.distanceM / 1000).toFixed(1) + ' km' : Math.round(routeStats.distanceM) + ' m'})
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <div className="mt-2 h-6 w-32 bg-gray-100 rounded animate-pulse" />
                                                )}
                                            </div>
                                    </div>

                                    {/* Floating Start Nav Button */}
                                    <div className="p-4 pt-2 md:pb-6 bg-white md:border-t border-gray-50">
                                        <button 
                                            onClick={handleStartNavigationReal}
                                            className="w-full bg-blue-600 text-white font-black text-lg py-4 rounded-2xl shadow-lg shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-3"
                                        >
                                            <NavIcon size={24} className="animate-pulse" />
                                            Avvia Navigazione
                                        </button>
                                    </div>
                                </div>
                            </>
                        ) : null}
                        {loadingPartners && (
                            <div className="absolute top-4 right-16 z-40 bg-white/80 backdrop-blur text-gray-600 text-xs font-medium px-3 py-1.5 rounded-full shadow flex items-center gap-1.5 pointer-events-none">
                                <div className="w-3 h-3 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
                                Ricerca partner...
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* 2. TOP CONTROLS */}
            <div className="absolute top-4 left-4 right-4 z-40 flex justify-between pointer-events-none">
                {/* Back button pushed down slightly in nav mode to avoid OS status bar overlap */}
                <Link to="/dashboard-user" className={`bg-white p-3 rounded-full shadow-xl pointer-events-auto text-gray-800 hover:scale-105 transition-all ${isNavigating ? 'mt-12' : ''}`}>
                    <ArrowLeft size={20} />
                </Link>
                {showSearchHere && !isNavigating && (
                    <button onClick={handleSearchHere}
                        className="bg-white text-gray-800 px-4 py-2 rounded-full shadow-xl font-bold text-sm flex items-center gap-2 pointer-events-auto animate-in fade-in slide-in-from-top-4">
                        <Search size={14} /> Cerca in questa zona
                    </button>
                )}
            </div>

            {/* 3. START TOUR BAR & STOP BUTTON */}
            {showRoute && !selectedActivity && !selectedPartner && tourData && !isNavigating && (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 w-[95%] max-w-md animate-in slide-in-from-bottom-10 pointer-events-auto">
                    <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl p-4 border border-white/40 flex items-center justify-between gap-3 ring-1 ring-black/5">
                        <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-gray-900 text-lg leading-tight truncate">{tourData?.title || 'Il tuo Itinerario'}</h3>
                            <p className="text-xs text-gray-500 flex items-center gap-1 mt-1 font-medium flex-wrap">
                                <Clock size={12} className="text-orange-500" />
                                {routeStats
                                    ? `${Math.round(routeStats.durationSec / 60)} min · ${routeStats.distanceM >= 1000 ? (routeStats.distanceM / 1000).toFixed(1) + ' km' : Math.round(routeStats.distanceM) + ' m'}`
                                    : tourData?.duration || '2.5 ore'
                                }
                                {' · '}{activeRoute.length} Tappe
                                {businessPartners.length > 0 && (
                                    <span className="ml-1 text-orange-500 font-bold flex items-center gap-0.5">
                                        <Store size={10} /> {businessPartners.length} partner
                                    </span>
                                )}
                            </p>
                        </div>
                        {/* Contatta Guida rimosso per mantenere il focus sulla mappa e audio */}
                        <button onClick={handleStartNavigationClick}
                            className="bg-gradient-to-r from-orange-600 to-orange-500 text-white px-5 py-3 rounded-xl font-bold text-sm shadow-lg shadow-orange-200 hover:shadow-orange-300 active:scale-95 transition-all flex flex-col items-center justify-center leading-none gap-1 min-w-[68px]">
                            <NavIcon size={18} className="animate-pulse" />
                            <span className="text-[10px] uppercase tracking-wider">Avvia</span>
                        </button>
                    </div>
                </div>
            )}

            {/* ACTIVE NAVIGATION HUD (Top Center) */}
            {isNavigating && (
                <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-md bg-green-600 rounded-[28px] shadow-2xl overflow-hidden animate-in slide-in-from-top-6 fade-in duration-500">
                    <div className="p-5 flex items-start gap-4">
                        <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center shrink-0 text-white">
                            <NavIcon size={24} />
                        </div>
                        <div className="flex-1 text-white">
                            {routeStats?.error ? (
                                <p className="text-xl font-bold leading-tight drop-shadow-sm text-red-200">{routeStats.error}</p>
                            ) : routeStats?.steps?.[0] ? (
                                <>
                                    {/* DVAI-002: sanitizzato con DOMPurify per prevenire XSS da dati Google Directions API */}
                                    <p className="text-xl font-bold leading-tight drop-shadow-sm" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(routeStats.steps[0].instructions, { ALLOWED_TAGS: ['b', 'strong', 'span'], ALLOWED_ATTR: [] }) }} />
                                    <div className="flex items-center gap-2 mt-2 opacity-90">
                                        <span className="font-extrabold">{routeStats.steps[0].distance?.text}</span>
                                        <span className="w-1.5 h-1.5 rounded-full bg-white/50" />
                                        <span className="font-semibold text-sm">{Math.round(routeStats.durationSec / 60)} min rimanenti</span>
                                    </div>
                                </>
                            ) : (
                                <p className="text-lg font-bold">Ricalcolo in corso...</p>
                            )}
                        </div>
                    </div>
                    {/* Termina Button Footer */}
                    <div className="bg-green-700/80 backdrop-blur px-5 py-3 flex justify-between items-center">
                        <div className="text-green-50 text-xs font-semibold">
                            {routeStats?.distanceM ? `${(routeStats.distanceM / 1000).toFixed(1)} km al traguardo` : ''}
                        </div>
                        <button 
                            onClick={handleEndNavigation}
                            className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-full text-sm font-bold shadow-[0_4px_12px_rgba(239,68,68,0.3)] transition-all hover:scale-105 active:scale-95"
                        >
                            Termina
                        </button>
                    </div>
                </div>
            )}

            {/* 5. EXPLORE DRAWER */}
            {viewMode === 'tours' && !selectedActivity && !selectedPartner && !isNavigating && (
                <div className="absolute bottom-8 left-0 w-full z-40 px-4 pointer-events-none">
                    {/* Background-refetch indicator (city changed, stale data still showing) */}
                    {isFetchingTours && !isLoadingTours && (
                        <div className="flex justify-center mb-2 pointer-events-none">
                            <span className="bg-white/80 backdrop-blur text-gray-500 text-xs font-medium px-3 py-1 rounded-full shadow flex items-center gap-1.5">
                                <div className="w-2.5 h-2.5 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
                                Aggiorno tour…
                            </span>
                        </div>
                    )}

                    <div className="flex overflow-x-auto gap-3 pb-4 snap-x snap-mandatory pointer-events-auto no-scrollbar pr-4">
                        {/* Initial load skeletons — shown while React Query has no cached data for this city */}
                        {isLoadingTours ? (
                            Array.from({ length: 3 }).map((_, i) => (
                                <div key={i} className="snap-center shrink-0 w-64 h-36 bg-white/70 rounded-2xl shadow-xl overflow-hidden ring-1 ring-black/5 animate-pulse">
                                    <div className="w-full h-full bg-gray-200" />
                                </div>
                            ))
                        ) : (
                            visibleDrawerItems.map(tour => (
                                <div key={tour.id} onClick={() => handleTourClick(tour)}
                                    className="snap-center shrink-0 w-64 h-36 bg-white rounded-2xl shadow-xl overflow-hidden relative cursor-pointer active:scale-95 transition-transform ring-1 ring-black/5">
                                    <img src={tour.image} className="w-full h-full object-cover" alt="" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                                    <div className="absolute bottom-3 left-3 text-white">
                                        <h3 className="font-bold text-sm leading-tight mb-0.5 line-clamp-1">{tour.name}</h3>
                                        <p className="text-[10px] font-medium opacity-90 uppercase tracking-wide bg-orange-500/90 inline-block px-1.5 py-0.5 rounded-md mt-1">
                                            €{tour.price} · {tour.duration}
                                        </p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* 6. TOUR DETAIL CARD — visible during navigation too */}
            {selectedActivity && (
                <div className={`absolute z-[50] animate-in slide-in-from-bottom-5 duration-300 ${isNavigating ? 'bottom-4 left-4 right-4' : 'bottom-0 left-0 right-0 lg:bottom-8 lg:left-8 lg:w-[400px]'}`}>
                    <div className={`bg-white shadow-2xl overflow-hidden ring-1 ring-black/5 ${isNavigating ? 'rounded-2xl' : 'rounded-t-3xl lg:rounded-3xl'}`}>
                        {/* Image section — compact during navigation */}
                        <div className={`relative bg-gray-100 ${isNavigating ? 'h-28' : 'h-44'}`}>
                            <img src={activityPhotoUrl || selectedActivity.image || 'https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&q=80&w=800'} className="w-full h-full object-cover" alt="" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                            <button onClick={() => setSelectedActivity(null)}
                                className="absolute top-3 right-3 p-1.5 bg-black/50 hover:bg-black/70 rounded-full text-white backdrop-blur-sm transition-colors">
                                <X size={16} />
                            </button>
                            {selectedActivity.category && (
                                <div className="absolute top-3 left-3 bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm">
                                    {selectedActivity.category}
                                </div>
                            )}
                            {/* Name overlaid on image during navigation for compactness */}
                            {isNavigating && (
                                <div className="absolute bottom-2 left-3 right-3">
                                    <h2 className="text-white font-bold text-base leading-tight drop-shadow-lg truncate">{selectedActivity.name || selectedActivity.title || 'Punto di Interesse'}</h2>
                                </div>
                            )}
                        </div>
                        <div className={isNavigating ? 'p-3' : 'p-5'}>
                            {/* Full title only when NOT navigating (during nav it's overlaid on image) */}
                            {!isNavigating && (
                                <h2 className="text-xl font-bold mb-1 text-gray-900">{selectedActivity.name || selectedActivity.title || 'Punto di Interesse'}</h2>
                            )}
                            <p className="text-gray-500 text-xs mb-2 font-medium flex items-center gap-1">
                                <Clock size={12} /> {selectedActivity.duration || 'Durata flessibile'}
                            </p>
                            <p className={`text-gray-600 text-sm leading-relaxed line-clamp-2 ${isNavigating ? 'mb-2' : 'mb-4'}`}>{selectedActivity.description || "Punto chiave dell'itinerario selezionato dall'AI."}</p>
                            {selectedActivity.type === 'tour_entry' ? (
                                <Link to={`/tour-details/${selectedActivity.id}`}
                                    className="w-full bg-black text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-gray-800 transition-colors text-sm">
                                    Vedi Dettagli <ArrowRight size={16} />
                                </Link>
                            ) : (
                                <button onClick={isNavigating ? () => setSelectedActivity(null) : handleStartNavigationClick}
                                    className={`w-full text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg transition-all text-sm ${
                                        isNavigating 
                                            ? 'bg-gradient-to-r from-green-500 to-emerald-600 shadow-green-200' 
                                            : 'bg-gradient-to-r from-orange-500 to-red-500 shadow-orange-200'
                                    }`}>
                                    {isNavigating ? <><MapPin size={16} /> Chiudi Anteprima</> : <><NavIcon size={16} /> Naviga Qui</>}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* 7. BUSINESS PARTNER DETAIL CARD */}
            {selectedPartner && !isNavigating && (
                <div className="absolute bottom-0 left-0 right-0 z-[50] lg:bottom-8 lg:left-8 lg:w-[400px] animate-in slide-in-from-bottom-5">
                    <div className="bg-white rounded-t-3xl lg:rounded-3xl shadow-2xl overflow-hidden ring-2 ring-orange-200">
                        {/* Hero */}
                        <div className="h-40 relative">
                            <img src={selectedPartner.image} className="w-full h-full object-cover" alt="" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                            <button onClick={() => setSelectedPartner(null)}
                                className="absolute top-3 right-3 p-2 bg-black/50 rounded-full text-white backdrop-blur-sm">
                                <X size={16} />
                            </button>
                            {/* Partner badge */}
                            <div className="absolute top-3 left-3 bg-orange-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-md">
                                <Sparkles size={10} /> Partner DoveVai
                            </div>
                            <div className="absolute bottom-3 left-4">
                                <h2 className="text-white font-bold text-lg leading-tight">{selectedPartner.name}</h2>
                                <p className="text-white/70 text-xs flex items-center gap-1">
                                    <MapPin size={10} /> {selectedPartner.address || `${selectedPartner.distanceM}m dal percorso`}
                                </p>
                            </div>
                        </div>
                        {/* Info */}
                        <div className="p-4">
                            {/* AI vibe + style tags */}
                            {(selectedPartner.ai_metadata?.vibe?.length > 0 || selectedPartner.ai_metadata?.style?.length > 0) && (
                                <div className="flex flex-wrap gap-1.5 mb-3">
                                    {selectedPartner.ai_metadata.vibe?.map((v, i) => (
                                        <span key={i} className="text-[10px] font-semibold bg-orange-50 text-orange-700 border border-orange-200 px-2 py-0.5 rounded-full">{v}</span>
                                    ))}
                                    {selectedPartner.ai_metadata.style?.map((s, i) => (
                                        <span key={i} className="text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full">{s}</span>
                                    ))}
                                </div>
                            )}
                            {/* Category tags */}
                            {selectedPartner.category_tags?.length > 0 && (
                                <div className="flex gap-1.5 mb-3 flex-wrap">
                                    {selectedPartner.category_tags.map((t, i) => (
                                        <span key={i} className="text-[10px] font-bold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full flex items-center gap-1">
                                            <Tag size={8} />{t}
                                        </span>
                                    ))}
                                </div>
                            )}
                            <p className="text-gray-600 text-sm line-clamp-2 leading-relaxed mb-4">
                                {selectedPartner.description || 'Attività partner — fai tappa qui durante il tour!'}
                            </p>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => window.open(`https://maps.google.com/?q=${selectedPartner.latitude},${selectedPartner.longitude}`, '_blank')}
                                    className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500 text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-md shadow-orange-200 active:scale-95 transition-transform">
                                    <NavIcon size={14} /> Vai qui
                                </button>
                                <button onClick={() => setSelectedPartner(null)}
                                    className="px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-sm transition-colors">
                                    Chiudi
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 8. POI EXPLORATION DRAWER / POPUP */}
            {!isRoutePlannerOpen && selectedPOI && (
                isDesktop ? (
                    <InfoWindow
                        position={{ lat: selectedPOI.latitude || selectedPOI.lat, lng: selectedPOI.longitude || selectedPOI.lng }}
                        onCloseClick={() => setSelectedPOI(null)}
                        pixelOffset={[0, -40]}
                    >
                        <POIPopupCard 
                            poi={selectedPOI} 
                            onClose={() => setSelectedPOI(null)} 
                            onNavigate={handleStartNavigationClick}
                        />
                    </InfoWindow>
                ) : (
                    <POIDetailDrawer 
                        poi={selectedPOI} 
                        onClose={() => setSelectedPOI(null)} 
                        onUnlock={handlePOIUnlock}
                        transportMode={pageTransportMode}
                        onNavigate={handleStartNavigationClick}
                    />
                )
            )}

            {/* 9. DEPRECATED DRAWER REMOVED (VehicleSelectionDrawer is now inline RoutePlanner) */}

            {/* 10. TOUR SUMMARY MODAL */}
            <TourSummaryModal
                isOpen={isSummaryModalOpen}
                onClose={() => setIsSummaryModalOpen(false)}
                titleName={tourData?.title || "Storico Urbano"}
                stats={{
                    duration: routeStats ? `${Math.round(routeStats.durationSec / 60)} min` : (tourData?.duration || '1h 20m'),
                    distance: routeStats ? (routeStats.distanceM >= 1000 ? (routeStats.distanceM / 1000).toFixed(1) + ' km' : Math.round(routeStats.distanceM) + ' m') : '2.4 km',
                    completedCount: completedSteps.length
                }}
            />

            {/* 11. NATIVE MY LOCATION BUTTON (Google Maps Style Bottom Right) */}
            <button 
                onClick={() => {
                    if (navigator.geolocation) {
                        navigator.geolocation.getCurrentPosition(pos => {
                            mapRef.current?.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 18, duration: 1500 });
                        });
                    }
                }}
                className="absolute right-4 bottom-28 md:right-[50px] md:bottom-[100px] z-50 bg-white w-10 h-10 rounded-full shadow-[0_1px_4px_rgba(0,0,0,0.3)] flex items-center justify-center hover:bg-gray-50 active:bg-gray-100 group"
            >
                <NavIcon size={20} className="text-gray-600 group-hover:text-blue-500 transition-colors" />
            </button>

            {/* 12. GEMINI DRAWER */}
            <AIDrawer 
                isOpen={isGeminiOpen} 
                onClose={() => setIsGeminiOpen(false)} 
                selectedPOI={selectedPOI} 
                activeCity={activeCity} 
            />
        </div>
    );
};

// DVAI-022: Wrappa MapPage con APIProvider solo quando necessario
import MapAPIWrapper from '../components/MapAPIWrapper';
const MapPageWrapped = (props) => (
    <MapAPIWrapper>
        <MapPage {...props} />
    </MapAPIWrapper>
);
export default MapPageWrapped;
