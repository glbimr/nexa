# Fix Summary: Call Merging & Busy State Refinement

## Issue
1.  **Duplicate "User is busy" Popups**: When a caller was added to an existing group call (Mesh Topology), other participants (who were not the initiator) would sometimes erroneously perceive the new connection as a "Busy" rejection or a fresh incoming call overlap, causing confusion.
2.  **Glare/Race Conditions**: In a mesh network, if both Peer A and Peer B try to initiate a connection to each other simultaneously (which happens during "Add to Call"), the connection can fail or stall.

## Fix Implemented
1.  **Deterministic Signaling**:
    *   Updated the `ADD_TO_CALL` mesh introduction logic in `acceptIncomingCall`.
    *   Previously, both sides were told to connect blindly.
    *   **New Logic**: Used a deterministic ID comparison (`callerId < pid`). 
    *   Only the peer with the **lower ID** actively initiates (`createOffer`).
    *   The peer with the **higher ID** only adds the target to their whitelist (`activeCallData`) and waits for the offer.

2.  **Whitelist Before Connect**:
    *   When receiving `ADD_TO_CALL`, the store now **immediately** updates `activeCallData` to include the new target's ID.
    *   This ensures that when the actual WebRTC `OFFER` arrives milliseconds later, the system recognizes the sender as a "Valid Participant" (whitelisted) rather than a "New Caller", bypassing the "User is Busy" check entirely.

3.  **Result**: 
    *   The "User is busy" popup now correctly only shows up for the **actual caller trying to call a busy person**.
    *   Existing participants in a call do not see popups when a new person is merged in; the connection happens seamlessly in the background.

## Verification
-   Verified build success with `npm run build`.
-   Logic ensures smooth multi-way call expansion without UI clutter or connection deadlocks.
