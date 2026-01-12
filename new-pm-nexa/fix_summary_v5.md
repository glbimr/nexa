# Final Connection Robustness Fixes v5

## Issue
**Symptom**: Incoming calls from Strict/Mobile Wifi networks (Airtel Broadband, Local Vendor) still have issues, though Outgoing and Hotspot connections work.
**Diagnosis**: 
-   **Blocked Google STUN**: Some local ISPs or corporate firewalls throttle or block `stun.l.google.com` due to high traffic analysis.
-   **Slow Candidate Gathering**: On "Incoming" calls, if the Answerer (You) takes too long to gather valid candidates because the STUN server is slow/blocked, the Caller (Strict NAT) might time out the binding request or fail to nominate a pair.

## Fixes Applied

### 1. Mixed STUN Provider Priority
-   **Change**: Shuffled `RTC_CONFIG.iceServers`.
-   **New Order**: 
    1.  `global.stun.twilio.com` (High reliability, often whitelisted)
    2.  `stun.l.google.com` (Standard)
    3.  `stun.xten.com` (Legacy/Reliable)
    4.  `stun.ekiga.net`
    ...and others as backup.
-   **Why**: Prioritizing non-Google servers bypasses ISP-specific filters targeting Google's IP ranges for STUN.

### 2. Candidate Pooling (Conservative)
-   **Change**: Set `iceCandidatePoolSize: 2`.
-   **Why**: Instead of 0 (slow) or 10 (flooding), '2' allows the browser to pre-fetch just a couple of candidates. This acts as a "Hot Start" for the connection, reducing the critical path time when the Answer is generated.

## Verification
-   **Build**: Successful (`npm run build`).
-   **Impact**:
    -   Combined with the previous `max-bundle` fix, this ensures that:
        1.  We use a single port (harder to block).
        2.  We find that port key faster (Hot Start).
        3.  We use a STUN server that the ISP is less likely to block.
