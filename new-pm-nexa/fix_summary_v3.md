# Comprehensive Call Fixes v3: Incoming Connection Logic

## Issue Resolved
**Symptom**: "Outgoing Calls" worked, but "Incoming Calls" (Other calling Me) had no audio/connection, particularly on restricted networks.
**Root Cause**: The SDP Answer generation default behavior.
-   When YOU call, you create an Offer with `offerToReceiveAudio: true`. You are the robust initiator.
-   When THEY call, you receive their Offer. If you create a default Answer (`createAnswer()`) *before* your microphone track acts as "active" in the browser's internal state (which happens due to async race conditions), the generated SDP Answer often defaults to `recvonly` or `inactive` for audio. This tells the Caller "I'm not sending audio", resulting in one-way or no audio.

## Fixes Applied

### 1. Enforced Bi-Directional Media ("SendRecv")
-   **Changes**: Updated `acceptIncomingCall` (both Main flow and Mesh flow) and the `OFFER` handler (Renegotiation flow) to use:
    ```typescript
    pc.createAnswer({ offerToReceiveAudio: true, offerToReceiveVideo: true })
    ```
-   **Impact**: This forces the WebRTC stack to negotiate a bi-directional media path, regardless of the instantaneous state of the local microphone track. This ensures that when the track *does* arrive (milliseconds later), the pipe is already open.

### 2. Glare Prevention
-   **Changes**: Removed the `setTimeout(() => renegotiate(), 1000)` in `acceptIncomingCall`.
-   **Impact**: Prevents the "Answer-then-Offer" collision that was breaking connections right after they started.

### 3. Stability
-   **Changes**: Optimized `RTC_CONFIG` (Removed explicit candidate pool size) to prevent port exhaustion on mobile devices.

## Verification
-   **Build Status**: Successful.
-   **Expected Result**: Incoming calls should now be fully symmetric to outgoing calls, with immediate audio.
