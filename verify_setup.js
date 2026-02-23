import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ahecpiwsdhghkndncejb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoZWNwaXdzZGhnaGtuZG5jZWpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5MzU4NDAsImV4cCI6MjA4NDUxMTg0MH0.CLE-u77YN_7zs2cp59omB7GswNy-9KWgUaWzKQ_Cy_U';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function verify() {
    console.log("🔍 Checking Backend Setup...");

    // 1. Check Table Structure (Upsert Test)
    try {
        console.log("-> Checking 'businesses_profile' schema...");
        // Use a dummy UUID that won't conflict or is invalid so it errors specifically
        // But invalid UUID might cause 'invalid input syntax for type uuid'.
        // Let's rely on 'select' limit 1 to check columns existence via error
        const { data, error } = await supabase
            .from('businesses_profile')
            .select('location, ai_metadata, image_urls')
            .limit(1);

        if (error) {
            if (error.message.includes('column') && error.message.includes('does not exist')) {
                console.error("❌ CRITICAL: Column Missing ->", error.message);
                console.log("   ACTION: SQL Script did NOT run correctly. Re-run 'fix_location_column.sql'.");
            } else {
                console.error("❌ UNKNOWN DB ERROR:", error.message); // Could be permission denied for ANON select? Setup RLS policy?
                // If permission denied, it means TABLE exists but policy prevents read. That's actually good for schema check (table exists).
                // But specifically checking columns requires permission.
            }
        } else {
            console.log("✅ Columns (location, ai_metadata) EXIST.");
        }
    } catch (e) {
        console.error("❌ Connectivity Error:", e);
    }

    // 2. Check Storage
    try {
        console.log("-> Checking 'business-media' bucket...");
        const { data: buckets, error } = await supabase.storage.listBuckets();

        if (error) {
            console.error("❌ Storage List Error:", error.message);
        } else {
            const businessMedia = buckets?.find(b => b.name === 'business-media');
            if (businessMedia) {
                console.log("✅ Bucket 'business-media' exists.");
                console.log("   Public Access:", businessMedia.public);
            } else {
                console.error("❌ CRITICAL: Bucket 'business-media' NOT FOUND.");
                console.log("   ACTION: SQL Script for storage did not run.");
            }
        }
    } catch (e) {
        console.error("❌ Storage Check Failed:", e);
    }
}

verify();
