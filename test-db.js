import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

let env = fs.readFileSync('.env', 'utf8');
let supabaseUrl = env.match(/VITE_SUPABASE_URL=(.*)/)[1];
let supabaseKey = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1];

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data, error } = await supabase.from('tours').select('title, image, image_urls, guide_id, price_eur, duration_minutes').order('created_at', { ascending: false }).limit(2);
    console.log("Error:", error);
    console.log("Tours:", data);
}
run();
