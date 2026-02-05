import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seedNotifications() {
    console.log('🌱 Seeding notifications...');

    const userId = '1'; // Replace with target user ID if known, or get dynamic

    const notifications = [
        {
            user_id: userId,
            title: '🔥 Evento a Roma',
            message: 'Concerto jazz stasera a Trastevere!',
            type: 'social_activity',
            category: 'social',
            city_scope: 'Roma',
            action_data: { url: '/events/123' },
            created_at: new Date().toISOString()
        },
        {
            user_id: userId,
            title: '☔ Meteo Milano',
            message: 'Previsioni pioggia domani, porta l\'ombrello.',
            type: 'weather_alert',
            category: 'weather',
            city_scope: 'Milano',
            action_data: {},
            created_at: new Date().toISOString()
        },
        {
            user_id: userId,
            title: '🎨 Mostra Firenze',
            message: 'Nuova esposizione agli Uffizi.',
            type: 'tour_recommendation',
            category: 'culture',
            city_scope: 'Firenze',
            action_data: { tourId: 'uffizi-florence' },
            created_at: new Date().toISOString()
        },
        {
            user_id: userId,
            title: '🌍 Notifica Globale',
            message: 'Benvenuto in Unnivai! Esplora il mondo.',
            type: 'info',
            category: 'general',
            city_scope: null, // Global
            action_data: {},
            created_at: new Date().toISOString()
        }
    ];

    const { data, error } = await supabase
        .from('notifications')
        .insert(notifications)
        .select();

    if (error) {
        console.error('❌ Error seeding notifications:', error);
    } else {
        console.log('✅ Notifications seeded successfully:', data.length);
        console.table(data.map(n => ({ id: n.id, title: n.title, city: n.city_scope || 'GLOBAL' })));
    }
}

seedNotifications();
