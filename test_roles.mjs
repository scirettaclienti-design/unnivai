import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ahecpiwsdhghkndncejb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoZWNwaXdzZGhnaGtuZG5jZWpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5MzU4NDAsImV4cCI6MjA4NDUxMTg0MH0.CLE-u77YN_7zs2cp59omB7GswNy-9KWgUaWzKQ_Cy_U';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRoles() {
    const { data, error } = await supabase.from('profiles').select('role').limit(20);
    if (error) {
        console.error("Error fetching roles:", error);
    } else {
        const uniqueRoles = [...new Set(data.map(d => d.role))];
        console.log("Existing roles in DB:", uniqueRoles);
    }
}

checkRoles();
