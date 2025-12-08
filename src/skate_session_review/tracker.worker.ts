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

// Buffers
let path = [];
let highlights = [];
let lastPosition = null;
let accelBuffer = [];
let gyroBuffer = [];

const BUFFER_SIZE = 40;

// --- Restored counters (UI needs these!) ---
let counts = {
    pumps: 0,
    ollies: 0,
    airs: 0,
    fsGrinds: 0,
    bsGrinds: 0,
    stalls: 0,
    slams: 0
};

// ---------------------------------------------------------------------------
// ** RECALIBRATED & ROBUST THRESHOLDS **
// ---------------------------------------------------------------------------
const FREEFALL_THRESHOLD = 0.4;  // g-force < 0.4G indicates freefall
const IMPACT_THRESHOLD = 2.5;   // g-force > 2.5G indicates a landing
const SLAM_THRESHOLD = 4.5;     // g-force > 4.5G is a hard slam
const ROTATION_THRESHOLD = 250; // deg/s for a sharp turn/grind entry

let freefallStart = 0;
let potentialGrindStart = 0;
let entryRotation = 0;

// ---------------------------------------------------------------------------
// Distance calculation
// ---------------------------------------------------------------------------

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

    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ---------------------------------------------------------------------------
// Handle GPS updates
// ---------------------------------------------------------------------------

function handlePositionUpdate(position) {
    const { latitude, longitude, speed } = position.coords;
    const timestamp = position.timestamp;

    if (latitude == null || longitude == null) return;

    const current = { lat: latitude, lon: longitude, timestamp, speed };

    if (!lastPosition) {
        lastPosition = current;
        path.push(current);
        if (speed && speed > 0) topSpeed = speed;
        return;
    }

    const dt = (timestamp - lastPosition.timestamp) / 1000 || 1;
    const dist = haversineDistance(lastPosition, current);
    let effectiveSpeed = speed ?? (dist / dt);

    if (effectiveSpeed < 0 || effectiveSpeed > 30) return;
    if (dist > 20 && dt < 5) return;
    if (effectiveSpeed < 0.2) {
        lastPosition = current;
        return;
    }

    path.push(current);
    totalDistance += dist;

    if (effectiveSpeed > topSpeed) topSpeed = effectiveSpeed;

    lastPosition = current;
}

// ---------------------------------------------------------------------------
// Handle motion events (FIXED: Standardized on accelerationIncludingGravity)
// ---------------------------------------------------------------------------

function handleDeviceMotion(data) {
    // Use accelerationIncludingGravity for consistency across all devices.
    const acc = data.acc;
    const rot = data.rot;
    if (!acc || !rot) return;

    accelBuffer.push({ x: acc.x, y: acc.y, z: acc.z, timestamp: data.timestamp });
    gyroBuffer.push({ alpha: rot.alpha, beta: rot.beta, gamma: rot.gamma, timestamp: data.timestamp });

    if (accelBuffer.length > BUFFER_SIZE) accelBuffer.shift();
    if (gyroBuffer.length > BUFFER_SIZE) gyroBuffer.shift();
}

// ---------------------------------------------------------------------------
// Activity classification
// ---------------------------------------------------------------------------

function classifyActivity(speed, stdDev) {
    if (speed > 2.0) return true;
    if (speed < 0.4 && stdDev < 0.12) return false;
    if (stdDev > 0.7) return false;
    if (stdDev > 0.05) return true;
    return false;
}

// ---------------------------------------------------------------------------
// Trick detection (FIXED: Logic now works with gravity-included data)
// ---------------------------------------------------------------------------

function detectTricks(speed) {
    if (accelBuffer.length < 5) return;

    const a = accelBuffer[accelBuffer.length - 1];
    const g = gyroBuffer[gyroBuffer.length - 1] || { alpha: 0 };

    // This calculation is now correct because we're using gravity-included data.
    // At rest, gForce will be ~1.0. In freefall, it will be close to 0.
    const gForce = Math.sqrt(a.x**2 + a.y**2 + a.z**2) / 9.81;

    // FREEFALL DETECTION
    if (gForce < FREEFALL_THRESHOLD) {
        if (!freefallStart) freefallStart = a.timestamp;
    } else if (freefallStart) { // This block triggers on LANDING
        const airTime = (a.timestamp - freefallStart) / 1000;

        // Check impact force to classify the trick
        if (gForce > SLAM_THRESHOLD) {
            addHighlight("SLAM", a.timestamp, airTime, gForce);
            counts.slams++;
        }
        else if (gForce > IMPACT_THRESHOLD) {
            if (airTime > 0.40) { // Long airtime = AIR
                addHighlight("AIR", a.timestamp, airTime, gForce);
                counts.airs++;
            } else if (airTime > 0.12) { // Short airtime = OLLIE
                addHighlight("OLLIE", a.timestamp, airTime, gForce);
                counts.ollies++;
            }
        }

        freefallStart = 0; // Reset after landing
    }

    // ROTATION -> GRIND DETECTION
    if (Math.abs(g.alpha) > ROTATION_THRESHOLD) {
        if (!potentialGrindStart) { // Only capture the initial rotation
            entryRotation = g.alpha;
            potentialGrindStart = a.timestamp;
        }
    }

    if (potentialGrindStart && (a.timestamp - potentialGrindStart < 450)) {
        const timeSinceTurn = a.timestamp - potentialGrindStart;

        // If rotation stops after a quick turn, it's a grind/stall
        if (timeSinceTurn > 150 && Math.abs(g.alpha) < 45) {
            classifyGrind(entryRotation, timeSinceTurn / 1000);
            potentialGrindStart = 0;
        }
    } else {
        potentialGrindStart = 0;
    }
}

// ---------------------------------------------------------------------------
// Grind classification
// ---------------------------------------------------------------------------

function classifyGrind(rotAlpha, duration) {
    let frontside = false;

    if (userStance === 'REGULAR') {
        frontside = rotAlpha > 0;
    } else { // Goofy
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

// ---------------------------------------------------------------------------
// Emit highlight to UI
// ---------------------------------------------------------------------------

function addHighlight(type, timestamp, duration, value) {
    const lastH = highlights[highlights.length - 1];
    // Debounce highlights to prevent duplicates from a single event
    if (lastH && timestamp - lastH.timestamp < 300) return;

    const h = { id: "h_" + timestamp, type, timestamp, duration, value };
    highlights.push(h);
    self.postMessage({ type: "HIGHLIGHT", payload: h });
}

// ---------------------------------------------------------------------------
// Processing loop
// ---------------------------------------------------------------------------

function processSensorData() {
    const now = Date.now();
    if (!startTime) return;

    if (!lastTimestamp) lastTimestamp = now;
    const dt = (now - lastTimestamp) / 1000;

    let stdDev = 0;
    if (accelBuffer.length > 5) {
        const mags = accelBuffer.map(a => Math.sqrt(a.x**2 + a.y**2 + a.z**2));
        const mean = mags.reduce((a,b)=>a+b,0) / mags.length;
        stdDev = Math.sqrt(
            mags.map(x => (x-mean)**2).reduce((a,b)=>a+b,0) / mags.length
        );
    }

    let speed = lastPosition?.speed ?? 0;
    if (speed < 0 || speed > 30) speed = 0;

    isRolling = classifyActivity(speed, stdDev);

    if (isRolling) {
        timeOnBoard += dt;
        detectTricks(speed);
    } else {
        timeOffBoard += dt;
    }

    // --- SEND STATE & COUNTS TO UI ---
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
            isRolling,
            counts
        }
    });

    lastTimestamp = now;
}

// ---------------------------------------------------------------------------
// Session control
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

    self.postMessage({
        type: "SESSION_END",
        payload: {
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
            counts
        }
    });
}

// ---------------------------------------------------------------------------
// Message routing
// ---------------------------------------------------------------------------

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