# Project Handover & Developer Guide

## 1. Project Overview
This project is a **Single Page Application (SPA)** built with **React**, **Vite**, and **TypeScript**. It relies heavily on **Supabase** for Backend-as-a-Service (BaaS), providing authentication, a PostgreSQL database, and Realtime subscriptions.

### **Tech Stack**
- **Frontend**: React 18, TypeScript, TailwindCSS (inferred from classes), Lucide React (Icons).
- **Build Tool**: Vite.
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Realtime).
- **State Management**: React Context (`store.tsx`).
- **Real-time Communication**: WebRTC (P2P interactions) + Supabase Realtime (Signaling).

---

## 2. Architecture & State Management (`store.tsx`)
The application does not use Redux or Zustand. Instead, it uses a massive **React Context** defined in `store.tsx`.

### **The "Brain": `store.tsx`**
This file acts as the central nervous system. It:
1.  **Fetches Data**: Loads Users, Tasks, Projects, and Messages on basic load.
2.  **Maintains Subscriptions**: Listens to database changes (`postgres_changes`) to auto-update the UI when DB rows change.
3.  **Handles Signaling**: Uses Supabase Realtime channels to exchange WebRTC signals (Offers, Answers, ICE Candidates) instead of a custom WebSocket server.
4.  **Manage Call State**: Tracks who is in a call (`activeCallData`), WebRTC Peer Connections (`peerConnectionsRef`), and Media Streams (`localStream`, `remoteStreams`).

---

## 3. Realtime Calls & WebRTC Implementation

### **Topology: Client-Side Mesh**
The project implementation uses a **Full Mesh** topology.
-   **1-on-1 Call**: Direct P2P connection between User A and User B.
-   **Group Call**: Every participant connects directly to every other participant.
    -   *Example*: In a 3-person call (A, B, C), User A has connections A->B and A->C. User B has B->A and B->C.
    -   **Pros**: Low latency, no media server costs.
    -   **Cons**: High bandwidth/CPU usage on clients as the group size grows.

### **Signaling Process (How connections start)**
Since WebRTC requires two peers to exchange network information before connecting, this app uses `supabase.channel('signaling')` as the "Signaling Server".

#### **The Connection Lifecycle**
1.  **Initiation**:
    -   User A clicks "Call".
    -   `startCall(recipientId)` creates a `RTCPeerConnection`.
    -   User A creates an SDP **Offer** and broadcasts it via Supabase Realtime (`type: 'OFFER'`).

2.  **Handshake (Signal Exchange)**:
    -   User B receives the `OFFER` event in `store.tsx` (inside the `on('broadcast', ...)` listener).
    -   User B accepts, sets the Remote Description, creates an **Answer**, and broadcasts it back (`type: 'ANSWER'`).
    -   User A receives `ANSWER` and sets its Remote Description.

3.  **ICE Candidates (Punching holes in firewalls)**:
    -   As the browsers discover network paths (candidates), they trigger `onicecandidate`.
    -   These are broadcasted as `type: 'CANDIDATE'`.
    -   **Important**: The code includes a `pendingCandidatesRef` queue. If Candidates arrive *before* the remote description is set (common race condition), they are queued and processed later to avoid crashes.

4.  **Multi-User Logic (Mesh)**:
    -   When User C is invited (`addToCall`), the "Host" sends a signal `ADD_TO_CALL` to existing participants.
    -   This signal instructs existing peers to "Connect to User C".
    -   **Glare Handling**: To prevent two users from calling each other simultaneously (Glare), the code sorts User IDs. The user with the "lower" ID initiates the connection.

### **Key Code Paths for Calls**
-   **`store.tsx`**:
    -   `RTCPeerConnection` initialization is in `createPeerConnection()`.
    -   Signal handling switch-case is in the `useEffect` starting around line 300-600 (depending on version). Look for `case 'OFFER'`, `case 'ANSWER'`.
-   **`Communication.tsx`**:
    -   `CallInterface`: The component usually rendered overlays the screen.
    -   **Spotlight Logic**: Automatically highlights who is speaking or pinned.
    -   **Video Elements**: uses `ref` callback to attach `srcObject` (MediaStream) to `<video>` tags.

---

## 4. Chat System

### **Message Flow**
1.  **Sending**:
    -   User types message -> `addMessage()`.
    -   **Optimistic Update**: UI updates immediately (`setMessages`).
    -   **Broadcast**: Sends a `CHAT_MESSAGE` signal via Realtime for instant delivery to online peers.
    -   **Persistence**: Saves to Supabase (`public.messages` or via RPC `send_encrypted_message`).

2.  **Receiving**:
    -   `useEffect` in `store.tsx` listens for `postgres_changes` on the `messages` table.
    -   If a new row is inserted, it's added to the local state.
    -   **Unread Logic**: Checked in frontend. If the chat window isn't active, it increments the count/plays sound.

3.  **Attachments**:
    -   Files are uploaded to Supabase Storage bucket `attachments`.
    -   The public URL is generated and stored in the message JSON.

---

## 5. Directory Guide

### **Root** (`/`)
-   `index.html`: Entry point.
-   `App.tsx`: Main Router/Shell (likely contains Sidebar navigation).

### **Feature Modules** (`/modules`)
-   **`Communication.tsx`**: The heavy-hitter. Contains Chat Call UI, Video Grid, and Sidebar logic.
-   **`Kanban.tsx`**: Project management board (Drag & Drop).
-   **`Calendar.tsx`**: Meeting scheduling.
-   **`Dashboard.tsx`**: Overview widgets.

### **Backend Config**
-   **`supabaseClient.ts`**: Initialized Supabase client.
-   **`types.ts`**: Shared TypeScript interfaces (`User`, `Task`, `SignalData`).

---

## 6. Critical Developer Notes (Read this!)
1.  **Connection Timeouts**: There is a strict **15-second timeout** in `createPeerConnection`. If a peer doesn't respond/connect in 15s, the connection is closed and cleaned up.
2.  **State Refs**: Because `useEffect` closures can be stale, the code heavily uses `useRef` (e.g., `peerConnectionsRef`, `usersRef`) to access the latest state inside event listeners. **Always update the Ref if you update the State.**
3.  **Race Conditions**: "User Busy" logic uses a `pendingOffersRef`. If `User A` calls `User B` while `User B` is initializing another call, the offer might be queued or rejected.
