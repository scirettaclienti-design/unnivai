
// Script to check environment variables and API keys
import fs from 'fs';
import path from 'path';
import 'dotenv/config';

console.log('--- UNNIVAI KEY CHECK ---');

const envPath = path.resolve(process.cwd(), '.env');
if (!fs.existsSync(envPath)) {
    console.error('❌ .env file missing!');
    process.exit(1);
}

// 1. Mapbox Token
const mapboxToken = process.env.VITE_MAPBOX_TOKEN;
if (!mapboxToken || mapboxToken.length < 20) {
    console.error('❌ VITE_MAPBOX_TOKEN is missing or invalid.');
} else if (mapboxToken.includes('ExampleToken')) {
    console.warn('⚠️ VITE_MAPBOX_TOKEN is a placeholder!');
} else {
    console.log('✅ VITE_MAPBOX_TOKEN found:', mapboxToken.substring(0, 15) + '...');
}


// 2. OpenAI Key
const openaiKey = process.env.VITE_OPENAI_API_KEY;
if (!openaiKey || openaiKey.length < 10) {
    console.warn('⚠️ VITE_OPENAI_API_KEY missing - AI will use restricted "Local Mode".');
} else {
    console.log('✅ VITE_OPENAI_API_KEY found. AI "Insider Mode" Active ✨');

    // Simple validation (format check)
    if (!openaiKey.startsWith('sk-')) {
        console.warn('⚠️ VITE_OPENAI_API_KEY format looks unusual (should start with sk-).');
    }
}

console.log('-------------------------');
