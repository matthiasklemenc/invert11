import { useState, useRef, useCallback, useEffect } from 'react';
import type {
    SkateSession,
    TrackerState,
    WorkerCommand,
    WorkerMessage,
    PositionUpdatePayload
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
};

export const useSkateTracker = (onSessionEnd: (session: SkateSession) => void) => {
    const [trackerState, setTrackerState] = useState<TrackerState>(initialState);
    const [error, setError] = useState<string | null>(null);
    const workerRef = useRef<Worker | null>(null);
    const watchIdRef = useRef<number | null>(null);

    // Create worker from string
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
                // HIGHLIGHT messages are handled elsewhere (SessionReview / Timeline),
                // so nothing to do here.
            }
        };

        return () => {
            worker.terminate();
            URL.revokeObjectURL(workerUrl);
        };
    }, [onSessionEnd]);

    // Forward devicemotion events from MAIN THREAD to the worker
    useEffect(() => {
        function handleMotion(e: DeviceMotionEvent) {
            if (!workerRef.current) return;

            const acc = e.accelerationIncludingGravity;
            const rot = e.rotationRate;

            workerRef.current.postMessage({
                type: 'MOTION',
                payload: {
                    acc: acc
                        ? {
                              x: acc.x ?? 0,
                              y: acc.y ?? 0,
                              z: acc.z ?? 0,
                          }
                        : null,
                    rot: rot
                        ? {
                              alpha: rot.alpha ?? 0,
                              beta: rot.beta ?? 0,
                              gamma: rot.gamma ?? 0,
                          }
                        : null,
                    timestamp: Date.now(),
                },
            } as any); // 'MOTION' might not be in WorkerCommand type yet
        }

        window.addEventListener('devicemotion', handleMotion);

        return () => {
            window.removeEventListener('devicemotion', handleMotion);
        };
    }, []);

    const stopTracking = useCallback(() => {
        workerRef.current?.postMessage({ type: 'STOP' } as WorkerCommand);
        if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
        }
    }, []);

    const startTracking = useCallback(
        async (stance: 'REGULAR' | 'GOOFY') => {
            setError(null);
            setTrackerState({ ...initialState, stance, status: 'tracking' });

            // Request DeviceMotion permission for iOS
            if (typeof (DeviceMotionEvent as any).requestPermission === 'function') {
                try {
                    const permissionState = await (DeviceMotionEvent as any).requestPermission();
                    if (permissionState !== 'granted') {
                        setError('Motion sensor permission denied.');
                        setTrackerState(prev => ({ ...prev, status: 'denied' }));
                        return;
                    }
                } catch (err) {
                    setError('Motion sensor permission request failed.');
                    setTrackerState(prev => ({ ...prev, status: 'error' }));
                    return;
                }
            }

            workerRef.current?.postMessage(
                { type: 'START', payload: { stance } } as WorkerCommand
            );

            watchIdRef.current = navigator.geolocation.watchPosition(
                position => {
                    const payload: PositionUpdatePayload = {
                        coords: {
                            latitude: position.coords.latitude,
                            longitude: position.coords.longitude,
                            speed: position.coords.speed,
                        },
                        timestamp: position.timestamp,
                    };
                    workerRef.current?.postMessage({
                        type: 'POSITION_UPDATE',
                        payload,
                    } as WorkerCommand);
                },
                err => {
                    const errorMessage = `GPS Error: ${err.message}`;
                    workerRef.current?.postMessage({
                        type: 'ERROR',
                        payload: { message: errorMessage },
                    } as any);
                    stopTracking();
                },
                { enableHighAccuracy: true, maximumAge: 1000, timeout: 2000 }
            );
        },
        [stopTracking]
    );

    return { trackerState, error, startTracking, stopTracking };
};
