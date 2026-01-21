import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { User, Project, Task, ChatMessage, UserRole, TaskStatus, Attachment, Group, ProjectAccessLevel, Notification, NotificationType, IncomingCall, SignalData, Meeting } from './types';
import { supabase, fetchMessages } from './supabaseClient';
import { RealtimeChannel } from '@supabase/supabase-js';

interface AppContextType {
  currentUser: User | null;
  users: User[];
  projects: Project[];
  tasks: Task[];
  messages: ChatMessage[];
  groups: Group[];
  notifications: Notification[];
  incomingCall: IncomingCall | null;
  isInCall: boolean;

  activeCallData: { participantIds: string[] } | null;
  recipientBusy: string | null;
  waitToCall: () => void;
  cancelCallWait: () => void;

  // Chat History Management
  deletedMessageIds: Set<string>;
  clearChatHistory: (targetId: string) => Promise<void>;

  // Media Streams for UI
  localStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>; // Map of userId -> MediaStream
  isScreenSharing: boolean;

  // Media Controls
  isMicOn: boolean;
  isCameraOn: boolean;
  hasAudioDevice: boolean;
  hasVideoDevice: boolean;
  toggleMic: () => void;
  toggleCamera: () => void;

  login: (u: User) => void;
  logout: () => void;
  addUser: (u: User) => void;
  updateUser: (u: User) => void;
  deleteUser: (id: string) => void;
  addTask: (t: Task) => void;
  updateTask: (t: Task) => void;
  deleteTask: (id: string) => Promise<void>;
  moveTask: (taskId: string, newStatus: TaskStatus, newIndex?: number) => Promise<void>;
  addMessage: (text: string, recipientId?: string, attachments?: Attachment[]) => void;
  createGroup: (name: string, memberIds: string[]) => Promise<string | null>;
  addProject: (name: string, description: string) => void;
  updateProject: (p: Project) => void;
  deleteProject: (id: string) => Promise<void>;
  updateGroup: (g: Group) => Promise<void>;
  deleteGroup: (id: string) => Promise<void>;

  // Notification & Unread Logic
  triggerNotification: (recipientId: string, type: NotificationType, title: string, message: string, linkTo?: string) => void;
  markNotificationRead: (id: string) => void;
  clearNotifications: () => void;
  selectedTaskId: string | null;
  setSelectedTaskId: (id: string | null) => void;
  markChatRead: (chatId: string) => void;
  getUnreadCount: (chatId: string) => number;
  totalUnreadChatCount: number;
  activeTab: 'dashboard' | 'projects' | 'chat' | 'calendar' | 'admin';
  setActiveTab: (tab: 'dashboard' | 'projects' | 'chat' | 'calendar' | 'admin') => void;

  // Chat Focus State
  selectedChatId: string | null;
  setSelectedChatId: (id: string | null) => void;

  // Call Logic
  startCall: (recipientId: string) => Promise<void>;
  startGroupCall: (recipientIds: string[]) => Promise<void>;
  addToCall: (recipientId: string) => Promise<void>;
  acceptIncomingCall: () => Promise<void>;
  rejectIncomingCall: () => void;
  endCall: () => void;
  toggleScreenShare: () => Promise<void>;
  connectionState: Map<string, string>; // Debugging: <ParticipantID, ICEState>

  // Preferences
  ringtone: string;
  setRingtone: (url: string) => void;
  messageTone: string;
  setMessageTone: (url: string) => void;
  notificationTone: string;
  setNotificationTone: (url: string) => void;

  // Meetings
  meetings: Meeting[];
  addMeeting: (m: Meeting) => Promise<void>;
  updateMeeting: (m: Meeting) => Promise<void>;
  deleteMeeting: (id: string) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Configuration for WebRTC (Includes extensive public STUN servers to bypass NATs)
// Configuration for WebRTC (Proxy / TURN Setup)
// We use a function to allow dynamic IP configuration based on the current host
const getRTCConfig = (): RTCConfiguration => {
  const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';

  return {
    iceTransportPolicy: 'all', // Changed from 'relay' to 'all' to allow P2P/Srflx candidates if Relay fails. Critical fallback.
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
    iceCandidatePoolSize: 2,
    iceServers: [
      // 1. Self-Hosted Proxy (TURN)
      {
        urls: `turn:${hostname}:3478`,
        username: 'username',
        credential: 'password'
      },

      // 2. Open Relay Project (Backup TURN)
      {
        urls: [
          'stun:openrelay.metered.ca:80',
          'turn:openrelay.metered.ca:80',
          'turn:openrelay.metered.ca:443',
          'turn:openrelay.metered.ca:443?transport=tcp'
        ],
        username: 'openrelayproject',
        credential: 'openrelayproject'
      },

      // 3. STUN Servers
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:global.stun.twilio.com:3478' }
    ]
  };
};



export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Initialize currentUser from localStorage if available
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const stored = localStorage.getItem('nexus_pm_user');
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      return null;
    }
  });

  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [deletedMessageIds, setDeletedMessageIds] = useState<Set<string>>(new Set());

  // Call State
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [isInCall, setIsInCall] = useState(false);
  const [activeCallData, setActiveCallData] = useState<{ participantIds: string[] } | null>(null);
  const [recipientBusy, setRecipientBusy] = useState<string | null>(null);
  const tempOfferRef = useRef<any>(null); // Store offer while waiting for BUSY decision

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  // Separate streams for audio and video to avoid coupling audio and screen sharing
  const [localAudioStream, setLocalAudioStream] = useState<MediaStream | null>(null);
  const [localVideoStream, setLocalVideoStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());

  const [isScreenSharing, setIsScreenSharing] = useState(false);

  // Media Controls State
  const [isMicOn, setIsMicOn] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [hasAudioDevice, setHasAudioDevice] = useState(true);
  const [hasVideoDevice, setHasVideoDevice] = useState(true);

  // User Preferences
  const [ringtone, setRingtoneState] = useState<string>(() => {
    return localStorage.getItem('nexus_pm_ringtone') || 'https://orangefreesounds.com/wp-content/uploads/2023/04/Office-phone-ringing-sound-effect.mp3';
  });

  const setRingtone = (url: string) => {
    setRingtoneState(url);
    localStorage.setItem('nexus_pm_ringtone', url);
  };

  const [messageTone, setMessageToneState] = useState<string>(() => {
    // Default: "Notification" - clear beep
    return localStorage.getItem('nexus_pm_message_tone') || 'https://assets.mixkit.co/active_storage/sfx/2869/2869.wav';
  });

  const setMessageTone = (url: string) => {
    setMessageToneState(url);
    localStorage.setItem('nexus_pm_message_tone', url);
  };

  const [notificationTone, setNotificationToneState] = useState<string>(() => {
    // Default: "Happy Pop"
    return localStorage.getItem('nexus_pm_notification_tone') || 'https://assets.mixkit.co/active_storage/sfx/2866/2866.wav';
  });

  const setNotificationTone = (url: string) => {
    setNotificationToneState(url);
    localStorage.setItem('nexus_pm_notification_tone', url);
  };

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const [activeTab, setActiveTabState] = useState<'dashboard' | 'projects' | 'chat' | 'calendar' | 'admin'>('dashboard');

  const setActiveTab = (tab: 'dashboard' | 'projects' | 'chat' | 'calendar' | 'admin') => {
    setActiveTabState(tab);
  };

  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);

  // WebRTC Refs - Now using a Map for multiple connections
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const signalingChannelRef = useRef<RealtimeChannel | null>(null);
  const isSignalingConnectedRef = useRef(false);

  // Ref to track incoming call state within event listeners without dependency loops
  const incomingCallRef = useRef<IncomingCall | null>(null);

  // Refs for State Access in Event Listeners to avoid dependency cycles / re-subscriptions
  const selectedChatIdRef = useRef<string | null>(null); // Track selected chat globally
  const isInCallRef = useRef(isInCall);
  const activeCallDataRef = useRef(activeCallData);
  const localStreamRef = useRef(localStream);
  const localAudioStreamRef = useRef<MediaStream | null>(null);
  const localVideoStreamRef = useRef<MediaStream | null>(null);
  const prevCameraWasOnRef = useRef<boolean>(false);
  const prevCameraStreamRef = useRef<MediaStream | null>(null);
  const usersRef = useRef(users);
  const groupsRef = useRef(groups);
  const currentUserRef = useRef(currentUser);

  // Queue for offers that arrive while we are already ringing/busy with setup
  const pendingOffersRef = useRef<Map<string, any>>(new Map());

  // Queue for ICE candidates that arrive before PC is ready or Remote Description is set
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());

  // Track mesh auto-connections to suppress "User is Busy" modals
  const autoConnectRetriesRef = useRef<Map<string, number>>(new Map());

  // Synchronous whitelist for mesh participants to avoid Race Conditions between ADD_TO_CALL and OFFER
  const meshIntendedParticipantsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  // helper to process queued candidates
  const processQueuedCandidates = async (pc: RTCPeerConnection, senderId: string) => {
    const queued = pendingCandidatesRef.current.get(senderId);
    if (queued && queued.length > 0) {
      console.log(`Processing ${queued.length} queued candidates for ${senderId}`);
      for (const candidate of queued) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error(`Error processing queued candidate for ${senderId}`, e);
        }
      }
      pendingCandidatesRef.current.delete(senderId);
    }
  };

  const [connectionState, setConnectionState] = useState<Map<string, string>>(new Map()); // Debug



  // IDs of users currently active (via Supabase Presence)
  const [presentIds, setPresentIds] = useState<Set<string>>(new Set());
  const presentIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    presentIdsRef.current = presentIds;
  }, [presentIds]);

  // Sync Users with Presence IDs
  useEffect(() => {
    setUsers(prev => prev.map(u => ({
      ...u,
      isOnline: presentIds.has(u.id)
    })));
  }, [presentIds]);

  useEffect(() => {
    usersRef.current = users;
  }, [users]);

  // Map of ChatID -> Timestamp when current user last read it
  const [lastReadTimestamps, setLastReadTimestamps] = useState<Record<string, number>>({});

  // --- Data Mappers (DB Snake_case to App CamelCase) ---
  const mapUserFromDB = (u: any): User => ({
    ...u,
    isOnline: u.is_online,
    projectAccess: u.project_access,
    dashboardConfig: u.dashboard_config
  });
  const mapTaskFromDB = (t: any): Task => ({
    ...t,
    projectId: t.project_id,
    assigneeId: t.assignee_id,
    dueDate: t.due_date,
    order: t.order,
    subtasks: t.subtasks || [],
    attachments: t.attachments || [],
    comments: t.comments || [],
    createdAt: t.created_at
  });
  const mapProjectFromDB = (p: any): Project => ({
    id: p.id,
    name: p.name,
    description: p.description,
    memberIds: p.member_ids || [],
    attachments: [],
    comments: []
  });
  const mapGroupFromDB = (g: any): Group => ({
    ...g,
    memberIds: g.member_ids,
    createdBy: g.created_by,
    createdAt: g.created_at
  });
  const mapMessageFromDB = (m: any): ChatMessage => ({
    id: m.id,
    senderId: m.sender_id,
    recipientId: m.recipient_id,
    text: m.text,
    timestamp: m.timestamp,
    type: m.type,
    attachments: m.attachments,
    isRead: m.is_read || false
  });
  const mapNotificationFromDB = (n: any): Notification => ({
    id: n.id,
    recipientId: n.recipient_id,
    senderId: n.sender_id,
    type: n.type,
    title: n.title,
    message: n.message,
    timestamp: n.timestamp,
    read: n.read,
    linkTo: n.link_to
  });
  const mapMeetingFromDB = (m: any): Meeting => ({
    id: m.id,
    title: m.title,
    description: m.description,
    start_time: Number(m.start_time),
    end_time: Number(m.end_time),
    creator_id: m.creator_id,
    participant_ids: m.participant_ids || [],
    created_at: Number(m.created_at)
  });

  // Keep Refs in sync with state
  useEffect(() => {
    incomingCallRef.current = incomingCall;
    isInCallRef.current = isInCall;
    activeCallDataRef.current = activeCallData;
    localStreamRef.current = localStream;
    localAudioStreamRef.current = localAudioStream;
    localVideoStreamRef.current = localVideoStream;
    usersRef.current = users;
    groupsRef.current = groups;
    selectedChatIdRef.current = selectedChatId;
  }, [incomingCall, isInCall, activeCallData, localStream, localAudioStream, localVideoStream, users, groups, selectedChatId]);

  // Check available devices
  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then(devices => {
      setHasAudioDevice(devices.some(d => d.kind === 'audioinput'));
      setHasVideoDevice(devices.some(d => d.kind === 'videoinput'));
    });
  }, []);

  // --- 1. Fetch Initial Data from Supabase ---
  useEffect(() => {
    const fetchData = async () => {
      const { data: userData } = await supabase.from('users').select('*');
      if (userData) setUsers(userData.map(mapUserFromDB));

      const { data: projectData } = await supabase.from('projects').select('*');
      if (projectData) setProjects(projectData.map(mapProjectFromDB));

      const { data: taskData } = await supabase.from('tasks').select('*');
      if (taskData) setTasks(taskData.map(mapTaskFromDB));

      // Fetch messages from public.messages via helper that normalizes rows
      try {
        const msgs = await fetchMessages({ limit: 500, order: 'asc' });
        if (msgs && msgs.length) setMessages(msgs);
      } catch (e) {
        // Fallback: try decrypted_messages if public.messages is unavailable
        const { data: msgData } = await supabase.from('decrypted_messages').select('*').order('timestamp', { ascending: true });
        if (msgData) setMessages(msgData.map(mapMessageFromDB));
      }

      const { data: groupData } = await supabase.from('groups').select('*');
      if (groupData) setGroups(groupData.map(mapGroupFromDB));

      if (currentUser) {
        const { data: notifData } = await supabase.from('notifications').select('*').eq('recipient_id', currentUser.id).order('timestamp', { ascending: false });
        if (notifData) setNotifications(notifData.map(mapNotificationFromDB));
      }

      const { data: meetingData } = await supabase.from('meetings').select('*');
      if (meetingData) setMeetings(meetingData.map(mapMeetingFromDB));
    };

    fetchData();
  }, [currentUser?.id]); // Re-fetch user-specific data when login state changes

  // --- 1.1 Fetch Deleted Messages ---
  useEffect(() => {
    if (currentUser) {
      const fetchDeletedAndRead = async () => {
        // Fetch Deleted Messages
        const { data: deletedData } = await supabase.from('deleted_messages').select('message_id').eq('user_id', currentUser.id);
        if (deletedData) {
          setDeletedMessageIds(new Set(deletedData.map(d => d.message_id)));
        }

        // Fetch Read Receipts
        const { data: receipts } = await supabase.from('read_receipts').select('*').eq('user_id', currentUser.id);
        if (receipts) {
          const map: Record<string, number> = {};
          receipts.forEach((r: any) => map[r.chat_id] = r.last_read_timestamp);
          setLastReadTimestamps(map);
        }
      };
      fetchDeletedAndRead();
    } else {
      setDeletedMessageIds(new Set());
    }
  }, [currentUser]);

  // --- 1.5 Update Online Status via Presence (Handled in Signaling Effect) ---
  // No longer manual DB updates here to avoid stale status when tab is closed.

  // --- 1.6 Sync Current User with Users List (Refresh Data) ---
  useEffect(() => {
    if (currentUser && users.length > 0) {
      const freshUser = users.find(u => u.id === currentUser.id);
      if (freshUser && JSON.stringify(freshUser) !== JSON.stringify(currentUser)) {
        setCurrentUser(freshUser);
        localStorage.setItem('nexus_pm_user', JSON.stringify(freshUser));
      }
    }
  }, [users, currentUser]);

  // --- 2. Setup Realtime Subscriptions ---
  useEffect(() => {
    const channel = supabase.channel('db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, payload => {
        if (payload.eventType === 'INSERT') setTasks(prev => [...prev, mapTaskFromDB(payload.new)]);
        if (payload.eventType === 'UPDATE') setTasks(prev => prev.map(t => t.id === payload.new.id ? mapTaskFromDB(payload.new) : t));
        if (payload.eventType === 'DELETE') setTasks(prev => prev.filter(t => t.id !== payload.old.id));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, async payload => {
        try {
          if (payload.eventType === 'INSERT') {
            // Try to fetch a decrypted view, but fall back to payload.new if unavailable
            try {
              const { data } = await supabase.from('decrypted_messages').select('*').eq('id', payload.new.id).single();
              if (data) {
                setMessages(prev => prev.some(m => m.id === data.id) ? prev : [...prev, mapMessageFromDB(data)]);
                // Continue to sound logic...
              }
            } catch (e) {
              // ignore and fallback to payload.new below
            }

            // Fallback: use payload.new directly
            const row = payload.new;
            const mapped = mapMessageFromDB(row);
            setMessages(prev => prev.some(m => m.id === mapped.id) ? prev : [...prev, mapped]);

            // --- INCOMING MESSAGE SOUND LOGIC ---
            // Only play if:
            // 1. We are NOT the sender
            // 2. Chat is NOT currently focused
            // 3. Message is actually intended for US (or a group we are in)
            if (currentUser && mapped.senderId !== currentUser.id) {
              let isIntendedForMe = false;
              let messageChatId = mapped.senderId; // Default to sender for DM

              if (!mapped.recipientId) {
                // General channel (everyone)
                isIntendedForMe = true;
                messageChatId = 'general';
              } else if (mapped.recipientId === currentUser.id) {
                // Direct Message to me
                isIntendedForMe = true;
                messageChatId = mapped.senderId;
              } else if (mapped.recipientId.startsWith('g-')) {
                // Group Message
                const group = groupsRef.current.find(g => g.id === mapped.recipientId);
                // Check if we are a member
                if (group && group.memberIds.includes(currentUser.id)) {
                  isIntendedForMe = true;
                  messageChatId = mapped.recipientId;
                }
              }

              // Only proceed if the message is actually for us
              if (isIntendedForMe) {
                // Check if we are currently looking at this chat
                const isFocused = selectedChatIdRef.current === messageChatId;

                if (!isFocused) {
                  // Play Sound
                  try {
                    const audio = new Audio(messageTone);
                    audio.volume = 0.6;
                    const playPromise = audio.play();
                    if (playPromise !== undefined) {
                      playPromise.catch((e) => {
                        console.error("Audio play failed:", e);
                      });
                    }
                  } catch (e) {
                    console.error("Audio construction failed:", e);
                  }
                }
              }
            }
          }

          // Handle UPDATE (e.g. Reads)
          if (payload.eventType === 'UPDATE') {
            setMessages(prev => prev.map(m => m.id === payload.new.id ? { ...m, isRead: payload.new.is_read } : m));
          }
        } catch (e) {
          console.error('Realtime messages handler error:', e);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, payload => {
        if (payload.eventType === 'UPDATE') {
          const fresh = mapUserFromDB(payload.new);
          setUsers(prev => prev.map(u => u.id === fresh.id ? { ...fresh, isOnline: presentIdsRef.current.has(u.id) } : u));
        }
        if (payload.eventType === 'INSERT') {
          const fresh = mapUserFromDB(payload.new);
          setUsers(prev => [...prev, { ...fresh, isOnline: presentIdsRef.current.has(fresh.id) }]);
        }
        if (payload.eventType === 'DELETE') setUsers(prev => prev.filter(u => u.id !== payload.old.id));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, payload => {
        if (payload.eventType === 'INSERT') setProjects(prev => [...prev, mapProjectFromDB(payload.new)]);
        if (payload.eventType === 'UPDATE') setProjects(prev => prev.map(p => p.id === payload.new.id ? mapProjectFromDB(payload.new) : p));
        if (payload.eventType === 'DELETE') setProjects(prev => prev.filter(p => p.id !== payload.old.id));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'groups' }, payload => {
        if (payload.eventType === 'INSERT') setGroups(prev => [...prev, mapGroupFromDB(payload.new)]);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meetings' }, payload => {
        if (payload.eventType === 'INSERT') setMeetings(prev => [...prev, mapMeetingFromDB(payload.new)]);
        if (payload.eventType === 'UPDATE') setMeetings(prev => prev.map(m => m.id === payload.new.id ? mapMeetingFromDB(payload.new) : m));
        if (payload.eventType === 'DELETE') setMeetings(prev => prev.filter(m => m.id !== payload.old.id));
      })
      .subscribe();

    const notifSubscription = currentUser ? supabase.channel('notif-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${currentUser.id}` }, payload => {
        if (payload.eventType === 'INSERT') {
          setNotifications(prev => [mapNotificationFromDB(payload.new), ...prev]);

          // Play Notification Sound
          try {
            const audio = new Audio(notificationTone); // "Happy Pop" - distinct from message tone
            audio.volume = 0.5;
            audio.play().catch(e => console.error("Notification sound blocked", e));
          } catch (e) {
            console.error("Notification audio error", e);
          }
        }
        if (payload.eventType === 'UPDATE') setNotifications(prev => prev.map(n => n.id === payload.new.id ? mapNotificationFromDB(payload.new) : n));
      })
      .subscribe() : null;

    return () => {
      supabase.removeChannel(channel);
      if (notifSubscription) supabase.removeChannel(notifSubscription);
    };
  }, [currentUser?.id]);

  // --- Simplified Signaling Logic (Rewrite) ---
  useEffect(() => {
    if (!currentUser) return;

    // Use a unique channel for signaling and presence
    const channel = supabase.channel('signaling', { config: { presence: { key: currentUser.id } } });
    signalingChannelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const activeIds = new Set<string>();
        Object.values(state).forEach((presences: any) => {
          presences.forEach((p: any) => { if (p.user_id) activeIds.add(p.user_id); });
        });
        setPresentIds(activeIds);
      })
      .on('broadcast', { event: 'signal' }, async ({ payload }) => {
        const { type, senderId, recipientId, payload: signalPayload } = payload as SignalData;

        // FILTER: Only accept if meant for us or public
        if (recipientId && recipientId !== currentUser.id && type !== 'USER_ONLINE') return;
        if (senderId === currentUser.id) return; // Ignore own echo

        switch (type) {
          case 'OFFER':
            // Simple logic: If we are not in a call, WE RING. 
            // If we are in a call, we could reject or merge. For simplicy, if not in call -> SHOW INCOMING
            if (!isInCallRef.current) {
              console.log("Received OFFER from", senderId);
              setIncomingCall({ callerId: senderId, timestamp: Date.now(), offer: signalPayload.sdp });
            } else {
              // Busy logic ignored for simplicity - just ignore or log
              console.warn("Received offer while in call, ignoring for stability");
            }
            break;

          case 'ANSWER':
            console.log("Received ANSWER from", senderId);
            const pc = peerConnectionsRef.current.get(senderId);
            if (pc) {
              try {
                await pc.setRemoteDescription(new RTCSessionDescription(signalPayload.sdp));
                // Process pending candidates
                const queued = pendingCandidatesRef.current.get(senderId) || [];
                for (const c of queued) await pc.addIceCandidate(new RTCIceCandidate(c));
                pendingCandidatesRef.current.delete(senderId);
              } catch (e) { console.error("Error setting RD (Answer):", e); }
            }
            break;

          case 'CANDIDATE':
            const cand = new RTCIceCandidate(signalPayload.candidate);
            const pc2 = peerConnectionsRef.current.get(senderId);
            if (pc2 && pc2.remoteDescription) {
              pc2.addIceCandidate(cand).catch(e => console.error("AddCand failed", e));
            } else {
              // Queue it
              if (!pendingCandidatesRef.current.has(senderId)) pendingCandidatesRef.current.set(senderId, []);
              pendingCandidatesRef.current.get(senderId)!.push(signalPayload.candidate);
            }
            break;

          case 'HANGUP':
            console.log("Hangup received from", senderId);
            const pc3 = peerConnectionsRef.current.get(senderId);
            if (pc3) { pc3.close(); peerConnectionsRef.current.delete(senderId); }

            // Clean UI if they were the only one
            if (activeCallDataRef.current?.participantIds.includes(senderId)) {
              const newIds = activeCallDataRef.current.participantIds.filter(id => id !== senderId);
              if (newIds.length === 0) {
                endCall();
              } else {
                setActiveCallData({ participantIds: newIds });
                // update streams
                setRemoteStreams(prev => { const n = new Map(prev); n.delete(senderId); return n; });
              }
            } else if (incomingCallRef.current?.callerId === senderId) {
              setIncomingCall(null);
            }
            break;

          case 'CHAT_MESSAGE':
            // Keep existing chat logic
            try {
              const incoming = signalPayload as any;
              const msg: ChatMessage = {
                id: incoming.id || (Date.now().toString() + Math.random()),
                senderId: incoming.senderId || incoming.sender_id || incoming.sender,
                recipientId: incoming.recipientId || incoming.recipient_id || incoming.recipient,
                text: incoming.text || incoming.body || incoming.message || '',
                timestamp: incoming.timestamp || Date.now(),
                type: incoming.type || 'text',
                attachments: incoming.attachments || []
              } as ChatMessage;
              setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
            } catch (e) { console.error('Error handling CHAT_MESSAGE', e); }
            break;
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          isSignalingConnectedRef.current = true;
          if (currentUserRef.current) {
            channel.track({ user_id: currentUserRef.current.id, online_at: new Date().toISOString() });
          }
        }
      });

    return () => {
      isSignalingConnectedRef.current = false;
      supabase.removeChannel(channel);
    };
  }, [currentUser?.id]);


  const sendSignal = async (type: SignalData['type'], recipientId: string | undefined, payload: any) => {
    if (signalingChannelRef.current && currentUser) {
      if (!isSignalingConnectedRef.current) return;

      try {
        await signalingChannelRef.current.send({
          type: 'broadcast',
          event: 'signal',
          payload: {
            type,
            senderId: currentUser.id,
            recipientId,
            payload
          }
        });
      } catch (err) {
        console.warn("Error sending signal:", err);
      }
    }
  };

  // --- Actions ---

  const login = async (user: User) => {
    localStorage.setItem('nexus_pm_user', JSON.stringify(user));
    setCurrentUser(user);
    // Presence handles online status automatically now
  };

  const logout = async () => {
    localStorage.removeItem('nexus_pm_user');
    setCurrentUser(null);
    setNotifications([]);
    setLastReadTimestamps({});
    setIncomingCall(null);
    setIsInCall(false);
    setDeletedMessageIds(new Set());
    endCall();
  };

  const addUser = async (user: User) => {
    // Create in public.users table
    const { error } = await supabase.from('users').insert({
      id: user.id,
      name: user.name,
      username: user.username,
      password: user.password,
      role: user.role,
      avatar: user.avatar,
      designation: user.designation,
      project_access: user.projectAccess,
      dashboard_config: user.dashboardConfig
    });
    if (error) console.error("Add user failed:", error);
  };

  const updateUser = async (u: User) => {
    const { error } = await supabase.from('users').update({
      name: u.name,
      username: u.username,
      password: u.password,
      role: u.role,
      avatar: u.avatar,
      designation: u.designation,
      project_access: u.projectAccess,
      dashboard_config: u.dashboardConfig
    }).eq('id', u.id);
    if (error) console.error("Update user failed", error);

    if (currentUser?.id === u.id) {
      setCurrentUser(u);
      localStorage.setItem('nexus_pm_user', JSON.stringify(u));
    }
  };

  const deleteUser = async (id: string) => {
    await supabase.from('users').delete().eq('id', id);
  };

  const addTask = async (t: Task) => {
    const projectTasks = tasks.filter(task => task.status === t.status && task.projectId === t.projectId);
    const maxOrder = projectTasks.reduce((max, curr) => Math.max(max, curr.order || 0), -1);

    await supabase.from('tasks').insert({
      id: t.id,
      project_id: t.projectId,
      title: t.title,
      description: t.description,
      status: t.status,
      category: t.category,
      assignee_id: t.assigneeId || null,
      priority: t.priority,
      due_date: t.dueDate || null,
      attachments: t.attachments,
      comments: t.comments,
      subtasks: t.subtasks,
      created_at: t.createdAt,
      order: maxOrder + 1
    });
  };

  const updateTask = async (t: Task) => {
    // Optimistic Update
    setTasks(prev => prev.map(task => task.id === t.id ? t : task));

    await supabase.from('tasks').update({
      title: t.title,
      description: t.description,
      status: t.status,
      category: t.category,
      assignee_id: t.assigneeId || null, // Explicitly set null if undefined to unassign
      priority: t.priority,
      due_date: t.dueDate || null,
      attachments: t.attachments,
      comments: t.comments,
      subtasks: t.subtasks,
      order: t.order
    }).eq('id', t.id);
  };

  const deleteTask = async (id: string) => {
    await supabase.from('tasks').delete().eq('id', id);
  };

  const moveTask = async (taskId: string, s: TaskStatus, newIndex?: number) => {
    // 1. Get current state and task
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    // 2. Identify destination tasks (excluding the moved task if it was already in this column)
    // We want the list of tasks in the target status, EXCLUDING the dragged task.
    let destTasks = tasks.filter(t => t.status === s && t.id !== taskId);

    // 3. Sort by current order to ensure correct insertion point
    destTasks.sort((a, b) => (a.order || 0) - (b.order || 0));

    // 4. Insert task at new index
    const updatedTask = { ...task, status: s };
    if (newIndex !== undefined && newIndex >= 0 && newIndex <= destTasks.length) {
      destTasks.splice(newIndex, 0, updatedTask);
    } else {
      destTasks.push(updatedTask);
    }

    // 5. Re-assign orders
    const updates = destTasks.map((t, idx) => ({ ...t, order: idx }));

    // 6. Optimistic Update
    // We need to construct the new full task list. 
    // We take all tasks NOT in the destination status (and not the moved task), and combine with updated destination tasks.
    // Wait, if we moved FROM s TO s (reorder), the above logic works (filtered out, inserted back).
    // If we moved FROM A TO B, 'destTasks' holds B tasks + moved task.
    // We also need to keep A tasks (excluding moved task) unchanged order-wise (gaps are fine).

    // Map of ID -> New Task Data
    const updateMap = new Map(updates.map(u => [u.id, u]));

    const newTasks = tasks.map(t => {
      if (updateMap.has(t.id)) return updateMap.get(t.id)!;
      if (t.id === taskId) return { ...t, status: s }; // Fallback, should be covered by updateMap
      return t;
    });
    setTasks(newTasks);

    // 7. Persist to DB
    await Promise.all(updates.map(u =>
      supabase.from('tasks').update({ status: u.status, order: u.order }).eq('id', u.id)
    ));

    // 8. Notification
    if (task.status !== s && task.assigneeId) {
      triggerNotification(
        task.assigneeId,
        NotificationType.ASSIGNMENT,
        'Task Status Updated',
        `Task "${task.title}" moved to ${s.replace('_', ' ')}`,
        task.id
      );
    }
  };

  const addMessage = async (text: string, recipientId?: string, attachments: Attachment[] = []) => {
    if (!currentUser) return;

    // Create the message object for internal app state (CamelCase)
    const optimisticMsg: ChatMessage = {
      id: Date.now().toString() + Math.random(),
      senderId: currentUser.id,
      recipientId: recipientId || undefined,
      text,
      timestamp: Date.now(),
      type: 'text',
      attachments
    };

    // 1. Optimistic Update (Immediate Feedback for Sender)
    setMessages(prev => [...prev, optimisticMsg]);

    const chatId = recipientId || 'general';
    setLastReadTimestamps(prev => ({ ...prev, [chatId]: Date.now() }));

    // 2. Broadcast to active peers (Instant Delivery for Receivers) via signaling
    if (isSignalingConnectedRef.current) {
      try {
        await sendSignal('CHAT_MESSAGE', undefined, optimisticMsg);
      } catch (err) {
        console.error('Broadcast failed', err);
      }
    }

    // 3. Persist to DB (Encrypted) via RPC
    const { error } = await supabase.rpc('send_encrypted_message', {
      p_id: optimisticMsg.id,
      p_sender_id: optimisticMsg.senderId,
      p_recipient_id: optimisticMsg.recipientId,
      p_text: optimisticMsg.text,
      p_type: optimisticMsg.type,
      p_attachments: optimisticMsg.attachments,
      p_timestamp: optimisticMsg.timestamp
    });

    if (error) {
      console.error("Error sending encrypted message (RPC):", error);
      // Fallback: attempt direct insert into public.messages to ensure UI visibility
      try {
        const { data: fallbackData, error: insertErr } = await supabase.from('messages').insert({
          id: optimisticMsg.id,
          sender_id: optimisticMsg.senderId,
          recipient_id: optimisticMsg.recipientId,
          text: optimisticMsg.text,
          timestamp: optimisticMsg.timestamp,
          type: optimisticMsg.type,
          attachments: optimisticMsg.attachments
        }).select();
        if (insertErr) {
          console.error('Fallback insert to public.messages failed:', insertErr);
        } else {
          console.debug('Fallback insert succeeded, row:', fallbackData);
          // Refresh messages from public.messages to ensure UI reflects DB
          try {
            const refreshed = await fetchMessages({ limit: 500, order: 'asc' });
            if (refreshed) setMessages(refreshed);
          } catch (e) {
            console.warn('Failed to refresh messages after fallback insert:', e);
          }
        }
      } catch (e) {
        console.error('Fallback insert exception:', e);
      }
      return;
    }

    // Best-effort: also write to public.messages so the UI (which reads public.messages) is populated.
    try {
      const { data: insertData, error: insertErr } = await supabase.from('messages').insert({
        id: optimisticMsg.id,
        sender_id: optimisticMsg.senderId,
        recipient_id: optimisticMsg.recipientId,
        text: optimisticMsg.text,
        timestamp: optimisticMsg.timestamp,
        type: optimisticMsg.type,
        attachments: optimisticMsg.attachments
      }).select();

      if (insertErr) {
        // Not fatal; log for debugging
        console.warn('Insert to public.messages returned error (non-fatal):', insertErr);
      } else {
        console.debug('Insert to public.messages succeeded, row:', insertData);
        try {
          const refreshed = await fetchMessages({ limit: 500, order: 'asc' });
          if (refreshed) setMessages(refreshed);
        } catch (e) {
          console.warn('Failed to refresh messages after insert:', e);
        }
      }
    } catch (e) {
      console.error('Insert to public.messages exception (non-fatal):', e);
    }
  };

  const createGroup = async (name: string, memberIds: string[]): Promise<string | null> => {
    if (!currentUser) return null;
    const newGroupId = 'g-' + Date.now();
    const allMembers = Array.from(new Set([...memberIds, currentUser.id]));
    const { error } = await supabase.from('groups').insert({
      id: newGroupId,
      name,
      member_ids: allMembers,
      created_by: currentUser.id,
      created_at: Date.now()
    });

    if (error) {
      console.error("Error creating group:", error);
      return null;
    }
    return newGroupId;
  };

  const updateGroup = async (g: Group) => {
    // Optimistic Update
    setGroups(prev => prev.map(group => group.id === g.id ? g : group));

    const { error } = await supabase.from('groups').update({
      name: g.name,
      member_ids: g.memberIds
    }).eq('id', g.id);

    if (error) console.error("Error updating group:", error);
  };

  const deleteGroup = async (id: string) => {
    // Optimistic Update
    setGroups(prev => prev.filter(g => g.id !== id));

    const { error } = await supabase.from('groups').delete().eq('id', id);
    if (error) console.error("Error deleting group:", error);
  };

  const addProject = async (name: string, description: string) => {
    const newProjectId = 'p-' + Date.now();
    // Use only schema-defined columns to prevent errors
    const { error } = await supabase.from('projects').insert({
      id: newProjectId,
      name,
      description,
      member_ids: []
    });

    if (error) {
      console.error("Error creating project:", error);
      return;
    }

    if (currentUser) {
      const updatedAccess = { ...currentUser.projectAccess, [newProjectId]: 'write' };
      updateUser({ ...currentUser, projectAccess: updatedAccess as any });
    }
  };

  const updateProject = async (p: Project) => {
    // Use only schema-defined columns
    const { error } = await supabase.from('projects').update({
      name: p.name,
      description: p.description,
      member_ids: p.memberIds
    }).eq('id', p.id);

    if (error) console.error("Error updating project:", error);
  };

  const deleteProject = async (id: string) => {
    // Optimistic update
    const oldProjects = [...projects];
    setProjects(prev => prev.filter(p => p.id !== id));

    try {
      // 1. Delete tasks (Manual cascade since DB might not have ON DELETE CASCADE)
      const { error: taskError } = await supabase.from('tasks').delete().eq('project_id', id);
      if (taskError) {
        console.warn("Project tasks deletion issue (proceeding with project delete):", taskError.message);
      }

      // 2. Delete project
      const { error: projectError } = await supabase.from('projects').delete().eq('id', id);

      if (projectError) {
        throw new Error(projectError.message);
      }
    } catch (error: any) {
      console.error("Error deleting project:", error);
      alert("Failed to delete project. " + (error.message || "Unknown error"));
      // Restore optimistic update
      setProjects(oldProjects);
      // Refresh from DB to be safe
      const { data } = await supabase.from('projects').select('*');
      if (data) setProjects(data.map(mapProjectFromDB));
    }
  };

  const triggerNotification = async (recipientId: string, type: NotificationType, title: string, message: string, linkTo?: string) => {
    if (currentUser && recipientId === currentUser.id) return;
    await supabase.from('notifications').insert({
      id: 'n-' + Date.now() + Math.random(),
      recipient_id: recipientId,
      sender_id: currentUser?.id,
      type,
      title,
      message,
      timestamp: Date.now(),
      read: false,
      link_to: linkTo
    });
  };

  const markNotificationRead = async (id: string) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id);
  };

  const clearNotifications = async () => {
    if (!currentUser) return;
    await supabase.from('notifications').update({ read: true }).eq('recipient_id', currentUser.id);
  };

  const markChatRead = async (chatId: string) => {
    if (!currentUser) return;

    // 1. Optimistic Update (Immediate UI response) to stop blinking dot
    setMessages(prev => {
      // Check if any change is actually needed to avoid unnecessary re-renders
      const needsUpdate = prev.some(m => {
        const isTarget = (chatId === 'general' && !m.recipientId) ||
          (chatId.startsWith('g-') && m.recipientId === chatId) ||
          (m.senderId === chatId && m.recipientId === currentUser.id);
        return isTarget && !m.isRead && m.senderId !== currentUser.id;
      });

      if (!needsUpdate) return prev;

      return prev.map(m => {
        const isTarget = (chatId === 'general' && !m.recipientId) ||
          (chatId.startsWith('g-') && m.recipientId === chatId) ||
          (m.senderId === chatId && m.recipientId === currentUser.id);

        if (isTarget && !m.isRead && m.senderId !== currentUser.id) {
          return { ...m, isRead: true };
        }
        return m;
      });
    });

    // 2. Database Update
    try {
      let query = supabase.from('messages').update({ is_read: true }).neq('sender_id', currentUser.id).eq('is_read', false);

      if (chatId === 'general') {
        // General Chat - Handle NULL recipient
        query = query.is('recipient_id', null);
      } else if (chatId.startsWith('g-')) {
        // Group Chat
        query = query.eq('recipient_id', chatId);
      } else {
        // Direct Message: Mark messages FROM the other user TO me
        query = query.eq('sender_id', chatId).eq('recipient_id', currentUser.id);
      }

      const { error } = await query;
      if (error) console.error("Error marking messages read in DB:", error);
    } catch (e) {
      console.error("Exception marking messages read:", e);
    }
  };

  const getUnreadCount = (chatId: string) => {
    if (!currentUser) return 0;

    return messages.filter(m => {
      if (deletedMessageIds.has(m.id)) return false;
      if (m.isRead) return false; // Already read

      if (chatId === 'general') {
        // Global chat: User is NOT the sender and there is NO recipientId
        return !m.recipientId && m.senderId !== currentUser.id;
      }
      if (chatId.startsWith('g-')) {
        // Group chat
        return m.recipientId === chatId && m.senderId !== currentUser.id;
      }
      // DM
      return m.senderId === chatId && m.recipientId === currentUser.id;
    }).length;
  };

  // Optimized Total Unread Count
  // Iterate messages ONCE rather than iterating all users/groups.
  // This ensures we catch unread messages even from users not currently in the 'users' list.
  const totalUnreadChatCount = React.useMemo(() => {
    if (!currentUser) return 0;

    let count = 0;
    messages.forEach(m => {
      // 1. Skip if Deleted or Read or Sent by Me
      if (deletedMessageIds.has(m.id)) return;
      if (m.isRead) return;
      if (m.senderId === currentUser.id) return;

      // 2. Classify Message
      if (!m.recipientId) {
        // General Chat
        count++;
      } else if (m.recipientId.startsWith('g-')) {
        // Group Chat (Only if I am a member)
        // We need to check group membership to show relevant badge
        const group = groups.find(g => g.id === m.recipientId);
        if (group && group.memberIds.includes(currentUser.id)) {
          count++;
        }
      } else if (m.recipientId === currentUser.id) {
        // DM to Me
        count++;
      }
    });
    return count;
  }, [messages, currentUser, groups, deletedMessageIds]);

  // --- Clear Chat History Logic ---
  const clearChatHistory = async (targetId: string) => {
    if (!currentUser) return;

    const isGroup = groups.some(g => g.id === targetId);

    const msgsToDelete = messages.filter(m => {
      if (deletedMessageIds.has(m.id)) return false; // Already deleted

      if (targetId === 'general') {
        return !m.recipientId; // Global chat
      }
      if (isGroup) {
        return m.recipientId === targetId;
      } else {
        // 1:1 Chat
        return (m.senderId === currentUser.id && m.recipientId === targetId) ||
          (m.senderId === targetId && m.recipientId === currentUser.id);
      }
    });

    if (msgsToDelete.length === 0) return;

    const newDeletedIds = new Set(deletedMessageIds);
    const recordsToInsert = msgsToDelete.map(m => {
      newDeletedIds.add(m.id);
      return {
        id: 'dm-' + Date.now() + Math.random().toString(36).substr(2, 9),
        user_id: currentUser.id,
        message_id: m.id,
        timestamp: Date.now()
      };
    });

    setDeletedMessageIds(newDeletedIds); // Optimistic UI update

    const { error } = await supabase.from('deleted_messages').insert(recordsToInsert);
    if (error) console.error("Failed to delete chat history", error);
  };


  // --- WebRTC Logic (Audio + Screen Share Only) ---

  // --- Simplified WebRTC Logic (Rewrite) ---

  const createPeerConnection = (recipientId: string) => {
    try {
      if (peerConnectionsRef.current.has(recipientId)) return peerConnectionsRef.current.get(recipientId)!;

      console.log(`Creating PC for ${recipientId} using PROXY (TURN)`);
      const pc = new RTCPeerConnection(getRTCConfig());

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendSignal('CANDIDATE', recipientId, { candidate: event.candidate.toJSON() });
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log(`ICE State for ${recipientId}: ${pc.iceConnectionState}`);
        setConnectionState(prev => new Map(prev).set(recipientId, pc.iceConnectionState));
        if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
          // Optional: Auto-retry logic could go here, but for now we let it stay failed to show red
        }
      };

      pc.onconnectionstatechange = () => {
        console.log(`Connection State for ${recipientId}: ${pc.connectionState}`);
      };

      pc.ontrack = (event) => {
        console.log(`Received track from ${recipientId} | Kind: ${event.track.kind} | Stream ID: ${event.streams[0]?.id || 'derived'}`);

        setRemoteStreams(prev => {
          const newMap = new Map(prev);
          // If the browser gave us a stream, use it. Otherwise create one from the track.
          // This handles cases where event.streams is empty (common in some Signaling/Browser combos).
          const stream = event.streams[0] || new MediaStream([event.track]);

          newMap.set(recipientId, stream);
          return newMap;
        });
      };

      peerConnectionsRef.current.set(recipientId, pc);
      return pc;
    } catch (e) {
      console.error("Error creating PC:", e);
      throw e;
    }
  };

  const startCall = async (recipientId: string) => {
    // 1. UI State
    setIncomingCall(null);
    setIsInCall(true);
    setActiveCallData({ participantIds: [recipientId] });

    // 2. Get Media
    let stream = localStream;
    if (!stream) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        setLocalStream(stream);
        localStreamRef.current = stream;
        setHasAudioDevice(true);
        setIsMicOn(true);
      } catch (e) {
        console.error("Mic error:", e);
        alert("Microphone access required.");
        setIsInCall(false);
        return;
      }
    }

    // 3. Initiate Connection
    const pc = createPeerConnection(recipientId);
    stream.getTracks().forEach(t => pc.addTrack(t, stream!));

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      sendSignal('OFFER', recipientId, { sdp: offer });
    } catch (e) {
      console.error("Offer creation failed:", e);
    }
  };

  const acceptIncomingCall = async () => {
    if (!incomingCall || !incomingCall.offer) return;
    const { callerId, offer } = incomingCall;

    setIncomingCall(null);
    setIsInCall(true);
    setActiveCallData({ participantIds: [callerId] });

    // 1. Get Media
    let stream = localStream;
    if (!stream) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        setLocalStream(stream);
        localStreamRef.current = stream;
        setIsMicOn(true);
      } catch (e) {
        console.error("Mic error:", e);
        // proceed anyway to hear audio? No, usually symmetric
      }
    }

    // 2. Create PC & Answer
    const pc = createPeerConnection(callerId);
    if (stream) stream.getTracks().forEach(t => pc.addTrack(t, stream!));

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      // Process queued candidates now that RD is set
      const queued = pendingCandidatesRef.current.get(callerId) || [];
      for (const c of queued) await pc.addIceCandidate(new RTCIceCandidate(c));
      pendingCandidatesRef.current.delete(callerId);

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      sendSignal('ANSWER', callerId, { sdp: answer });
    } catch (e) {
      console.error("Answer creation failed:", e);
    }
  };

  const rejectIncomingCall = () => {
    if (incomingCall) {
      sendSignal('HANGUP', incomingCall.callerId, {});
      setIncomingCall(null);
    }
  };

  const endCall = () => {
    // Notify active participants that we are hanging up
    if (activeCallDataRef.current) {
      activeCallDataRef.current.participantIds.forEach(participantId => {
        sendSignal('HANGUP', participantId, {});
      });
    }

    // cleanup
    peerConnectionsRef.current.forEach(pc => pc.close());
    peerConnectionsRef.current.clear();
    setRemoteStreams(new Map());

    if (localStream) {
      localStream.getTracks().forEach(t => t.stop());
      setLocalStream(null);
      localStreamRef.current = null;
    }

    setIsInCall(false);
    setActiveCallData(null);
    setIncomingCall(null);
    setConnectionState(new Map());
  };

  // Placeholders for removed complex features to keep API valid
  const startGroupCall = async (ids: string[]) => { ids.forEach(id => startCall(id)); };
  const addToCall = async (id: string) => { startCall(id); }; // Simple mesh addition
  const toggleScreenShare = async () => { alert("Screen sharing temporarily disabled for stability."); };
  const toggleMic = () => {
    if (localStream) {
      const enabled = !isMicOn;
      localStream.getAudioTracks().forEach(t => t.enabled = enabled);
      setIsMicOn(enabled);
    }
  };
  const toggleCamera = () => { alert("Video temporarily disabled for stability check."); };
  const waitToCall = () => { };
  const cancelCallWait = () => { };

  // --- 4. Sync Users List with Presence Status ---
  useEffect(() => {
    setUsers(prev => prev.map(u => ({
      ...u,
      isOnline: presentIds.has(u.id)
    })));
  }, [presentIds]);

  return (
    <AppContext.Provider value={{
      currentUser, users, projects, tasks, messages, groups, notifications, incomingCall, isInCall, activeCallData,
      localStream, remoteStreams, isScreenSharing, isMicOn, isCameraOn, hasAudioDevice, hasVideoDevice,
      deletedMessageIds, clearChatHistory,
      login, logout, addUser, updateUser, deleteUser, addTask, updateTask, deleteTask, moveTask, addMessage, createGroup, updateGroup, deleteGroup, addProject, updateProject, deleteProject,
      triggerNotification, markNotificationRead, clearNotifications,
      selectedTaskId, setSelectedTaskId,
      markChatRead, getUnreadCount, totalUnreadChatCount,
      activeTab, setActiveTab,
      startCall, startGroupCall, addToCall, acceptIncomingCall, rejectIncomingCall, endCall, toggleScreenShare, toggleMic, toggleCamera,
      connectionState, // Debug
      recipientBusy, waitToCall, cancelCallWait,
      ringtone, setRingtone,
      messageTone, setMessageTone,
      notificationTone, setNotificationTone,
      meetings,
      addMeeting: async (m: Meeting) => {
        const { error } = await supabase.from('meetings').insert({
          id: m.id,
          title: m.title,
          description: m.description,
          start_time: m.start_time,
          end_time: m.end_time,
          creator_id: m.creator_id,
          participant_ids: m.participant_ids
        });
        if (error) console.error("Add meeting failed:", error);
      },
      updateMeeting: async (m: Meeting) => {
        const { error } = await supabase.from('meetings').update({
          title: m.title,
          description: m.description,
          start_time: m.start_time,
          end_time: m.end_time,
          participant_ids: m.participant_ids
        }).eq('id', m.id);
        if (error) console.error("Update meeting failed:", error);
      },
      deleteMeeting: async (id: string) => {
        const { error } = await supabase.from('meetings').delete().eq('id', id);
        if (error) console.error("Delete meeting failed:", error);
      },

      // Chat Focus
      selectedChatId,
      setSelectedChatId
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProvider");
  return context;
};