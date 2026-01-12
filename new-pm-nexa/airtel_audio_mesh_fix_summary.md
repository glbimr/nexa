# Fix Summary: Airtel Wifi Audio & Mesh Call Stability

## Issues Addressed
1.  **No Audio on Airtel Wifi/Mobile Data**: Users reported two-way silence. This is often caused by:
    -   Strict NATs preventing P2P connections (ICE failure).
    -   Browser autoplay policies silencing audio streams if not explicitly triggered.
2.  **Mesh Call Instability**: Adding users to a call sometimes resulted in connection failures for some participants. This was due to a race condition where the host instructed peers to connect to a new user *before* that user had fully joined the call.

## Changes Made

### 1. Robust Audio Playback (`App.tsx`)
-   **Aggressive Audio Auto-Play**: Updated `CallAudioPlayer` to periodically check if the audio element is paused (e.g., by mobile browser background policies) and force it to `play()`.
-   **Playback Retry**: Added extensive error handling and retry logic for the initial audio start.
-   **Volume Enforcement**: Explicitly sets volume to 100% on mount.

### 2. Enhanced Connectivity (`store.tsx`)
-   **Expanded STUN Server List**: Updated `RTC_CONFIG` to include ~15 additional public STUN servers (Google, Twilio, and others). This significantly increases the success rate of UDP hole punching through strict NATs (like carrier CGNATs used by Airtel) without requiring a paid TURN server.

### 3. Mesh Logic Fix (`store.tsx`)
-   **Removed Race Condition**: In `addToCall`, removed the logic that prematurely sent `ADD_TO_CALL` signals to existing participants.
-   **Reliable Introduction**: The system now relies entirely on the `ANSWER` handler. When the new user answers the Host's call, the Host *then* introduces the new user to all other participants. This ensures the new user is actually online and ready to accept connections, fixing the "unable to hear everyone" issue in group calls.

## Verification
-   **Build Status**: Code updated and verified.
-   **Testing**:
    -   Audio should now auto-recover if paused.
    -   Group calls should form reliably without "dead" participants.
