import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ahecpiwsdhghkndncejb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoZWNwaXdzZGhnaGtuZG5jZWpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5MzU4NDAsImV4cCI6MjA4NDUxMTg0MH0.CLE-u77YN_7zs2cp59omB7GswNy-9KWgUaWzKQ_Cy_U';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMario() {
  const { data, error } = await supabase
    .from('businesses_profile')
    .select('id, company_name, category_tags, ai_metadata, location, subscription_tier, city')
    .ilike('company_name', '%mario%');
  
  if (error) {
    console.error(error);
  } else {
    console.log("Found businesses:", JSON.stringify(data, null, 2));
  }
}

checkMario();
