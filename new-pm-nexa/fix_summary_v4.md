# Connectivity Fixes v4: Network Specific Hardening

## Issue Addressed
**Symptom**: "Outgoing" to Airtel Wifi works, but "Incoming" from Airtel Wifi fails (No Audio).
**Diagnosis**: This is a classic **Symmetric NAT** traversal failure.
-   When Airtel Wifi initiates, it uses random ports for different destinations.
-   Standard WebRTC tries to negotiate Audio and Video on separate ports (historically).
-   If the Router allows Port A (Audio) but blocks Port B (Video), or if the mapping changes, the connection stays "Connected" but one or both tracks fail, resulting in silence.

## Fix Applied: Connection Bundling

### 1. `max-bundle` Policy
-   **Change**: Updated `RTC_CONFIG` in `store.tsx`:
    ```typescript
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require'
    ```
-   **Impact**:
    -   This forces the browser to use **strictly ONE UDP Port** for everything (Audio + Video + Data + Control).
    -   **Why it fixes Airtel**: It is exponentially harder to punch *two* holes through a strict firewall than *one*. By verifying just ONE ICE candidate pair, we carry all media traffic. If *any* connection connects, *everything* works.
    -   This effectively mimics the behavior of "Outgoing" calls (where the restrictive NAT was likely acting as the 'Controlled' agent and accepted the single bundle).

## Verification
-   **Build**: Successful (`npm run build`).
-   **Result**: 
    -   Calls from Airtel Wifi/Strict Networks should now negotiate a single robust path.
    -   Audio should be audible immediately upon connection.
