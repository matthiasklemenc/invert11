import { useState, useRef, useCallback, useEffect } from 'react';
import type { SkateSession, TrackerState, WorkerCommand, WorkerMessage, PositionUpdatePayload } from './types';
import { workerString } from './tracker.worker';

const initialState: TrackerState = {
    status: 'idle',
    startTime: null,
    totalDistance: 0,
    activeTime: 0,
    inactiveTime: 0,
    currentSpeed: 0,
    topSpeed: 0,
    isActivelySkating: false,
};

export const useSkateTracker = (onSessionEnd: (session: SkateSession) => void) => {
    const [trackerState, setTrackerState] = useState<TrackerState>(initialState);
    const [error, setError] = useState<string | null>(null);
    const workerRef = useRef<Worker | null>(null);
    const watchIdRef = useRef<number | null>(null);

    useEffect(() => {
        // Create worker from blob
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
                case 'HIGHLIGHT':
                    // In a more advanced implementation, you might want to show highlights live
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
        setTrackerState(initialState);
    }, []);

    const startTracking = useCallback(async () => {
        setError(null);
        setTrackerState({ ...initialState, status: 'tracking' });

        // Request DeviceMotionEvent permission for iOS 13+
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
                 setTrackerState(prev => ({...prev, status: 'error'}));
                 return;
            }
        }
        
        workerRef.current?.postMessage({ type: 'START' } as WorkerCommand);

        // Geolocation logic is now handled on the main thread
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
                // Send error to worker to be displayed, and stop tracking
                const errorMessage = `GPS Error: ${err.message}`;
                workerRef.current?.postMessage({ type: 'ERROR', payload: { message: errorMessage } });
                stopTracking();
            },
            { enableHighAccuracy: true, maximumAge: 1000, timeout: 5000 }
        );

    }, [stopTracking]);

    return { trackerState, error, startTracking, stopTracking };
};
