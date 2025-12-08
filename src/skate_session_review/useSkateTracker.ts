// skate_session_review/useSkateTracker.ts

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
    // If your TrackerState already has debugMessage as optional,
    // this just initializes it; if not, TS will still accept the extra field at runtime.
    debugMessage: '',
};

export const useSkateTracker = (onSessionEnd: (session: SkateSession) => void) => {
    const [trackerState, setTrackerState] = useState<TrackerState>(initialState);
    const [error, setError] = useState<string | null>(null);

    const workerRef = useRef<Worker | null>(null);
    const watchIdRef = useRef<number | null>(null);

    // -----------------------------------------------------
    // Worker creation / teardown
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
                    // Worker sends the full tracker state snapshot
                    setTrackerState(prev => ({
                        ...prev,
                        ...payload,
                        debugMessage: prev.debugMessage || ''
                    }));
                    setError(null);
                    break;

                case 'SESSION_END':
                    onSessionEnd(payload);
                    setTrackerState(initialState);
                    break;

                case 'ERROR':
                    // (We don't currently send ERROR from the worker,
                    // but if we add it later, this will surface it nicely.)
                    setError(payload.message);
                    setTrackerState(prev => ({
                        ...prev,
                        status: 'error',
                        debugMessage: payload.message
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
    // Forward devicemotion events from MAIN THREAD to worker
    // -----------------------------------------------------
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
            } as any); // 'MOTION' might not be in WorkerCommand yet
        }

        window.addEventListener('devicemotion', handleMotion);

        return () => {
            window.removeEventListener('devicemotion', handleMotion);
        };
    }, []);

    // -----------------------------------------------------
    // Stop tracking
    // -----------------------------------------------------
    const stopTracking = useCallback(() => {
        // Tell worker to stop session & emit SESSION_END
        workerRef.current?.postMessage({ type: 'STOP' } as WorkerCommand);

        // Clear GPS watcher
        if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
        }
    }, []);

    // -----------------------------------------------------
    // Start tracking
    // -----------------------------------------------------
    const startTracking = useCallback(
        async (stance: 'REGULAR' | 'GOOFY') => {
            setError(null);
            setTrackerState({
                ...initialState,
                stance,
                status: 'tracking',
                debugMessage: '',
            });

            // iOS motion permission (no-op on Android / desktop)
            if (typeof (DeviceMotionEvent as any).requestPermission === 'function') {
                try {
                    const permissionState = await (DeviceMotionEvent as any).requestPermission();
                    if (permissionState !== 'granted') {
                        const msg = 'Motion sensor permission denied.';
                        setError(msg);
                        setTrackerState(prev => ({
                            ...prev,
                            status: 'denied',
                            debugMessage: msg,
                        }));
                        return;
                    }
                } catch (err) {
                    const msg = 'Motion sensor permission request failed.';
                    setError(msg);
                    setTrackerState(prev => ({
                        ...prev,
                        status: 'error',
                        debugMessage: msg,
                    }));
                    return;
                }
            }

            // Make sure we don't leak multiple watchers
            if (watchIdRef.current !== null) {
                navigator.geolocation.clearWatch(watchIdRef.current);
                watchIdRef.current = null;
            }

            // Tell worker to start new session
            workerRef.current?.postMessage(
                { type: 'START', payload: { stance } } as WorkerCommand
            );

            // GPS watcher
            try {
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
                        // IMPORTANT: do NOT instantly kill the session on every error.
                        const errorMessage = `GPS Error: ${err.message}`;

                        setError(errorMessage);
                        setTrackerState(prev => ({
                            ...prev,
                            status: 'error',
                            debugMessage: errorMessage,
                        }));

                        // Only fully stop if user denied permission.
                        // TIMEOUT / POSITION_UNAVAILABLE should not auto-stop;
                        // the watch can continue and get new fixes.
                        if (err.code === err.PERMISSION_DENIED) {
                            stopTracking();
                        }
                    },
                    {
                        enableHighAccuracy: true,
                        maximumAge: 1000,
                        // Be generous so mobile doesn't immediately timeout:
                        timeout: 10000,
                    }
                );
            } catch (e: any) {
                const msg = e?.message || 'Geolocation not available.';
                setError(msg);
                setTrackerState(prev => ({
                    ...prev,
                    status: 'error',
                    debugMessage: msg,
                }));
            }
        },
        [stopTracking]
    );

    return { trackerState, error, startTracking, stopTracking };
};
