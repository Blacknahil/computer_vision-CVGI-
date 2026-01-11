import { useEffect, useRef, useState } from 'react';
import type { HandData } from '../hooks/useHandControl';

interface GameCanvasProps {
    handData: HandData;
    onToggleFilter: (isEnabled: boolean) => void;
}

interface Entity {
    x: number;
    y: number;
    width: number;
    height: number;
    speed: number;
    color: string;
    active: boolean;
}

export function GameCanvas({ handData, onToggleFilter }: GameCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [hudScore, setHudScore] = useState(0);
    const [hudGameOver, setHudGameOver] = useState(false);
    const [hasStarted, setHasStarted] = useState(false);
    const [isFilterOn, setIsFilterOn] = useState(true);

    // Game State Refs (to avoid re-renders on every frame)
    const gameState = useRef({
        playerX: 0.5, // 0-1
        bullets: [] as Entity[],
        enemies: [] as Entity[],
        stars: [] as Entity[],
        lastShotTime: 0,
        score: 0,
        lastScoreSync: 0, // Track last synced score to avoid spamming setState
        gameOver: false,
        baseSpeed: 2, // Base vertical speed
    });

    // Load Sprites
    const sprites = useRef({
        ship: new Image(),
        enemy: new Image()
    });
    const spritesLoaded = useRef(false);

    const handleBtnClick = () => {
        const nextState = !isFilterOn;
        setIsFilterOn(nextState);
        onToggleFilter(nextState); // This calls the hook's toggleFilter
    };

    useEffect(() => {
        sprites.current.ship.src = '/ship.png';
        sprites.current.enemy.src = '/enemy.png';

        const checkLoaded = () => {
            if (sprites.current.ship.complete && sprites.current.enemy.complete) {
                spritesLoaded.current = true;
            }
        };

        sprites.current.ship.onload = checkLoaded;
        sprites.current.enemy.onload = checkLoaded;
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId: number;

        // Initialize stars
        // for (let i = 0; i < 50; i++) {
        //     gameState.current.stars.push({
        //         x: Math.random(),
        //         y: Math.random(),
        //         width: Math.random() * 2 + 1,
        //         height: Math.random() * 2 + 1,
        //         speed: Math.random() * 0.5 + 0.1,
        //         color: 'white',
        //         active: true
        //     });
        // }

        const render = (time: number) => {
            // 1. Resize handling
            if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
                canvas.width = window.innerWidth;
                canvas.height = window.innerHeight;
            }
            const w = canvas.width;
            const h = canvas.height;
            const ctx = canvas.getContext('2d')!;

            // 2. Clear Screen
            ctx.fillStyle = 'black';
            ctx.fillRect(0, 0, w, h);

            // If not started, just return (or draw starfield only?)
            // Let's draw starfield only for effect
            if (!hasStarted) {
                // Initialize stars if empty (handled above)
                ctx.fillStyle = 'white';
                gameState.current.stars.forEach(star => {
                    star.y += star.speed * 0.5; // slow drift
                    if (star.y > 1) {
                        star.y = 0;
                        star.x = Math.random();
                    }
                    ctx.beginPath();
                    ctx.arc(star.x * w, star.y * h, star.width, 0, Math.PI * 2);
                    ctx.fill();
                });
                animationFrameId = requestAnimationFrame(render);
                return;
            }

            const state = gameState.current;

            if (state.gameOver) {
                ctx.fillStyle = 'white';
                ctx.font = '40px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('GAME OVER', w / 2, h / 2);
                ctx.font = '20px Arial';
                ctx.fillText(`Score: ${state.score}`, w / 2, h / 2 + 40);

                // Reset capability
                if (handData.shooting && (time - state.lastShotTime > 1000)) {
                    state.gameOver = false;
                    state.score = 0;
                    state.lastScoreSync = 0;
                    setHudScore(0); // Sync UI
                    setHudGameOver(false); // Sync UI
                    state.enemies = [];
                    state.bullets = [];
                }

                animationFrameId = requestAnimationFrame(render);
                return;
            }

            // 3. Update Player Position from Hand Data
            // Lerp for smoothness
            const targetX = handData.x; // 0-1 (inverted if needed, but usually 0=left in MP?)
            // MP x: 0 (left) -> 1 (right). 
            // But wait, webcam is mirrored? main.py flips it.
            // If mirrored: right hand move right -> shows right on screen.
            // Let's assume input is direct 0-1 mapping.
            state.playerX += (targetX - state.playerX) * 0.1;

            // 4. Update Game Speed (Throttle)
            // hand.y: 0 (top) -> 1 (bottom).
            // Let's make "up" (0) fast, "down" (1) slow?
            // Or "up" (0) = forward acceleration.
            const throttle = Math.max(0, (1 - handData.y)); // 0 to 1
            const gameSpeed = state.baseSpeed + (throttle * 10);

            // 5. Draw Stars (Background)
            ctx.fillStyle = 'white';
            state.stars.forEach(star => {
                star.y += star.speed + (gameSpeed * 0.1);
                if (star.y > 1) {
                    star.y = 0;
                    star.x = Math.random();
                }
                ctx.beginPath();
                ctx.arc(star.x * w, star.y * h, star.width, 0, Math.PI * 2);
                ctx.fill();
            });

            // 6. Draw Player (Sprite)
            const playerW = 60; // Increased size for sprite
            const playerH = 60;
            const px = state.playerX * w;
            const py = h - 100;

            if (sprites.current.ship.complete && sprites.current.ship.naturalWidth > 0) {
                ctx.drawImage(sprites.current.ship, px - playerW / 2, py, playerW, playerH);
            } else {
                // Fallback
                ctx.fillStyle = '#00ffcc';
                ctx.fillRect(px - playerW / 2, py, playerW, playerH);
            }

            // Detection indicator
            if (!handData.detected) {
                ctx.fillStyle = 'red';
                ctx.font = '20px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('NO HAND DETECTED', w / 2, 50);
            } else {
                // Draw crosshair or cursor to show detection point
                ctx.strokeStyle = 'cyan';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(handData.x * w, handData.y * h, 10, 0, Math.PI * 2);
                ctx.stroke();
            }

            // 7. Shooting
            if (handData.shooting && (time - state.lastShotTime > 200)) {
                state.bullets.push({
                    x: state.playerX,
                    y: (h - 100) / h, // adjust for py
                    width: 4,
                    height: 15,
                    speed: 0.02,
                    color: '#ff0055', // Laser color
                    active: true
                });
                state.lastShotTime = time;
            }

            // 8. Update & Draw Bullets
            ctx.fillStyle = '#ff0055';
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#ff0055';
            for (let i = state.bullets.length - 1; i >= 0; i--) {
                const b = state.bullets[i];
                b.y -= b.speed;
                if (b.y < 0) {
                    state.bullets.splice(i, 1);
                    continue;
                }
                ctx.fillRect((b.x * w) - b.width / 2, b.y * h, b.width, b.height);
            }
            ctx.shadowBlur = 0;

            // 9. Spawn Enemies
            if (Math.random() < 0.02 + (throttle * 0.03)) { // Spawn more if going fast
                state.enemies.push({
                    x: Math.random(),
                    y: -0.1, // Start slightly off screen
                    width: 50 + Math.random() * 20,
                    height: 50 + Math.random() * 20,
                    speed: 0.002 + Math.random() * 0.005,
                    color: 'red',
                    active: true
                });
            }

            // 10. Update & Draw Enemies + Collision
            for (let i = state.enemies.length - 1; i >= 0; i--) {
                const e = state.enemies[i];
                e.y += e.speed + (gameSpeed * 0.001); // Enemies move faster if we go faster relative to them? 
                // Actually usually enemies come at you.

                const ex = e.x * w;
                const ey = e.y * h;
                const ew = e.width;
                const eh = e.height;

                // Draw Enemy Sprite
                if (sprites.current.enemy.complete && sprites.current.enemy.naturalWidth > 0) {
                    // Save context to rotate if we want, but top-down is fine
                    ctx.drawImage(sprites.current.enemy, ex - ew / 2, ey - eh / 2, ew, eh);
                } else {
                    ctx.fillStyle = e.color;
                    ctx.fillRect(ex - ew / 2, ey - eh / 2, ew, eh);
                }

                // Cleaning up off-screen
                if (e.y > 1.1) {
                    state.enemies.splice(i, 1);
                    continue;
                }

                // Bullet Collision
                for (let j = state.bullets.length - 1; j >= 0; j--) {
                    const b = state.bullets[j];
                    const bx = b.x * w;
                    const by = b.y * h;

                    if (bx > ex - ew / 2 && bx < ex + ew / 2 &&
                        by > ey - eh / 2 && by < ey + eh / 2) {
                        // Hit
                        state.enemies.splice(i, 1);
                        state.bullets.splice(j, 1);
                        state.score += 100;
                        break; // enemy gone
                    }
                }

                // Player Collision
                if (ex + ew / 2 > px - playerW / 2 && ex - ew / 2 < px + playerW / 2 &&
                    ey + eh / 2 > py && ey - eh / 2 < py + playerH) {
                    state.gameOver = true;
                    setHudGameOver(true);
                }
            }

            // Sync Score to UI State specifically (to avoid re-rendering every frame)
            if (state.score !== state.lastScoreSync) {
                state.lastScoreSync = state.score;
                setHudScore(state.score);
            }

            // HUD is now handled by HTML overlay
            // ctx.fillStyle = 'white';
            // ctx.font = '20px monospace';
            // ...

            animationFrameId = requestAnimationFrame(render);
        };

        animationFrameId = requestAnimationFrame(render);

        return () => cancelAnimationFrame(animationFrameId);
    }, [handData, hasStarted]);

    // Auto-start when hand is detected
    useEffect(() => {
        if (!hasStarted && handData.detected) {
            setHasStarted(true);
        }
    }, [handData.detected, hasStarted]);

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%', backgroundColor: 'black' }}>

            <button 
                onClick={handleBtnClick}
                style={{
                    position: 'absolute',
                    top: '20px',
                    left: '20px',
                    zIndex: 10,
                    padding: '10px',
                    background: isFilterOn ? '#00ffcc' : '#ff4444',
                    color: 'black',
                    fontWeight: 'bold',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer'
                }}
            >
                FILTER: {isFilterOn ? 'ON (Kalman and median filtering)' : 'OFF (Raw)'}
            </button>

            <canvas
                ref={canvasRef}
                width={window.innerWidth}
                height={window.innerHeight}
                style={{ position: 'absolute', top: 0, left: 0, zIndex: 1 }}
            />

            {/* PIP Camera Feed */}
            {handData.image && (
                <div style={{
                    position: 'absolute',
                    bottom: 20,
                    right: 20,
                    width: '320px',
                    height: '240px',
                    border: '2px solid #00ffcc',
                    borderRadius: '10px',
                    overflow: 'hidden',
                    zIndex: 10,
                    boxShadow: '0 0 15px rgba(0, 255, 204, 0.5)',
                    backgroundColor: 'rgba(0,0,0,0.8)'
                }}>
                    <img
                        src={handData.image}
                        alt="Camera Feed"
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                        }}
                    />
                    <div style={{
                        position: 'absolute',
                        bottom: 5,
                        left: 5,
                        color: handData.detected ? '#00ffcc' : 'red',
                        fontSize: '12px',
                        fontFamily: 'monospace',
                        fontWeight: 'bold',
                        background: 'rgba(0,0,0,0.5)',
                        padding: '2px 5px',
                        borderRadius: '3px'
                    }}>
                        {handData.detected ? "TRACKING" : "NO HAND"}
                    </div>
                </div>
            )}

            {!hasStarted && (
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    color: '#00ffcc',
                    fontFamily: 'monospace',
                    zIndex: 20,
                    textAlign: 'center',
                    background: 'rgba(0,0,0,0.9)',
                    padding: '40px',
                    border: '4px solid #00ffcc',
                    borderRadius: '20px',
                    boxShadow: '0 0 30px #00ffcc',
                    width: '80%',
                    maxWidth: '600px'
                }}>
                    <h1 style={{ fontSize: '48px', margin: '0 0 20px 0' }}>SYSTEM BOOT</h1>
                    <div style={{ fontSize: '24px', marginBottom: '20px', color: 'white' }}>
                        Waiting for Pilot Neural Link...
                    </div>
                    <div style={{ fontSize: '18px', color: '#ffcc00' }}>
                        Please show your hand to the camera to begin.
                    </div>
                </div>
            )}

            {/* HUD Overlay */}
            {hasStarted && (
                <>
                    <div style={{
                        position: 'absolute',
                        top: 20,
                        left: 20,
                        color: '#00ffcc',
                        fontFamily: 'monospace',
                        fontSize: '24px',
                        zIndex: 2,
                        textShadow: '0 0 10px #00ffcc',
                        pointerEvents: 'none'
                    }}>
                        SCORE: {hudScore}
                    </div>

                    <div style={{
                        position: 'absolute',
                        top: 20,
                        right: 20,
                        color: '#00ffcc',
                        fontFamily: 'monospace',
                        fontSize: '24px',
                        zIndex: 2,
                        textShadow: '0 0 10px #00ffcc',
                        pointerEvents: 'none'
                    }}>
                        SPEED: {Math.round((1.0 - handData.y) * 100)}%
                    </div>
                </>
            )}

            {!handData.detected && (
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    color: 'red',
                    fontFamily: 'monospace',
                    fontSize: '32px',
                    zIndex: 2,
                    textAlign: 'center',
                    background: 'rgba(0,0,0,0.7)',
                    padding: '20px',
                    border: '2px solid red',
                    borderRadius: '10px',
                    pointerEvents: 'none'
                }}>
                    NO HAND DETECTED<br />
                    <span style={{ fontSize: '18px', color: 'white' }}>Raise your hand to control the ship!</span>
                </div>
            )}
            {hudGameOver && (
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    color: 'white',
                    fontFamily: 'monospace',
                    fontSize: '48px',
                    zIndex: 3,
                    textAlign: 'center',
                    background: 'rgba(0,0,0,0.9)',
                    padding: '40px',
                    border: '4px solid #00ffcc',
                    borderRadius: '20px',
                    boxShadow: '0 0 30px #00ffcc'
                }}>
                    GAME OVER<br />
                    <span style={{ fontSize: '24px', color: '#00ffcc' }}>Score: {hudScore}</span><br />
                    <button
                        onClick={() => window.location.reload()}
                        style={{
                            marginTop: '20px',
                            padding: '10px 30px',
                            fontSize: '24px',
                            background: '#00ffcc',
                            color: 'black',
                            border: 'none',
                            borderRadius: '5px',
                            cursor: 'pointer',
                            fontFamily: 'inherit'
                        }}
                    >
                        RESTART
                    </button>
                </div>
            )}
        </div>
    );
}
