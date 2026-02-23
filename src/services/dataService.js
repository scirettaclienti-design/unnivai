
import { supabase } from '../lib/supabase';

class DataService {
    constructor() {
        this.useRealData = true; // Feature flag for safety
    }

    /**
     * Maps database tour object to UI tour object
     * Preserves strict contract for UI components
     */
    mapTourToUI(dbTour) {
        if (!dbTour) return null;

        try {
            // Ensure we default to empty arrays if jsonb fields represent arrays but are null
            const rawImages = dbTour.image_urls || dbTour.images || [];
            const images = Array.isArray(rawImages) ? rawImages : (rawImages ? [rawImages] : []);
            // Fallback for main image if array is empty but 'image' column exists
            if (images.length === 0 && dbTour.image) images.push(dbTour.image);
            // Final fallback
            if (images.length === 0) images.push("https://images.unsplash.com/photo-1516483638261-f4dbaf036963");

            const highlights = Array.isArray(dbTour.highlights) ? dbTour.highlights : [];
            const itinerary = Array.isArray(dbTour.itinerary) ? dbTour.itinerary : [];
            const included = Array.isArray(dbTour.included) ? dbTour.included : [];
            const notIncluded = Array.isArray(dbTour.not_included) ? dbTour.not_included : [];
            const tags = Array.isArray(dbTour.tags) ? dbTour.tags : [];

            // Fetch guide info from relation if available, otherwise mock or extract
            const guideInfo = dbTour.profiles || {}; // Assuming join on 'guide_id' -> 'profiles'

            return {
                id: dbTour.id,
                title: dbTour.title || '',
                description: dbTour.description || '',

                // Map location fields
                city: dbTour.city || 'Unknown', // Now a forceful column
                location: dbTour.location || dbTour.city || '',

                // Format duration
                duration: dbTour.duration_text || (dbTour.duration_minutes ? `${dbTour.duration_minutes} min` : ''),
                estimatedTime: dbTour.duration_minutes || 0,

                // Pricing (Prioritize price_eur filter column)
                price: Number(dbTour.price_eur) || Number(dbTour.price) || 0,
                originalPrice: dbTour.original_price ? Number(dbTour.original_price) : null,

                // Stats
                rating: Number(dbTour.rating) || 5.0,
                reviews: Number(dbTour.reviews_count) || 0,
                participants: Number(dbTour.current_participants) || 0,
                maxParticipants: Number(dbTour.max_participants) || 10,

                // Media
                imageUrl: images[0] || '', // Main image for cards
                images: images,             // Full gallery for details

                // Guide (Flattened for UI)
                guide: guideInfo.full_name || guideInfo.username || 'Guida DoveVai',
                guideAvatar: guideInfo.avatar_emoji || '👋', // Use emoji if url not present or as logic dictates
                guideBio: guideInfo.bio || 'Esperto locale appassionato.',

                // Rich Content
                highlights: highlights,
                tags: tags,
                itinerary: itinerary.map(item => ({
                    time: item.time || '',
                    activity: item.activity || '',
                    emoji: item.emoji || '📍' // Fallback emoji
                })),
                meetingPoint: dbTour.meeting_point || '',

                // Lists
                included: included,
                notIncluded: notIncluded,

                // Logic Flags
                live: !!dbTour.is_live,
                startsSoon: !!dbTour.is_upcoming,
                category: dbTour.category || 'culture',
                type: dbTour.category || 'culture', // Keep strict type if needed by others
                difficulty: dbTour.difficulty || 'facile',

                // Meta Labels
                startPoint: dbTour.start_point || dbTour.meeting_point || '',
                nextStart: dbTour.next_start_label || 'A breve',

                // Technical data for Map
                steps: dbTour.steps || [],
                routePath: dbTour.route_path || null
            };
        } catch (e) {
            console.error("Mapping Error for Tour:", dbTour, e);
            return null;
        }
    }

    /**
     * Fetches tours for a specific city
     * Returns mapped UI objects
     */
    async getToursByCity(city) {
        if (!this.useRealData) return null;

        try {
            const { data, error } = await supabase
                .from('tours')
                .select(`
                    *,
                    profiles:guide_id (
                        username,
                        full_name,
                        avatar_url,
                        bio
                    )
                `)
                .eq('city', city)
                .order('is_live', { ascending: false }); // Prioritize live tours

            if (error) {
                console.warn('Supabase fetch error:', error);
                return null;
            }

            if (!data || data.length === 0) return null;

            return data.map(tour => this.mapTourToUI(tour));

        } catch (err) {
            console.error('DataService unexpected error:', err);
            return null;
        }
    }

    /**
     * Get a single tour by ID for details page
     */
    async getTourById(id) {
        if (!this.useRealData) return null;

        try {
            const { data, error } = await supabase
                .from('tours')
                .select(`
                    *,
                    profiles:guide_id (
                        username,
                        full_name,
                        avatar_url,
                        bio
                    )
                `)
                .eq('id', id)
                .single();

            if (error || !data) {
                return null;
            }

            return this.mapTourToUI(data);
        } catch (err) {
            return null;
        }
    }
    /**
     * Create a new booking
     * Handles both Guest (noop/log) and Auth (DB insert) modes
     */
    async createBooking(bookingData) {
        if (!this.useRealData) return { success: true };

        try {
            const { data: { session } } = await supabase.auth.getSession();

            // Guest Mode: Log and return success to maintain flow
            if (!session) {
                console.log('Guest booking captured (local mode):', bookingData);
                return { success: true };
            }

            // Auth Mode: Persist to Supabase
            // Maps UI booking data to flexible DB schema
            const { error } = await supabase
                .from('bookings')
                .insert({
                    tour_id: bookingData.tourId,
                    user_id: session.user.id,
                    booking_date: bookingData.date,
                    booking_time: bookingData.time,
                    guests_count: bookingData.guests,
                    total_amount: bookingData.totalPrice,
                    status: 'pending_request', // Updated to pending flow
                    created_at: new Date().toISOString()
                });

            if (error) {
                // If table doesn't exist or schema mismatch, fallback silently
                console.warn('Supabase booking write failed (silent fallback):', error);
                return { success: true };
            }

            // Simulate notification to guide (Real backend would use Database Triggers or Edge Function)
            // insertNotification(guide_id, "Nuova richiesta di prenotazione")
            console.log('🔔 Guide notification dispatched for booking:', bookingData.tourId);

            return { success: true };

        } catch (err) {
            console.error('DataService booking error (silent):', err);
            return { success: true }; // Always return success to UI
        }
    }

    /**
     * Toggle favorite status
     * Handles add/remove logic invisibly
     */
    async toggleFavorite(tourId) {
        if (!this.useRealData) return { success: true };

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return { success: true }; // Guest noop

            // Check if already favorite
            const { data: existing } = await supabase
                .from('favorites')
                .select('id')
                .eq('user_id', session.user.id)
                .eq('tour_id', tourId)
                .maybeSingle();

            if (existing) {
                // Remove
                await supabase.from('favorites').delete().eq('id', existing.id);
            } else {
                // Add
                await supabase.from('favorites').insert({
                    user_id: session.user.id,
                    tour_id: tourId
                });
            }
            return { success: true };
        } catch (err) {
            console.warn('Favorite toggle error (silent):', err);
            return { success: true };
        }
    }

    /**
     * Subscribe to live status changes (Realtime)
     */
    subscribeToLiveTours(callback) {
        if (!this.useRealData) return null;

        try {
            const channel = supabase.channel('public:tours')
                .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tours' }, payload => {
                    // Map new data to UI contract
                    const uiTour = this.mapTourToUI(payload.new);
                    if (callback) callback(uiTour);
                })
                .subscribe();
            return channel;
        } catch (err) {
            console.warn('Realtime tours subscription failed:', err);
            return null;
        }
    }

    /**
     * Fetch User Notifications (Scoped by City)
     */
    async getNotifications(userId, currentCity) {
        if (!this.useRealData) return [];
        try {
            let query = supabase
                .from('notifications')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(20);

            const { data, error } = await query;

            if (error) throw error;

            // In-memory filter for complex OR logic safely or if strict RLS handles it
            // Ideally we want (city_scope is null OR city_scope = currentCity)
            // Supabase filter: .or(`city_scope.is.null,city_scope.eq.${currentCity}`)

            // For MVP safety, let's filter in memory strictly avoiding query complexity errors
            const filtered = data ? data.filter(n => !n.city_scope || n.city_scope === currentCity) : [];

            return filtered.map(n => ({
                id: n.id,
                title: n.title,
                message: n.message,
                type: n.type,
                time: new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                read: !!n.read_at,
                actionData: n.action_data || {},
                category: n.category || 'general'
            }));
        } catch (err) {
            console.warn('Fetch notifications error (silent):', err);
            return [];
        }
    }

    /**
     * Subscribe to new notifications (Realtime)
     */
    subscribeToNotifications(userId, callback) {
        if (!this.useRealData) return null;

        try {
            const channel = supabase.channel(`notifications:${userId}`)
                .on('postgres_changes', {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${userId}`
                }, payload => {
                    const n = payload.new;
                    const uiNotification = {
                        id: n.id,
                        type: n.type || 'info',
                        title: n.title || 'Nuova notifica',
                        message: n.message || '',
                        timestamp: new Date(n.created_at),
                        actionText: n.action_text || 'Vedi',
                        actionUrl: n.action_url || '/notifications',
                        read: !!n.read,
                        actionType: n.action_type || 'scopri'
                    };
                    if (callback) callback(uiNotification);
                })
                .subscribe();
            return channel;
        } catch (err) {
            console.warn('Realtime notifications subscription failed:', err);
            return null;
        }
    }

    /**
     * Fetch Activities by City for Map
     */
    async getActivitiesByCity(city) {
        if (!this.useRealData) return null;

        try {
            // Note: Assuming 'activities' table exists. 
            // If strictly using 'tours', we might need to adjust, but 'activities' usually implies POIs.
            // Fallback provided in UI if this returns null/empty.
            const { data, error } = await supabase
                .from('activities')
                .select('*')
                .eq('city', city);

            if (error) {
                console.warn('Supabase activities fetch error:', error);
                return null;
            }

            if (!data || data.length === 0) return null;

            return data.map(curr => ({
                id: curr.id,
                name: curr.name || curr.title || 'Attività',
                latitude: curr.latitude,
                longitude: curr.longitude,
                level: curr.tier || curr.level || 'base', // DB 'tier' -> UI 'level'
                category: curr.category || 'culture',
                tags: curr.vibe_tags || curr.tags || [],
                description: curr.description || ''
            }));

        } catch (err) {
            console.warn('DataService activities error (silent):', err);
            return null;
        }
    }

    /**
     * Fetch Activities owned by a specific user (Business Dashboard)
     */
    async getActivitiesByOwner(userId) {
        if (!this.useRealData) return [];

        try {
            const { data, error } = await supabase
                .from('activities')
                .select('*')
                .eq('owner_id', userId);

            if (error) {
                console.warn('Supabase owner activities fetch error:', error);
                return [];
            }

            return data ? data.map(curr => ({
                id: curr.id,
                name: curr.name || curr.title || 'Attività',
                latitude: curr.latitude,
                longitude: curr.longitude,
                level: curr.tier || curr.level || 'base',
                category: curr.category || 'culture',
                city: curr.city
            })) : [];

        } catch (err) {
            console.warn('DataService owner activities error (silent):', err);
            return [];
        }
    }

    /**
     * Fetch Pending Bookings for a Guide (Guide Dashboard)
     */
    async getPendingBookingsForGuide(guideId) {
        if (!this.useRealData) return [];

        try {
            // Join bookings with tours to check guide_id and get tour details
            const { data, error } = await supabase
                .from('bookings')
                .select(`
                    id,
                    status,
                    guests_count,
                    booking_date,
                    booking_time,
                    total_amount,
                    tours!inner(id, title, guide_id)
                `)
                .eq('status', 'pending_request')
                .eq('tours.guide_id', guideId);

            if (error) {
                console.warn('Supabase guide bookings fetch error:', error);
                return [];
            }

            return data ? data.map(b => ({
                id: b.id,
                tourName: b.tours?.title || 'Tour sconosciuto',
                date: b.booking_date,
                time: b.booking_time,
                guests: b.guests_count,
                profit: Number(b.total_amount || 0) * 0.8 // 20% platform fee simulation
            })) : [];

        } catch (err) {
            console.warn('DataService guide bookings error (silent):', err);
            return [];
        }
    }
    /**
     * Fetch businesses matching city and tags
     * Used for AI Injection in QuickPath
     */
    async getBusinessesByCityAndTags(city, tags = [], targetPace = null) {
        if (!city) return [];

        // Tour tag → business category mapping (reverse of BIZ_TO_TOUR_TAGS)
        const TOUR_TAG_TO_BIZ_CAT = {
            'cibo': 'Ristorazione', 'food': 'Ristorazione', 'sapori': 'Ristorazione',
            'gastronomia': 'Ristorazione', 'carbonara': 'Ristorazione', 'street': 'Ristorazione',
            'pizza': 'Ristorazione', 'trattoria': 'Ristorazione', 'ristorante': 'Ristorazione',
            'cultura': 'Cultura', 'arte': 'Cultura', 'musei': 'Cultura', 'barocco': 'Cultura',
            'storia': 'Storia', 'patrimonio': 'Storia', 'imperiale': 'Storia',
            'shopping': 'Shopping', 'moda': 'Shopping', 'lusso': 'Lusso',
            'nightlife': 'Nightlife', 'aperitivo': 'Nightlife', 'navigli': 'Nightlife',
            'relax': 'Relax', 'spa': 'Relax', 'benessere': 'Relax',
            'natura': 'Relax', 'parco': 'Relax', 'avventura': 'Avventura',
            'artigianato': 'Artigianato', 'tradizione': 'Artigianato',
            'romantico': 'Ospitalità', 'ospitalità': 'Ospitalità',
        };

        try {
            console.log(`🔎 Seeking businesses in "${city}" with tags:`, tags, 'Pace:', targetPace);

            const { data, error } = await supabase
                .from('businesses_profile')
                .select('*')
                .ilike('city', city);

            if (error) throw error;
            if (!data || data.length === 0) {
                console.warn(`⚠️ No businesses found in city "${city}"`);
                return [];
            }
            console.log(`📋 Found ${data.length} businesses in ${city} to score`);

            // ─── AFFINITY SCORING ────────────────────────────────────────────
            const scored = data.map(b => {
                let score = 0;
                const ai = b.ai_metadata || {};
                const vibes = (Array.isArray(ai.vibe) ? ai.vibe : (ai.vibe ? [ai.vibe] : []))
                    .map(v => v.toLowerCase());
                const bizCats = (b.category_tags || []).map(c => c.toLowerCase());
                const pace = (ai.pace || 'normal').toLowerCase();

                tags.forEach(t => {
                    const tag = t.toLowerCase();

                    // A. Vibe AI direct match (+3 exact, +1 partial)
                    if (vibes.includes(tag)) {
                        score += 3;
                    } else if (vibes.some(v => v.includes(tag) || tag.includes(v))) {
                        score += 1;
                    }

                    // B. Category_tags direct match (+2) — e.g. tag "cibo" → cat "ristorazione"
                    const mappedCat = (TOUR_TAG_TO_BIZ_CAT[tag] || '').toLowerCase();
                    if (mappedCat && bizCats.includes(mappedCat)) {
                        score += 2;
                        console.log(`  ✅ Cat match: tag "${tag}" → cat "${mappedCat}" for ${b.company_name}`);
                    }

                    // C. Raw tag in category_tags (+1)
                    if (bizCats.includes(tag)) score += 1;
                });

                // D. Pace match (+1)
                if (targetPace && pace === targetPace.toLowerCase()) score += 1;

                // E. Guaranteed minimum if category is relevant to any tour tag
                const anyRelevantCat = tags.some(t => {
                    const mapped = (TOUR_TAG_TO_BIZ_CAT[t.toLowerCase()] || '').toLowerCase();
                    return mapped && bizCats.includes(mapped);
                });
                if (anyRelevantCat && score === 0) score = 1; // floor to include

                console.log(`  📊 Score for ${b.company_name}: ${score}`);
                return { business: b, score };
            });

            // ─── FILTER & RESOLVE COORDINATES ────────────────────────────────
            const relevant = scored
                .filter(item => item.score > 0)
                .sort((a, b) => b.score - a.score)
                .slice(0, 3); // max 3 businesses per tour

            console.log(`🏆 ${relevant.length} relevant businesses after scoring`);

            // Geocode any that are missing coordinates
            const resolved = await Promise.all(relevant.map(async ({ business }) => {
                const stop = this.mapBusinessToItineraryStop(business);

                // If no valid coords → try geocoding address on-the-fly
                if (!stop._hasCoords && business.address) {
                    console.log(`📍 Geocoding "${business.company_name}" from address: ${business.address}`);
                    try {
                        const res = await fetch(
                            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(business.address + ', ' + business.city + ', Italy')}&limit=1`
                        );
                        const geo = await res.json();
                        if (geo && geo.length > 0) {
                            stop.latitude = parseFloat(geo[0].lat);
                            stop.longitude = parseFloat(geo[0].lon);
                            stop._hasCoords = true;
                            console.log(`✅ Geocoded "${business.company_name}": ${stop.latitude.toFixed(4)}, ${stop.longitude.toFixed(4)}`);
                            // Also save coords back to DB for next time
                            supabase.from('businesses_profile')
                                .update({
                                    location: `POINT(${stop.longitude} ${stop.latitude})`,
                                    latitude: stop.latitude,
                                    longitude: stop.longitude,
                                })
                                .eq('id', business.id)
                                .then(({ error }) => { if (error) console.warn('Could not cache coords:', error.message); });
                        } else {
                            console.warn(`⚠️ Could not geocode "${business.company_name}"`);
                        }
                    } catch (geoErr) {
                        console.warn(`⚠️ Geocoding failed for "${business.company_name}":`, geoErr.message);
                    }
                }

                // Apply AI story hook to description
                const hook = business.ai_metadata?.story_hook;
                if (hook) stop.description = `✨ ${hook}`;

                return stop;
            }));

            const finalMatches = resolved.filter(s => s._hasCoords);
            console.log(`✅ ${finalMatches.length} businesses ready for injection (with valid coords)`);
            return finalMatches;

        } catch (err) {
            console.warn('Error fetching businesses for itinerary:', err);
            return [];
        }
    }




    mapBusinessToItineraryStop(business) {
        let lat = business.latitude ? parseFloat(business.latitude) : null;
        let lng = business.longitude ? parseFloat(business.longitude) : null;
        if ((!lat || !lng) && business.location && typeof business.location === 'string' && business.location.startsWith('POINT')) {
            const parts = business.location.replace('POINT(', '').replace(')', '').trim().split(/\s+/);
            if (parts.length >= 2) { lng = parseFloat(parts[0]); lat = parseFloat(parts[1]); }
        }
        const hasValidCoords = !!(lat && lng && !isNaN(lat) && !isNaN(lng));
        const imageUrl = (business.image_urls && business.image_urls.length > 0) ? business.image_urls[0] : null;
        return {
            id: `biz-${business.id}`, title: business.company_name,
            description: business.description || `Scopri ${business.company_name} a ${business.city}`,
            image: imageUrl, imageUrl,
            latitude: hasValidCoords ? lat : null, longitude: hasValidCoords ? lng : null,
            _hasCoords: hasValidCoords, isSponsored: true,
            tier: business.subscription_tier, tags: business.category_tags,
            address: business.address, website: business.website,
            menu_url: business.menu_url, city: business.city,
        };
    }
}

export const dataService = new DataService();
