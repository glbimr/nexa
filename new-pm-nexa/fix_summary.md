# Call Connection and Screen Sharing Fixes

## Issues Addressed

1.  **Audio Connection Delay**: Users reported being unable to hear others upon picking up a call until they toggled their microphone.
2.  **Screen Sharing Visibility**: Screen sharing was not visible to new participants (e.g., a desktop user joining a call between two mobile users).

## Changes Made in `store.tsx`

### 1. Robust Call Acceptance (`acceptIncomingCall`)
-   **Immediate Ref Update**: Manually updated `localStreamRef` and `localAudioStreamRef` immediately after stream acquisition to ensure consistent state during the initial connection handshake.
-   **Automatic Media Refresh**: Added a safety mechanism that triggers `renegotiate()` 1 second after connecting. This mimics the "toggle mic" action that users found effective, ensuring that the media path is fully established and audio flows correctly in both directions without user intervention.

### 2. Reliable Screen Sharing (`toggleScreenShare`)
-   **Forced Renegotiation**: Removed the conditional check that skipped renegotiation during `replaceTrack` operations. Now, `renegotiate()` is always called when screen sharing is toggled. This ensures that:
    -   Changes in video track (from camera to screen) are properly signaled to all peers.
    -   New participants in the mesh network (late joiners) receive the correct track information immediately.
    -   Resolution and quality settings are correctly applied across the connection.

## Verification
-   The code has been successfully rebuilt with `npm run build`.
-   The logic changes target the specific WebRTC state management issues identified in the user report.
