# Message Tone Logic Fix

## Issue
**Symptom**: All online users were hearing the "New Message" tone whenever *anyone* sent a message, even if it was a Direct Message between two other people.
**Cause**: The Supabase Realtime subscription listens to *all* INSERT events on the `messages` table. The frontend logic was only checking `senderId !== currentUser.id`. It failed to check if `recipientId` matched the current user.

## Fix
**Strict Recipient Verification**:
Updated the sound playback logic in `store.tsx` to strictly verify "Intention".
The sound now ONLY plays if:
1.  **General Chat**: `recipientId` is null (Everyone hears it).
2.  **Direct Message**: `recipientId` matches `currentUser.id`.
3.  **Group Chat**: `recipientId` matches a Group ID **AND** the current user is in `group.memberIds`.

**Technical Implementation**:
-   Used `groupsRef` (synced with state) to verify group membership inside the event callback without stale closure issues.

## Verification
-   **Build**: Successful (`npm run build`).
-   **Expected Behavior**: If User A messages User B, User C (online) will NOT hear a sound.
