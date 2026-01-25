# Cloudflare TURN Setup Guide

This project now uses **Cloudflare's managed TURN service** instead of the previous metered.ca TURN servers. Cloudflare TURN provides:

- 🌍 **Global anycast routing** - Automatically connects to the nearest datacenter
- 🚀 **Better reliability** - Enterprise-grade infrastructure
- 💰 **Free tier** - 1,000 GB/month free, then $0.05/GB
- 🔒 **Secure** - Short-lived credentials with automatic expiration

## Table of Contents
1. [Setup Instructions](#setup-instructions)
2. [How It Works](#how-it-works)
3. [Testing](#testing)
4. [Troubleshooting](#troubleshooting)
5. [Pricing](#pricing)

---

## Setup Instructions

### Step 1: Create a Cloudflare TURN App

1. **Go to Cloudflare Dashboard**
   - Visit [https://dash.cloudflare.com/](https://dash.cloudflare.com/)
   - Navigate to **Calls** section in the sidebar
   
2. **Create a TURN App**
   - Click **"Create Application"** or **"Add TURN"**
   - Give your TURN app a name (e.g., "MyApp WebRTC TURN")
   - Click **"Create"**

3. **Get Your Credentials**
   - After creation, you'll see:
     - **TURN Key ID** (e.g., `abc123def456...`)
     - **API Token** (click "Show" to reveal)
   - Copy both values - you'll need them in the next step

### Step 2: Configure Environment Variables

1. **Open `.env.local` file** in your project root (already created for you)

2. **Add your Cloudflare credentials:**

```env
VITE_CLOUDFLARE_TURN_KEY_ID=your_turn_key_id_here
VITE_CLOUDFLARE_TURN_API_TOKEN=your_turn_api_token_here
```

3. **Replace** `your_turn_key_id_here` and `your_turn_api_token_here` with the actual values from Step 1

4. **Save the file**

⚠️ **IMPORTANT**: Never commit `.env.local` to version control. It's already in `.gitignore`.

### Step 3: Restart Your Dev Server

```bash
# Stop the current dev server (Ctrl+C)
# Then restart it
npm run dev
```

---

## How It Works

### Architecture Overview

```
┌─────────────┐
│   Your App  │
│   (React)   │
└──────┬──────┘
       │
       │ 1. Fetch credentials on startup
       ▼
┌──────────────────────────────┐
│ Cloudflare TURN API          │
│ rtc.live.cloudflare.com/v1/  │
└──────┬───────────────────────┘
       │
       │ 2. Returns short-lived credentials
       │    (24-hour TTL)
       ▼
┌──────────────────────────────┐
│ WebRTC Peer Connection       │
│ Uses TURN when needed        │
└──────┬───────────────────────┘
       │
       │ 3. Relays traffic through
       │    nearest CF datacenter
       ▼
┌──────────────────────────────┐
│  turn.cloudflare.com         │
│  (Global Anycast Network)    │
└──────────────────────────────┘
```

### Credential Caching

- Credentials are fetched once on app startup
- Cached for 24 hours (with 5-min refresh buffer)
- Automatically refreshed before expiry
- Falls back to STUN-only if fetch fails

### Files Modified

1. **`cloudflare-turn-config.ts`** - Credential management module
2. **`store.tsx`** - WebRTC configuration updated
3. **`.env.local`** - Environment variables
4. **`vite-env.d.ts`** - TypeScript definitions

---

## Testing

### 1. Check Console Logs

After starting the app, you should see:

```
✅ Cloudflare TURN credentials fetched successfully
   URLs: turn:turn.cloudflare.com:3478?transport=udp, ...
   Expires in: 23.9 hours
📞 Cloudflare TURN initialized
```

### 2. Test a Call

1. Open your app in two different browser windows/devices
2. Make a call between them
3. Open browser DevTools → Console
4. Look for ICE candidate logs:

```
[ICE] Candidate gathered for user123: relay turn:turn.cloudflare.com...
```

The keyword **`relay`** confirms TURN is being used.

### 3. Check ICE Connection State

In the console, you should see:

```
[ICE] Connection state: connected
[ICE] Gathering state: complete
```

### 4. Network Inspection

1. Open DevTools → Network tab
2. Make a call
3. You should see a POST request to:
   ```
   https://rtc.live.cloudflare.com/v1/turn/keys/.../credentials/generate
   ```
4. Response should be `200 OK` with ICE servers configuration

---

## Troubleshooting

### ⚠️ "Cloudflare TURN credentials not configured"

**Problem**: Environment variables not set or not loaded

**Solutions**:
- Verify `.env.local` exists in project root
- Check variable names match exactly: `VITE_CLOUDFLARE_TURN_KEY_ID` and `VITE_CLOUDFLARE_TURN_API_TOKEN`
- Restart dev server after modifying `.env.local`
- Ensure values don't have quotes (just paste the raw tokens)

### ❌ "Cloudflare TURN API error 401"

**Problem**: Invalid or expired API token

**Solutions**:
- Go back to Cloudflare Dashboard → Calls
- Click on your TURN app
- Generate a new API token if needed
- Update `.env.local` with the new token

### ❌ "Cloudflare TURN API error 404"

**Problem**: Invalid TURN Key ID

**Solutions**:
- Double-check the TURN Key ID from Cloudflare Dashboard
- Make sure you copied the complete ID (no truncation)

### 🔄 Falling Back to STUN

**Symptom**: Console shows "Using fallback STUN servers - TURN relay not available"

**Impact**:
- Calls will still work on many networks
- May fail on restrictive corporate/WiFi networks
- No relay server available for symmetric NAT scenarios

**Solution**: Fix the Cloudflare TURN setup to enable full relay support

### 🚫 Calls Not Connecting

**Debugging Steps**:

1. **Check ICE candidates**:
   - Open DevTools Console
   - Look for `[ICE] Candidate gathered` logs
   - You should see `relay` type candidates

2. **Verify ICE gathering completes**:
   ```
   [ICE] Gathering state: complete
   ```

3. **Check connection state**:
   - Should transition: `new → checking → connected`
   - If stuck on `checking`, TURN might not be working

4. **Test with WebRTC diagnostic tool**:
   - Visit [https://test.webrtc.org/](https://test.webrtc.org/)
   - Run connectivity test with your Cloudflare TURN credentials

---

## Pricing

### Cloudflare TURN Pricing

| Tier | Monthly Allowance | Overage Cost |
|------|-------------------|--------------|
| Free | 1,000 GB | $0.05/GB |

### Estimating Usage

**Typical bandwidth per minute**:
- Audio-only call: ~1-2 MB/min
- Video call (720p): ~20-30 MB/min

**Example Calculations**:
- 100 hours of audio calls/month: ~12 GB → **Free**
- 50 hours of video calls/month: ~90 GB → **Free**
- 500 hours of video calls/month: ~900 GB → **Free**

**You're unlikely to exceed the free tier** unless you have hundreds of simultaneous video calls.

### When Does TURN Actually Get Used?

TURN relay (the thing that costs bandwidth) is only used when:
- Direct peer-to-peer connection fails
- Users are behind symmetric NAT
- Corporate firewalls block direct connections

**Most calls will use direct connection (free)** and only fall back to TURN when necessary.

---

## Alternative: Without Cloudflare TURN

If you prefer not to use Cloudflare TURN, the app will automatically fall back to public STUN servers. This means:

✅ **Still Works**: Calls will connect in most scenarios
❌ **May Fail**: On restrictive networks (corporate WiFi, symmetric NAT)

To disable Cloudflare TURN entirely, simply don't set the environment variables. The app will log:

```
⚠️ Cloudflare TURN credentials not configured
⚠️ Using fallback STUN servers - TURN relay not available
```

---

## Security Notes

### Why Environment Variables?

The API token is **sensitive** and should never be exposed in client-side code. However, since we're using Vite, we're using `VITE_` prefixed variables which get bundled into the client.

### More Secure Alternative (Production)

For production apps, consider:

1. **Backend API Proxy**: Create a backend endpoint that fetches TURN credentials
2. **Keep tokens server-side**: Never expose Cloudflare API token to clients
3. **Rate limiting**: Prevent credential abuse

Example backend endpoint:
```javascript
// server.js
app.post('/api/turn/credentials', async (req, res) => {
  const response = await fetch(
    `https://rtc.live.cloudflare.com/v1/turn/keys/${TURN_KEY_ID}/credentials/generate`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TURN_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ ttl: 86400 })
    }
  );
  
  const data = await response.json();
  res.json(data);
});
```

Then update `cloudflare-turn-config.ts` to call your backend instead of Cloudflare directly.

---

## Additional Resources

- 📚 [Cloudflare TURN Documentation](https://developers.cloudflare.com/realtime/turn/)
- 🎓 [WebRTC ICE/STUN/TURN Explained](https://webrtc.org/getting-started/peer-connections)
- 🔧 [WebRTC Troubleshooting Tool](https://test.webrtc.org/)

---

## Support

If you encounter issues:

1. Check the [Troubleshooting](#troubleshooting) section
2. Review console logs for error messages
3. Verify Cloudflare Dashboard shows your TURN app is active
4. Test with the WebRTC diagnostic tools

For Cloudflare-specific issues, visit: [Cloudflare Community](https://community.cloudflare.com/)

---

**Happy Calling! 📞**
