const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const [, url] = env.match(/VITE_SUPABASE_URL=(.*)/);
const [, key] = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/);
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(url, key);

async function main() {
    console.log('Fetching tour...');
    const { data, error } = await supabase.from('tours').select('*').eq('title', 'prova 1').limit(1);
    if (error || !data || data.length === 0) {
        console.error('Error fetching tour:', error || 'No tour found');
        return;
    }
    const tour = data[0];
    console.log('Current tour price:', tour.price_eur);

    // Un bell'immagini fittizia di Roma o del Colosseo
    const newImageUrl = 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=800&q=80';

    console.log('Updating tour...');
    const { error: updateError } = await supabase.from('tours').update({
        price_eur: 15,
        image_urls: [newImageUrl]
    }).eq('id', tour.id);

    if (updateError) {
        console.error('Update error:', updateError);
    } else {
        console.log('Tour updated successfully! New price: 15, New Image:', newImageUrl);
    }
}
main();
