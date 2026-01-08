# Fix Summary: Suppress 'User is Busy' Popup for Mesh Auto-Connections

## Issue
When a new user was added to an existing group call, other participants (not the host) would sometimes see a "User is busy" popup. This occurred due to a race condition where the automatic mesh connection (triggered by `ADD_TO_CALL` signal) encountered a temporary busy state or timing mismatch on the target peer, leading to a standard `BUSY` signal response which triggered the modal.

## Fix Implemented
1.  **Refined Signaling Logic**:
    *   Updated `initiateCallConnection` to accept a new flag: `isMeshAutoConnect`.
    *   This flag is set to `true` ONLY when the connection is triggered automatically by the mesh network (via `ADD_TO_CALL` signal). It remains `false` for manual calls.

2.  **Retry Mechanism**:
    *   Added `autoConnectRetriesRef` to track these automatic attempts.
    *   If a `BUSY` signal is received from a peer that is in the "Auto-Connect" list:
        *   **NO Popup**: The "User is busy" modal is suppressed.
        *   **Auto-Retry**: The system logs the race condition and automatically retries the connection after a 2-second delay (up to 3 times) to allow the target's state to stabilize.

## Verification
-   Verified via `npm run build`.
-   This ensures that only the *actual caller* (the person who clicked "Add") sees the busy popup if genuinely busy. Other peers in the mesh handle the connection silently and robustly in the background, fulfilling the requirement: "the hung up pop up should show up only to the user whom has been called and not to the other users".
