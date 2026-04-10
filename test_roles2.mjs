import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ahecpiwsdhghkndncejb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoZWNwaXdzZGhnaGtuZG5jZWpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5MzU4NDAsImV4cCI6MjA4NDUxMTg0MH0.CLE-u77YN_7zs2cp59omB7GswNy-9KWgUaWzKQ_Cy_U';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testRoles() {
    const rolesToTest = ['explorer', 'tourist', 'user', 'customer'];
    
    for (const role of rolesToTest) {
        // We use a fake UUID that is definitely not in auth.users, 
        // but if the failure is 'check constraint' it might fail early!
        // Wait, there's an FK to auth.users, so we might fail on FK first.
        // Let's try to update an existing user's role instead.
        const { data, error } = await supabase
            .from('profiles')
            .update({ role: role })
            .eq('id', '813d9dc6-5cb9-44ef-96f4-11574a3418de') // from the user's error message
            .select();
        
        if (error) {
            console.log(`Role '${role}' error:`, error.message);
        } else {
            console.log(`Role '${role}' SUCCESS!`);
            // Put it back
            await supabase.from('profiles').update({ role: 'guide' }).eq('id', '813d9dc6-5cb9-44ef-96f4-11574a3418de');
        }
    }
}
testRoles();
