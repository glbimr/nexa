# Fix Summary: Global Audio Persistence

## Issue
Users reported that audio would cut off when navigating away from the "Team Chat" module during an active call.
**Root Cause**: The audio playback logic was embedded inside `Communication.tsx`. When the user switched tabs (e.g., to Dashboard or Projects), `Communication.tsx` was unmounted by React, destroying the `<video>/<audio>` elements and terminating the audio stream playback.

## Fix Implemented
1.  **Global Audio Manager**:
    -   Created a new component `GlobalCallManager` in `App.tsx`.
    -   This component subscribes to the `remoteStreams` state from the global store.
    -   It renders a persistent, hidden `<audio>` element for every participant currently in the call.
    
2.  **App-Level Rendering**:
    -   Placed `<GlobalCallManager />` at the root level of `App.tsx` (inside `MainLayout`).
    -   This ensures audio players remain mounted and active regardless of which route or tab (Dashboard, Kanban, Chat) the user is viewing.

3.  **Echo Prevention**:
    -   Updated `Communication.tsx` to set `muted={true}` on the visual video players. This prevents double-audio (echo) since the global manager is now responsible for the sound.

## Verification
-   Rebuilt via `npm run build`.
-   Audio should now persist seamlessly while navigating through the entire application.
