import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function testInsertNotification() {
    // 1. Log in Come Guida (sciretta.clienti@gmail.com)
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: 'sciretta.clienti@gmail.com',
        password: 'Roma2020!'
    });

    if (authError) {
        console.error("Login fallito:", authError.message);
        return;
    }

    console.log("Guida autenticata con ID:", authData.session.user.id);

    // 2. Prova a inserire una notifica per l'esploratore (813d9dc6-5cb9-44ef-96f4-11574a3418de vedi user_id da errore precedente)
    const explorerId = "813d9dc6-5cb9-44ef-96f4-11574a3418de"; // ID Esploratore

    const { data, error } = await supabase
        .from('notifications')
        .insert({
            user_id: explorerId,
            type: 'test_rls',
            title: 'Test RLS Guida',
            message: 'Questo è un test per vedere se la guida può scrivere nelle tue notifiche',
            city_scope: 'Roma',
            is_read: false,
        });

    if (error) {
        console.error("❌ ERRORE INSERT NOTIFICA (RLS in azione?):", error.message);
    } else {
        console.log("✅ NOTIFICA INSERITA CON SUCCESSO:", data);
    }
}

testInsertNotification();
