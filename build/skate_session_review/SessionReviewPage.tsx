import React from 'react';
import { SkateSession } from './types';
import MapDisplay from './MapDisplay';
import SessionTimeline from './SessionTimeline';

const formatDistance = (meters: number) => (meters / 1000).toFixed(2);
const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}m ${s}s`;
};
const formatSpeed = (mps: number) => (mps * 3.6).toFixed(1);

const StatCard: React.FC<{ label: string; value: string; unit: string; }> = ({ label, value, unit }) => (
    <div className="bg-neutral-800 p-4 rounded-lg text-center">
        <div className="text-3xl font-bold text-white">{value}</div>
        <div className="text-sm text-neutral-400">{label} <span className="text-xs">({unit})</span></div>
    </div>
);

const HighlightIcon: React.FC<{ type: string }> = ({ type }) => {
    let emoji = '⚡️';
    if (type === 'AIRTIME') emoji = '✈️';
    if (type === 'GRIND') emoji = '🔩';
    if (type === 'CARVE') emoji = '🌊';
    return <span className="text-lg mr-2">{emoji}</span>;
};

const SessionReviewPage: React.FC<{
    session: SkateSession;
    onClose: () => void;
}> = ({ session, onClose }) => {
    
    const totalDuration = (session.endTime - session.startTime) / 1000;
    const avgSpeed = session.activeTime > 0 ? (session.totalDistance / session.activeTime) : 0;

    const highlightCounts = session.highlights.reduce((acc, h) => {
        acc[h.type] = (acc[h.type] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    return (
        <div className="min-h-screen bg-gray-900 text-white p-4">
            <header className="flex items-center justify-between mb-6 relative h-10">
                <button onClick={onClose} className="text-white hover:text-gray-300 transition-colors z-10 p-2 -ml-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
                <h1 className="text-lg font-bold text-gray-100 text-center w-full absolute left-1/2 -translate-x-1/2 pointer-events-none">
                    Session: {new Date(session.startTime).toLocaleDateString()}
                </h1>
            </header>

            <main className="max-w-4xl mx-auto space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard label="Total Distance" value={formatDistance(session.totalDistance)} unit="km" />
                    <StatCard label="Top Speed" value={formatSpeed(session.topSpeed)} unit="km/h" />
                    <StatCard label="Avg. Speed" value={formatSpeed(avgSpeed)} unit="km/h" />
                    <StatCard label="Active Time" value={formatTime(session.activeTime)} unit="m:s" />
                </div>
                
                {session.path.length > 1 && (
                     <div className="bg-neutral-800 p-2 rounded-lg">
                        <MapDisplay path={session.path} />
                    </div>
                )}

                <div className="bg-neutral-800 p-4 rounded-lg">
                    <h3 className="text-md font-semibold mb-3">Session Timeline</h3>
                    <SessionTimeline session={session} />
                     <div className="flex justify-between text-xs text-neutral-400 mt-2">
                        <span>Start</span>
                        <span>{formatTime(totalDuration)}</span>
                    </div>
                </div>

                <div className="bg-neutral-800 p-4 rounded-lg">
                    <h3 className="text-md font-semibold mb-3">Session Highlights</h3>
                    {session.highlights.length > 0 ? (
                         <div className="space-y-2">
                            {Object.entries(highlightCounts).map(([type, count]) => (
                                <div key={type} className="flex items-center">
                                    <HighlightIcon type={type} />
                                    <span className="font-semibold">{type.charAt(0) + type.slice(1).toLowerCase()}:</span>
                                    <span className="ml-2">{count} detected</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-neutral-400">No special highlights were detected in this session.</p>
                    )}
                </div>
            </main>
        </div>
    );
};

export default SessionReviewPage;
