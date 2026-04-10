import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ahecpiwsdhghkndncejb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoZWNwaXdzZGhnaGtuZG5jZWpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5MzU4NDAsImV4cCI6MjA4NDUxMTg0MH0.CLE-u77YN_7zs2cp59omB7GswNy-9KWgUaWzKQ_Cy_U';

async function fetchSchema() {
  const res = await fetch(`${supabaseUrl}/rest/v1/?apikey=${supabaseKey}`);
  const json = await res.json();
  const profilesDef = json.definitions.profiles;
  if (!profilesDef) {
     console.log("No profiles definition found!");
  } else {
     console.log("Profiles columns:", Object.keys(profilesDef.properties));
  }
}

fetchSchema();
