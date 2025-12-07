
import { ObstacleType } from './GameTypes';

export const KAI_IMAGE_URL = "https://images.unsplash.com/photo-1520045864941-8974ad6b2f0d?q=80&w=400&auto=format&fit=crop";
export const GRAVITY = 0.6;
export const JUMP_FORCE = -18; 
export const BASE_FLOOR_Y = 250; 
export const SPEED = 7;

// --- KAI SPRITE ASSETS ---
export const KAI_SPRITES = {
    RIDE: [new Image(), new Image(), new Image(), new Image()],
    PUSH: [new Image(), new Image()]
};

// Initialize placeholders 
KAI_SPRITES.RIDE[0].src = "https://placehold.co/100x150/333/FFF/png?text=Ride+1";
KAI_SPRITES.RIDE[1].src = "https://placehold.co/100x150/333/FFF/png?text=Ride+2";
KAI_SPRITES.RIDE[2].src = "https://placehold.co/100x150/333/FFF/png?text=Ride+3";
KAI_SPRITES.RIDE[3].src = "https://placehold.co/100x150/333/FFF/png?text=Ride+4";

KAI_SPRITES.PUSH[0].src = "https://placehold.co/100x150/c52323/FFF/png?text=Push+1";
KAI_SPRITES.PUSH[1].src = "https://placehold.co/100x150/c52323/FFF/png?text=Push+2";


export const STANDARD_OBSTACLES: { type: ObstacleType, w: number, h: number, grind: boolean, gap: boolean, isPlatform?: boolean, yOffset?: number }[] = [
    { type: 'hydrant', w: 30, h: 40, grind: true, gap: false }, 
    { type: 'police_car', w: 100, h: 50, grind: false, gap: false }, 
    { type: 'cybertruck', w: 120, h: 50, grind: true, gap: false },
    { type: 'cart', w: 50, h: 50, grind: false, gap: false },
    { type: 'ledge', w: 150, h: 30, grind: true, gap: false },
    { type: 'curb', w: 40, h: 15, grind: true, gap: false },
    { type: 'rail', w: 100, h: 40, grind: true, gap: false }, 
    { type: 'flat_rail', w: 120, h: 20, grind: true, gap: false }, 
    { type: 'bin', w: 40, h: 60, grind: false, gap: false },
    { type: 'grey_bin', w: 40, h: 60, grind: false, gap: false },
    { type: 'ramp', w: 160, h: 40, grind: false, gap: false, isPlatform: true },
    { type: 'gap', w: 100, h: 10, grind: false, gap: true, yOffset: 10 }, 
];

export const formatScore = (s: number) => {
    const absScore = Math.floor(Math.abs(s)).toString().padStart(6, '0');
    return s < 0 ? `-${absScore}` : absScore;
};