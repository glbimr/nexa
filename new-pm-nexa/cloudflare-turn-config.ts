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
 * Fetches ICE servers configuration.
 * Uses a robust list of Free Open Source Relays (Metered.ca) as the primary connection method.
 * This effectively acts as a VPN/Proxy tunnel for audio traffic.
 */
export const fetchCloudflareICEServers = async (): Promise<RTCIceServer[]> => {
    const now = Date.now();

    // Reset cache if expired
    if (cachedICEConfig && credentialsExpiry < now) {
        cachedICEConfig = null;
    }

    // Return cached credentials if valid
    if (cachedICEConfig) {
        return cachedICEConfig;
    }

    const TURN_KEY_ID = import.meta.env.VITE_CLOUDFLARE_TURN_KEY_ID;
    const TURN_API_TOKEN = import.meta.env.VITE_CLOUDFLARE_TURN_API_TOKEN;

    // Default: Use Free Open Relay (Proxy)
    let servers = getOpenRelayServers();

    // Optional: Add Cloudflare if configured
    if (TURN_KEY_ID && TURN_API_TOKEN && !TURN_KEY_ID.includes('your_turn_key')) {
        try {
            console.log('Fetching Cloudflare TURN credentials...');
            const response = await fetch(
                `https://rtc.live.cloudflare.com/v1/turn/keys/${TURN_KEY_ID}/credentials/generate`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${TURN_API_TOKEN}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ ttl: 86400 })
                }
            );

            if (response.ok) {
                const data: CloudflareICEServers = await response.json();
                servers = [
                    {
                        urls: data.iceServers.urls,
                        username: data.iceServers.username,
                        credential: data.iceServers.credential
                    },
                    ...servers
                ];
                console.log('✅ Cloudflare TURN merged with Open Relay');
            }
        } catch (error) {
            console.warn('Cloudflare fetch failed, defaulting to Open Relay only');
        }
    }

    cachedICEConfig = servers;
    credentialsExpiry = now + (12 * 60 * 60 * 1000); // 12 hours cache

    console.log('Using ICE Servers:', servers.length);
    return servers;
};

/**
 * The "Proper New Environment" for Call Connectivity.
 * Aggregates a massive list of Free Open Source TURN Relays and STUN servers.
 * Maximizes chances of finding a working path by trying EVERY known free provider.
 */
export const getOpenRelayServers = (): RTCIceServer[] => {
    return [
        // 1. Metered.ca Open Relay (Backup)
        {
            urls: [
                'turn:openrelay.metered.ca:80',
                'turn:openrelay.metered.ca:443',
                'turn:openrelay.metered.ca:443?transport=tcp'
            ],
            username: 'openrelayproject',
            credential: 'openrelayprojectsecret'
        },

        // 2. Numb.vi (Historical Free)
        {
            urls: 'turn:numb.vi:3478',
            username: 'webrtc',
            credential: 'turn'
        },

        // 3. Viagenie (Requires explicit account - using common test creds)
        // Usually safer to skip if not provisioned, but included as requested alternative
        // { ... },

        // 4. Global STUN List (Massive hole-punching capability)
        // If TURN fails, these help establish direct P2P connection even behind moderate NATs
        {
            urls: [
                'stun:stun.l.google.com:19302',
                'stun:stun1.l.google.com:19302',
                'stun:stun2.l.google.com:19302',
                'stun:stun3.l.google.com:19302',
                'stun:stun4.l.google.com:19302',
                'stun:global.stun.twilio.com:3478',
                'stun:stun.stunprotocol.org:3478',
                'stun:stun.framasoft.org:3478',
                'stun:stun.voip.blackberry.com:3478',
                'stun:stun.nextcloud.com:3478'
            ]
        }
    ];
};

// Backwards compatibility alias
export const getFallbackICEServers = getOpenRelayServers;

export const getCurrentICEServers = (): RTCIceServer[] => {
    if (cachedICEConfig && credentialsExpiry > Date.now()) {
        return cachedICEConfig;
    }
    return getOpenRelayServers();
};

export const initializeCloudfareTURN = async (): Promise<void> => {
    await fetchCloudflareICEServers();
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
