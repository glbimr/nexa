import React, { useState, useMemo } from 'react';
import { useApp } from '../store';
import { Meeting, NotificationType, User } from '../types';
import {
    ChevronLeft,
    ChevronRight,
    Plus,
    Clock,
    Calendar as CalendarIcon,
    Video,
    Trash2,
    MoreVertical,
    CalendarDays,
    List as ListIcon,
    CheckCircle2,
    Users
} from 'lucide-react';
import { Modal } from '../components/Modal';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function Calendar() {
    const { meetings, currentUser, users, addMeeting, updateMeeting, deleteMeeting, triggerNotification } = useApp();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [view, setView] = useState<'month' | 'list'>('month');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);

    // Form State
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [startTime, setStartTime] = useState('');
    const [duration, setDuration] = useState('60'); // Minutes
    const [participantIds, setParticipantIds] = useState<string[]>([]);
    const [activeTab, setActiveTab] = useState<'details' | 'members'>('details');

    // Filter State
    const [filterType, setFilterType] = useState<'all' | 'mine' | 'invited'>('all');

    // Calendar Logic
    const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    const daysInMonth = monthEnd.getDate();
    const firstDayOfMonth = monthStart.getDay();

    const prevMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    };

    const nextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    };

    const isToday = (day: number) => {
        const today = new Date();
        return today.getDate() === day &&
            today.getMonth() === currentDate.getMonth() &&
            today.getFullYear() === currentDate.getFullYear();
    };

    const filteredMeetings = useMemo(() => {
        if (!currentUser) return [];

        let filtered = meetings.filter(m => {
            const isCreator = m.creatorId === currentUser.id;
            const isParticipant = m.participantIds.includes(currentUser.id);

            if (filterType === 'mine') return isCreator;
            if (filterType === 'invited') return isParticipant && !isCreator;
            return isCreator || isParticipant;
        });

        return filtered.sort((a, b) => a.startTime - b.startTime);
    }, [meetings, currentUser, filterType]);

    const meetingsByDay = useMemo(() => {
        const map: Record<number, Meeting[]> = {};
        filteredMeetings.forEach(m => {
            const d = new Date(m.startTime);
            if (d.getMonth() === currentDate.getMonth() && d.getFullYear() === currentDate.getFullYear()) {
                const date = d.getDate();
                if (!map[date]) map[date] = [];
                map[date].push(m);
            }
        });
        return map;
    }, [filteredMeetings, currentDate]);

    const handleOpenModal = (day?: number, m?: Meeting) => {
        if (m) {
            setSelectedMeeting(m);
            setTitle(m.title);
            setDescription(m.description);
            const d = new Date(m.startTime);
            setStartTime(new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
            setDuration(((m.endTime - m.startTime) / 60000).toString());
            setParticipantIds(m.participantIds);
        } else {
            setSelectedMeeting(null);
            setTitle('');
            setDescription('');
            const d = day ? new Date(currentDate.getFullYear(), currentDate.getMonth(), day, 10, 0) : new Date();
            setStartTime(new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
            setDuration('60');
            setParticipantIds([]);
        }
        setActiveTab('details');
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!currentUser || !title || !startTime) return;

        const start = new Date(startTime).getTime();
        const end = start + parseInt(duration) * 60000;

        const meetingData: Meeting = {
            id: selectedMeeting?.id || 'meet-' + Date.now(),
            title,
            description,
            startTime: start,
            endTime: end,
            creatorId: selectedMeeting?.creatorId || currentUser.id,
            participantIds: Array.from(new Set([...participantIds, currentUser.id])),
            createdAt: selectedMeeting?.createdAt || Date.now()
        };

        if (selectedMeeting) {
            await updateMeeting(meetingData);
        } else {
            await addMeeting(meetingData);
            // Notify participants
            participantIds.forEach(pid => {
                if (pid !== currentUser.id) {
                    triggerNotification(
                        pid,
                        NotificationType.SYSTEM,
                        'New Meeting Scheduled',
                        `${currentUser.name} scheduled a meeting: ${title}`,
                        meetingData.id
                    );
                }
            });
        }

        setIsModalOpen(false);
    };

    const handleDelete = async () => {
        if (selectedMeeting && confirm('Delete this meeting?')) {
            await deleteMeeting(selectedMeeting.id);
            setIsModalOpen(false);
        }
    };

    const isCreator = selectedMeeting ? selectedMeeting.creatorId === currentUser?.id : true;

    // Render Month View
    const renderMonthView = () => (
        <div className="flex-1 overflow-hidden p-6 hidden md:flex flex-col">
            <div className="flex-1 border border-white/40 bg-white/20 backdrop-blur-md rounded-3xl overflow-hidden shadow-2xl shadow-indigo-100 flex flex-col">
                <div className="grid grid-cols-7 border-b border-slate-200/50 bg-white/50">
                    {DAYS.map(day => (
                        <div key={day} className="py-4 text-center text-[10px] font-bold text-slate-400 uppercase tracking-[2px]">
                            {day}
                        </div>
                    ))}
                </div>

                <div className="flex-1 grid grid-cols-7 auto-rows-fr overflow-y-auto no-scrollbar">
                    {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                        <div key={`empty-${i}`} className="border-r border-b border-slate-100/50 bg-slate-50/10" />
                    ))}

                    {Array.from({ length: daysInMonth }).map((_, i) => {
                        const day = i + 1;
                        const dayMeetings = meetingsByDay[day] || [];

                        return (
                            <div
                                key={day}
                                className={`group relative border-r border-b border-slate-100/50 p-2 min-h-[120px] transition-all hover:bg-white/60 cursor-default ${isToday(day) ? 'bg-indigo-50/30' : ''}`}
                                onClick={() => handleOpenModal(day)}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <span className={`flex items-center justify-center w-7 h-7 text-xs font-bold rounded-lg transition-all ${isToday(day) ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-500 group-hover:text-indigo-600'}`}>
                                        {day}
                                    </span>
                                </div>

                                <div className="space-y-1 overflow-y-auto max-h-[80px] no-scrollbar">
                                    {dayMeetings.map(m => {
                                        const isOwn = m.creatorId === currentUser?.id;
                                        return (
                                            <div
                                                key={m.id}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleOpenModal(undefined, m);
                                                }}
                                                className={`px-2 py-1.5 border rounded-lg shadow-sm transition-all cursor-pointer group/item overflow-hidden ${isOwn
                                                    ? 'bg-indigo-50 border-indigo-200 hover:border-indigo-400'
                                                    : 'bg-emerald-50 border-emerald-200 hover:border-emerald-400'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-1.5">
                                                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isOwn ? 'bg-indigo-500' : 'bg-emerald-500'}`} />
                                                    <span className="text-[10px] font-bold text-slate-700 truncate">{m.title}</span>
                                                </div>
                                                <div className="flex items-center gap-1 mt-0.5 opacity-60">
                                                    <Clock className="w-2.5 h-2.5" />
                                                    <span className="text-[8px] font-bold uppercase">
                                                        {new Date(m.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                <button
                                    className="absolute bottom-2 right-2 p-1.5 bg-indigo-50 text-indigo-600 rounded-lg opacity-0 group-hover:opacity-100 transition-all shadow-sm hover:bg-indigo-600 hover:text-white"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenModal(day);
                                    }}
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        );
                    })}

                    {Array.from({ length: (7 - ((firstDayOfMonth + daysInMonth) % 7)) % 7 }).map((_, i) => (
                        <div key={`empty-end-${i}`} className="border-r border-b border-slate-100/50 bg-slate-50/10" />
                    ))}
                </div>
            </div>
        </div>
    );

    // Render List View (Desktop & Mobile)
    const renderListView = () => {
        const sortedMeetings = [...filteredMeetings].sort((a, b) => a.startTime - b.startTime);
        const groups: Record<string, Meeting[]> = {};

        sortedMeetings.forEach(m => {
            const dateStr = new Date(m.startTime).toDateString();
            if (!groups[dateStr]) groups[dateStr] = [];
            groups[dateStr].push(m);
        });

        return (
            <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 no-scrollbar bg-slate-50/50">
                {Object.entries(groups).length > 0 ? (
                    Object.entries(groups).map(([date, meetings]) => (
                        <div key={date} className="space-y-4">
                            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[3px] ml-4">
                                {new Date(date).getTime() === new Date(new Date().toDateString()).getTime() ? 'Today' : date}
                            </h3>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                {meetings.map(m => {
                                    const isOwn = m.creatorId === currentUser?.id;
                                    const duration = Math.round((m.endTime - m.startTime) / 60000);
                                    return (
                                        <div
                                            key={m.id}
                                            onClick={() => handleOpenModal(undefined, m)}
                                            className="group p-5 bg-white border border-white rounded-[2rem] shadow-sm hover:shadow-xl hover:shadow-indigo-100 hover:scale-[1.02] transition-all active:scale-[0.98] flex items-center gap-5 cursor-pointer"
                                        >
                                            <div className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center flex-shrink-0 ${isOwn ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                                <Clock className="w-5 h-5 mb-0.5" />
                                                <span className="text-[9px] font-black uppercase">{duration}m</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h4 className="font-bold text-slate-800 truncate">{m.title}</h4>
                                                    <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-tighter ${isOwn ? 'bg-indigo-100 text-indigo-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                                        {isOwn ? 'Host' : 'Guest'}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-slate-400 font-medium line-clamp-1">{m.description || 'No description provided'}</p>
                                            </div>
                                            <div className="text-right flex-shrink-0">
                                                <p className="text-sm font-black text-slate-900 leading-none">
                                                    {new Date(m.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                                <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Starts At</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="w-20 h-20 bg-white rounded-3xl shadow-xl flex items-center justify-center mb-6">
                            <CalendarIcon className="w-10 h-10 text-slate-200" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-700 mb-2">No meetings found</h3>
                        <p className="text-sm text-slate-400 max-w-[280px]">Enjoy your focus time! Or schedule a new sync using the button above.</p>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full overflow-hidden bg-slate-50/30">
            {/* Premium Header */}
            <div className="bg-white/60 backdrop-blur-xl border-b border-white p-6 md:px-8 flex flex-col md:flex-row md:items-center justify-between gap-4 z-10">
                <div className="flex items-center gap-4">
                    <div className="p-3.5 bg-indigo-600 rounded-[1.25rem] shadow-xl shadow-indigo-100">
                        <CalendarIcon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none mb-1">
                            {currentDate.toLocaleString('default', { month: 'long' })} {currentDate.getFullYear()}
                        </h1>
                        <div className="flex items-center gap-2">
                            <button onClick={prevMonth} className="p-1 hover:bg-slate-100 rounded-lg transition-colors"><ChevronLeft size={16} /></button>
                            <button onClick={() => setCurrentDate(new Date())} className="text-[10px] font-black uppercase text-indigo-600 tracking-widest hover:bg-indigo-50 px-2 py-0.5 rounded-md">Today</button>
                            <button onClick={nextMonth} className="p-1 hover:bg-slate-100 rounded-lg transition-colors"><ChevronRight size={16} /></button>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* View Toggle */}
                    <div className="flex p-1 bg-slate-100 rounded-xl">
                        <button
                            onClick={() => setView('month')}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${view === 'month' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <CalendarDays size={14} />
                            <span className="hidden sm:inline">Month</span>
                        </button>
                        <button
                            onClick={() => setView('list')}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${view === 'list' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <ListIcon size={14} />
                            <span className="hidden sm:inline">List</span>
                        </button>
                    </div>

                    <div className="h-8 w-[1px] bg-slate-200 mx-1 hidden sm:block" />

                    {/* Filter Toggle */}
                    <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value as any)}
                        className="bg-white border-white border text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-600"
                    >
                        <option value="all">All Events</option>
                        <option value="mine">Created By Me</option>
                        <option value="invited">Invited Only</option>
                    </select>

                    <button
                        onClick={() => handleOpenModal()}
                        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold shadow-xl shadow-indigo-100 hover:bg-indigo-700 hover:scale-[1.02] active:scale-95 transition-all text-sm"
                    >
                        <Plus size={18} />
                        <span>New Sync</span>
                    </button>
                </div>
            </div>

            {/* Main Content Areas */}
            {view === 'month' ? renderMonthView() : renderListView()}

            {/* Mobile-only view fallback for Month (always show list on small screens if needed, but here we handled month with hidden md:flex) */}
            <div className="md:hidden flex flex-col flex-1 overflow-hidden">
                {renderListView()}
            </div>

            {/* Meeting Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={selectedMeeting ? (isCreator ? 'Meeting Settings' : 'Meeting Details') : 'Ready to Sync?'}
                maxWidth="max-w-md"
            >
                <div className="space-y-6">
                    {/* Tabs */}
                    <div className="flex p-1 bg-slate-100 rounded-2xl">
                        <button
                            onClick={() => setActiveTab('details')}
                            className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'details' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            Details
                        </button>
                        <button
                            onClick={() => setActiveTab('members')}
                            className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'members' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            Participants ({participantIds.length})
                        </button>
                    </div>

                    <div className="min-h-[320px]">
                        {activeTab === 'details' ? (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Event Name</label>
                                    <input
                                        type="text"
                                        value={title}
                                        readOnly={!isCreator}
                                        onChange={(e) => setTitle(e.target.value)}
                                        placeholder="e.g. Brainstorming Session"
                                        className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-slate-800"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Starts At</label>
                                        <input
                                            type="datetime-local"
                                            value={startTime}
                                            readOnly={!isCreator}
                                            onChange={(e) => setStartTime(e.target.value)}
                                            className="w-full px-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-slate-800 text-sm"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Duration</label>
                                        <select
                                            value={duration}
                                            disabled={!isCreator}
                                            onChange={(e) => setDuration(e.target.value)}
                                            className="w-full px-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-slate-800 text-sm"
                                        >
                                            <option value="15">15 min</option>
                                            <option value="30">30 min</option>
                                            <option value="45">45 min</option>
                                            <option value="60">1 hour</option>
                                            <option value="90">1.5 hours</option>
                                            <option value="120">2 hours</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Meeting Goals</label>
                                    <textarea
                                        value={description}
                                        readOnly={!isCreator}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder="What should the team prepare?"
                                        rows={4}
                                        className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-medium text-slate-800 text-sm resize-none"
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Team Members</p>
                                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 no-scrollbar">
                                    {users.map(u => {
                                        const isSelected = participantIds.includes(u.id);
                                        if (!isCreator && !isSelected) return null;
                                        return (
                                            <button
                                                key={u.id}
                                                type="button"
                                                disabled={!isCreator}
                                                onClick={() => {
                                                    if (isSelected) {
                                                        setParticipantIds(prev => prev.filter(id => id !== u.id));
                                                    } else {
                                                        setParticipantIds(prev => [...prev, u.id]);
                                                    }
                                                }}
                                                className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all ${isSelected ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-50 hover:bg-slate-50'}`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <img src={u.avatar} className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm" />
                                                    <div className="text-left">
                                                        <p className="text-sm font-black text-slate-800 leading-none">{u.name}</p>
                                                        <p className="text-[10px] font-bold text-slate-400 mt-0.5">{u.role}</p>
                                                    </div>
                                                </div>
                                                {isSelected && <CheckCircle2 size={20} className="text-indigo-600" />}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center justify-between pt-6 border-t border-slate-100">
                        {selectedMeeting && isCreator ? (
                            <button
                                onClick={handleDelete}
                                className="w-14 h-14 flex items-center justify-center bg-rose-50 text-rose-500 rounded-2xl hover:bg-rose-500 hover:text-white transition-all shadow-sm active:scale-90"
                            >
                                <Trash2 size={22} />
                            </button>
                        ) : <div />}

                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="px-8 py-4 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-slate-800 transition-colors"
                            >
                                {isCreator ? 'Discard' : 'Close'}
                            </button>
                            {isCreator && (
                                <button
                                    onClick={handleSave}
                                    className="px-10 py-4 bg-indigo-600 text-white rounded-[1.5rem] font-black uppercase text-xs tracking-[2px] shadow-xl shadow-indigo-100 hover:bg-indigo-700 hover:scale-[1.05] active:scale-95 transition-all"
                                >
                                    {selectedMeeting ? 'Update' : 'Schedule'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
