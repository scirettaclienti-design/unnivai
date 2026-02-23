
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ahecpiwsdhghkndncejb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoZWNwaXdzZGhnaGtuZG5jZWpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5MzU4NDAsImV4cCI6MjA4NDUxMTg0MH0.CLE-u77YN_7zs2cp59omB7GswNy-9KWgUaWzKQ_Cy_U';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function testRLS() {
    console.log("🕵️ TESTING RLS PERMISSIONS...");

    // 1. LOGIN
    const { data: { user }, error: authError } = await supabase.auth.signInWithPassword({
        email: 'ivano.sciretta@icloud.com',
        password: 'Roma2020!'
    });

    if (authError) {
        console.error("❌ Login Failed:", authError.message);
        return;
    }
    console.log("✅ Authenticated as:", user.id);

    // 2. TRY SELECT
    const { data: selectData, error: selectError } = await supabase
        .from('businesses_profile')
        .select('*')
        .eq('user_id', user.id);

    if (selectError) {
        console.error("❌ SELECT Failed (RLS Blocking Read?):", selectError.message);
    } else {
        console.log(`✅ SELECT Success. Found ${selectData.length} rows.`);
    }

    // 3. TRY INSERT (if empty) or UPDATE
    const timestamp = new Date().toISOString();

    // Attempt Insert
    const { data: insertData, error: insertError } = await supabase
        .from('businesses_profile')
        .insert([{
            user_id: user.id,
            company_name: 'TEST RLS ' + timestamp
        }])
        .select();

    if (insertError) {
        console.error("❌ INSERT Failed (RLS Blocking Write?):", insertError.message);
        console.error("   DETAIL:", insertError.details || insertError.hint || "No details");
    } else {
        console.log("✅ INSERT Success:", insertData);
    }
}

testRLS();
