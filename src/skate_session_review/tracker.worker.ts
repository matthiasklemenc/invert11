// This file is not imported directly. Its content is imported as a string in useSkateTracker.ts
// and used to create a worker blob.

export const workerString = `
// --- Worker Scope ---
let intervalId = null;

// Config
let userStance = 'REGULAR'; // 'REGULAR' or 'GOOFY'

// State
let startTime = 0;
let lastTimestamp = 0;
let totalDistance = 0;
let timeOnBoard = 0;
let timeOffBoard = 0;
let topSpeed = 0;
let isRolling = false; // "On Board" state

// Buffers
let path = [];
let highlights = [];
let lastPosition = null;
let accelBuffer = [];
let gyroBuffer = [];
const BUFFER_SIZE = 40; // ~2 seconds at 20hz

// Counts
let counts = {
    pumps: 0,
    ollies: 0,
    airs: 0,
    fsGrinds: 0,
    bsGrinds: 0,
    stalls: 0,
    slams: 0
};

// Thresholds (can be tuned later)
const FREEFALL_THRESHOLD = 0.3;     // G-force near 0
const IMPACT_THRESHOLD = 2.5;       // Landing G-force
const SLAM_THRESHOLD = 5.0;         // Slam/Bail
const ROTATION_THRESHOLD = 200;     // deg/s for turns

// Detection State Machines
let freefallStart = 0;
let potentialGrindStart = 0;
let entryRotation = 0; // To calc FS vs BS

// --- Helpers -------------------------------------------------------------

function haversineDistance(p1, p2) {
    const R = 6371e3;
    const phi1 = p1.lat * Math.PI / 180;
    const phi2 = p2.lat * Math.PI / 180;
    const dPhi = (p2.lat - p1.lat) * Math.PI / 180;
    const dLambda = (p2.lon - p1.lon) * Math.PI / 180;

    const a =
        Math.sin(dPhi / 2) * Math.sin(dPhi / 2) +
        Math.cos(phi1) * Math.cos(phi2) *
        Math.sin(dLambda / 2) * Math.sin(dLambda / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// --- Position / GPS ------------------------------------------------------

function handlePositionUpdate(position) {
    const { latitude, longitude, speed } = position.coords;
    const timestamp = position.timestamp;

    if (latitude == null || longitude == null) return;

    const currentPosition = {
        lat: latitude,
        lon: longitude,
        timestamp,
        speed
    };

    if (!lastPosition) {
        // First point of the session
        lastPosition = currentPosition;
        path.push(currentPosition);
        if (speed != null && speed > 0) {
            topSpeed = speed;
        }
        return;
    }

    const distance = haversineDistance(lastPosition, currentPosition);
    const dt = (timestamp - lastPosition.timestamp) / 1000 || 1;

    // Estimate speed from distance/time if GPS.speed is missing
    let effectiveSpeed = speed;
    if (effectiveSpeed == null) {
        effectiveSpeed = distance / dt; // m/s
    }

    // Sanity filter for GPS glitches:
    // - ignore negative or absurd speeds (> 30 m/s ≈ 108 km/h)
    //   (still allows real 50 km/h skating)
    if (effectiveSpeed < 0 || effectiveSpeed > 30) {
        // Ignore this point entirely (no path, no distance)
        return;
    }

    // If we're basically standing (< 0.2 m/s ≈ 0.7 km/h), don't accumulate distance
    if (effectiveSpeed < 0.2) {
        lastPosition = currentPosition;
        // Optionally still push to path if you want small jitter shown:
        // path.push(currentPosition);
        return;
    }

    // Indoors / GPS drift filter:
    // If a single jump is more than ~20 m (with small time delta), it's likely noise.
    if (distance > 20 && dt < 5) {
        // Ignore crazy jump; don't move lastPosition so the line stays tight
        return;
    }

    // Accept this point
    path.push(currentPosition);
    totalDistance += distance;

    if (effectiveSpeed != null && effectiveSpeed > topSpeed) {
        topSpeed = effectiveSpeed;
    }

    lastPosition = currentPosition;
}

// --- Motion / IMU --------------------------------------------------------

function handleDeviceMotion(payload) {
    const acc = payload.acc;
    const rot = payload.rot;
    const timestamp = payload.timestamp;

    if (!acc || !rot) return;

    accelBuffer.push({
        x: acc.x,
        y: acc.y,
        z: acc.z,
        timestamp
    });

    gyroBuffer.push({
        alpha: rot.alpha,
        beta: rot.beta,
        gamma: rot.gamma,
        timestamp
    });

    if (accelBuffer.length > BUFFER_SIZE) accelBuffer.shift();
    if (gyroBuffer.length > BUFFER_SIZE) gyroBuffer.shift();
}

function classifyActivity(speed, stdDevAccel) {
    // 1. High speed: very likely skating
    if (speed > 2.5) return true; // > 9 km/h

    // 2. If slow, see vibration / texture
    if (speed < 0.5 && stdDevAccel < 0.1) return false; // standing

    // Walking produces high variance spikes
    if (stdDevAccel > 0.6) return false; // walking / running

    // Skating: smooth, mid variance hum
    if (stdDevAccel > 0.05 && stdDevAccel < 0.5) return true;

    return false;
}

function detectTricks(currentSpeed) {
    if (accelBuffer.length < 5 || gyroBuffer.length < 1) return;

    const lastAcc = accelBuffer[accelBuffer.length - 1];
    const lastGyro = gyroBuffer[gyroBuffer.length - 1];

    const gForce =
        Math.sqrt(
            lastAcc.x * lastAcc.x +
            lastAcc.y * lastAcc.y +
            lastAcc.z * lastAcc.z
        ) / 9.81;

    // --- 1. AIR / OLLIE / SLAM DETECTION -------------------------
    if (gForce < FREEFALL_THRESHOLD) {
        if (freefallStart === 0) freefallStart = lastAcc.timestamp;
    } else {
        if (freefallStart > 0) {
            const airTime = (lastAcc.timestamp - freefallStart) / 1000;

            if (gForce > IMPACT_THRESHOLD) {
                if (gForce > SLAM_THRESHOLD) {
                    addHighlight('SLAM', lastAcc.timestamp, 0, gForce);
                    counts.slams++;
                    isRolling = false;
                } else if (airTime > 0.4) {
                    addHighlight('AIR', lastAcc.timestamp, airTime, gForce);
                    counts.airs++;
                } else if (airTime > 0.15) {
                    addHighlight('OLLIE', lastAcc.timestamp, airTime, gForce);
                    counts.ollies++;
                }
            }
            freefallStart = 0;
        }
    }

    // --- 2. PUMP DETECTION (very rough, kept conservative) -------
    if (gForce > 1.3 && gForce < 2.0 && freefallStart === 0 && isRolling) {
        // counts.pumps++; // enable later when tuned
    }

    // --- 3. GRIND / STALL DETECTION ------------------------------
    if (lastGyro && Math.abs(lastGyro.alpha) > ROTATION_THRESHOLD) {
        entryRotation = lastGyro.alpha;
        potentialGrindStart = lastAcc.timestamp;
    }

    if (
        potentialGrindStart > 0 &&
        (lastAcc.timestamp - potentialGrindStart < 500)
    ) {
        const timeSinceRot = lastAcc.timestamp - potentialGrindStart;

        if (timeSinceRot > 100 && Math.abs(lastGyro.alpha) < 50) {
            if (timeSinceRot > 200) {
                classifyGrind(entryRotation, timeSinceRot / 1000);
                potentialGrindStart = 0;
            }
        }
    } else {
        potentialGrindStart = 0;
    }
}

function classifyGrind(rotAlpha, duration) {
    let isFrontside = false;

    if (userStance === 'REGULAR') {
        if (rotAlpha > 0) isFrontside = true; // turn left
    } else {
        if (rotAlpha < 0) isFrontside = true; // turn right
    }

    const type = isFrontside ? 'FS_GRIND' : 'BS_GRIND';

    const currentSpeed = lastPosition ? (lastPosition.speed || 0) : 0;
    if (currentSpeed < 1.0) {
        addHighlight('STALL', Date.now(), duration, 0);
        counts.stalls++;
    } else {
        addHighlight(type, Date.now(), duration, 0);
        if (isFrontside) counts.fsGrinds++;
        else counts.bsGrinds++;
    }
}

// --- Highlights / UI -----------------------------------------------------

function addHighlight(type, timestamp, duration, value) {
    const lastH = highlights[highlights.length - 1];
    if (lastH && (timestamp - lastH.timestamp < 300)) return;

    const h = {
        id: 'h_' + timestamp,
        type,
        timestamp,
        duration,
        value
    };
    highlights.push(h);
    self.postMessage({ type: 'HIGHLIGHT', payload: h });
}

// --- Main processing loop ------------------------------------------------

function processSensorData() {
    const now = Date.now();

    if (!startTime) {
        startTime = now;
        lastTimestamp = now;
    }

    const deltaTime = lastTimestamp ? (now - lastTimestamp) / 1000 : 0;

    // Standard deviation of accel magnitude
    let stdDev = 0;
    if (accelBuffer.length > 5) {
        const mags = accelBuffer.map(function (a) {
            return Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
        });
        const mean = mags.reduce(function (a, b) { return a + b; }, 0) / mags.length;
        stdDev = Math.sqrt(
            mags
                .map(function (x) { return (x - mean) * (x - mean); })
                .reduce(function (a, b) { return a + b; }, 0) / mags.length
        );
    }

    let currentSpeed = lastPosition ? (lastPosition.speed || 0) : 0;

    // Clamp impossible speeds (still allow 50 km/h+ sessions)
    if (currentSpeed < 0 || currentSpeed > 30) {
        currentSpeed = 0;
    }

    isRolling = classifyActivity(currentSpeed, stdDev);

    if (isRolling) {
        timeOnBoard += deltaTime;
        detectTricks(currentSpeed);
    } else {
        timeOffBoard += deltaTime;
    }

    self.postMessage({
        type: 'UPDATE',
        payload: {
            status: 'tracking',
            stance: userStance,
            startTime: startTime,
            totalDistance: totalDistance,
            duration: (now - startTime) / 1000,
            timeOnBoard: timeOnBoard,
            timeOffBoard: timeOffBoard,
            currentSpeed: currentSpeed,
            topSpeed: topSpeed,
            isRolling: isRolling
        }
    });

    lastTimestamp = now;
}

// --- Start / Stop --------------------------------------------------------

function startTracking(stance) {
    // Full reset to avoid leftover state between sessions
    userStance = stance;

    if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
    }

    startTime = Date.now();
    lastTimestamp = startTime;
    totalDistance = 0;
    timeOnBoard = 0;
    timeOffBoard = 0;
    topSpeed = 0;
    isRolling = false;

    path = [];
    highlights = [];
    counts = {
        pumps: 0,
        ollies: 0,
        airs: 0,
        fsGrinds: 0,
        bsGrinds: 0,
        stalls: 0,
        slams: 0
    };

    lastPosition = null;
    accelBuffer = [];
    gyroBuffer = [];

    freefallStart = 0;
    potentialGrindStart = 0;
    entryRotation = 0;

    intervalId = setInterval(processSensorData, 200); // 5 Hz UI updates
}

function stopTracking() {
    if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
    }

    const now = Date.now();
    const session = {
        id: 'session_' + startTime,
        startTime: startTime,
        endTime: now,
        stance: userStance,
        totalDistance: totalDistance,
        activeTime: (now - startTime) / 1000,
        timeOnBoard: timeOnBoard,
        timeOffBoard: timeOffBoard,
        topSpeed: topSpeed,
        path: path,
        highlights: highlights,
        counts: counts
    };

    self.postMessage({ type: 'SESSION_END', payload: session });

    // Optionally reset minimal state here for cleanliness
    startTime = 0;
}

// --- Message handling ----------------------------------------------------

self.onmessage = function (event) {
    const data = event.data || {};
    const type = data.type;
    const payload = data.payload;

    switch (type) {
        case 'START':
            startTracking(payload.stance);
            break;
        case 'STOP':
            stopTracking();
            break;
        case 'POSITION_UPDATE':
            handlePositionUpdate(payload);
            break;
        case 'MOTION':
            handleDeviceMotion(payload);
            break;
    }
};
`;
