export const CANVAS_WIDTH = window.innerWidth;
export const CANVAS_HEIGHT = window.innerHeight;

export const COLORS = {
  background: '#0a0a0c',
  grid: '#1f2937',
  gridGlow: '#374151',
  
  // Environment
  obstacleTop: '#1e293b', // slate-800
  obstacleSide: '#0f172a', // slate-900
  obstacleBorder: '#334155', // slate-700
  rubble: '#171717', // neutral-900

  playerBody: '#94a3b8',
  playerArmor: '#475569',
  playerAccent: '#38bdf8',
  bullet: '#06b6d4',
  turret: '#10b981', // emerald-500
  enemyDrone: '#e2e8f0',
  enemyWalker: '#64748b',
  enemyEye: '#ef4444',
  spark: '#f59e0b',
  debris: '#334155',
  scrap: '#fbbf24', // amber-400
  extractionZone: '#10b981', // emerald-500
  extractionZoneActive: '#34d399',
  hudText: '#94a3b8',
};

export const GAME_CONFIG = {
  // Base Stats
  basePlayerSpeed: 4,
  baseBulletSpeed: 12,
  baseFireRate: 150, // ms
  baseDamage: 2.5,
  friction: 0.9,
  
  // Ammo
  magazineSize: 30,
  reloadTime: 1500, // ms
  
  // Enemies
  droneSpeed: 3,
  walkerSpeed: 1,
  spawnRateInitial: 2000,
  
  // Gadgets
  turretDuration: 10000,
  turretCooldown: 15000,
  turretFireRate: 200,
  turretRange: 400,

  // Extraction Loop
  runDuration: 120, // seconds until extraction available
  extractionTime: 5, // seconds to hold zone
  extractionZoneRadius: 100,

  // Shop Costs (Linear scaling for simplicity: cost * level)
  upgradeCostBase: 100,
};