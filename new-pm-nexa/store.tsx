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
const RTC_CONFIG: RTCConfiguration = {
  iceTransportPolicy: 'all',
  // iceCandidatePoolSize: 10, // Removed to save resources/ports on strict networks
  iceServers: [
    // Google
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    // Twilio (Public)
    { urls: 'stun:global.stun.twilio.com:3478' },
    // Others
    { urls: 'stun:stun.ekiga.net' },
    { urls: 'stun:stun.fwdnet.net' },
    { urls: 'stun:stun.ideasip.com' },
    { urls: 'stun:stun.iptel.org' },
    { urls: 'stun:stun.rixtelecom.se' },
    { urls: 'stun:stun.schlund.de' },
    { urls: 'stun:stun.softjoys.com' },
    { urls: 'stun:stun.voiparound.com' },
    { urls: 'stun:stun.voipbuster.com' },
    { urls: 'stun:stun.voipstunt.com' },
    { urls: 'stun:stun.voxgratia.org' },
    { urls: 'stun:stun.xten.com' }
  ]
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
    selectedChatIdRef.current = selectedChatId;
  }, [incomingCall, isInCall, activeCallData, localStream, localAudioStream, localVideoStream, users, selectedChatId]);

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
            // 2. Chat is NOT currently focused (so Red Dot would appear)
            if (currentUser && mapped.senderId !== currentUser.id) {
              let messageChatId = mapped.senderId; // Default to sender for DM

              if (!mapped.recipientId) {
                messageChatId = 'general';
              } else if (mapped.recipientId.startsWith('g-')) {
                messageChatId = mapped.recipientId;
              }
              // else DM: messageChatId is senderId.

              // Check if we are currently looking at this chat
              const isFocused = selectedChatIdRef.current === messageChatId;

              // DEBUG LOGS
              console.log('🔔 Sound Logic Debug:', {
                myId: currentUser.id,
                senderId: mapped.senderId,
                chatIdForMsg: messageChatId,
                focusedChatId: selectedChatIdRef.current,
                isFocused,
                willPlay: !isFocused
              });

              if (!isFocused) {
                // Play Sound
                try {
                  const audio = new Audio(messageTone); // "Notification" - clear beep
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

  // --- 3. WebRTC Signaling & Realtime Presence via Supabase ---
  useEffect(() => {
    if (!currentUser) return;

    // Use a unique channel for signaling and presence
    const channel = supabase.channel('signaling', {
      config: {
        presence: {
          key: currentUser.id,
        },
      },
    });
    signalingChannelRef.current = channel;

    const updatePresence = async () => {
      if (currentUserRef.current) {
        // Track presence immediately.
        // We removed the visibility check to ensure the Green Dot stays ON even if the user minimizes the browser or switches tabs.
        // Supabase Realtime will automatically handle "untracking" when the socket disconnects (e.g. closing the tab).
        try {
          await channel.track({
            user_id: currentUserRef.current.id,
            name: currentUserRef.current.name,
            online_at: new Date().toISOString(),
          });
        } catch (e) { console.error('Presence track error', e); }
      }
    };

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const activeIds = new Set<string>();
        Object.values(state).forEach((presences: any) => {
          presences.forEach((p: any) => {
            if (p.user_id) activeIds.add(p.user_id);
          });
        });
        setPresentIds(activeIds);
      })
      .on('broadcast', { event: 'signal' }, async ({ payload }) => {
        const { type, senderId, recipientId, payload: signalPayload } = payload as SignalData;

        // Ignore if not meant for us (unless public)
        if (recipientId && recipientId !== currentUser.id && type !== 'USER_ONLINE') return;
        if (senderId === currentUser.id) return; // Don't process own messages

        // Access current state via Refs
        const currentIsInCall = isInCallRef.current;
        const currentActiveCallData = activeCallDataRef.current;

        switch (type) {
          case 'USER_ONLINE':
            break;

          case 'ADD_TO_CALL':
            // "Host" told us to connect to a new peer needed for the mesh
            if (currentIsInCall && signalPayload.targetId) {
              // Synchronously whitelist this ID
              meshIntendedParticipantsRef.current.add(signalPayload.targetId);

              // Always whitelist the new peer immediately to prevent BUSY rejection for incoming offers
              setActiveCallData(prev => {
                if (!prev) return null;
                if (prev.participantIds.includes(signalPayload.targetId)) return prev;
                return { ...prev, participantIds: [...prev.participantIds, signalPayload.targetId] };
              });

              // Only initiate if instructed (prevents Glare / Double Offer)
              if (signalPayload.shouldInitiate) {
                await initiateCallConnection(signalPayload.targetId, true, true);
              }
            }
            break;

          case 'OFFER':
            // Multi-user Mesh Logic:
            // If we are already in a call, we accept ANY valid Offer as a new participant (or renegotiation)
            if (currentIsInCall) {
              // Check if sender is already a participant (Renegotiation)
              const isExistingParticipant = activeCallDataRef.current?.participantIds.includes(senderId);
              const isIntendedParticipant = meshIntendedParticipantsRef.current.has(senderId);

              if (isExistingParticipant || isIntendedParticipant) {
                // Standard Renegotiation logic or Accepted Mesh Join
                let pc = peerConnectionsRef.current.get(senderId);
                if (!pc) {
                  // Should exist if participant, but handle edge case
                  let stream = localStreamRef.current || localAudioStreamRef.current;
                  pc = createPeerConnection(senderId);

                  // Ensure we add tracks!
                  if (stream) {
                    stream.getTracks().forEach(track => {
                      // Avoid adding duplicate tracks if PC recycled (unlikely here as !pc)
                      pc!.addTrack(track, stream!);
                    });
                  }
                }
                if (pc) {
                  // Clean up pending offers logic for this user if we are accepting now
                  pendingOffersRef.current.delete(senderId);

                  // Reset retry logic if we are accepting
                  autoConnectRetriesRef.current.delete(senderId);

                  await pc.setRemoteDescription(new RTCSessionDescription(signalPayload.sdp));
                  processQueuedCandidates(pc, senderId); // Flush candidates after setting Remote Description
                  // If we are "Passively" accepting (we didn't initiate), we must Answer.
                  if (pc.signalingState === 'have-remote-offer') {
                    // Explicitly request audio/video to ensure bi-directional media
                    const answer = await pc.createAnswer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
                    await pc.setLocalDescription(answer);
                    sendSignal('ANSWER', senderId, { sdp: { type: answer.type, sdp: answer.sdp } });
                  }

                  // Ensure we add to active list if not already (for the 'isIntended' case)
                  if (!isExistingParticipant) {
                    setActiveCallData(prev => {
                      if (!prev) return null;
                      if (prev.participantIds.includes(senderId)) return prev;
                      return { ...prev, participantIds: [...prev.participantIds, senderId] };
                    });
                  }
                }
              } else {
                // New caller trying to interrupt/join -> Send BUSY
                // Do NOT process offer yet.
                sendSignal('BUSY', senderId, {});

                // Store offer temporarily in case they "Wait" and we accept
                pendingOffersRef.current.set(senderId, signalPayload);
              }
              return;
            }

            // Normal Incoming Call (Not in a call yet)
            setIncomingCall({
              callerId: senderId,
              timestamp: Date.now(),
              offer: signalPayload.sdp
            });
            break;

          case 'BUSY':
            // We called someone, and they are busy
            // Check if this was an automatic mesh connection (Add to Call)
            if (autoConnectRetriesRef.current.has(senderId)) {
              const retries = autoConnectRetriesRef.current.get(senderId) || 0;
              if (retries < 3) {
                console.log(`Auto-connect to ${senderId} was busy (race condition). Retrying in 2s... (${retries + 1}/3)`);
                autoConnectRetriesRef.current.set(senderId, retries + 1);
                setTimeout(() => {
                  initiateCallConnection(senderId, true, true);
                }, 2000);
              } else {
                console.warn(`Auto-connect to ${senderId} failed after retries. Giving up.`);
                autoConnectRetriesRef.current.delete(senderId);
              }
              // Do NOT show the modal
            } else {
              // Manual call -> Show modal
              setRecipientBusy(senderId);
            }
            break;

          case 'WAIT_NOTIFY':
            // Caller decided to wait. Show Incoming Call Overlay even if busy.
            // We retrieve the pending offer if it exists
            const pendingOffer = pendingOffersRef.current.get(senderId);
            setIncomingCall({
              callerId: senderId,
              timestamp: Date.now(),
              offer: pendingOffer ? pendingOffer.sdp : undefined
            });
            break;

          case 'ANSWER':
            {
              const pc = peerConnectionsRef.current.get(senderId);
              if (pc) {
                await pc.setRemoteDescription(new RTCSessionDescription(signalPayload.sdp));
                processQueuedCandidates(pc, senderId); // Flush candidates after setting processing Answer

                setActiveCallData(prev => {
                  if (!prev) return null;
                  if (prev.participantIds.includes(senderId)) return prev;
                  return { ...prev, participantIds: [...prev.participantIds, senderId] };
                });

                // Mesh Introduction: Introduce this new peer to all other known participants
                // This ensures that if A calls [B, C], when B answers, B is told to call C (and C to call B)
                // We use ID comparison to ensure only ONE side initiates to avoid Glare/Duplicate connections.
                const currentParticipants = activeCallDataRef.current?.participantIds || [];
                currentParticipants.forEach(pid => {
                  if (pid !== senderId && pid !== currentUser.id) {
                    // We have B (sender) and C (pid). We are A.
                    // We tell them to connect.
                    // To avoid duplicate offers, we establish a convention:
                    // The one with the "Lower" ID initiates.

                    // Actually, we can just tell our existing peer (pid) to add the new guy (senderId).
                    // But pid might be offline/connecting.
                    // Safer Strategy: Sending ADD_TO_CALL is a command "You should connect to X".

                    // Let's send ADD_TO_CALL to 'senderId' to connect to 'pid'
                    // AND to 'pid' to connect to 'senderId'.
                    // But we guard execution in ADD_TO_CALL or initiateCallConnection to check existing presence.

                    // Optimization: Only the "Host" (us) needs to send this? 
                    // Since we are the hub A, we know both.

                    // Deterministic Initiation to prevent Glare (Double Offer) and BUSY overrides
                    // Convention: Lower ID initiates the connection.
                    const shouldSenderInitiate = senderId < pid;

                    sendSignal('ADD_TO_CALL', senderId, { targetId: pid, shouldInitiate: shouldSenderInitiate });
                    sendSignal('ADD_TO_CALL', pid, { targetId: senderId, shouldInitiate: !shouldSenderInitiate });
                  }
                });
              }
            }
            break;

          case 'DROP_PARTICIPANT':
            {
              const targetId = signalPayload.targetId;
              if (targetId) {
                if (targetId === currentUser.id) {
                  // I am being dropped/timed-out by the host/others
                  console.log("Received DROP_PARTICIPANT for ME. Ending call.");
                  endCall();
                } else {
                  // Someone else is being dropped
                  console.log("Received DROP_PARTICIPANT for", targetId);
                  handleRemoteHangup(targetId);
                }
              }
            }
            break;

          case 'CANDIDATE':
            {
              // Robust Candidate Handling: Queue if PC doesn't exist OR Remote Description isn't set yet.
              // This is critical for preventing candidates from being dropped during the initial connection handshake.
              const pc = peerConnectionsRef.current.get(senderId);
              if (pc && pc.remoteDescription) {
                try {
                  await pc.addIceCandidate(new RTCIceCandidate(signalPayload.candidate));
                } catch (e) {
                  console.error("Error adding ice candidate", e);
                }
              } else {
                if (!pendingCandidatesRef.current.has(senderId)) pendingCandidatesRef.current.set(senderId, []);
                pendingCandidatesRef.current.get(senderId)!.push(signalPayload.candidate);
              }
            }
            break;

          case 'HANGUP':
            // Check if we have a pending incoming call from this sender (Missed Call Scenario)
            if (incomingCallRef.current && incomingCallRef.current.callerId === senderId) {
              // The caller hung up before we answered
              const usersList = usersRef.current;
              const caller = usersList.find(u => u.id === senderId);
              const callerName = caller ? caller.name : 'Unknown User';

              // 1. Create Missed Call Notification
              const { error: notifError } = await supabase.from('notifications').insert({
                id: 'n-' + Date.now() + Math.random(),
                recipient_id: currentUser.id,
                sender_id: senderId,
                type: NotificationType.MISSED_CALL,
                title: 'Missed Call',
                message: `You missed a call from ${callerName}`,
                timestamp: Date.now(),
                read: false,
                link_to: senderId
              });
              if (notifError) console.error("Error creating missed call notification:", notifError);

              // 2. Create Missed Call Chat Message
              const { error: msgError } = await supabase.from('messages').insert({
                id: 'm-' + Date.now() + Math.random(),
                sender_id: senderId,
                recipient_id: currentUser.id,
                text: 'Missed Call',
                timestamp: Date.now(),
                type: 'missed_call',
                attachments: []
              });
              if (msgError) console.error("Error creating missed call message:", msgError);

              setIncomingCall(null);
            }

            handleRemoteHangup(senderId);
            break;
          case 'CHAT_MESSAGE': {
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

          case 'SCREEN_STOPPED': {
            try {
              const { hasCameraFallback } = signalPayload as any;
              if (!hasCameraFallback) {
                setRemoteStreams(prev => {
                  const newMap = new Map(prev);
                  const existing = newMap.get(senderId);
                  if (!existing) return prev;
                  const audioTracks = existing.getAudioTracks();
                  const newStream = new MediaStream(audioTracks);
                  newMap.set(senderId, newStream);
                  return newMap;
                });
              }
            } catch (e) { console.error('Error handling SCREEN_STOPPED', e); }
            break;
          }
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          isSignalingConnectedRef.current = true;
          updatePresence();
          sendSignal('USER_ONLINE', undefined, {});
        } else {
          isSignalingConnectedRef.current = false;
        }
      });

    // Activity listener to track "Active Now" accurately
    const onVisibilityChange = () => updatePresence();
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      isSignalingConnectedRef.current = false;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (signalingChannelRef.current) supabase.removeChannel(signalingChannelRef.current);
    };
  }, [currentUser?.id]); // DEPENDENCY NARROWED: Only re-run if ID changes (login/logout)


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
    cleanupCall();
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

  const createPeerConnection = (recipientId: string) => {
    const pc = new RTCPeerConnection(RTC_CONFIG);

    // Connection Timeout Logic: Auto-hangup if connection is not established within 15s
    // This allows every participant (Caller and peers) to independently clean up if a user doesn't answer/connect.
    setTimeout(() => {
      if (pc.signalingState !== 'closed') {
        const state = pc.connectionState;
        // If still trying to connect after 15s, assume failed/ignored
        if (state !== 'connected') {
          console.warn(`Connection to ${recipientId} timed out (State: ${state}). Cleaning up.`);
          pc.close();
          peerConnectionsRef.current.delete(recipientId);
          setActiveCallData(prev => {
            if (!prev) return null;
            // Remove the timed-out participant
            return {
              ...prev,
              participantIds: prev.participantIds.filter(id => id !== recipientId)
            };
          });

          // Broadcast removal to others (Sync state)
          // If we detect a timeout, we assume they are unresponsive for everyone.
          const currentCall = activeCallDataRef.current;

          if (currentCall) {
            currentCall.participantIds.forEach(pid => {
              if (pid !== recipientId && pid !== currentUser?.id) {
                sendSignal('DROP_PARTICIPANT', pid, { targetId: recipientId });
              }
            });
          }
        }
      }
    }, 60000);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal('CANDIDATE', recipientId, { candidate: event.candidate.toJSON() });
      }
    };

    pc.ontrack = (event) => {
      // Improve Stream Stability:
      // We must avoid creating a new MediaStream object if one already exists for this user.
      // Re-creating the stream object causes the <CallAudioPlayer> to re-mount/re-effect, which can interrupt audio.
      const track = event.track;

      setRemoteStreams(prev => {
        const newMap = new Map<string, MediaStream>(prev);
        let stream = newMap.get(recipientId);

        if (stream) {
          // Stream exists. Only add track if it's not already there.
          // Note: We mutate the EXISTING stream object.
          if (!stream.getTracks().find(t => t.id === track.id)) {
            stream.addTrack(track);
          }
          // We trigger a state update with the copied Map, but the stream *reference* stays the same.
          // This prevents CallAudioPlayer from reloading.
        } else {
          // New stream needed. Prefer the one from the event if available (browser managed).
          if (event.streams && event.streams[0]) {
            stream = event.streams[0];
          } else {
            stream = new MediaStream([track]);
          }
          newMap.set(recipientId, stream);
        }
        return newMap;
      });
    };

    peerConnectionsRef.current.set(recipientId, pc);
    return pc;
  };

  // Compose a preview local stream from separate audio/video streams
  const composeLocalStream = () => {
    const tracks: MediaStreamTrack[] = [];
    if (localAudioStreamRef.current) tracks.push(...localAudioStreamRef.current.getTracks());
    if (localVideoStreamRef.current) tracks.push(...localVideoStreamRef.current.getTracks());
    const composed = new MediaStream(tracks);
    setLocalStream(composed);
    localStreamRef.current = composed;
  };

  const renegotiate = async () => {
    // Use Ref to ensure we have the latest stream even if state closure is stale
    const currentLocalStream = localStreamRef.current || localStream;
    if (!currentLocalStream) return;
    for (const [recipientId, pc] of peerConnectionsRef.current.entries()) {
      try {
        const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
        await pc.setLocalDescription(offer);
        sendSignal('OFFER', recipientId, { sdp: { type: offer.type, sdp: offer.sdp } });
      } catch (e) {
        console.error("Renegotiation failed", e);
      }
    }
  };

  const toggleMic = async () => {
    let audioStream = localAudioStreamRef.current || localAudioStream;

    // If no audio stream yet, request mic permission and create one
    if (!audioStream) {
      try {
        const newAudioStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
        const newTrack = newAudioStream.getAudioTracks()[0];

        // Re-check devices now that we have permission
        const devices = await navigator.mediaDevices.enumerateDevices();
        setHasAudioDevice(devices.some(d => d.kind === 'audioinput'));
        setHasVideoDevice(devices.some(d => d.kind === 'videoinput'));

        setLocalAudioStream(newAudioStream);
        localAudioStreamRef.current = newAudioStream;
        setIsMicOn(true);

        // Attach audio track to all peer connections
        for (const [recipientId, pc] of peerConnectionsRef.current.entries()) {
          const sender = pc.getSenders().find((s: RTCRtpSender) => s.track && s.track.kind === 'audio');
          if (sender) {
            try { await sender.replaceTrack(newTrack); } catch (e) { console.error('replaceTrack audio failed', e); }
          } else {
            try { pc.addTrack(newTrack, newAudioStream); } catch (e) { console.error('addTrack audio failed', e); }
          }
        }

        // Update preview stream
        composeLocalStream();
        await renegotiate();
        return;
      } catch (e) {
        console.error('Failed to acquire microphone:', e);
        alert('Could not access microphone.');
        return;
      }
    }

    // Toggle enabled state on existing audio tracks (avoid removing sender.track)
    const audioTracks = audioStream.getAudioTracks();
    const newStatus = !isMicOn;
    audioTracks.forEach(t => t.enabled = newStatus);
    setIsMicOn(newStatus);

    // Ensure senders have a live track when unmuting
    if (newStatus) {
      const active = audioTracks.find(t => t.readyState === 'live') || audioTracks[0];
      if (active) {
        for (const [recipientId, pc] of peerConnectionsRef.current.entries()) {
          const sender = pc.getSenders().find((s: RTCRtpSender) => s.track && s.track.kind === 'audio');
          if (sender) {
            // Replace track to ensure the latest active track is being sent
            try { await sender.replaceTrack(active); } catch (e) { console.error('replaceTrack audio on unmute failed', e); }
          } else {
            // Only if we don't have a sender do we need to add track
            try { pc.addTrack(active, audioStream); } catch (e) { console.error('addTrack audio on unmute failed', e); }
          }
        }
        // Force renegotiation to sync potentially new track IDs or state with peers
        // This is critical if the mic was toggled while the connection was still initializing (e.g. before 'connected' state)
        await renegotiate();
      }
    }

  };

  // NO composeLocalStream() or renegotiate() here.
  // Changing 'enabled' does not require stream recreation or signaling.
  // We used to do it, but it causes flicker/interruption.
  // renegotiate(); // <--- This was the cause of the issue? No, we WANT to renegotiate if we changed tracks.
  // But if we just toggled enabled=true/false without replacing track, we don't need it.
  // HOWEVER, in the "glitch" scenario, we MIGHT have replaced track if the original was dead.
  // My previous edit ADDED renegotiate() inside the if(newStatus) block.
  // So we are good.

  // Just closing the function properly.

  // This prevents the local video element from reloading (flickering).


  const toggleCamera = async () => {
    // operate on localVideoStream only
    let videoStream = localVideoStreamRef.current || localVideoStream;

    if (isCameraOn) {
      if (!videoStream) return;
      // stop camera tracks that are not screen
      videoStream.getVideoTracks().forEach(t => {
        if (!t.label.includes('screen') && !(t.getSettings && (t.getSettings() as any).displaySurface)) {
          t.stop();
          videoStream!.removeTrack(t);
        }
      });
      setLocalVideoStream(videoStream.getTracks().length ? videoStream : null);
      localVideoStreamRef.current = localVideoStream;
      setIsCameraOn(false);

      // Update peers: clear video sender
      for (const [recipientId, pc] of peerConnectionsRef.current.entries()) {
        const sender = pc.getSenders().find((s: RTCRtpSender) => s.track && s.track.kind === 'video');
        if (sender) {
          try { await sender.replaceTrack(null); } catch (e) { console.error('replaceTrack null video failed', e); }
        }
      }

      composeLocalStream();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      const videoTrack = stream.getVideoTracks()[0];

      // If we were screen sharing, stop it first (mutually exclusive video track for simplicity)
      if (isScreenSharing) {
        await stopScreenSharing();
      }

      // Set local video stream
      const newVideoStream = new MediaStream([videoTrack]);
      setLocalVideoStream(newVideoStream);
      localVideoStreamRef.current = newVideoStream;
      setIsCameraOn(true);

      // Update peers
      for (const [recipientId, pc] of peerConnectionsRef.current.entries()) {
        const sender = pc.getSenders().find((s: RTCRtpSender) => s.track && s.track.kind === 'video');
        if (sender) {
          try { await sender.replaceTrack(videoTrack); } catch (e) { console.error('replaceTrack video failed', e); }
        } else {
          try { pc.addTrack(videoTrack, newVideoStream); } catch (e) { console.error('addTrack video failed', e); }
        }
      }

      composeLocalStream();
      await renegotiate();
    } catch (e) {
      console.error('Failed to access camera', e);
    }
  };

  const startCall = async (recipientId: string) => {
    await startGroupCall([recipientId]);
  };

  const startGroupCall = async (recipientIds: string[]) => {
    if (!currentUser || recipientIds.length === 0) return;

    let stream = localStream;
    if (!stream) {
      try {
        // Start with Audio ON (permission wise) but Muted, Video OFF
        stream = await navigator.mediaDevices.getUserMedia({
          video: false,
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });

        // Re-check devices now that we have permission
        const devices = await navigator.mediaDevices.enumerateDevices();
        setHasAudioDevice(devices.some(d => d.kind === 'audioinput'));
        setHasVideoDevice(devices.some(d => d.kind === 'videoinput'));

        // Start with Audio ON (Performance enhancement for real-time connection)
        stream.getAudioTracks().forEach(t => t.enabled = true);
        setIsMicOn(true);
        setIsCameraOn(false);
      } catch (e) {
        console.error("Error getting user media", e);
        alert("Could not access microphone. Call cannot start. Please check your browser permissions.");
        return;
      }
      setLocalStream(stream);
      // Update refs
      localStreamRef.current = stream;
      if (stream.getAudioTracks().length > 0) localAudioStreamRef.current = new MediaStream(stream.getAudioTracks());
    }

    setIsInCall(true);
    setActiveCallData({ participantIds: recipientIds });

    recipientIds.forEach(async (recipientId) => {
      try {
        const pc = createPeerConnection(recipientId);
        stream!.getTracks().forEach(track => pc.addTrack(track, stream!));
        const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
        await pc.setLocalDescription(offer);
        sendSignal('OFFER', recipientId, { sdp: { type: offer.type, sdp: offer.sdp } });
      } catch (e) {
        console.error(`Failed to call ${recipientId}`, e);
      }
    });
  };

  const addToCall = async (recipientId: string) => {
    if (!currentUser || !isInCall || !activeCallData) return;

    // 1. Host connects to New User
    await initiateCallConnection(recipientId, true, false); // Host manual add -> isMeshAutoConnect = false (or true? Host shouldn't see busy for new user? Actually Host is explicitly calling, so Seeing busy is ok if new guy is busy.)
    // Wait, if Host calls New User, and New User is Busy, Host SHOULD see Busy Modal. So keep isMeshAutoConnect = false.

    // 2. Host tells ALL existing participants to connect to New User
    // REMOVED: This logic caused a race condition where peers tried to connect to the new user 
    // BEFORE the new user had accepted the Host's call/setup their socket.
    // We now rely on the 'ANSWER' handler (Lines ~752). When the New User answers the Host,
    // the Host's 'ANSWER' handler triggers the 'ADD_TO_CALL' signal to all other peers.
    // This ensures the New User is actually online and ready.

    /* 
    activeCallData.participantIds.forEach(existingPid => {
      if (existingPid !== recipientId) { 
        sendSignal('ADD_TO_CALL', existingPid, { targetId: recipientId, shouldInitiate: true });
      }
    }); 
    */

    setActiveCallData(prev => prev ? { ...prev, participantIds: [...prev.participantIds, recipientId] } : null);
  };

  const initiateCallConnection = async (recipientId: string, isAdding: boolean = false, isMeshAutoConnect: boolean = false) => {

    if (isMeshAutoConnect) {
      // Init retry counter if not present
      if (!autoConnectRetriesRef.current.has(recipientId)) {
        autoConnectRetriesRef.current.set(recipientId, 0);
      }
    } else {
      // Manual call, ensure no leftover retry state
      autoConnectRetriesRef.current.delete(recipientId);
    }
    // Safety: If we already have a connection, don't overwrite it unless necessary
    if (peerConnectionsRef.current.has(recipientId)) {
      // We might want to check state? If 'closed', allowed.
      if (peerConnectionsRef.current.get(recipientId)?.signalingState !== 'closed') {
        return;
      }
    }

    try {
      let stream = localStreamRef.current || localStream;

      // Ensure we have a stream
      if (!stream) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: false,
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            }
          });

          // Re-check devices now that we have permission
          const devices = await navigator.mediaDevices.enumerateDevices();
          setHasAudioDevice(devices.some(d => d.kind === 'audioinput'));
          setHasVideoDevice(devices.some(d => d.kind === 'videoinput'));

          // Start with Audio ON (Performance enhancement for real-time connection)
          stream.getAudioTracks().forEach(t => t.enabled = true);
          setLocalStream(stream);
          // Update refs
          localStreamRef.current = stream;
          if (stream.getAudioTracks().length > 0) localAudioStreamRef.current = new MediaStream(stream.getAudioTracks());
          setIsMicOn(true);
        }
        catch (e) {
          console.error("No audio device found", e);
          alert("Could not access microphone.");
          return;
        }
      }

      const pc = createPeerConnection(recipientId);
      stream.getTracks().forEach(track => pc.addTrack(track, stream!));

      const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
      await pc.setLocalDescription(offer);
      sendSignal('OFFER', recipientId, { sdp: { type: offer.type, sdp: offer.sdp } });
    } catch (err) { console.error("Error initiating connection:", err); }
  }

  const acceptIncomingCall = async () => {
    if (!incomingCall || !currentUser) return;
    try {
      let stream: MediaStream;
      // Re-use existing stream if available (Merging calls)
      if (!localStreamRef.current) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: false,
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            }
          });

          // Re-check devices now that we have permission
          const devices = await navigator.mediaDevices.enumerateDevices();
          setHasAudioDevice(devices.some(d => d.kind === 'audioinput'));
          setHasVideoDevice(devices.some(d => d.kind === 'videoinput'));

          // Start with Audio ON (Performance enhancement for real-time connection)
          stream.getAudioTracks().forEach(t => t.enabled = true);
          setIsMicOn(true);
          setIsCameraOn(false);
          setIsCameraOn(false);
        }
        catch (e) {
          console.error("Could not access microphone", e);
          alert("Could not access microphone. Please check your browser permissions.");
          return;
        }
        setLocalStream(stream);
        // Update refs immediately for safety
        localStreamRef.current = stream;
        if (stream.getAudioTracks().length > 0) localAudioStreamRef.current = new MediaStream(stream.getAudioTracks());
      } else {
        // We are already in a call, reuse the existing stream
        stream = localStreamRef.current!;
      }

      const pc = createPeerConnection(incomingCall.callerId);
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      if (incomingCall.offer) {
        await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));
        processQueuedCandidates(pc, incomingCall.callerId); // Flush candidates after setting Remote Description
        // Explicitly request audio/video in answer to ensure direction is sendrecv
        const answer = await pc.createAnswer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
        await pc.setLocalDescription(answer);
        sendSignal('ANSWER', incomingCall.callerId, { sdp: { type: answer.type, sdp: answer.sdp } });
      }

      setIsInCall(true);
      setActiveTab('chat');

      // Update Active Call Data (Merge Logic)
      setActiveCallData(prev => {
        const currentIds = prev ? prev.participantIds : [];
        if (currentIds.includes(incomingCall.callerId)) return prev;
        return { participantIds: [...currentIds, incomingCall.callerId] };
      });

      // Mesh: Introduce new participant to existing ones
      if (activeCallDataRef.current) {
        activeCallDataRef.current.participantIds.forEach(pid => {
          if (pid !== incomingCall.callerId) {
            // Deterministic Initiation to prevent Glare (Double Offer) and BUSY overrides
            // Convention: Lower ID initiates the connection.
            const shouldCallerInitiate = incomingCall.callerId < pid;

            sendSignal('ADD_TO_CALL', incomingCall.callerId, { targetId: pid, shouldInitiate: shouldCallerInitiate });
            sendSignal('ADD_TO_CALL', pid, { targetId: incomingCall.callerId, shouldInitiate: !shouldCallerInitiate });
          }
        });
      }

      setIncomingCall(null);

      // REMOVED: The forced renegotiation timeout. 
      // It was causing 'Glare' (collision) where the Callee sent an Offer back to the Caller 
      // while the initial connection was still stabilizing, leading to failure.
      // We rely on the initial ANSWER and Candidate exchange to establish media.

      // Process Queued Offers (Mesh scenarios where invites arrived simultaneously)
      if (pendingOffersRef.current.size > 0) {
        console.log("Processing queued offers:", pendingOffersRef.current.size);
        const queued = Array.from(pendingOffersRef.current.entries());
        pendingOffersRef.current.clear();

        queued.forEach(async ([senderId, payload]) => {
          try {
            // 1. Create PC
            let pc = peerConnectionsRef.current.get(senderId);
            if (!pc) {
              pc = createPeerConnection(senderId);
              stream!.getTracks().forEach(track => pc!.addTrack(track, stream!)); // Use the stream we just acquired in this scope

              // Add to participants list
              setActiveCallData(prev => {
                if (!prev) return { participantIds: [incomingCall.callerId, senderId] };
                if (prev.participantIds.includes(senderId)) return prev;
                return { ...prev, participantIds: [...prev.participantIds, senderId] };
              });
            }

            // 2. Handle Offer
            await pc!.setRemoteDescription(new RTCSessionDescription(payload.sdp));
            processQueuedCandidates(pc!, senderId);
            // Explicitly request audio/video
            const answer = await pc!.createAnswer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
            await pc!.setLocalDescription(answer);
            sendSignal('ANSWER', senderId, { sdp: { type: answer.type, sdp: answer.sdp } });
          } catch (e) {
            console.error("Error processing queued offer from", senderId, e);
          }
        });
      }

    } catch (err) { console.error("Error accepting call:", err); }
  };

  const waitToCall = () => {
    if (recipientBusy) {
      sendSignal('WAIT_NOTIFY', recipientBusy, {});
      setRecipientBusy(null); // Clear busy state, wait for their overlay logic
    }
  };

  const cancelCallWait = () => {
    if (recipientBusy) {
      const busyUserId = recipientBusy;

      // Close connection to the busy user
      const pc = peerConnectionsRef.current.get(busyUserId);
      if (pc) {
        pc.close();
        peerConnectionsRef.current.delete(busyUserId);
      }

      // Check if we have any OTHER active participants we are trying to reach
      // using ref to ensure latest state
      const currentParticipants = activeCallDataRef.current?.participantIds || [];
      const remaining = currentParticipants.filter(id => id !== busyUserId);

      if (remaining.length === 0) {
        // No one else in the call -> End everything instantly to return to Chat
        cleanupCall();
      } else {
        // Others exist, just remove busy user
        setActiveCallData(prev => prev ? { ...prev, participantIds: remaining } : null);
      }
    }
    setRecipientBusy(null);
  };

  const rejectIncomingCall = async (isMissed: boolean = false) => {
    if (incomingCall && currentUser) {
      if (isMissed) {
        const caller = users.find(u => u.id === incomingCall.callerId);
        const callerName = caller ? caller.name : 'Unknown';

        // Notification
        await supabase.from('notifications').insert({
          id: 'n-' + Date.now() + Math.random(),
          recipient_id: currentUser.id,
          sender_id: incomingCall.callerId,
          type: NotificationType.MISSED_CALL,
          title: 'Missed Call',
          message: `You missed a call from ${callerName}`,
          timestamp: Date.now(),
          read: false,
          link_to: incomingCall.callerId
        });

        // Chat Message
        await supabase.from('messages').insert({
          id: 'm-' + Date.now() + Math.random(),
          sender_id: incomingCall.callerId,
          recipient_id: currentUser.id,
          text: 'Missed Call',
          timestamp: Date.now(),
          type: 'missed_call',
          attachments: []
        });
      }
      // 1. Hangup on the primary caller
      sendSignal('HANGUP', incomingCall.callerId, {});

      // 2. Hangup on any other pending callers (Group Mesh scenarios)
      pendingOffersRef.current.forEach((_, callerId) => {
        sendSignal('HANGUP', callerId, {});
      });

      setIncomingCall(null);
      pendingOffersRef.current.clear();
    }
  };

  // Auto-hangup incoming call after 10 seconds if not answered
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    if (incomingCall) {
      timeoutId = setTimeout(() => {
        console.log("Auto-rejecting call due to 10s timeout");
        rejectIncomingCall(true);
      }, 10000);
    }
    return () => clearTimeout(timeoutId);
  }, [incomingCall]); // Dependency ensures timer resets if call state changes


  const endCall = () => {
    if (activeCallData && currentUser) {
      activeCallData.participantIds.forEach(pid => { sendSignal('HANGUP', pid, {}); });
    }
    cleanupCall();
  };

  const handleRemoteHangup = (senderId: string) => {
    // Broadcast drop to others to ensure sync (Mesh Relay)
    const currentCall = activeCallDataRef.current;
    if (currentCall && currentCall.participantIds.includes(senderId)) {
      currentCall.participantIds.forEach(pid => {
        if (pid !== senderId && pid !== currentUser?.id) {
          sendSignal('DROP_PARTICIPANT', pid, { targetId: senderId });
        }
      });
    }

    const pc = peerConnectionsRef.current.get(senderId);
    if (pc) { pc.close(); peerConnectionsRef.current.delete(senderId); }
    setRemoteStreams(prev => { const newMap = new Map(prev); newMap.delete(senderId); return newMap; });
    setActiveCallData(prev => {
      if (!prev) return null;
      const newIds = prev.participantIds.filter(id => id !== senderId);
      if (newIds.length === 0) { cleanupCall(); return null; }
      return { ...prev, participantIds: newIds };
    });
  };

  const cleanupCall = () => {
    // Stop audio and video streams explicitly
    if (localAudioStreamRef.current) {
      localAudioStreamRef.current.getTracks().forEach(t => t.stop());
      localAudioStreamRef.current = null;
      setLocalAudioStream(null);
    }
    if (localVideoStreamRef.current) {
      localVideoStreamRef.current.getTracks().forEach(t => t.stop());
      localVideoStreamRef.current = null;
      setLocalVideoStream(null);
    }
    peerConnectionsRef.current.forEach((pc: RTCPeerConnection) => pc.close());
    peerConnectionsRef.current.clear();
    setLocalStream(null);
    setRemoteStreams(new Map());
    setIsInCall(false);
    setActiveCallData(null);
    setIsScreenSharing(false);
    setIsMicOn(false);
    setIsCameraOn(false);
    setIsMicOn(false);
    setIsCameraOn(false);
    pendingOffersRef.current.clear();
    pendingCandidatesRef.current.clear();
  };

  const stopScreenSharing = async () => {
    const vStream = localVideoStreamRef.current || localVideoStream;
    const aStream = localAudioStreamRef.current || localAudioStream;
    if (peerConnectionsRef.current.size === 0 || !vStream) return;
    try {

      let negotiationNeeded = false;
      let hasCameraFallback = false;

      // 1. If camera was on before screen share, re-acquire camera FIRST (Make-Before-Break)
      if (prevCameraWasOnRef.current) {
        try {
          const camStream = await navigator.mediaDevices.getUserMedia({ video: true });
          const camTrack = camStream.getVideoTracks()[0];

          // Set new local state (this might briefly show camera + screen in memory, but UI will update)
          const newVideoStream = new MediaStream([camTrack]);
          setLocalVideoStream(newVideoStream);
          localVideoStreamRef.current = newVideoStream;
          setIsCameraOn(true);
          hasCameraFallback = true;

          // Replace tracks on all peers
          for (const [recipientId, pc] of peerConnectionsRef.current.entries()) {
            const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
            if (sender) {
              try {
                await sender.replaceTrack(camTrack);
                // Reset bitrate for camera (e.g. 1Mbps)
                const params = sender.getParameters();
                if (params.encodings && params.encodings[0]) {
                  params.encodings[0].maxBitrate = 1000000;
                  delete params.encodings[0].networkPriority;
                  await sender.setParameters(params);
                }
              } catch (e) { hasCameraFallback = false; console.error('replaceTrack camera failed', e); }
            } else {
              try {
                pc.addTrack(camTrack, newVideoStream);
                negotiationNeeded = true;
              } catch (e) { console.error('addTrack camera failed', e); }
            }
          }
        } catch (e) {
          console.error('Failed to re-acquire camera after screen stop:', e);
          // Fallback: clear video senders
          for (const [recipientId, pc] of peerConnectionsRef.current.entries()) {
            const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
            if (sender) {
              try { await sender.replaceTrack(null); } catch (e) { console.error('replaceTrack null video failed', e); }
            }
          }
        }
        prevCameraWasOnRef.current = false;
      } else {
        // No camera to restore: clear video senders
        for (const [recipientId, pc] of peerConnectionsRef.current.entries()) {
          const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
          if (sender) {
            try { await sender.replaceTrack(null); } catch (e) { console.error('replaceTrack null video failed', e); }
          }
        }
      }

      // 2. NOW Stop and remove screen tracks (Break)
      vStream.getVideoTracks().forEach((track: MediaStreamTrack) => {
        if (track.label.includes('screen') || (track.getSettings && (track.getSettings() as any).displaySurface)) {
          track.stop();
          vStream.removeTrack(track); // Clean up the old stream object
        }
      });

      setIsScreenSharing(false);

      // Ensure audio senders still have correct audio track
      if (aStream) {
        const activeAudio = aStream.getAudioTracks().find(t => t.readyState === 'live');
        if (activeAudio) {
          for (const [recipientId, pc] of peerConnectionsRef.current.entries()) {
            const sender = pc.getSenders().find((s: RTCRtpSender) => s.track && s.track.kind === 'audio');
            if (sender && sender.track !== activeAudio) {
              try { await sender.replaceTrack(activeAudio); } catch (e) { console.error('replaceTrack audio failed', e); }
            }
          }
        }
      }

      // Update preview
      composeLocalStream();

      if (negotiationNeeded) {
        await renegotiate();
      }

      // Notify peers to update their remote preview state
      // IMPORTANT: Pass hasCameraFallback so they don't screen-black the video
      try { await sendSignal('SCREEN_STOPPED', undefined, { hasCameraFallback }); } catch (e) { /* non-fatal */ }
    } catch (e) {
      console.error('Error stopping screen share:', e);
    }
  };

  const toggleScreenShare = async () => {
    const vStream = localVideoStreamRef.current || localVideoStream;
    if (peerConnectionsRef.current.size === 0) return;

    if (isScreenSharing) {
      await stopScreenSharing();
    } else {
      try {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            // @ts-ignore
            cursor: 'always',
            // High Quality Screen Sharing (Allow up to 4K, but don't force it if system struggles)
            width: { ideal: 3840, max: 3840 },
            height: { ideal: 2160, max: 2160 },
            frameRate: { ideal: 30, max: 60 }
          },
          audio: false
        });
        const screenTrack = displayStream.getVideoTracks()[0];

        // 'text' ensures the encoder prioritizes sharpness/text legibility
        if ('contentHint' in screenTrack) (screenTrack as any).contentHint = 'text';

        // Ensure we prioritize smooth playback
        const settings = screenTrack.getSettings();
        // @ts-ignore
        if (screenTrack.kind === 'video' && typeof screenTrack.contentHint !== 'undefined') {
          // handled via sender below
        }

        let oldCameraStream: MediaStream | null = null;

        // 1. Prepare Local State (Make)
        // We create the new stream wrapper immediately to be ready for the UI update.
        // Note: We don't stop the old camera YET. This is "Make-Before-Break".
        const newVideoStream = new MediaStream([screenTrack]);

        if (isCameraOn) {
          prevCameraWasOnRef.current = true;
          if (localVideoStreamRef.current) {
            oldCameraStream = localVideoStreamRef.current;
          }
          setIsCameraOn(false);
        } else {
          prevCameraWasOnRef.current = false;
        }

        // 2. Update UI (Switch) -> Flicker Reduction: Do this close to track replacement
        setLocalVideoStream(newVideoStream);
        localVideoStreamRef.current = newVideoStream;

        screenTrack.onended = () => { stopScreenSharing(); };

        let negotiationNeeded = false;

        // Update all peers
        for (const [recipientId, pc] of peerConnectionsRef.current.entries()) {
          const sender = pc.getSenders().find((s: RTCRtpSender) => s.track && s.track.kind === 'video');
          if (sender) {
            try {
              await sender.replaceTrack(screenTrack);

              // Optimized 4K Settings: 6 Mbps (Balanced Performance/Quality)
              const params = sender.getParameters();
              if (!params.encodings) params.encodings = [{}];

              params.encodings[0].maxBitrate = 6000000; // 6 Mbps is sufficient for sharp screen share without choking

              // 'balanced' allows framerate/resolution trade-offs to prevent "Slowness" or Stuttering
              // @ts-ignore
              params.degradationPreference = 'balanced';

              params.encodings[0].networkPriority = 'high';
              await sender.setParameters(params);
            } catch (e) {
              console.error('replaceTrack/setParameters screen failed', e);
              // Fallback if parameter setting fails (e.g. not supported in some states)
            }
          } else {
            try {
              const sender = pc.addTrack(screenTrack, newVideoStream);

              // Apply quality settings immediately for new tracks too
              const params = sender.getParameters();
              if (!params.encodings) params.encodings = [{}];
              params.encodings[0].maxBitrate = 6000000;
              // @ts-ignore
              params.degradationPreference = 'balanced';
              params.encodings[0].networkPriority = 'high';
              await sender.setParameters(params);

              negotiationNeeded = true;
            } catch (e) { console.error('addTrack screen failed', e); }
          }
        }

        // NOW stop the old camera tracks (Make-Before-Break)
        if (oldCameraStream) {
          oldCameraStream.getVideoTracks().forEach(t => {
            t.stop();
            // oldCameraStream!.removeTrack(t); // Optional, stream is discarded anyway
          });
        }

        setIsScreenSharing(true);
        composeLocalStream();

        // Force renegotiation to ensure consistent state for all peers (especially in mesh)
        // This ensures late joiners or peers with varying states get the correct video track info
        await renegotiate();

        try { await sendSignal('SCREEN_STARTED', undefined, {}); } catch (e) { /* non-fatal */ }
      } catch (err: any) { console.error('Error starting screen share:', err); }
    }
  };

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