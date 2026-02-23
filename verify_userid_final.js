
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ahecpiwsdhghkndncejb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoZWNwaXdzZGhnaGtuZG5jZWpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5MzU4NDAsImV4cCI6MjA4NDUxMTg0MH0.CLE-u77YN_7zs2cp59omB7GswNy-9KWgUaWzKQ_Cy_U';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// We need the user ID to insert for, or we can use the authenticated client if we had the token.
// Since we don't have the token in Node without passing it, and we want to ensure persistence works for the user 'ivano.sciretta@icloud.com',
// We will rely on the dashboard frontend test.

// This script just verifies the column existence again to be doubly sure.
async function verify() {
    console.log("🔍 Double Checking Columns...");
    const { error } = await supabase
        .from('businesses_profile')
        .select('user_id')
        .limit(1);

    if (error) {
        console.error("❌ Column user_id STILL MISSING: " + error.message);
    } else {
        console.log("✅ Column user_id CONFIRMED.");
    }
}

verify();
