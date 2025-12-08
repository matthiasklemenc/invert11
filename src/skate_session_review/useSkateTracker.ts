import { useState, useRef, useCallback, useEffect } from 'react';
import type {
    SkateSession,
    TrackerState,
    WorkerCommand,
    WorkerMessage,
} from './types';
import { workerString } from './tracker.worker';

const initialState: TrackerState = {
    status: 'idle',
    stance: 'REGULAR',
    startTime: null,
    totalDistance: 0,
    duration: 0,
    timeOnBoard: 0,
    timeOffBoard: 0,
    currentSpeed: 0,
    topSpeed: 0,
    isRolling: false,
    debugMessage: '',
};

declare global {
    interface Window {
        _latestMotion: any;
    }
}

export const useSkateTracker = (
    onSessionEnd: (session: SkateSession) => void
) => {
    const [trackerState, setTrackerState] = useState<TrackerState>(initialState);
    const [error, setError] = useState<string | null>(null);

    const workerRef = useRef<Worker | null>(null);
    const watchIdRef = useRef<number | null>(null);
    const motionIntervalRef = useRef<number | null>(null);

    // -----------------------------------------------------
    // Worker Setup
    // -----------------------------------------------------
    useEffect(() => {
        const blob = new Blob([workerString], { type: 'application/javascript' });
        const workerUrl = URL.createObjectURL(blob);
        const worker = new Worker(workerUrl);
        workerRef.current = worker;

        worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
            const { type, payload } = event.data;

            switch (type) {
                case 'UPDATE':
                    setTrackerState(prev => ({
                        ...prev,
                        ...payload,
                    }));
                    setError(null);
                    break;

                case 'SESSION_END':
                    onSessionEnd(payload);
                    setTrackerState(initialState);
                    break;

                case 'ERROR':
                    setError(payload.message);
                    setTrackerState(prev => ({
                        ...prev,
                        status: 'error',
                        debugMessage: payload.message,
                    }));
                    break;
            }
        };

        return () => {
            worker.terminate();
            URL.revokeObjectURL(workerUrl);
            workerRef.current = null;
        };
    }, [onSessionEnd]);


    // -----------------------------------------------------
    // STOP TRACKING
    // -----------------------------------------------------
    const stopTracking = useCallback(() => {
        workerRef.current?.postMessage({ type: 'STOP' });

        if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
        }

        if (motionIntervalRef.current !== null) {
            clearInterval(motionIntervalRef.current);
            motionIntervalRef.current = null;
        }
    }, []);

    // -----------------------------------------------------
    // START TRACKING
    // -----------------------------------------------------
    const startTracking = useCallback(
        async (stance: 'REGULAR' | 'GOOFY') => {
            setError(null);

            setTrackerState({
                ...initialState,
                stance,
                status: 'tracking',
            });

            // Motion permission for iOS
            if (typeof (DeviceMotionEvent as any).requestPermission === 'function') {
                try {
                    const permission = await (DeviceMotionEvent as any).requestPermission();
                    if (permission !== 'granted') {
                        const msg = 'Motion permission denied.';
                        setError(msg);
                        return;
                    }
                } catch {
                    const msg = 'Motion permission request failed.';
                    setError(msg);
                    return;
                }
            }

            // Clear old watchers
            if (watchIdRef.current) {
                navigator.geolocation.clearWatch(watchIdRef.current);
                watchIdRef.current = null;
            }

            // Tell worker to start
            workerRef.current?.postMessage({
                type: 'START',
                payload: { stance },
            } as WorkerCommand);

            // GPS watcher
            watchIdRef.current = navigator.geolocation.watchPosition(
                pos => {
                    workerRef.current?.postMessage({
                        type: 'POSITION_UPDATE',
                        payload: {
                            coords: {
                                latitude: pos.coords.latitude,
                                longitude: pos.coords.longitude,
                                speed: pos.coords.speed,
                            },
                            timestamp: pos.timestamp,
                        },
                    });
                },
                err => {
                    const message = `GPS Error: ${err.message}`;
                    setError(message);
                },
                {
                    enableHighAccuracy: true,
                    maximumAge: 1000,
                    timeout: 10000,
                }
            );

            // Reliable MOTION FEED (50ms)
            motionIntervalRef.current = window.setInterval(() => {
                const motion = window._latestMotion;
                if (motion && workerRef.current) {
                    workerRef.current.postMessage({
                        type: 'MOTION',
                        payload: motion,
                    });
                }
            }, 50);
        },
        [stopTracking]
    );

    return { trackerState, error, startTracking, stopTracking };
};
