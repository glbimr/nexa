# Fix Summary: Multi-User Audio and Screen Sharing

## Issues Addressed
1.  **New User Audio Blockage**: A new user joining a call (e.g., the 3rd participant) could not listen to audio until they manually toggled their microphone.
2.  **Screen Sharing Logic**: Screen sharing visibility was inconsistent for late joiners.

## Technical Root Cause
The root cause of the audio issue was a "stale closure" problem in the `renegotiate` function.
-   When `acceptIncomingCall` ran, it updated the `localStream` state variable.
-   However, the `renegotiate` function (called shortly after via `setTimeout`) captured the *old* value of `localStream` (which was `null` or undefined) from the closure scope of the previous render.
-   Consequently, `renegotiate()` effectively returned early without renegotiating, leaving the connection in a state where audio wasn't fully established for the new leg.
-   Clicking "Mic" fixed it because `toggleMic` triggered a fresh state update and a subsequent valid renegotiation.

## Changes Implemented in `store.tsx`

### 1. Robust `renegotiate` Function
-   Updated `renegotiate` to check **`localStreamRef.current`** (a mutable ref) in addition to the state variable.
-   This ensures that even if the state update hasn't propagated to the closure yet, `renegotiate` sees the valid stream object stored in the ref and proceeds with the SDP Offer creation.

### 2. Immediate Ref Updates
-   In `startGroupCall` and `initiateCallConnection`: Added immediate updates Update `localStreamRef.current` and `localAudioStreamRef.current` immediately after acquiring `getUserMedia`.
-   This guarantees that any subsequent functions (like `renegotiate` or `createPeerConnection`) have access to the latest stream instance without waiting for a React re-render cycle.

### 3. Usage of Refs in `initiateCallConnection`
-   Changed `initiateCallConnection` to prefer `localStreamRef.current` over `localStream`. This prevents the "Add to Call" flow (Mesh networking) from trying to attach a null stream if the state update is lagging.

## Verification
-   The code has been rebuilt successfully.
-   The logic strictly enforces using Refs for synchronous access to critical MediaStream objects, which is the standard fix for stale closure issues in React `useEffect`/callback chains involving WebRTC.
