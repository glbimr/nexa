# Fix Summary: Cancel Call Wait Logic

## Issue
When a caller encountered a "User is busy" state and clicked "Hang Up" (instead of "Wait"), the call attempt was not fully canceled. The local media streams (camera/mic) remained active, and the peer connection was not properly closed, leaving the app in a "hanging" state.

## Fix Implemented
Updated `cancelCallWait` in `store.tsx` to perform a proper cleanup:
1.  **Peer Connection**: Identifies the specific peer connection associated with the busy user and closes it immediately.
2.  **Resource Cleanup**:
    *   Checks if there are any *other* active participants in the call.
    *   **If 1:1 Call**: Triggers `cleanupCall()`, which stops all local media streams (camera/mic), clears all state, and resets the interface.
    *   **If Group Call**: Only removes the busy participant from the active list, allowing the active call to continue with other peers.

## Verification
-   Verified via `npm run build`.
-   This ensures that clicking "Hang Up" on the busy dialog essentially behaves like a standard "End Call" action for that specific attempt.
