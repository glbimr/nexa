import React, { useState, useMemo } from 'react';
import { useApp } from '../store';
import {
    Calendar as CalendarIcon,
    ChevronLeft,
    ChevronRight,
    Plus,
    Users,
    Clock,
    AlignLeft,
    X,
    Check,
    CalendarDays,
    MoreVertical,
    Trash2,
    CalendarCheck2
} from 'lucide-react';
import { Modal } from '../components/Modal';
import { Meeting } from '../types';

export const Calendar: React.FC = () => {
    const { users, currentUser, meetings, addMeeting, deleteMeeting } = useApp();

    // Calendar State
    const [currentDate, setCurrentDate] = useState(new Date());
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalPage, setModalPage] = useState<'details' | 'users'>('details');

    // Form State
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [meetingDate, setMeetingDate] = useState(new Date().toISOString().split('T')[0]);
    const [startTime, setStartTime] = useState('09:00');
    const [endTime, setEndTime] = useState('10:00');
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
    const [searchUser, setSearchUser] = useState('');

    // Helper to get days in month
    const daysInMonth = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const days = new Date(year, month + 1, 0).getDate();

        const prevMonthDays = new Date(year, month, 0).getDate();
        const padding = firstDay; // Days from prev month to show

        const calendarDays = [];

        // Previous month padding
        for (let i = padding - 1; i >= 0; i--) {
            calendarDays.push({
                day: prevMonthDays - i,
                month: month - 1,
                year: year,
                currentMonth: false
            });
        }

        // Current month
        for (let i = 1; i <= days; i++) {
            calendarDays.push({
                day: i,
                month: month,
                year: year,
                currentMonth: true
            });
        }

        // Next month padding
        const remaining = 42 - calendarDays.length;
        for (let i = 1; i <= remaining; i++) {
            calendarDays.push({
                day: i,
                month: month + 1,
                year: year,
                currentMonth: false
            });
        }

        return calendarDays;
    }, [currentDate]);

    const monthName = currentDate.toLocaleString('default', { month: 'long' });
    const year = currentDate.getFullYear();

    const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    const goToToday = () => setCurrentDate(new Date());

    const handleOpenModal = () => {
        setTitle('');
        setDescription('');
        setMeetingDate(new Date().toISOString().split('T')[0]);
        setStartTime('09:00');
        setEndTime('10:00');
        setSelectedUserIds([]);
        setModalPage('details');
        setIsModalOpen(true);
    };

    const handleCreateMeeting = async () => {
        if (!currentUser || !title) return;

        const startDateTime = new Date(`${meetingDate}T${startTime}`).getTime();
        const endDateTime = new Date(`${meetingDate}T${endTime}`).getTime();

        const newMeeting: Meeting = {
            id: 'mt-' + Date.now(),
            title,
            description: description || null,
            start_time: startDateTime,
            end_time: endDateTime,
            creator_id: currentUser.id,
            participant_ids: selectedUserIds,
        };

        await addMeeting(newMeeting);
        setIsModalOpen(false);
    };

    const filteredUsers = users.filter(u =>
        u.id !== currentUser?.id &&
        (u.name.toLowerCase().includes(searchUser.toLowerCase()) || u.username.toLowerCase().includes(searchUser.toLowerCase()))
    );

    const toggleUser = (userId: string) => {
        setSelectedUserIds(prev =>
            prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
        );
    };

    const getMeetingsForDay = (day: number, month: number, year: number) => {
        return meetings.filter(m => {
            const d = new Date(m.start_time);
            return d.getDate() === day && d.getMonth() === month && d.getFullYear() === year;
        }).sort((a, b) => a.start_time - b.start_time);
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
            {/* Header */}
            <header className="px-6 py-4 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
                <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                            <CalendarIcon size={24} />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-slate-800 leading-tight">{monthName} {year}</h1>
                            <p className="text-xs text-slate-500 font-medium">Manage your team schedule</p>
                        </div>
                    </div>

                    <div className="hidden md:flex items-center bg-slate-100 rounded-lg p-1 ml-4">
                        <button onClick={prevMonth} className="p-1.5 hover:bg-white hover:shadow-sm rounded-md transition-all text-slate-600">
                            <ChevronLeft size={18} />
                        </button>
                        <button onClick={goToToday} className="px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-white hover:shadow-sm rounded-md transition-all mx-1">
                            Today
                        </button>
                        <button onClick={nextMonth} className="p-1.5 hover:bg-white hover:shadow-sm rounded-md transition-all text-slate-600">
                            <ChevronRight size={18} />
                        </button>
                    </div>
                </div>

                <button
                    onClick={handleOpenModal}
                    className="flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all shadow-md shadow-indigo-100 font-bold text-sm"
                >
                    <Plus size={18} className="mr-2" />
                    <span className="hidden sm:inline">Schedule Meeting</span>
                    <span className="sm:hidden">Schedule</span>
                </button>
            </header>

            {/* Main Calendar Grid */}
            <div className="flex-1 overflow-auto custom-scrollbar">
                <div className="min-w-[800px] h-full flex flex-col">
                    {/* Week Days Header */}
                    <div className="grid grid-cols-7 border-b border-slate-200 bg-white">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                            <div key={day} className="py-3 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                {day}
                            </div>
                        ))}
                    </div>

                    {/* Days Grid */}
                    <div className="grid grid-cols-7 flex-1">
                        {daysInMonth.map((d, i) => {
                            const dayMeetings = getMeetingsForDay(d.day, d.month, d.year);
                            const isToday = new Date().getDate() === d.day && new Date().getMonth() === d.month && new Date().getFullYear() === d.year;

                            return (
                                <div
                                    key={i}
                                    className={`min-h-[120px] p-2 border-r border-b border-slate-100 bg-white transition-colors hover:bg-slate-50/50 group ${!d.currentMonth ? 'bg-slate-50/30' : ''}`}
                                >
                                    <div className="flex items-center justify-between mb-1">
                                        <span className={`
                      text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full
                      ${isToday ? 'bg-indigo-600 text-white shadow-md' : d.currentMonth ? 'text-slate-700' : 'text-slate-300'}
                    `}>
                                            {d.day}
                                        </span>
                                    </div>

                                    <div className="space-y-1">
                                        {dayMeetings.slice(0, 3).map(m => (
                                            <div
                                                key={m.id}
                                                className="px-2 py-1 bg-indigo-50 border border-indigo-100 rounded text-[10px] text-indigo-700 font-medium truncate flex items-center"
                                            >
                                                <div className="w-1 h-1 bg-indigo-500 rounded-full mr-1.5 shrink-0" />
                                                {new Date(m.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })} - {m.title}
                                            </div>
                                        ))}
                                        {dayMeetings.length > 3 && (
                                            <div className="text-[10px] text-slate-400 font-bold px-2 py-0.5">
                                                + {dayMeetings.length - 3} more
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Mobile-Friendly Today/Navigation (Only visible on small screens) */}
            <div className="md:hidden flex items-center justify-between p-4 bg-white border-t border-slate-200 shrink-0">
                <div className="flex items-center bg-slate-100 rounded-lg p-1">
                    <button onClick={prevMonth} className="p-2 hover:bg-white rounded-md transition-all text-slate-600">
                        <ChevronLeft size={20} />
                    </button>
                    <button onClick={goToToday} className="px-4 py-2 text-xs font-bold text-slate-700 hover:bg-white hover:shadow-sm rounded-md transition-all mx-1">
                        Today
                    </button>
                    <button onClick={nextMonth} className="p-2 hover:bg-white rounded-md transition-all text-slate-600">
                        <ChevronRight size={20} />
                    </button>
                </div>
            </div>

            {/* Scheduler Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title="Schedule Meeting"
                maxWidth="max-w-xl"
            >
                <div className="flex flex-col h-[500px]">
                    {/* Tab Navigation */}
                    <div className="flex border-b border-slate-100 px-6 shrink-0">
                        <button
                            onClick={() => setModalPage('details')}
                            className={`py-4 px-4 text-xs font-bold uppercase tracking-widest border-b-2 transition-all ${modalPage === 'details' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                        >
                            1. Meeting Details
                        </button>
                        <button
                            onClick={() => setModalPage('users')}
                            className={`py-4 px-4 text-xs font-bold uppercase tracking-widest border-b-2 transition-all ${modalPage === 'users' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                        >
                            2. Add Participants ({selectedUserIds.length})
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                        {modalPage === 'details' ? (
                            <div className="space-y-6 animate-in fade-in slide-in-from-left-2 duration-300">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Meeting Title</label>
                                    <div className="relative">
                                        <CalendarCheck2 className="absolute left-3 top-2.5 text-slate-400" size={18} />
                                        <input
                                            type="text"
                                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none text-sm"
                                            placeholder="e.g. Weekly Sync, Design Review"
                                            value={title}
                                            onChange={e => setTitle(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Description (Optional)</label>
                                    <div className="relative">
                                        <AlignLeft className="absolute left-3 top-3 text-slate-400" size={18} />
                                        <textarea
                                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none text-sm min-h-[100px] resize-none"
                                            placeholder="What's this meeting about?"
                                            value={description}
                                            onChange={e => setDescription(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Date</label>
                                        <div className="relative">
                                            <CalendarDays className="absolute left-3 top-2.5 text-slate-400" size={18} />
                                            <input
                                                type="date"
                                                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none text-sm"
                                                value={meetingDate}
                                                onChange={e => setMeetingDate(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Start</label>
                                            <input
                                                type="time"
                                                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none text-sm"
                                                value={startTime}
                                                onChange={e => setStartTime(e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">End</label>
                                            <input
                                                type="time"
                                                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none text-sm"
                                                value={endTime}
                                                onChange={e => setEndTime(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-300">
                                <div className="relative">
                                    <Users className="absolute left-3 top-2.5 text-slate-400" size={18} />
                                    <input
                                        type="text"
                                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none text-sm"
                                        placeholder="Search team members..."
                                        value={searchUser}
                                        onChange={e => setSearchUser(e.target.value)}
                                    />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {filteredUsers.map(user => (
                                        <button
                                            key={user.id}
                                            onClick={() => toggleUser(user.id)}
                                            className={`
                        flex items-center p-3 rounded-xl border transition-all text-left
                        ${selectedUserIds.includes(user.id)
                                                    ? 'border-indigo-200 bg-indigo-50/50'
                                                    : 'border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50'}
                      `}
                                        >
                                            <img src={user.avatar} className="w-8 h-8 rounded-full border border-white shadow-sm mr-3" alt={user.name} />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-slate-800 truncate">{user.name}</p>
                                                <p className="text-[10px] text-slate-500 truncate lowercase">@{user.username}</p>
                                            </div>
                                            {selectedUserIds.includes(user.id) && (
                                                <div className="w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center text-white shrink-0">
                                                    <Check size={12} strokeWidth={4} />
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                    {filteredUsers.length === 0 && (
                                        <div className="col-span-full py-8 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                                            <p className="text-slate-400 text-sm">No members found</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-4 px-6 border-t border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50 rounded-b-3xl">
                        {modalPage === 'details' ? (
                            <>
                                <div className="text-xs text-slate-400 font-medium">Step 1 of 2</div>
                                <button
                                    onClick={() => setModalPage('users')}
                                    className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-md shadow-indigo-100 text-sm flex items-center"
                                >
                                    Next: Add Users
                                    <ChevronRight size={16} className="ml-1" />
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    onClick={() => setModalPage('details')}
                                    className="text-slate-500 hover:text-slate-700 font-bold text-sm"
                                >
                                    Back
                                </button>
                                <button
                                    onClick={handleCreateMeeting}
                                    disabled={!title}
                                    className="px-8 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all shadow-md shadow-emerald-100 text-sm"
                                >
                                    Create Meeting
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </Modal>
        </div>
    );
};
