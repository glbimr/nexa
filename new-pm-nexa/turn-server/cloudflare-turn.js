/**
 * Cloudflare TURN Credential Generator
 * 
 * This server-side module generates short-lived TURN credentials
 * from Cloudflare's managed TURN service.
 * 
 * Setup Instructions:
 * 1. Go to Cloudflare Dashboard > Calls > Create a TURN App
 * 2. Copy the TURN Key ID and API Token
 * 3. Set them in .env.local file
 */

const express = require('express');
const cors = require('cors');
const app = express();

// Enable CORS for your frontend
app.use(cors());
app.use(express.json());

// Cloudflare TURN API Configuration
const TURN_KEY_ID = process.env.CLOUDFLARE_TURN_KEY_ID || '';
const TURN_API_TOKEN = process.env.CLOUDFLARE_TURN_API_TOKEN || '';

/**
 * Generate ICE servers configuration from Cloudflare TURN
 * @param {number} ttl - Time to live for credentials in seconds (default: 86400 = 24 hours)
 * @returns {Promise<Object>} ICE servers configuration
 */
async function generateCloudflareICEServers(ttl = 86400) {
    if (!TURN_KEY_ID || !TURN_API_TOKEN) {
        console.error('❌ Cloudflare TURN credentials not configured!');
        console.error('Please set CLOUDFLARE_TURN_KEY_ID and CLOUDFLARE_TURN_API_TOKEN in environment variables');
        throw new Error('Cloudflare TURN not configured');
    }

    const url = `https://rtc.live.cloudflare.com/v1/turn/keys/${TURN_KEY_ID}/credentials/generate`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${TURN_API_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ ttl })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Cloudflare API Error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Failed to generate Cloudflare TURN credentials:', error);
        throw error;
    }
}

// API Endpoint to get ICE servers configuration
app.post('/api/turn/credentials', async (req, res) => {
    try {
        const { ttl = 86400 } = req.body; // Default 24 hours
        const iceServers = await generateCloudflareICEServers(ttl);

        res.json({
            success: true,
            iceServers
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'Cloudflare TURN Proxy' });
});

const PORT = process.env.PORT || 3479;

app.listen(PORT, () => {
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║   🌐 Cloudflare TURN Credential Server                ║');
    console.log('╠════════════════════════════════════════════════════════╣');
    console.log(`║   Port: ${PORT}                                        ║`);
    console.log(`║   Endpoint: POST /api/turn/credentials                ║`);
    console.log(`║   Health: GET /health                                 ║`);
    console.log('╠════════════════════════════════════════════════════════╣');
    console.log(`║   TURN Key Configured: ${TURN_KEY_ID ? '✅ Yes' : '❌ No'}                 ║`);
    console.log('╚════════════════════════════════════════════════════════╝');

    if (!TURN_KEY_ID || !TURN_API_TOKEN) {
        console.warn('⚠️  WARNING: Cloudflare TURN credentials not set!');
        console.warn('   Please configure environment variables:');
        console.warn('   - CLOUDFLARE_TURN_KEY_ID');
        console.warn('   - CLOUDFLARE_TURN_API_TOKEN');
    }
});

module.exports = { app, generateCloudflareICEServers };
