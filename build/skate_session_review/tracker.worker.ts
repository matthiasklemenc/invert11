
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

// Thresholds
const ROLLING_VIBRATION_MIN = 0.02; // Smooth concrete hum
const ROLLING_VIBRATION_MAX = 0.5;  // Too much variance = walking steps
const WALK_STEP_THRESHOLD = 0.8;    // Rhythmic spikes
const FREEFALL_THRESHOLD = 0.3;     // G-force near 0
const IMPACT_THRESHOLD = 2.5;       // Landing G-force
const SLAM_THRESHOLD = 5.0;         // Slam/Bail (Lowered to catch controlled bails)
const ROTATION_THRESHOLD = 2.0;     // rad/s for turns

// Detection State Machines
let freefallStart = 0;
let potentialGrindStart = 0;
let entryRotation = 0; // To calc FS vs BS

function haversineDistance(p1, p2) {
    const R = 6371e3;
    const φ1 = p1.lat * Math.PI/180;
    const φ2 = p2.lat * Math.PI/180;
    const Δφ = (p2.lat-p1.lat) * Math.PI/180;
    const Δλ = (p2.lon-p1.lon) * Math.PI/180;
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function handlePositionUpdate(position) {
    const { latitude, longitude, speed } = position.coords;
    const timestamp = position.timestamp;
    const currentPosition = { lat: latitude, lon: longitude, timestamp, speed };
    path.push(currentPosition);

    if (lastPosition) {
        const distance = haversineDistance(lastPosition, currentPosition);
        // Only count distance if likely moving (prevent GPS drift accumulation)
        if (speed && speed > 0.5) {
            totalDistance += distance;
        }
    }
    
    if (speed !== null && speed > topSpeed) {
        topSpeed = speed;
    }
    lastPosition = currentPosition;
}

function handleDeviceMotion(event) {
    const now = Date.now();
    
    // Acceleration (Gravity included for orientation, excluded for movement? 
    // We usually want IncludingGravity for orientation/pumping, 
    // and rotationRate for spins)
    const acc = event.accelerationIncludingGravity;
    const rot = event.rotationRate;

    if (acc && rot) {
        accelBuffer.push({ x: acc.x, y: acc.y, z: acc.z, timestamp: now });
        gyroBuffer.push({ alpha: rot.alpha, beta: rot.beta, gamma: rot.gamma, timestamp: now });
        
        if (accelBuffer.length > BUFFER_SIZE) accelBuffer.shift();
        if (gyroBuffer.length > BUFFER_SIZE) gyroBuffer.shift();
    }
}

function classifyActivity(speed, stdDevAccel) {
    // 1. If GPS speed is decent (> 2.5 m/s approx 9km/h), almost certainly skating
    if (speed > 2.5) return true;

    // 2. If slow, check vibration signature
    // Walking has high peaks (steps). Skating has consistent low-med vibration.
    // Standing has near zero variance.
    
    if (speed < 0.5 && stdDevAccel < 0.1) return false; // Standing still
    
    // Walking typically creates rhythmic spikes > 0.8G variance
    if (stdDevAccel > 0.6) return false; // Walking / Running with phone
    
    // Skating usually implies smooth motion with specific texture vibration
    if (stdDevAccel > 0.05 && stdDevAccel < 0.5) return true;

    return false; // Default to off-board
}

function detectTricks(currentSpeed) {
    if (accelBuffer.length < 5) return;

    const lastAcc = accelBuffer[accelBuffer.length - 1];
    const lastGyro = gyroBuffer[gyroBuffer.length - 1];
    
    // Magnitude of G-Force (1.0 = normal gravity)
    const gForce = Math.sqrt(lastAcc.x**2 + lastAcc.y**2 + lastAcc.z**2) / 9.81;
    
    // --- 1. AIR / OLLIE / SLAM DETECTION ---
    if (gForce < FREEFALL_THRESHOLD) {
        if (freefallStart === 0) freefallStart = lastAcc.timestamp;
    } else {
        if (freefallStart > 0) {
            const airTime = (lastAcc.timestamp - freefallStart) / 1000;
            
            // Check Landing Impact
            if (gForce > IMPACT_THRESHOLD) {
                if (gForce > SLAM_THRESHOLD) {
                    // SLAM / BAIL
                    addHighlight('SLAM', lastAcc.timestamp, 0, gForce);
                    counts.slams++;
                    isRolling = false; // Force stop rolling immediately after a slam/bail
                } else if (airTime > 0.4) {
                    // BIG AIR
                    addHighlight('AIR', lastAcc.timestamp, airTime, gForce);
                    counts.airs++;
                } else if (airTime > 0.15) {
                    // OLLIE / POP
                    addHighlight('OLLIE', lastAcc.timestamp, airTime, gForce);
                    counts.ollies++;
                }
            }
            freefallStart = 0;
        }
    }

    // --- 2. PUMP DETECTION ---
    // Pumping creates a wave of G-force (> 1.5G) without sharp impact shock
    // This is hard to perfect, simplified version:
    if (gForce > 1.3 && gForce < 2.0 && freefallStart === 0 && isRolling) {
        // Debounce simple pump counter
        // (In real app, we'd look for the sine wave shape)
        // counts.pumps++; // Too noisy to enable without complex filter
    }

    // --- 3. GRIND / STALL DETECTION ---
    // Entry Rotation -> Stability -> Exit Rotation
    if (lastGyro && Math.abs(lastGyro.alpha) > 200) { // Fast rotation
        // Storing rotation direction for classification
        // Alpha: + is CCW (Left), - is CW (Right) usually
        entryRotation = lastGyro.alpha; 
        potentialGrindStart = lastAcc.timestamp;
    } 
    
    // If we had a rotation recently, and now we are stable (grinding/stalling)
    if (potentialGrindStart > 0 && (lastAcc.timestamp - potentialGrindStart < 500)) {
        const timeSinceRot = lastAcc.timestamp - potentialGrindStart;
        
        // Stable period?
        if (timeSinceRot > 100 && Math.abs(lastGyro.alpha) < 50) {
            // We are "locked in"
            // To confirm grind, we need to exit it or hold it. 
            // Simplified: If we hold stability for > 200ms after a rotation, classify it.
            if (timeSinceRot > 200) {
                classifyGrind(entryRotation, timeSinceRot/1000);
                potentialGrindStart = 0; // Reset
            }
        }
    } else {
        potentialGrindStart = 0; // Timed out
    }
}

function classifyGrind(rotAlpha, duration) {
    // Determine FS vs BS
    // Regular (Left Fwd): Turn Left (CCW/+) = Frontside. Turn Right (CW/-) = Backside.
    // Goofy (Right Fwd): Turn Right (CW/-) = Frontside. Turn Left (CCW/+) = Backside.
    
    let isFrontside = false;
    
    if (userStance === 'REGULAR') {
        if (rotAlpha > 0) isFrontside = true; // Left Turn
    } else {
        if (rotAlpha < 0) isFrontside = true; // Right Turn
    }

    const type = isFrontside ? 'FS_GRIND' : 'BS_GRIND';
    
    // If speed is very low, it's a stall (like 50/50 stall)
    const currentSpeed = lastPosition?.speed || 0;
    if (currentSpeed < 1.0) {
        addHighlight('STALL', Date.now(), duration, 0);
        counts.stalls++;
    } else {
        addHighlight(type, Date.now(), duration, 0);
        if (isFrontside) counts.fsGrinds++;
        else counts.bsGrinds++;
    }
}

function addHighlight(type, timestamp, duration, value) {
    // Simple debounce
    const lastH = highlights[highlights.length - 1];
    if (lastH && (timestamp - lastH.timestamp < 1000)) return;

    const h = { id: 'h_'+timestamp, type, timestamp, duration, value };
    highlights.push(h);
    self.postMessage({ type: 'HIGHLIGHT', payload: h });
}

function processSensorData() {
    const now = Date.now();
    const deltaTime = lastTimestamp ? (now - lastTimestamp) / 1000 : 0;
    
    // Calculate variance (standard deviation) of accel magnitude to detect vibration texture
    let stdDev = 0;
    if (accelBuffer.length > 5) {
        const mags = accelBuffer.map(a => Math.sqrt(a.x**2 + a.y**2 + a.z**2));
        const mean = mags.reduce((a,b)=>a+b,0) / mags.length;
        stdDev = Math.sqrt(mags.map(x => (x-mean)**2).reduce((a,b)=>a+b,0) / mags.length);
    }

    const currentSpeed = lastPosition?.speed ?? 0;
    
    // Activity Classification
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
            startTime,
            totalDistance,
            duration: (now - startTime) / 1000,
            timeOnBoard,
            timeOffBoard,
            currentSpeed,
            topSpeed,
            isRolling,
        }
    });
    
    lastTimestamp = now;
}

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
    counts = { pumps: 0, ollies: 0, airs: 0, fsGrinds: 0, bsGrinds: 0, stalls: 0, slams: 0 };
    
    lastPosition = null;
    accelBuffer = [];
    gyroBuffer = [];
    
    self.addEventListener('devicemotion', handleDeviceMotion);
    intervalId = setInterval(processSensorData, 200); // 5Hz updates to UI
}

function stopTracking() {
    if (intervalId !== null) clearInterval(intervalId);
    self.removeEventListener('devicemotion', handleDeviceMotion);
    
    const session = {
        id: 'session_' + startTime,
        startTime,
        endTime: Date.now(),
        stance: userStance,
        totalDistance,
        activeTime: (Date.now() - startTime) / 1000,
        timeOnBoard,
        timeOffBoard,
        topSpeed,
        path,
        highlights,
        counts // Pass the aggregate counts
    };
    self.postMessage({ type: 'SESSION_END', payload: session });
}

self.onmessage = (event) => {
    const { type, payload } = event.data;
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
    }
};
`;
