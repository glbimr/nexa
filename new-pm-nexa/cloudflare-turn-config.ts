/**
 * Cloudflare TURN Configuration Module
 * 
 * This module handles fetching and caching Cloudflare TURN credentials
 * for WebRTC applications.
 */

export interface CloudflareICEServers {
    iceServers: {
        urls: string[];
        username: string;
        credential: string;
    };
}

// Cached credentials to avoid excessive API calls
let cachedICEConfig: RTCIceServer[] | null = null;
let credentialsExpiry = 0;

/**
 * Fetches ICE servers configuration from Cloudflare TURN API
 * Credentials are cached and refreshed before expiry
 */
export const fetchCloudflareICEServers = async (): Promise<RTCIceServer[]> => {
    const now = Date.now();

    // Return cached credentials if still valid (refresh 5 minutes before expiry)
    if (cachedICEConfig && credentialsExpiry > now + 5 * 60 * 1000) {
        console.log('Using cached Cloudflare TURN credentials');
        return cachedICEConfig;
    }

    try {
        const TURN_KEY_ID = import.meta.env.VITE_CLOUDFLARE_TURN_KEY_ID;
        const TURN_API_TOKEN = import.meta.env.VITE_CLOUDFLARE_TURN_API_TOKEN;

        if (!TURN_KEY_ID || !TURN_API_TOKEN) {
            console.warn('⚠️ Cloudflare TURN credentials not configured in .env.local');
            console.warn('Add VITE_CLOUDFLARE_TURN_KEY_ID and VITE_CLOUDFLARE_TURN_API_TOKEN');
            return getFallbackICEServers();
        }

        console.log('Fetching fresh Cloudflare TURN credentials...');

        const response = await fetch(
            `https://rtc.live.cloudflare.com/v1/turn/keys/${TURN_KEY_ID}/credentials/generate`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${TURN_API_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ ttl: 86400 }) // 24 hours
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Cloudflare TURN API error ${response.status}: ${errorText}`);
        }

        const data: CloudflareICEServers = await response.json();

        // Cloudflare returns iceServers object with urls array, username, and credential
        const cloudflareServer = {
            urls: data.iceServers.urls,
            username: data.iceServers.username,
            credential: data.iceServers.credential
        };

        // Metered.ca Open Relay (Backup/Alternative)
        // Ensures we always have the "free open-source proxy" available as requested
        const meteredServer = {
            urls: [
                'turn:staticauth.openrelay.metered.ca:80',
                'turn:staticauth.openrelay.metered.ca:443',
                'turn:staticauth.openrelay.metered.ca:443?transport=tcp',
                'turns:staticauth.openrelay.metered.ca:443?transport=tcp'
            ],
            username: 'openrelayproject',
            credential: 'openrelayprojectsecret'
        };

        cachedICEConfig = [cloudflareServer, meteredServer];

        // Set expiry time (24 hours from now, minus 5 min buffer)
        credentialsExpiry = now + (86400 - 300) * 1000;

        console.log('✅ Cloudflare TURN credentials fetched successfully');
        console.log(`   URLs: ${data.iceServers.urls.slice(0, 3).join(', ')}...`);
        console.log(`   Included Metered Open Relay backup`);
        console.log(`   Expires in: ${((credentialsExpiry - now) / 1000 / 60 / 60).toFixed(1)} hours`);

        return cachedICEConfig;

    } catch (error) {
        console.error('❌ Failed to fetch Cloudflare TURN credentials:', error);
        console.warn('Falling back to public STUN servers (no TURN relay)');
        return getFallbackICEServers();
    }
};

/**
 * Fallback ICE servers with metered.ca TURN
 * Used when Cloudflare credentials are not available
 * Includes TURN relay for better connectivity on restrictive networks
 */
export const getFallbackICEServers = (): RTCIceServer[] => {
    console.warn('⚠️ Cloudflare TURN not configured - using metered.ca fallback with TURN relay');

    return [
        // Metered.ca Open Relay (Backup/Alternative)
        // Uses both TURN (UDP/TCP) and TURNS (TLS) for maximum firewall traversal
        {
            urls: [
                'turn:staticauth.openrelay.metered.ca:80',
                'turn:staticauth.openrelay.metered.ca:443',
                'turn:staticauth.openrelay.metered.ca:443?transport=tcp',
                'turns:staticauth.openrelay.metered.ca:443?transport=tcp' // Secure TLS - Critical for HTTPS/Vercel
            ],
            username: 'openrelayproject',
            credential: 'openrelayprojectsecret'
        },

        // Google Public STUN (High reliability fallback for minimal connectivity)
        {
            urls: [
                'stun:stun.l.google.com:19302',
                'stun:stun1.l.google.com:19302'
            ]
        }
    ];
};

/**
 * Get current ICE servers (returns cached or fallback immediately)
 * Use initializeCloudfareTURN() during app startup to pre-fetch credentials
 */
export const getCurrentICEServers = (): RTCIceServer[] => {
    if (cachedICEConfig && credentialsExpiry > Date.now()) {
        return cachedICEConfig;
    }
    return getFallbackICEServers();
};

/**
 * Initialize Cloudflare TURN by pre-fetching credentials
 * Call this during app startup
 */
export const initializeCloudfareTURN = async (): Promise<void> => {
    try {
        await fetchCloudflareICEServers();
    } catch (error) {
        console.error('Failed to initialize Cloudflare TURN:', error);
    }
};

/**
 * Refresh credentials if they're about to expire
 * Can be called periodically or before establishing new connections
 */
export const refreshIfNeeded = async (): Promise<void> => {
    const now = Date.now();
    // Refresh if expiring in less than 10 minutes
    if (!cachedICEConfig || credentialsExpiry < now + 10 * 60 * 1000) {
        await fetchCloudflareICEServers();
    }
};
