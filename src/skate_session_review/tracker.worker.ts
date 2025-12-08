// This file is not imported directly. Its content is imported as a string in useSkateTracker.ts
// and used to create a worker blob.

export const workerString = `
// --- Worker Scope ---
let intervalId = null;

// Session State
let userStance = 'REGULAR';
let startTime = null;
let lastTimestamp = null;
let totalDistance = 0;
let timeOnBoard = 0;
let timeOffBoard = 0;
let topSpeed = 0;
let isRolling = false;

// Buffers
let path = [];
let highlights = [];
let lastPosition = null;
let accelBuffer = [];
let gyroBuffer = [];

const BUFFER_SIZE = 40; // ~2 seconds at 20hz

// Event Counts
let counts = {
    pumps: 0,
    ollies: 0,
    airs: 0,
    fsGrinds: 0,
    bsGrinds: 0,
    stalls: 0,
    slams: 0
};

// Thresholds
const FREEFALL_THRESHOLD = 0.3;
const IMPACT_THRESHOLD = 2.5;
const SLAM_THRESHOLD = 5.0;
const ROTATION_THRESHOLD = 200;

// State machines
let freefallStart = 0;
let potentialGrindStart = 0;
let entryRotation = 0;

// ---------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------

function haversineDistance(p1, p2) {
    const R = 6371e3;
    const phi1 = p1.lat * Math.PI / 180;
    const phi2 = p2.lat * Math.PI / 180;
    const dPhi = (p2.lat - p1.lat) * Math.PI / 180;
    const dLambda = (p2.lon - p1.lon) * Math.PI / 180;

    const a =
        Math.sin(dPhi / 2) ** 2 +
        Math.cos(phi1) * Math.cos(phi2) *
        Math.sin(dLambda / 2) ** 2;

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// ---------------------------------------------------------
// GPS Update Handling
// ---------------------------------------------------------

function handlePositionUpdate(position) {
    const { latitude, longitude, speed } = position.coords;
    const timestamp = position.timestamp;

    if (latitude == null || longitude == null) return;

    const current = {
        lat: latitude,
        lon: longitude,
        timestamp,
        speed
    };

    if (!lastPosition) {
        lastPosition = current;
        path.push(current);
        if (speed && speed > 0) topSpeed = speed;
        return;
    }

    const dt = (timestamp - lastPosition.timestamp) / 1000 || 1;
    const dist = haversineDistance(lastPosition, current);

    // Estimate fallback speed
    let effectiveSpeed = speed;
    if (effectiveSpeed == null) {
        effectiveSpeed = dist / dt;
    }

    // Reject impossible GPS noise (> 30 m/s = 108 km/h)
    if (effectiveSpeed < 0 || effectiveSpeed > 30) {
        return;
    }

    // Indoors drift filter: ignore random 20–200m jumps
    if (dist > 20 && dt < 5) {
        return;
    }

    // Don't count standing as distance
    if (effectiveSpeed < 0.2) {
        lastPosition = current;
        return;
    }

    // Accept point
    path.push(current);
    totalDistance += dist;

    if (effectiveSpeed > topSpeed) {
        topSpeed = effectiveSpeed;
    }

    lastPosition = current;
}

// ---------------------------------------------------------
// Motion Data Handling
// ---------------------------------------------------------

function handleDeviceMotion(data) {
    const { acc, rot, timestamp } = data;
    if (!acc || !rot) return;

    accelBuffer.push({ x: acc.x, y: acc.y, z: acc.z, timestamp });
    gyroBuffer.push({ alpha: rot.alpha, beta: rot.beta, gamma: rot.gamma, timestamp });

    if (accelBuffer.length > BUFFER_SIZE) accelBuffer.shift();
    if (gyroBuffer.length > BUFFER_SIZE) gyroBuffer.shift();
}

function classifyActivity(speed, stdDev) {
    if (speed > 2.5) return true; // skating > 9 km/h

    if (speed < 0.5 && stdDev < 0.1) return false; // standing

    if (stdDev > 0.6) return false; // walking

    if (stdDev > 0.05 && stdDev < 0.5) return true;

    return false;
}

// ---------------------------------------------------------
// Trick Detection
// ---------------------------------------------------------

function detectTricks(speed) {
    if (accelBuffer.length < 5 || gyroBuffer.length < 1) return;

    const a = accelBuffer[accelBuffer.length - 1];
    const g = gyroBuffer[gyroBuffer.length - 1];

    const gForce = Math.sqrt(a.x ** 2 + a.y ** 2 + a.z ** 2) / 9.81;

    // FREEFALL
    if (gForce < FREEFALL_THRESHOLD) {
        if (!freefallStart) freefallStart = a.timestamp;
    } else if (freefallStart) {
        const airTime = (a.timestamp - freefallStart) / 1000;

        if (gForce > SLAM_THRESHOLD) {
            addHighlight("SLAM", a.timestamp, 0, gForce);
            counts.slams++;
            isRolling = false;
        } else if (gForce > IMPACT_THRESHOLD) {
            if (airTime > 0.4) {
                addHighlight("AIR", a.timestamp, airTime, gForce);
                counts.airs++;
            } else if (airTime > 0.15) {
                addHighlight("OLLIE", a.timestamp, airTime, gForce);
                counts.ollies++;
            }
        }

        freefallStart = 0;
    }

    // ROTATION FOR GRINDS
    if (Math.abs(g.alpha) > ROTATION_THRESHOLD) {
        entryRotation = g.alpha;
        potentialGrindStart = a.timestamp;
    }

    if (potentialGrindStart && (a.timestamp - potentialGrindStart < 500)) {
        const t = a.timestamp - potentialGrindStart;
        if (t > 200 && Math.abs(g.alpha) < 50) {
            classifyGrind(entryRotation, t / 1000);
            potentialGrindStart = 0;
        }
    } else {
        potentialGrindStart = 0;
    }
}

function classifyGrind(rotAlpha, duration) {
    let frontside = false;

    if (userStance === 'REGULAR') {
        frontside = rotAlpha > 0;
    } else {
        frontside = rotAlpha < 0;
    }

    const speed = lastPosition?.speed ?? 0;

    if (speed < 1.0) {
        addHighlight("STALL", Date.now(), duration, 0);
        counts.stalls++;
        return;
    }

    if (frontside) {
        addHighlight("FS_GRIND", Date.now(), duration, 0);
        counts.fsGrinds++;
    } else {
        addHighlight("BS_GRIND", Date.now(), duration, 0);
        counts.bsGrinds++;
    }
}

function addHighlight(type, timestamp, duration, value) {
    const lastH = highlights[highlights.length - 1];
    if (lastH && timestamp - lastH.timestamp < 300) return;

    const h = { id: "h_" + timestamp, type, timestamp, duration, value };
    highlights.push(h);
    self.postMessage({ type: "HIGHLIGHT", payload: h });
}

// ---------------------------------------------------------
// Processing Loop
// ---------------------------------------------------------

function processSensorData() {
    const now = Date.now();
    if (!startTime) return; // session not ready yet

    if (!lastTimestamp) lastTimestamp = now;
    const dt = (now - lastTimestamp) / 1000;

    // STDDEV
    let stdDev = 0;
    if (accelBuffer.length > 5) {
        const mags = accelBuffer.map(a => Math.sqrt(a.x ** 2 + a.y ** 2 + a.z ** 2));
        const mean = mags.reduce((a, b) => a + b, 0) / mags.length;
        stdDev = Math.sqrt(mags.map(x => (x - mean) ** 2).reduce((a, b) => a + b, 0) / mags.length);
    }

    let speed = lastPosition?.speed ?? 0;

    // Reject absurd speeds but allow up to 108 km/h
    if (speed < 0 || speed > 30) speed = 0;

    isRolling = classifyActivity(speed, stdDev);

    if (isRolling) {
        timeOnBoard += dt;
        detectTricks(speed);
    } else {
        timeOffBoard += dt;
    }

    self.postMessage({
        type: "UPDATE",
        payload: {
            status: "tracking",
            stance: userStance,
            startTime,
            totalDistance,
            duration: (now - startTime) / 1000,
            timeOnBoard,
            timeOffBoard,
            currentSpeed: speed,
            topSpeed,
            isRolling
        }
    });

    lastTimestamp = now;
}

// ---------------------------------------------------------
// Start / Stop Session
// ---------------------------------------------------------

function startTracking(stance) {
    // FULL CLEAN RESET
    userStance = stance;
    startTime = Date.now();
    lastTimestamp = startTime;
    totalDistance = 0;
    timeOnBoard = 0;
    timeOffBoard = 0;
    topSpeed = 0;
    isRolling = false;

    path = [];
    highlights = [];
    lastPosition = null;
    accelBuffer = [];
    gyroBuffer = [];

    counts = {
        pumps: 0,
        ollies: 0,
        airs: 0,
        fsGrinds: 0,
        bsGrinds: 0,
        stalls: 0,
        slams: 0
    };

    freefallStart = 0;
    potentialGrindStart = 0;
    entryRotation = 0;

    if (intervalId !== null) clearInterval(intervalId);
    intervalId = setInterval(processSensorData, 200);
}

function stopTracking() {
    if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
    }

    const end = Date.now();

    const session = {
        id: "session_" + startTime,
        startTime,
        endTime: end,
        stance: userStance,
        totalDistance,
        activeTime: (end - startTime) / 1000,
        timeOnBoard,
        timeOffBoard,
        topSpeed,
        path,
        highlights,
        counts
    };

    self.postMessage({ type: "SESSION_END", payload: session });
}

// ---------------------------------------------------------
// Worker Message Router
// ---------------------------------------------------------

self.onmessage = evt => {
    const { type, payload } = evt.data;

    switch (type) {
        case "START":
            startTracking(payload.stance);
            break;

        case "STOP":
            stopTracking();
            break;

        case "POSITION_UPDATE":
            handlePositionUpdate(payload);
            break;

        case "MOTION":
            handleDeviceMotion(payload);
            break;
    }
};
`;
