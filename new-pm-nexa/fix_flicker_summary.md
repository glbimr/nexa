# Fix Summary: Screen Share Black Flickering

## Issue
Users experienced intermittent "black screens" (flickering) on the receiver side during screen sharing.
This was caused by the application aggressively hiding the video element whenever the `muted` event was fired by the browser. In WebRTC, `muted` on a remote track often means "temporary packet loss" or "sender fell behind" (network stall), NOT that the user turned off the video.

## Fix
Updated `Communication.tsx`:
1.  **Ignore `muted` Event:** The logic for `setIsVideoMuted` now **only** checks `!videoTrack.enabled`. It ignores `videoTrack.muted`.
2.  **Remove `onmute` Listener:** Removed the event listener that set the video to hidden when a network stall occurred.

## Result
Now, if the network drops packets briefly:
-   **Before:** The screen would flash black (opacity 0).
-   **After:** The screen will freeze on the last received frame until new packets arrive (standard video behavior). This eliminates the annoying flickering black screen effect.

## Verification
-   Rebuilt via `npm run build`.
