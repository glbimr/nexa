# 🕵️‍♂️ Debugging Guide: Calls & Connection Issues

Since you are experiencing issues specifically with **Voice/Video Calls not connecting** (while chat works), the problem is likely at the **WebRTC (Peer-to-Peer)** layer or the **Signaling (Handshake)** layer.

Here is how to check the "actual network logs" to diagnose the root cause.

---

## 🛠 Tool 1: The "Holy Grail" - WebRTC Internals
This is the **most important tool** for debugging connection failures. It shows you exactly what the browser is doing under the hood.

1.  **Open a new tab** in your browser.
2.  Type one of the following addresses:
    *   **Chrome/Brave**: `chrome://webrtc-internals`
    *   **Edge**: `edge://webrtc-internals`
    *   **Firefox**: `about:webrtc`
3.  Keep this tab **OPEN** while you attempt to make a call in the app.
4.  **Make a Call**. You will see green/red blocks appear in the Internals tab.

### **What to look for:**
*   **`iceConnectionState`**: This is the key status.
    *   `checking`: Still trying to find a path.
    *   `connected` / `completed`: Success!
    *   `failed` / `disconnected`: The firewall blocked the connection, or direct P2P failed.
*   **`iceGatheringState`**:
    *   If this stays stuck on `gathering`, your network might be blocking STUN requests (common in corporate VPNs).
*   **Packet Loss (Graphs)**: If connected but audio is silent, look at the graphs.
    *   `bitsReceivedPerSecond`: Is data actually flowing?
    *   `packetsLost`: High loss (red bars) means bad network quality.

---

## 🖥 Tool 2: Browser Console Logs
The application (`store.tsx`) already has built-in logs for critical call events.

1.  Right-click anywhere in the app -> **Inspect**.
2.  Go to the **Console** tab.
3.  **Filter** the log by typing these keywords in the "Filter" box:
    *   `"Signal"` or `"Sending signal"`
    *   `"ICE"` (Ice Candidates)
    *   `"Offer"` / `"Answer"`

### **Key Error Messages to watch:**
*   **"Connection to [User ID] timed out"**: The other side never responded (or never received the offer).
*   **"Device Error"**: Microphone permission denied.
*   **"Glare"**: Two users tried to call each other at the exact same millisecond.


---

## 📡 Tool 3: Supabase Signaling (Technically "Network Logs")
Since "Chat is working", we know Supabase is connected. But calls need specific **Realtime** messages to pass through.

1.  Open **Developer Tools** (F12).
2.  Go to the **Network** tab.
3.  Click on **WS** (WebSockets) in the filter bar.
4.  Look for a connection named `websocket` (domain: `...supabase.co`).
5.  Click it -> Go to **Messages** (or Frames).
6.  Trigger a call. You should see JSON messages flowing:
    *   **⬆️ Upload (Green)**: You sending an `OFFER`.
    *   **⬇️ Download (White)**: You receiving an `ANSWER` or `CANDIDATE`.

**Diagnosis**:
*   If you send an `OFFER` but **never receive** an `ANSWER`, the other user's browser might be throwing an error (check their Console).
*   If you see `CANDIDATE` messages flying back and forth but `iceConnectionState` (in Tool 1) stays "failed", it's a **NAT/Firewall** issue.

---

## 📝 Common Fixes

### 1. "It works on localhost but not on mobile/production"
*   **Cause**: You are likely behind a **Symmetric NAT** or Firewall.
*   **Solution**: WebRTC requires **TURN Servers** (Relay servers) for strict networks.
    *   *Check `store.tsx` implementation*: Currently, the app uses **Public STUN servers** (lines 104-124). These **only** tell you your IP; they do not relay traffic.
    *   *Fix*: If you are on a strict corporate network or 4G mobile hotspot, **Public STUN is not enough**. You need a paid TURN provider (e.g., Twilio, Xirsys, or self-hosted CoTurn).

### 2. "Connects but no audio"
*   **Cause**: The `<audio>` or `<video>` element is not "autoplaying" or attached correctly.
*   **Check**: Look at the Console. Browsers block Autoplay unless the user has interacted with the page.
