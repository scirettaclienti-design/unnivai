import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ahecpiwsdhghkndncejb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoZWNwaXdzZGhnaGtuZG5jZWpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5MzU4NDAsImV4cCI6MjA4NDUxMTg0MH0.CLE-u77YN_7zs2cp59omB7GswNy-9KWgUaWzKQ_Cy_U';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testExplicitFK() {
  const { data, error } = await supabase
    .from('guide_requests')
    .select(`
        id, status, guide_id, user_id, city, category,
        duration, request_text, notes, created_at, user_name,
        tour_id,
        user_profile:profiles!guide_requests_user_id_profiles_fk(full_name, avatar_url)
    `)
    .limit(1);

  if (error) {
    console.log("Explicit FK query error:", JSON.stringify(error, null, 2));
  } else {
    console.log("Explicit FK query success:", data);
  }
}

testExplicitFK();
