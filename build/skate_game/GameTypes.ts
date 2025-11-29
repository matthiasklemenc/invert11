
import { ObstacleType, CharacterType } from './DrawingHelpers';

export type GameState = 'MENU' | 'PLAYING' | 'GAME_OVER' | 'OXXO_SHOP';
export type PlayerState = 'RUNNING' | 'COASTING' | 'JUMPING' | 'GRINDING' | 'CRASHED' | 'TUMBLING' | 'NATAS_SPIN' | 'ARRESTED' | 'ABDUCTED';
export type WorldState = 'NORMAL' | 'TRANSITION_DOWN' | 'UNDERWORLD' | 'SPACE' | 'BEAM_DOWN';

export interface Player {
    x: number;
    y: number;
    vy: number;
    state: PlayerState;
    rotation: number;
    trickName: string;
    isFakie: boolean;
    pushTimer: number;
    pushCount: number;
    targetPushes: number;
    coastingDuration: number;
    natasSpinCount: number;
    natasSpinTarget: number;
    natasTapCount: number;
    lastNatasTapTime: number;
    platformId: number | null;
}

export interface Obstacle {
    id: number;
    x: number;
    y: number; 
    w: number;
    h: number;
    type: ObstacleType;
    isGrindable: boolean;
    isGap: boolean;
    isPlatform?: boolean;
    passed: boolean;
    sprayingWater?: boolean;
    doorOpen?: boolean;
    firecrackerTriggered?: boolean;
    
    // Fireball specific props
    fireballBaseY?: number;
    fireballHeight?: number;
    fireballSpeed?: number;
    fireballOffset?: number;
}

export interface Collectible {
    id: number;
    x: number;
    y: number;
    type: 'COIN' | 'DIAMOND';
    collected: boolean;
}

export interface Projectile {
    id: number;
    x: number;
    y: number;
    vx: number;
    vy: number; // Added vy for 360 laser
    life: number;
}

export interface FloatingText {
    id: number;
    x: number;
    y: number;
    text: string;
    color: string;
    life: number;
}

export interface GameStats {
    grinds: number;
    jumps: number;
    c180: number;
    c360: number;
}

export interface Powerups {
    has360Laser: boolean;
    speedBoostTimer: number; // > 0 means active
    psychedelicMode: boolean;
    doubleSpawnRate: boolean; // For UFOs (Chips)
    doubleCoins: boolean;     // For Coke
}
