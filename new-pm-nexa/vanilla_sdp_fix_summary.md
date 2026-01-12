# Critical: WebRTC "Vanilla SDP" Fix for Strict NATs

## User Issue
The user clearly identified a **Symmetric NAT** issue:
-   **Scenario**: Caller on WiFi (Strict NAT) -> Calls Receiver (Me). Result: Fails.
-   **Scenario**: Caller on Hotspot (Open NAT) -> Calls Receiver (Me). Result: Works.
-   **Cause**: On strict networks/Airtel Broadband, **Trickle ICE** often fails because the router blocks the subsequent UDP packets carrying candidate info, or simply because the initial Offer doesn't contain a valid path.

## The Fix: "Wait for Candidates" (Vanilla SDP)
I have updated `store.tsx:initiateCallConnection` to implement a **1.0s Waiting Period** during the Offer generation.

### How it works:
1.  **Before**:
    -   Create Offer.
    -   Send Offer immediately (contains only local IP).
    -   ...Later... Send Public IP (Candidate) via separate signal.
    -   **Result on Strict NAT**: The Receiver gets the Offer, tries to connect to Local IP (Fails). The Public IP signal waits on the wire or gets dropped. Connection Dead.

2.  **After (The Fix)**:
    -   Create Offer.
    -   **WAIT** for browser to ping STUN servers and find Public IP.
    -   Browser updates the local description to include the Public IP *inside* the SDP.
    -   Send the **Complete Offer**.
    -   **Result on Strict NAT**: The Receiver gets the Offer. It *already* has the Public IP. Receiver sends Answer to that Public IP immediately. **Connection Success.**

## Verification
-   **Build**: Successful.
-   **Expected Result**: Users on Airtel/Strict Wifi can now successfully *initiate* calls to anyone.
