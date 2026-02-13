export default async function handler(request, response) {
    // Attempt to read from various standard env var patterns for Supabase
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        return response.status(500).json({
            error: 'Missing environment variables. Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.'
        });
    }

    try {
        // Ping the 'tours' table (public read access usually enabled)
        // Select just ID and limit to 1 row for minimal overhead
        const targetUrl = `${supabaseUrl}/rest/v1/tours?select=id&limit=1`;

        const res = await fetch(targetUrl, {
            method: 'GET',
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json'
            }
        });

        if (res.ok) {
            const data = await res.json();
            return response.status(200).json({
                status: 'ok',
                timestamp: new Date().toISOString(),
                message: 'Supabase instance is active',
                data_sample: data
            });
        } else {
            const errorText = await res.text();
            return response.status(res.status).json({
                error: `Supabase returned error: ${res.status}`,
                details: errorText
            });
        }
    } catch (error) {
        return response.status(500).json({
            error: 'Internal Server Error during ping',
            message: error.message
        });
    }
}
