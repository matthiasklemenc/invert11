import React, { useState, useMemo } from 'react';
import type { SkateSession } from './types';
import { useSkateTracker } from './useSkateTracker';
import SkateboardIcon from './SkateboardIcon';
import CalendarView from './CalendarView';

// --- ICONS (Simple SVG) ---
const QuestionMarkIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm11.378-3.917c-.89-.777-2.366-.777-3.255 0a.75.75 0 01-.988-1.129c1.454-1.272 3.776-1.272 5.23 0 1.513 1.324 1.513 3.518 0 4.842a3.75 3.75 0 01-.837.552c-.676.328-1.028.774-1.028 1.152v.202a.75.75 0 01-1.5 0v-.202c0-.944.606-1.657 1.336-2.008a2.25 2.25 0 00.5-.33c.505-.442.505-1.217 0-1.659zM12 17.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
    </svg>
);

const CityIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path fillRule="evenodd" d="M3 2.25a.75.75 0 00-.75.75v18a.75.75 0 00.75.75h18a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75h-1.5V9.75a.75.75 0 00-.75-.75h-3V5.25a.75.75 0 00-.75-.75H3zm3.75 6.75a.75.75 0 000 1.5h1.5a.75.75 0 000-1.5h-1.5zm0 3.75a.75.75 0 000 1.5h1.5a.75.75 0 000-1.5h-1.5zm0 3.75a.75.75 0 000 1.5h1.5a.75.75 0 000-1.5h-1.5zm6-6.75a.75.75 0 000 1.5h1.5a.75.75 0 000-1.5h-1.5zm0 3.75a.75.75 0 000 1.5h1.5a.75.75 0 000-1.5h-1.5zm0 3.75a.75.75 0 000 1.5h1.5a.75.75 0 000-1.5h-1.5zm6-6a.75.75 0 000 1.5h1.5a.75.75 0 000-1.5h-1.5zm0 3.75a.75.75 0 000 1.5h1.5a.75.75 0 000-1.5h-1.5zm0 3.75a.75.75 0 000 1.5h1.5a.75.75 0 000-1.5h-1.5z" clipRule="evenodd" />
    </svg>
);

const DeleteIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" fill="#ef4444" className="group-hover:fill-red-500 transition-colors"/>
        <path d="M15 9L9 15M9 9L15 15" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
);

const ControllerIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M19.75 4.5H4.25C2.455 4.5 1 5.955 1 7.75v8.5C1 18.045 2.455 19.5 4.25 19.5h15.5c1.795 0 3.25-1.455 3.25-3.25v-8.5c0-1.795-1.455-3.25-3.25-3.25zM6.25 9.5a1.25 1.25 0 110 2.5 1.25 1.25 0 010-2.5zm2 5a1.25 1.25 0 110 2.5 1.25 1.25 0 010-2.5zm2-2.5a1.25 1.25 0 110 2.5 1.25 1.25 0 010-2.5zm-2-2.5a1.25 1.25 0 110 2.5 1.25 1.25 0 010-2.5zm10.5 5a1.25 1.25 0 110 2.5 1.25 1.25 0 010-2.5zm2.5-2.5a1.25 1.25 0 110 2.5 1.25 1.25 0 010-2.5z" />
    </svg>
);

// utility formats…
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

const RollometerPage: React.FC<{
    onClose: () => void;
    sessions: SkateSession[];
    onAddSession: (session: SkateSession) => void;
    onDeleteSession: (sessionId: string) => void;
    onViewSession: (session: SkateSession) => void;
    onSetPage: (page: any) => void;
}> = ({ onClose, sessions, onAddSession, onDeleteSession, onViewSession, onSetPage }) => {

    const { trackerState, error, startTracking, stopTracking } = useSkateTracker(onAddSession);
    const [stance, setStance] = useState<'REGULAR' | 'GOOFY'>('REGULAR');
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [displayMonth, setDisplayMonth] = useState(new Date());

    const filteredSessions = useMemo(() => {
        return sessions.filter(s =>
            new Date(s.startTime).toDateString() === selectedDate.toDateString()
        ).sort((a, b) => b.startTime - a.startTime);
    }, [sessions, selectedDate]);

    const isTracking = trackerState.status === 'tracking';

    // ------------------------------------------------------------------
    // NEW FIX: unify trick counts from worker
    // ------------------------------------------------------------------
    const trickCounts = trackerState?.counts || {
        ollies: 0,
        airs: 0,
        fsGrinds: 0,
        bsGrinds: 0,
        stalls: 0,
        pumps: 0,
        slams: 0,
    };

    return (
        <div className="min-h-screen bg-gray-900 text-white p-4 sm:p-6 flex flex-col">
            
            {/* Header */}
            <header className="flex items-center justify-between mb-6 relative h-10">
                <button onClick={onClose} className="text-white hover:text-gray-300 transition-colors z-10 p-2 -ml-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
                <h1 className="text-xl font-bold tracking-wider text-gray-100 text-center w-full absolute left-1/2 -translate-x-1/2 pointer-events-none">
                    INVERT TOOLS
                </h1>
            </header>

            <main className="w-full max-w-4xl mx-auto space-y-8">
                
                {/* SKATE GAME + QUIZ GRID */}
                <section>
                    <div className="grid grid-cols-2 gap-4">
                        <button onClick={() => onSetPage('skate-game')} className="bg-neutral-800 p-4 rounded-xl border border-white/5 flex flex-col items-center justify-center gap-3 h-32 hover:bg-neutral-700 transition-colors group">
                            <ControllerIcon className="w-10 h-10 text-yellow-500 group-hover:scale-110 transition-transform" />
                            <span className="font-bold text-sm tracking-wide">SKATE GAME</span>
                        </button>

                        <button onClick={() => onSetPage('skate-quiz')} className="bg-neutral-800 p-4 rounded-xl border border-white/5 flex flex-col items-center justify-center gap-3 h-32 hover:bg-neutral-700 transition-colors group">
                            <SkateboardIcon className="w-10 h-10 text-[#c52323] group-hover:scale-110 transition-transform" />
                            <span className="font-bold text-sm tracking-wide">SKATE QUIZ</span>
                        </button>

                        <button onClick={() => onSetPage('general-quiz')} className="bg-neutral-800 p-4 rounded-xl border border-white/5 flex flex-col items-center justify-center gap-3 h-32 hover:bg-neutral-700 transition-colors group">
                            <QuestionMarkIcon className="w-10 h-10 text-blue-500 group-hover:scale-110 transition-transform" />
                            <span className="font-bold text-sm tracking-wide">GENERAL QUIZ</span>
                        </button>

                        <button onClick={() => onSetPage('capitals-quiz')} className="bg-neutral-800 p-4 rounded-xl border border-white/5 flex flex-col items-center justify-center gap-3 h-32 hover:bg-neutral-700 transition-colors group">
                            <CityIcon className="w-10 h-10 text-teal-500 group-hover:scale-110 transition-transform" />
                            <span className="font-bold text-sm tracking-wide">CAPITALS QUIZ</span>
                        </button>
                    </div>
                </section>

                <div className="border-t border-white/10 my-8"></div>

                {/* ---------------- ROLLOMETER ---------------- */}
                <section>
                    <h2 className="text-lg font-bold text-gray-100 mb-4 flex items-center gap-2">
                        <span className="w-2 h-8 bg-[#c52323] rounded-full block"></span>
                        SESSION TRACKER
                    </h2>

                    <div className="bg-neutral-800 rounded-xl p-6 shadow-xl border border-white/5 mb-6">
                        
                        {/* ================== NOT TRACKING ================== */}
                        {!isTracking ? (
                            <div className="text-center">
                                <h2 className="text-3xl font-black mb-2">START SESSION</h2>
                                <p className="text-gray-400 mb-6 text-sm">Choose your stance to begin tracking.</p>
                                
                                <div className="flex justify-center gap-4 mb-8">
                                    <button 
                                        onClick={() => setStance('REGULAR')}
                                        className={`px-6 py-3 rounded-lg font-bold transition-all border-2 ${stance === 'REGULAR' ? 'bg-white text-black border-white' : 'bg-transparent text-gray-400 border-gray-600 hover:border-gray-400'}`}
                                    >
                                        REGULAR
                                    </button>
                                    <button 
                                        onClick={() => setStance('GOOFY')}
                                        className={`px-6 py-3 rounded-lg font-bold transition-all border-2 ${stance === 'GOOFY' ? 'bg-white text-black border-white' : 'bg-transparent text-gray-400 border-gray-600 hover:border-gray-400'}`}
                                    >
                                        GOOFY
                                    </button>
                                </div>

                                <button
                                    onClick={() => startTracking(stance)}
                                    className="w-full max-w-sm bg-[#c52323] hover:bg-[#a91f1f] text-white font-black py-4 px-8 rounded-full text-xl shadow-lg transition-transform active:scale-95"
                                >
                                    GO SKATE
                                </button>
                            </div>
                        ) : (
                        
                        /* ================== TRACKING ================== */
                        <div className="text-center">
                            <div className="animate-pulse mb-6 flex flex-col items-center">
                                <div className="text-[#c52323] font-black text-4xl tracking-widest">RECORDING</div>
                                <div className="text-white/50 text-xs mt-1 tracking-widest uppercase">
                                    {trackerState.isRolling ? "STATUS: SKATING" : "STATUS: CHILLING"}
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4 mb-8">
                                <div className="bg-neutral-900/50 p-4 rounded-lg">
                                    <div className="text-3xl font-mono font-bold">{formatDistance(trackerState.totalDistance)}</div>
                                    <div className="text-xs text-gray-500 font-bold uppercase">Distance</div>
                                </div>
                                <div className="bg-neutral-900/50 p-4 rounded-lg">
                                    <div className="text-3xl font-mono font-bold">{formatTime(trackerState.duration)}</div>
                                    <div className="text-xs text-gray-500 font-bold uppercase">Duration</div>
                                </div>
                                <div className="bg-neutral-900/50 p-4 rounded-lg">
                                    <div className="text-3xl font-mono font-bold text-green-400">{formatTime(trackerState.timeOnBoard)}</div>
                                    <div className="text-xs text-gray-500 font-bold uppercase">On Board</div>
                                </div>
                                <div className="bg-neutral-900/50 p-4 rounded-lg">
                                    <div className="text-3xl font-mono font-bold text-yellow-400">{formatTime(trackerState.timeOffBoard)}</div>
                                    <div className="text-xs text-gray-500 font-bold uppercase">Off Board</div>
                                </div>
                            </div>

                            {/* ====== NEW LIVE TRICK COUNTER SECTION ====== */}
                            <div className="bg-neutral-900/40 p-4 rounded-lg mb-8 border border-white/5">
                                <h3 className="text-xs text-gray-400 font-bold uppercase mb-3 tracking-wider">
                                    Tricks (Live)
                                </h3>

                                <div className="grid grid-cols-2 gap-2 text-sm font-mono">
                                    <div>🛹 Ollies</div><div className="text-right">{trickCounts.ollies}</div>
                                    <div>✈️ Airs</div><div className="text-right">{trickCounts.airs}</div>
                                    <div>➡️ FS Grinds</div><div className="text-right">{trickCounts.fsGrinds}</div>
                                    <div>⬅️ BS Grinds</div><div className="text-right">{trickCounts.bsGrinds}</div>
                                    <div>⏸️ Stalls</div><div className="text-right">{trickCounts.stalls}</div>
                                    <div>🌊 Pumps</div><div className="text-right">{trickCounts.pumps}</div>
                                    <div>💥 Slams</div><div className="text-right">{trickCounts.slams}</div>
                                </div>
                            </div>
                            {/* ====== END TRICK COUNTER ====== */}

                            <div className="mb-6 grid grid-cols-3 gap-2 text-xs font-mono text-gray-400">
                                <div>Speed: {formatSpeed(trackerState.currentSpeed)}</div>
                                <div>Max: {formatSpeed(trackerState.topSpeed)}</div>
                                {trackerState.debugMessage && <div>{trackerState.debugMessage}</div>}
                            </div>

                            <button
                                onClick={stopTracking}
                                className="w-full max-w-sm bg-gray-700 hover:bg-gray-600 text-white font-bold py-4 px-8 rounded-full text-lg transition-colors"
                            >
                                STOP SESSION
                            </button>
                        </div>

                        )}

                        {error && (
                            <div className="mt-4 p-3 bg-red-900/50 border border-red-500/30 text-red-200 text-sm rounded text-center">
                                {error}
                            </div>
                        )}
                    </div>

                    {/* CALENDAR + LIST */}
                    <CalendarView 
                        sessions={sessions}
                        selectedDate={selectedDate}
                        onDateSelect={setSelectedDate}
                        currentDisplayMonth={displayMonth}
                        onDisplayMonthChange={setDisplayMonth}
                    />

                    <div className="space-y-3 mt-6">
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">
                            Sessions on {selectedDate.toLocaleDateString()}
                        </h3>
                        
                        {filteredSessions.length === 0 ? (
                            <div className="text-center py-8 text-gray-500 bg-neutral-800 rounded-lg border border-white/5">
                                No sessions recorded this day.
                            </div>
                        ) : (
                            filteredSessions.map(session => (
                                <div key={session.id} className="bg-neutral-800 rounded-lg p-4 flex items-center justify-between group hover:bg-neutral-750 transition-colors border border-white/5">
                                    
                                    <div className="flex-grow cursor-pointer" onClick={() => onViewSession(session)}>
                                        <div className="flex items-center gap-3 mb-1">
                                            <span className="text-lg font-bold text-white">
                                                {new Date(session.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                            </span>
                                            <span className="text-xs bg-[#c52323] px-2 py-0.5 rounded text-white font-bold">
                                                {formatDistance(session.totalDistance)}
                                            </span>
                                        </div>

                                        <div className="text-xs text-gray-400 flex gap-3">
                                            <span>⏱ {formatTime(session.activeTime)}</span>
                                            <span>🚀 {formatSpeed(session.topSpeed)}</span>
                                        </div>
                                    </div>
                                    
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); onDeleteSession(session.id); }}
                                        className="p-2 text-gray-600 hover:bg-red-900/20 rounded-full transition-colors group"
                                    >
                                        <DeleteIcon />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </section>

            </main>

        </div>
    );
};

export default RollometerPage;
