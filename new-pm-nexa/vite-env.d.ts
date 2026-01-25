/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_CLOUDFLARE_TURN_KEY_ID: string;
    readonly VITE_CLOUDFLARE_TURN_API_TOKEN: string;
    // Add other env variables as needed
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
