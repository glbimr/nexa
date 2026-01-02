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

    return (
        <div className="flex flex-col h-full bg-slate-50/50">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/20 bg-white/40 backdrop-blur-md">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-200">
                        <CalendarIcon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">
                            {currentDate.toLocaleString('default', { month: 'long' })} {currentDate.getFullYear()}
                        </h1>
                        <p className="text-sm text-slate-500 font-medium">Schedule and manage your team meetings</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex items-center bg-white rounded-xl shadow-sm border border-slate-200 p-1">
                        <button
                            onClick={prevMonth}
                            className="p-2 hover:bg-slate-50 rounded-lg transition-colors"
                        >
                            <ChevronLeft className="w-5 h-5 text-slate-600" />
                        </button>
                        <button
                            onClick={() => setCurrentDate(new Date())}
                            className="px-4 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 rounded-lg transition-colors border-x border-slate-100 mx-1"
                        >
                            Today
                        </button>
                        <button
                            onClick={nextMonth}
                            className="p-2 hover:bg-slate-50 rounded-lg transition-colors"
                        >
                            <ChevronRight className="w-5 h-5 text-slate-600" />
                        </button>
                    </div>

                    <button
                        onClick={() => handleOpenModal()}
                        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95"
                    >
                        <Plus className="w-5 h-5" />
                        <span>Schedule</span>
                    </button>
                </div>
            </div>

            {/* Calendar Grid */}
            <div className="flex-1 overflow-hidden p-6">
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
                            const isSelected = selectedDay && selectedDay.getDate() === day;

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

                                    {/* Add button on hover */}
                                    <div
                                        className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
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

            {/* Meeting Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={selectedMeeting ? 'Edit Meeting' : 'Schedule Meeting'}
                maxWidth="max-w-xl"
            >
                <div className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700 ml-1">Title</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="e.g. Weekly Sync with Marketing"
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-800"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-700 ml-1">Start Time</label>
                            <div className="relative">
                                <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="datetime-local"
                                    value={startTime}
                                    onChange={(e) => setStartTime(e.target.value)}
                                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-800"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-700 ml-1">Duration</label>
                            <select
                                value={duration}
                                onChange={(e) => setDuration(e.target.value)}
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-800"
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
                        <label className="text-sm font-bold text-slate-700 ml-1">Description</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="What is this meeting about?"
                            rows={3}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-800 resize-none"
                        />
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between items-center mb-1">
                            <label className="text-sm font-bold text-slate-700 ml-1">Participants</label>
                            <span className="text-xs text-slate-400">{participantIds.length} selected</span>
                        </div>
                        <div className="flex flex-wrap gap-2 p-3 bg-slate-50 border border-slate-200 rounded-2xl max-h-32 overflow-y-auto no-scrollbar">
                            {users.map(u => (
                                <button
                                    key={u.id}
                                    type="button"
                                    onClick={() => {
                                        if (participantIds.includes(u.id)) {
                                            setParticipantIds(prev => prev.filter(id => id !== u.id));
                                        } else {
                                            setParticipantIds(prev => [...prev, u.id]);
                                        }
                                    }}
                                    className={`flex items-center gap-2 pl-1 pr-3 py-1 rounded-full border transition-all ${participantIds.includes(u.id)
                                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-100'
                                        : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300'
                                        }`}
                                >
                                    <img src={u.avatar} alt={u.name} className="w-5 h-5 rounded-full object-cover" />
                                    <span className="text-xs font-semibold">{u.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>



                    <div className="flex items-center justify-between pt-4 gap-4">
                        {selectedMeeting ? (
                            <button
                                onClick={() => handleDeleteMeeting(selectedMeeting.id)}
                                className="flex items-center gap-2 px-6 py-3 bg-rose-50 text-rose-600 rounded-2xl font-bold hover:bg-rose-100 transition-all"
                            >
                                <Trash2 className="w-5 h-5" />
                                <span>Delete</span>
                            </button>
                        ) : <div />}

                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="px-8 py-3 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveMeeting}
                                className="px-10 py-3 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all"
                            >
                                {selectedMeeting ? 'Update' : 'Schedule'}
                            </button>
                        </div>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
