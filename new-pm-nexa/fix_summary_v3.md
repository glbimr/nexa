# Audio & Connection Fixes v2

## Issues Addressed
1.  **Asymmetric Connection Failure**: User reported that when "Other" calls "Me", neither can hear. But "Me" calls "Other" works.
    -   This pointed to a failure in the **Answer** flow or a race condition when the Callee accepts.
2.  **Audio Cutouts**: Suspected glare or resource fighting.

## Changes Made

### 1. Stability: Removed Forced Renegotiation
-   **Problem**: In `acceptIncomingCall`, the code had a `setTimeout(() => renegotiate(), 1000)`.
-   **Why it failed**: If the Callee accepts, establishes a connection, and then 1 second later sends a *new* Offer (Renegotiation) back to the Caller (who might be on a strict network or also trying to stabilize), it caused a "Glare" condition where the signaling states conflicted, often breaking the media path.
-   **Fix**: Removed this timeout. We now rely on the standard initial Answer to set up media.

### 2. Media Hygiene: Explicit Answer Constraints
-   **Problem**: `createAnswer()` without options might default to `recvonly` or inactive if the Offer didn't match perfectly or if tracks had slight delays.
-   **Fix**: Updated `acceptIncomingCall` to use `createAnswer({ offerToReceiveAudio: true, offerToReceiveVideo: true })`. This explicitly tells the WebRTC stack "I want to receive audio/video", pushing the SDP to `sendrecv`.

### 3. Network Optimization
-   **Problem**: `iceCandidatePoolSize: 10` is aggressive. On mobile networks (Airtel 4G/Wifi), opening 10 port pairs proactively can triggering flooding protection or simply fail to gather candidates effectively.
-   **Fix**: Commented out the pool size setting to let the browser manage candidate gathering naturally.

### 4. Audio Playback
-   **Fix**: Updated `CallAudioPlayer` to ensure volume is set to 1.0 (Max) every time the stream reference updates.

## Verification
-   **Build**: Successful.
-   **Expectation**:
    -   Incoming calls should now connect just as reliably as outgoing calls.
    -   No silence/ audio "dead connection" states.
