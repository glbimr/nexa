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
        cachedICEConfig = [{
            urls: data.iceServers.urls,
            username: data.iceServers.username,
            credential: data.iceServers.credential
        }];

        // Set expiry time (24 hours from now, minus 5 min buffer)
        credentialsExpiry = now + (86400 - 300) * 1000;

        console.log('✅ Cloudflare TURN credentials fetched successfully');
        console.log(`   URLs: ${data.iceServers.urls.slice(0, 3).join(', ')}...`);
        console.log(`   Expires in: ${((credentialsExpiry - now) / 1000 / 60 / 60).toFixed(1)} hours`);

        return cachedICEConfig;

    } catch (error) {
        console.error('❌ Failed to fetch Cloudflare TURN credentials:', error);
        console.warn('Falling back to public STUN servers (no TURN relay)');
        return getFallbackICEServers();
    }
};

/**
 * Fallback ICE servers with MULTIPLE free open-source TURN servers
 * Used when Cloudflare credentials are not available
 * 
 * IMPORTANT: These are FREE, PUBLIC TURN relay servers for proxying WebRTC traffic
 * This ensures audio works across different networks/WiFi by routing through relay servers
 * just like chat messages are routed through the backend server.
 */
export const getFallbackICEServers = (): RTCIceServer[] => {
    console.warn('⚠️ Cloudflare TURN not configured - using FREE public TURN relay servers');

    return [
        // ==============================================
        // PRIMARY: Open Relay Project - MOST RELIABLE FREE TURN
        // 20GB free monthly, 99.999% uptime, global routing
        // https://openrelayproject.org
        // ==============================================
        {
            urls: [
                // UDP - fastest when available
                'turn:openrelay.metered.ca:80',
                'turn:openrelay.metered.ca:443',
                // TCP - works through most firewalls
                'turn:openrelay.metered.ca:443?transport=tcp',
                // TURNS (TLS) - most secure, works through corporate firewalls
                'turns:openrelay.metered.ca:443?transport=tcp'
            ],
            username: 'openrelayproject',
            credential: 'openrelayproject'
        },

        // ==============================================
        // SECONDARY: Static Auth Open Relay (alternative endpoint)
        // ==============================================
        {
            urls: [
                'turn:staticauth.openrelay.metered.ca:80',
                'turn:staticauth.openrelay.metered.ca:443',
                'turn:staticauth.openrelay.metered.ca:443?transport=tcp',
                'turns:staticauth.openrelay.metered.ca:443?transport=tcp'
            ],
            username: 'openrelayproject',
            credential: 'openrelayproject'
        },

        // ==============================================
        // TERTIARY: Additional Free TURN servers
        // ==============================================
        {
            urls: [
                'turn:relay.metered.ca:80',
                'turn:relay.metered.ca:443',
                'turn:relay.metered.ca:443?transport=tcp',
                'turns:relay.metered.ca:443?transport=tcp'
            ],
            username: 'e8647b5ceaa79a74da696ac2',
            credential: 'SsL5dXcZoR1Fn0FU'
        },

        // ==============================================
        // STUN servers (for ICE candidate gathering - used as fallback)
        // ==============================================
        // Cloudflare Public STUN
        { urls: 'stun:stun.cloudflare.com:3478' },

        // Google Public STUN servers (high reliability)
        {
            urls: [
                'stun:stun.l.google.com:19302',
                'stun:stun1.l.google.com:19302',
                'stun:stun2.l.google.com:19302',
                'stun:stun3.l.google.com:19302',
                'stun:stun4.l.google.com:19302'
            ]
        },

        // Additional reliable STUN servers
        { urls: 'stun:global.stun.twilio.com:3478' },
        { urls: 'stun:stun.stunprotocol.org:3478' }
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
