export type GpsPoint = {
    lat: number;
    lon: number;
    timestamp: number;
    speed: number | null;
};

export type Highlight = {
    id: string;
    type: 'IMPACT' | 'AIRTIME' | 'GRIND' | 'CARVE';
    timestamp: number;
    duration: number; // For airtime, grind, carve
    value: number; // For impact G-force, etc.
};

export type SkateSession = {
    id: string;
    startTime: number;
    endTime: number;
    totalDistance: number; // meters
    activeTime: number; // seconds
    inactiveTime: number; // seconds
    topSpeed: number; // m/s
    path: GpsPoint[];
    highlights: Highlight[];
};

export type TrackerState = {
    status: 'idle' | 'tracking' | 'denied' | 'error';
    startTime: number | null;
    totalDistance: number;
    activeTime: number;
    inactiveTime: number;
    currentSpeed: number;
    topSpeed: number;
    isActivelySkating: boolean;
};

// Data sent from main thread to worker for a position update
export type PositionUpdatePayload = {
    coords: {
        latitude: number;
        longitude: number;
        speed: number | null;
    };
    timestamp: number;
};

// Types for messages sent TO the worker
export type WorkerCommand = 
    | { type: 'START' }
    | { type: 'STOP' }
    | { type: 'POSITION_UPDATE', payload: PositionUpdatePayload };


// Types for messages received FROM the worker
export type WorkerMessage =
    | { type: 'UPDATE'; payload: TrackerState }
    | { type: 'HIGHLIGHT'; payload: Highlight }
    | { type: 'SESSION_END'; payload: SkateSession }
    | { type: 'ERROR'; payload: { message: string }};