# Fix Summary: Robust Call Cancellation

## Issue
Users reported that clicking "Hang Up" on the "User is busy" modal didn't always return them to the normal chat interface, potentially leaving the app in a confusing "Connecting" state. This likely happened if the peer connection logic had a mismatch (e.g., call hadn't fully initialized properly), meaning simply checking connection count wasn't enough.

## Fix Implemented
Refined `cancelCallWait` in `store.tsx` to handle the cancellation more aggressively and reliably:
1.  **Source of Truth**: Instead of relying on `peerConnections` count (which can be desynchronized), it now checks `activeCallData` (the source of truth for "Who am I trying to call?").
2.  **Logic**:
    *   It filters the busy user out of the active participants list.
    *   **Crucially**: If the list becomes empty (which is always true for a 1:1 call), it forces a `cleanupCall()`.
    *   `cleanupCall()` resets all flags (`isInCall = false`), stops all media, and guarantees the UI reverts to the standard view.

## Verification
-   Verified via `npm run build`.
-   This ensures that "Hang Up" means "Abort attempt completely" for single-user calls, adhering to the user's requirement to "get back to normal team chat page".
