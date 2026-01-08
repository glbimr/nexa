# Screen Share Optimization Summary

## Feature Updates
1.  **Mobile Restriction**: Implemented a check in `Communication.tsx`. If a user on a mobile device (Android/iOS) attempts to share their screen, they now receive a popup: *"Screen sharing coming soon for mobile devices"* instead of a broken experience.

## Performance & Quality Fixes (Flicker & Glitch Reduction)
1.  **High-Resolution Constraints**: Updated `getDisplayMedia` in `store.tsx` to request:
    -   `ideal: 1920x1080` (Full HD)
    -   `max: 2560x1440` (2K)
    -   This prevents the browser from aggressively downscaling the stream, which was a source of "glitches" (blurriness).
2.  **Content Hint 'Detail'**: Set `contentHint = 'detail'`.
    -   *Why?* This instructs the WebRTC encoder to prioritize **resolution/sharpness** over frame rate.
    -   *Benefit:* Text and UI elements remain crisp and readable (no "glitchy" compression artifacts), even if the frame rate drops slightly during network congestion. Previously, it might have been set to 'motion' or default, causing blurriness on static text.
3.  **Flicker Reduction (Make-Before-Break)**: Refined the track switching logic.
    -   The new video stream is created *before* stopping the old camera stream.
    -   The state updates are batched closer to the track replacement to minimize the time window where the UI might show a black screen.
4.  **Enforced `maintain-resolution`**: The `degradationPreference` on the sender is explicitly set to `maintain-resolution`. This is critical for preventing the "pixels getting huge" glitch when bandwidth is limited.

## Verification
-   **Build Status**: The project has been rebuilt with `npm run build`.
-   **Code Path**: The changes are isolated to the screen sharing initiation logic in `store.tsx` and the UI trigger in `Communication.tsx`.
