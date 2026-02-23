
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ahecpiwsdhghkndncejb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoZWNwaXdzZGhnaGtuZG5jZWpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5MzU4NDAsImV4cCI6MjA4NDUxMTg0MH0.CLE-u77YN_7zs2cp59omB7GswNy-9KWgUaWzKQ_Cy_U';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function fix() {
    console.log("🛠️ Attempting to verify user_id column...");

    // We can't ALTER TABLE via JS client usually, but we can call a stored procedure if one exists, 
    // or we can just try to SELECT user_id to confirm it's missing, then LOG the instruction.
    // However, the USER must run the SQL in the editor.
    // This script is just a double-check.

    const { error } = await supabase
        .from('businesses_profile')
        .select('user_id')
        .limit(1);

    if (error) {
        console.error("❌ Column user_id is MISSING or inaccessible: " + error.message);
    } else {
        console.log("✅ Column user_id EXISTS. Persistence should work.");
    }
}

fix();
