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
    debugMessage: '',
};

export const useSkateTracker = (onSessionEnd: (session: SkateSession) => void) => {
    const [trackerState, setTrackerState] = useState<TrackerState>(initialState);
    const [error, setError] = useState<string | null>(null);

    const workerRef = useRef<Worker | null>(null);
    const watchIdRef = useRef<number | null>(null);
    const motionListenerRef = useRef<(e: DeviceMotionEvent) => void>();

    // -----------------------------------------------------
    // Worker creation / teardown
    // -----------------------------------------------------
    useEffect(() => {
        const blob = new Blob([workerString], { type: "application/javascript" });
        const workerUrl = URL.createObjectURL(blob);
        const worker = new Worker(workerUrl);
        workerRef.current = worker;

        worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
            const { type, payload } = event.data;

            switch (type) {
                case "UPDATE":
                    setTrackerState(prev => ({
                        ...prev,
                        ...payload,
                        debugMessage: prev.debugMessage || ""
                    }));
                    setError(null);
                    break;

                case "SESSION_END":
                    onSessionEnd(payload);
                    setTrackerState(initialState);
                    break;

                case "ERROR":
                    setError(payload.message);
                    setTrackerState(prev => ({
                        ...prev,
                        status: "error",
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
    // Remove existing motion listener helper
    // -----------------------------------------------------
    const removeMotionListener = () => {
        if (motionListenerRef.current) {
            window.removeEventListener("devicemotion", motionListenerRef.current);
            motionListenerRef.current = undefined;
        }
    };

    // -----------------------------------------------------
    // Stop tracking
    // -----------------------------------------------------
    const stopTracking = useCallback(() => {
        workerRef.current?.postMessage({ type: "STOP" } as WorkerCommand);

        if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
        }

        removeMotionListener();
    }, []);

    // -----------------------------------------------------
    // Start tracking
    // -----------------------------------------------------
    const startTracking = useCallback(
        async (stance: "REGULAR" | "GOOFY") => {
            setError(null);

            setTrackerState({
                ...initialState,
                stance,
                status: "tracking",
                debugMessage: "",
            });

            // iOS motion permission
            if (typeof (DeviceMotionEvent as any).requestPermission === "function") {
                try {
                    const permission = await (DeviceMotionEvent as any).requestPermission();
                    if (permission !== "granted") {
                        const msg = "Motion sensor permission denied.";
                        setError(msg);
                        setTrackerState(prev => ({
                            ...prev,
                            status: "denied",
                            debugMessage: msg,
                        }));
                        return;
                    }
                } catch (err) {
                    const msg = "Motion sensor permission request failed.";
                    setError(msg);
                    setTrackerState(prev => ({
                        ...prev,
                        status: "error",
                        debugMessage: msg,
                    }));
                    return;
                }
            }

            // Remove old motion listener to avoid dead pipeline
            removeMotionListener();

            // Create fresh motion listener bound to CURRENT workerRef
            const handleMotion = (e: DeviceMotionEvent) => {
                const worker = workerRef.current;
                if (!worker) return;

                const acc = e.accelerationIncludingGravity;
                const rot = e.rotationRate;

                worker.postMessage({
                    type: "MOTION",
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
                        timestamp: Date.now()
                    }
                });
            };

            motionListenerRef.current = handleMotion;
            window.addEventListener("devicemotion", handleMotion, { passive: true });

            // Clear any old watchers
            if (watchIdRef.current !== null) {
                navigator.geolocation.clearWatch(watchIdRef.current);
                watchIdRef.current = null;
            }

            // Tell worker to start
            workerRef.current?.postMessage({
                type: "START",
                payload: { stance },
            } as WorkerCommand);

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
                            type: "POSITION_UPDATE",
                            payload,
                        } as WorkerCommand);
                    },
                    err => {
                        const errorMessage = `GPS Error: ${err.message}`;

                        setError(errorMessage);
                        setTrackerState(prev => ({
                            ...prev,
                            status: "error",
                            debugMessage: errorMessage,
                        }));

                        if (err.code === err.PERMISSION_DENIED) {
                            stopTracking();
                        }
                    },
                    {
                        enableHighAccuracy: true,
                        maximumAge: 1000,
                        timeout: 10000,
                    }
                );
            } catch (e: any) {
                const msg = e?.message || "Geolocation not available.";
                setError(msg);
                setTrackerState(prev => ({
                    ...prev,
                    status: "error",
                    debugMessage: msg,
                }));
            }
        },
        [stopTracking]
    );

    return { trackerState, error, startTracking, stopTracking };
};
