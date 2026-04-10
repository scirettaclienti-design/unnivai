import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

// Servono le credenziali di admin per leggere pg_policies se non abbiamo RPC
const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

// Direct fetch to Supabase REST API since we don't have the psql client
async function fetchPolicies() {
    try {
        const response = await fetch(`${url}/rest/v1/pg_policies?tablename=eq.notifications&select=*`, {
            method: 'GET',
            headers: {
                'apikey': key,
                'Authorization': `Bearer ${key}`
            }
        });
        
        if (!response.ok) {
            console.log("REST query failed:", response.status, await response.text());
        } else {
            const data = await response.json();
            console.log("POLICIES ATTUALI PER NOTIFICATIONS:");
            console.log(JSON.stringify(data, null, 2));
        }
    } catch(e) {
        console.error(e);
    }
}

fetchPolicies();
