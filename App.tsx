import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameState, Player, Enemy, Bullet, Particle, EnemyType, Vector2, Scrap, Turret, Upgrades, GamePhase, Obstacle, Decoration, Entity } from './types';
import { COLORS, GAME_CONFIG } from './constants';
import { SoundManager } from './SoundManager';

// --- Local Storage Helpers ---
const STORAGE_KEY = 'arc_raider_zero_save_v1';

const loadSaveData = () => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    return JSON.parse(saved);
  }
  return {
    credits: 0,
    upgrades: { damageLvl: 1, fireRateLvl: 1, speedLvl: 1 }
  };
};

const saveGameData = (credits: number, upgrades: Upgrades) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ credits, upgrades }));
};

const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>();
  
  // Persistent Data
  const [credits, setCredits] = useState<number>(0);
  const [upgrades, setUpgrades] = useState<Upgrades>({ damageLvl: 1, fireRateLvl: 1, speedLvl: 1 });

  // Game State Refs
  const gameState = useRef<GameState>({
    player: {
      id: 'p1',
      pos: { x: window.innerWidth / 2, y: window.innerHeight / 2 },
      velocity: { x: 0, y: 0 },
      radius: 20,
      rotation: 0,
      hp: 100,
      maxHp: 100,
      speed: GAME_CONFIG.basePlayerSpeed,
      lastShotTime: 0,
      dead: false,
      ammo: GAME_CONFIG.magazineSize,
      maxAmmo: GAME_CONFIG.magazineSize,
      reloading: false,
      reloadStartTime: 0,
      damageMultiplier: 1,
      turretCooldown: 0,
    },
    enemies: [],
    bullets: [],
    particles: [],
    scrap: [],
    turrets: [],
    obstacles: [],
    decorations: [],
    phase: 'MENU',
    gameTime: 0,
    timeLeft: GAME_CONFIG.runDuration,
    extractionZone: null,
    sessionCredits: 0,
    score: 0,
    wave: 1,
    screenShake: 0,
  });

  // Inputs
  const keys = useRef<{ [key: string]: boolean }>({});
  const mouse = useRef<Vector2>({ x: 0, y: 0 });
  const isMouseDown = useRef(false);

  // React State for UI
  const [uiState, setUiState] = useState({
    hp: 100,
    ammo: 30,
    maxAmmo: 30,
    timeLeft: GAME_CONFIG.runDuration,
    credits: 0,
    phase: 'MENU' as GamePhase,
    turretReady: true,
    outcome: undefined as 'WON' | 'LOST' | undefined,
    sessionCredits: 0,
  });

  const [volume, setVolume] = useState(0.5);

  // Load Data on Mount
  useEffect(() => {
    const data = loadSaveData();
    setCredits(data.credits);
    setUpgrades(data.upgrades);
    
    // Auto-resize
    const resize = () => {
       if (canvasRef.current) {
          canvasRef.current.width = window.innerWidth;
          canvasRef.current.height = window.innerHeight;
       }
    };
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // Audio Volume Sync
  useEffect(() => {
    SoundManager.setVolume(volume);
  }, [volume]);

  // --- Helpers ---
  const getAngle = (p1: Vector2, p2: Vector2) => Math.atan2(p2.y - p1.y, p2.x - p1.x);
  const getDistance = (p1: Vector2, p2: Vector2) => Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
  const randomRange = (min: number, max: number) => Math.random() * (max - min) + min;

  // --- Collision Physics ---
  const checkCircleRect = (pos: Vector2, radius: number, rect: Obstacle): boolean => {
    const closestX = Math.max(rect.x, Math.min(pos.x, rect.x + rect.w));
    const closestY = Math.max(rect.y, Math.min(pos.y, rect.y + rect.h));
    const distanceX = pos.x - closestX;
    const distanceY = pos.y - closestY;
    const distanceSquared = (distanceX * distanceX) + (distanceY * distanceY);
    return distanceSquared < (radius * radius);
  };

  const isPositionBlocked = (pos: Vector2, radius: number): boolean => {
    return gameState.current.obstacles.some(obs => checkCircleRect(pos, radius, obs));
  };

  const moveEntityWithCollision = (entity: Entity, dx: number, dy: number) => {
    let nextX = entity.pos.x + dx;
    nextX = Math.max(entity.radius, Math.min(window.innerWidth - entity.radius, nextX));
    if (!isPositionBlocked({ x: nextX, y: entity.pos.y }, entity.radius)) {
      entity.pos.x = nextX;
    }

    let nextY = entity.pos.y + dy;
    nextY = Math.max(entity.radius, Math.min(window.innerHeight - entity.radius, nextY));
    if (!isPositionBlocked({ x: entity.pos.x, y: nextY }, entity.radius)) {
      entity.pos.y = nextY;
    }
  };

  // --- Core Mechanics ---
  const createExplosion = (pos: Vector2, intensity: number) => {
    SoundManager.playExplosion();
    const particles: Particle[] = [];
    for (let i = 0; i < intensity * 2; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = randomRange(2, 8);
      particles.push({
        id: Math.random().toString(),
        pos: { ...pos },
        velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
        radius: randomRange(0.5, 2),
        rotation: angle,
        life: 1.0,
        maxLife: randomRange(0.3, 0.6),
        color: COLORS.spark,
        size: randomRange(1, 3),
        type: 'SPARK',
        dead: false
      });
    }
    for (let i = 0; i < intensity; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = randomRange(1, 4);
      particles.push({
        id: Math.random().toString(),
        pos: { ...pos },
        velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
        radius: randomRange(2, 5),
        rotation: Math.random() * Math.PI * 2,
        angularVelocity: randomRange(-0.2, 0.2),
        life: 1.0,
        maxLife: randomRange(0.8, 1.5),
        color: COLORS.debris,
        size: randomRange(3, 8),
        type: 'DEBRIS',
        dead: false
      });
    }
    gameState.current.particles.push(...particles);
    gameState.current.screenShake += intensity * 0.8;
  };

  const spawnScrap = (pos: Vector2, amount: number) => {
    for (let i = 0; i < amount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = randomRange(1, 3);
      gameState.current.scrap.push({
        id: Math.random().toString(),
        pos: { x: pos.x, y: pos.y },
        velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
        radius: 6,
        rotation: Math.random() * Math.PI * 2,
        dead: false,
        value: 10,
        collectionRadius: 50
      });
    }
  };

  const spawnEnemy = () => {
    const { enemies, score } = gameState.current;
    const isWalker = Math.random() > 0.8; 
    const side = Math.floor(Math.random() * 4);
    let x = 0, y = 0;
    const margin = 50;
    
    if (side === 0) { x = Math.random() * window.innerWidth; y = -margin; }
    else if (side === 1) { x = window.innerWidth + margin; y = Math.random() * window.innerHeight; }
    else if (side === 2) { x = Math.random() * window.innerWidth; y = window.innerHeight + margin; }
    else { x = -margin; y = Math.random() * window.innerHeight; }

    const hpMultiplier = 1 + (score / 2000);

    const enemy: Enemy = {
      id: Math.random().toString(),
      pos: { x, y },
      velocity: { x: 0, y: 0 },
      radius: isWalker ? 25 : 15,
      rotation: 0,
      type: isWalker ? EnemyType.WALKER : EnemyType.DRONE,
      hp: (isWalker ? 12 : 3) * hpMultiplier,
      maxHp: (isWalker ? 12 : 3) * hpMultiplier,
      speed: isWalker ? GAME_CONFIG.walkerSpeed : GAME_CONFIG.droneSpeed,
      oscillationOffset: Math.random() * Math.PI * 2,
      dead: false,
    };
    enemies.push(enemy);
  };

  // --- Main Update Loop ---
  const update = (dt: number) => {
    const state = gameState.current;
    
    // Only update game logic in these states
    if (state.phase !== 'PLAYING' && state.phase !== 'EXTRACTION_READY' && state.phase !== 'EXTRACTING') return;

    state.gameTime += dt;
    state.screenShake *= 0.9;

    // Timer Logic
    if (state.timeLeft > 0) {
      state.timeLeft -= dt / 1000;
      if (state.timeLeft <= 0) {
        state.timeLeft = 0;
        state.phase = 'EXTRACTION_READY';
        SoundManager.playExtractionAlarm();
        
        let exX, exY;
        let attempts = 0;
        do {
           exX = randomRange(100, window.innerWidth - 100);
           exY = randomRange(100, window.innerHeight - 100);
           attempts++;
        } while (isPositionBlocked({x: exX, y: exY}, GAME_CONFIG.extractionZoneRadius) && attempts < 100);

        state.extractionZone = {
          pos: { x: exX, y: exY },
          radius: GAME_CONFIG.extractionZoneRadius,
          progress: 0
        };
      }
    }

    // Extraction Logic
    if (state.extractionZone) {
      const dist = getDistance(state.player.pos, state.extractionZone.pos);
      if (dist < state.extractionZone.radius) {
        state.phase = 'EXTRACTING';
        state.extractionZone.progress += dt / 1000;
        if (state.extractionZone.progress >= GAME_CONFIG.extractionTime) {
          endGame('WON');
        }
      } else {
        if (state.phase === 'EXTRACTING') state.phase = 'EXTRACTION_READY';
        state.extractionZone.progress = Math.max(0, state.extractionZone.progress - (dt / 2000));
      }
    }

    // Player Movement
    let dx = 0; let dy = 0;
    if (keys.current['w'] || keys.current['arrowup']) dy -= 1;
    if (keys.current['s'] || keys.current['arrowdown']) dy += 1;
    if (keys.current['a'] || keys.current['arrowleft']) dx -= 1;
    if (keys.current['d'] || keys.current['arrowright']) dx += 1;

    if (dx !== 0 || dy !== 0) {
      const length = Math.sqrt(dx * dx + dy * dy);
      dx /= length; dy /= length;
    }

    state.player.velocity.x = dx * state.player.speed;
    state.player.velocity.y = dy * state.player.speed;
    moveEntityWithCollision(state.player, state.player.velocity.x, state.player.velocity.y);
    state.player.rotation = getAngle(state.player.pos, mouse.current);

    // Reloading
    if (state.player.reloading) {
      if (Date.now() - state.player.reloadStartTime > GAME_CONFIG.reloadTime) {
        state.player.ammo = state.player.maxAmmo;
        state.player.reloading = false;
      }
    } else if (keys.current['r'] && state.player.ammo < state.player.maxAmmo && !state.player.reloading) {
      state.player.reloading = true;
      state.player.reloadStartTime = Date.now();
    } else if (state.player.ammo <= 0 && !state.player.reloading) {
      state.player.reloading = true;
      state.player.reloadStartTime = Date.now();
    }

    // Shooting
    if (isMouseDown.current && !state.player.reloading && state.player.ammo > 0 && Date.now() - state.player.lastShotTime > (GAME_CONFIG.baseFireRate / upgrades.fireRateLvl)) { 
      const offsetDistance = 35;
      const bx = state.player.pos.x + Math.cos(state.player.rotation) * offsetDistance;
      const by = state.player.pos.y + Math.sin(state.player.rotation) * offsetDistance;

      state.bullets.push({
        id: Math.random().toString(),
        pos: { x: bx, y: by },
        velocity: { 
          x: Math.cos(state.player.rotation) * GAME_CONFIG.baseBulletSpeed, 
          y: Math.sin(state.player.rotation) * GAME_CONFIG.baseBulletSpeed 
        },
        radius: 3,
        rotation: state.player.rotation,
        damage: GAME_CONFIG.baseDamage * (1 + (upgrades.damageLvl * 0.2)), 
        color: COLORS.bullet,
        source: 'PLAYER',
        dead: false,
      });
      state.player.ammo--;
      state.player.lastShotTime = Date.now();
      state.screenShake += 2;
      SoundManager.playShoot();
    }

    // Gadget: Turret
    if (keys.current[' '] && Date.now() > state.player.turretCooldown) {
      const tx = state.player.pos.x;
      const ty = state.player.pos.y;
      if (!isPositionBlocked({x: tx, y: ty}, 15)) {
        state.turrets.push({
          id: Math.random().toString(),
          pos: { x: tx, y: ty },
          velocity: { x: 0, y: 0 },
          radius: 15,
          rotation: state.player.rotation,
          life: GAME_CONFIG.turretDuration,
          maxLife: GAME_CONFIG.turretDuration,
          lastShotTime: 0,
          targetId: null,
          dead: false
        });
        state.player.turretCooldown = Date.now() + GAME_CONFIG.turretCooldown;
        SoundManager.playClick();
      }
    }

    // Entity Updates (Turrets, Scrap, Bullets, Enemies, Particles) - Same as before
    // ... [Logic omitted for brevity, logic remains identical to previous step but wrapped]
    
    // Turrets Logic
    state.turrets.forEach(t => {
      t.life -= dt;
      if (t.life <= 0) t.dead = true;
      let nearestDist = GAME_CONFIG.turretRange;
      let nearestEnemy: Enemy | null = null;
      state.enemies.forEach(e => {
        const d = getDistance(t.pos, e.pos);
        if (d < nearestDist) { nearestDist = d; nearestEnemy = e; }
      });
      if (nearestEnemy) {
        t.rotation = getAngle(t.pos, nearestEnemy.pos);
        if (Date.now() - t.lastShotTime > GAME_CONFIG.turretFireRate) {
           state.bullets.push({
            id: Math.random().toString(),
            pos: { x: t.pos.x, y: t.pos.y },
            velocity: { x: Math.cos(t.rotation) * GAME_CONFIG.baseBulletSpeed, y: Math.sin(t.rotation) * GAME_CONFIG.baseBulletSpeed },
            radius: 3, rotation: t.rotation, damage: GAME_CONFIG.baseDamage * 0.5, color: COLORS.turret, source: 'TURRET', dead: false,
          });
          t.lastShotTime = Date.now();
          SoundManager.playShoot();
        }
      }
    });

    // Scrap Logic
    state.scrap.forEach(s => {
      s.velocity.x *= 0.95; s.velocity.y *= 0.95;
      let nextX = s.pos.x + s.velocity.x;
      let nextY = s.pos.y + s.velocity.y;
      if (isPositionBlocked({x: nextX, y: s.pos.y}, s.radius)) s.velocity.x *= -0.5; else s.pos.x = nextX;
      if (isPositionBlocked({x: s.pos.x, y: nextY}, s.radius)) s.velocity.y *= -0.5; else s.pos.y = nextY;
      const d = getDistance(s.pos, state.player.pos);
      if (d < s.collectionRadius) {
        s.pos.x += (state.player.pos.x - s.pos.x) * 0.1;
        s.pos.y += (state.player.pos.y - s.pos.y) * 0.1;
      }
      if (d < state.player.radius + s.radius) {
        s.dead = true;
        state.sessionCredits += s.value;
        SoundManager.playCollect();
      }
    });

    // Bullets Logic
    state.bullets.forEach(b => {
      b.pos.x += b.velocity.x; b.pos.y += b.velocity.y;
      if (b.pos.x < 0 || b.pos.x > window.innerWidth || b.pos.y < 0 || b.pos.y > window.innerHeight) b.dead = true;
    });

    // Enemies Logic
    const spawnInterval = Math.max(500, GAME_CONFIG.spawnRateInitial - (state.score * 5));
    if (Math.floor(state.gameTime / spawnInterval) > Math.floor((state.gameTime - dt) / spawnInterval)) {
      spawnEnemy();
    }
    state.enemies.forEach(e => {
      const angle = getAngle(e.pos, state.player.pos);
      e.rotation = angle;
      e.velocity.x = Math.cos(angle) * e.speed;
      e.velocity.y = Math.sin(angle) * e.speed;
      state.enemies.forEach(other => {
        if (e === other) return;
        const d = getDistance(e.pos, other.pos);
        if (d < e.radius + other.radius) {
           const pushAngle = getAngle(other.pos, e.pos);
           e.velocity.x += Math.cos(pushAngle) * 0.1; e.velocity.y += Math.sin(pushAngle) * 0.1;
        }
      });
      moveEntityWithCollision(e, e.velocity.x, e.velocity.y);
      const distToPlayer = getDistance(e.pos, state.player.pos);
      if (distToPlayer < e.radius + state.player.radius) {
        state.player.hp -= 0.5;
        state.screenShake += 0.5;
      }
    });

    // Particles
    state.particles.forEach(p => {
      p.pos.x += p.velocity.x; p.pos.y += p.velocity.y;
      p.life -= dt / (p.maxLife * 1000);
      if (p.angularVelocity) p.rotation += p.angularVelocity;
      if (p.life <= 0) p.dead = true;
    });

    // Bullet Collisions
    state.bullets.forEach(b => {
      if (b.dead) return;
      state.enemies.forEach(e => {
        if (e.dead) return;
        if (getDistance(b.pos, e.pos) < e.radius + b.radius) {
          e.hp -= b.damage; b.dead = true;
          createExplosion(b.pos, 2);
          if (e.hp <= 0) {
            e.dead = true;
            state.score += (e.type === EnemyType.WALKER ? 50 : 10);
            createExplosion(e.pos, e.type === EnemyType.WALKER ? 15 : 8);
            spawnScrap(e.pos, e.type === EnemyType.WALKER ? 5 : 1);
          }
        }
      });
    });

    // Cleanup
    state.bullets = state.bullets.filter(b => !b.dead);
    state.enemies = state.enemies.filter(e => !e.dead);
    state.particles = state.particles.filter(p => !p.dead);
    state.scrap = state.scrap.filter(s => !s.dead);
    state.turrets = state.turrets.filter(t => !t.dead);

    // Lose Condition
    if (state.player.hp <= 0) {
      endGame('LOST');
    }

    // UI Updates
    if (Math.random() < 0.2) {
      setUiState({
        hp: Math.ceil(state.player.hp),
        ammo: state.player.ammo,
        maxAmmo: state.player.maxAmmo,
        timeLeft: state.timeLeft,
        credits: state.sessionCredits,
        phase: state.phase,
        turretReady: Date.now() > state.player.turretCooldown,
        outcome: state.outcome,
        sessionCredits: state.sessionCredits,
      });
    }
  };

  const endGame = (outcome: 'WON' | 'LOST') => {
    gameState.current.phase = 'REPORT';
    gameState.current.outcome = outcome;
    
    if (outcome === 'WON') {
      const totalCredits = credits + gameState.current.sessionCredits;
      setCredits(totalCredits);
      saveGameData(totalCredits, upgrades);
      SoundManager.playCollect();
    } else {
      SoundManager.playExplosion();
      // Lost all session credits
    }
    
    setUiState(prev => ({ ...prev, phase: 'REPORT', outcome, sessionCredits: gameState.current.sessionCredits }));
  };

  const draw = (ctx: CanvasRenderingContext2D) => {
    // ... [Previous draw code mostly unchanged, just ensure it draws for the current state]
    const state = gameState.current;
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;
    
    ctx.save();
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, width, height);

    // Only draw game world if not in Menu/Lobby (unless we want background game running? No, static for now)
    if (state.phase === 'MENU' || state.phase === 'LOBBY') {
      // Draw a subtle animated grid background for menu
      ctx.strokeStyle = COLORS.grid;
      ctx.lineWidth = 1;
      const gridSize = 60;
      const time = Date.now() / 1000;
      const offsetX = Math.sin(time) * 20;
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath(); ctx.moveTo(x + offsetX, 0); ctx.lineTo(x + offsetX, height); ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
      }
      ctx.restore();
      return;
    }

    if (state.screenShake > 0.5) {
      const dx = (Math.random() - 0.5) * state.screenShake;
      const dy = (Math.random() - 0.5) * state.screenShake;
      ctx.translate(dx, dy);
    }

    // --- Drawing Logic (Copied from previous implementation for environment/entities) ---
    // 1. Rubble
    state.decorations.forEach(d => {
       ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(d.rotation); ctx.fillStyle = COLORS.rubble;
       if (d.type === 'rubble') ctx.fillRect(-d.size/2, -d.size/2, d.size, d.size);
       else { ctx.beginPath(); ctx.arc(0, 0, d.size, 0, Math.PI * 2); ctx.fill(); }
       ctx.restore();
    });
    // 2. Grid
    ctx.strokeStyle = COLORS.grid; ctx.lineWidth = 1; ctx.beginPath();
    const gridSize = 60;
    const offsetX = -state.player.pos.x * 0.1; const offsetY = -state.player.pos.y * 0.1;
    for (let x = (offsetX % gridSize); x < width; x += gridSize) { ctx.moveTo(x, 0); ctx.lineTo(x, height); }
    for (let y = (offsetY % gridSize); y < height; y += gridSize) { ctx.moveTo(0, y); ctx.lineTo(width, y); }
    ctx.stroke();
    // 3. Extraction
    if (state.extractionZone) {
      const ez = state.extractionZone;
      ctx.save(); ctx.translate(ez.pos.x, ez.pos.y);
      ctx.strokeStyle = state.phase === 'EXTRACTING' ? COLORS.extractionZoneActive : COLORS.extractionZone;
      ctx.lineWidth = 2; ctx.setLineDash([10, 5]);
      ctx.beginPath(); ctx.rotate(state.gameTime / 1000); ctx.arc(0, 0, ez.radius, 0, Math.PI * 2); ctx.stroke();
      if (ez.progress > 0) {
        ctx.fillStyle = COLORS.extractionZone; ctx.globalAlpha = 0.3;
        ctx.beginPath(); ctx.arc(0, 0, ez.radius * (ez.progress / GAME_CONFIG.extractionTime), 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
    // 4. Scrap
    state.scrap.forEach(s => {
      ctx.save(); ctx.translate(s.pos.x, s.pos.y); ctx.translate(0, Math.sin(state.gameTime / 200 + parseFloat(s.id)) * 3);
      ctx.fillStyle = COLORS.scrap; ctx.shadowColor = COLORS.scrap; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(5, 4); ctx.lineTo(-5, 4); ctx.fill(); ctx.restore();
    });
    // 5. Obstacles
    state.obstacles.forEach(o => {
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(o.x + 10, o.y + 10, o.w, o.h);
    });
    // 6. Turrets
    state.turrets.forEach(t => {
      ctx.save(); ctx.translate(t.pos.x, t.pos.y); ctx.rotate(t.rotation);
      ctx.fillStyle = COLORS.turret; ctx.shadowColor = COLORS.turret; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-8, 8); ctx.lineTo(-8, -8); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 12, 0, (t.life / t.maxLife) * Math.PI * 2); ctx.stroke();
      ctx.restore();
    });
    // 7. Enemies
    state.enemies.forEach(e => {
      ctx.save(); ctx.translate(e.pos.x, e.pos.y); ctx.rotate(e.rotation);
      if (e.type === EnemyType.DRONE) {
        ctx.fillStyle = COLORS.enemyDrone; ctx.beginPath(); ctx.moveTo(15, 0); ctx.lineTo(-10, 10); ctx.lineTo(-5, 0); ctx.lineTo(-10, -10); ctx.closePath(); ctx.fill();
        ctx.shadowBlur = 10; ctx.shadowColor = COLORS.enemyEye; ctx.fillStyle = COLORS.enemyEye; ctx.beginPath(); ctx.arc(8, 0, 3, 0, Math.PI * 2); ctx.fill();
      } else {
        const walkCycle = Math.sin(state.gameTime / 100 + e.oscillationOffset) * 6;
        ctx.fillStyle = COLORS.enemyWalker; ctx.fillRect(-15 + walkCycle, -25, 20, 10); ctx.fillRect(-15 - walkCycle, 15, 20, 10);
        ctx.fillStyle = '#475569'; ctx.fillRect(-15, -15, 30, 30); ctx.fillStyle = COLORS.enemyWalker; ctx.fillRect(-5, -10, 20, 20);
        ctx.shadowBlur = 8; ctx.shadowColor = COLORS.enemyEye; ctx.fillStyle = COLORS.enemyEye; ctx.fillRect(5, -5, 4, 10);
      }
      ctx.restore();
    });
    // 8. Player
    if (!state.player.dead) {
      ctx.save(); ctx.translate(state.player.pos.x, state.player.pos.y);
      if (state.player.reloading) {
        const progress = (Date.now() - state.player.reloadStartTime) / GAME_CONFIG.reloadTime;
        ctx.fillStyle = '#333'; ctx.fillRect(-20, -40, 40, 4); ctx.fillStyle = '#fff'; ctx.fillRect(-20, -40, 40 * progress, 4);
      }
      ctx.rotate(state.player.rotation);
      ctx.fillStyle = '#334155'; ctx.fillRect(10, 5, 25, 8);
      ctx.fillStyle = COLORS.playerArmor; ctx.beginPath(); ctx.arc(0, -10, 10, 0, Math.PI * 2); ctx.arc(0, 10, 10, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = COLORS.playerBody; ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 15; ctx.shadowColor = COLORS.playerAccent; ctx.fillStyle = COLORS.playerAccent; ctx.beginPath(); ctx.moveTo(5, -5); ctx.lineTo(10, 0); ctx.lineTo(5, 5); ctx.lineTo(2, 0); ctx.fill();
      ctx.shadowBlur = 10; ctx.shadowColor = '#0ea5e9'; ctx.fillStyle = '#0ea5e9'; ctx.fillRect(-14, -4, 4, 8);
      ctx.restore();
    }
    // 9. Obstacles 3D
    state.obstacles.forEach(o => {
      ctx.fillStyle = COLORS.obstacleSide; ctx.fillRect(o.x, o.y + o.h - 10, o.w, 10);
      ctx.fillStyle = COLORS.obstacleTop; ctx.fillRect(o.x, o.y, o.w, o.h - 10);
      ctx.strokeStyle = COLORS.obstacleBorder; ctx.lineWidth = 2; ctx.strokeRect(o.x, o.y, o.w, o.h - 10);
      ctx.beginPath(); ctx.moveTo(o.x + o.w * 0.3, o.y + 10); ctx.lineTo(o.x + o.w * 0.7, o.y + 10); ctx.stroke();
    });
    // 10. Bullets/Particles
    ctx.shadowBlur = 15;
    state.bullets.forEach(b => {
      ctx.shadowColor = b.color; ctx.strokeStyle = b.color; ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(b.pos.x, b.pos.y); ctx.lineTo(b.pos.x - b.velocity.x * 1.5, b.pos.y - b.velocity.y * 1.5); ctx.stroke();
    });
    ctx.shadowBlur = 0;
    state.particles.forEach(p => {
      ctx.save(); ctx.globalAlpha = p.life; ctx.translate(p.pos.x, p.pos.y); ctx.rotate(p.rotation); ctx.fillStyle = p.color;
      if (p.type === 'SPARK') { ctx.shadowBlur = 10; ctx.shadowColor = p.color; ctx.beginPath(); ctx.rect(-p.size/2, -0.5, p.size * 3, 1); ctx.fill(); }
      else { ctx.beginPath(); ctx.moveTo(-p.size, -p.size); ctx.lineTo(p.size, -p.size * 0.5); ctx.lineTo(0, p.size); ctx.fill(); }
      ctx.restore();
    });
    
    ctx.restore();

    // Vignette
    const gradient = ctx.createRadialGradient(width/2, height/2, height/3, width/2, height/2, height);
    gradient.addColorStop(0, 'rgba(0,0,0,0)'); gradient.addColorStop(1, 'rgba(0,0,0,0.8)');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, height);
  };

  // Loop Setup
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Auto-init sound on interaction (handled by buttons now, but ensuring it runs)
    const initSound = () => SoundManager.init();
    window.addEventListener('click', initSound, { once: true });

    let lastTime = 0;
    const gameLoop = (timestamp: number) => {
      const dt = timestamp - lastTime;
      lastTime = timestamp;
      update(dt);
      draw(ctx);
      requestRef.current = requestAnimationFrame(gameLoop);
    };
    requestRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      window.removeEventListener('click', initSound);
    };
  }, [upgrades]);

  // Input Listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { 
      keys.current[e.key.toLowerCase()] = true; 
      if (e.key === 'Escape') {
        if (gameState.current.phase === 'PLAYING') {
          gameState.current.phase = 'PAUSED';
          setUiState(prev => ({...prev, phase: 'PAUSED'}));
        } else if (gameState.current.phase === 'PAUSED') {
          gameState.current.phase = 'PLAYING';
          setUiState(prev => ({...prev, phase: 'PLAYING'}));
        }
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => { keys.current[e.key.toLowerCase()] = false; };
    const handleMouseMove = (e: MouseEvent) => { mouse.current.x = e.clientX; mouse.current.y = e.clientY; };
    const handleMouseDown = () => { isMouseDown.current = true; };
    const handleMouseUp = () => { isMouseDown.current = false; };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const generateLevel = () => {
    const obstacles: Obstacle[] = [];
    const decorations: Decoration[] = [];
    const mapW = window.innerWidth;
    const mapH = window.innerHeight;
    
    for (let i = 0; i < 20; i++) {
      const w = randomRange(60, 200);
      const h = randomRange(60, 200);
      const x = randomRange(0, mapW - w);
      const y = randomRange(0, mapH - h);
      const centerX = x + w/2; const centerY = y + h/2;
      if (Math.sqrt(Math.pow(centerX - mapW/2, 2) + Math.pow(centerY - mapH/2, 2)) > 250) {
        obstacles.push({ id: `wall_${i}`, x, y, w, h });
      }
    }
    for (let i = 0; i < 50; i++) {
       decorations.push({ x: randomRange(0, mapW), y: randomRange(0, mapH), size: randomRange(5, 15), rotation: randomRange(0, Math.PI * 2), type: Math.random() > 0.8 ? 'crater' : 'rubble' });
    }
    gameState.current.obstacles = obstacles;
    gameState.current.decorations = decorations;
  };

  const deploy = () => {
    SoundManager.init();
    SoundManager.playClick();
    generateLevel();
    
    // Reset State
    gameState.current = {
      player: {
        id: 'p1', pos: { x: window.innerWidth / 2, y: window.innerHeight / 2 }, velocity: { x: 0, y: 0 },
        radius: 20, rotation: 0, hp: 100, maxHp: 100, speed: GAME_CONFIG.basePlayerSpeed * (1 + (upgrades.speedLvl * 0.1)),
        lastShotTime: 0, dead: false, ammo: GAME_CONFIG.magazineSize, maxAmmo: GAME_CONFIG.magazineSize, reloading: false,
        reloadStartTime: 0, damageMultiplier: 1 + (upgrades.damageLvl * 0.2), turretCooldown: 0,
      },
      enemies: [], bullets: [], particles: [], scrap: [], turrets: [], obstacles: gameState.current.obstacles, decorations: gameState.current.decorations,
      phase: 'PLAYING', gameTime: 0, timeLeft: GAME_CONFIG.runDuration, extractionZone: null, sessionCredits: 0, score: 0, wave: 1, screenShake: 0,
    };
    setUiState(prev => ({ ...prev, phase: 'PLAYING' }));
  };

  const buyUpgrade = (type: keyof Upgrades) => {
    SoundManager.playClick();
    const currentLvl = upgrades[type];
    const cost = currentLvl * GAME_CONFIG.upgradeCostBase;
    if (credits >= cost) {
      const newUpgrades = { ...upgrades, [type]: currentLvl + 1 };
      const newCredits = credits - cost;
      setCredits(newCredits);
      setUpgrades(newUpgrades);
      saveGameData(newCredits, newUpgrades);
    }
  };

  return (
    <div className="relative w-full h-full bg-black overflow-hidden font-mono select-none">
      
      {/* --- MENU OVERLAYS --- */}
      
      {/* 1. Main Menu */}
      {uiState.phase === 'MENU' && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md">
           <h1 className="text-6xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-b from-cyan-300 to-cyan-600 mb-8 uppercase tracking-tighter drop-shadow-[0_0_15px_rgba(6,182,212,0.8)]">
              Arc Raider Zero
           </h1>
           <div className="flex flex-col gap-4 w-64">
             <button onClick={() => { SoundManager.playClick(); setUiState(prev => ({...prev, phase: 'LOBBY'})); }} className="px-8 py-4 bg-slate-800 border border-cyan-500/50 hover:bg-cyan-900/50 text-white font-bold uppercase tracking-widest transition-all">
               Start Game
             </button>
             <button onClick={() => { SoundManager.playClick(); setUiState(prev => ({...prev, phase: 'TUTORIAL'})); }} className="px-8 py-4 bg-slate-800 border border-slate-600 hover:bg-slate-700 text-slate-300 font-bold uppercase tracking-widest transition-all">
               Tutorial
             </button>
           </div>
        </div>
      )}

      {/* 2. Tutorial */}
      {uiState.phase === 'TUTORIAL' && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/95">
          <div className="max-w-xl text-center p-8 border border-slate-700">
             <h2 className="text-3xl text-cyan-400 font-bold mb-6">COMBAT MANUAL</h2>
             <div className="grid grid-cols-2 gap-8 text-left text-slate-300 mb-8">
               <div>
                 <p className="mb-2"><strong className="text-white">WASD</strong> - Movement</p>
                 <p className="mb-2"><strong className="text-white">MOUSE</strong> - Aim</p>
                 <p className="mb-2"><strong className="text-white">LMB</strong> - Fire Weapon</p>
                 <p className="mb-2"><strong className="text-white">R</strong> - Reload</p>
               </div>
               <div>
                 <p className="mb-2"><strong className="text-white">SPACE</strong> - Deploy Turret</p>
                 <p className="mb-2"><strong className="text-white">ESC</strong> - Pause</p>
               </div>
             </div>
             <p className="text-amber-400 mb-8 text-sm uppercase tracking-widest border-t border-b border-amber-900/50 py-4">
               Mission: Survive 2 Minutes -> Collect Scrap -> Stand in Green Zone to Extract.
             </p>
             <button onClick={() => { SoundManager.playClick(); setUiState(prev => ({...prev, phase: 'MENU'})); }} className="px-8 py-3 bg-cyan-700 text-white font-bold uppercase">
               Understood
             </button>
          </div>
        </div>
      )}

      {/* 3. Pause Menu */}
      {uiState.phase === 'PAUSED' && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
           <div className="bg-slate-900 p-8 border border-slate-600 w-80 text-center shadow-2xl">
              <h2 className="text-2xl text-white font-bold mb-6 uppercase">System Paused</h2>
              
              <div className="mb-6">
                <label className="block text-slate-400 text-xs mb-2">Master Volume</label>
                <input 
                  type="range" min="0" max="1" step="0.1" 
                  value={volume} onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <button onClick={() => { setUiState(prev => ({...prev, phase: 'PLAYING'})); gameState.current.phase = 'PLAYING'; }} className="w-full py-3 bg-cyan-600 text-white font-bold uppercase mb-4">
                Resume
              </button>
              <button onClick={() => { setUiState(prev => ({...prev, phase: 'MENU'})); gameState.current.phase = 'MENU'; }} className="w-full py-3 bg-slate-700 text-white font-bold uppercase">
                Abort Mission
              </button>
           </div>
        </div>
      )}

      {/* 4. Report / Game Over */}
      {uiState.phase === 'REPORT' && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-lg">
          <div className={`max-w-md w-full p-8 border-2 ${uiState.outcome === 'WON' ? 'border-emerald-500 bg-emerald-950/20' : 'border-red-500 bg-red-950/20'} text-center`}>
            <h1 className={`text-5xl font-black mb-2 uppercase tracking-tighter ${uiState.outcome === 'WON' ? 'text-emerald-400' : 'text-red-500'}`}>
              {uiState.outcome === 'WON' ? 'Extraction Success' : 'KIA / Failed'}
            </h1>
            <p className="text-slate-400 mb-8 uppercase tracking-widest text-sm">
              {uiState.outcome === 'WON' ? 'Payload Secured' : 'Signal Lost'}
            </p>
            
            <div className="bg-black/50 p-6 mb-8 border border-slate-700">
               <div className="flex justify-between mb-2">
                 <span className="text-slate-400">Scrap Collected</span>
                 <span className="text-amber-400 font-bold">+ {uiState.sessionCredits}</span>
               </div>
               <div className="flex justify-between border-t border-slate-700 pt-2 mt-2">
                 <span className="text-slate-200">Total Funds</span>
                 <span className="text-white font-bold">{credits + (uiState.outcome === 'WON' ? 0 : 0)}</span>
               </div>
            </div>

            <button onClick={() => { SoundManager.playClick(); setUiState(prev => ({...prev, phase: 'LOBBY'})); }} className={`w-full py-4 font-bold uppercase tracking-widest transition-all ${uiState.outcome === 'WON' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-red-600 hover:bg-red-500'} text-white`}>
              Return to Base
            </button>
          </div>
        </div>
      )}

      {/* 5. Lobby / Shop (Existing but updated visuals) */}
      {uiState.phase === 'LOBBY' && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-900">
          <div className="w-full max-w-3xl p-8">
            <div className="flex justify-between items-center mb-8 border-b border-slate-700 pb-4">
               <div>
                 <h2 className="text-3xl font-bold text-white uppercase">Armory</h2>
                 <p className="text-slate-400 text-sm">Prepare for deployment</p>
               </div>
               <div className="text-right">
                 <div className="text-3xl font-bold text-amber-400">⬢ {credits}</div>
                 <div className="text-xs text-slate-500 uppercase">Available Credits</div>
               </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
               {/* Cards */}
               {[
                 { id: 'damageLvl', label: 'Kinetic Driver', sub: 'Increase Damage', lvl: upgrades.damageLvl },
                 { id: 'fireRateLvl', label: 'Cycle Accelerator', sub: 'Increase Fire Rate', lvl: upgrades.fireRateLvl },
                 { id: 'speedLvl', label: 'Servo Motors', sub: 'Increase Speed', lvl: upgrades.speedLvl },
               ].map((u) => {
                 const cost = u.lvl * GAME_CONFIG.upgradeCostBase;
                 const canAfford = credits >= cost;
                 return (
                   <div key={u.id} className="bg-slate-800 p-6 border border-slate-700 hover:border-cyan-500/50 transition-all group">
                      <div className="text-cyan-400 font-bold text-lg mb-1">{u.label}</div>
                      <div className="text-slate-500 text-xs uppercase mb-4">{u.sub}</div>
                      <div className="text-white text-sm mb-4">Current Level: <span className="text-cyan-200">{u.lvl}</span></div>
                      <button 
                        onClick={() => buyUpgrade(u.id as keyof Upgrades)}
                        disabled={!canAfford}
                        className={`w-full py-2 text-sm font-bold uppercase ${canAfford ? 'bg-slate-700 group-hover:bg-cyan-700 text-white' : 'bg-slate-800 text-slate-600 border border-slate-700'}`}
                      >
                        Upgrade ({cost})
                      </button>
                   </div>
                 );
               })}
            </div>

            <div className="flex gap-4">
               <button onClick={() => { SoundManager.playClick(); setUiState(prev => ({...prev, phase: 'MENU'})); }} className="px-6 py-4 border border-slate-600 text-slate-400 font-bold uppercase hover:bg-slate-800 transition-all">
                 Back
               </button>
               <button onClick={deploy} className="flex-1 py-4 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xl uppercase tracking-[0.2em] shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:shadow-[0_0_30px_rgba(6,182,212,0.6)] transition-all">
                 Deploy
               </button>
            </div>
          </div>
        </div>
      )}

      {/* HUD Layer (Only visible when Playing) */}
      {(uiState.phase === 'PLAYING' || uiState.phase === 'EXTRACTION_READY' || uiState.phase === 'EXTRACTING' || uiState.phase === 'PAUSED') && (
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-10 p-6 flex flex-col justify-between">
          {/* Top Bar */}
          <div className="flex justify-center">
            <div className={`px-6 py-2 border-b-2 ${uiState.timeLeft <= 10 && uiState.timeLeft > 0 ? 'border-red-500 animate-pulse text-red-500' : 'border-slate-500 text-slate-300'} bg-black/50 backdrop-blur-sm text-2xl font-bold tracking-widest`}>
              {uiState.phase === 'PLAYING' || uiState.phase === 'EXTRACTION_READY' || uiState.phase === 'PAUSED' ? 
                `${Math.floor(uiState.timeLeft / 60)}:${Math.floor(uiState.timeLeft % 60).toString().padStart(2, '0')}` 
                : 
                uiState.phase === 'EXTRACTING' ? <span className="text-emerald-400">EXTRACTING...</span> : ''
              }
              {uiState.phase === 'EXTRACTION_READY' && <span className="text-sm ml-4 text-emerald-400 animate-pulse">ZONE ACTIVE</span>}
            </div>
          </div>

          {/* Bottom Layer */}
          <div className="flex justify-between items-end">
            <div className="flex flex-col gap-4 w-64">
              <div className="text-amber-400 font-bold flex items-center gap-2 text-lg shadow-black drop-shadow-md">
                <span>+⬢ {uiState.sessionCredits}</span>
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-xs uppercase tracking-widest text-slate-400"><span>Integrity</span><span>{uiState.hp}%</span></div>
                <div className="w-full h-4 bg-slate-800 border border-slate-700 skew-x-[-12deg] overflow-hidden">
                  <div className={`h-full transition-all duration-200 ${uiState.hp > 30 ? 'bg-cyan-500' : 'bg-red-500'}`} style={{ width: `${Math.max(0, uiState.hp)}%` }} />
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end gap-4">
               <div className="flex items-center gap-3">
                 <span className="text-xs text-slate-400 uppercase tracking-widest">Sentry Turret [SPACE]</span>
                 <div className={`w-3 h-3 rounded-full ${uiState.turretReady ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-red-900'}`} />
               </div>
               <div className="text-right">
                 <div className="text-6xl font-black text-white/90 tracking-tighter">
                   {uiState.ammo}<span className="text-2xl text-slate-500">/{uiState.maxAmmo}</span>
                 </div>
               </div>
            </div>
          </div>
        </div>
      )}

      <canvas ref={canvasRef} className="block" />
    </div>
  );
};

export default App;