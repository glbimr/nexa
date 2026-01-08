# Fix Summary: Auto-Navigate to Call Screen

## Issue
When a user accepted an incoming call while browsing a different module (e.g., Dashboard or Projects), the background call logic would start, but the UI would remain on the current page. The user had to manually navigate to the "Chat" tab to see the video grid and call controls.

## Fix Implemented
Updated `acceptIncomingCall` in `store.tsx` to automatically switch the active tab:
1.  **State Update**: Added `setActiveTab('chat')` immediately after setting `setIsInCall(true)`.
2.  **Effect**:
    *   As soon as the "Accept" button is clicked on the incoming call overlay, the application routes the user directly to the Communication module.
    *   This ensures the user immediately sees the video interface, controls, and other participants without extra clicks.

## Verification
-   Verified via `npm run build`.
-   Logic ensures seamless transition from "Notification" to "Active Engagement".
