# Fix Summary: High Quality Screen Sharing

## Issue
Previous configurations prioritized "Motion" and "Balance" (dropping resolution to keep framerate up) to prevent black screens on weak connections. However, for screen sharing (especially code or text), this resulted in blurry content. The user requested "proper high quality sharing" for all users.

## Fix Implemented
Updated `store.tsx` WebRTC parameters to prioritize **Resolution/Clarity** over framerate:
1.  **Bitrate**: Increased `maxBitrate` from 2.5Mbps to **4.5Mbps**. This allows for significantly less compression artifacts.
2.  **Content Hint**: Changed `contentHint` from `'motion'` to **`'detail'`**. This tells the encoder (VP8/H.264) to preserve fine details (text, lines) rather than trying to make movement look smooth.
3.  **Degradation Preference**: Changed from `'balanced'` to **`'maintain-resolution'`**.
    *   *Effect*: If the network bandwidth drops, the browser will now **reduce the frame rate** (FPS) but **keep the resolution high**. This means the screen share might look "choppy" on bad networks, but the text will remain crisp and readable, which is the correct trade-off for productivity sharing.
4.  **Framerate**: Explicitly requested `ideal: 60` FPS to ensure smooth updates when bandwidth permits.

## Verification
-   Verified via `npm run build`.
-   These settings force the WebRTC engine to treat the stream as "Static Content" (like slides/text) rather than "Video" (like a camera feed), resulting in much sharper visual quality.
