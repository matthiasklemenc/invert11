
import { useState, useRef, useCallback, useEffect } from 'react';
import type { SkateSession, TrackerState, WorkerCommand, WorkerMessage, PositionUpdatePayload } from './types';
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
};

export const useSkateTracker = (onSessionEnd: (session: SkateSession) => void) => {
    const [trackerState, setTrackerState] = useState<TrackerState>(initialState);
    const [error, setError] = useState<string | null>(null);
    const workerRef = useRef<Worker | null>(null);
    const watchIdRef = useRef<number | null>(null);

    useEffect(() => {
        const blob = new Blob([workerString], { type: 'application/javascript' });
        const workerUrl = URL.createObjectURL(blob);
        const worker = new Worker(workerUrl);
        workerRef.current = worker;

        worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
            const { type, payload } = event.data;
            switch (type) {
                case 'UPDATE':
                    setTrackerState(payload);
                    setError(null);
                    break;
                case 'SESSION_END':
                    onSessionEnd(payload);
                    setTrackerState(initialState);
                    break;
                case 'ERROR':
                    setError(payload.message);
                    setTrackerState(prev => ({ ...prev, status: 'error' }));
                    break;
            }
        };

        return () => {
            worker.terminate();
            URL.revokeObjectURL(workerUrl);
        };
    }, [onSessionEnd]);

    const stopTracking = useCallback(() => {
        workerRef.current?.postMessage({ type: 'STOP' } as WorkerCommand);
        if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
        }
    }, []);

    const startTracking = useCallback(async (stance: 'REGULAR' | 'GOOFY') => {
        setError(null);
        setTrackerState({ ...initialState, stance, status: 'tracking' });

        // Request DevicePermission for iOS
        if (typeof (DeviceMotionEvent as any).requestPermission === 'function') {
            try {
                const permissionState = await (DeviceMotionEvent as any).requestPermission();
                if (permissionState !== 'granted') {
                    setError('Motion sensor permission denied.');
                    setTrackerState(prev => ({...prev, status: 'denied'}));
                    return;
                }
            } catch (err) {
                 setError('Motion sensor permission request failed.');
                 return;
            }
        }
        
        workerRef.current?.postMessage({ type: 'START', payload: { stance } } as WorkerCommand);

        watchIdRef.current = navigator.geolocation.watchPosition(
            (position) => {
                const payload: PositionUpdatePayload = {
                    coords: {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        speed: position.coords.speed,
                    },
                    timestamp: position.timestamp,
                };
                workerRef.current?.postMessage({ type: 'POSITION_UPDATE', payload } as WorkerCommand);
            },
            (err) => {
                const errorMessage = `GPS Error: ${err.message}`;
                workerRef.current?.postMessage({ type: 'ERROR', payload: { message: errorMessage } });
                stopTracking();
            },
            { enableHighAccuracy: true, maximumAge: 1000, timeout: 2000 }
        );

    }, [stopTracking]);

    return { trackerState, error, startTracking, stopTracking };
};
