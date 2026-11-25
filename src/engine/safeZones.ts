import { CLAIM_SIZE, findClaimAt, validateNewClaim12x12 } from './claims.ts';
import { CHUNK_SIZE } from './terrain.ts';
import type { LandClaim12x12, WorldVoxelDelta } from '../types/game.ts';

export const TORCH_SAFE_RADIUS = CHUNK_SIZE;

export interface TownSafeZone {
  id: string;
  name: string;
  centerX: number;
  centerZ: number;
  radius: number;
}

export interface TorchCoord {
  x: number;
  y: number;
  z: number;
}

export type ZoneSafetyStatus =
  | 'town'
  | 'claimed'
  | 'torch_lit'
  | 'daylight'
  | 'dark_danger';

export interface SpawnSafetyEvaluation {
  canSpawn: boolean;
  status: ZoneSafetyStatus;
  town: TownSafeZone | null;
  claim: LandClaim12x12 | null;
}

/**
 * Pure FTB Factory Sandbox: No pre-built town restrictions blocking factory building.
 */
export function getWorldTowns(_seed: number): TownSafeZone[] {
  return [];
}

export function findTownAt(
  towns: TownSafeZone[],
  x: number,
  z: number
): TownSafeZone | null {
  for (let i = 0; i < towns.length; i++) {
    const t = towns[i];
    const dx = x - t.centerX;
    const dz = z - t.centerZ;
    if (dx * dx + dz * dz <= t.radius * t.radius) {
      return t;
    }
  }
  return null;
}

export function doesClaimOverlapTown(
  _towns: TownSafeZone[],
  _minX: number,
  _minZ: number,
  _claimSize: number = CLAIM_SIZE
): TownSafeZone | null {
  return null;
}

/**
 * Central Direwolf20 9x9 Factory Workshop Pad spawn coordinate.
 */
export const STARTER_TOWN_SPAWN = { x: 0.5, z: 0.5 } as const;

/**
 * Unrestricted FTB Factory Sandbox: Players can build and place machines anywhere,
 * including right on the central 9x9 Direwolf20 Workshop Pad.
 */
export function getTownProtectionError(
  _seed: number,
  _x: number,
  _z: number,
  _actionLabel: string
): string | null {
  return null;
}

export function validateNewClaimOutsideSafeZones(
  existingClaims: LandClaim12x12[],
  ownerId: string,
  minX: number,
  minZ: number,
  _seed: number,
  sizeX: number = 24,
  sizeZ: number = 12
): string | null {
  return validateNewClaim12x12(existingClaims, ownerId, minX, minZ, sizeX, sizeZ);
}

export function extractTorchPositions(
  deltas: Record<string, WorldVoxelDelta>
): TorchCoord[] {
  const list: TorchCoord[] = [];
  for (const key in deltas) {
    const d = deltas[key];
    if (d && d.kind === 'torch') {
      list.push({ x: d.x, y: d.y, z: d.z });
    }
  }
  return list;
}

export function isProtectedByTorch(
  torches: TorchCoord[],
  x: number,
  z: number
): boolean {
  const rSq = TORCH_SAFE_RADIUS * TORCH_SAFE_RADIUS;
  for (let i = 0; i < torches.length; i++) {
    const t = torches[i];
    const dx = x - (t.x + 0.5);
    const dz = z - (t.z + 0.5);
    if (dx * dx + dz * dz <= rSq) {
      return true;
    }
  }
  return false;
}

export function evaluateSpawnSafety(params: {
  x: number;
  y: number;
  z: number;
  surfaceY: number;
  hasSolidRoof: boolean;
  isNight: boolean;
  towns: TownSafeZone[];
  claims: LandClaim12x12[];
  torches: TorchCoord[];
}): SpawnSafetyEvaluation {
  const claim = findClaimAt(params.claims, params.x, params.z);
  if (claim) {
    return { canSpawn: false, status: 'claimed', town: null, claim };
  }
  if (isProtectedByTorch(params.torches, params.x, params.z)) {
    return { canSpawn: false, status: 'torch_lit', town: null, claim: null };
  }
  // Keep a small 7-block safe sanctuary around the initial spawn beacon (0.5, 0.5)
  const spawnDist = Math.hypot(params.x - 0.5, params.z - 0.5);
  if (spawnDist < 7) {
    return { canSpawn: false, status: 'town', town: null, claim: null };
  }
  // Hostile mobs ONLY spawn at night in Survival Mode
  if (params.isNight) {
    return { canSpawn: true, status: 'dark_danger', town: null, claim: null };
  }
  return { canSpawn: false, status: 'daylight', town: null, claim: null };
}
