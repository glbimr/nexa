# 🛠️ TURN Connection Debugger

If your calls are not connecting (stuck on "Connecting..."), follow these steps to debug.

## Step 1: Check Your Config (Console)

1. Open your app in Google Chrome.
2. Open **DevTools** (`F12` or Right Click -> Inspect).
3. Click on the **Console** tab.
4. Try to make a call.
5. Look for this specific log message:

```
Using ICE Servers: [And connection details will be here]
```

If you see `turn:staticauth.openrelay.metered.ca`, your config is correct! ✅

---

## Step 2: Test TURN Connectivity (Console Script)

Paste this entire script into your browser Console and press Enter. It will test if the TURN server is reachable from your network.

```javascript
(async function testTurn() {
  console.log("🧪 Starting TURN Connectivity Test...");
  
  const config = {
    iceServers: [
      {
        urls: "turn:staticauth.openrelay.metered.ca:80?transport=tcp",
        username: "openrelayproject",
        credential: "openrelayprojectsecret"
      }
    ]
  };

  const pc = new RTCPeerConnection(config);
  
  pc.onicecandidate = (e) => {
    if (!e.candidate) {
      console.log("✅ ICE gathering complete");
      return;
    }
    
    // Check if it's a relay candidate (TURN)
    if (e.candidate.candidate.includes("relay")) {
      console.log("🎉 SUCCESS! TURN candidate gathered:", e.candidate.candidate);
      console.log("🚀 Your network allows TURN connections!");
    } else {
      console.log("ℹ️ Gathered local/stun candidate:", e.candidate.type);
    }
  };

  try {
    // Create a data channel to trigger ICE gathering
    pc.createDataChannel("test");
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    console.log("⏳ Gathering candidates... (wait 5s)");
  } catch (err) {
    console.error("❌ Test failed:", err);
  }
})();
```

**Expected Result**:
You should see: `🎉 SUCCESS! TURN candidate gathered...`

**If you don't see SUCCESS**:
- Your network firewall might be blocking the connection.
- Try a different network (mobile hotspot) to verify.

---

## Step 3: Verify Signaling

If Step 2 works (you see SUCCESS), but calls still don't connect:

1. Check if the other user actually received the call?
2. Are you using two different browsers? (You can't call yourself in the same tab!)
3. Look for "Signaling Error" in the console.

---

## Need to force Cloudflare?

If the public TURN server is blocked on your network, you MUST use Cloudflare or Twilio.

1. Get Cloudflare keys (see previous guides).
2. Add to `.env.local`.
3. Restart dev server.
