import React, { useRef, useEffect } from 'react';
import { KAI_SPRITES } from './GameConstants';

export type CharacterType = 'male_short' | 'male_cap' | 'female_long' | 'female_short' | 'alien';

export const CHARACTERS: {id: CharacterType, name: string, defaultName: string}[] = [
    { id: 'female_long', name: 'Bali', defaultName: 'Bali' },
    { id: 'male_cap', name: 'Kai', defaultName: 'Kai' },
    { id: 'female_short', name: 'Rayssa', defaultName: 'Rayssa' },
    { id: 'male_short', name: 'Dubs', defaultName: 'Dubs' },
    { id: 'alien', name: 'Area 51', defaultName: 'Gnarls' },
];

export function getOxxoPosition(width: number, height: number, scroll: number, offsetY: number, spaceEntryScroll: number = 0) {
    const oxxoSpeed = 0.08;
    const oxxoSpacing = width * 2.5; // Increased spacing so it doesn't repeat too often
    
    // We want it to be at width/2 when scroll == spaceEntryScroll
    // Relative scroll distance traveled since entering space
    const relativeScroll = scroll - spaceEntryScroll;
    
    // Calculate X. 
    // Start at center (width/2).
    // Move left as we scroll (-relativeScroll * speed).
    // Wrap around using modulo logic with spacing.
    // We add oxxoSpacing before modulo to handle negative numbers if any, though scroll usually increases.
    const startX = width / 2;
    const dist = relativeScroll * oxxoSpeed;
    
    // Standard wrapping formula: ((start - dist) % spacing + spacing) % spacing
    const oxxoX = ((startX - dist) % oxxoSpacing + oxxoSpacing) % oxxoSpacing;
    
    const oxxoY = (height * 0.3 + offsetY * 0.08);
    
    return { x: oxxoX, y: oxxoY };
}

export function drawPsychedelicOverlay(ctx: CanvasRenderingContext2D, width: number, height: number, frame: number) {
    ctx.save();
    // Create a moving colorful pattern
    const time = frame * 0.05;
    
    // Use 'screen' or 'lighter' to add to the existing background
    ctx.globalCompositeOperation = 'screen';
    
    // Draw rotating spirals
    const centerX = width / 2;
    const centerY = height / 2;
    const maxRadius = Math.sqrt(width*width + height*height);
    
    for (let i = 0; i < 8; i++) {
        const hue = (time * 50 + i * 45) % 360;
        ctx.beginPath();
        ctx.strokeStyle = `hsla(${hue}, 80%, 50%, 0.4)`;
        ctx.lineWidth = 15 + Math.sin(time + i) * 10;
        
        const angleOffset = time * (i % 2 === 0 ? 1 : -1) * 0.2;
        
        // Draw spiral
        for (let r = 0; r < maxRadius; r+=20) {
            const angle = angleOffset + r * 0.02 + i;
            const x = centerX + Math.cos(angle) * r;
            const y = centerY + Math.sin(angle) * r;
            if (r === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
    }
    
    // Add some floating fractals/blobs
    for (let i = 0; i < 6; i++) {
        const x = (Math.sin(time * 0.2 + i) * 0.5 + 0.5) * width;
        const y = (Math.cos(time * 0.3 + i * 2) * 0.5 + 0.5) * height;
        const radius = 60 + Math.sin(time * 1.5 + i) * 40;
        const hue = (time * 30 + i * 60) % 360;
        
        const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
        grad.addColorStop(0, `hsla(${hue}, 100%, 60%, 0.5)`);
        grad.addColorStop(1, `hsla(${hue}, 100%, 40%, 0)`);
        
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();
}

export function drawTransitionPipe(ctx: CanvasRenderingContext2D, width: number, height: number, offsetY: number) {
    const startY = 250; // Surface level
    const endY = 1000;  // Deep underground
    
    // Fill background sky first, as we might scroll up past the earth
    ctx.fillStyle = '#0f172a'; // Sky color matching city background
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    // Apply the vertical scroll to the world elements
    ctx.translate(0, offsetY);
    
    // Earth fill surrounding the pipe
    ctx.fillStyle = '#2c1810'; // Dark brown soil
    ctx.fillRect(0, startY, width, endY - startY + 1500); 
    
    // Pipe Geometry: Steeper drop
    const pipeWidth = 160;
    const startX = 180;
    const endX = startX + 300; // Steep diagonal drop
    
    // 1. Draw the black void of the pipe
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY); // Top edge
    ctx.lineTo(endX - pipeWidth * 0.5, endY + pipeWidth); // Bottom edge end
    ctx.lineTo(startX - pipeWidth * 0.5, startY + pipeWidth); // Bottom edge start
    ctx.closePath();
    ctx.fillStyle = '#0f0f0f';
    ctx.fill();
    
    // 2. Draw the Pipe Interior (Gradient)
    const grad = ctx.createLinearGradient(startX, startY, startX, startY + pipeWidth);
    grad.addColorStop(0, '#111');
    grad.addColorStop(0.2, '#222');
    grad.addColorStop(0.5, '#3a3a3a'); // Shine in middle
    grad.addColorStop(0.8, '#222');
    grad.addColorStop(1, '#111');
    
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.lineTo(endX - pipeWidth * 0.5, endY + pipeWidth);
    ctx.lineTo(startX - pipeWidth * 0.5, startY + pipeWidth);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
    
    // 3. Pipe Ribs/Segments for visual speed/depth
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.3;
    
    const segments = 20;
    const dx = (endX - startX) / segments;
    const dy = (endY - startY) / segments;
    
    for(let i=0; i<segments; i++) {
        const px = startX + dx * i;
        const py = startY + dy * i;
        
        // Draw an ellipse segment to simulate a round pipe joint
        ctx.beginPath();
        ctx.ellipse(px, py + pipeWidth/2, 30, pipeWidth/2, Math.PI/5, 0, Math.PI*2);
        ctx.stroke();
    }
    
    ctx.restore();
}

export function drawSpaceBackground(ctx: CanvasRenderingContext2D, width: number, height: number, scroll: number, offsetY: number = 0, showOxxo: boolean = false, isPsychedelic: boolean = false, frame: number = 0, spaceEntryScroll: number = 0) {
    // 1. Deep Space Background or Psychedelic
    if (isPsychedelic) {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, width, height);
        drawPsychedelicOverlay(ctx, width, height, frame);
    } else {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, width, height);
    }

    // Helper to draw a layer of stars
    const drawStarLayer = (count: number, speed: number, sizeBase: number, color: string) => {
        ctx.fillStyle = color;
        for(let i=0; i<count; i++) {
            // Pseudo-random position based on index
            const baseX = (Math.abs(Math.sin(i * 132.1)) * width);
            const baseY = (Math.abs(Math.cos(i * 53.7)) * height);
            
            // Horizontal scroll with wrapping (moving left as we skate right)
            const x = ((baseX - scroll * speed) % width + width) % width;
            
            // Vertical parallax (wrapping)
            const y = ((baseY + offsetY * speed * 0.5) % height + height) % height;

            const size = sizeBase * (0.5 + Math.abs(Math.sin(i)) * 0.5);
            
            ctx.beginPath(); 
            ctx.arc(x, y, size, 0, Math.PI*2); 
            ctx.fill();
        }
    };

    // 2. Star Layers (Parallax) - Draw stars over psychedelic too for depth? Or hide them? Let's hide them for cleaner effect.
    if (!isPsychedelic) {
        drawStarLayer(100, 0.1, 1.5, '#64748b');
        drawStarLayer(80, 0.3, 2.0, '#94a3b8');
        drawStarLayer(40, 0.6, 3.0, '#ffffff');
    }

    // 3. Space Station Background Elements (Satellite only - Large station removed)
    
    // Satellite
    const satSpeed = 0.05;
    // Ensure clean wrapping for larger objects
    const satSpacing = width * 1.5;
    const satBaseX = width * 0.5;
    const satScrollX = ((satBaseX - scroll * satSpeed) % satSpacing + satSpacing) % satSpacing;
    
    // Only draw if somewhat visible
    if (satScrollX > -100 && satScrollX < width + 100) {
        const satY = 120 + offsetY * 0.03;
        ctx.save();
        ctx.translate(satScrollX, satY);
        ctx.rotate(0.2);
        // Gold Solar Wings
        ctx.fillStyle = '#eab308'; 
        ctx.fillRect(-45, -15, 35, 30);
        ctx.fillRect(10, -15, 35, 30);
        ctx.strokeStyle = '#a16207';
        ctx.lineWidth = 1;
        ctx.strokeRect(-45, -15, 35, 30);
        ctx.strokeRect(10, -15, 35, 30);
        
        // Body
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(-10, -15, 20, 30);
        
        // Dish
        ctx.fillStyle = '#cbd5e1';
        ctx.beginPath();
        ctx.ellipse(0, 15, 10, 5, 0, 0, Math.PI);
        ctx.fill();
        
        ctx.restore();
    }

    // 4. Planets & Objects
    
    // OXXO Planet (Only if showOxxo is true)
    if (showOxxo) {
        // Use shared helper for position
        const pos = getOxxoPosition(width, height, scroll, offsetY, spaceEntryScroll);
        const oxxoX = pos.x;
        const oxxoY = pos.y;

        if (oxxoX > -200 && oxxoX < width + 200) {
            ctx.save();
            ctx.translate(oxxoX, oxxoY);
            
            // Planet Body (Yellowish)
            const gradOxxo = ctx.createRadialGradient(-30, -30, 10, 0, 0, 100);
            gradOxxo.addColorStop(0, '#fef08a'); // Light yellow
            gradOxxo.addColorStop(0.5, '#facc15'); // Yellow
            gradOxxo.addColorStop(1, '#ca8a04'); // Dark yellow
            
            ctx.fillStyle = gradOxxo;
            ctx.beginPath(); 
            ctx.arc(0, 0, 90, 0, Math.PI*2); 
            ctx.fill();
            
            // Atmosphere glow
            ctx.shadowColor = '#fde047';
            ctx.shadowBlur = 20;
            ctx.strokeStyle = 'rgba(253, 224, 71, 0.3)';
            ctx.lineWidth = 5;
            ctx.stroke();
            ctx.shadowBlur = 0;

            // OXXO Store on top of planet
            ctx.rotate(-0.2); 
            ctx.translate(0, -88); // Move to surface

            // Store Box
            ctx.fillStyle = '#dc2626'; // Red
            ctx.fillRect(-30, -30, 60, 35);
            
            // Yellow Stripe
            ctx.fillStyle = '#fbbf24'; // Gold/Yellow
            ctx.fillRect(-30, -30, 60, 8);
            
            // Logo Text
            ctx.fillStyle = 'white';
            ctx.font = 'bold 16px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('OXXO', 0, -12);
            
            // Door/Window
            ctx.fillStyle = '#bae6fd'; // Light blue glass
            ctx.fillRect(-20, 5, 40, 25); 
            
            ctx.restore();
        }
    }

    // Mars
    const marsSpeed = 0.15;
    const marsSpacing = width * 4; 
    const marsBaseX = width * 0.8;
    const marsX = ((marsBaseX - scroll * marsSpeed) % marsSpacing + marsSpacing) % marsSpacing;
    const marsY = (height * 0.6 + offsetY * 0.1); 
    
    if (marsX > -100 && marsX < width + 100) {
        ctx.save();
        ctx.translate(marsX, marsY);
        
        const gradMars = ctx.createRadialGradient(-20, -20, 10, 0, 0, 80);
        gradMars.addColorStop(0, '#ef4444'); 
        gradMars.addColorStop(0.6, '#b91c1c'); 
        gradMars.addColorStop(1, '#7f1d1d'); 
        ctx.fillStyle = gradMars;
        ctx.beginPath(); ctx.arc(0, 0, 70, 0, Math.PI*2); ctx.fill();
        
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath(); ctx.ellipse(-20, -10, 10, 5, 0.2, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(30, 20, 15, 8, -0.1, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(10, -40, 8, 4, 0, 0, Math.PI*2); ctx.fill();

        ctx.restore();
        
        // Rocket
        const rocketX = marsX + 160; 
        const rocketY = marsY + Math.sin(Date.now() / 500) * 10; 
        
        if (rocketX > -50 && rocketX < width + 50) {
            ctx.save();
            ctx.translate(rocketX, rocketY);
            ctx.rotate(-Math.PI / 4); 
            ctx.scale(0.6, 0.6);

            ctx.fillStyle = '#f59e0b';
            ctx.beginPath();
            ctx.moveTo(-10, 25);
            ctx.lineTo(0, 50 + Math.random() * 10);
            ctx.lineTo(10, 25);
            ctx.fill();

            ctx.fillStyle = '#e2e8f0';
            ctx.beginPath(); ctx.ellipse(0, 0, 15, 40, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#38bdf8';
            ctx.beginPath(); ctx.arc(0, -10, 6, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#c52323';
            ctx.beginPath();
            ctx.moveTo(-15, 10); ctx.lineTo(-25, 35); ctx.lineTo(-5, 25);
            ctx.moveTo(15, 10); ctx.lineTo(25, 35); ctx.lineTo(5, 25);
            ctx.fill();
            ctx.restore();
        }
    }
}

export function drawCityBackground(ctx: CanvasRenderingContext2D, width: number, height: number, scroll: number, floorY: number, viewOffsetY: number = 0) {
    // 1. Background Sky
    // Fade from slate blue (city sky) to black (space) as we go higher (viewOffsetY increases)
    let r = 15, g = 23, b = 42; // #0f172a (Slate 900)
    
    if (viewOffsetY > 0) {
        const fadeStart = 300; // Start fading sooner
        const fadeEnd = 1500;
        const progress = Math.max(0, Math.min(1, (viewOffsetY - fadeStart) / (fadeEnd - fadeStart)));
        
        // Interpolate towards black (0,0,0)
        r = Math.floor(15 * (1 - progress));
        g = Math.floor(23 * (1 - progress));
        b = Math.floor(42 * (1 - progress));
    }
    
    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    ctx.fillRect(0, 0, width, height);

    // Calculate sky position based on viewOffsetY (camera moving up means sky moves down)
    const skyY = viewOffsetY;
    // Only draw the gradient part if it is within view
    if (skyY < height) {
        const grad = ctx.createLinearGradient(0, skyY, 0, height + skyY);
        grad.addColorStop(0, '#0f172a'); 
        grad.addColorStop(1, '#334155'); // Lighter slate at horizon
        ctx.fillStyle = grad;
        ctx.fillRect(0, skyY, width, height);

        // 2. Sun/Moon (Only visible if we are essentially on earth or low atmosphere)
        if (viewOffsetY < 800) {
            ctx.save();
            ctx.translate(width * 0.8, height * 0.25 + skyY * 0.8);
            ctx.fillStyle = '#c52323'; // Brand red
            ctx.shadowColor = '#c52323';
            ctx.shadowBlur = 40;
            ctx.beginPath();
            ctx.arc(0, 0, 50, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    // --- Mars & Rocket in City Background (High Altitude / Cybertruck Launch) ---
    // Lowered threshold to 300 to start preparing as camera ascends
    if (viewOffsetY > 300) {
        // Force Mars to be horizontally centered on the screen
        const marsX = width / 2;
        
        // Position Mars relative to the "top" of the atmosphere so it descends into view
        // Adjusted calculation: At viewOffsetY ~300, it's just off screen top. 
        // At ~1000+, it descends.
        const marsY = -350 + (viewOffsetY - 300) * 0.6; 
        
        if (marsY < height + 400) {
            ctx.save();
            ctx.translate(marsX, marsY);
            
            const gradMars = ctx.createRadialGradient(-20, -20, 10, 0, 0, 80);
            gradMars.addColorStop(0, '#ef4444'); 
            gradMars.addColorStop(0.6, '#b91c1c'); 
            gradMars.addColorStop(1, '#7f1d1d'); 
            ctx.fillStyle = gradMars;
            ctx.beginPath(); ctx.arc(0, 0, 70, 0, Math.PI*2); ctx.fill();
            
            ctx.fillStyle = 'rgba(0,0,0,0.2)';
            ctx.beginPath(); ctx.ellipse(-20, -10, 10, 5, 0.2, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(30, 20, 15, 8, -0.1, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(10, -40, 8, 4, 0, 0, Math.PI*2); ctx.fill();

            ctx.restore();
            
            // Rocket
            const rocketX = marsX + 160; 
            const rocketY = marsY + Math.sin(Date.now() / 500) * 10; 
            
            ctx.save();
            ctx.translate(rocketX, rocketY);
            ctx.rotate(-Math.PI / 4); 
            ctx.scale(0.6, 0.6);

            ctx.fillStyle = '#f59e0b';
            ctx.beginPath();
            ctx.moveTo(-10, 25);
            ctx.lineTo(0, 50 + Math.random() * 10);
            ctx.lineTo(10, 25);
            ctx.fill();

            ctx.fillStyle = '#e2e8f0';
            ctx.beginPath(); ctx.ellipse(0, 0, 15, 40, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#38bdf8';
            ctx.beginPath(); ctx.arc(0, -10, 6, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#c52323';
            ctx.beginPath();
            ctx.moveTo(-15, 10); ctx.lineTo(-25, 35); ctx.lineTo(-5, 25);
            ctx.moveTo(15, 10); ctx.lineTo(25, 35); ctx.lineTo(5, 25);
            ctx.fill();
            ctx.restore();
        }
    }

    // Helper for deterministic pseudo-random numbers
    const pseudoRandom = (x: number) => {
        return Math.abs(Math.sin(x * 12.9898) * 43758.5453) % 1;
    };

    // 3. Parallax Layers (Buildings)
    const layers = [
        { speed: 0.05, color: '#1e293b', width: 120, heightMod: 200, baseH: 150, seed: 1, windows: false }, 
        { speed: 0.15, color: '#334155', width: 80, heightMod: 150, baseH: 80, seed: 2, windows: false },
        { speed: 0.3, color: '#475569', width: 60, heightMod: 100, baseH: 50, seed: 3, windows: true } 
    ];

    const buildingOffsetY = floorY + viewOffsetY; // Buildings are attached to the floor

    // Only draw buildings if they are on screen
    if (buildingOffsetY > -200) {
        layers.forEach(layer => {
            ctx.fillStyle = layer.color;
            const effectiveScroll = scroll * layer.speed;
            
            const startIdx = Math.floor(effectiveScroll / layer.width);
            const endIdx = startIdx + Math.ceil(width / layer.width) + 1;

            for (let i = startIdx; i <= endIdx; i++) {
                const hFactor = pseudoRandom(i * layer.seed);
                const h = layer.baseH + hFactor * layer.heightMod;
                const x = Math.floor(i * layer.width - effectiveScroll);
                
                const bY = buildingOffsetY - h;
                // Draw building if visible
                if (bY < height) {
                    ctx.fillRect(x, bY, layer.width + 1, h + 500); 

                    // Windows
                    if (layer.windows && hFactor > 0.4) {
                        ctx.fillStyle = '#1e293b'; 
                        const winSize = 4;
                        const gap = 10;
                        const cols = Math.floor((layer.width - gap) / (winSize + gap));
                        const rows = Math.floor((h - 30) / (winSize + gap));
                        
                        for (let r = 0; r < rows; r++) {
                            for (let c = 0; c < cols; c++) {
                                if (pseudoRandom(i * r * c + layer.seed) > 0.3) {
                                    ctx.fillRect(
                                        x + gap + c * (winSize + gap), 
                                        bY + 15 + r * (winSize + gap), 
                                        winSize, 
                                        winSize
                                    );
                                }
                            }
                        }
                        ctx.fillStyle = layer.color; 
                    }
                }
            }
        });
    }
}

export function drawUnderworldBackground(ctx: CanvasRenderingContext2D, width: number, height: number, scroll: number) {
    // Dark red/cave background
    ctx.fillStyle = '#1a0505'; // Very dark red/black
    ctx.fillRect(0, 0, width, height);

    // Parallax layer 1 (Background spikes/stalactites)
    ctx.fillStyle = '#2b0a0a';
    const layer1Speed = 0.2;
    const layer1Scroll = scroll * layer1Speed;
    const spikeW = 50;
    
    // Draw stalactites at top
    for (let x = - (layer1Scroll % spikeW); x < width; x += spikeW) {
        const h = 50 + Math.abs(Math.sin((x + layer1Scroll) * 0.01)) * 100;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + spikeW/2, h);
        ctx.lineTo(x + spikeW, 0);
        ctx.fill();
    }

    // Parallax layer 2 (Foreground-ish pillars/rocks)
    ctx.fillStyle = '#3f1010';
    const layer2Speed = 0.5;
    const layer2Scroll = scroll * layer2Speed;
    const rockW = 150;
    
    for (let x = - (layer2Scroll % rockW); x < width + rockW; x += rockW) {
        const h = 150 + Math.abs(Math.sin((x + layer2Scroll) * 0.02)) * 80;
        // Stalagmites from bottom
        ctx.beginPath();
        ctx.moveTo(x + 20, height);
        ctx.lineTo(x + rockW/2, height - h);
        ctx.lineTo(x + rockW - 20, height);
        ctx.fill();
    }
}

export function drawBeamDownSequence(ctx: CanvasRenderingContext2D, width: number, height: number, transitionY: number) {
    // transitionY goes from high positive number down to 0
    // We want a beam effect coming from top center
    
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);
    
    const centerX = width / 2;
    
    // Beam
    const beamWidth = 100 + Math.sin(Date.now() / 100) * 20;
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, 'rgba(56, 189, 248, 0.8)');
    grad.addColorStop(1, 'rgba(56, 189, 248, 0)');
    
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(centerX - beamWidth/2, 0);
    ctx.lineTo(centerX + beamWidth/2, 0);
    ctx.lineTo(centerX + beamWidth, height);
    ctx.lineTo(centerX - beamWidth, height);
    ctx.fill();
    
    // Particles (upward motion for abduction feel or downward for landing)
    ctx.fillStyle = '#ffffff';
    for(let i=0; i<20; i++) {
        const x = centerX + (Math.random() - 0.5) * beamWidth * 2;
        const y = Math.random() * height;
        // Simulating speed lines
        const speed = 10 + Math.random() * 20;
        const lineH = 20 + Math.random() * 30;
        // Moving up
        const finalY = (y - (Date.now() / 10 * speed)) % height;
        if(finalY < 0) continue; // simplistic wrap logic

        ctx.globalAlpha = Math.random() * 0.5 + 0.2;
        ctx.fillRect(x, (finalY + height) % height, 2, lineH);
    }
    ctx.globalAlpha = 1.0;
}

export function drawStickman(
    ctx: CanvasRenderingContext2D, 
    type: CharacterType, 
    x: number, 
    y: number, 
    frame: number, 
    state: 'RUNNING' | 'COASTING' | 'JUMPING' | 'GRINDING' | 'CRASHED' | 'TUMBLING' | 'NATAS_SPIN' | 'ARRESTED' | 'ABDUCTED',
    trickRotation: number = 0, 
    trickType: string = '',
    isFakie: boolean = false
) {
    ctx.save();
    ctx.translate(x, y);
    
    const safeFrame = frame || 0;

    // --- ABDUCTION EFFECT ---
    if (state === 'ABDUCTED') {
        // Floating effect
        const float = Math.sin(safeFrame * 0.1) * 3;
        ctx.translate(0, float);
        
        // Gentle pulse scale
        const pulse = 1 + Math.sin(safeFrame * 0.15) * 0.05;
        ctx.scale(pulse, pulse);
        
        // Very Slow controlled rotation instead of tumble
        ctx.rotate(safeFrame * 0.05); 
    }

    // --- KAI CHARACTER (IMAGE SPRITES) ---
    if (type === 'male_cap') {
        // --- FAKIE LOGIC ---
        if (isFakie) {
            ctx.scale(-1, 1);
        }

        // --- TRANSFORMATIONS ---
        if (state === 'NATAS_SPIN') {
             const widthScale = Math.cos(trickRotation);
             ctx.scale(widthScale, 1);
        } else if (trickType === '180' || trickType === '360') {
             // HORIZONTAL SPIN: Scale X based on rotation angle
             const widthScale = Math.cos(trickRotation);
             ctx.scale(widthScale, 1);
        } else if (state === 'TUMBLING' || state === 'JUMPING' || state === 'GRINDING' || trickType !== '') {
             // STANDARD VERTICAL ROTATION (Backflip style)
             ctx.rotate(trickRotation);
        }
        
        let imageToDraw: HTMLImageElement | null = null;

        if (state === 'RUNNING') {
            const pushFrameIndex = Math.floor(safeFrame / 15) % 2; 
            imageToDraw = KAI_SPRITES.PUSH[pushFrameIndex];
        } else {
            const rideFrameIndex = Math.floor(safeFrame / 10) % 4;
            imageToDraw = KAI_SPRITES.RIDE[rideFrameIndex];
        }

        const drawW = 50; 
        const drawH = 75; 
        
        if (imageToDraw && imageToDraw.complete) {
             // CHANGED: Y offset from -drawH + 10 to -drawH + 25 to move it down 15px to the floor
             ctx.drawImage(imageToDraw, -drawW/2, -drawH + 25, drawW, drawH);
        } else {
            ctx.fillStyle = '#c52323';
            ctx.font = '10px Arial';
            ctx.fillText("Loading...", -20, -20);
        }

        ctx.restore();
        return; 
    }

    // --- ORIGINAL STICKMAN DRAWING (For other characters) ---
    if (isFakie) {
        ctx.scale(-1, 1);
    }

    if (state === 'TUMBLING' || state === 'RUNNING' || state === 'COASTING' || state === 'GRINDING') {
        ctx.rotate(trickRotation);
    }

    if (state === 'NATAS_SPIN') {
        const widthScale = Math.cos(trickRotation);
        ctx.scale(widthScale, 1);
    }

    if (trickType === '180' || trickType === '360') {
        const scaleX = Math.cos(trickRotation);
        ctx.scale(scaleX, 1);
    }

    const isAlien = type === 'alien';
    const skinColor = isAlien ? '#39ff14' : '#ffffff';
    const strokeColor = isAlien ? '#39ff14' : '#ffffff';
    
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.fillStyle = skinColor;

    const armAngle = state === 'RUNNING' ? Math.sin(safeFrame * 0.25) * 0.5 : -0.5;
    const crouch = state === 'JUMPING' ? -5 : 0;

    // --- SKATEBOARD ---
    if (state !== 'CRASHED' && state !== 'ABDUCTED') {
        ctx.save();
        ctx.translate(0, 25 + crouch);
        
        if (trickType === 'KICKFLIP') {
             ctx.rotate(trickRotation);
        }

        ctx.fillStyle = '#333'; 
        ctx.beginPath();
        ctx.moveTo(-24, -4);
        ctx.quadraticCurveTo(-18, 0, -12, 0);
        ctx.lineTo(12, 0);
        ctx.quadraticCurveTo(18, 0, 24, -4);
        ctx.lineTo(24, -1);
        ctx.quadraticCurveTo(18, 5, 12, 5);
        ctx.lineTo(-12, 5);
        ctx.quadraticCurveTo(-18, 5, -24, -1);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = '#111'; 
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-23, -4);
        ctx.quadraticCurveTo(-18, 0, -12, 0);
        ctx.lineTo(12, 0);
        ctx.quadraticCurveTo(18, 0, 23, -4);
        ctx.stroke();

        ctx.fillStyle = '#fff';
        if (type === 'alien') ctx.fillStyle = '#cc00ff';
        
        ctx.beginPath(); ctx.arc(-13, 5, 3.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(13, 5, 3.5, 0, Math.PI * 2); ctx.fill();
        
        ctx.fillStyle = '#999';
        ctx.beginPath(); ctx.arc(-13, 5, 1.5, 0, Math.PI * 2);
        ctx.arc(13, 5, 1.5, 0, Math.PI * 2); ctx.fill();

        ctx.restore();
    }

    // --- BODY ---
    ctx.fillStyle = skinColor;
    ctx.strokeStyle = strokeColor; 
    ctx.lineWidth = 3;

    ctx.beginPath();
    if (state === 'RUNNING') {
        const cycle = safeFrame * 0.25; 
        const xOffset = Math.sin(cycle) * 15; 
        const isRecovery = Math.cos(cycle) > 0;
        const lift = isRecovery ? Math.abs(Math.cos(cycle)) * 8 : 0;
        const backFootX = xOffset - 5; 
        const backFootY = 25 - lift; 

        ctx.moveTo(0, 10); 
        ctx.lineTo(backFootX, backFootY); 
        
        ctx.moveTo(0, 10);
        ctx.lineTo(10, 25); 
    } else if (state === 'COASTING' || state === 'NATAS_SPIN' || state === 'ARRESTED' || state === 'ABDUCTED') {
        ctx.moveTo(0, 10);
        ctx.lineTo(-12, 25); 
        ctx.moveTo(0, 10);
        ctx.lineTo(10, 25); 
    } else if (state === 'JUMPING' || state === 'GRINDING' || state === 'TUMBLING' || state === 'CRASHED') {
        const footY = 25 + crouch;
        const kneeY = 20 + crouch;

        ctx.moveTo(0, 10);
        ctx.lineTo(-5, kneeY); ctx.lineTo(-10, footY);
        ctx.moveTo(0, 10);
        ctx.lineTo(5, kneeY); ctx.lineTo(10, footY);
    }
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, 10); 
    ctx.lineTo(0, -15); 
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, -10);
    if (state === 'NATAS_SPIN') {
         ctx.lineTo(-15, -12);
         ctx.moveTo(0, -10);
         ctx.lineTo(15, -12);
    } else if (state === 'ARRESTED' || state === 'ABDUCTED') {
        // Arms up
        ctx.lineTo(-10, -25);
        ctx.moveTo(0, -10);
        ctx.lineTo(10, -25);
    } else {
        ctx.lineTo(-10, -10 + armAngle * 10);
        ctx.moveTo(0, -10);
        ctx.lineTo(10, -10 - armAngle * 10);
    }
    ctx.stroke();

    ctx.beginPath();
    if (isAlien) {
        ctx.ellipse(0, -22, 6, 8, 0, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = 'black';
        ctx.beginPath();
        ctx.ellipse(-2, -22, 2, 3, 0.2, 0, Math.PI*2);
        ctx.ellipse(2, -22, 2, 3, -0.2, 0, Math.PI*2);
        ctx.fill();
    } else {
        ctx.arc(0, -22, 6, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.fillStyle = strokeColor;
    
    if (type === 'female_long') {
        ctx.strokeStyle = '#ffcc00'; 
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -28);
        ctx.quadraticCurveTo(-10, -20, -8, -10); 
        ctx.stroke();
    }
    
    if (type === 'female_short') {
        ctx.fillStyle = '#8B4513'; 
        ctx.beginPath();
        ctx.arc(0, -22, 7, Math.PI, 0); 
        ctx.lineTo(7, -18);
        ctx.lineTo(-7, -18);
        ctx.fill();
    }

    ctx.restore();
}

export function drawLaser(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, angle?: number) {
    ctx.save();
    ctx.translate(x, y);
    if (angle !== undefined) ctx.rotate(angle);
    
    // Draw rotating or multiple beams?
    // Let's just draw a single powerful beam for now, but maybe in a loop if called multiple times
    
    // Core
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#4ade80';
    ctx.shadowBlur = 15;
    ctx.fillRect(0, -2, w, 4); // Centered vertically
    
    // Glow
    ctx.strokeStyle = '#4ade80'; // Green glow
    ctx.lineWidth = 6; 
    ctx.lineCap = 'round';
    
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(w, 0);
    ctx.stroke();
    
    ctx.restore();
}

export function drawCollectible(ctx: CanvasRenderingContext2D, type: 'COIN' | 'DIAMOND', x: number, y: number, frame: number) {
    ctx.save();
    ctx.translate(x, y);
    
    // Bobbing animation
    const bob = Math.sin(frame * 0.1) * 5;
    ctx.translate(0, bob);
    
    // Rotation/Spin effect
    const scaleX = Math.cos(frame * 0.15);
    
    if (type === 'COIN') {
        ctx.fillStyle = '#fbbf24'; // Gold
        ctx.beginPath();
        ctx.ellipse(0, 0, 15 * Math.abs(scaleX), 15, 0, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(0, 0, 15 * Math.abs(scaleX), 15, 0, 0, Math.PI * 2);
        ctx.stroke();
        
        // Inner detail
        ctx.fillStyle = '#fcd34d';
        ctx.beginPath();
        ctx.ellipse(0, 0, 10 * Math.abs(scaleX), 10, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Shine
        if (scaleX > 0.2) { // Avoid flicker when scaling flips
            ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.beginPath();
            ctx.ellipse(-5 * scaleX, -5, 3 * scaleX, 3, 0, 0, Math.PI*2);
            ctx.fill();
        }
    } else {
        // DIAMOND
        ctx.fillStyle = '#22d3ee'; // Cyan
        ctx.beginPath();
        // Diamond shape
        ctx.moveTo(0, -15);
        ctx.lineTo(12 * Math.abs(scaleX), 0);
        ctx.lineTo(0, 15);
        ctx.lineTo(-12 * Math.abs(scaleX), 0);
        ctx.closePath();
        ctx.fill();
        
        // Facets
        ctx.strokeStyle = '#cffafe';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, -15); ctx.lineTo(0, 15);
        ctx.moveTo(-12 * Math.abs(scaleX), 0); ctx.lineTo(12 * Math.abs(scaleX), 0);
        ctx.stroke();
    }
    
    ctx.restore();
}

export type ObstacleType = 
    | 'hydrant' | 'cone' | 'police_car' | 'cybertruck' | 'cart' 
    | 'ledge' | 'curb' | 'bin' | 'grey_bin' | 'ramp' | 'gap' 
    | 'ramp_up' | 'platform' | 'stairs_down' | 'rail' | 'flat_rail' | 'mega_ramp'
    | 'concrete_structure' | 'space_platform' | 'alien_ship' | 'solar_panel' | 'station_girder' | 'big_ufo' | 'fireball';

export function drawObstacle(ctx: CanvasRenderingContext2D, type: ObstacleType, x: number, y: number, w: number, h: number, sprayingWater?: boolean, doorOpen?: boolean) {
    ctx.save();
    ctx.translate(x, y);

    switch (type) {
        case 'fireball':
            // Draw fire
            const fGrad = ctx.createRadialGradient(w/2, h/2, 2, w/2, h/2, w/2);
            fGrad.addColorStop(0, '#fef08a'); // Yellow center
            fGrad.addColorStop(0.4, '#f97316'); // Orange
            fGrad.addColorStop(1, '#dc2626'); // Red edge
            ctx.fillStyle = fGrad;
            ctx.beginPath();
            ctx.arc(w/2, h/2, w/2, 0, Math.PI*2);
            ctx.fill();
            break;

        case 'big_ufo':
            // Massive Mothership
            // Hull
            ctx.fillStyle = '#334155'; // Dark slate metallic
            ctx.beginPath();
            // Draw a large dome shape
            ctx.ellipse(w/2, h/2, w/2, h/2, 0, 0, Math.PI*2);
            ctx.fill();
            
            // Metallic sheen
            ctx.strokeStyle = '#94a3b8';
            ctx.lineWidth = 4;
            ctx.stroke();
            
            // Inner Rim (Darker)
            ctx.fillStyle = '#0f172a';
            ctx.beginPath();
            ctx.ellipse(w/2, h/2 + 10, w/2.2, h/2.5, 0, 0, Math.PI*2);
            ctx.fill();

            // Lights Ring (Cycling colors)
            const lightsCount = 8;
            for(let i=0; i<lightsCount; i++) {
                const angle = (i / lightsCount) * Math.PI * 2;
                const lx = w/2 + Math.cos(angle) * (w/2.1);
                const ly = h/2 + Math.sin(angle) * (h/2.2);
                // Blinking effect
                ctx.fillStyle = (Math.floor(Date.now()/150) + i) % 2 === 0 ? '#facc15' : '#ef4444'; 
                ctx.beginPath();
                ctx.arc(lx, ly, 8, 0, Math.PI*2);
                ctx.fill();
            }

            // Trapdoor (Open) - Very visible bottom entrance
            ctx.fillStyle = '#000000';
            ctx.beginPath();
            ctx.moveTo(w/2 - 50, h/2 + 40);
            ctx.lineTo(w/2 + 50, h/2 + 40);
            ctx.lineTo(w/2 + 30, h + 30); // Open flap down
            ctx.lineTo(w/2 - 30, h + 30);
            ctx.fill();
            
            // Light Cone (Emitting from door)
            const gradCone = ctx.createLinearGradient(0, h/2, 0, h + 400);
            gradCone.addColorStop(0, 'rgba(56, 189, 248, 0.9)'); // Bright cyan at source
            gradCone.addColorStop(1, 'rgba(56, 189, 248, 0)'); // Fade out
            ctx.fillStyle = gradCone;
            ctx.beginPath();
            ctx.moveTo(w/2 - 30, h/2 + 40); // Door top width
            ctx.lineTo(w/2 + 30, h/2 + 40);
            ctx.lineTo(w/2 + 100, h + 400); // Wide cone at bottom
            ctx.lineTo(w/2 - 100, h + 400);
            ctx.fill();
            
            break;

        case 'solar_panel':
            // Frame
            ctx.fillStyle = '#334155';
            ctx.fillRect(0, 0, w, h);
            // Solar Grid (Blue cells)
            ctx.fillStyle = '#1d4ed8'; // Blue
            const cols = Math.floor(w / 25);
            const rows = 2; 
            const cellW = (w - 10) / cols;
            const cellH = (h - 6) / rows;
            
            for(let r=0; r<rows; r++) {
                for(let c=0; c<cols; c++) {
                    ctx.fillRect(5 + c * cellW, 3 + r * cellH, cellW - 2, cellH - 2);
                }
            }
            // Gloss/Reflection
            ctx.fillStyle = 'rgba(255,255,255,0.1)';
            ctx.beginPath();
            ctx.moveTo(0,0); ctx.lineTo(w,0); ctx.lineTo(w-20, h); ctx.lineTo(0, h);
            ctx.fill();
            break;

        case 'station_girder':
            // Truss Structure
            ctx.strokeStyle = '#94a3b8';
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            
            // Top and Bottom rails
            ctx.beginPath();
            ctx.moveTo(0, 2); ctx.lineTo(w, 2);
            ctx.moveTo(0, h-2); ctx.lineTo(w, h-2);
            ctx.stroke();
            
            // Cross bracing
            ctx.lineWidth = 2;
            ctx.beginPath();
            const zigW = 30;
            for(let i=0; i<w; i+=zigW) {
                ctx.moveTo(i, 2);
                ctx.lineTo(i+zigW/2, h-2);
                ctx.lineTo(i+zigW, 2);
            }
            ctx.stroke();
            break;

        case 'space_platform':
            const trussHeight = 30;
            // Top surface (metallic light grey)
            const gradTop = ctx.createLinearGradient(0, 0, 0, h);
            gradTop.addColorStop(0, '#cbd5e1');
            gradTop.addColorStop(1, '#94a3b8');
            ctx.fillStyle = gradTop;
            ctx.fillRect(0, 0, w, h);
            
            // Bottom structure (truss/girder)
            ctx.strokeStyle = '#475569'; // Darker slate
            ctx.lineWidth = 2;
            
            // Bottom chord
            ctx.beginPath();
            ctx.moveTo(0, h + trussHeight);
            ctx.lineTo(w, h + trussHeight);
            ctx.stroke();
            
            // Zig-zag bracing
            const zigW2 = 20;
            ctx.beginPath();
            for (let i = 0; i < w; i += zigW2) {
                ctx.moveTo(i, h);
                ctx.lineTo(i + zigW2/2, h + trussHeight);
                ctx.lineTo(i + zigW2, h);
            }
            ctx.stroke();
            
            // Rivets/Bolts
            ctx.fillStyle = '#1e293b';
            for (let i = 0; i < w; i += 40) {
                ctx.beginPath();
                ctx.arc(i + 5, h/2, 1.5, 0, Math.PI*2);
                ctx.fill();
            }
            break;

        case 'alien_ship':
             // Classic Saucer
             ctx.scale(1, 1);
             
             // Engine Glow
             ctx.shadowColor = '#a3e635';
             ctx.shadowBlur = 10;
             
             // Dome
             ctx.fillStyle = '#38bdf8'; // Cyan glass
             ctx.globalAlpha = 0.8;
             ctx.beginPath();
             ctx.arc(w/2, h/2 - 5, 15, Math.PI, 0);
             ctx.fill();
             ctx.globalAlpha = 1.0;
             
             // Main Disk
             ctx.fillStyle = '#94a3b8'; // Silver
             ctx.beginPath();
             ctx.ellipse(w/2, h/2 + 5, 30, 8, 0, 0, Math.PI*2);
             ctx.fill();
             
             // Lights
             ctx.shadowBlur = 5;
             ctx.fillStyle = '#a3e635'; // Lime lights
             ctx.beginPath(); ctx.arc(w/2 - 20, h/2 + 5, 3, 0, Math.PI*2); ctx.fill();
             ctx.beginPath(); ctx.arc(w/2, h/2 + 8, 3, 0, Math.PI*2); ctx.fill();
             ctx.beginPath(); ctx.arc(w/2 + 20, h/2 + 5, 3, 0, Math.PI*2); ctx.fill();
             ctx.shadowBlur = 0;
             break;

        case 'police_car':
             ctx.save();
             ctx.translate(w, 0);
             ctx.scale(-1, 1);
             
             const wheelRadius = 9;
             const wheelY = h; 

             ctx.fillStyle = '#111827'; 
             ctx.beginPath();
             ctx.moveTo(0, h * 0.4);
             ctx.lineTo(w, h * 0.45); 
             ctx.lineTo(w, h - 5);
             ctx.lineTo(0, h - 5);
             ctx.closePath();
             ctx.fill();

             ctx.fillStyle = '#ffffff';
             ctx.fillRect(w * 0.25, h * 0.4, w * 0.45, h * 0.45);
             
             ctx.strokeStyle = '#d1d5db';
             ctx.lineWidth = 1;
             ctx.beginPath();
             ctx.moveTo(w * 0.48, h * 0.4);
             ctx.lineTo(w * 0.48, h * 0.85);
             ctx.stroke();

             ctx.fillStyle = '#ffffff';
             ctx.beginPath();
             ctx.moveTo(w * 0.25, h * 0.4);
             ctx.lineTo(w * 0.3, h * 0.1); 
             ctx.lineTo(w * 0.65, h * 0.1); 
             ctx.lineTo(w * 0.75, h * 0.4); 
             ctx.closePath();
             ctx.fill();

             ctx.fillStyle = '#38bdf8'; 
             ctx.globalAlpha = 0.7;
             ctx.beginPath();
             ctx.moveTo(w * 0.32, h * 0.15);
             ctx.lineTo(w * 0.47, h * 0.15);
             ctx.lineTo(w * 0.47, h * 0.4);
             ctx.lineTo(w * 0.28, h * 0.4);
             ctx.closePath();
             ctx.fill();
             ctx.beginPath();
             ctx.moveTo(w * 0.51, h * 0.15);
             ctx.lineTo(w * 0.62, h * 0.15);
             ctx.lineTo(w * 0.68, h * 0.4);
             ctx.lineTo(w * 0.51, h * 0.4);
             ctx.closePath();
             ctx.fill();
             ctx.globalAlpha = 1.0;

             ctx.save();
             ctx.translate(w * 0.48, h * 0.65);
             ctx.scale(-1, 1);
             ctx.fillStyle = '#000';
             ctx.font = 'bold 9px sans-serif';
             ctx.textAlign = 'center';
             ctx.fillText('POLICE', 0, 0);
             ctx.restore();

             const lightBarW = 18;
             const lightBarH = 5;
             const lightBarX = w * 0.48 - lightBarW / 2;
             const lightBarY = h * 0.1 - lightBarH;
             
             ctx.fillStyle = '#374151';
             ctx.fillRect(lightBarX, lightBarY + 2, lightBarW, 3);
             
             const flashTick = Math.floor(Date.now() / 150) % 2 === 0;
             
             ctx.fillStyle = flashTick ? '#ef4444' : '#7f1d1d';
             ctx.fillRect(lightBarX, lightBarY, lightBarW/2 - 1, 4);
             
             ctx.fillStyle = flashTick ? '#1e3a8a' : '#3b82f6';
             ctx.fillRect(lightBarX + lightBarW/2 + 1, lightBarY, lightBarW/2 - 1, 4);
             
             if (flashTick) {
                 ctx.shadowColor = '#ef4444';
                 ctx.shadowBlur = 10;
                 ctx.fillStyle = 'rgba(239, 68, 68, 0.3)';
                 ctx.beginPath(); ctx.arc(lightBarX, lightBarY, 15, 0, Math.PI*2); ctx.fill();
                 ctx.shadowBlur = 0;
             } else {
                 ctx.shadowColor = '#3b82f6';
                 ctx.shadowBlur = 10;
                 ctx.fillStyle = 'rgba(59, 130, 246, 0.3)';
                 ctx.beginPath(); ctx.arc(lightBarX + lightBarW, lightBarY, 15, 0, Math.PI*2); ctx.fill();
                 ctx.shadowBlur = 0;
             }

             ctx.fillStyle = '#fef08a'; 
             ctx.beginPath();
             ctx.ellipse(w - 2, h * 0.5, 2, 5, 0, 0, Math.PI*2);
             ctx.fill();

             const drawTire = (xPos: number) => {
                  ctx.fillStyle = '#111';
                  ctx.beginPath();
                  ctx.arc(xPos, wheelY - 2, wheelRadius, 0, Math.PI*2);
                  ctx.fill();
                  ctx.fillStyle = '#9ca3af';
                  ctx.beginPath();
                  ctx.arc(xPos, wheelY - 2, wheelRadius * 0.6, 0, Math.PI*2);
                  ctx.fill();
                  ctx.fillStyle = '#4b5563';
                  ctx.beginPath();
                  ctx.arc(xPos, wheelY - 2, wheelRadius * 0.2, 0, Math.PI*2);
                  ctx.fill();
             };

             drawTire(w * 0.2);
             drawTire(w * 0.8);
             
             if (doorOpen) {
                 ctx.fillStyle = '#000';
                 ctx.fillRect(w * 0.55, h * 0.42, w * 0.15, h * 0.4);
             }
             
             ctx.restore(); 
             break;

        case 'cybertruck':
             const peakX = w * 0.4;
             ctx.fillStyle = '#c0c0c0'; 
             ctx.beginPath();
             ctx.moveTo(w, h - 15);
             ctx.lineTo(peakX, 0);
             ctx.lineTo(5, h - 20); 
             ctx.lineTo(5, h - 10);
             ctx.lineTo(w, h - 10);
             ctx.closePath();
             ctx.fill();
             
             ctx.strokeStyle = '#999';
             ctx.lineWidth = 1;
             ctx.stroke();

             ctx.fillStyle = '#000';
             ctx.beginPath();
             ctx.moveTo(peakX, 5);
             ctx.lineTo(w - 10, h - 20);
             ctx.lineTo(20, h - 24);
             ctx.closePath();
             ctx.fill();

             ctx.fillStyle = '#fff';
             ctx.shadowColor = '#fff';
             ctx.shadowBlur = 10;
             ctx.fillRect(0, h - 25, 10, 2);
             ctx.shadowBlur = 0;

             ctx.fillStyle = '#f00';
             ctx.shadowColor = '#f00';
             ctx.shadowBlur = 5;
             ctx.fillRect(w - 5, h - 20, 5, 2);
             ctx.shadowBlur = 0;

             ctx.fillStyle = '#111';
             ctx.beginPath(); ctx.arc(25, h - 5, 16, 0, Math.PI*2); ctx.fill();
             ctx.fillStyle = '#333';
             ctx.beginPath(); ctx.arc(25, h - 5, 8, 0, Math.PI*2); ctx.fill();

             ctx.fillStyle = '#111';
             ctx.beginPath(); ctx.arc(w - 30, h - 5, 16, 0, Math.PI*2); ctx.fill();
             ctx.fillStyle = '#333';
             ctx.beginPath(); ctx.arc(w - 30, h - 5, 8, 0, Math.PI*2); ctx.fill();
             break;

        case 'hydrant':
            ctx.fillStyle = '#cc0000';
            ctx.fillRect(w/4, h/3, w/2, h*0.66); 
            ctx.fillRect(0, h/2, w, h/5); 
            ctx.fillStyle = '#990000';
            ctx.beginPath(); ctx.arc(w/2, h/3, w/3, Math.PI, 0); ctx.fill();
            
            if (sprayingWater) {
                 ctx.save();
                 ctx.translate(w/2, 0); 
                 ctx.rotate(-Math.PI / 4); 
                 ctx.strokeStyle = '#38bdf8'; 
                 ctx.lineWidth = 3;
                 ctx.globalAlpha = 0.8;
                 for(let i=0; i<5; i++) {
                    const len = 30 + Math.random() * 40;
                    const offset = Math.random() * 10 - 5;
                    ctx.beginPath();
                    ctx.moveTo(0, 0);
                    ctx.quadraticCurveTo(len/2, offset*2, len, offset * 5);
                    ctx.stroke();
                 }
                 ctx.restore();
            }
            break;

        case 'cart': 
            ctx.save();
            ctx.fillStyle = '#ef4444';
            ctx.fillRect(5, 5, 5, 10);
            ctx.strokeStyle = '#cbd5e1'; 
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(10, 15); ctx.lineTo(15, h-10); ctx.lineTo(w-10, h-10); ctx.lineTo(w, 15); ctx.closePath();
            ctx.moveTo(20, 15); ctx.lineTo(23, h-10);
            ctx.moveTo(30, 15); ctx.lineTo(31, h-10);
            ctx.moveTo(40, 15); ctx.lineTo(39, h-10);
            ctx.moveTo(12, 25); ctx.lineTo(w-5, 25);
            ctx.moveTo(14, 35); ctx.lineTo(w-8, 35);
            ctx.stroke();
            
            ctx.strokeStyle = '#64748b';
            ctx.beginPath();
            ctx.moveTo(15, h-10); ctx.lineTo(15, h-5); ctx.lineTo(w-10, h-5);
            ctx.stroke();

            ctx.fillStyle = '#333';
            ctx.beginPath(); ctx.arc(15, h, 4, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(w-10, h, 4, 0, Math.PI*2); ctx.fill();
            ctx.restore();
            break;

        case 'ledge':
            ctx.fillStyle = '#555';
            ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = '#777';
            ctx.fillRect(0, 0, w, 4);
            ctx.fillStyle = '#444';
            ctx.fillRect(0, 4, w, 2);
            break;
            
        case 'curb':
            ctx.fillStyle = '#9ca3af'; 
            ctx.fillRect(0, 10, w, h-10);
            ctx.fillStyle = '#ef4444'; 
            ctx.fillRect(0, 10, w, 5);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(10, 10, 10, 5);
            ctx.fillRect(30, 10, 10, 5);
            break;
        
        case 'rail':
            ctx.strokeStyle = '#ccc';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(10, h);
            ctx.lineTo(10, 5);
            ctx.moveTo(w-10, h);
            ctx.lineTo(w-10, 5);
            ctx.stroke();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(5, 5);
            ctx.lineTo(w-5, 5);
            ctx.stroke();
            break;

        case 'flat_rail':
            ctx.strokeStyle = '#999';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(5, h);
            ctx.lineTo(5, h-10);
            ctx.moveTo(w-5, h);
            ctx.lineTo(w-5, h-10);
            ctx.stroke();
            ctx.strokeStyle = '#ddd';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(0, h-10);
            ctx.lineTo(w, h-10);
            ctx.stroke();
            break;

        case 'bin': 
            ctx.fillStyle = '#2e7d32'; 
            ctx.fillRect(5, 0, w-10, h);
            ctx.fillStyle = '#1b5e20';
            ctx.fillRect(5, 10, w-10, 2);
            ctx.fillRect(5, 25, w-10, 2);
            ctx.fillRect(5, 40, w-10, 2);
            break;

        case 'grey_bin': 
            ctx.fillStyle = '#64748b'; 
            ctx.fillRect(5, 0, w-10, h);
            ctx.fillStyle = '#475569';
            ctx.fillRect(5, 10, w-10, 2);
            ctx.fillRect(5, 25, w-10, 2);
            ctx.fillRect(5, 40, w-10, 2);
            break;
            
        case 'ramp':
            ctx.fillStyle = '#d2b48c'; 
            ctx.beginPath();
            ctx.moveTo(0, h);
            ctx.lineTo(w, h);
            ctx.lineTo(w, 0);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#666';
            ctx.beginPath(); ctx.arc(w, 0, 3, 0, Math.PI*2); ctx.fill();
            break;
            
        case 'gap':
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(0, 100);
            ctx.moveTo(w, 0);
            ctx.lineTo(w, 100);
            ctx.stroke();
            
            const holeGrad = ctx.createLinearGradient(0, 0, 0, 100);
            holeGrad.addColorStop(0, 'rgba(0,0,0,0.5)');
            holeGrad.addColorStop(1, 'rgba(0,0,0,0.9)');
            ctx.fillStyle = holeGrad;
            ctx.fillRect(0, 0, w, 100);
            break;

        case 'concrete_structure':
             const rampW = 100; 
             ctx.fillStyle = '#444'; 
             
             ctx.beginPath();
             ctx.moveTo(0, h);      
             ctx.lineTo(rampW, 0);  
             ctx.lineTo(w, 0);      
             ctx.lineTo(w, h);      
             ctx.closePath();
             ctx.fill();
             
             ctx.strokeStyle = '#555';
             ctx.lineWidth = 2;
             ctx.beginPath();
             ctx.moveTo(0, h);
             ctx.lineTo(rampW, 0);
             ctx.lineTo(w, 0);
             ctx.stroke();
             break;

        case 'platform':
             ctx.fillStyle = '#444';
             ctx.fillRect(0, 0, w, h);
             ctx.fillStyle = '#333';
             ctx.fillRect(0, 0, w, 2);
             break;

        case 'stairs_down':
             ctx.fillStyle = '#444';
             const steps = 4;
             const stepW = w / steps;
             const stepH = h / steps;
             ctx.beginPath();
             ctx.moveTo(0, 0);
             for(let i=1; i<=steps; i++) {
                ctx.lineTo(i*stepW, (i-1)*stepH); 
                ctx.lineTo(i*stepW, i*stepH);     
             }
             ctx.lineTo(0, h); 
             ctx.closePath();
             ctx.fill();
             
             ctx.strokeStyle = '#c52323';
             ctx.lineWidth = 3;
             ctx.beginPath();
             ctx.moveTo(0, -15); 
             ctx.lineTo(w, h-15); 
             ctx.stroke();

             ctx.lineWidth = 2;
             ctx.beginPath();
             ctx.moveTo(10, -12); ctx.lineTo(10, 0);
             ctx.moveTo(w/2, h/2 - 15); ctx.lineTo(w/2, h/2);
             ctx.moveTo(w-10, h-18); ctx.lineTo(w-10, h);
             ctx.stroke();
             break;

        case 'mega_ramp':
             const safeW = Math.max(w, 1);
             const safeH = Math.max(h, 1);
             
             const xc = (safeW*safeW - safeH*safeH) / (2*safeW);
             const R = safeW - xc;
             
             const startAngle = Math.atan2(h, -xc);
             const endAngle = 0; 

             ctx.save();
             ctx.beginPath();
             ctx.moveTo(0, h); 
             ctx.arc(xc, 0, R, startAngle, endAngle, true); 
             ctx.lineTo(w, h); 
             ctx.lineTo(0, h); 
             ctx.closePath();
             ctx.clip(); 

             ctx.strokeStyle = '#374151'; 
             ctx.lineWidth = 2;
             const gridSize = 40;
             
             for (let lx = 0; lx < w; lx += gridSize) {
                 ctx.beginPath(); ctx.moveTo(lx, 0); ctx.lineTo(lx, h + 200); ctx.stroke();
             }
             for (let ly = 0; ly < h; ly += gridSize) {
                 ctx.beginPath(); ctx.moveTo(0, ly); ctx.lineTo(w, ly); ctx.stroke();
             }
             ctx.globalAlpha = 0.5;
             for (let lx = 0; lx < w; lx += gridSize) {
                 ctx.beginPath(); ctx.moveTo(lx, 0); ctx.lineTo(lx + gridSize, h); ctx.stroke();
             }
             
             ctx.restore();

             ctx.beginPath();
             ctx.arc(xc, 0, R, startAngle, endAngle, true);
             ctx.lineTo(w + 100, 0);
             ctx.lineTo(w + 100, 15);
             ctx.lineTo(w, 15); 
             ctx.arc(xc, 0, R - 15, endAngle, startAngle, false);
             ctx.closePath();
             
             ctx.fillStyle = '#9ca3af'; 
             ctx.fill();
             ctx.strokeStyle = '#d1d5db'; 
             ctx.lineWidth = 2;
             ctx.stroke();

             ctx.beginPath();
             ctx.arc(w, 0, 6, 0, Math.PI * 2);
             ctx.fillStyle = '#f3f4f6'; 
             ctx.fill();
             ctx.strokeStyle = '#1f2937';
             ctx.lineWidth = 1;
             ctx.stroke();
             
             ctx.beginPath(); ctx.arc(w - 2, -2, 2, 0, Math.PI*2); ctx.fillStyle='white'; ctx.fill();
             
             ctx.fillStyle = '#4b5563';
             ctx.fillRect(w, 10, 100, h); 
             
             break;
            
        default:
            ctx.fillStyle = '#c52323';
            ctx.fillRect(0, 0, w, h);
    }

    ctx.restore();
}