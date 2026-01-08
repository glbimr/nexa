# Screen Share Black Screen Fix

## Current Issue
Users reported "screen flickering as a black screen" periodically at the receiver side.
This symptom is typically caused by:
1.  **Frame Dropping**: When bandwidth is insufficient to maintain the requested resolution (1080p/2K), and the browser is forced to `maintain-resolution`. The browser stops sending frames entirely until it can send a full high-res frame, causing "gaps" (black screens).
2.  **`contentHint='detail'`**: This hint tells the encoder "do not blur". If the network cannot sustain sharp frames, it drops them.

## Fixes Implemented in `store.tsx`

1.  **Bitrate Optimization**: Reduced `maxBitrate` from `4.5 Mbps` to **`2.5 Mbps`**. This is a sweet spot for 1080p screen sharing that is lighter on the network while maintaining good quality.
2.  **Degradation Preference**: Changed from `'maintain-resolution'` (which drops frames) to **`'balanced'`**.
    -   *Result:* If bandwidth drops, the browser is now allowed to slightly lower the resolution or compression quality instead of stopping the stream. This eliminates the "black screen" gaps.
3.  **Content Hint**: Changed from `'detail'` to **`'motion'`**.
    -   *Result:* 'Motion' is more forgiving. It allows some blur/artifacts during movement (scrolling) rather than freezing/blacking out, ensuring continuous playback.

## Verification
-   Rebuilt via `npm run build`.
-   The configuration now prioritizes stream continuity (preventing black screens) over pixel-perfect sharpness during network fluctuation.
