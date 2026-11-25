import type { ResourceItemId, TerrainBlockKind } from '../types/game.ts';

// Endless Minecraft-style horizontal world bounds (±10,000,000 blocks in X and Z)
export const WORLD_MIN_XZ = -10000000;
export const WORLD_MAX_XZ = 10000000;
export const WORLD_MIN_Y = -20;
export const WORLD_MAX_Y = 16;

// 12x12 chunk grid streamed dynamically around the player as they explore endlessly
export const CHUNK_SIZE = 12;
export const MAX_ACTIVE_CHUNKS = 16;
export const MINIMAP_VIEW_SPAN_XZ = CHUNK_SIZE * 8; // 96x96 scrolling radar window around player

export interface ChunkCoord {
  cx: number;
  cz: number;
  key: string;
  centerX: number;
  centerZ: number;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export function voxelKey(x: number, y: number, z: number): string {
  return `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`;
}

export function parseVoxelKey(key: string): { x: number; y: number; z: number } | null {
  const parts = key.split(',');
  if (parts.length !== 3) return null;
  const x = Number(parts[0]);
  const y = Number(parts[1]);
  const z = Number(parts[2]);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null;
  return { x, y, z };
}

export function chunkKey(cx: number, cz: number): string {
  return `${cx},${cz}`;
}

export function parseChunkKey(key: string): { cx: number; cz: number } | null {
  const idx = key.indexOf(',');
  if (idx === -1) return null;
  const cx = Number(key.slice(0, idx));
  const cz = Number(key.slice(idx + 1));
  if (!Number.isFinite(cx) || !Number.isFinite(cz)) return null;
  return { cx, cz };
}

export function worldToChunk(coord: number): number {
  return Math.floor(Math.floor(coord) / CHUNK_SIZE);
}

export function getChunkBlockBounds(
  cx: number,
  cz: number
): { minX: number; maxX: number; minZ: number; maxZ: number } {
  const minX = cx * CHUNK_SIZE;
  const minZ = cz * CHUNK_SIZE;
  return {
    minX,
    maxX: minX + CHUNK_SIZE - 1,
    minZ,
    maxZ: minZ + CHUNK_SIZE - 1,
  };
}

export function getChunkCoord(cx: number, cz: number): ChunkCoord {
  const bounds = getChunkBlockBounds(cx, cz);
  return {
    cx,
    cz,
    key: chunkKey(cx, cz),
    centerX: bounds.minX + CHUNK_SIZE * 0.5,
    centerZ: bounds.minZ + CHUNK_SIZE * 0.5,
    ...bounds,
  };
}

export function getChunkCoordByKey(key: string): ChunkCoord | null {
  const parsed = parseChunkKey(key);
  if (!parsed) return null;
  return getChunkCoord(parsed.cx, parsed.cz);
}

/**
 * Dynamically computes the `maxChunks` closest 12x12 chunks around ANY (playerX, playerZ)
 * coordinate in the endless world, sorted closest-first so immediate surroundings stream first.
 */
export function getClosestChunkKeys(
  playerX: number,
  playerZ: number,
  maxChunks = MAX_ACTIVE_CHUNKS
): string[] {
  const pcx = worldToChunk(playerX);
  const pcz = worldToChunk(playerZ);
  const searchRadius = Math.max(2, Math.ceil(Math.sqrt(maxChunks)));
  const scored: { key: string; distSq: number }[] = [];

  for (let dz = -searchRadius; dz <= searchRadius; dz++) {
    const cz = pcz + dz;
    const centerZ = cz * CHUNK_SIZE + CHUNK_SIZE * 0.5;
    const diffZ = playerZ - centerZ;
    for (let dx = -searchRadius; dx <= searchRadius; dx++) {
      const cx = pcx + dx;
      const centerX = cx * CHUNK_SIZE + CHUNK_SIZE * 0.5;
      const diffX = playerX - centerX;
      scored.push({
        key: chunkKey(cx, cz),
        distSq: diffX * diffX + diffZ * diffZ,
      });
    }
  }

  scored.sort((a, b) => a.distSq - b.distSq);
  const count = Math.min(maxChunks, scored.length);
  const out = new Array<string>(count);
  for (let i = 0; i < count; i++) {
    out[i] = scored[i].key;
  }
  return out;
}

export function hashCoords(seed: number, x: number, y: number, z: number): number {
  let h = (seed ^ Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) | 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function getSurfaceHeight(seed: number, x: number, z: number): number {
  // Keep a broad flat factory valley around the central Direwolf20 9x9 Workshop Pad at (0,0)
  const distFromSpawn = Math.hypot(x, z);
  const flattenFactor = distFromSpawn < 11 ? 0 : Math.min(1, (distFromSpawn - 11) / 10);

  const s = (seed % 997) * 0.07;
  const n1 = Math.sin((x + s) * 0.1) * Math.cos((z - s) * 0.1) * 3.0;
  const n2 = Math.sin((x * 0.22 - z * 0.18 + s) * 0.7) * 1.4;
  // Large-scale continental biome waves across the endless world (plateaus, valleys, sandy basins)
  const farFactor = distFromSpawn < 36 ? 0 : Math.min(1, (distFromSpawn - 36) / 30);
  const macro =
    (Math.sin((x - s * 1.7) * 0.028) * Math.cos((z + s * 1.3) * 0.028) * 2.6 +
      Math.sin((x + z) * 0.015 + s) * 1.2) *
    farFactor;

  const raw = Math.round((n1 + n2 + macro) * flattenFactor);
  return Math.max(-3, Math.min(9, raw));
}

export interface NaturalSpawnerSite {
  x: number;
  y: number;
  z: number;
  mobKind: 'night_stalker' | 'slag_golem';
}

const starterSpawnerCache = new Map<number, NaturalSpawnerSite[]>();

/**
 * Generates the 4 deterministic Minecraft-style dungeon Mob Spawner pedestals
 * in the initial starter quadrants (18-25 blocks from the central 9x9 workshop pad).
 */
export function getNaturalMobSpawnerSites(seed: number): NaturalSpawnerSite[] {
  const cached = starterSpawnerCache.get(seed);
  if (cached) return cached;

  const quadrants: [number, number][] = [
    [1, 1],
    [-1, 1],
    [1, -1],
    [-1, -1],
  ];
  const sites: NaturalSpawnerSite[] = quadrants.map(([qx, qz], idx) => {
    const hx = hashCoords(seed + 503, idx, 1, qx);
    const hz = hashCoords(seed + 709, idx, 2, qz);
    const x = qx * (17 + Math.floor(hx * 8));
    const z = qz * (17 + Math.floor(hz * 8));
    const surf = getSurfaceHeight(seed, x, z);
    return {
      x,
      y: surf + 1,
      z,
      mobKind: idx % 2 === 0 ? 'night_stalker' : 'slag_golem',
    };
  });
  if (starterSpawnerCache.size > 32) {
    starterSpawnerCache.clear();
  }
  starterSpawnerCache.set(seed, sites);
  return sites;
}

const SPAWNER_REGION_SIZE = 36; // 3x3 chunks per wilderness dungeon region

/**
 * Returns the deterministic Mob Spawner shrine relevant to block coordinate (x, z)
 * anywhere in the endless world in O(1) time.
 */
export function getNaturalSpawnerNear(
  seed: number,
  x: number,
  z: number
): NaturalSpawnerSite | null {
  // Starter region [-36..35] uses the 4 quadrant spawner shrines
  if (x >= -36 && x <= 35 && z >= -36 && z <= 35) {
    const sites = getNaturalMobSpawnerSites(seed);
    for (let i = 0; i < sites.length; i++) {
      if (Math.abs(x - sites[i].x) <= 3 && Math.abs(z - sites[i].z) <= 3) {
        return sites[i];
      }
    }
    return null;
  }

  // Endless outer regions: each 36x36 region has a 70% chance to contain a dungeon Mob Spawner shrine
  const rx = Math.floor(x / SPAWNER_REGION_SIZE);
  const rz = Math.floor(z / SPAWNER_REGION_SIZE);
  const chance = hashCoords(seed + 1301, rx, 0, rz);
  if (chance > 0.7) return null;

  const hx = hashCoords(seed + 1709, rx, 1, rz);
  const hz = hashCoords(seed + 2113, rx, 2, rz);
  // Keep shrine at least 6 blocks inside the 36x36 region border so its 5x5 plinth never crosses region edges
  const sx = rx * SPAWNER_REGION_SIZE + 6 + Math.floor(hx * (SPAWNER_REGION_SIZE - 12));
  const sz = rz * SPAWNER_REGION_SIZE + 6 + Math.floor(hz * (SPAWNER_REGION_SIZE - 12));
  if (Math.abs(x - sx) > 3 || Math.abs(z - sz) > 3) return null;

  const surf = getSurfaceHeight(seed, sx, sz);
  const kindRoll = hashCoords(seed + 2503, rx, 3, rz);
  return {
    x: sx,
    y: surf + 1,
    z: sz,
    mobKind: kindRoll < 0.55 ? 'night_stalker' : 'slag_golem',
  };
}

function getTreeRoot(seed: number, rx: number, rz: number): { hasTree: boolean; height: number } {
  // Fast grid-spacing filter first (eliminates 96% of coordinates in 2 integer ops)
  if (((rx * 3) % 5 !== 0) || ((rz * 3) % 5 !== 0)) return { hasTree: false, height: 0 };

  // Keep the 9x9 Direwolf20 Factory Workshop Pad clear of trees, surrounded by dense Forestry timber groves
  if (Math.abs(rx) <= 6 && Math.abs(rz) <= 6) return { hasTree: false, height: 0 };

  const h = hashCoords(seed + 71, rx, 0, rz);
  if (h >= 0.56) return { hasTree: false, height: 0 };

  const surf = getSurfaceHeight(seed, rx, rz);
  if (surf <= 0) return { hasTree: false, height: 0 };

  // Keep a 3-block clearing around natural Mob Spawner altars anywhere in the endless world
  const nearSpawner = getNaturalSpawnerNear(seed, rx, rz);
  if (nearSpawner && Math.abs(rx - nearSpawner.x) <= 3 && Math.abs(rz - nearSpawner.z) <= 3) {
    return { hasTree: false, height: 0 };
  }

  return { hasTree: true, height: 4 + Math.floor(h * 3) };
}

export function getBaseVoxel(seed: number, x: number, y: number, z: number): TerrainBlockKind {
  if (y < WORLD_MIN_Y || y > WORLD_MAX_Y) return 'air';
  if (y === WORLD_MIN_Y) return 'bedrock';

  const surfaceY = getSurfaceHeight(seed, x, z);
  const sp = getNaturalSpawnerNear(seed, x, z);

  // Above surface: check natural Mob Spawner shrines first, then procedural Forestry trees
  if (y > surfaceY) {
    if (sp) {
      if (x === sp.x && z === sp.z && y === sp.y) {
        return 'mob_spawner';
      }
      // Mossy/cobble corner pillars around each dungeon spawner shrine
      if (
        Math.abs(x - sp.x) === 2 &&
        Math.abs(z - sp.z) === 2 &&
        y >= surfaceY + 1 &&
        y <= surfaceY + 2
      ) {
        return 'cobblestone';
      }
    }

    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        const rx = x + dx;
        const rz = z + dz;
        const tree = getTreeRoot(seed, rx, rz);
        if (!tree.hasTree) continue;
        const rootSurface = getSurfaceHeight(seed, rx, rz);
        const relY = y - rootSurface;
        if (dx === 0 && dz === 0 && relY >= 1 && relY <= tree.height) {
          return 'wood_log';
        }
        const canopyBottom = tree.height - 1;
        const canopyTop = tree.height + 1;
        if (relY >= canopyBottom && relY <= canopyTop) {
          const dist = Math.abs(dx) + Math.abs(dz);
          if (relY === canopyTop && dist <= 1) return 'leaves';
          if (relY < canopyTop && dist <= 2 && !(Math.abs(dx) === 2 && Math.abs(dz) === 2)) {
            return 'leaves';
          }
        }
      }
    }
    return 'air';
  }

  // Surface layer: Direwolf20 9x9 Factory Workshop Pad at (-4..4, -4..4) & Spawner cobblestone plinths
  if (y === surfaceY) {
    const ax = Math.abs(x);
    const az = Math.abs(z);
    if (ax <= 4 && az <= 4) {
      // Iconic Direwolf20 9x9 laboratory floor pattern (Factory Casing border & center + Laboratory Stone)
      if (ax === 4 || az === 4 || (ax <= 1 && az <= 1)) {
        return 'iron_block';
      }
      return 'stone';
    }
    if (sp && Math.abs(x - sp.x) <= 2 && Math.abs(z - sp.z) <= 2) {
      return 'cobblestone';
    }
    if (surfaceY <= 0) return 'sand';
    return 'grass';
  }

  // Sub-surface soil
  if (y >= surfaceY - 2) {
    const ax = Math.abs(x);
    const az = Math.abs(z);
    if (ax <= 4 && az <= 4) return 'stone';
    return surfaceY <= 0 ? 'sand' : 'dirt';
  }

  // Underground strata with FTB ore veins that grow richer as players explore further into the endless frontier
  const r = hashCoords(seed + 313, x, y, z);
  const distFromSpawn = Math.hypot(x, z);
  const frontierMult =
    distFromSpawn > 90 ? 1.38 : distFromSpawn > 40 ? 1.18 : 1.0;

  const diamondChance = 0.042 * frontierMult;
  const crystalChance = diamondChance + 0.054 * frontierMult;
  const goldChance = crystalChance + 0.058 * frontierMult;
  const ironChance = goldChance + 0.09;
  const copperChance = ironChance + 0.1;
  const coalChance = copperChance + 0.105;

  if (y <= -13 && r < diamondChance) return 'diamond_ore'; // Deep Osmium / Diamond
  if (y <= -7 && r >= diamondChance && r < crystalChance) return 'crystal_ore'; // AE2 Certus Quartz Ore
  if (y <= -4 && r >= crystalChance && r < goldChance) return 'gold_ore';
  if (y <= 0 && r >= goldChance && r < ironChance) return 'iron_ore';
  if (y <= 2 && r >= ironChance && r < copperChance) return 'copper_ore';
  if (r >= copperChance && r < coalChance) return 'coal_ore';

  return 'stone';
}

export function isWithinWorldBounds(x: number, y: number, z: number): boolean {
  return (
    x >= WORLD_MIN_XZ &&
    x <= WORLD_MAX_XZ &&
    z >= WORLD_MIN_XZ &&
    z <= WORLD_MAX_XZ &&
    y >= WORLD_MIN_Y &&
    y <= WORLD_MAX_Y
  );
}

/**
 * Deterministic subsurface ore sample for Mekanism Digital Miner at (mx, mz) based on mineCursor.
 * Deploying Digital Miners further out in the frontier yields higher proportions of rare ores.
 */
export function sampleAutoMinerDrop(
  seed: number,
  mx: number,
  mz: number,
  cursor: number
): ResourceItemId {
  const r = hashCoords(seed + 911, mx, cursor % 240, mz);
  const dist = Math.hypot(mx, mz);
  const rareBonus = dist > 90 ? 0.06 : dist > 40 ? 0.03 : 0;

  if (r < 0.12 + rareBonus) return 'diamond'; // Osmium / Diamond
  if (r < 0.27 + rareBonus * 1.5) return 'crystal_ore'; // Certus Quartz Ore
  if (r < 0.43 + rareBonus * 1.8) return 'gold_ore';
  if (r < 0.64) return 'iron_ore';
  if (r < 0.83) return 'copper_ore';
  return 'coal';
}
