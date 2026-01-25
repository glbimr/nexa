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
 * Priority:
 * 1. Cloudflare TURN (if configured in .env)
 * 2. Metered.ca Open Relay (Free Public TURN) - Default
 */
export const fetchCloudflareICEServers = async (): Promise<RTCIceServer[]> => {
    const now = Date.now();

    // Return cached credentials if still valid
    if (cachedICEConfig && credentialsExpiry > now + 5 * 60 * 1000) {
        return cachedICEConfig;
    }

    const TURN_KEY_ID = import.meta.env.VITE_CLOUDFLARE_TURN_KEY_ID;
    const TURN_API_TOKEN = import.meta.env.VITE_CLOUDFLARE_TURN_API_TOKEN;

    // 1. If Cloudflare is NOT configured, use the Free Open Relay (Default)
    if (!TURN_KEY_ID || !TURN_API_TOKEN || TURN_KEY_ID.includes('your_turn_key')) {
        console.log('Using Free Open-Source TURN Relay (Metered.ca)');
        return getOpenRelayServers();
    }

    // 2. Otherwise try to fetch Cloudflare credentials
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

        if (!response.ok) {
            throw new Error(`API Error ${response.status}`);
        }

        const data: CloudflareICEServers = await response.json();

        // Combine Cloudflare with Open Relay for maximum reliability
        cachedICEConfig = [
            {
                urls: data.iceServers.urls,
                username: data.iceServers.username,
                credential: data.iceServers.credential
            },
            ...getOpenRelayServers()
        ];

        credentialsExpiry = now + (86400 - 300) * 1000;
        return cachedICEConfig;

    } catch (error) {
        console.warn('Cloudflare fetch failed, using Open Relay default:', error);
        return getOpenRelayServers();
    }
};

/**
 * The Free Open Relay Configuration
 * Provided by the Metered.ca Open Relay Project
 */
export const getOpenRelayServers = (): RTCIceServer[] => {
    return [
        {
            urls: [
                'turn:staticauth.openrelay.metered.ca:80',
                'turn:staticauth.openrelay.metered.ca:443',
                'turn:staticauth.openrelay.metered.ca:443?transport=tcp',
                'turns:staticauth.openrelay.metered.ca:443?transport=tcp' // Secure TLS
            ],
            username: 'openrelayproject',
            credential: 'openrelayprojectsecret'
        },
        {
            urls: [
                'stun:stun.l.google.com:19302',
                'stun:stun1.l.google.com:19302'
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
