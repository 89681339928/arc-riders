export interface Vector2 {
  x: number;
  y: number;
}

export interface Entity {
  id: string;
  pos: Vector2;
  velocity: Vector2;
  radius: number;
  rotation: number;
  dead: boolean;
}

export interface Upgrades {
  damageLvl: number;
  fireRateLvl: number;
  speedLvl: number;
}

export interface Player extends Entity {
  hp: number;
  maxHp: number;
  speed: number;
  
  // Combat Stats
  lastShotTime: number;
  ammo: number;
  maxAmmo: number;
  reloading: boolean;
  reloadStartTime: number;
  damageMultiplier: number;

  // Gadget
  turretCooldown: number;
}

export interface Scrap extends Entity {
  value: number;
  collectionRadius: number;
}

export interface Turret extends Entity {
  lastShotTime: number;
  life: number;
  maxLife: number;
  targetId: string | null;
}

export enum EnemyType {
  DRONE = 'DRONE',
  WALKER = 'WALKER',
}

export interface Enemy extends Entity {
  type: EnemyType;
  hp: number;
  maxHp: number;
  speed: number;
  oscillationOffset: number;
}

export interface Bullet extends Entity {
  damage: number;
  color: string;
  source: 'PLAYER' | 'TURRET';
}

export interface Particle extends Entity {
  life: number;
  maxLife: number;
  color: string;
  size: number;
  type: 'SPARK' | 'DEBRIS' | 'SMOKE' | 'GLOW';
  angularVelocity?: number;
}

export interface Obstacle {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Decoration {
  x: number;
  y: number;
  size: number;
  rotation: number;
  type: 'rubble' | 'crater';
}

export type GamePhase = 'MENU' | 'TUTORIAL' | 'LOBBY' | 'PLAYING' | 'PAUSED' | 'EXTRACTION_READY' | 'EXTRACTING' | 'REPORT';

export interface GameState {
  player: Player;
  enemies: Enemy[];
  bullets: Bullet[];
  particles: Particle[];
  scrap: Scrap[];
  turrets: Turret[];
  obstacles: Obstacle[];
  decorations: Decoration[];
  
  // Game Flow
  phase: GamePhase;
  gameTime: number; // Total run time
  timeLeft: number; // Countdown to extraction availability
  extractionZone: { pos: Vector2; radius: number; progress: number } | null;
  
  // Economy (Session)
  sessionCredits: number;
  
  screenShake: number;
  outcome?: 'WON' | 'LOST';
}