# Quick Start: Cloudflare TURN Setup

## TL;DR - 3 Steps to Enable Cloudflare TURN

### 1️⃣ Get Cloudflare Credentials

1. Go to: https://dash.cloudflare.com/
2. Navigate to: **Calls** → **Create Application**
3. Copy your **TURN Key ID** and **API Token**

### 2️⃣ Add to .env.local

Open `.env.local` and replace the placeholder values:

```env
VITE_CLOUDFLARE_TURN_KEY_ID=your_actual_turn_key_id_from_step_1
VITE_CLOUDFLARE_TURN_API_TOKEN=your_actual_api_token_from_step_1
```

### 3️⃣ Restart Dev Server

```bash
# Stop current server (Ctrl+C)
npm run dev
```

✅ **Done!** Check console for: `✅ Cloudflare TURN credentials fetched successfully`

---

## Verify It's Working

1. Open DevTools → Console
2. Look for:
   ```
   ✅ Cloudflare TURN credentials fetched successfully
   📞 Cloudflare TURN initialized
   ```

3. Make a call and check for relay candidates:
   ```
   [ICE] Candidate gathered: relay turn:turn.cloudflare.com...
   ```

---

## No Cloudflare Account Yet?

The app will work without Cloudflare TURN using fallback STUN servers.

**Console will show:**
```
⚠️ Cloudflare TURN credentials not configured
⚠️ Using fallback STUN servers
```

Calls will still work on most networks, but may fail on restrictive corporate/WiFi networks.

---

## Need Help?

- 📖 **Full Setup Guide**: See `CLOUDFLARE_TURN_SETUP.md`
- 🔧 **Troubleshooting**: See `CLOUDFLARE_TURN_SETUP.md#troubleshooting`
- 📊 **Migration Details**: See `MIGRATION_CLOUDFLARE_TURN.md`
