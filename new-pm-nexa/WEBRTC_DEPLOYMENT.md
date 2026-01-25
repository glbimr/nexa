# WebRTC Call System - Production Deployment Guide

## Overview
This project uses WebRTC for peer-to-peer audio calls. It works across different networks using a combination of STUN and TURN servers.

## Current Configuration

### STUN/TURN Servers (Configured in `store.tsx`)
The application is configured to work with any IP address/network using the following free public servers:

1. **Google STUN Servers** (Primary for NAT traversal)
   - `stun:stun.l.google.com:19302`
   - `stun:stun1.l.google.com:19302`
   - `stun:stun2.l.google.com:19302`
   - `stun:stun3.l.google.com:19302`
   - `stun:stun4.l.google.com:19302`

2. **numb.viagenie.ca** (Free TURN relay for symmetric NAT)
   - STUN: `stun:numb.viagenie.ca`
   - TURN: `turn:numb.viagenie.ca`
   - Username: `webrtc@live.com`
   - Password: `muazkh`

3. **Bistri TURN Server** (Good for restrictive firewalls)
   - TURN: `turn:turn.bistri.com:80`
   - Username: `homeo`
   - Password: `homeo`

4. **Additional STUN Fallbacks**
   - Twilio: `stun:global.stun.twilio.com:3478`
   - stunprotocol.org: `stun:stun.stunprotocol.org:3478`

## How It Works Across Different Networks

### Connection Strategy
The app uses `iceTransportPolicy: 'all'` which means:
1. **First attempt**: Direct P2P connection (fastest, lowest latency)
2. **If P2P fails**: Use STUN to punch through NAT
3. **If STUN fails**: Use TURN relay servers (guaranteed to work)

### Supported Network Scenarios
✅ **Same WiFi Network** - Direct P2P connection
✅ **Different WiFi Networks** - STUN-assisted connection
✅ **Mobile to WiFi** - STUN or TURN relay
✅ **Corporate Firewall** - TURN relay
✅ **Symmetric NAT** - TURN relay
✅ **Cross-Country** - Works via any of the above methods

## Deployment Checklist

### 1. Environment Setup
No environment variables required for WebRTC to work. The STUN/TURN configuration is hardcoded for reliability.

### 2. Supabase Configuration
Ensure your Supabase project has:
- Realtime enabled (for signaling)
- Broadcast enabled on the `signaling` channel
- Database tables: users, messages, notifications, etc.

### 3. Vercel/Production Deployment
```bash
npm run build
# Deploy to Vercel or any static hosting
```

### 4. DNS/Domain Configuration
- HTTPS is **required** for `getUserMedia()` (microphone access)
- Use Vercel's auto-SSL or configure your own SSL certificate

### 5. Browser Permissions
Users must grant microphone permissions. The app handles this automatically.

## Troubleshooting Connection Issues

### Connection Status Indicators
- **Green (Connected)**: Successfully connected via P2P or relay
- **Red (Failed)**: Connection blocked - check ICE candidates in console

### Common Issues

#### 1. "Connection State: Failed"
**Cause**: All TURN servers failed or are blocked
**Solution**: 
- Check browser console for ICE candidates
- Verify network allows UDP/TCP on TURN ports (80, 443, 3478)
- Try from a different network

#### 2. "Autoplay Blocked"
**Cause**: Browser autoplay policy
**Solution**: 
- Click the "Tap to Enable Audio" button when it appears
- This is handled automatically by the updated UI

#### 3. "No Audio Heard"
**Possible Causes**:
- Microphone not enabled (check browser permissions)
- Audio output device issue (check system settings)
- Connection using TURN but relay is slow/congested

**Debug Steps**:
```javascript
// Open browser console and check:
1. ICE connection state: Look for "connected" or "completed"
2. Audio tracks: Should see "Received track from [userId] | Kind: audio"
3. Media streams: Check remoteStreams Map has entries
```

## Scalability Considerations

### Current Limitations (Free Tier)
- **numb.viagenie.ca**: Shared public TURN, may be slow under heavy load
- **Bistri**: Limited bandwidth on free tier
- **P2P works best**: Most calls should connect via P2P or STUN

### For Production Scale (>100 concurrent calls)
Consider:
1. **Paid TURN Service**: Tw 
2. **Self-Hosted TURN**: Run your own coturn server on VPS
3. **SFU/MCU**: For group calls (>3 participants), use a media server

### Recommended Paid TURN Services
1. **Twilio** - $0.0004/min per participant
2. **Xirsys** - $49/mo for 1GB bandwidth
3. **Metered TURN** - Pay-as-you-go pricing

## Testing Different Networks

### Local Testing
```bash
# Terminal 1: Run dev server
npm run dev

# Terminal 2: Use ngrok to test from mobile
npx ngrok http 5173
```

### Production Testing
1. Deploy to Vercel: `vercel --prod`
2. Test from:
   - Desktop browser (Chrome/Firefox)
   - Mobile browser (Safari/Chrome)
   - Different WiFi networks
   - Mobile data connection

### Verification Commands
```javascript
// In browser console during a call:
// 1. Check ICE candidates
pc = peerConnectionsRef.current.get('[userId]')
pc.getStats().then(stats => console.log(stats))

// 2. Check connection state
console.log(pc.iceConnectionState) // Should be "connected" or "completed"

// 3. View ICE candidates collected
pc.localDescription.sdp // Shows all gathered candidates
```

## Security Considerations

### Current Setup
- ✅ HTTPS required (enforced by WebRTC API)
- ✅ Peer-to-peer encryption (DTLS-SRTP by default)
- ✅ Signaling via Supabase (authenticated)
- ⚠️ TURN credentials are public (acceptable for free tier)

### For Production
- Use authenticated TURN servers with rotating credentials
- Implement TURN credential generation via backend API
- Enable RLS (Row Level Security) on Supabase

## Performance Optimization

### Current Settings
```typescript
iceCandidatePoolSize: 2  // Pre-gather 2 candidates
bundlePolicy: 'max-bundle'  // Single transport for all media
rtcpMuxPolicy: 'require'  // Multiplex RTP and RTCP
```

### Audio Quality
- Codec: Opus (adaptive bitrate)
- Echo cancellation: Enabled
- Noise suppression: Enabled
- Auto gain control: Enabled

## Support Contact
For issues or questions about WebRTC connectivity, check:
1. Browser console for detailed WebRTC logs
2. Network administrator (if on corporate network)
3. This documentation for configuration details
