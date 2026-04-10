import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkSupaLogs() {
    const explorerId = "813d9dc6-5cb9-44ef-96f4-11574a3418de"; // ID Esploratore

    console.log("Reading notifications for explorer:", explorerId);

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: 'ivano.sciretta@live.it',
        password: 'Roma2020!'
    });

    const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', explorerId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error("❌ ERRORE FETCH:", error.message);
    } else {
        console.log(`✅ TROVATE ${data.length} NOTIFICHE.`);
        console.log(data);
    }
}

checkSupaLogs();
