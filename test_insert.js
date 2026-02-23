const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/);
const url = urlMatch[1].trim();
const key = keyMatch[1].trim();

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(url, key);

async function run() {
    const auth = await supabase.auth.signInWithPassword({
        email: 'ivutente@unnivai.com',
        password: 'password'
    });

    console.log('Auth user:', auth.data?.user?.id, 'Error:', auth.error?.message);

    if (!auth.data?.user) {
        console.log('Login failed, trying guide account...');
        const auth2 = await supabase.auth.signInWithPassword({
            email: 'ivguida@unnivai.com',
            password: 'password'
        });
        console.log('Guide auth:', auth2.data?.user?.id, 'Error:', auth2.error?.message);
        if (!auth2.data?.user) { console.log('Both logins failed'); return; }
    }

    const userId = auth.data?.user?.id;

    const { data, error } = await supabase.from('guide_requests').insert({
        user_id: userId,
        user_name: 'Test User',
        city: 'Roma',
        status: 'open',
        category: 'custom',
        duration: 3,
        request_text: 'test request - tour bar roma'
    }).select();

    console.log('Insert data:', JSON.stringify(data));
    console.log('Insert error:', JSON.stringify(error));

    // Also fetch all
    const all = await supabase.from('guide_requests').select('*');
    console.log('All requests count:', all.data?.length, 'Error:', all.error?.message);
}

run().catch(console.error);
