import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkPolicies() {
    console.log("Fetching policies...");
    const { data, error } = await supabase.rpc('get_notifications_policies');
    if (error) {
        console.error("RPC fallito:", error);
    } else {
        console.log("✅ POLICY ATTUALI IN DB PER LA TABELLA NOTIFICATIONS:");
        console.log(JSON.stringify(data, null, 2));
    }
}

checkPolicies();
