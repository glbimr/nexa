import React, { useState, useMemo } from 'react';
import { useApp } from '../store';
import { Meeting, NotificationType } from '../types';
import {
    ChevronLeft,
    ChevronRight,
    Plus,
    Clock,
    Users,
    MapPin,
    X,
    Calendar as CalendarIcon,
    Video,
    ExternalLink,
    MoreVertical,
    Trash2,
    Edit2
} from 'lucide-react';
import { Modal } from '../components/Modal';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function Calendar() {
    const { meetings, currentUser, users, addMeeting, updateMeeting, deleteMeeting, triggerNotification } = useApp();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
    const [selectedDay, setSelectedDay] = useState<Date | null>(null);
    const [activeModalTab, setActiveModalTab] = useState<'details' | 'members'>('details');


    // Form State
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [startTime, setStartTime] = useState('');
    const [duration, setDuration] = useState('60'); // Minutes
    const [participantIds, setParticipantIds] = useState<string[]>([]);

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

    const today = new Date();
    const isToday = (day: number) => {
        return today.getDate() === day &&
            today.getMonth() === currentDate.getMonth() &&
            today.getFullYear() === currentDate.getFullYear();
    };

    const meetingsByDay = useMemo(() => {
        const map: Record<number, Meeting[]> = {};
        if (!currentUser) return map;

        meetings.forEach(m => {
            // Check if user is creator or participant
            const isUserInMeeting = m.creatorId === currentUser.id || m.participantIds.includes(currentUser.id);
            if (!isUserInMeeting) return;

            const d = new Date(m.startTime);
            if (d.getMonth() === currentDate.getMonth() && d.getFullYear() === currentDate.getFullYear()) {
                const date = d.getDate();
                if (!map[date]) map[date] = [];
                map[date].push(m);
            }
        });
        // Sort meetings by time
        Object.keys(map).forEach(key => {
            map[parseInt(key)].sort((a, b) => a.startTime - b.startTime);
        });
        return map;
    }, [meetings, currentDate, currentUser?.id]);

    const handleOpenModal = (day?: number, meeting?: Meeting) => {
        if (meeting) {
            setSelectedMeeting(meeting);
            setTitle(meeting.title);
            setDescription(meeting.description);
            const d = new Date(meeting.startTime);
            setStartTime(d.toISOString().slice(0, 16));
            setDuration(((meeting.endTime - meeting.startTime) / 60000).toString());
            setParticipantIds(meeting.participantIds);
        } else {
            setSelectedMeeting(null);
            setTitle('');
            setDescription('');
            const d = day ? new Date(currentDate.getFullYear(), currentDate.getMonth(), day, 10, 0) : new Date();
            setStartTime(new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
            setDuration('60');
            setParticipantIds([]);
        }
        setActiveModalTab('details');
        setIsModalOpen(true);
    };

    const handleSaveMeeting = async () => {
        if (!currentUser || !title || !startTime) return;

        const start = new Date(startTime).getTime();
        const end = start + parseInt(duration) * 60000;

        const meetingData: Meeting = {
            id: selectedMeeting?.id || 'meet-' + Date.now(),
            title,
            description,
            startTime: start,
            endTime: end,
            creatorId: currentUser.id,
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

    const handleDeleteMeeting = async (id: string) => {
        if (confirm('Are you sure you want to delete this meeting?')) {
            await deleteMeeting(id);
            setIsModalOpen(false);
        }
    };

    const isCreator = selectedMeeting ? selectedMeeting.creatorId === currentUser?.id : true;
    const canEdit = isCreator;


    return (
        <div className="flex flex-col h-full bg-slate-50/50">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/20 bg-white/40 backdrop-blur-md">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-100 hidden md:block">
                        <CalendarIcon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl md:text-2xl font-bold text-slate-900 leading-none mb-1">
                            {currentDate.toLocaleString('default', { month: 'long' })} {currentDate.getFullYear()}
                        </h1>
                        <p className="text-[10px] md:text-sm text-slate-500 font-bold uppercase tracking-widest opacity-60">Team Schedule</p>
                    </div>
                </div>

                <div className="flex items-center gap-2 md:gap-3">
                    <div className="flex flex-col md:flex-row items-center gap-2">
                        <div className="flex items-center bg-white rounded-xl shadow-sm border border-slate-200 p-0.5 md:p-1">
                            <button
                                onClick={prevMonth}
                                className="p-1.5 md:p-2 hover:bg-slate-50 rounded-lg transition-colors"
                            >
                                <ChevronLeft className="w-4 h-4 md:w-5 md:h-5 text-slate-600" />
                            </button>
                            <button
                                onClick={() => {
                                    setCurrentDate(new Date());
                                    setSelectedDay(new Date());
                                }}
                                className="px-3 md:px-4 py-1 md:py-1.5 text-xs md:text-sm font-bold text-slate-700 hover:bg-slate-50 rounded-lg transition-colors border-x border-slate-100 mx-0.5 md:mx-1"
                            >
                                Today
                            </button>
                            <button
                                onClick={nextMonth}
                                className="p-1.5 md:p-2 hover:bg-slate-50 rounded-lg transition-colors"
                            >
                                <ChevronRight className="w-4 h-4 md:w-5 md:h-5 text-slate-600" />
                            </button>
                        </div>

                        <button
                            onClick={() => handleOpenModal()}
                            className="flex items-center justify-center gap-2 px-4 md:px-5 py-2 md:py-2.5 bg-indigo-600 text-white rounded-xl text-xs md:text-sm font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 w-full md:w-auto"
                        >
                            <Plus className="w-4 h-4" />
                            <span>Schedule</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Calendar Grid (Desktop) */}
            <div className="hidden md:flex flex-1 overflow-hidden p-6">
                <div className="h-full border border-white/40 bg-white/20 backdrop-blur-sm rounded-3xl overflow-hidden shadow-2xl shadow-indigo-100 flex flex-col">
                    {/* Days labels */}
                    <div className="grid grid-cols-7 border-b border-slate-200/50 bg-white/50">
                        {DAYS.map(day => (
                            <div key={day} className="py-4 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">
                                {day}
                            </div>
                        ))}
                    </div>

                    {/* Days grid */}
                    <div className="flex-1 grid grid-cols-7 auto-rows-fr overflow-y-auto no-scrollbar">
                        {/* Empty slots for previous month */}
                        {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                            <div key={`empty-${i}`} className="border-r border-b border-slate-100/50 bg-slate-50/10" />
                        ))}

                        {/* Day slots */}
                        {Array.from({ length: daysInMonth }).map((_, i) => {
                            const day = i + 1;
                            const dayMeetings = meetingsByDay[day] || [];

                            return (
                                <div
                                    key={day}
                                    className={`group relative border-r border-b border-slate-100/50 p-3 min-h-[120px] transition-all hover:bg-white/60 cursor-default ${isToday(day) ? 'bg-indigo-50/30' : ''}`}
                                    onClick={() => handleOpenModal(day)}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <span className={`flex items-center justify-center w-8 h-8 text-sm font-bold rounded-full transition-all ${isToday(day) ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100' : 'text-slate-500 group-hover:text-indigo-600'}`}>
                                            {day}
                                        </span>
                                        {dayMeetings.length > 0 && (
                                            <span className="text-[10px] bg-slate-100 text-slate-500 font-bold px-1.5 py-0.5 rounded-md self-center">
                                                {dayMeetings.length}
                                            </span>
                                        )}
                                    </div>

                                    <div className="space-y-1 overflow-y-auto max-h-[80px] no-scrollbar">
                                        {dayMeetings.map(m => (
                                            <div
                                                key={m.id}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleOpenModal(undefined, m);
                                                }}
                                                className="px-2 py-1 bg-white border border-slate-200 rounded-lg shadow-sm hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer group/item overflow-hidden"
                                            >
                                                <div className="flex items-center gap-1.5">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 flex-shrink-0" />
                                                    <span className="text-[11px] font-semibold text-slate-700 truncate">{m.title}</span>
                                                </div>
                                                <div className="flex items-center gap-1 mt-0.5">
                                                    <Clock className="w-2.5 h-2.5 text-slate-400" />
                                                    <span className="text-[9px] text-slate-400 font-medium">
                                                        {new Date(m.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleOpenModal(day);
                                            }}
                                        >
                                            <Plus className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}

                        {/* Padding for end of month */}
                        {Array.from({ length: (7 - ((firstDayOfMonth + daysInMonth) % 7)) % 7 }).map((_, i) => (
                            <div key={`empty-end-${i}`} className="border-r border-b border-slate-100/50 bg-slate-50/10" />
                        ))}
                    </div>
                </div>
            </div>

            {/* Mobile Calendar View */}
            <div className="md:hidden flex flex-col flex-1 overflow-hidden">
                {/* Horizontal Date Scroller */}
                <div className="flex overflow-x-auto p-4 gap-3 no-scrollbar bg-white/50 backdrop-blur-sm border-b border-slate-200">
                    {Array.from({ length: daysInMonth }).map((_, i) => {
                        const day = i + 1;
                        const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
                        const dayName = DAYS[date.getDay()];
                        const isSelected = selectedDay && selectedDay.getDate() === day;
                        const currentDayMeetings = meetingsByDay[day] || [];

                        return (
                            <button
                                key={day}
                                onClick={() => setSelectedDay(date)}
                                className={`flex flex-col items-center justify-center min-w-[50px] h-20 rounded-2xl transition-all border ${isSelected || (!selectedDay && isToday(day))
                                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100 scale-105'
                                    : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300'
                                    }`}
                            >
                                <span className="text-[10px] uppercase font-bold opacity-60 mb-1">{dayName}</span>
                                <span className="text-lg font-bold">{day}</span>
                                {currentDayMeetings.length > 0 && (
                                    <div className={`w-1 h-1 rounded-full mt-1 ${isSelected || (!selectedDay && isToday(day)) ? 'bg-white' : 'bg-indigo-500'}`} />
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Day's Meetings List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest pl-2">
                        {selectedDay ? selectedDay.toDateString() : 'Today\'s Agenda'}
                    </h2>

                    {(meetingsByDay[(selectedDay || today).getDate()] || []).length > 0 ? (
                        (meetingsByDay[(selectedDay || today).getDate()] || []).map(m => (
                            <div
                                key={m.id}
                                onClick={() => handleOpenModal(undefined, m)}
                                className="group p-5 bg-white border border-slate-200 rounded-3xl shadow-sm hover:border-indigo-300 transition-all active:scale-95 flex items-start justify-between"
                            >
                                <div className="space-y-3">
                                    <div className="space-y-1">
                                        <h3 className="font-bold text-slate-800 text-base">{m.title}</h3>
                                        <p className="text-xs text-slate-500 line-clamp-1">{m.description || 'No description'}</p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-1.5 text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg">
                                            <Clock className="w-3.5 h-3.5" />
                                            <span className="text-xs font-bold">
                                                {new Date(m.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <div className="flex -space-x-2">
                                            {m.participantIds.slice(0, 3).map(pid => {
                                                const u = users.find(user => user.id === pid);
                                                return <img key={pid} src={u?.avatar} className="w-6 h-6 rounded-full border-2 border-white object-cover" />;
                                            })}
                                            {m.participantIds.length > 3 && (
                                                <div className="w-6 h-6 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[8px] font-bold text-slate-500">
                                                    +{m.participantIds.length - 3}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <ChevronRight className="w-5 h-5 text-slate-300 self-center" />
                            </div>
                        ))
                    ) : (
                        <div className="flex flex-col items-center justify-center pt-10 text-center space-y-4 px-10">
                            <div className="p-4 bg-slate-100 rounded-full">
                                <CalendarIcon className="w-8 h-8 text-slate-300" />
                            </div>
                            <div>
                                <h3 className="text-slate-600 font-bold">No meetings today</h3>
                                <p className="text-sm text-slate-400 font-medium">Enjoy your free time or schedule a new sync!</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Meeting Modal with Tabbed Pager */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={selectedMeeting ? (isCreator ? 'Meeting Settings' : 'Meeting Details') : 'New Meeting'}
                maxWidth="max-w-md"
            >
                <div className="flex flex-col gap-6">
                    {/* Tab Switcher */}
                    <div className="flex p-1.5 bg-slate-100 rounded-2xl w-full">
                        <button
                            onClick={() => setActiveModalTab('details')}
                            className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-widest rounded-xl transition-all ${activeModalTab === 'details'
                                ? 'bg-white text-indigo-600 shadow-sm'
                                : 'text-slate-400 hover:text-slate-600'
                                }`}
                        >
                            Details
                        </button>
                        <button
                            onClick={() => setActiveModalTab('members')}
                            className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-widest rounded-xl transition-all ${activeModalTab === 'members'
                                ? 'bg-white text-indigo-600 shadow-sm'
                                : 'text-slate-400 hover:text-slate-600'
                                }`}
                        >
                            Members ({participantIds.length})
                        </button>
                    </div>

                    <div className="min-h-[300px]">
                        {activeModalTab === 'details' ? (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Event Title</label>
                                    <input
                                        type="text"
                                        value={title}
                                        readOnly={!canEdit}
                                        onChange={(e) => setTitle(e.target.value)}
                                        placeholder="Add a catchy title..."
                                        className={`w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-slate-800 font-bold text-lg ${!canEdit ? 'bg-white border-transparent' : ''}`}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Starts At</label>
                                        <div className="relative">
                                            <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                            <input
                                                type="datetime-local"
                                                value={startTime}
                                                readOnly={!canEdit}
                                                onChange={(e) => setStartTime(e.target.value)}
                                                className={`w-full pl-11 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-slate-800 text-sm font-semibold ${!canEdit ? 'bg-white border-transparent' : ''}`}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Duration</label>
                                        <select
                                            value={duration}
                                            disabled={!canEdit}
                                            onChange={(e) => setDuration(e.target.value)}
                                            className={`w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-slate-800 text-sm font-semibold appearance-none ${!canEdit ? 'bg-white border-transparent opacity-100' : ''}`}
                                        >
                                            <option value="15">15 Minutes</option>
                                            <option value="30">30 Minutes</option>
                                            <option value="45">45 Minutes</option>
                                            <option value="60">1 Hour</option>
                                            <option value="90">1.5 Hours</option>
                                            <option value="120">2 Hours</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Brief Description</label>
                                    <textarea
                                        value={description}
                                        readOnly={!canEdit}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder="Optional meeting goals..."
                                        rows={3}
                                        className={`w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-slate-800 text-sm font-medium resize-none ${!canEdit ? 'bg-white border-transparent' : ''}`}
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div className="space-y-4">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Selected Team Members</p>
                                    <div className="grid grid-cols-1 gap-2 max-h-[280px] overflow-y-auto pr-2 custom-scrollbar">
                                        {users.map(u => {
                                            const isSelected = participantIds.includes(u.id);
                                            if (!canEdit && !isSelected) return null;
                                            return (
                                                <button
                                                    key={u.id}
                                                    type="button"
                                                    disabled={!canEdit}
                                                    onClick={() => {
                                                        if (participantIds.includes(u.id)) {
                                                            setParticipantIds(prev => prev.filter(id => id !== u.id));
                                                        } else {
                                                            setParticipantIds(prev => [...prev, u.id]);
                                                        }
                                                    }}
                                                    className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${isSelected
                                                        ? 'bg-indigo-50 border-indigo-200'
                                                        : 'bg-white border-slate-100 hover:border-slate-300'
                                                        } disabled:opacity-100`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <img src={u.avatar} alt={u.name} className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm" />
                                                        <div className="text-left">
                                                            <p className={`text-sm font-bold ${isSelected ? 'text-indigo-900' : 'text-slate-700'}`}>{u.name}</p>
                                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">{u.role}</p>
                                                        </div>
                                                    </div>
                                                    {isSelected && <div className="w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center text-white scale-90"><Plus size={14} className="rotate-45" /></div>}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center justify-between pt-6 border-t border-slate-100 mt-2">
                        {selectedMeeting && isCreator ? (
                            <button
                                onClick={() => handleDeleteMeeting(selectedMeeting.id)}
                                className="w-12 h-12 flex items-center justify-center bg-rose-50 text-rose-500 rounded-2xl hover:bg-rose-500 hover:text-white transition-all active:scale-90"
                            >
                                <Trash2 size={20} />
                            </button>
                        ) : <div />}

                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="px-6 py-4 text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors"
                            >
                                {canEdit ? 'Cancel' : 'Close'}
                            </button>
                            {canEdit && (
                                <button
                                    onClick={handleSaveMeeting}
                                    className="px-10 py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 text-sm"
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
