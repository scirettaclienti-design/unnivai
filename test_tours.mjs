import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ahecpiwsdhghkndncejb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoZWNwaXdzZGhnaGtuZG5jZWpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5MzU4NDAsImV4cCI6MjA4NDUxMTg0MH0.CLE-u77YN_7zs2cp59omB7GswNy-9KWgUaWzKQ_Cy_U';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testTours() {
  const { data, error } = await supabase
    .from('tours')
    .select('*, profiles!guide_id(username, full_name, avatar_url, bio)')
    .limit(1);

  if (error) {
    console.log("Tours query error:", error);
  } else {
    console.log("Tours query success:", data);
  }
}

testTours();
