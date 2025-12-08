// This file is imported as a string inside useSkateTracker.ts
export const workerString = `

// --- Worker Scope ---
let intervalId = null;

// Session state
let userStance = 'REGULAR';
let startTime = null;
let lastTimestamp = null;
let totalDistance = 0;
let timeOnBoard = 0;
let timeOffBoard = 0;
let topSpeed = 0;
let isRolling = false;

let path = [];
let highlights = [];
let lastPosition = null;
let accelBuffer = [];
let gyroBuffer = [];

const BUFFER_SIZE = 35;

// ---------------------------------------------------------------------------
// *** FINAL REALME 12+ OPTIMIZED THRESHOLDS ***
// ---------------------------------------------------------------------------
const FREEFALL_THRESHOLD = 0.75;     // Realme filtered low g-force
const OLLIE_MIN_AIR = 0.10;          // 100ms airtime still counts
const AIR_MIN_AIR = 0.32;            // 320ms+ = real AIR
const IMPACT_THRESHOLD = 1.35;       // Realme impacts appear <1.8g
const SLAM_THRESHOLD = 2.35;         // Realme max peaks reach ~2.5g
const ROTATION_THRESHOLD = 85;       // Realme reports low rotation
const ROTATION_RELEASE = 40;         // After spike, rotation drops below this

let freefallStart = 0;
let potentialGrindStart = 0;
let entryRotation = 0;

// ---------------------------------------------------------------------------
// GPS
// ---------------------------------------------------------------------------
function haversineDistance(p1, p2) {
    const R = 6371e3;
    const phi1 = p1.lat * Math.PI/180;
    const phi2 = p2.lat * Math.PI/180;
    const dPhi = (p2.lat - p1.lat) * Math.PI/180;
    const dLambda = (p2.lon - p1.lon) * Math.PI/180;

    const a = Math.sin(dPhi/2)**2 +
              Math.cos(phi1) * Math.cos(phi2) *
              Math.sin(dLambda/2)**2;

    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function handlePositionUpdate(position) {
    const { latitude, longitude, speed } = position.coords;
    const timestamp = position.timestamp;

    if (latitude == null || longitude == null) return;

    const current = { lat: latitude, lon: longitude, timestamp, speed };

    if (!lastPosition) {
        lastPosition = current;
        path.push(current);
        topSpeed = speed ?? 0;
        return;
    }

    const dt = (timestamp - lastPosition.timestamp)/1000 || 1;
    const dist = haversineDistance(lastPosition, current);
    let effectiveSpeed = speed ?? dist/dt;

    if (effectiveSpeed < 0 || effectiveSpeed > 30) return;
    if (dist > 20 && dt < 5) return;

    if (effectiveSpeed < 0.20) {
        lastPosition = current;
        return;
    }

    path.push(current);
    totalDistance += dist;

    if (effectiveSpeed > topSpeed) topSpeed = effectiveSpeed;

    lastPosition = current;
}

// ---------------------------------------------------------------------------
// MOTION
// ---------------------------------------------------------------------------
function handleDeviceMotion(data) {
    const { acc, rot, timestamp } = data;
    if (!acc) return;

    accelBuffer.push({ x: acc.x, y: acc.y, z: acc.z, timestamp });
    if (rot) gyroBuffer.push({ alpha: rot.alpha, beta: rot.beta, gamma: rot.gamma, timestamp });

    if (accelBuffer.length > BUFFER_SIZE) accelBuffer.shift();
    if (gyroBuffer.length > BUFFER_SIZE) gyroBuffer.shift();
}

// ---------------------------------------------------------------------------
// Rolling classifier
// ---------------------------------------------------------------------------
function classifyActivity(speed, stdDev) {
    if (speed > 1.6) return true;    
    if (speed < 0.3 && stdDev < 0.10) return false;
    if (stdDev > 0.65) return false;
    if (stdDev > 0.045) return true;
    return false;
}

// ---------------------------------------------------------------------------
// Trick detection
// ---------------------------------------------------------------------------
function detectTricks() {
    if (accelBuffer.length < 5) return;

    const a = accelBuffer[accelBuffer.length - 1];
    const g = gyroBuffer[gyroBuffer.length - 1] ?? { alpha: 0 };

    const gForce = Math.sqrt(a.x*a.x + a.y*a.y + a.z*a.z) / 9.81;

    // ---------------- FREEFALL → AIR / OLLIE / SLAM ----------------
    if (gForce < FREEFALL_THRESHOLD) {
        if (!freefallStart) freefallStart = a.timestamp;
    }
    else if (freefallStart) {
        const airTime = (a.timestamp - freefallStart)/1000;

        if (gForce > SLAM_THRESHOLD) {
            addHighlight("SLAM", a.timestamp, airTime, gForce);
        }
        else if (gForce > IMPACT_THRESHOLD) {
            if (airTime >= AIR_MIN_AIR) {
                addHighlight("AIR", a.timestamp, airTime, gForce);
            }
            else if (airTime >= OLLIE_MIN_AIR) {
                addHighlight("OLLIE", a.timestamp, airTime, gForce);
            }
        }

        freefallStart = 0;
    }

    // ---------------- GRIND / STALL ----------------
    if (Math.abs(g.alpha) > ROTATION_THRESHOLD) {
        entryRotation = g.alpha;
        potentialGrindStart = a.timestamp;
    }

    if (potentialGrindStart && (a.timestamp - potentialGrindStart < 420)) {
        const t = a.timestamp - potentialGrindStart;

        if (t > 120 && Math.abs(g.alpha) < ROTATION_RELEASE) {
            classifyGrind(entryRotation, t/1000);
            potentialGrindStart = 0;
        }
    } else {
        potentialGrindStart = 0;
    }
}

// ---------------------------------------------------------------------------
// Grind classifier
// ---------------------------------------------------------------------------
function classifyGrind(rotAlpha, duration) {
    const speed = lastPosition?.speed ?? 0;
    let frontside = userStance === "REGULAR" ? rotAlpha > 0 : rotAlpha < 0;

    if (speed < 1.0) {
        addHighlight("STALL", Date.now(), duration, 0);
        return;
    }

    addHighlight(frontside ? "FS_GRIND" : "BS_GRIND", Date.now(), duration, rotAlpha);
}

// ---------------------------------------------------------------------------
function addHighlight(type, timestamp, duration, value) {
    const lastH = highlights[highlights.length - 1];
    if (lastH && timestamp - lastH.timestamp < 220) return;

    const h = { id: "h_" + timestamp, type, timestamp, duration, value };
    highlights.push(h);
    self.postMessage({ type: "HIGHLIGHT", payload: h });
}

// ---------------------------------------------------------------------------
// Processing loop (FASTER: 120ms → better for Realme)
// ---------------------------------------------------------------------------
function processSensorData() {
    const now = Date.now();
    if (!startTime) return;

    if (!lastTimestamp) lastTimestamp = now;
    const dt = (now - lastTimestamp)/1000;

    // stddev for activity
    let stdDev = 0;
    if (accelBuffer.length > 5) {
        const mags = accelBuffer.map(a => Math.sqrt(a.x*a.x + a.y*a.y + a.z*a.z));
        const mean = mags.reduce((a,b)=>a+b,0)/mags.length;
        stdDev = Math.sqrt(mags.map(x => (x-mean)**2).reduce((a,b)=>a+b,0) / mags.length);
    }

    let speed = lastPosition?.speed ?? 0;
    if (speed < 0 || speed > 30) speed = 0;

    isRolling = classifyActivity(speed, stdDev);

    if (isRolling) {
        timeOnBoard += dt;
        detectTricks();
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
            duration: (now - startTime)/1000,
            timeOnBoard,
            timeOffBoard,
            currentSpeed: speed,
            topSpeed,
            isRolling
        }
    });

    lastTimestamp = now;
}

// ---------------------------------------------------------------------------
function startTracking(stance) {
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
    accelBuffer = [];
    gyroBuffer = [];

    freefallStart = 0;
    potentialGrindStart = 0;
    entryRotation = 0;

    if (intervalId !== null) clearInterval(intervalId);
    intervalId = setInterval(processSensorData, 120);
}

function stopTracking() {
    if (intervalId !== null) clearInterval(intervalId);

    const end = Date.now();
    const session = {
        id: "session_" + startTime,
        startTime,
        endTime: end,
        stance: userStance,
        totalDistance,
        activeTime: (end - startTime)/1000,
        timeOnBoard,
        timeOffBoard,
        topSpeed,
        path,
        highlights,
        counts: {
            // keep counts for now (optional)
        }
    };

    self.postMessage({ type: "SESSION_END", payload: session });
}

// ---------------------------------------------------------------------------
self.onmessage = evt => {
    const { type, payload } = evt.data;
    switch (type) {
        case "START": startTracking(payload.stance); break;
        case "STOP": stopTracking(); break;
        case "POSITION_UPDATE": handlePositionUpdate(payload); break;
        case "MOTION": handleDeviceMotion(payload); break;
    }
};

`;
