# Fix Summary: Call Waiting & Merging

## Issue
Previous behavior: If a user was in a call, a new incoming call would either conflict or be ignored improperly.
Requirement: 
1.  **Caller Side:** If calling a busy user, get a "User is busy" popup with options to "Wait" or "Hang Up".
2.  **Receiver Side:** If in a call and a new user calls, get a popup with options to:
    *   "Add to Current Call" (Mesh Merge)
    *   "End & Accept New"
    *   "Decline"

## Fix Implemented
1.  **Signaling Updates**:
    *   Added `BUSY` and `WAIT_NOTIFY` signal types to `types.ts`.
    *   Updated `store.tsx` signaling logic:
        *   If `receiver` is `isInCall`, they send `BUSY` back to `caller`.
        *   `caller` receives `BUSY` -> Shows `BusyCallModal`.
        *   If `caller` clicks "Wait" -> Sends `WAIT_NOTIFY` to `receiver`.
        *   `receiver` receives `WAIT_NOTIFY` -> Shows `IncomingCallOverlay` (modified for in-call state).

2.  **Caller UI (`BusyCallModal`)**:
    *   New modal in `App.tsx` displaying "User is busy" with "Hang Up" / "Wait" buttons.

3.  **Receiver UI (`IncomingCallOverlay`)**:
    *   Updated logic to detect `isInCall`.
    *   If true, renders a special variant with:
        *   **Add to Current Call**: Merges the new caller into the existing mesh network (`activeCallData` update + `renegotiate`).
        *   **End & Accept New**: Terminates old call, cleans up, then accepts new one.
        *   **Decline**: Rejects the new call logic.

4.  **Mesh Logic Refinement (`store.tsx`)**:
    *   Enhanced `acceptIncomingCall` to handle "Merging": re-uses the existing `localStream` instead of trying to grab a new one (preventing camera conflicts).
    *   Added logic to introduce the new peer to existing participants via `ADD_TO_CALL` signal (Mesh topology).

## Verification
-   Verified build success with `npm run build`.
-   Logic covers the complete flow: Caller Busy -> Wait -> Receiver Notified -> Receiver Adds/Switches.
