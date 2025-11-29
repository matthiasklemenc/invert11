// This file is not imported directly. Its content is imported as a string in useSkateTracker.ts
// and used to create a worker blob. This avoids build system complexities.

export const workerString = `
// --- Worker Scope ---
let intervalId = null;

// State
let startTime = 0;
let lastTimestamp = 0;
let totalDistance = 0;
let activeTime = 0;
let inactiveTime = 0;
let topSpeed = 0;
let isActivelySkating = false;
let path = [];
let highlights = [];

// Sensor data buffers
let lastPosition = null;
let accelBuffer = [];
const ACCEL_BUFFER_SIZE = 20; // Approx 1 second of data at 20Hz

// Thresholds for "AI" detection
const ROLLING_VIBRATION_THRESHOLD = 0.05; // Standard deviation of accelerometer magnitude
const IMPACT_THRESHOLD = 4.0; // G-force
const FREEFALL_THRESHOLD = 0.5; // G-force (close to 0)

let freefallStart = 0;


function haversineDistance(p1, p2) {
    const R = 6371e3; // metres
    const φ1 = p1.lat * Math.PI/180;
    const φ2 = p2.lat * Math.PI/180;
    const Δφ = (p2.lat-p1.lat) * Math.PI/180;
    const Δλ = (p2.lon-p1.lon) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // in metres
}

function handlePositionUpdate(position) {
    const { latitude, longitude, speed } = position.coords;
    const timestamp = position.timestamp;

    const currentPosition = { lat: latitude, lon: longitude, timestamp, speed };
    path.push(currentPosition);

    if (lastPosition) {
        const distance = haversineDistance(lastPosition, currentPosition);
        totalDistance += distance;
    }
    
    if (speed !== null && speed > topSpeed) {
        topSpeed = speed;
    }

    lastPosition = currentPosition;
}

function handleDeviceMotion(event) {
    const { x, y, z } = event.accelerationIncludingGravity;
    const timestamp = Date.now();
    accelBuffer.push({ x, y, z, timestamp });
    if (accelBuffer.length > ACCEL_BUFFER_SIZE) {
        accelBuffer.shift();
    }
}

function processSensorData() {
    const now = Date.now();
    const deltaTime = lastTimestamp ? (now - lastTimestamp) / 1000 : 0;
    
    // Activity Detection
    if (accelBuffer.length > 5) {
        const magnitudes = accelBuffer.map(a => Math.sqrt(a.x**2 + a.y**2 + a.z**2));
        const mean = magnitudes.reduce((sum, val) => sum + val, 0) / magnitudes.length;
        const stdDev = Math.sqrt(magnitudes.map(val => (val - mean)**2).reduce((sum, val) => sum + val, 0) / magnitudes.length);

        isActivelySkating = stdDev > ROLLING_VIBRATION_THRESHOLD;
    } else {
        isActivelySkating = false;
    }
    
    if (isActivelySkating) {
        activeTime += deltaTime;
    } else {
        inactiveTime += deltaTime;
    }

    // Highlight Detection
    if (accelBuffer.length > 0) {
        const lastAccel = accelBuffer[accelBuffer.length - 1];
        const magnitude = Math.sqrt(lastAccel.x**2 + lastAccel.y**2 + lastAccel.z**2) / 9.81; // Normalize to G's

        // Airtime detection
        if (magnitude < FREEFALL_THRESHOLD) {
            if (freefallStart === 0) {
                freefallStart = lastAccel.timestamp;
            }
        } else {
            if (freefallStart > 0) {
                const airtimeDuration = (lastAccel.timestamp - freefallStart) / 1000;
                if (airtimeDuration > 0.1) { // Min duration for a valid airtime event
                    const highlight = {
                        id: 'highlight_' + Date.now(),
                        type: 'AIRTIME',
                        timestamp: lastAccel.timestamp,
                        duration: airtimeDuration,
                        value: magnitude // Impact G's on landing
                    };
                    highlights.push(highlight);
                    self.postMessage({ type: 'HIGHLIGHT', payload: highlight });
                }
                freefallStart = 0;
            }
        }

        // Impact detection (if not landing from airtime)
        if (magnitude > IMPACT_THRESHOLD && freefallStart === 0) {
             const highlight = {
                id: 'highlight_' + Date.now(),
                type: 'IMPACT',
                timestamp: lastAccel.timestamp,
                duration: 0,
                value: magnitude
            };
            highlights.push(highlight);
            self.postMessage({ type: 'HIGHLIGHT', payload: highlight });
        }
    }
    

    const currentSpeed = lastPosition?.speed ?? 0;
    
    self.postMessage({
        type: 'UPDATE',
        payload: {
            status: 'tracking',
            startTime,
            totalDistance,
            activeTime,
            inactiveTime,
            currentSpeed,
            topSpeed,
            isActivelySkating,
        }
    });
    
    lastTimestamp = now;
}

function startTracking() {
    startTime = Date.now();
    lastTimestamp = startTime;
    totalDistance = 0;
    activeTime = 0;
    inactiveTime = 0;
    topSpeed = 0;
    isActivelySkating = false;
    path = [];
    highlights = [];
    lastPosition = null;
    accelBuffer = [];
    
    self.addEventListener('devicemotion', handleDeviceMotion);
        
    intervalId = setInterval(processSensorData, 250);
}

function stopTracking() {
    if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
    }
    self.removeEventListener('devicemotion', handleDeviceMotion);
    
    const session = {
        id: 'session_' + startTime,
        startTime,
        endTime: Date.now(),
        totalDistance,
        activeTime,
        inactiveTime,
        topSpeed,
        path,
        highlights,
    };
    self.postMessage({ type: 'SESSION_END', payload: session });
}

self.onmessage = (event) => {
    const { type, payload } = event.data;
    switch (type) {
        case 'START':
            startTracking();
            break;
        case 'STOP':
            stopTracking();
            break;
        case 'POSITION_UPDATE':
            handlePositionUpdate(payload);
            break;
    }
};
`;
