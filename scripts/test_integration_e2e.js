
// =================================================================================
// UNNIVAI - E2E INTEGRATION TEST SCRIPT
// =================================================================================
// Usage: node scripts/test_integration_e2e.js
// Requirements: SUPABASE_URL and SUPABASE_SERVICE_KEY in .env or environment
// =================================================================================

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'YOUR_SERVICE_ROLE_KEY';

if (!SERVICE_KEY || SERVICE_KEY === 'YOUR_SERVICE_ROLE_KEY') {
    console.error('❌ ERRORE: Manca la SUPABASE_SERVICE_KEY. Impossibile gestire utenti auth.');
    process.exit(1);
}

// Admin Client (Bypass RLS, Manage Auth)
const adminSupabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function runTest() {
    console.log('🚀 AVVIO TEST DI INTEGRAZIONE E2E: "THE HAPPY PATH"');

    // -------------------------------------------------------------------------
    // 1. SETUP ATTORI (Auth)
    // -------------------------------------------------------------------------
    console.log('\n--- 1. Setup Attori ---');
    const emails = ['guida@test.com', 'business@test.com', 'user@test.com'];
    const users = {};

    for (const email of emails) {
        // Cleanup preventivo
        const { data: existingUsers } = await adminSupabase.auth.admin.listUsers();
        const oldUser = existingUsers.users.find(u => u.email === email);
        if (oldUser) {
            await adminSupabase.auth.admin.deleteUser(oldUser.id);
        }

        // Creazione Utente
        const { data, error } = await adminSupabase.auth.admin.createUser({
            email,
            password: 'password123',
            email_confirm: true
        });
        if (error) throw new Error(`Errore creazione ${email}: ${error.message}`);
        users[email.split('@')[0]] = data.user;
        console.log(`✅ Utente creato: ${email} (${data.user.id})`);
    }

    // Clienti "Impersonati" (Simuliamo il login)
    // Nota: In un test reale useremmo signInWithPassword, ma qui usiamo admin per semplicità o possiamo creare client ad-hoc se necessario.
    // Per semplicità, useremo adminSupabase facendo query "as user" se RLS lo richiedesse, 
    // MA poichè stiamo usando Node.js, il client standard non supporta "impersonate" facilmente senza sessione.
    // SOLUZIONE MIGLIORE NEL TEST: Usiamo signInWithPassword per ottenere token reali.

    const clients = {};
    for (const key of Object.keys(users)) {
        const client = createClient(SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY || 'YOUR_ANON_KEY');
        const { error } = await client.auth.signInWithPassword({
            email: `${key}@test.com`,
            password: 'password123'
        });
        if (error) throw error;
        clients[key] = client;
    }


    // -------------------------------------------------------------------------
    // 2. BUSINESS FLOW
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Business Flow ---');

    // Coordinate Pasticceria (Roma Centro)
    const bizLat = 41.9000;
    const bizLng = 12.4500;

    const { data: activity, error: actError } = await clients['business']
        .from('activities')
        .insert({
            name: 'Pasticceria Siciliana',
            // Location POINT(lng lat)
            location: `POINT(${bizLng} ${bizLat})`,
            vibe_tags: ['dolce', 'colazione'],
            opening_hours: { open: '08:00', close: '20:00' }
        })
        .select()
        .single();

    if (actError) throw new Error(`Errore creazione Attività: ${actError.message}`);
    console.log(`✅ Attività creata: ${activity.name} (Tier Iniziale: ${activity.subscription_tier})`);

    // VERIFICA TRIGGER: Deve essere 'free'
    if (activity.subscription_tier !== 'free') throw new Error('❌ IL trigger non ha forzato il tier a FREE!');

    // ADMIN UPGRADE (Simulazione Pagamento)
    // Usiamo adminSupabase per bypassare RLS e Trigger (se il trigger lo permette agli admin, oppure disabilitiamo trigger... 
    // WAIT: Il trigger protect_activity_subscription blocca anche gli update se non siamo admin DB.
    // service_role key su Supabase è un "super admin" RLS bypass, ma i trigger PL/pgSQL scattano comunque. 
    // Il nostro trigger controlla "IF (NEW.tier != OLD.tier) AND (auth.uid() IS NOT NULL)".
    // Le chiamate con Service Key hanno auth.uid() NULL? Generalmente sì. Proviamo.
    const { error: upgradeError } = await adminSupabase
        .from('activities')
        .update({ subscription_tier: 'premium' })
        .eq('id', activity.id);

    if (upgradeError) throw new Error(`Errore upgrade Admin: ${upgradeError.message}`);
    console.log('✅ Admin ha upgradato l\'attività a PREMIUM.');


    // -------------------------------------------------------------------------
    // 3. GUIDE FLOW
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Guide Flow ---');

    // ISCRIZIONE GUIDA
    // Inseriamo la riga in 'guides' (tabella estensione profilo)
    const { error: guideRegError } = await clients['guida']
        .from('guides')
        .insert({ id: users['guida'].id }); // Trigger fillerà il resto

    if (guideRegError) throw new Error(`Errore registrazione Guida: ${guideRegError.message}`);

    // VERIFICA DEFAULTS
    const { data: guideProfile } = await clients['guida']
        .from('guides')
        .select('*')
        .single();

    if (guideProfile.level !== 'esploratore') throw new Error('❌ Trigger Guida fallito: Livello errato');
    console.log(`✅ Guida Registrata: ${guideProfile.level} (${guideProfile.status})`);

    // CALCOLO COMMISSIONI (RPC)
    // Nota: RPC su Supabase si chiama con .rpc()
    const { data: commission, error: commError } = await clients['guida']
        .rpc('get_tour_commission', { query_guide_id: users['guida'].id });

    if (commError) throw new Error(`Errore RPC Commissioni: ${commError.message}`);
    console.log(`✅ Commissione Calcolata: ${commission}%`);
    if (commission != 20.00) throw new Error('❌ Errore logica commissioni');

    // RICERCA PARTNER (RPC)
    const { data: partners, error: searchError } = await clients['guida']
        .rpc('search_nearby_partners', {
            lat: bizLat,
            lng: bizLng,
            radius_meters: 500,
            filter_tag: 'dolce'
        });

    if (searchError) throw new Error(`Errore RPC Ricerca: ${searchError.message}`);
    const foundPartner = partners.find(p => p.id === activity.id);
    if (!foundPartner) throw new Error('❌ La Pasticceria non è stata trovata dal Motore di Matching!');
    console.log(`✅ Partner Trovato: ${foundPartner.name} (Distanza: ${Math.round(foundPartner.distance_meters)}m)`);

    // CREAZIONE TOUR
    // Route Path: Linea che finisce alla Pasticceria
    const startLat = 41.8900;
    const startLng = 12.4400;
    const routeWKT = `LINESTRING(${startLng} ${startLat}, ${bizLng} ${bizLat})`;

    const { data: tour, error: tourError } = await clients['guida']
        .from('tours')
        .insert({
            guide_id: users['guida'].id,
            title: 'Roma Dolce Walking Tour',
            price_eur: 45.00,
            duration_minutes: 120,
            city: 'Roma',
            steps: [
                { title: 'Inizio', coordinates: { lat: startLat, lng: startLng } },
                { title: 'Pasticceria Finale', coordinates: { lat: bizLat, lng: bizLng }, linked_business_id: activity.id }
            ],
            route_path: routeWKT // Importante per complete_tour
        })
        .select()
        .single();

    if (tourError) throw new Error(`Errore creazione Tour: ${tourError.message}`);
    console.log(`✅ Tour Creato: ${tour.title}`);


    // -------------------------------------------------------------------------
    // 4. USER FLOW
    // -------------------------------------------------------------------------
    console.log('\n--- 4. User Flow ---');

    // Setup Profilo Explorer
    await clients['user'].from('explorers').insert({ id: users['user'].id });

    // SIMULAZIONE COMPLETAMENTO (RPC)
    // L'utente è alle coordinate finali (bizLat, bizLng)
    console.log('User chiama complete_tour...');
    const { error: completeError } = await clients['user']
        .rpc('complete_tour', {
            tour_id_param: tour.id,
            user_lat: bizLat,
            user_lng: bizLng
        });

    if (completeError) throw new Error(`Errore complete_tour: ${completeError.message}`);
    console.log('✅ RPC complete_tour eseguita con successo');

    // UPLOAD FOTO (Geofencing Check)
    // Caso 1: Foto Lontana (Deve fallire)
    const { error: failPhotoError } = await clients['user']
        .from('user_photos')
        .insert({
            user_id: users['user'].id,
            media_url: 'http://fake.url/spam.jpg',
            location: `POINT(0 0)`, // Lontanissimo
            tour_id: tour.id
        });

    if (!failPhotoError) throw new Error('❌ La foto SPAM doveva essere bloccata, invece è passata!');
    console.log('✅ Blocco Spam Geofencing: Funzionante (Foto 0,0 rifiutata)');

    // Caso 2: Foto Valida (Alla pasticceria)
    const { data: photo, error: photoError } = await clients['user']
        .from('user_photos')
        .insert({
            user_id: users['user'].id,
            media_url: 'http://fake.url/dolce.jpg',
            location: `POINT(${bizLng} ${bizLat})`, // Perfetto
            tour_id: tour.id
        })
        .select()
        .single();

    if (photoError) throw new Error(`Errore upload foto valida: ${photoError.message}`);
    console.log(`✅ Foto Valida Caricata: ID ${photo.id}`);


    // -------------------------------------------------------------------------
    // 5. VERIFICA FINALE (ASSERTS)
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Verifica Finale ---');

    // Verifica Explorer Stats
    const { data: explorer } = await clients['user']
        .from('explorers')
        .select('*')
        .single();

    console.log(`Explorer KM Walked: ${explorer.km_walked}`);
    console.log(`Explorer Cities: ${JSON.stringify(explorer.cities_unlocked)}`);

    if (explorer.km_walked <= 0) throw new Error('❌ km_walked non è aumentato!');
    if (!explorer.cities_unlocked.includes('Roma')) throw new Error('❌ Città Roma non sbloccata!');

    console.log('\n🎉 ===================================================');
    console.log('🎉 TEST PASSATO: TUTTI I SISTEMI FUNZIONANO CORRETTAMENTE');
    console.log('🎉 ===================================================');
}

// Esegui
runTest().catch(err => {
    console.error('\n❌ TEST FALLITO:', err.message);
    process.exit(1);
});
