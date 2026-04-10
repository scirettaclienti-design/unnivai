import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ahecpiwsdhghkndncejb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoZWNwaXdzZGhnaGtuZG5jZWpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5MzU4NDAsImV4cCI6MjA4NDUxMTg0MH0.CLE-u77YN_7zs2cp59omB7GswNy-9KWgUaWzKQ_Cy_U';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  console.log("Fetching...");
  const { data, error } = await supabase
    .from('guide_requests')
    .select(`
        id, status, guide_id, user_id, city, category,
        duration, request_text, notes, created_at, user_name,
        tour_id,
        profiles!user_id(full_name, avatar_url),
        tours!tour_id(title)
    `)
    .in('status', ['open'])
    .order('created_at', { ascending: false });

  if (error) {
    console.error("ERROR:");
    console.error(JSON.stringify(error, null, 2));
  } else {
    console.log("SUCCESS:");
    console.log(data);
  }
}

test();
