
import React, { useState, useMemo } from 'react';
import type { SkateSession } from './types';
import { useSkateTracker } from './useSkateTracker';
import SkateboardIcon from './SkateboardIcon';
import CalendarView from './CalendarView';

const formatDistance = (meters: number) => {
    if (meters < 1000) return `${meters.toFixed(0)} m`;
    return `${(meters / 1000).toFixed(2)} km`;
};

const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
};

const formatSpeed = (mps: number) => {
    const kph = mps * 3.6;
    return `${kph.toFixed(1)} km/h`;
};

const StatCard: React.FC<{ label: string; value: string; className?: string }> = ({ label, value, className }) => (
    <div className={`bg-neutral-800 p-3 rounded-lg text-center ${className}`}>
        <div className="text-2xl font-bold text-white">{value}</div>
        <div className="text-xs text-neutral-400 uppercase tracking-wider">{label}</div>
    </div>
);

const DeleteIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" fill="#ef4444" className="group-hover:fill-red-500 transition-colors"/>
        <path d="M15 9L9 15M9 9L15 15" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
);

const isSameDay = (d1: Date, d2: Date) =>
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();

const RollometerPage: React.FC<{
    onClose: () => void;
    sessions: SkateSession[];
    onAddSession: (session: SkateSession) => void;
    onDeleteSession: (sessionId: string) => void;
    onViewSession: (session: SkateSession) => void;
    onSetPage?: (page: any) => void; // Make optional for backward compatibility if needed, but should be passed
}> = ({ onClose, sessions, onAddSession, onDeleteSession, onViewSession, onSetPage }) => {

    const { trackerState, error, startTracking, stopTracking } = useSkateTracker(onAddSession);
    const { status, totalDistance, activeTime, currentSpeed, topSpeed } = trackerState;
    const isTracking = status === 'tracking';

    const [selectedDate, setSelectedDate] = useState(new Date());
    const [displayMonth, setDisplayMonth] = useState(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
    const [filterType, setFilterType] = useState<'day' | 'week' | 'month' | 'year' | 'all'>('all');
    const [viewMode, setViewMode] = useState<'menu' | 'tracker'>('menu');

    const handleDateSelect = (date: Date) => {
        setSelectedDate(date);
        setDisplayMonth(new Date(date.getFullYear(), date.getMonth(), 1));
        setFilterType('day');
    };

    const filteredSessions = useMemo(() => {
        const sortedSessions = [...sessions].sort((a, b) => b.startTime - a.startTime);
        if (filterType === 'all') {
            return sortedSessions;
        }

        const selectedYear = selectedDate.getFullYear();
        const selectedMonth = selectedDate.getMonth();
        const selectedDay = selectedDate.getDate();

        switch (filterType) {
            case 'day':
                return sortedSessions.filter(s => isSameDay(new Date(s.startTime), selectedDate));
            case 'week': {
                const startOfWeek = new Date(selectedYear, selectedMonth, selectedDay - selectedDate.getDay());
                startOfWeek.setHours(0, 0, 0, 0);
                const endOfWeek = new Date(startOfWeek);
                endOfWeek.setDate(endOfWeek.getDate() + 7);
                return sortedSessions.filter(s => s.startTime >= startOfWeek.getTime() && s.startTime < endOfWeek.getTime());
            }
            case 'month':
                return sortedSessions.filter(s => {
                    const sessionDate = new Date(s.startTime);
                    return sessionDate.getFullYear() === selectedYear && sessionDate.getMonth() === selectedMonth;
                });
            case 'year':
                 return sortedSessions.filter(s => new Date(s.startTime).getFullYear() === selectedYear);
            default:
                return sortedSessions;
        }
    }, [sessions, selectedDate, filterType]);

    const handleStart = async () => {
        try {
            const result = await navigator.permissions.query({ name: 'geolocation' });
            if (result.state === 'denied') {
                alert("Geolocation permission is denied. Please enable it in your browser settings to use the Rollometer.");
                return;
            }
            startTracking();
        } catch (e) {
            console.error(e);
            alert("Could not request permissions. Your browser may not support this feature.");
        }
    };
    
    const handleDelete = (e: React.MouseEvent, sessionId: string) => {
        e.stopPropagation();
        onDeleteSession(sessionId);
    };

    const FilterButton: React.FC<{ type: typeof filterType; label: string }> = ({ type, label }) => (
        <button
            onClick={() => setFilterType(type)}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                filterType === type ? 'bg-red-600 text-white' : 'bg-neutral-700 hover:bg-neutral-600'
            }`}
        >
            {label}
        </button>
    );

    if (viewMode === 'menu') {
        return (
            <div className="min-h-screen bg-gray-900 text-white p-4 flex flex-col">
                <header className="flex items-center justify-between mb-6 relative h-10">
                    <button onClick={onClose} className="text-white hover:text-gray-300 transition-colors z-10 p-2 -ml-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <h1 className="text-xl font-bold tracking-wider text-gray-100 text-center w-full absolute left-1/2 -translate-x-1/2 pointer-events-none">INVERT TOOLS</h1>
                </header>
                
                <div className="flex-grow flex flex-col justify-center gap-4 max-w-sm mx-auto w-full">
                    <button 
                        onClick={() => onSetPage && onSetPage('skate-game')}
                        className="bg-neutral-800 hover:bg-neutral-700 p-6 rounded-2xl flex flex-col items-center gap-3 transition-all transform hover:scale-105 border border-neutral-700 hover:border-yellow-500 group"
                    >
                        <div className="w-16 h-16 rounded-full bg-yellow-500 flex items-center justify-center group-hover:shadow-[0_0_15px_rgba(234,179,8,0.5)] transition-shadow">
                             <SkateboardIcon className="w-8 h-8 text-white" />
                        </div>
                        <span className="text-xl font-bold">INVERT-The Game</span>
                        <span className="text-xs text-gray-400">Skate or wear a tie</span>
                    </button>

                    <button 
                        onClick={() => setViewMode('tracker')}
                        className="bg-neutral-800 hover:bg-neutral-700 p-6 rounded-2xl flex flex-col items-center gap-3 transition-all transform hover:scale-105 border border-neutral-700 hover:border-red-500 group"
                    >
                        <div className="w-16 h-16 rounded-full bg-[#c52323] flex items-center justify-center group-hover:shadow-[0_0_15px_rgba(197,35,35,0.5)] transition-shadow">
                             <SkateboardIcon className="w-8 h-8 text-white" />
                        </div>
                        <span className="text-xl font-bold">Session Tracker</span>
                        <span className="text-xs text-gray-400">Track speed & distance</span>
                    </button>

                    <button 
                        onClick={() => onSetPage && onSetPage('skate-quiz')}
                        className="bg-neutral-800 hover:bg-neutral-700 p-6 rounded-2xl flex flex-col items-center gap-3 transition-all transform hover:scale-105 border border-neutral-700 hover:border-red-500 group"
                    >
                        <div className="w-16 h-16 rounded-full bg-[#c52323] flex items-center justify-center group-hover:shadow-[0_0_15px_rgba(197,35,35,0.5)] transition-shadow">
                             <span className="text-2xl font-bold">?</span>
                        </div>
                        <span className="text-xl font-bold">Skate Quiz</span>
                        <span className="text-xs text-gray-400">Test your skate knowledge</span>
                    </button>

                    <button 
                        onClick={() => onSetPage && onSetPage('general-quiz')}
                        className="bg-neutral-800 hover:bg-neutral-700 p-6 rounded-2xl flex flex-col items-center gap-3 transition-all transform hover:scale-105 border border-neutral-700 hover:border-blue-500 group"
                    >
                        <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center group-hover:shadow-[0_0_15px_rgba(37,99,235,0.5)] transition-shadow">
                             <span className="text-2xl font-bold">G</span>
                        </div>
                        <span className="text-xl font-bold">General Quiz</span>
                        <span className="text-xs text-gray-400">Test your general knowledge</span>
                    </button>

                    <button 
                        onClick={() => onSetPage && onSetPage('capitals-quiz')}
                        className="bg-neutral-800 hover:bg-neutral-700 p-6 rounded-2xl flex flex-col items-center gap-3 transition-all transform hover:scale-105 border border-neutral-700 hover:border-teal-500 group"
                    >
                        <div className="w-16 h-16 rounded-full bg-teal-500 flex items-center justify-center group-hover:shadow-[0_0_15px_rgba(20,184,166,0.5)] transition-shadow">
                             <span className="text-2xl font-bold">C</span>
                        </div>
                        <span className="text-xl font-bold">Capitals Quiz</span>
                        <span className="text-xs text-gray-400">Explore the world</span>
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 text-white p-4">
            <header className="flex items-center justify-between mb-6 relative h-10">
                <button onClick={() => isTracking ? stopTracking() : setViewMode('menu')} className="text-white hover:text-gray-300 transition-colors z-10 p-2 -ml-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
                <h1 className="text-xl font-bold tracking-wider text-gray-100 text-center w-full absolute left-1/2 -translate-x-1/2 pointer-events-none">Sessions</h1>
            </header>

            <main className="max-w-2xl mx-auto">
                <div className="bg-neutral-800/50 rounded-xl p-6 mb-8 text-center">
                    {error && <p className="text-red-400 mb-4">{error}</p>}
                    {isTracking ? (
                        <>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                                <StatCard label="Distance" value={formatDistance(totalDistance)} />
                                <StatCard label="Active Time" value={formatTime(activeTime)} />
                                <StatCard label="Top Speed" value={formatSpeed(topSpeed)} />
                                <StatCard label="Current Speed" value={formatSpeed(currentSpeed)} />
                            </div>
                            <button onClick={stopTracking} className="w-full max-w-xs px-6 py-4 rounded-lg bg-red-600 text-white font-bold text-lg transition hover:bg-red-700">
                                End Session
                            </button>
                        </>
                    ) : (
                        <>
                            <div className="w-24 h-24 rounded-full bg-[#c52323] flex items-center justify-center mx-auto mb-4">
                               <SkateboardIcon className="w-12 h-12 text-white" />
                            </div>
                             <h2 className="text-2xl font-semibold mb-2">Track Your Session</h2>
                            <p className="text-neutral-400 mb-6">Start the Rollometer to log your distance, speed, and highlights.</p>
                            <button onClick={handleStart} className="w-full max-w-xs px-6 py-4 rounded-lg bg-[#c52323] text-white font-bold text-lg transition hover:bg-red-500">
                                Start Session
                            </button>
                        </>
                    )}
                </div>

                <div>
                    <h2 className="text-lg font-semibold mb-4">Session History</h2>
                    
                    <CalendarView
                        sessions={sessions}
                        selectedDate={selectedDate}
                        onDateSelect={handleDateSelect}
                        currentDisplayMonth={displayMonth}
                        onDisplayMonthChange={setDisplayMonth}
                    />

                    <div className="flex justify-center flex-wrap gap-2 my-4">
                        <FilterButton type="day" label="Day" />
                        <FilterButton type="week" label="Week" />
                        <FilterButton type="month" label="Month" />
                        <FilterButton type="year" label="Year" />
                        <FilterButton type="all" label="All" />
                    </div>

                    {filteredSessions.length === 0 ? (
                        <p className="text-neutral-500 text-center py-8">No sessions found for this period.</p>
                    ) : (
                        <div className="space-y-3">
                            {filteredSessions.map(session => (
                                <div key={session.id} className="group flex items-center bg-neutral-800 rounded-lg hover:bg-neutral-700 transition-colors">
                                    <button onClick={() => onViewSession(session)} className="flex-grow text-left p-4 min-w-0">
                                        <div className="flex justify-between items-center gap-4">
                                            <p className="font-semibold truncate">{new Date(session.startTime).toLocaleString()}</p>
                                            <p className="text-lg font-bold shrink-0">{formatDistance(session.totalDistance)}</p> 
                                        </div>
                                        <div className="text-xs text-neutral-400 mt-1">
                                            Duration: {formatTime((session.endTime - session.startTime) / 1000)}
                                        </div>
                                    </button>
                                    <button 
                                        onClick={(e) => handleDelete(e, session.id)} 
                                        className="px-4 py-2 text-neutral-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                        aria-label="Delete session"
                                    >
                                        <DeleteIcon />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default RollometerPage;
