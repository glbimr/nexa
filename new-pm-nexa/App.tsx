import React, { useState, useRef, useEffect } from 'react';
import { AppProvider, useApp } from './store';
import { Login } from './modules/Login';
import { Dashboard } from './modules/Dashboard';
import { KanbanBoard } from './modules/Kanban';
import { Communication } from './modules/Communication';
import { AdminPanel } from './modules/AdminPanel';
import { Modal } from './components/Modal';
import {
  LayoutDashboard,
  KanbanSquare,
  MessageSquare,
  Settings,
  LogOut,
  Menu,
  X,
  Camera,
  Upload,
  Check,
  Bell,
  CheckCircle2,
  AtSign,
  PhoneMissed,
  Phone,
  Video,
  PhoneOff,
  User as UserIcon,
  ChevronLeft,
  ChevronRight,
  Home,
  Volume2,
  VolumeX,
  MoreHorizontal
} from 'lucide-react';
import { UserRole, NotificationType } from './types';

// Predefined avatars for quick selection
const PREDEFINED_AVATARS = [
  'https://api.dicebear.com/9.x/avataaars/svg?seed=Felix',
  'https://api.dicebear.com/9.x/avataaars/svg?seed=Aneka',
  'https://api.dicebear.com/9.x/avataaars/svg?seed=Willow',
  'https://api.dicebear.com/9.x/avataaars/svg?seed=Scooter',
  'https://api.dicebear.com/9.x/avataaars/svg?seed=Bandit',
  'https://api.dicebear.com/9.x/avataaars/svg?seed=Misty',
  'https://api.dicebear.com/9.x/avataaars/svg?seed=Shadow',
  'https://api.dicebear.com/9.x/avataaars/svg?seed=Leo'
];

const IncomingCallOverlay: React.FC = () => {
  const { incomingCall, users, acceptIncomingCall, rejectIncomingCall } = useApp();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioError, setAudioError] = useState(false);

  useEffect(() => {
    if (incomingCall) {
      // Play Ringtone
      audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2368/2368-preview.mp3');
      audioRef.current.loop = true;

      const playPromise = audioRef.current.play();

      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setAudioError(false);
          })
          .catch(error => {
            console.warn("Audio play failed (autoplay policy):", error);
            setAudioError(true);
          });
      }
    } else {
      // Stop Ringtone
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current = null;
      }
      setAudioError(false);
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [incomingCall]);

  const retryAudio = () => {
    if (audioRef.current) {
      audioRef.current.play()
        .then(() => setAudioError(false))
        .catch(e => console.error(e));
    }
  };

  if (!incomingCall) return null;

  const caller = users.find(u => u.id === incomingCall.callerId);

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex flex-col items-center justify-center animate-in fade-in duration-300">
      <div className="flex flex-col items-center space-y-8">

        <div className="relative">
          {/* Pulsing rings */}
          <div className="absolute inset-0 rounded-full border-2 border-white/20 animate-ping opacity-75"></div>
          <div className="absolute inset-0 rounded-full border-2 border-white/40 animate-ping opacity-50 delay-150"></div>

          <img
            src={caller?.avatar}
            alt={caller?.name}
            className="w-32 h-32 rounded-full border-4 border-white shadow-2xl relative z-10"
          />
          <div className="absolute bottom-0 right-0 bg-indigo-600 text-white p-2 rounded-full z-20 border-2 border-black">
            <Phone size={20} />
          </div>
        </div>

        <div className="text-center text-white space-y-2">
          <h2 className="text-3xl font-bold">{caller?.name || 'Unknown Caller'}</h2>
          <p className="text-indigo-200 animate-pulse text-lg">Incoming Audio Call...</p>
        </div>

        {audioError && (
          <button
            onClick={retryAudio}
            className="flex items-center space-x-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-full transition-colors text-sm"
          >
            <VolumeX size={16} />
            <span>Tap to unmute ringtone</span>
          </button>
        )}

        <div className="flex items-center space-x-12 mt-8">
          <button
            onClick={rejectIncomingCall}
            className="flex flex-col items-center space-y-2 group"
          >
            <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center shadow-lg group-hover:bg-red-600 group-hover:scale-110 transition-all">
              <PhoneOff size={32} className="text-white" />
            </div>
            <span className="text-white text-sm font-medium opacity-80 group-hover:opacity-100">Decline</span>
          </button>

          <button
            onClick={acceptIncomingCall}
            className="flex flex-col items-center space-y-2 group"
          >
            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center shadow-lg group-hover:bg-green-600 group-hover:scale-110 transition-all animate-bounce">
              <Phone size={32} className="text-white" />
            </div>
            <span className="text-white text-sm font-medium opacity-80 group-hover:opacity-100">Accept</span>
          </button>
        </div>

      </div>
    </div>
  );
};

const MainLayout: React.FC = () => {
  const {
    currentUser, logout, updateUser,
    notifications, markNotificationRead, clearNotifications,
    totalUnreadChatCount
  } = useApp();

  const [activeTab, setActiveTab] = useState<'dashboard' | 'projects' | 'chat' | 'admin'>('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Avatar Modal State
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [previewAvatar, setPreviewAvatar] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Notification Modal State
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);

  if (!currentUser) {
    return <Login />;
  }

  // Filter notifications for current user
  const myNotifications = notifications.filter(n => n.recipientId === currentUser.id).sort((a, b) => b.timestamp - a.timestamp);
  const unreadNotificationCount = myNotifications.filter(n => !n.read).length;

  const NavItem = ({ id, icon: Icon, label, badgeCount }: { id: typeof activeTab, icon: any, label: string, badgeCount?: number }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`w-full relative group flex items-center ${isSidebarCollapsed ? 'justify-center px-2' : 'justify-between px-4'} py-3 rounded-lg transition-all ${activeTab === id
        ? 'bg-indigo-600 text-white shadow-md'
        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
        }`}
      title={isSidebarCollapsed ? label : undefined}
    >
      <div className={`flex items-center ${isSidebarCollapsed ? 'justify-center' : 'space-x-3'}`}>
        <Icon size={20} className="shrink-0" />
        {!isSidebarCollapsed && <span className="font-medium whitespace-nowrap overflow-hidden transition-all duration-300">{label}</span>}
      </div>

      {/* Red Dot for Unread Messages - Replaces Numeric Badge */}
      {!isSidebarCollapsed && badgeCount !== undefined && badgeCount > 0 && (
        <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shrink-0"></span>
      )}

      {isSidebarCollapsed && badgeCount !== undefined && badgeCount > 0 && (
        <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-slate-900 z-10 animate-pulse"></span>
      )}
    </button>
  );

  const BottomNavItem = ({ id, icon: Icon, label, badgeCount }: { id: typeof activeTab, icon: any, label: string, badgeCount?: number }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex flex-col items-center justify-center w-full p-2 ${activeTab === id
        ? 'text-indigo-600'
        : 'text-slate-400 hover:text-slate-600'
        }`}
    >
      <div className="relative">
        <Icon size={24} strokeWidth={activeTab === id ? 2.5 : 2} className="transition-all" />
        {badgeCount !== undefined && badgeCount > 0 && (
          <span className="absolute top-0 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
        )}
      </div>
      <span className="text-[10px] font-medium mt-1">{label}</span>
    </button>
  );

  const handleOpenAvatarModal = () => {
    setPreviewAvatar(currentUser.avatar);
    setIsAvatarModalOpen(true);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setPreviewAvatar(url);
    }
  };

  const handleSaveAvatar = () => {
    updateUser({ ...currentUser, avatar: previewAvatar });
    setIsAvatarModalOpen(false);
  };

  return (
    <div className="flex h-[100dvh] bg-slate-50 overflow-hidden">
      <IncomingCallOverlay />

      {/* Desktop Sidebar (Hidden on Mobile) */}
      <aside className={`
        hidden md:flex flex-col z-50 bg-slate-900 text-white transition-all duration-300 ease-in-out shadow-xl h-full relative
        ${isSidebarCollapsed ? 'w-20' : 'w-64'}
      `}>
        {/* Sidebar Toggle Button */}
        <button
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className="absolute -right-3 top-9 bg-indigo-600 hover:bg-indigo-700 text-white p-1 rounded-full shadow-lg border-2 border-slate-50 flex items-center justify-center w-6 h-6 z-50 transition-transform hover:scale-110"
          title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {isSidebarCollapsed ? <ChevronRight size={12} strokeWidth={3} /> : <ChevronLeft size={12} strokeWidth={3} />}
        </button>

        {/* Header */}
        <div className={`p-6 border-b border-slate-800 flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-between'} transition-all`}>
          <div className="flex items-center space-x-2 overflow-hidden">
            <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center font-bold text-white shrink-0 shadow-lg shadow-indigo-500/20">N</div>
            {!isSidebarCollapsed && <span className="text-xl font-bold whitespace-nowrap animate-in fade-in slide-in-from-left-2 duration-300">Nexus PM</span>}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-2 overflow-y-auto overflow-x-hidden">
          <NavItem id="dashboard" icon={LayoutDashboard} label="Dashboard" />
          <NavItem id="projects" icon={KanbanSquare} label="Projects" />
          <NavItem id="chat" icon={MessageSquare} label="Team Chat" badgeCount={totalUnreadChatCount} />
          {currentUser.role === UserRole.ADMIN && (
            <NavItem id="admin" icon={Settings} label="Admin Panel" />
          )}
        </nav>

        {/* Footer Section */}
        <div className="p-3 border-t border-slate-800 space-y-3">
          {/* Notification Button */}
          <button
            onClick={() => setIsNotificationOpen(true)}
            className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center' : 'space-x-3 px-3'} py-2.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors relative group`}
            title="Notifications"
          >
            <div className="relative">
              <Bell size={20} />
              {unreadNotificationCount > 0 && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-slate-900 animate-pulse"></span>
              )}
            </div>
            {!isSidebarCollapsed && <span className="text-sm font-medium">Notifications</span>}
          </button>

          {/* User Profile - Now Clickable for Settings/Logout */}
          <button
            onClick={handleOpenAvatarModal}
            className={`w-full flex items-center rounded-lg hover:bg-slate-800 transition-colors text-left ${isSidebarCollapsed ? 'justify-center p-2' : 'px-3 py-2'}`}
            title="Profile & Settings"
          >
            <div
              className="relative w-9 h-9 group/avatar flex-shrink-0"
            >
              <img
                src={currentUser.avatar}
                alt="User"
                className="w-full h-full rounded-full border-2 border-slate-700 group-hover/avatar:border-indigo-500 transition-colors object-cover"
              />
              <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity">
                <MoreHorizontal size={16} className="text-white" />
              </div>
            </div>

            {!isSidebarCollapsed && (
              <div className="ml-3 flex-1 min-w-0 animate-in fade-in slide-in-from-left-2 duration-300">
                <p className="text-sm font-medium truncate text-white">{currentUser.name}</p>
                <p className="text-xs text-slate-500 capitalize">{currentUser.role.toLowerCase()}</p>
              </div>
            )}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full relative w-full overflow-hidden">
        {/* Mobile Header */}
        <header className="md:hidden bg-white border-b border-slate-200 p-3 px-4 flex items-center justify-between shrink-0 z-20 shadow-sm">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white text-sm font-bold shadow-indigo-200 shadow-lg">N</div>
            <span className="font-bold text-slate-800 text-lg tracking-tight">Nexus</span>
          </div>

          <div className="flex items-center space-x-4">
            <button
              onClick={() => setIsNotificationOpen(true)}
              className="text-slate-600 relative p-1.5 hover:bg-slate-100 rounded-full transition-colors"
            >
              <Bell size={24} />
              {unreadNotificationCount > 0 && (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
              )}
            </button>

            <button
              onClick={handleOpenAvatarModal}
              className="relative w-9 h-9 cursor-pointer ring-2 ring-transparent active:ring-indigo-100 rounded-full transition-all"
            >
              <img src={currentUser.avatar} alt="User" className="w-full h-full rounded-full border border-slate-200 object-cover" />
            </button>
          </div>
        </header>

        <div className={`flex-1 bg-slate-50 relative ${activeTab === 'chat' ? 'overflow-hidden flex flex-col mb-[64px] md:mb-0' : 'overflow-y-auto scroll-smooth pb-[80px] md:pb-0'}`}>
          {activeTab === 'dashboard' && <Dashboard />}
          {activeTab === 'projects' && <KanbanBoard />}
          {activeTab === 'chat' && <Communication />}
          {activeTab === 'admin' && <AdminPanel />}
        </div>

        {/* Mobile Bottom Navigation */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-50 px-2 pb-safe shadow-[0_-8px_30px_rgba(0,0,0,0.04)] h-[64px] flex items-center justify-around">
          <BottomNavItem id="dashboard" icon={LayoutDashboard} label="Home" />
          <BottomNavItem id="projects" icon={KanbanSquare} label="Projects" />
          <BottomNavItem id="chat" icon={MessageSquare} label="Chat" badgeCount={totalUnreadChatCount} />
          {currentUser.role === UserRole.ADMIN && (
            <BottomNavItem id="admin" icon={Settings} label="Admin" />
          )}
        </nav>
      </main>

      {/* Profile Settings Modal (Wider & Cleaner) */}
      <Modal
        isOpen={isAvatarModalOpen}
        onClose={() => setIsAvatarModalOpen(false)}
        title="Profile Settings"
        maxWidth="max-w-2xl"
      >
        <div className="flex flex-col md:flex-row h-full">
          {/* Left Column: Current Profile & Actions */}
          <div className="w-full md:w-5/12 bg-slate-50 p-6 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-slate-100">
            <div className="relative group mb-4">
              <div className="w-32 h-32 rounded-full p-1 border-4 border-white shadow-xl overflow-hidden bg-white">
                <img src={previewAvatar} alt="Current Avatar" className="w-full h-full rounded-full object-cover" />
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 bg-indigo-600 text-white p-2 rounded-full shadow-md hover:bg-indigo-700 transition-transform hover:scale-110"
                title="Upload Photo"
              >
                <Camera size={18} />
              </button>
            </div>

            <h3 className="text-xl font-bold text-slate-800 mb-1">{currentUser.name}</h3>
            <p className="text-sm text-slate-500 font-medium capitalize mb-6 bg-slate-200/50 px-3 py-1 rounded-full">{currentUser.role.toLowerCase()}</p>

            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              onChange={handleFileUpload}
            />

            <div className="w-full space-y-3 mt-auto">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-2.5 bg-white border border-slate-200 text-slate-600 font-medium rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-all text-sm shadow-sm"
              >
                Upload Custom Photo
              </button>
              <button
                onClick={() => {
                  setIsAvatarModalOpen(false);
                  logout();
                }}
                className="w-full py-2.5 bg-red-50 text-red-600 border border-red-100 font-medium rounded-lg hover:bg-red-100 transition-all text-sm flex items-center justify-center"
              >
                <LogOut size={16} className="mr-2" />
                Sign Out
              </button>
            </div>
          </div>

          {/* Right Column: Avatar Gallery */}
          <div className="w-full md:w-7/12 p-6 flex flex-col">
            <div className="flex-1">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center">
                <span className="flex-1">Select from Gallery</span>
                <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full normal-case">8 styles</span>
              </h4>

              <div className="grid grid-cols-4 gap-4">
                {PREDEFINED_AVATARS.map((avatar, index) => (
                  <button
                    key={index}
                    onClick={() => setPreviewAvatar(avatar)}
                    className={`relative rounded-xl p-1 transition-all group aspect-square flex items-center justify-center ${previewAvatar === avatar
                      ? 'bg-indigo-50 ring-2 ring-indigo-500 ring-offset-2'
                      : 'bg-slate-50 hover:bg-slate-100 hover:ring-2 hover:ring-slate-200 hover:ring-offset-1'
                      }`}
                  >
                    <img src={avatar} alt={`Avatar ${index}`} className="w-full h-full rounded-lg object-contain" />
                    {previewAvatar === avatar && (
                      <div className="absolute -top-1 -right-1 bg-indigo-600 text-white rounded-full p-0.5 border-2 border-white shadow-sm scale-100 transition-transform">
                        <Check size={12} />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-slate-100 flex justify-end space-x-3">
              <button
                onClick={() => setIsAvatarModalOpen(false)}
                className="px-5 py-2.5 text-slate-500 hover:bg-slate-50 rounded-lg transition-colors text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAvatar}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-all shadow-md hover:shadow-lg shadow-indigo-200 text-sm flex items-center"
              >
                <Check size={16} className="mr-2" />
                Save Changes
              </button>
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isNotificationOpen}
        onClose={() => setIsNotificationOpen(false)}
        title="Notifications"
        maxWidth="max-w-xl"
        className="h-[600px] flex flex-col"
        noScroll={true} // Handle scrolling internally for better layout control
      >
        <div className="flex flex-col h-full bg-slate-50/50">
          {/* Header Actions */}
          <div className="flex justify-between items-center px-6 py-3 bg-white border-b border-slate-100 shrink-0">
            <h4 className="text-sm font-semibold text-slate-600 flex items-center">
              Inbox
              {unreadNotificationCount > 0 && (
                <span className="ml-2 bg-red-100 text-red-600 px-2 py-0.5 rounded-full text-xs font-bold">
                  {unreadNotificationCount} New
                </span>
              )}
            </h4>
            {unreadNotificationCount > 0 && (
              <button
                onClick={clearNotifications}
                className="flex items-center space-x-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-full transition-colors"
              >
                <Check size={14} />
                <span>Read All</span>
              </button>
            )}
          </div>

          {/* Notification List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {myNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 py-12">
                <div className="bg-slate-100 p-4 rounded-full mb-3">
                  <Bell size={28} className="opacity-50 text-slate-500" />
                </div>
                <p className="font-medium text-slate-600">All caught up!</p>
                <p className="text-sm">No new notifications for now.</p>
              </div>
            ) : (
              myNotifications.map(n => (
                <div
                  key={n.id}
                  className={`relative group p-4 rounded-xl border transition-all duration-200 cursor-pointer ${n.read
                    ? 'bg-white border-slate-200 hover:border-indigo-200 hover:shadow-sm'
                    : 'bg-white border-indigo-100 shadow-sm ring-1 ring-indigo-50/50'
                    }`}
                  onClick={() => !n.read && markNotificationRead(n.id)}
                >
                  <div className="flex items-start space-x-4">
                    {/* Icon Side */}
                    <div className={`mt-1 p-2.5 rounded-xl shrink-0 ${n.type === NotificationType.MENTION ? 'bg-blue-100 text-blue-600' :
                      n.type === NotificationType.ASSIGNMENT ? 'bg-green-100 text-green-600' :
                        n.type === NotificationType.MISSED_CALL ? 'bg-rose-100 text-rose-600' :
                          'bg-slate-100 text-slate-600'
                      }`}>
                      {n.type === NotificationType.MENTION && <AtSign size={18} />}
                      {n.type === NotificationType.ASSIGNMENT && <CheckCircle2 size={18} />}
                      {n.type === NotificationType.MISSED_CALL && <PhoneMissed size={18} />}
                      {n.type === NotificationType.SYSTEM && <Bell size={18} />}
                    </div>

                    {/* Content Side */}
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-1">
                        <h5 className={`text-sm font-semibold truncate pr-4 ${n.read ? 'text-slate-700' : 'text-slate-900 group-hover:text-indigo-700'}`}>
                          {n.title}
                        </h5>
                        <span className="text-[10px] font-medium text-slate-400 whitespace-nowrap bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                          {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <p className={`text-sm leading-relaxed ${n.read ? 'text-slate-500' : 'text-slate-600'}`}>
                        {n.message}
                      </p>

                      {/* Action Footer */}
                      {n.linkTo && (
                        <div className="mt-3 flex items-center text-indigo-600 font-medium text-xs group-hover:underline decoration-2 underline-offset-2">
                          <span>View details</span>
                          <ChevronRight size={12} className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      )}
                    </div>

                    {/* Unread Indicator Dot */}
                    {!n.read && (
                      <div className="absolute top-4 right-4 w-2 h-2 bg-indigo-500 rounded-full"></div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AppProvider>
      <MainLayout />
    </AppProvider>
  );
};

export default App;